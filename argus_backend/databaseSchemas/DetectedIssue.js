const mongoose = require("mongoose");

const detectedIssueSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisSession",
      required: true
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis"
    },
    issueKey: {
      type: String,
      required: true
    },
    nodeId: String,
    nodeName: String,
    nodeType: String,
    issueType: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true
    },
    principle: String,
    confidenceScore: {
      type: Number,
      default: 0.85
    },
    status: {
      type: String,
      enum: ["open", "resolved", "ignored"],
      default: "open"
    },
    firstDetectedAt: {
      type: Date,
      default: Date.now
    },
    lastDetectedAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: Date,
    occurrenceCount: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("DetectedIssue", detectedIssueSchema);