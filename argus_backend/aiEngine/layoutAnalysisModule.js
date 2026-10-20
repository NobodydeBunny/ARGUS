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

  if (frames.length === 0) {
    return nodes[0] || null;
  }

  // Using the largest frame as the main screen/container for density and layout checks.
  return frames.sort((first, second) => {
    const firstArea = numberOrZero(first.width) * numberOrZero(first.height);
    const secondArea = numberOrZero(second.width) * numberOrZero(second.height);
    return secondArea - firstArea;
  })[0];
};

const median = (values) => {
  const valid = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 === 0 ? (valid[middle - 1] + valid[middle]) / 2 : valid[middle];
};

const getMostDifferentNumber = (items, valueGetter, expectedValue) => {
  let bestItem = null;
  let bestDifference = -1;

  items.forEach((item) => {
    const value = Number(valueGetter(item));
    if (!Number.isFinite(value)) return;

    const difference = Math.abs(value - expectedValue);
    if (difference > bestDifference) {
      bestDifference = difference;
      bestItem = item;
    }
  });

  return { item: bestItem, difference: bestDifference };
};

const detectModalWithoutExit = (nodes, globalFeatures) => {
  const candidates = [];
  const modalNodes = nodes.filter(node => isModalLike(node, nodes));

  modalNodes.forEach((modal) => {
    const modalChildren = getChildren(modal, nodes);
    const relatedNodes = [modal, ...modalChildren];
    const hasExitControl = modal.hasCloseButton === true || relatedNodes.some(isExitNode);

    if (hasExitControl) return;

    const modalArea = numberOrZero(modal.width) * numberOrZero(modal.height);
    const modalConfidence = Math.min(1, 0.55 + (modalArea > 0 ? 0.2 : 0) + (modalChildren.length > 2 ? 0.15 : 0));

    candidates.push(createCandidate({
      moduleName: "layout",
      candidateType: "missing_exit_control",
      displayType: "Modal/Dialog Without Exit Option",
      node: modal,
      evidenceScore: modalConfidence,
      principle: "User Control and Freedom",
      message: "A modal or dialog-like frame does not provide a visible Close, Cancel, Back, or Dismiss control.",
      evidence: {
        ...globalFeatures,
        isModalLike: 1,
        modalConfidence,
        hasExitControl: 0,
        overlayPresent: globalFeatures.overlayPresent || 0,
        childCount: modalChildren.length,
        frameWidth: numberOrZero(modal.width),
        frameHeight: numberOrZero(modal.height)
      }
    }));
  });

  return candidates;
};

const detectSpacingInconsistency = (nodes, globalFeatures) => {
  const candidates = [];
  const container = getPrimaryContainer(nodes);

  if (!container) return candidates;

  // Comparing direct children for repeated actions
  const children = getChildren(container, nodes).filter(node => !isFrameLike(node));
  const layoutTargets = children.length >= 3 ? children : nodes.filter(node => !isFrameLike(node));

  if (layoutTargets.length < 3) return candidates;

  const verticalGaps = calculateVerticalGaps(layoutTargets);
  const explicitSpacingValues = layoutTargets
    .map(node => node.itemSpacing || node.spacing)
    .map(Number)
    .filter(Number.isFinite);

  const spacingValues = verticalGaps.length >= 2 ? verticalGaps : explicitSpacingValues;

  if (spacingValues.length < 3) return candidates;

  const expectedSpacing = median(spacingValues);
  const spacingDeviation = standardDeviation(spacingValues);
  const maxGap = range(spacingValues);
  const outlierSpacing = spacingValues.reduce((best, value) => {
    return Math.abs(value - expectedSpacing) > Math.abs(best - expectedSpacing) ? value : best;
  }, spacingValues[0]);

  if (maxGap < 12 && spacingDeviation < 8) return candidates;

  const sortedTargets = [...layoutTargets]
    .filter(node => Number.isFinite(Number(node.y)))
    .sort((a, b) => Number(a.y) - Number(b.y));

  const outlierIndex = Math.max(0, spacingValues.indexOf(outlierSpacing));
  const affectedNode = sortedTargets[Math.min(outlierIndex + 1, sortedTargets.length - 1)] || container;
  const evidenceScore = Math.min(1, Math.max(0.55, maxGap / 60));

  candidates.push(createCandidate({
    moduleName: "layout",
    candidateType: "spacing_inconsistency",
    displayType: "Same Components with Different Spacing",
    node: affectedNode,
    evidenceScore,
    principle: "Consistency and Standards",
    message: "Related UI elements use inconsistent spacing compared with the repeated layout pattern.",
    evidence: {
      ...globalFeatures,
      spacingValues,
      expectedSpacing,
      actualSpacing: outlierSpacing,
      outlierSpacing,
      averageSpacing: average(spacingValues),
      spacingDeviation,
      maxSpacingGap: maxGap,
      layoutGroupSize: layoutTargets.length
    }
  }));

  return candidates;
};

const detectButtonShapeInconsistency = (nodes, globalFeatures) => {
  const candidates = [];
  const buttons = nodes.filter(isButtonLike);

  if (buttons.length < 2) return candidates;

  const radiusValues = buttons.map(node => numberOrZero(node.cornerRadius));
  const heightValues = buttons.map(node => numberOrZero(node.height)).filter(value => value > 0);
  const widthValues = buttons.map(node => numberOrZero(node.width)).filter(value => value > 0);

  const expectedCornerRadius = median(radiusValues);
  const expectedHeight = median(heightValues);
  const expectedWidth = median(widthValues);

  const cornerRadiusDeviation = range(radiusValues);
  const buttonHeightDeviation = range(heightValues);
  const buttonWidthDeviation = range(widthValues);

  const radiusOutlier = getMostDifferentNumber(buttons, node => numberOrZero(node.cornerRadius), expectedCornerRadius);
  const heightOutlier = getMostDifferentNumber(buttons, node => numberOrZero(node.height), expectedHeight);
  const widthOutlier = getMostDifferentNumber(buttons, node => numberOrZero(node.width), expectedWidth);

  const strongest = [
    { kind: "cornerRadius", ...radiusOutlier },
    { kind: "height", ...heightOutlier },
    { kind: "width", ...widthOutlier }
  ].sort((first, second) => second.difference - first.difference)[0];

  const strongShapeDifference = cornerRadiusDeviation >= 8 || buttonHeightDeviation >= 12 || buttonWidthDeviation >= 45;
  if (!strongShapeDifference || !strongest || !strongest.item) return candidates;

  const affectedButton = strongest.item;
  const evidenceScore = Math.min(1, Math.max(
    cornerRadiusDeviation / 28,
    buttonHeightDeviation / 45,
    buttonWidthDeviation / 160,
    0.55
  ));

  candidates.push(createCandidate({
    moduleName: "layout",
    candidateType: "button_shape_inconsistency",
    displayType: "Button Shape Inconsistency",
    node: affectedButton,
    evidenceScore,
    principle: "Consistency and Standards",
    message: "A button-like element has a different shape, corner radius, size, or proportion compared with similar buttons.",
    evidence: {
      ...globalFeatures,
      expectedCornerRadius,
      actualCornerRadius: numberOrZero(affectedButton.cornerRadius),
      expectedHeight,
      actualHeight: numberOrZero(affectedButton.height),
      expectedWidth,
      actualWidth: numberOrZero(affectedButton.width),
      cornerRadiusDeviation,
      buttonHeightDeviation,
      buttonWidthDeviation,
      layoutGroupSize: buttons.length,
      comparedButtonCount: buttons.length
    }
  }));

  return candidates;
};

const detectAlignmentInconsistency = (nodes, globalFeatures) => {
  const candidates = [];
  const alignmentStats = calculateAlignmentStats(nodes);

  if (!alignmentStats || alignmentStats.alignmentDeviation < 12 || alignmentStats.misalignedElementCount < 1) {
    return candidates;
  }

  const expectedX = alignmentStats.expectedX;
  const candidateNodes = nodes.filter(node => {
    return Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.width)) && !isFrameLike(node);
  });

  const { item: affectedNode, difference } = getMostDifferentNumber(candidateNodes, node => numberOrZero(node.x), expectedX);

  if (!affectedNode || difference < 12) return candidates;

  const evidenceScore = Math.min(1, Math.max(0.55, difference / 80));

  candidates.push(createCandidate({
    moduleName: "layout",
    candidateType: "alignment_inconsistency",
    displayType: "Inconsistent Alignment",
    node: affectedNode,
    evidenceScore,
    principle: "Consistency and Standards",
    message: "A UI element is not aligned with the common layout edge or grid pattern used by related elements.",
    evidence: {
      ...globalFeatures,
      expectedX,
      actualX: numberOrZero(affectedNode.x),
      outlierX: numberOrZero(affectedNode.x),
      alignmentDeviation: alignmentStats.alignmentDeviation,
      misalignedElementCount: alignmentStats.misalignedElementCount,
      layoutGroupSize: candidateNodes.length
    }
  }));

  return candidates;
};

const detectOverloadedScreen = (nodes, globalFeatures) => {
  const candidates = [];
  const container = getPrimaryContainer(nodes);

  if (!container) return candidates;

  const relatedNodes = [container, ...getChildren(container, nodes)];
  const interactiveCount = relatedNodes.filter(isInteractive).length;
  const inputCount = relatedNodes.filter(isInputLike).length;
  const totalElements = relatedNodes.length;
  const frameArea = Math.max(1, numberOrZero(container.width) * numberOrZero(container.height));
  const controlDensity = interactiveCount / (frameArea / 10000);

  const overloaded = totalElements >= 35 || interactiveCount >= 14 || inputCount >= 8 || controlDensity >= 0.55;

  if (!overloaded) return candidates;

  const evidenceScore = Math.min(1, Math.max(
    totalElements / 60,
    interactiveCount / 24,
    inputCount / 12,
    controlDensity / 1.2,
    0.6
  ));

  candidates.push(createCandidate({
    moduleName: "layout",
    candidateType: "overloaded_screen",
    displayType: "Overloaded Screen",
    node: container,
    evidenceScore,
    principle: "Flexibility and Efficiency of Use",
    message: "The selected screen contains many controls or elements, which may increase cognitive load and make the interface harder to scan.",
    evidence: {
      ...globalFeatures,
      nodeCount: nodes.length,
      totalElements,
      childCount: getChildren(container, nodes).length,
      interactiveElementCount: interactiveCount,
      inputCount,
      controlDensity,
      frameArea,
      screenWidth: numberOrZero(container.width),
      screenHeight: numberOrZero(container.height)
    }
  }));

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
