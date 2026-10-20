const EXIT_KEYWORDS = [
  "close", "cancel", "back", "exit", "dismiss", "x", "return", "go back"
];

const MODAL_KEYWORDS = [
  "modal", "dialog", "popup", "overlay", "confirmation", "confirm", "alert"
];

const BUTTON_HINTS = [
  "button", "btn", "submit", "save", "continue", "next", "cancel", "delete",
  "remove", "reset", "confirm", "login", "register", "create", "restore", "apply"
];

const DESTRUCTIVE_KEYWORDS = [
  "delete", "remove", "discard", "reset", "erase", "clear", "deactivate", "disable",
  "logout", "sign out", "permanent", "destroy"
];

const CONFIRMATION_KEYWORDS = [
  "confirm", "confirmation", "are you sure", "warning", "cannot be undone", "proceed"
];

const UNDO_KEYWORDS = [
  "undo", "restore", "recover", "revert", "back up", "rollback"
];

const ERROR_KEYWORDS = [
  "error", "invalid", "wrong", "required", "failed", "failure", "warning", "try again",
  "danger", "alert", "not allowed"
];

const ACTION_KEYWORDS = [
  "login", "register", "submit", "save", "continue", "next", "confirm", "delete",
  "remove", "reset", "cancel", "restore", "apply", "update", "create", "send", "pay"
];

const PROJECT_FEATURE_COLUMNS = [
  "nodeCount", "screenWidth", "screenHeight", "screenArea",
  "isModalLike", "modalConfidence", "hasExitControl", "hasDestructiveAction",
  "hasUndoOption", "hasConfirmationDialog", "interactiveElementCount", "textElementCount",
  "errorElementCount", "buttonCount", "inputCount", "controlDensity", "textDensity",
  "averageSpacing", "spacingDeviation", "maxSpacingGap", "alignmentDeviation",
  "misalignedElementCount", "cornerRadiusDeviation", "buttonHeightDeviation",
  "buttonWidthDeviation", "buttonAspectRatioDeviation", "colorCount", "actionColorCount",
  "sameActionColorDeviation", "differentActionSameColorScore", "colorPatternDeviation",
  "errorContrastRatio", "errorVisibilityScore", "backgroundContrastAverage",
  "destructiveActionCount", "confirmationControlCount", "layoutGroupSize", "overlayPresent",
  "module_layout", "module_color", "module_error", "module_normal"
];

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const getNodeLabel = (node) => normalizeText(`${node.name || ""} ${node.text || ""} ${node.iconName || ""}`);

const includesAny = (value, keywords) => {
  const text = normalizeText(value);
  return keywords.some(keyword => text.includes(keyword));
};

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getNodes = (designData) => Array.isArray(designData.nodes) ? designData.nodes.filter(node => node && node.visible !== false) : [];

const getChildren = (node, nodes) => nodes.filter(child => child.parentId === node.nodeId);

const getPrimaryFillColor = (node) => {
  if (!node) return null;

  if (node.fillColor && Number.isFinite(Number(node.fillColor.r))) {
    return {
      r: Math.round(Number(node.fillColor.r)),
      g: Math.round(Number(node.fillColor.g)),
      b: Math.round(Number(node.fillColor.b))
    };
  }

  if (Array.isArray(node.fills)) {
    const solidFill = node.fills.find(fill => fill && fill.type === "SOLID" && fill.visible !== false && fill.color);
    if (solidFill) {
      return {
        r: Math.round(Number(solidFill.color.r) * 255),
        g: Math.round(Number(solidFill.color.g) * 255),
        b: Math.round(Number(solidFill.color.b) * 255)
      };
    }
  }

  return null;
};

const colorKey = (color, bucketSize = 16) => {
  if (!color) return null;
  const bucket = value => Math.max(0, Math.min(255, Math.round(Number(value || 0) / bucketSize) * bucketSize));
  return `${bucket(color.r)},${bucket(color.g)},${bucket(color.b)}`;
};

const exactColorKey = (color) => {
  if (!color) return null;
  return `${Math.round(Number(color.r || 0))},${Math.round(Number(color.g || 0))},${Math.round(Number(color.b || 0))}`;
};

const colorDistance = (firstColor, secondColor) => {
  if (!firstColor || !secondColor) return 0;
  const rDiff = Number(firstColor.r || 0) - Number(secondColor.r || 0);
  const gDiff = Number(firstColor.g || 0) - Number(secondColor.g || 0);
  const bDiff = Number(firstColor.b || 0) - Number(secondColor.b || 0);
  return Math.sqrt((rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff));
};

const luminance = (color) => {
  if (!color) return 0;
  const values = [color.r, color.g, color.b].map((value) => {
    const channel = Number(value || 0) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

const contrastRatio = (foreground, background) => {
  if (!foreground || !background) return null;
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
};

const getParentNode = (node, nodes) => nodes.find(item => item.nodeId === node.parentId) || null;

const findNearestBackground = (node, nodes) => {
  const parent = getParentNode(node, nodes);
  const parentColor = getPrimaryFillColor(parent);
  if (parentColor) return parentColor;

  const frames = nodes.filter(item => ["FRAME", "GROUP", "COMPONENT", "INSTANCE", "MODAL", "OVERLAY"].includes(String(item.type || "").toUpperCase()));
  const nodeX = numberOrZero(node.x);
  const nodeY = numberOrZero(node.y);

  const containers = frames.filter(frame => {
    if (frame.nodeId === node.nodeId) return false;
    const x = numberOrZero(frame.x);
    const y = numberOrZero(frame.y);
    const width = numberOrZero(frame.width);
    const height = numberOrZero(frame.height);
    return nodeX >= x && nodeY >= y && nodeX <= x + width && nodeY <= y + height;
  }).sort((a, b) => (numberOrZero(a.width) * numberOrZero(a.height)) - (numberOrZero(b.width) * numberOrZero(b.height)));

  for (const container of containers) {
    const color = getPrimaryFillColor(container);
    if (color) return color;
  }

  return { r: 255, g: 255, b: 255 };
};

const getActionType = (node) => {
  const label = getNodeLabel(node);
  return ACTION_KEYWORDS.find(keyword => label.includes(keyword)) || null;
};

const isActionNode = (node) => Boolean(getActionType(node));
const isExitNode = (node) => includesAny(getNodeLabel(node), EXIT_KEYWORDS) || node.hasCloseButton === true;
const isDestructiveNode = (node) => includesAny(getNodeLabel(node), DESTRUCTIVE_KEYWORDS);
const isConfirmationNode = (node) => includesAny(getNodeLabel(node), CONFIRMATION_KEYWORDS);
const isUndoNode = (node) => includesAny(getNodeLabel(node), UNDO_KEYWORDS);
const isErrorNode = (node) => includesAny(getNodeLabel(node), ERROR_KEYWORDS);

const isButtonLike = (node) => {
  const type = String(node.type || "").toUpperCase();
  const label = getNodeLabel(node);
  return ["BUTTON", "RECTANGLE", "INSTANCE", "COMPONENT"].includes(type) ||
    normalizeText(node.componentId).includes("button") ||
    normalizeText(node.mainComponentId).includes("button") ||
    BUTTON_HINTS.some(keyword => label.includes(keyword));
};

const isInputLike = (node) => {
  const type = String(node.type || "").toUpperCase();
  const label = getNodeLabel(node);
  return type === "INPUT" || normalizeText(node.componentId).includes("input") || label.includes("input") || label.includes("field");
};

const isInteractive = (node) => isButtonLike(node) || isInputLike(node) || isActionNode(node) || isExitNode(node);

const isFrameLike = (node) => ["FRAME", "GROUP", "COMPONENT", "INSTANCE", "MODAL", "OVERLAY"].includes(String(node.type || "").toUpperCase());

const isModalLike = (node, nodes) => {
  const label = getNodeLabel(node);
  const type = String(node.type || "").toUpperCase();
  const children = getChildren(node, nodes);
  const width = numberOrZero(node.width);
  const height = numberOrZero(node.height);
  const hasModalName = includesAny(label, MODAL_KEYWORDS);
  const hasOverlay = node.overlay === true || label.includes("overlay") || children.some(child => getNodeLabel(child).includes("overlay"));
  const hasConfirmationContent = children.some(child => isConfirmationNode(child) || isDestructiveNode(child));
  const sizeLooksDialog = width > 180 && height > 120 && width <= 650 && height <= 520;

  return type === "MODAL" || hasModalName || (isFrameLike(node) && sizeLooksDialog && (hasOverlay || hasConfirmationContent));
};

const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const standardDeviation = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  if (valid.length <= 1) return 0;
  const mean = average(valid);
  const variance = average(valid.map(value => Math.pow(value - mean, 2)));
  return Math.sqrt(variance);
};

const range = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  if (valid.length <= 1) return 0;
  return Math.max(...valid) - Math.min(...valid);
};

const calculateVerticalGaps = (nodes) => {
  const sorted = [...nodes]
    .filter(node => Number.isFinite(Number(node.y)) && Number.isFinite(Number(node.height)))
    .sort((a, b) => Number(a.y) - Number(b.y));

  const gaps = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previousBottom = numberOrZero(sorted[index - 1].y) + numberOrZero(sorted[index - 1].height);
    const gap = numberOrZero(sorted[index].y) - previousBottom;
    if (gap >= 0 && gap < 300) gaps.push(gap);
  }
  return gaps;
};

const calculateAlignmentStats = (nodes) => {
  const candidates = nodes.filter(node => Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.width)) && !isFrameLike(node));
  if (candidates.length < 3) {
    return { alignmentDeviation: 0, misalignedElementCount: 0, expectedX: 0, xPositions: [] };
  }

  const xPositions = candidates.map(node => Math.round(numberOrZero(node.x)));
  const buckets = new Map();
  xPositions.forEach(x => {
    const bucket = Math.round(x / 8) * 8;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  });

  const expectedX = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const deviations = xPositions.map(x => Math.abs(x - expectedX));
  const misalignedElementCount = deviations.filter(value => value > 16).length;
  const alignmentDeviation = deviations.length ? Math.max(...deviations) : 0;

  return { alignmentDeviation, misalignedElementCount, expectedX, xPositions };
};

const getMainFrame = (nodes) => {
  const frames = nodes.filter(isFrameLike);
  if (frames.length === 0) return null;
  return frames.sort((a, b) => (numberOrZero(b.width) * numberOrZero(b.height)) - (numberOrZero(a.width) * numberOrZero(a.height)))[0];
};

const buildGlobalFeatures = (nodes, moduleName = "normal") => {
  const visibleNodes = nodes.filter(node => node.visible !== false);
  const mainFrame = getMainFrame(visibleNodes) || visibleNodes[0] || {};
  const screenWidth = numberOrZero(mainFrame.width);
  const screenHeight = numberOrZero(mainFrame.height);
  const screenArea = screenWidth * screenHeight;

  const buttons = visibleNodes.filter(isButtonLike);
  const inputs = visibleNodes.filter(isInputLike);
  const interactiveNodes = visibleNodes.filter(isInteractive);
  const textNodes = visibleNodes.filter(node => String(node.type || "").toUpperCase() === "TEXT");
  const errorNodes = visibleNodes.filter(isErrorNode);
  const destructiveNodes = visibleNodes.filter(isDestructiveNode);
  const confirmationNodes = visibleNodes.filter(isConfirmationNode);

  const modalNodes = visibleNodes.filter(node => isModalLike(node, visibleNodes));
  const modalConfidence = modalNodes.length > 0 ? Math.min(1, 0.45 + (modalNodes.length * 0.15)) : 0;

  const verticalGaps = calculateVerticalGaps(visibleNodes.filter(node => !isFrameLike(node)));
  const spacingValues = visibleNodes.map(node => numberOrZero(node.itemSpacing || node.spacing)).filter(value => value > 0 && value < 250);
  const allSpacingValues = verticalGaps.concat(spacingValues);

  const alignmentStats = calculateAlignmentStats(visibleNodes);

  const cornerRadii = buttons.map(node => numberOrZero(node.cornerRadius)).filter(value => Number.isFinite(value));
  const buttonHeights = buttons.map(node => numberOrZero(node.height)).filter(value => value > 0);
  const buttonWidths = buttons.map(node => numberOrZero(node.width)).filter(value => value > 0);
  const buttonRatios = buttons.map(node => numberOrZero(node.width) / Math.max(numberOrZero(node.height), 1)).filter(Number.isFinite);

  const colors = visibleNodes.map(getPrimaryFillColor).filter(Boolean);
  const colorKeys = new Set(colors.map(item => colorKey(item)).filter(Boolean));

  const actionNodes = visibleNodes
    .filter(isActionNode)
    .map(node => ({ node, actionType: getActionType(node), color: getPrimaryFillColor(node) }))
    .filter(item => item.actionType && item.color);

  const actionColorKeys = new Set(actionNodes.map(item => `${item.actionType}:${exactColorKey(item.color)}`));

  let sameActionColorDeviation = 0;
  const byAction = {};
  actionNodes.forEach(item => {
    byAction[item.actionType] = byAction[item.actionType] || [];
    byAction[item.actionType].push(item.color);
  });
  Object.values(byAction).forEach(groupColors => {
    for (let i = 0; i < groupColors.length; i += 1) {
      for (let j = i + 1; j < groupColors.length; j += 1) {
        sameActionColorDeviation = Math.max(sameActionColorDeviation, colorDistance(groupColors[i], groupColors[j]));
      }
    }
  });

  let differentActionSameColorScore = 0;
  for (let i = 0; i < actionNodes.length; i += 1) {
    for (let j = i + 1; j < actionNodes.length; j += 1) {
      if (actionNodes[i].actionType !== actionNodes[j].actionType && colorDistance(actionNodes[i].color, actionNodes[j].color) <= 24) {
        differentActionSameColorScore += 1;
      }
    }
  }

  const errorContrasts = errorNodes.map(node => {
    if (Number.isFinite(Number(node.contrastRatio))) return Number(node.contrastRatio);
    return contrastRatio(getPrimaryFillColor(node), findNearestBackground(node, visibleNodes));
  }).filter(value => Number.isFinite(Number(value)) && Number(value) > 0);

  const textContrasts = textNodes.map(node => {
    if (Number.isFinite(Number(node.contrastRatio))) return Number(node.contrastRatio);
    return contrastRatio(getPrimaryFillColor(node), findNearestBackground(node, visibleNodes));
  }).filter(value => Number.isFinite(Number(value)) && Number(value) > 0);

  const controlDensity = screenArea > 0 ? interactiveNodes.length / (screenArea / 10000) : 0;
  const textDensity = screenArea > 0 ? textNodes.length / (screenArea / 10000) : 0;

  return {
    nodeCount: visibleNodes.length,
    screenWidth,
    screenHeight,
    screenArea,
    isModalLike: modalNodes.length > 0 ? 1 : 0,
    modalConfidence,
    hasExitControl: visibleNodes.some(isExitNode) ? 1 : 0,
    hasDestructiveAction: destructiveNodes.length > 0 ? 1 : 0,
    hasUndoOption: visibleNodes.some(isUndoNode) ? 1 : 0,
    hasConfirmationDialog: confirmationNodes.length > 0 || modalNodes.some(node => getNodeLabel(node).includes("confirm")) ? 1 : 0,
    interactiveElementCount: interactiveNodes.length,
    textElementCount: textNodes.length,
    errorElementCount: errorNodes.length,
    buttonCount: buttons.length,
    inputCount: inputs.length,
    controlDensity,
    textDensity,
    averageSpacing: average(allSpacingValues),
    spacingDeviation: standardDeviation(allSpacingValues),
    maxSpacingGap: range(allSpacingValues),
    alignmentDeviation: alignmentStats.alignmentDeviation,
    misalignedElementCount: alignmentStats.misalignedElementCount,
    cornerRadiusDeviation: range(cornerRadii),
    buttonHeightDeviation: range(buttonHeights),
    buttonWidthDeviation: range(buttonWidths),
    buttonAspectRatioDeviation: range(buttonRatios),
    colorCount: colorKeys.size,
    actionColorCount: actionColorKeys.size,
    sameActionColorDeviation,
    differentActionSameColorScore,
    colorPatternDeviation: Math.max(sameActionColorDeviation / 255, differentActionSameColorScore),
    errorContrastRatio: errorContrasts.length ? Math.min(...errorContrasts) : average(textContrasts),
    errorVisibilityScore: errorContrasts.length ? Math.max(0, Math.min(1, (4.5 - Math.min(...errorContrasts)) / 4.5)) : 0,
    backgroundContrastAverage: average(textContrasts),
    destructiveActionCount: destructiveNodes.length,
    confirmationControlCount: confirmationNodes.length,
    layoutGroupSize: Math.max(buttons.length, inputs.length, textNodes.length),
    overlayPresent: visibleNodes.some(node => node.overlay === true || getNodeLabel(node).includes("overlay")) ? 1 : 0,
    module_layout: moduleName === "layout" ? 1 : 0,
    module_color: moduleName === "color" ? 1 : 0,
    module_error: moduleName === "error" ? 1 : 0,
    module_normal: moduleName === "normal" ? 1 : 0
  };
};

const normalizeFeatureVector = (features) => {
  const vector = {};
  PROJECT_FEATURE_COLUMNS.forEach(column => {
    const value = Number(features[column]);
    vector[column] = Number.isFinite(value) ? value : 0;
  });
  return vector;
};

const createCandidate = ({
  moduleName,
  candidateType,
  displayType,
  node,
  message,
  evidenceScore,
  evidence = {},
  principle = "Consistency and Standards"
}) => {
  const featureVector = normalizeFeatureVector({
    ...evidence,
    module_layout: moduleName === "layout" ? 1 : 0,
    module_color: moduleName === "color" ? 1 : 0,
    module_error: moduleName === "error" ? 1 : 0,
    module_normal: 0
  });

  return {
    moduleName,
    candidateType,
    type: candidateType,
    displayType,
    nodeId: node && node.nodeId,
    nodeName: node && (node.name || node.text) || "Current Design",
    nodeType: node && node.type || "FRAME",
    message,
    evidenceScore: Math.max(0, Math.min(1, Number(evidenceScore) || 0.5)),
    evidence,
    featureVector,
    principle
  };
};

module.exports = {
  EXIT_KEYWORDS,
  MODAL_KEYWORDS,
  BUTTON_HINTS,
  DESTRUCTIVE_KEYWORDS,
  CONFIRMATION_KEYWORDS,
  UNDO_KEYWORDS,
  ERROR_KEYWORDS,
  ACTION_KEYWORDS,
  PROJECT_FEATURE_COLUMNS,
  normalizeText,
  getNodeLabel,
  includesAny,
  numberOrZero,
  getNodes,
  getChildren,
  getPrimaryFillColor,
  colorKey,
  exactColorKey,
  colorDistance,
  contrastRatio,
  findNearestBackground,
  getActionType,
  isActionNode,
  isExitNode,
  isDestructiveNode,
  isConfirmationNode,
  isUndoNode,
  isErrorNode,
  isButtonLike,
  isInputLike,
  isInteractive,
  isFrameLike,
  isModalLike,
  average,
  standardDeviation,
  range,
  calculateVerticalGaps,
  calculateAlignmentStats,
  getMainFrame,
  buildGlobalFeatures,
  normalizeFeatureVector,
  createCandidate
};
