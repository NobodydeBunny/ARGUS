const { predictWithTrainedModel } = require("./trainedModelAdapter");

const labelDisplayNames = {
  modal_without_exit: "Modal or Dialog Without Exit Option",
  spacing_inconsistency: "Spacing Pattern Inconsistency",
  button_shape_inconsistency: "Button Shape Inconsistency",
  alignment_inconsistency: "Inconsistent Alignment",
  overloaded_screen: "Overloaded Screen",
  color_inconsistency: "Inconsistent Color for Same Action",
  same_color_different_actions: "Same Color Used for Different Actions",
  weak_error_visibility: "Weak Error Message Visibility",
  low_contrast_error_message: "Low Contrast Error Message",
  poor_error_state_styling: "Poor Error State Styling",
  missing_exit_control: "Missing Back, Cancel, or Close Control",
  destructive_without_undo: "Destructive Action Without Undo",
  irreversible_without_confirmation: "Irreversible Action Without Confirmation",
  no_issue: "No Issue"
};

const labelPrinciples = {
  modal_without_exit: "User Control and Freedom",
  spacing_inconsistency: "Consistency and Standards",
  button_shape_inconsistency: "Consistency and Standards",
  alignment_inconsistency: "Consistency and Standards",
  overloaded_screen: "Flexibility and Efficiency of Use",
  color_inconsistency: "Consistency and Standards",
  same_color_different_actions: "Consistency and Standards",
  weak_error_visibility: "Help Users Recognize, Diagnose and Recover from Errors",
  low_contrast_error_message: "Help Users Recognize, Diagnose and Recover from Errors",
  poor_error_state_styling: "Help Users Recognize, Diagnose and Recover from Errors",
  missing_exit_control: "User Control and Freedom",
  destructive_without_undo: "Help Users Recognize, Diagnose and Recover from Errors",
  irreversible_without_confirmation: "Help Users Recognize, Diagnose and Recover from Errors"
};

const getFixType = (label) => {
  if (label.includes("color") || label.includes("contrast") || label.includes("error")) {
    return "color";
  }

  if (label.includes("spacing")) {
    return "spacing";
  }

  if (label.includes("alignment") || label.includes("shape") || label.includes("overloaded")) {
    return "layout";
  }

  if (label.includes("modal") || label.includes("exit")) {
    return "navigation";
  }

  if (label.includes("destructive") || label.includes("irreversible")) {
    return "error-state";
  }

  return "general";
};

const classifyCandidate = (candidate) => {
  const prediction = predictWithTrainedModel(candidate);

  if (prediction.issueLabel === "no_issue") {
    return null;
  }

  return {
    nodeId: candidate.nodeId,
    nodeName: candidate.nodeName || "Unknown UI Element",
    nodeType: candidate.nodeType || "Unknown",
    type: labelDisplayNames[prediction.issueLabel] || candidate.displayType || prediction.issueLabel,
    issueLabel: prediction.issueLabel,
    severity: prediction.severity,
    principle: labelPrinciples[prediction.issueLabel] || candidate.principle || "Consistency and Standards",
    message: candidate.message,
    recommendationCategory: prediction.suggestionCategory,
    fixType: getFixType(prediction.issueLabel),
    confidenceScore: prediction.confidenceScore,
    evidence: candidate.evidence || {}
  };
};

const classifyCandidates = (candidates) => {
  return candidates
    .map(classifyCandidate)
    .filter(issue => issue && issue.confidenceScore >= 0.45);
};

module.exports = {
  classifyCandidate,
  classifyCandidates
};