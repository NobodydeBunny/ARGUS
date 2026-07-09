const { execFileSync } = require("child_process");

const buildModelFeatures = (candidate) => {
  const evidence = candidate.evidence || {};

  return {
    isModalLike: evidence.isModalLike || evidence.nameLooksModal || evidence.overlayLike ? 1 : 0,
    hasExitControl: evidence.exitControlCount && evidence.exitControlCount > 0 ? 1 : 0,
    hasDestructiveAction: evidence.actionLabel &&
      ["delete", "remove", "reset", "discard", "clear", "erase"].some(keyword =>
        String(evidence.actionLabel).toLowerCase().includes(keyword)
      ) ? 1 : 0,
    hasUndoOption: evidence.localUndoCount > 0 || evidence.globalUndoCount > 0 ? 1 : 0,
    hasConfirmationDialog: evidence.confirmationFrameCount > 0 ? 1 : 0,
    controlDensity: Number(evidence.density || 0),
    spacingDeviation: Number(evidence.deviation || 0),
    alignmentDeviation: Number(evidence.xDeviation || evidence.yDeviation || 0),
    cornerRadiusDeviation: Number(evidence.radiusDeviation || 0),
    colorPatternDeviation: Number(evidence.colorDistance ? evidence.colorDistance / 180 : 0),
    sameColorDifferentActions: evidence.conflictingActions && evidence.conflictingActions.length > 0 ? 1 : 0,
    errorContrastRatio: evidence.contrastRatio || 5.0
  };
};

const predictWithTrainedModel = (candidate) => {
  try {
    const features = buildModelFeatures(candidate);
    const input = JSON.stringify(features);

    const output = execFileSync(
      "py",
      ["ml_training\\predict_ui_issue.py", input],
      {
        encoding: "utf8",
        cwd: process.cwd()
      }
    );

    return JSON.parse(output);
  } catch (error) {
    return {
      issueLabel: candidate.type,
      severity: candidate.severity || "medium",
      suggestionCategory: candidate.recommendationCategory || "review_ui_pattern",
      confidenceScore: candidate.evidenceScore || 0.5
    };
  }
};

module.exports = {
  predictWithTrainedModel
};