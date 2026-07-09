const recommendationTemplates = {
  add_exit_control: {
    recommendation: "Add a clear Close, Cancel, Back, or X control so users can leave the screen safely.",
    explanation: "A screen that behaves like a modal or dialog should provide a visible way to dismiss it.",
    priority: "high"
  },
  standardize_spacing: {
    recommendation: "Review the spacing pattern and make repeated components follow the same spacing structure.",
    explanation: "Repeated UI elements should use a consistent spacing rhythm to avoid visual confusion.",
    priority: "medium"
  },
  standardize_component_shape: {
    recommendation: "Make similar buttons use the same corner radius, height, width, and proportions.",
    explanation: "Buttons with the same role should look visually related across the interface.",
    priority: "medium"
  },
  align_to_common_layout_pattern: {
    recommendation: "Align the element with the dominant layout line or grid used by nearby elements.",
    explanation: "Consistent alignment improves visual order and helps users scan the interface faster.",
    priority: "medium"
  },
  reduce_density_and_group_controls: {
    recommendation: "Reduce unnecessary controls or group related elements into clearer sections.",
    explanation: "Dense screens can increase visual load and make important actions harder to identify.",
    priority: "medium"
  },
  standardize_action_color: {
    recommendation: "Use a consistent color for the same action across the interface.",
    explanation: "The same action should not appear in multiple unrelated colors unless there is a clear reason.",
    priority: "medium"
  },
  differentiate_action_colors: {
    recommendation: "Use visually different colors or styles for actions with different meanings.",
    explanation: "Different actions sharing the same color can make the interface harder to understand.",
    priority: "medium"
  },
  improve_error_state_visibility: {
    recommendation: "Make the error message visually distinct using stronger color, contrast, icon, or spacing.",
    explanation: "Error states should stand out clearly so users can recognize and recover from mistakes.",
    priority: "high"
  },
  add_back_cancel_or_close: {
    recommendation: "Add a Back, Cancel, or Close option to support safe navigation.",
    explanation: "Users need a visible way to leave a screen or reverse an action.",
    priority: "high"
  },
  add_undo_or_recovery_option: {
    recommendation: "Add an Undo option or recovery message after destructive actions.",
    explanation: "Destructive actions should give users a chance to recover from mistakes.",
    priority: "high"
  },
  add_confirmation_step: {
    recommendation: "Add a confirmation step with Confirm and Cancel options before irreversible actions.",
    explanation: "Irreversible actions should not happen without clear user confirmation.",
    priority: "high"
  },
  review_ui_pattern: {
    recommendation: "Review this element because it differs from the surrounding UI pattern.",
    explanation: "The system detected a possible mismatch compared with the overall design structure.",
    priority: "medium"
  }
};

const applyRecommendations = (issues) => {
  return issues.map((issue) => {
    const template = recommendationTemplates[issue.recommendationCategory] ||
      recommendationTemplates.review_ui_pattern;

    return {
      ...issue,
      recommendation: template.recommendation,
      explanation: template.explanation,
      suggestionPriority: template.priority
    };
  });
};

module.exports = {
  applyRecommendations
};