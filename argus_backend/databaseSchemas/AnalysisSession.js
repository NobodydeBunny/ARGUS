const mongoose = require("mongoose");

const analysisSessionSchema = new mongoose.Schema(
  {
    designName: { type: String, required: true },
    designId: { type: String, default: "figma-current-page" },
    figmaPageName: String,
    fileType: { type: String, default: "Figma" },
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
    scanMode: { type: String, default: "manual" },
    nodeCount: { type: Number, default: 0 },
    totalIssues: { type: Number, default: 0 },
    totalSuggestions: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    terminatedAt: Date,
    status: {
      type: String,
      enum: ["started", "completed", "failed", "terminated"],
      default: "started"
    },
    lastAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis"
    },
    errorMessage: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("AnalysisSession", analysisSessionSchema);