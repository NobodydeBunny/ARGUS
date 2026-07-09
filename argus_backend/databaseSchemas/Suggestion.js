const mongoose = require("mongoose");

const suggestionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisSession",
      required: true
    },
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DetectedIssue",
      required: true
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis"
    },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true
    },
    fixType: {
      type: String,
      enum: ["typography", "color", "spacing", "layout", "accessibility", "general"],
      default: "general"
    },
    generatedBy: { type: String, default: "Argus Rule Engine v1.0" },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Suggestion", suggestionSchema);