const mongoose = require("mongoose");

const nodeSchema = new mongoose.Schema(
  {
    nodeId: String,
    parentId: String,
    name: String,
    type: String,
    text: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    fontSize: Number,
    fillColor: mongoose.Schema.Types.Mixed,
    contrastRatio: Number,
    spacing: Number,
    itemSpacing: Number,
    cornerRadius: Number,
    layoutMode: String,
    paddingTop: Number,
    paddingRight: Number,
    paddingBottom: Number,
    paddingLeft: Number,
    visible: Boolean,
    childrenCount: Number,
    componentId: String,
    mainComponentId: String
  },
  { _id: false, strict: false }
);

const issueSnapshotSchema = new mongoose.Schema(
  {
    issueId: String,
    suggestionId: String,
    nodeId: String,
    nodeName: String,
    nodeType: String,
    type: String,
    issueLabel: String,
    severity: String,
    principle: String,
    message: String,

    recommendation: String,
    shortSuggestion: String,
    detailedRecommendation: String,
    explanation: String,
    evidenceSummary: String,
    confidenceScore: Number,
    fixType: String,
    generatedBy: String,

    detectedAt: Date,
    suggestionGeneratedAt: Date
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisSession"
    },
    designName: { type: String, required: true },
    fileType: { type: String, required: true },
    scanMode: { type: String, default: "manual" },
    modelName: {
      type: String,
      default: "Random Forest UI Issue Classifier"
    },
    modelVersion: {
      type: String,
      default: "2.0"
    },
    analysisMethod: {
      type: String,
      default: "trained_metadata_model_with_dynamic_feedback"
    },
    nodeCount: { type: Number, default: 0 },
    nodes: [nodeSchema],
    totalIssues: { type: Number, default: 0 },
    issues: [issueSnapshotSchema],
    status: { type: String, default: "completed" },
    startedAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analysis", analysisSchema);
