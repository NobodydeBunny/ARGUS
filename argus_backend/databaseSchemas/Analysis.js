const mongoose = require("mongoose");

const nodeSchema = new mongoose.Schema(
  {
    nodeId: String,
    name: String,
    type: String,
    fontSize: Number,
    contrastRatio: Number,
    spacing: Number
  },
  { _id: false }
);

const issueSnapshotSchema = new mongoose.Schema(
  {
    issueId: String,
    suggestionId: String,
    nodeName: String,
    nodeType: String,
    type: String,
    severity: String,
    principle: String,
    message: String,
    recommendation: String,
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
  default: "1.0"
},
analysisMethod: {
  type: String,
  default: "trained_metadata_model"
},



    nodeCount: { type: Number, default: 0 },
    fontSize: Number,
    contrastRatio: Number,
    spacing: Number,
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