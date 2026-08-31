const {
  getNodes,
  getChildren,
  getNodeLabel,
  isFrameLike,
  isModalLike,
  isExitNode,
  isDestructiveNode,
  isUndoNode,
  isConfirmationNode,
  buildGlobalFeatures,
  createCandidate,
  numberOrZero
} = require("./featureExtractor");

const getPrimaryFrame = (nodes) => {
  const frames = nodes.filter(isFrameLike);

  if (frames.length === 0) {
    return nodes[0] || null;
  }

  return frames.sort((first, second) => {
    const firstArea = numberOrZero(first.width) * numberOrZero(first.height);
    const secondArea = numberOrZero(second.width) * numberOrZero(second.height);
    return secondArea - firstArea;
  })[0];
};

const hasRelatedExitControl = (target, nodes) => {
  const children = getChildren(target, nodes);
  const relatedNodes = [target, ...children];

  return target.hasCloseButton === true || relatedNodes.some(isExitNode);
};

const detectMissingBackCancelClose = (nodes, globalFeatures) => {
  const candidates = [];
  const modalNodes = nodes.filter(node => isModalLike(node, nodes));
  const primaryFrame = getPrimaryFrame(nodes);

  // If no modal exists, checking the selected main frame.
  const targets = modalNodes.length > 0 ? modalNodes : (primaryFrame ? [primaryFrame] : []);

  targets.forEach((target) => {
    const isModalTarget = isModalLike(target, nodes);
    const hasExitControl = hasRelatedExitControl(target, nodes);
    const enoughFlowEvidence = isModalTarget || nodes.length >= 6;

    if (hasExitControl || !enoughFlowEvidence) return;

    const evidenceScore = Math.min(1, isModalTarget ? 0.9 : 0.62);

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
        isModalLike: isModalTarget ? 1 : globalFeatures.isModalLike || 0,
        modalConfidence: isModalTarget ? Math.max(globalFeatures.modalConfidence || 0, 0.75) : globalFeatures.modalConfidence || 0,
        hasExitControl: 0,
        childCount: getChildren(target, nodes).length,
        checkedForExitControls: "close,cancel,back,exit,dismiss,x"
      }
    }));
  });

  return candidates;
};

const detectDestructiveWithoutUndo = (nodes, globalFeatures) => {
  const candidates = [];
  const destructiveNodes = nodes.filter(isDestructiveNode);
  const hasUndoOption = nodes.some(isUndoNode);

  if (destructiveNodes.length === 0 || hasUndoOption) {
    return candidates;
  }

  destructiveNodes.forEach((node) => {
    const label = getNodeLabel(node);

    candidates.push(createCandidate({
      moduleName: "error",
      candidateType: "destructive_without_undo",
      displayType: "Destructive Action Without Undo",
      node,
      evidenceScore: 0.82,
      principle: "Help Users Recognize, Diagnose and Recover from Errors",
      message: "A destructive action is visible, but no Undo, Restore, or recovery option was detected.",
      evidence: {
        ...globalFeatures,
        hasDestructiveAction: 1,
        destructiveActionCount: destructiveNodes.length,
        hasUndoOption: 0,
        destructiveActionText: label,
        checkedForUndoControls: "undo,restore,recover,revert,rollback"
      }
    }));
  });

  return candidates;
};

const detectIrreversibleWithoutConfirmation = (nodes, globalFeatures) => {
  const candidates = [];
  const destructiveNodes = nodes.filter(isDestructiveNode);
  const confirmationNodes = nodes.filter(isConfirmationNode);
  const hasConfirmationDialog = confirmationNodes.length > 0 || nodes.some(node => isModalLike(node, nodes) && getNodeLabel(node).includes("confirm"));

  if (destructiveNodes.length === 0 || hasConfirmationDialog) {
    return candidates;
  }

  destructiveNodes.forEach((node) => {
    const label = getNodeLabel(node);

    candidates.push(createCandidate({
      moduleName: "error",
      candidateType: "irreversible_without_confirmation",
      displayType: "Irreversible Action Without Confirmation",
      node,
      evidenceScore: 0.78,
      principle: "Error Prevention",
      message: "A high-risk or irreversible action is visible, but no confirmation dialog or warning step was detected.",
      evidence: {
        ...globalFeatures,
        hasDestructiveAction: 1,
        destructiveActionCount: destructiveNodes.length,
        confirmationControlCount: confirmationNodes.length,
        hasConfirmationDialog: 0,
        destructiveActionText: label,
        checkedForConfirmationControls: "confirm,are you sure,warning,cancel,proceed"
      }
    }));
  });

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
