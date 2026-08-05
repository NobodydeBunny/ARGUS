const {
  getNodes,
  getChildren,
  isFrameLike,
  isModalLike,
  isExitNode,
  isButtonLike,
  isInputLike,
  isInteractive,
  buildGlobalFeatures,
  createCandidate,
  calculateVerticalGaps,
  calculateAlignmentStats,
  numberOrZero,
  average,
  range,
  standardDeviation
} = require("./featureExtractor");

const getPrimaryContainer = (nodes) => {
  const frames = nodes.filter(isFrameLike);
  if (frames.length === 0) return nodes[0] || null;
  return frames.sort((first, second) => {
    const firstArea = numberOrZero(first.width) * numberOrZero(first.height);
    const secondArea = numberOrZero(second.width) * numberOrZero(second.height);
    return secondArea - firstArea;
  })[0];
};

const detectModalWithoutExit = (nodes, globalFeatures) => {
  const candidates = [];
  const modalNodes = nodes.filter(node => isModalLike(node, nodes));

  modalNodes.forEach((modal) => {
    const modalChildren = getChildren(modal, nodes);
    const allRelatedNodes = [modal, ...modalChildren];
    const hasExitControl = modal.hasCloseButton === true || allRelatedNodes.some(isExitNode);
    const modalArea = numberOrZero(modal.width) * numberOrZero(modal.height);
    const evidenceScore = hasExitControl ? 0 : Math.min(1, 0.55 + (modalArea > 0 ? 0.2 : 0) + (modalChildren.length > 2 ? 0.15 : 0));

    if (!hasExitControl) {
      candidates.push(createCandidate({
        moduleName: "layout",
        candidateType: "missing_exit_control",
        displayType: "Modal/Dialog Without Exit Option",
        node: modal,
        evidenceScore,
        principle: "User Control and Freedom",
        message: "A modal or dialog-like layout does not provide a clear Close, Cancel, or Back control.",
        evidence: {
          ...globalFeatures,
          isModalLike: 1,
          modalConfidence: Math.max(globalFeatures.modalConfidence, evidenceScore),
          hasExitControl: 0,
          overlayPresent: modal.overlay === true || globalFeatures.overlayPresent,
          layoutGroupSize: modalChildren.length
        }
      }));
    }
  });

  return candidates;
};

const detectSpacingInconsistency = (nodes, globalFeatures) => {
  const candidates = [];
  const container = getPrimaryContainer(nodes) || { name: "Current Design", type: "FRAME" };
  const comparableNodes = nodes.filter(node => !isFrameLike(node) && Number.isFinite(Number(node.y)) && Number.isFinite(Number(node.height)));
  const interactiveNodes = comparableNodes.filter(node => isInteractive(node) || isInputLike(node) || isButtonLike(node));
  const targetNodes = interactiveNodes.length >= 3 ? interactiveNodes : comparableNodes;
  const verticalGaps = calculateVerticalGaps(targetNodes);
  const itemSpacing = nodes.map(node => numberOrZero(node.itemSpacing || node.spacing)).filter(value => value > 0 && value < 250);
  const spacingValues = verticalGaps.concat(itemSpacing);

  if (spacingValues.length < 3) return candidates;

  const spacingDeviation = standardDeviation(spacingValues);
  const maxSpacingGap = range(spacingValues);
  const evidenceScore = Math.min(1, Math.max(spacingDeviation / 28, maxSpacingGap / 90));

  if (spacingDeviation >= 10 || maxSpacingGap >= 35) {
    candidates.push(createCandidate({
      moduleName: "layout",
      candidateType: "spacing_inconsistency",
      displayType: "Inconsistent Spacing Between Similar Components",
      node: container,
      evidenceScore,
      principle: "Consistency and Standards",
      message: "Similar interface elements have noticeably inconsistent spacing or vertical rhythm.",
      evidence: {
        ...globalFeatures,
        averageSpacing: average(spacingValues),
        spacingDeviation,
        maxSpacingGap,
        layoutGroupSize: targetNodes.length,
        spacingValues: spacingValues.slice(0, 20)
      }
    }));
  }

  return candidates;
};

const detectButtonShapeInconsistency = (nodes, globalFeatures) => {
  const candidates = [];
  const buttons = nodes.filter(isButtonLike);

  if (buttons.length < 2) return candidates;

  const radiusValues = buttons.map(node => numberOrZero(node.cornerRadius)).filter(value => Number.isFinite(value));
  const heightValues = buttons.map(node => numberOrZero(node.height)).filter(value => value > 0);
  const widthValues = buttons.map(node => numberOrZero(node.width)).filter(value => value > 0);
  const ratioValues = buttons.map(node => numberOrZero(node.width) / Math.max(numberOrZero(node.height), 1)).filter(Number.isFinite);

  const cornerRadiusDeviation = range(radiusValues);
  const buttonHeightDeviation = range(heightValues);
  const buttonWidthDeviation = range(widthValues);
  const buttonAspectRatioDeviation = range(ratioValues);
  const evidenceScore = Math.min(1, Math.max(
    cornerRadiusDeviation / 22,
    buttonHeightDeviation / 28,
    buttonAspectRatioDeviation / 2.4
  ));

  if (cornerRadiusDeviation >= 8 || buttonHeightDeviation >= 16 || buttonAspectRatioDeviation >= 1.2) {
    const mostDeviatedButton = [...buttons].sort((first, second) => numberOrZero(second.cornerRadius) - numberOrZero(first.cornerRadius))[0];
    candidates.push(createCandidate({
      moduleName: "layout",
      candidateType: "button_shape_inconsistency",
      displayType: "Button Shape Inconsistency",
      node: mostDeviatedButton,
      evidenceScore,
      principle: "Consistency and Standards",
      message: "Buttons with similar roles use inconsistent corner radius, height, width, or shape proportions.",
      evidence: {
        ...globalFeatures,
        cornerRadiusDeviation,
        buttonHeightDeviation,
        buttonWidthDeviation,
        buttonAspectRatioDeviation,
        layoutGroupSize: buttons.length,
        radiusValues,
        heightValues,
        widthValues
      }
    }));
  }

  return candidates;
};

const detectAlignmentInconsistency = (nodes, globalFeatures) => {
  const candidates = [];
  const container = getPrimaryContainer(nodes) || { name: "Current Design", type: "FRAME" };
  const comparableNodes = nodes.filter(node => !isFrameLike(node) && Number.isFinite(Number(node.x)));

  if (comparableNodes.length < 4) return candidates;

  const stats = calculateAlignmentStats(comparableNodes);
  const evidenceScore = Math.min(1, Math.max(stats.alignmentDeviation / 90, stats.misalignedElementCount / Math.max(comparableNodes.length, 1)));

  if (stats.alignmentDeviation >= 28 && stats.misalignedElementCount >= 1) {
    candidates.push(createCandidate({
      moduleName: "layout",
      candidateType: "alignment_inconsistency",
      displayType: "Inconsistent Alignment",
      node: container,
      evidenceScore,
      principle: "Consistency and Standards",
      message: "One or more related interface elements deviate from the dominant alignment pattern.",
      evidence: {
        ...globalFeatures,
        alignmentDeviation: stats.alignmentDeviation,
        misalignedElementCount: stats.misalignedElementCount,
        expectedX: stats.expectedX,
        xPositions: stats.xPositions.slice(0, 25),
        layoutGroupSize: comparableNodes.length
      }
    }));
  }

  return candidates;
};

const detectOverloadedScreen = (nodes, globalFeatures) => {
  const candidates = [];
  const container = getPrimaryContainer(nodes) || { name: "Current Design", type: "FRAME" };
  const screenArea = Math.max(numberOrZero(container.width) * numberOrZero(container.height), 1);
  const interactiveCount = nodes.filter(isInteractive).length;
  const textCount = nodes.filter(node => String(node.type || "").toUpperCase() === "TEXT").length;
  const controlDensity = interactiveCount / (screenArea / 10000);
  const totalDensity = nodes.length / (screenArea / 10000);
  const evidenceScore = Math.min(1, Math.max(controlDensity / 0.55, totalDensity / 0.85, nodes.length / 44));

  if (nodes.length >= 28 || interactiveCount >= 12 || controlDensity >= 0.42) {
    candidates.push(createCandidate({
      moduleName: "layout",
      candidateType: "overloaded_screen",
      displayType: "Overloaded Screen",
      node: container,
      evidenceScore,
      principle: "Flexibility and Efficiency of Use",
      message: "The screen contains a high density of UI elements, which can make the interface difficult to scan and use efficiently.",
      evidence: {
        ...globalFeatures,
        nodeCount: nodes.length,
        screenArea,
        interactiveElementCount: interactiveCount,
        textElementCount: textCount,
        controlDensity,
        textDensity: textCount / (screenArea / 10000),
        layoutGroupSize: nodes.length
      }
    }));
  }

  return candidates;
};

const analyzeLayoutPatterns = (designData) => {
  const nodes = getNodes(designData);
  const globalFeatures = buildGlobalFeatures(nodes, "layout");

  return [
    ...detectModalWithoutExit(nodes, globalFeatures),
    ...detectSpacingInconsistency(nodes, globalFeatures),
    ...detectButtonShapeInconsistency(nodes, globalFeatures),
    ...detectAlignmentInconsistency(nodes, globalFeatures),
    ...detectOverloadedScreen(nodes, globalFeatures)
  ];
};

module.exports = {
  analyzeLayoutPatterns
};
