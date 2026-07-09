const EXIT_KEYWORDS = ["back", "cancel", "close", "x", "dismiss", "return"];
const DESTRUCTIVE_KEYWORDS = ["delete", "remove", "reset", "discard", "clear", "erase"];
const UNDO_KEYWORDS = ["undo", "restore", "recover", "revert"];
const CONFIRMATION_KEYWORDS = ["confirm", "are you sure", "yes", "no", "cancel"];
const MODAL_KEYWORDS = ["modal", "dialog", "popup", "confirmation", "overlay"];

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

const getFrames = (nodes) => {
  return nodes.filter(node => ["FRAME", "GROUP", "COMPONENT", "INSTANCE"].includes(node.type));
};

const getChildren = (nodes, parentId) => {
  return nodes.filter(node => node.parentId === parentId);
};

const getActionNodes = (nodes, keywords) => {
  return nodes.filter(node => includesAny(getNodeLabel(node), keywords));
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

const detectMissingExitControls = (nodes) => {
  const candidates = [];
  const frames = getFrames(nodes);

  frames.forEach((frame) => {
    const frameLabel = getNodeLabel(frame);
    const children = getChildren(nodes, frame.nodeId);

    const frameNeedsExit =
      isModalLike(frame, nodes) ||
      frameLabel.includes("login") ||
      frameLabel.includes("register") ||
      frameLabel.includes("form") ||
      frameLabel.includes("settings");

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

const detectDestructiveActionsWithoutUndo = (nodes) => {
  const candidates = [];
  const destructiveNodes = getActionNodes(nodes, DESTRUCTIVE_KEYWORDS);
  const undoNodes = getActionNodes(nodes, UNDO_KEYWORDS);

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

const detectIrreversibleActionsWithoutConfirmation = (nodes) => {
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

  destructiveNodes.forEach((node) => {
    const relatedConfirmation = confirmationFrames.find(frame => {
      const frameLabel = getNodeLabel(frame);
      const actionLabel = getNodeLabel(node);

      return frameLabel.includes("confirm") ||
        frameLabel.includes("delete") ||
        frameLabel.includes("remove") ||
        actionLabel.includes("delete") ||
        actionLabel.includes("remove");
    });

    if (!relatedConfirmation) {
      candidates.push({
        type: "irreversible_without_confirmation",
        displayType: "Irreversible Action Without Confirmation",
        category: "error_recovery",
        nodeId: node.nodeId,
        nodeName: node.name,
        nodeType: node.type,
        evidenceScore: 0.82,
        message: "A destructive or irreversible action was found without a clear confirmation dialog.",
        evidence: {
          actionLabel: getNodeLabel(node),
          confirmationFrameCount: confirmationFrames.length
        }
      });
    }
  });

  return candidates;
};

const analyzeErrorHandlingPatterns = (designData) => {
  const nodes = Array.isArray(designData.nodes) ? designData.nodes : [];

  return [
    ...detectMissingExitControls(nodes),
    ...detectDestructiveActionsWithoutUndo(nodes),
    ...detectIrreversibleActionsWithoutConfirmation(nodes)
  ];
};

module.exports = {
  analyzeErrorHandlingPatterns
};