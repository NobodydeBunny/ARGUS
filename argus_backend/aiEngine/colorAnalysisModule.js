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
  numberOrZero,
  normalizeText
} = require("./featureExtractor");

const getRepresentativeNode = (items, fallback) => {
  if (!items || items.length === 0) return fallback;
  return items[0].node || items[0];
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

    let maxDistance = 0;
    group.forEach((first, i) => {
      group.forEach((second, j) => {
        if (i !== j) maxDistance = Math.max(maxDistance, colorDistance(first.color, second.color));
      });
    });

    const evidenceScore = Math.min(1, maxDistance / 170);
    if (maxDistance >= 70) {
      candidates.push(createCandidate({
        moduleName: "color",
        candidateType: "color_inconsistency",
        displayType: "Same Action Uses Different Colors",
        node: getRepresentativeNode(group),
        evidenceScore,
        principle: "Consistency and Standards",
        message: `The action "${actionType}" uses different colors across similar UI elements.`,
        evidence: {
          ...globalFeatures,
          sameActionColorDeviation: maxDistance,
          colorPatternDeviation: maxDistance / 255,
          actionColorCount: new Set(group.map(item => exactColorKey(item.color))).size,
          actionType
        }
      }));
    }
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

  if (conflictingPairs.length > 0) {
    const [first, second] = conflictingPairs[0];
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
        differentActionSameColorScore: conflictingPairs.length,
        colorPatternDeviation: conflictingPairs.length,
        actionColorCount: actionNodes.length,
        firstAction: first.actionType,
        secondAction: second.actionType
      }
    }));
  }

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
    const hasVisualErrorStyle = label.includes("error") || label.includes("warning") || label.includes("danger") || label.includes("invalid");

    const lowContrastScore = ratio ? Math.max(0, (4.5 - ratio) / 4.5) : 0;
    const blendScore = Math.max(0, (95 - visibilityDistance) / 95);
    const poorStyleScore = hasVisualErrorStyle ? 0 : 0.55;

    const commonEvidence = {
      ...globalFeatures,
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
        principle: "Visibility of System Status",
        message: "An error or warning message is too visually similar to the surrounding interface and may blend into the background.",
        evidence: {
          ...commonEvidence,
          errorVisibilityScore: Math.max(0.55, blendScore),
          colorPatternDeviation: blendScore
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
          colorPatternDeviation: lowContrastScore
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
        principle: "Visibility of System Status",
        message: "An error-related element does not use a clear error-state style such as an error color, warning icon, or validation wording.",
        evidence: {
          ...commonEvidence,
          errorVisibilityScore: poorStyleScore,
          colorPatternDeviation: poorStyleScore
        }
      }));
    }
  });

  return candidates;
};

const detectColorOveruse = (nodes, globalFeatures) => {
  const candidates = [];
  const coloredNodes = nodes.map(node => ({ node, color: getPrimaryFillColor(node) })).filter(item => item.color);
  if (coloredNodes.length < 6) return candidates;

  const colorBuckets = {};
  coloredNodes.forEach(item => {
    const key = colorKey(item.color, 32);
    colorBuckets[key] = colorBuckets[key] || [];
    colorBuckets[key].push(item);
  });

  const dominantGroups = Object.values(colorBuckets).filter(group => group.length >= Math.max(5, coloredNodes.length * 0.45));
  if (dominantGroups.length > 0 && globalFeatures.actionColorCount > 2) {
    const group = dominantGroups[0];
    const evidenceScore = Math.min(1, group.length / Math.max(coloredNodes.length, 1));
    candidates.push(createCandidate({
      moduleName: "color",
      candidateType: "same_color_different_actions",
      displayType: "Color Meaning Is Not Distinct",
      node: group[0].node,
      evidenceScore,
      principle: "Consistency and Standards",
      message: "One color is used heavily across different UI purposes, which can weaken visual meaning and hierarchy.",
      evidence: {
        ...globalFeatures,
        differentActionSameColorScore: group.length,
        colorPatternDeviation: evidenceScore,
        colorCount: Object.keys(colorBuckets).length
      }
    }));
  }

  return candidates;
};

const analyzeColorPatterns = (designData) => {
  const nodes = getNodes(designData);
  const globalFeatures = buildGlobalFeatures(nodes, "color");

  return [
    ...detectSameActionDifferentColors(nodes, globalFeatures),
    ...detectDifferentActionsSameColor(nodes, globalFeatures),
    ...detectWeakErrorVisibility(nodes, globalFeatures),
    ...detectColorOveruse(nodes, globalFeatures)
  ];
};

module.exports = {
  analyzeColorPatterns
};
