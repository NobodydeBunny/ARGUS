import pandas as pd

rows = [
    [1, 0, 0, 0, 0, 0.30, 0.10, 0.10, 0.10, 0.10, 0, 5.0, "modal_without_exit", "high", "add_exit_control"],
    [1, 0, 1, 0, 0, 0.52, 0.10, 0.20, 0.10, 0.10, 0, 5.0, "modal_without_exit", "high", "add_exit_control"],
    [0, 1, 0, 0, 0, 0.40, 0.82, 0.20, 0.10, 0.10, 0, 5.0, "spacing_inconsistency", "medium", "standardize_spacing"],
    [0, 1, 0, 0, 0, 0.36, 0.18, 0.20, 0.88, 0.10, 0, 5.0, "button_shape_inconsistency", "medium", "standardize_component_shape"],
    [0, 1, 0, 0, 0, 0.41, 0.20, 0.86, 0.12, 0.10, 0, 5.0, "alignment_inconsistency", "medium", "align_to_common_layout_pattern"],
    [0, 1, 0, 0, 0, 0.91, 0.44, 0.35, 0.20, 0.12, 0, 5.0, "overloaded_screen", "medium", "reduce_density_and_group_controls"],
    [0, 1, 0, 0, 0, 0.31, 0.11, 0.15, 0.10, 0.85, 0, 5.0, "color_inconsistency", "medium", "standardize_action_color"],
    [0, 1, 0, 0, 0, 0.31, 0.11, 0.15, 0.10, 0.22, 1, 5.0, "same_color_different_actions", "medium", "differentiate_action_colors"],
    [0, 1, 0, 0, 0, 0.34, 0.10, 0.10, 0.10, 0.71, 0, 2.2, "weak_error_visibility", "high", "improve_error_state_visibility"],
    [0, 1, 0, 0, 0, 0.34, 0.10, 0.10, 0.10, 0.50, 0, 2.4, "low_contrast_error_message", "high", "improve_error_state_visibility"],
    [0, 1, 0, 0, 0, 0.34, 0.10, 0.10, 0.10, 0.70, 0, 3.1, "poor_error_state_styling", "medium", "improve_error_state_visibility"],
    [0, 0, 0, 0, 0, 0.48, 0.14, 0.12, 0.10, 0.10, 0, 5.0, "missing_exit_control", "high", "add_back_cancel_or_close"],
    [0, 1, 1, 0, 1, 0.32, 0.10, 0.10, 0.10, 0.10, 0, 5.0, "destructive_without_undo", "high", "add_undo_or_recovery_option"],
    [0, 1, 1, 1, 0, 0.32, 0.10, 0.10, 0.10, 0.10, 0, 5.0, "irreversible_without_confirmation", "high", "add_confirmation_step"],
    [0, 1, 0, 1, 1, 0.28, 0.12, 0.11, 0.08, 0.09, 0, 5.4, "no_issue", "low", "no_action_needed"],
    [1, 1, 0, 0, 0, 0.46, 0.12, 0.10, 0.10, 0.10, 0, 5.0, "no_issue", "low", "no_action_needed"],
    [0, 1, 1, 1, 1, 0.40, 0.10, 0.10, 0.10, 0.10, 0, 5.0, "no_issue", "low", "no_action_needed"]
]

columns = [
    "isModalLike",
    "hasExitControl",
    "hasDestructiveAction",
    "hasUndoOption",
    "hasConfirmationDialog",
    "controlDensity",
    "spacingDeviation",
    "alignmentDeviation",
    "cornerRadiusDeviation",
    "colorPatternDeviation",
    "sameColorDifferentActions",
    "errorContrastRatio",
    "issueLabel",
    "severity",
    "suggestionCategory"
]

df = pd.DataFrame(rows, columns=columns)
df.to_csv("ml_training/ui_training_dataset.csv", index=False)

print("Training dataset created: ml_training/ui_training_dataset.csv")