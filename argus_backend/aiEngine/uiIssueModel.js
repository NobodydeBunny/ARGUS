const { predictWithTrainedModel } = require("./trainedModelAdapter");

const labelDisplayNames = {
  missing_exit_control: "Missing Exit Control",
  spacing_inconsistency: "Spacing Inconsistency",
  button_shape_inconsistency: "Button Shape Inconsistency",
  alignment_inconsistency: "Alignment Inconsistency",
  overloaded_screen: "Overloaded Screen",
  color_inconsistency: "Color Inconsistency",
  same_color_different_actions: "Same Color Used for Different Actions",
  weak_error_visibility: "Weak Error Visibility",
  low_contrast_error_message: "Low Contrast Error Message",
  poor_error_state_styling: "Poor Error State Styling",
  destructive_without_undo: "Destructive Action Without Undo",
  irreversible_without_confirmation: "Irreversible Action Without Confirmation",
  no_issue: "No Issue"
};

const labelPrinciples = {
  missing_exit_control: "User Control and Freedom",
  spacing_inconsistency: "Consistency and Standards",
  button_shape_inconsistency: "Consistency and Standards",
  alignment_inconsistency: "Consistency and Standards",
  overloaded_screen: "Flexibility and Efficiency of Use",
  color_inconsistency: "Consistency and Standards",
  same_color_different_actions: "Error Prevention",
  weak_error_visibility: "Visibility of System Status",
  low_contrast_error_message: "Accessibility and Visibility",
  poor_error_state_styling: "Visibility of System Status",
  destructive_without_undo: "Error Recovery",
  irreversible_without_confirmation: "Error Prevention"
};

const fixTypeMap = {
  missing_exit_control: "navigation_control",
  spacing_inconsistency: "spacing",
  button_shape_inconsistency: "component_style",
  alignment_inconsistency: "layout_alignment",
  overloaded_screen: "layout_simplification",
  color_inconsistency: "color_token",
  same_color_different_actions: "color_semantics",
  weak_error_visibility: "accessibility_color",
  low_contrast_error_message: "accessibility_color",
  poor_error_state_styling: "error_state_design",
  destructive_without_undo: "error_recovery",
  irreversible_without_confirmation: "confirmation_flow"
};

const normalizeIssueLabel = (label) => {
  const map = {
    missing_exit: "missing_exit_control",
    missing_undo: "destructive_without_undo",
    missing_confirmation: "irreversible_without_confirmation",
    normal: "no_issue"
  };

  return map[label] || label;
};

const buildDefaultMessage = (label, candidate) => {
  const displayName = labelDisplayNames[label] || candidate.displayType || label;
  return candidate.message || `The AI model detected ${displayName.toLowerCase()} in the selected UI metadata.`;
};

const classifyCandidate = (candidate) => {
  const prediction = predictWithTrainedModel(candidate);
  const predictedLabel = normalizeIssueLabel(prediction.issueLabel);
  const candidateLabel = normalizeIssueLabel(candidate.candidateType || candidate.type);
  
  const knownCandidateLabels = Object.keys(labelDisplayNames);
  const issueLabel = knownCandidateLabels.includes(candidateLabel) && candidateLabel !== "no_issue"
    ? candidateLabel
    : predictedLabel;

  if (!issueLabel || issueLabel === "no_issue") {
    return null;
  }

  const confidenceScore = Number(prediction.confidenceScore || candidate.evidenceScore || 0.5);
  const evidenceScore = Number(candidate.evidenceScore || 0.5);
  const modelAgrees = predictedLabel === issueLabel;
  const finalConfidence = Number(Math.max(modelAgrees ? confidenceScore : confidenceScore * 0.82, evidenceScore * 0.85).toFixed(3));

  if (finalConfidence < 0.42) {
    return null;
  }

  return {
    nodeId: candidate.nodeId,
    nodeName: candidate.nodeName || "Unknown UI Element",
    nodeType: candidate.nodeType || "Unknown",
    type: labelDisplayNames[issueLabel] || candidate.displayType || issueLabel,
    issueLabel,
    severity: prediction.severity === "high" || prediction.severity === "medium" || prediction.severity === "low"
      ? prediction.severity
      : "medium",
    principle: labelPrinciples[issueLabel] || candidate.principle || "Consistency and Standards",
    message: buildDefaultMessage(issueLabel, candidate),
    recommendationCategory: modelAgrees ? prediction.suggestionCategory : undefined,
    fixType: fixTypeMap[issueLabel] || "general",
    confidenceScore: finalConfidence,
    evidenceScore,
    modelVersion: prediction.modelVersion,
    moduleName: candidate.moduleName,
    candidateType: candidate.candidateType,
    evidence: candidate.evidence || {}
  };
};

const classifyCandidates = (candidates) => {
  return candidates
    .map(classifyCandidate)
    .filter(Boolean);
};

module.exports = {
  classifyCandidate,
  classifyCandidates
};
