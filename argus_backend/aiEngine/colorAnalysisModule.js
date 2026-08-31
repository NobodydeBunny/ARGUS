const {
  getNodes,
  getPrimaryFillColor,
  findNearestBackground,
  colorDistance,
  exactColorKey,
  colorKey,
  contrastRatio,
  getActionType,
  isActionNode,
  isErrorNode,
  buildGlobalFeatures,
  createCandidate,
  normalizeText
} = require("./featureExtractor");

const rgbToHex = (color) => {
  if (!color) return null;

  const channelToHex = (value) => {
    const number = Math.max(0, Math.min(255, Math.round(Number(value || 0))));
    return number.toString(16).padStart(2, "0");
  };

  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`.toUpperCase();
};

const getRepresentativeNode = (items, fallback) => {
  if (!items || items.length === 0) return fallback;
  return items[0].node || items[0];
};

const averageColor = (items) => {
  const valid = items.map(item => item.color || item).filter(Boolean);
  if (valid.length === 0) return null;

  const total = valid.reduce((sum, color) => ({
    r: sum.r + Number(color.r || 0),
    g: sum.g + Number(color.g || 0),
    b: sum.b + Number(color.b || 0)
  }), { r: 0, g: 0, b: 0 });

  return {
    r: Math.round(total.r / valid.length),
    g: Math.round(total.g / valid.length),
    b: Math.round(total.b / valid.length)
  };
};

const isNeutralColor = (color) => {
  if (!color) return true;

  const r = Number(color.r || 0);
  const g = Number(color.g || 0);
  const b = Number(color.b || 0);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Ignoring black/white/gray style colors
  const isGrayLike = (max - min) < 28;
  const isAlmostWhite = min > 242;
  const isAlmostBlack = max < 25;
  return isGrayLike || isAlmostWhite || isAlmostBlack;
};

const createColorEvidence = ({
  globalFeatures,
  expectedColor,
  actualColor,
  actionType,
  similarElementsCount,
  extra = {}
}) => ({
  ...globalFeatures,
  expectedColor,
  actualColor,
  themeColor: expectedColor,
  nodeColor: actualColor,
  expectedColorHex: rgbToHex(expectedColor),
  actualColorHex: rgbToHex(actualColor),
  actionType,
  similarElementsCount,
  colorPatternDeviation: colorDistance(expectedColor, actualColor) / 255,
  ...extra
});

const detectDominantThemeColorOutlier = (nodes, globalFeatures) => {
  const candidates = [];

  const coloredNodes = nodes
    .map(node => ({ node, color: getPrimaryFillColor(node) }))
    .filter(item => item.color && !isNeutralColor(item.color));

  if (coloredNodes.length < 4) return candidates;

  const buckets = {};
  coloredNodes.forEach((item) => {
    const key = colorKey(item.color, 32);
    buckets[key] = buckets[key] || [];
    buckets[key].push(item);
  });

  const bucketGroups = Object.values(buckets).sort((first, second) => second.length - first.length);
  const dominantGroup = bucketGroups[0];

  if (!dominantGroup || dominantGroup.length < Math.max(3, coloredNodes.length * 0.45)) {
    return candidates;
  }

  const expectedColor = averageColor(dominantGroup);
  const dominantKeys = new Set(dominantGroup.map(item => item.node.nodeId));

  const outliers = coloredNodes
    .filter(item => !dominantKeys.has(item.node.nodeId))
    .map(item => ({
      ...item,
      distance: colorDistance(item.color, expectedColor),
      isAction: isActionNode(item.node)
    }))
    .filter(item => item.distance >= 85)
    .sort((first, second) => {
      if (first.isAction !== second.isAction) return first.isAction ? -1 : 1;
      return second.distance - first.distance;
    });

  if (outliers.length === 0) return candidates;

  const outlier = outliers[0];
  const evidenceScore = Math.min(1, Math.max(0.58, outlier.distance / 180));

  candidates.push(createCandidate({
    moduleName: "color",
    candidateType: "color_inconsistency",
    displayType: "Theme Color Outlier",
    node: outlier.node,
    evidenceScore,
    principle: "Consistency and Standards",
    message: "This element uses a color that does not follow the dominant color theme detected in the selected design.",
    evidence: createColorEvidence({
      globalFeatures,
      expectedColor,
      actualColor: outlier.color,
      actionType: getActionType(outlier.node),
      similarElementsCount: dominantGroup.length,
      extra: {
        matchingThemeElements: dominantGroup.length,
        outlierColorDistance: outlier.distance,
        colorCount: Object.keys(buckets).length,
        reason: "dominant_theme_color_outlier"
      }
    })
  }));

  return candidates;
};

const detectSameActionDifferentColors = (nodes, globalFeatures) => {
  const candidates = [];
  const actionGroups = {};

  nodes.filter(isActionNode).forEach((node) => {
    const actionType = getActionType(node);
    const color = getPrimaryFillColor(node);
    if (!actionType || !color) return;

    actionGroups[actionType] = actionGroups[actionType] || [];
    actionGroups[actionType].push({ node, color });
  });

  Object.keys(actionGroups).forEach((actionType) => {
    const group = actionGroups[actionType];
    if (group.length < 2) return;

    const colorBuckets = {};
    group.forEach((item) => {
      const key = colorKey(item.color, 32);
      colorBuckets[key] = colorBuckets[key] || [];
      colorBuckets[key].push(item);
    });

    const sortedGroups = Object.values(colorBuckets).sort((first, second) => second.length - first.length);
    const referenceGroup = sortedGroups[0];
    const referenceColor = averageColor(referenceGroup);

    let outlier = null;
    let maxDistance = 0;

    group.forEach((item) => {
      const distance = colorDistance(item.color, referenceColor);
      if (distance > maxDistance) {
        maxDistance = distance;
        outlier = item;
      }
    });

    if (!outlier || maxDistance < 70) return;

    const evidenceScore = Math.min(1, Math.max(0.58, maxDistance / 170));

    candidates.push(createCandidate({
      moduleName: "color",
      candidateType: "color_inconsistency",
      displayType: "Same Action Uses Different Colors",
      node: outlier.node,
      evidenceScore,
      principle: "Consistency and Standards",
      message: `The action "${actionType}" uses inconsistent colors across similar UI elements.`,
      evidence: createColorEvidence({
        globalFeatures,
        expectedColor: referenceColor,
        actualColor: outlier.color,
        actionType,
        similarElementsCount: referenceGroup.length,
        extra: {
          sameActionColorDeviation: maxDistance,
          actionColorCount: new Set(group.map(item => exactColorKey(item.color))).size,
          reason: "same_action_different_colors"
        }
      })
    }));
  });

  return candidates;
};

const detectDifferentActionsSameColor = (nodes, globalFeatures) => {
  const candidates = [];

  const actionNodes = nodes
    .filter(isActionNode)
    .map(node => ({ node, actionType: getActionType(node), color: getPrimaryFillColor(node) }))
    .filter(item => item.actionType && item.color);

  if (actionNodes.length < 2) return candidates;

  const conflictingPairs = [];

  for (let i = 0; i < actionNodes.length; i += 1) {
    for (let j = i + 1; j < actionNodes.length; j += 1) {
      const first = actionNodes[i];
      const second = actionNodes[j];

      if (first.actionType !== second.actionType && colorDistance(first.color, second.color) <= 24) {
        conflictingPairs.push([first, second]);
      }
    }
  }

  if (conflictingPairs.length === 0) return candidates;

  const [first, second] = conflictingPairs[0];
  const sharedColor = averageColor([first.color, second.color]);
  const evidenceScore = Math.min(1, 0.55 + conflictingPairs.length / 8);

  candidates.push(createCandidate({
    moduleName: "color",
    candidateType: "same_color_different_actions",
    displayType: "Different Actions Use the Same Color",
    node: first.node,
    evidenceScore,
    principle: "Error Prevention",
    message: `Different actions such as "${first.actionType}" and "${second.actionType}" use nearly the same color, which may confuse users.`,
    evidence: {
      ...globalFeatures,
      sharedColor,
      sharedColorHex: rgbToHex(sharedColor),
      actualColor: first.color,
      firstAction: first.actionType,
      secondAction: second.actionType,
      firstNodeName: first.node.name || first.node.text,
      secondNodeName: second.node.name || second.node.text,
      differentActionSameColorScore: conflictingPairs.length,
      colorPatternDeviation: conflictingPairs.length,
      actionColorCount: actionNodes.length,
      reason: "different_actions_same_color"
    }
  }));

  return candidates;
};

const detectWeakErrorVisibility = (nodes, globalFeatures) => {
  const candidates = [];
  const errorNodes = nodes.filter(isErrorNode);

  if (errorNodes.length === 0) return candidates;

  errorNodes.forEach((node) => {
    const foreground = getPrimaryFillColor(node);
    const background = findNearestBackground(node, nodes);
    const ratio = Number.isFinite(Number(node.contrastRatio))
      ? Number(node.contrastRatio)
      : contrastRatio(foreground, background);
    const visibilityDistance = colorDistance(foreground, background);
    const label = normalizeText(`${node.name || ""} ${node.text || ""}`);

    // Detect whether the error element has explicit error state clues.
    const hasVisualErrorStyle = label.includes("error") || label.includes("warning") || label.includes("danger") || label.includes("invalid");

    const lowContrastScore = ratio ? Math.max(0, (4.5 - ratio) / 4.5) : 0;
    const blendScore = Math.max(0, (95 - visibilityDistance) / 95);
    const poorStyleScore = hasVisualErrorStyle ? 0 : 0.55;

    const commonEvidence = {
      ...globalFeatures,
      foregroundColor: foreground,
      backgroundColor: background,
      foregroundColorHex: rgbToHex(foreground),
      backgroundColorHex: rgbToHex(background),
      actualColor: foreground,
      errorElementCount: errorNodes.length,
      errorContrastRatio: ratio || 0,
      colorDistanceToBackground: visibilityDistance,
      hasVisualErrorStyle: hasVisualErrorStyle ? 1 : 0
    };

    if (visibilityDistance < 95) {
      candidates.push(createCandidate({
        moduleName: "color",
        candidateType: "weak_error_visibility",
        displayType: "Error Message Blends Into Interface",
        node,
        evidenceScore: Math.max(0.55, blendScore),
        principle: "Help Users Recognize, Diagnose and Recover from Errors",
        message: "An error or warning message is too visually similar to the surrounding interface and may blend into the background.",
        evidence: {
          ...commonEvidence,
          errorVisibilityScore: Math.max(0.55, blendScore),
          colorPatternDeviation: blendScore,
          reason: "error_blends_with_background"
        }
      }));
    }

    if (ratio && ratio < 4.5) {
      candidates.push(createCandidate({
        moduleName: "color",
        candidateType: "low_contrast_error_message",
        displayType: "Low Contrast Error Message",
        node,
        evidenceScore: Math.max(0.6, lowContrastScore),
        principle: "Accessibility and Visibility",
        message: "An error or warning message has a contrast ratio below the recommended readability threshold.",
        evidence: {
          ...commonEvidence,
          errorVisibilityScore: Math.max(0.6, lowContrastScore),
          colorPatternDeviation: lowContrastScore,
          reason: "low_contrast_error_message"
        }
      }));
    }

    if (!hasVisualErrorStyle) {
      candidates.push(createCandidate({
        moduleName: "color",
        candidateType: "poor_error_state_styling",
        displayType: "Poor Error State Styling",
        node,
        evidenceScore: poorStyleScore,
        principle: "Help Users Recognize, Diagnose and Recover from Errors",
        message: "An error-related element does not use a clear error-state style such as an error color, warning icon, or validation wording.",
        evidence: {
          ...commonEvidence,
          errorVisibilityScore: poorStyleScore,
          colorPatternDeviation: poorStyleScore,
          reason: "poor_error_state_styling"
        }
      }));
    }
  });

  return candidates;
};

const analyzeColorPatterns = (designData) => {
  const nodes = getNodes(designData);
  const globalFeatures = buildGlobalFeatures(nodes, "color");

  return [
    ...detectDominantThemeColorOutlier(nodes, globalFeatures),
    ...detectSameActionDifferentColors(nodes, globalFeatures),
    ...detectDifferentActionsSameColor(nodes, globalFeatures),
    ...detectWeakErrorVisibility(nodes, globalFeatures)
  ];
};

module.exports = {
  analyzeColorPatterns
};
