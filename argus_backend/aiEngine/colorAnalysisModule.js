const ACTION_KEYWORDS = [
  "login",
  "register",
  "submit",
  "save",
  "continue",
  "next",
  "confirm",
  "delete",
  "remove",
  "reset",
  "cancel"
];

const ERROR_KEYWORDS = [
  "error",
  "invalid",
  "wrong",
  "required",
  "failed",
  "warning",
  "try again"
];

const normalizeText = (value) => {
  return String(value || "").toLowerCase().trim();
};

const getNodeLabel = (node) => {
  return normalizeText(`${node.name || ""} ${node.text || ""}`);
};

const includesAny = (value, keywords) => {
  const text = normalizeText(value);
  return keywords.some(keyword => text.includes(keyword));
};

const rgbToKey = (color) => {
  if (!color) {
    return null;
  }

  const r = Math.round(Number(color.r || 0));
  const g = Math.round(Number(color.g || 0));
  const b = Math.round(Number(color.b || 0));

  return `${r},${g},${b}`;
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

const detectSameActionDifferentColors = (nodes) => {
  const candidates = [];
  const actionGroups = {};

  nodes.filter(isActionNode).forEach((node) => {
    const actionType = getActionType(node);
    const color = getPrimaryFillColor(node);

    if (!actionType || !color) {
      return;
    }

    if (!actionGroups[actionType]) {
      actionGroups[actionType] = [];
    }

    actionGroups[actionType].push({ node, color });
  });

  Object.keys(actionGroups).forEach((actionType) => {
    const group = actionGroups[actionType];

    if (group.length < 2) {
      return;
    }

    group.forEach((item) => {
      const distances = group
        .filter(other => other.node.nodeId !== item.node.nodeId)
        .map(other => colorDistance(item.color, other.color));

      const maxDistance = Math.max(...distances);
      const evidenceScore = Math.min(maxDistance / 180, 1);

      if (evidenceScore >= 0.5) {
        candidates.push({
          type: "color_inconsistency",
          displayType: "Inconsistent Color for Same Action",
          category: "color_consistency",
          nodeId: item.node.nodeId,
          nodeName: item.node.name,
          nodeType: item.node.type,
          evidenceScore,
          message: `The action "${actionType}" uses a color that differs from the same action elsewhere.`,
          evidence: {
            actionType,
            color: item.color,
            colorDistance: maxDistance
          }
        });
      }
    });
  });

  return candidates;
};

const detectDifferentActionsSameColor = (nodes) => {
  const candidates = [];
  const actionNodes = nodes
    .filter(isActionNode)
    .map(node => ({
      node,
      actionType: getActionType(node),
      color: getPrimaryFillColor(node)
    }))
    .filter(item => item.color && item.actionType);

  actionNodes.forEach((item) => {
    const matchingDifferentActions = actionNodes.filter(other => {
      if (other.node.nodeId === item.node.nodeId) {
        return false;
      }

      if (other.actionType === item.actionType) {
        return false;
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
  });

  return candidates;
};

const detectWeakErrorVisibility = (nodes) => {
  const candidates = [];
  const errorNodes = nodes.filter(isErrorNode);

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

    if (evidenceScore >= 0.5) {
      candidates.push({
        type: "weak_error_visibility",
        displayType: "Weak Error Message Visibility",
        category: "error_recovery",
        nodeId: node.nodeId,
        nodeName: node.name,
        nodeType: node.type,
        evidenceScore,
        message: "An error-related element may not stand out clearly from the rest of the interface.",
        evidence: {
          contrastRatio: ratio,
          errorColor,
          backgroundColor,
          similarNormalTextCount: similarNormalText.length,
          hasDistinctVisualStyle
        }
      });
    }
  });

  return candidates;
};

const analyzeColorPatterns = (designData) => {
  const nodes = Array.isArray(designData.nodes) ? designData.nodes : [];

  return [
    ...detectSameActionDifferentColors(nodes),
    ...detectDifferentActionsSameColor(nodes),
    ...detectWeakErrorVisibility(nodes)
  ];
};

module.exports = {
  analyzeColorPatterns
};