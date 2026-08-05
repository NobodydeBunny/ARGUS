const {
  getNodes,
  getChildren,
  isModalLike,
  isExitNode,
  isDestructiveNode,
  isUndoNode,
  isConfirmationNode,
  buildGlobalFeatures,
  createCandidate,
  numberOrZero
} = require("./featureExtractor");

const detectMissingBackCancelClose = (nodes, globalFeatures) => {
  const candidates = [];
  const modalNodes = nodes.filter(node => isModalLike(node, nodes));
  const topLevelScreens = nodes.filter(node => !node.parentId || String(node.type || "").toUpperCase() === "FRAME");

  const targets = modalNodes.length > 0 ? modalNodes : topLevelScreens.slice(0, 1);

  targets.forEach((target) => {
    const related = [target, ...getChildren(target, nodes)];
    const hasExit = target.hasCloseButton === true || related.some(isExitNode) || nodes.some(isExitNode);
    const isModalTarget = isModalLike(target, nodes);
    const evidenceScore = hasExit ? 0 : Math.min(1, isModalTarget ? 0.9 : 0.62);

    if (!hasExit && (isModalTarget || nodes.length >= 6)) {
      candidates.push(createCandidate({
        moduleName: "error",
        candidateType: "missing_exit_control",
        displayType: "Missing Back, Cancel, or Close Control",
        node: target,
        evidenceScore,
        principle: "User Control and Freedom",
        message: "Users are not given a clear Back, Cancel, or Close control to leave the current flow safely.",
        evidence: {
          ...globalFeatures,
          isModalLike: isModalTarget ? 1 : globalFeatures.isModalLike,
          hasExitControl: 0,
          modalConfidence: isModalTarget ? Math.max(globalFeatures.modalConfidence, 0.8) : globalFeatures.modalConfidence,
          layoutGroupSize: related.length
        }
      }));
    }
  });

  return candidates;
};

const detectDestructiveWithoutUndo = (nodes, globalFeatures) => {
  const candidates = [];
  const destructiveNodes = nodes.filter(isDestructiveNode);
  if (destructiveNodes.length === 0) return candidates;

  const hasUndo = nodes.some(isUndoNode);
  if (hasUndo) return candidates;

  destructiveNodes.forEach((node) => {
    candidates.push(createCandidate({
      moduleName: "error",
      candidateType: "destructive_without_undo",
      displayType: "Destructive Action Without Undo",
      node,
      evidenceScore: Math.min(1, 0.72 + destructiveNodes.length * 0.06),
      principle: "Error Prevention",
      message: "A destructive action is present, but the interface does not show an Undo, Restore, or recovery option.",
      evidence: {
        ...globalFeatures,
        hasDestructiveAction: 1,
        destructiveActionCount: destructiveNodes.length,
        hasUndoOption: 0
      }
    }));
  });

  return candidates;
};

const detectIrreversibleWithoutConfirmation = (nodes, globalFeatures) => {
  const candidates = [];
  const destructiveNodes = nodes.filter(isDestructiveNode);
  if (destructiveNodes.length === 0) return candidates;

  const confirmationNodes = nodes.filter(isConfirmationNode);
  const modalNodes = nodes.filter(node => isModalLike(node, nodes));
  const hasConfirmation = confirmationNodes.length > 0 || modalNodes.some(node => numberOrZero(node.width) > 0 && numberOrZero(node.height) > 0);

  if (!hasConfirmation) {
    destructiveNodes.forEach((node) => {
      candidates.push(createCandidate({
        moduleName: "error",
        candidateType: "irreversible_without_confirmation",
        displayType: "Irreversible Action Without Confirmation",
        node,
        evidenceScore: Math.min(1, 0.78 + destructiveNodes.length * 0.05),
        principle: "Error Prevention",
        message: "An irreversible or risky action appears without a confirmation dialog or warning step.",
        evidence: {
          ...globalFeatures,
          hasDestructiveAction: 1,
          hasConfirmationDialog: 0,
          destructiveActionCount: destructiveNodes.length,
          confirmationControlCount: 0
        }
      }));
    });
  }

  return candidates;
};

const analyzeErrorHandlingPatterns = (designData) => {
  const nodes = getNodes(designData);
  const globalFeatures = buildGlobalFeatures(nodes, "error");

  return [
    ...detectMissingBackCancelClose(nodes, globalFeatures),
    ...detectDestructiveWithoutUndo(nodes, globalFeatures),
    ...detectIrreversibleWithoutConfirmation(nodes, globalFeatures)
  ];
};

module.exports = {
  analyzeErrorHandlingPatterns
};
