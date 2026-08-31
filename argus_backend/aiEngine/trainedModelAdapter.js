const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PROJECT_FEATURE_COLUMNS, normalizeFeatureVector } = require("./featureExtractor");

const MODEL_VERSION = "Random Forest UI Issue Classifier v2.0";

const getPythonCommand = () => process.platform === "win32" ? "py" : "python3";

const getBackendRoot = () => process.cwd();

const getPredictScriptPath = () => path.join(getBackendRoot(), "ml_training", "predict_ui_issue.py");

const getModelPath = () => path.join(getBackendRoot(), "ml_training", "trained_ui_model.pkl");

const inferModuleName = (candidate) => {
  if (candidate.moduleName) return candidate.moduleName;
  const text = `${candidate.candidateType || ""} ${candidate.type || ""}`.toLowerCase();
  if (text.includes("color") || text.includes("contrast") || text.includes("visibility")) return "color";
  if (text.includes("undo") || text.includes("confirmation") || text.includes("exit") || text.includes("destructive")) return "error";
  return "layout";
};

const buildModelFeatures = (candidate) => {
  const moduleName = inferModuleName(candidate);
  const base = {
    ...(candidate.featureVector || {}),
    ...(candidate.evidence || {}),
    module_layout: moduleName === "layout" ? 1 : 0,
    module_color: moduleName === "color" ? 1 : 0,
    module_error: moduleName === "error" ? 1 : 0,
    module_normal: 0
  };

  if (candidate.candidateType === "missing_exit_control") {
    base.isModalLike = Math.max(Number(base.isModalLike || 0), 1);
    base.hasExitControl = 0;
  }

  if (candidate.candidateType === "destructive_without_undo") {
    base.hasDestructiveAction = 1;
    base.hasUndoOption = 0;
  }

  if (candidate.candidateType === "irreversible_without_confirmation") {
    base.hasDestructiveAction = 1;
    base.hasConfirmationDialog = 0;
  }

  if (candidate.candidateType === "weak_error_visibility") {
    base.errorElementCount = Math.max(Number(base.errorElementCount || 0), 1);
    base.errorVisibilityScore = Math.max(Number(base.errorVisibilityScore || 0), Number(candidate.evidenceScore || 0.6));
  }

  return normalizeFeatureVector(base);
};

const fallbackPrediction = (candidate) => {
  const label = candidate.candidateType || candidate.type || "review_ui_pattern";
  const fallbackMap = {
    missing_exit: "missing_exit_control",
    missing_undo: "destructive_without_undo",
    missing_confirmation: "irreversible_without_confirmation"
  };

  const issueLabel = fallbackMap[label] || label;
  const highLabels = ["missing_exit_control", "destructive_without_undo", "irreversible_without_confirmation"];

  return {
    issueLabel,
    severity: highLabels.includes(issueLabel) ? "high" : "medium",
    suggestionCategory: {
      missing_exit_control: "add_back_cancel_or_close",
      spacing_inconsistency: "standardize_spacing",
      button_shape_inconsistency: "standardize_component_shape",
      alignment_inconsistency: "align_to_common_layout_pattern",
      overloaded_screen: "reduce_density_and_group_controls",
      color_inconsistency: "standardize_action_color",
      same_color_different_actions: "differentiate_action_colors",
      weak_error_visibility: "improve_error_state_visibility",
      destructive_without_undo: "add_undo_or_recovery_option",
      irreversible_without_confirmation: "add_confirmation_step"
    }[issueLabel] || "review_ui_pattern",
    confidenceScore: Number(Math.max(0.45, Math.min(0.85, Number(candidate.evidenceScore || 0.65))).toFixed(3)),
    modelVersion: `${MODEL_VERSION} fallback`
  };
};

const predictWithTrainedModel = (candidate) => {
  try {
    const scriptPath = getPredictScriptPath();
    const modelPath = getModelPath();

    if (!fs.existsSync(scriptPath) || !fs.existsSync(modelPath)) {
      return fallbackPrediction(candidate);
    }

    const features = buildModelFeatures(candidate);
    const payload = JSON.stringify({ features });

    const output = execFileSync(
      getPythonCommand(),
      [scriptPath, payload],
      {
        encoding: "utf8",
        cwd: getBackendRoot(),
        timeout: 15000,
        maxBuffer: 1024 * 1024
      }
    );

    const prediction = JSON.parse(output.trim());

    if (prediction.error) {
      return fallbackPrediction(candidate);
    }

    return {
      issueLabel: prediction.issueLabel,
      severity: prediction.severity,
      suggestionCategory: prediction.suggestionCategory,
      confidenceScore: Number(prediction.confidenceScore || candidate.evidenceScore || 0.6),
      modelVersion: prediction.modelVersion || MODEL_VERSION
    };
  } catch (error) {
    return fallbackPrediction(candidate);
  }
};

module.exports = {
  MODEL_VERSION,
  PROJECT_FEATURE_COLUMNS,
  buildModelFeatures,
  predictWithTrainedModel
};
