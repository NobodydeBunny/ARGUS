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

const getPrimaryFillColor = (node) => {
  if (node.fillColor) {
    return node.fillColor;
  }

  if (Array.isArray(node.fills) && node.fills.length > 0) {
    const solidFill = node.fills.find(fill => fill && fill.type === "SOLID");

    if (solidFill && solidFill.color) {
      return {
        r: Math.round(solidFill.color.r * 255),
        g: Math.round(solidFill.color.g * 255),
        b: Math.round(solidFill.color.b * 255)
      };
    }
  }

  return null;
};

const getActionType = (node) => {
  const label = getNodeLabel(node);
  return ACTION_KEYWORDS.find(keyword => label.includes(keyword)) || null;
};

const isActionNode = (node) => {
  return Boolean(getActionType(node));
};

const isErrorNode = (node) => {
  const label = getNodeLabel(node);
  return includesAny(label, ERROR_KEYWORDS);
};

const colorDistance = (firstColor, secondColor) => {
  if (!firstColor || !secondColor) {
    return 0;
  }

  const rDiff = Number(firstColor.r) - Number(secondColor.r);
  const gDiff = Number(firstColor.g) - Number(secondColor.g);
  const bDiff = Number(firstColor.b) - Number(secondColor.b);

  return Math.sqrt((rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff));
};

const luminance = (color) => {
  if (!color) {
    return 0;
  }

  const values = [color.r, color.g, color.b].map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

const contrastRatio = (foreground, background) => {
  if (!foreground || !background) {
    return null;
  }

  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
};

const findNearestBackground = (node, nodes) => {
  const parent = nodes.find(item => item.nodeId === node.parentId);

  if (parent) {
    const parentColor = getPrimaryFillColor(parent);

    if (parentColor) {
      return parentColor;
    }
  }

  const frames = nodes.filter(item => ["FRAME", "GROUP", "COMPONENT", "INSTANCE"].includes(item.type));
  const possibleBackground = frames.find(frame => {
    const frameX = Number(frame.x || 0);
    const frameY = Number(frame.y || 0);
    const frameWidth = Number(frame.width || 0);
    const frameHeight = Number(frame.height || 0);
    const nodeX = Number(node.x || 0);
    const nodeY = Number(node.y || 0);

    return nodeX >= frameX &&
      nodeY >= frameY &&
      nodeX <= frameX + frameWidth &&
      nodeY <= frameY + frameHeight;
  });

  return getPrimaryFillColor(possibleBackground) || { r: 255, g: 255, b: 255 };
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
      const distances = group
        .filter(other => other.node.nodeId !== item.node.nodeId)
        .map(other => colorDistance(item.color, other.color));

      const maxDistance = Math.max(...distances);
      const evidenceScore = Math.min(maxDistance / 180, 1);

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

      return colorDistance(item.color, other.color) <= 18;
    });

    if (matchingDifferentActions.length > 0) {
      candidates.push({
        type: "same_color_different_actions",
        displayType: "Same Color Used for Different Actions",
        category: "color_consistency",
        nodeId: item.node.nodeId,
        nodeName: item.node.name,
        nodeType: item.node.type,
        evidenceScore: 0.72,
        message: "Different actions appear to use nearly the same color, which may reduce meaning clarity.",
        evidence: {
          actionType: item.actionType,
          color: item.color,
          conflictingActions: matchingDifferentActions.map(match => match.actionType)
        }
      });
    }
  }));

  return candidates;
};

const detectWeakErrorVisibility = (nodes, globalFeatures) => {
  const candidates = [];
  const errorNodes = nodes.filter(isErrorNode);

  if (errorNodes.length === 0) return candidates;

  errorNodes.forEach((node) => {
    const errorColor = getPrimaryFillColor(node);
    const backgroundColor = findNearestBackground(node, nodes);
    const ratio = contrastRatio(errorColor, backgroundColor);

    let evidenceScore = 0;

    if (ratio != null && ratio < 4.5) {
      evidenceScore = Math.max(evidenceScore, 0.85);
    }

    const normalTextNodes = nodes.filter(item => {
      return item.type === "TEXT" &&
        !isErrorNode(item) &&
        getPrimaryFillColor(item);
    });

    const similarNormalText = normalTextNodes.filter(item => {
      return colorDistance(getPrimaryFillColor(item), errorColor) < 35;
    });

    if (similarNormalText.length > 0) {
      evidenceScore = Math.max(evidenceScore, 0.68);
    }

    const hasErrorStyleName = includesAny(getNodeLabel(node), ERROR_KEYWORDS);
    const hasDistinctVisualStyle = errorColor && colorDistance(errorColor, { r: 220, g: 38, b: 38 }) < 90;

    if (hasErrorStyleName && !hasDistinctVisualStyle) {
      evidenceScore = Math.max(evidenceScore, 0.62);
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

// Run all color analysis rules
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
