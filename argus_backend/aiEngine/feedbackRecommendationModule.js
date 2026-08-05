const recommendationTemplates = {
  missing_exit_control: {
    short: "Add a clear Close, Cancel, or Back option.",
    detail: "Provide a visible exit control so users can safely leave the modal, dialog, or current flow without being trapped.",
    fixType: "navigation_control"
  },
  spacing_inconsistency: {
    short: "Standardize spacing between similar elements.",
    detail: "Use a consistent spacing scale, such as 8px, 16px, or 24px, for related labels, inputs, cards, and buttons.",
    fixType: "spacing"
  },
  button_shape_inconsistency: {
    short: "Make similar buttons use the same shape style.",
    detail: "Keep button corner radius, height, width pattern, and proportions consistent for buttons with similar roles.",
    fixType: "component_style"
  },
  alignment_inconsistency: {
    short: "Align related elements to a common grid or edge.",
    detail: "Place related labels, fields, buttons, and text blocks on a consistent alignment line to improve scanability.",
    fixType: "layout_alignment"
  },
  overloaded_screen: {
    short: "Reduce screen density and group controls clearly.",
    detail: "Split dense content into smaller sections, use grouping, or move secondary actions to another screen or progressive disclosure pattern.",
    fixType: "information_architecture"
  },
  color_inconsistency: {
    short: "Use one color meaning for the same action.",
    detail: "Create a consistent color token for each action type so the same action does not appear with different meanings across the interface.",
    fixType: "color_token"
  },
  same_color_different_actions: {
    short: "Differentiate colors for actions with different meanings.",
    detail: "Use separate visual styles for primary, secondary, cancel, warning, and destructive actions so users can understand action meaning quickly.",
    fixType: "color_semantics"
  },
  weak_error_visibility: {
    short: "Improve error and warning visibility.",
    detail: "Use stronger contrast, clearer error color, icon support, and spacing so validation and warning messages stand out from the background.",
    fixType: "accessibility_color"
  },
  low_contrast_error_message: {
    short: "Increase the contrast of error text.",
    detail: "Ensure error text reaches at least a readable contrast level against its background and does not blend into nearby UI colors.",
    fixType: "accessibility_color"
  },
  poor_error_state_styling: {
    short: "Use a clearer error-state style.",
    detail: "Combine color, icon, border, and short helper text so error states are understandable even without relying on color alone.",
    fixType: "error_state_design"
  },
  destructive_without_undo: {
    short: "Provide Undo, Restore, or recovery for destructive actions.",
    detail: "Give users a way to recover after destructive actions, especially for delete, reset, remove, or discard operations.",
    fixType: "error_recovery"
  },
  irreversible_without_confirmation: {
    short: "Add confirmation before irreversible actions.",
    detail: "Show a confirmation dialog or warning step before actions that can permanently delete, reset, or remove user data.",
    fixType: "confirmation_flow"
  },
  no_issue: {
    short: "No immediate action needed.",
    detail: "The selected interface does not show a detectable issue for this objective based on the current metadata.",
    fixType: "none"
  },
  review_ui_pattern: {
    short: "Review this UI pattern manually.",
    detail: "The model detected a possible issue, but the evidence is not strong enough for a more specific automated recommendation.",
    fixType: "manual_review"
  }
};

const suggestionCategoryToIssueLabel = {
  add_exit_control: "missing_exit_control",
  add_back_cancel_or_close: "missing_exit_control",
  standardize_spacing: "spacing_inconsistency",
  standardize_component_shape: "button_shape_inconsistency",
  align_to_common_layout_pattern: "alignment_inconsistency",
  reduce_density_and_group_controls: "overloaded_screen",
  standardize_action_color: "color_inconsistency",
  differentiate_action_colors: "same_color_different_actions",
  improve_error_state_visibility: "weak_error_visibility",
  add_undo_or_recovery_option: "destructive_without_undo",
  add_confirmation_step: "irreversible_without_confirmation",
  no_action_needed: "no_issue"
};

const getTemplate = (issue) => {
  const label = issue.issueLabel || issue.candidateType || suggestionCategoryToIssueLabel[issue.recommendationCategory];
  return recommendationTemplates[label] || recommendationTemplates[issue.recommendationCategory] || recommendationTemplates.review_ui_pattern;
};

const applyRecommendations = (issues) => {
  return issues.map((issue) => {
    const template = getTemplate(issue);
    const confidence = Number(issue.confidenceScore || issue.evidenceScore || 0.6);
    const priority = issue.severity === "high" ? "high" : issue.severity === "medium" ? "medium" : "low";

    return {
      ...issue,
      recommendation: template.short,
      explanation: template.detail,
      suggestionPriority: priority,
      fixType: issue.fixType || template.fixType,
      confidenceScore: Number(Math.max(0, Math.min(1, confidence)).toFixed(3))
    };
  });
};

module.exports = {
  recommendationTemplates,
  applyRecommendations
};
