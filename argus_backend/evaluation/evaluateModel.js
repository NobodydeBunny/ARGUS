const fs = require("fs");
const path = require("path");

const testDataPath = path.join(__dirname, "../dataset/test-metadata-samples.json");
const outputPath = path.join(__dirname, "../dataset/evaluation-results.csv");

const testData = JSON.parse(fs.readFileSync(testDataPath, "utf8"));

const predictLabelsFromFeatures = (features) => {
  const predictedLabels = [];

  if (features.isModalLike && !features.hasExitControl) {
    predictedLabels.push("modal_without_exit");
    predictedLabels.push("missing_exit_control");
  }

  if (features.spacingDeviation >= 0.65) {
    predictedLabels.push("spacing_inconsistency");
  }

  if (features.cornerRadiusDeviation >= 0.65) {
    predictedLabels.push("button_shape_inconsistency");
  }

  if (features.alignmentDeviation >= 0.65) {
    predictedLabels.push("alignment_inconsistency");
  }

  if (features.controlDensity >= 0.75) {
    predictedLabels.push("overloaded_screen");
  }

  if (features.colorPatternDeviation >= 0.65) {
    predictedLabels.push("color_inconsistency");
  }

  if (features.sameColorDifferentActions) {
  predictedLabels.push("same_color_different_actions");
  }

  if (features.errorContrastRatio !== null && features.errorContrastRatio < 4.5) {
    predictedLabels.push("weak_error_visibility");
    predictedLabels.push("low_contrast_error_message");
    predictedLabels.push("poor_error_state_styling");
  }

  if (features.hasDestructiveAction && !features.hasUndoOption) {
    predictedLabels.push("destructive_without_undo");
  }

  if (features.hasDestructiveAction && !features.hasConfirmationDialog) {
    predictedLabels.push("irreversible_without_confirmation");
  }

  return predictedLabels;
};

const calculateMetrics = (expectedLabels, predictedLabels) => {
  const expected = new Set(expectedLabels);
  const predicted = new Set(predictedLabels);

  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  predicted.forEach((label) => {
    if (expected.has(label)) {
      truePositive += 1;
    } else {
      falsePositive += 1;
    }
  });

  expected.forEach((label) => {
    if (!predicted.has(label)) {
      falseNegative += 1;
    }
  });

  const precision = truePositive + falsePositive === 0
    ? 1
    : truePositive / (truePositive + falsePositive);

  const recall = truePositive + falseNegative === 0
    ? 1
    : truePositive / (truePositive + falseNegative);

  const f1Score = precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);

  return {
    truePositive,
    falsePositive,
    falseNegative,
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f1Score: Number(f1Score.toFixed(2))
  };
};

const escapeCsv = (value) => {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const rows = [
  "sampleId,expectedLabels,predictedLabels,truePositive,falsePositive,falseNegative,precision,recall,f1Score,analysisTimeMs,notes"
];

testData.samples.forEach((sample) => {
  const startTime = Date.now();
  const predictedLabels = predictLabelsFromFeatures(sample.metadataFeatures);
  const analysisTimeMs = Date.now() - startTime;

  const metrics = calculateMetrics(sample.expectedLabels, predictedLabels);

  rows.push([
    escapeCsv(sample.sampleId),
    escapeCsv(sample.expectedLabels),
    escapeCsv(predictedLabels),
    metrics.truePositive,
    metrics.falsePositive,
    metrics.falseNegative,
    metrics.precision,
    metrics.recall,
    metrics.f1Score,
    analysisTimeMs,
    escapeCsv(sample.description)
  ].join(","));
});

fs.writeFileSync(outputPath, rows.join("\n"));

console.log("Evaluation completed.");
console.log(`Results saved to: ${outputPath}`);