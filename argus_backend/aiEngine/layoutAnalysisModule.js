const EXIT_KEYWORDS = ["close", "cancel", "back", "dismiss", "return"];
const MODAL_KEYWORDS = ["modal", "dialog", "popup", "overlay"];
const BUTTON_HINTS = ["button", "login", "register", "submit", "save", "delete", "remove", "reset", "confirm", "continue", "next"];

const normalizeText = (value) => {
  return String(value || "").toLowerCase().trim();
};

const includesAny = (value, keywords) => {
  const text = normalizeText(value);
  return keywords.some(keyword => text.includes(keyword));
};

const getNodeLabel = (node) => {
  return normalizeText(`${node.name || ""} ${node.text || ""}`);
};

const getChildren = (nodes, parentId) => {
  return nodes.filter(node => node.parentId === parentId);
};

const getFrames = (nodes) => {
  return nodes.filter(node => ["FRAME", "GROUP", "COMPONENT", "INSTANCE"].includes(node.type));
};

const isButtonLike = (node) => {
  const label = getNodeLabel(node);
  const hasButtonName = includesAny(label, BUTTON_HINTS);
  const hasButtonShape = Number(node.width) >= 40 && Number(node.height) >= 20 && node.cornerRadius != null;

  return hasButtonName || hasButtonShape;
};

const calculatePatternDeviation = (value, values) => {
  const validValues = values
    .map(Number)
    .filter(number => Number.isFinite(number));

  if (validValues.length < 2 || !Number.isFinite(Number(value))) {
    return 0;
  }

  const average = validValues.reduce((sum, item) => sum + item, 0) / validValues.length;
  const variance = validValues.reduce((sum, item) => sum + Math.pow(item - average, 2), 0) / validValues.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) {
    return Math.abs(Number(value) - average) > 0 ? 1 : 0;
  }

  return Math.abs(Number(value) - average) / standardDeviation;
};

const scoreFromDeviation = (deviation) => {
  if (deviation >= 3) return 0.95;
  if (deviation >= 2) return 0.8;
  if (deviation >= 1.5) return 0.65;
  if (deviation >= 1) return 0.5;
  return 0;
};

const detectModalExitCandidates = (nodes) => {
  const candidates = [];
  const frames = getFrames(nodes);

  frames.forEach((frame) => {
    const frameLabel = getNodeLabel(frame);
    const children = getChildren(nodes, frame.nodeId);

    const nameLooksModal = includesAny(frameLabel, MODAL_KEYWORDS);
    const overlayLike = children.length >= 2 && Number(frame.width) >= 220 && Number(frame.height) >= 160;

    if (!nameLooksModal && !overlayLike) {
      return;
    }

    const exitControls = children.filter(child => includesAny(getNodeLabel(child), EXIT_KEYWORDS));
    const evidenceScore = exitControls.length === 0
      ? nameLooksModal ? 0.9 : 0.68
      : 0;

    if (evidenceScore > 0) {
      candidates.push({
        type: "modal_without_exit",
        displayType: "Modal or Dialog Without Exit Option",
        category: "user_control",
        nodeId: frame.nodeId,
        nodeName: frame.name,
        nodeType: frame.type,
        evidenceScore,
        message: "This screen behaves like a modal or dialog, but no visible exit control was detected.",
        evidence: {
          nameLooksModal,
          overlayLike,
          childCount: children.length,
          exitControlCount: exitControls.length
        }
      });
    }
  });

  return candidates;
};

const detectSpacingPatternCandidates = (nodes) => {
  const candidates = [];
  const grouped = {};

  nodes.forEach((node) => {
    if (node.itemSpacing == null) {
      return;
    }

    const key = node.mainComponentId || node.componentId || normalizeText(node.name);

    if (!key) {
      return;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(node);
  });

  Object.values(grouped).forEach((group) => {
    if (group.length < 2) {
      return;
    }

    const spacingValues = group.map(node => node.itemSpacing);

    group.forEach((node) => {
      const deviation = calculatePatternDeviation(node.itemSpacing, spacingValues);
      const evidenceScore = scoreFromDeviation(deviation);

      if (evidenceScore >= 0.5) {
        candidates.push({
          type: "spacing_inconsistency",
          displayType: "Spacing Pattern Inconsistency",
          category: "layout_consistency",
          nodeId: node.nodeId,
          nodeName: node.name,
          nodeType: node.type,
          evidenceScore,
          message: "This repeated component uses a spacing pattern that differs from similar components.",
          evidence: {
            itemSpacing: node.itemSpacing,
            groupSpacingValues: spacingValues,
            deviation
          }
        });
      }
    });
  });

  return candidates;
};

const detectButtonShapeCandidates = (nodes) => {
  const candidates = [];
  const buttons = nodes.filter(isButtonLike);
  const groups = {};

  buttons.forEach((button) => {
    const label = normalizeText(button.text || button.name || "button");
    const actionKey = button.mainComponentId || button.componentId || label;

    if (!groups[actionKey]) {
      groups[actionKey] = [];
    }

    groups[actionKey].push(button);
  });

  Object.values(groups).forEach((group) => {
    if (group.length < 2) {
      return;
    }

    const radiusValues = group.map(button => button.cornerRadius || 0);
    const heightValues = group.map(button => button.height || 0);
    const widthValues = group.map(button => button.width || 0);

    group.forEach((button) => {
      const radiusScore = scoreFromDeviation(calculatePatternDeviation(button.cornerRadius || 0, radiusValues));
      const heightScore = scoreFromDeviation(calculatePatternDeviation(button.height || 0, heightValues));
      const widthScore = scoreFromDeviation(calculatePatternDeviation(button.width || 0, widthValues));
      const evidenceScore = Math.max(radiusScore, heightScore, widthScore);

      if (evidenceScore >= 0.5) {
        candidates.push({
          type: "button_shape_inconsistency",
          displayType: "Button Shape Inconsistency",
          category: "layout_consistency",
          nodeId: button.nodeId,
          nodeName: button.name,
          nodeType: button.type,
          evidenceScore,
          message: "This button differs in shape or proportion compared with similar button elements.",
          evidence: {
            cornerRadius: button.cornerRadius,
            width: button.width,
            height: button.height,
            groupRadiusValues: radiusValues,
            groupHeightValues: heightValues,
            groupWidthValues: widthValues
          }
        });
      }
    });
  });

  return candidates;
};

const detectAlignmentCandidates = (nodes) => {
  const candidates = [];
  const visibleNodes = nodes.filter(node => node.visible !== false && Number.isFinite(Number(node.x)));

  if (visibleNodes.length < 4) {
    return candidates;
  }

  const xValues = visibleNodes.map(node => Number(node.x));
  const yValues = visibleNodes.map(node => Number(node.y || 0));

  visibleNodes.forEach((node) => {
    const xDeviation = calculatePatternDeviation(node.x, xValues);
    const yDeviation = calculatePatternDeviation(node.y || 0, yValues);
    const evidenceScore = Math.max(scoreFromDeviation(xDeviation), scoreFromDeviation(yDeviation));

    if (evidenceScore >= 0.65) {
      candidates.push({
        type: "alignment_inconsistency",
        displayType: "Inconsistent Alignment",
        category: "layout_consistency",
        nodeId: node.nodeId,
        nodeName: node.name,
        nodeType: node.type,
        evidenceScore,
        message: "This element appears to break the dominant alignment pattern of the surrounding interface.",
        evidence: {
          x: node.x,
          y: node.y,
          xDeviation,
          yDeviation
        }
      });
    }
  });

  return candidates;
};

const detectDensityCandidates = (nodes) => {
  const candidates = [];
  const frames = getFrames(nodes);

  frames.forEach((frame) => {
    const children = getChildren(nodes, frame.nodeId);

    if (children.length < 8) {
      return;
    }

    const frameArea = Number(frame.width || 0) * Number(frame.height || 0);
    const controls = children.filter(child => isButtonLike(child) || child.type === "TEXT");
    const density = frameArea > 0 ? controls.length / (frameArea / 10000) : 0;

    const siblingFrames = frames.filter(item => item.parentId === frame.parentId && item.nodeId !== frame.nodeId);
    const siblingDensities = siblingFrames.map((item) => {
      const siblingChildren = getChildren(nodes, item.nodeId);
      const siblingArea = Number(item.width || 0) * Number(item.height || 0);
      const siblingControls = siblingChildren.filter(child => isButtonLike(child) || child.type === "TEXT");
      return siblingArea > 0 ? siblingControls.length / (siblingArea / 10000) : 0;
    });

    const comparisonValues = siblingDensities.length > 0 ? siblingDensities.concat(density) : [density, 0.4];
    const evidenceScore = scoreFromDeviation(calculatePatternDeviation(density, comparisonValues));

    if (evidenceScore >= 0.5) {
      candidates.push({
        type: "overloaded_screen",
        displayType: "Overloaded Screen",
        category: "screen_efficiency",
        nodeId: frame.nodeId,
        nodeName: frame.name,
        nodeType: frame.type,
        evidenceScore,
        message: "This screen appears denser than the surrounding interface pattern.",
        evidence: {
          childCount: children.length,
          controlCount: controls.length,
          density,
          siblingDensities
        }
      });
    }
  });

  return candidates;
};

const analyzeLayoutPatterns = (designData) => {
  const nodes = Array.isArray(designData.nodes) ? designData.nodes : [];

  return [
    ...detectModalExitCandidates(nodes),
    ...detectSpacingPatternCandidates(nodes),
    ...detectButtonShapeCandidates(nodes),
    ...detectAlignmentCandidates(nodes),
    ...detectDensityCandidates(nodes)
  ];
};

module.exports = {
  analyzeLayoutPatterns
};