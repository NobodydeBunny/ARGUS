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

const isModalLike = (node, allNodes) => {
  const label = getNodeLabel(node);
  const children = getChildren(allNodes, node.nodeId);

  const nameLooksLikeModal = includesAny(label, MODAL_KEYWORDS);
  const structureLooksLikeModal =
    children.length >= 2 &&
    Number(node.width || 0) >= 220 &&
    Number(node.height || 0) >= 140;

  return nameLooksLikeModal || structureLooksLikeModal;
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

    if (!frameNeedsExit) {
      return;
    }

    const exitControls = children.filter(child => includesAny(getNodeLabel(child), EXIT_KEYWORDS));

    if (exitControls.length === 0) {
      candidates.push({
        type: "missing_exit_control",
        displayType: "Missing Back, Cancel, or Close Control",
        category: "user_control",
        nodeId: frame.nodeId,
        nodeName: frame.name,
        nodeType: frame.type,
        evidenceScore: isModalLike(frame, nodes) ? 0.86 : 0.62,
        message: "This screen appears to require a safe exit option, but no Back, Cancel, or Close control was detected.",
        evidence: {
          frameLabel,
          childCount: children.length,
          isModalLike: isModalLike(frame, nodes),
          exitControlCount: exitControls.length
        }
      });
    }
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
    const nodeParentId = node.parentId;
    const localSiblings = nodes.filter(item => item.parentId === nodeParentId);
    const localUndo = localSiblings.filter(item => includesAny(getNodeLabel(item), UNDO_KEYWORDS));

    const hasGlobalUndo = undoNodes.length > 0;
    const hasLocalUndo = localUndo.length > 0;

    if (!hasGlobalUndo && !hasLocalUndo) {
      candidates.push({
        type: "destructive_without_undo",
        displayType: "Destructive Action Without Undo",
        category: "error_recovery",
        nodeId: node.nodeId,
        nodeName: node.name,
        nodeType: node.type,
        evidenceScore: 0.84,
        message: "A destructive action is present, but no clear undo or recovery option was detected.",
        evidence: {
          actionLabel: getNodeLabel(node),
          localUndoCount: localUndo.length,
          globalUndoCount: undoNodes.length
        }
      });
    }
  });

  return candidates;
};

const detectIrreversibleWithoutConfirmation = (nodes, globalFeatures) => {
  const candidates = [];
  const destructiveNodes = getActionNodes(nodes, DESTRUCTIVE_KEYWORDS);
  const frames = getFrames(nodes);

  const confirmationFrames = frames.filter(frame => {
    const frameLabel = getNodeLabel(frame);
    const children = getChildren(nodes, frame.nodeId);
    const hasConfirmationName = includesAny(frameLabel, CONFIRMATION_KEYWORDS) ||
      includesAny(frameLabel, MODAL_KEYWORDS);

    const childLabels = children.map(child => getNodeLabel(child)).join(" ");
    const hasConfirmAndCancel =
      includesAny(childLabels, ["confirm", "yes", "delete", "remove"]) &&
      includesAny(childLabels, ["cancel", "no", "back"]);

    return hasConfirmationName || hasConfirmAndCancel;
  });

  // Match destructive action with confirmation frame
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

// Run all error handling checks
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
