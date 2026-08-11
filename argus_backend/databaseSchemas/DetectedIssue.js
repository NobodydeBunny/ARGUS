const mongoose = require("mongoose");

const detectedIssueSchema = new mongoose.Schema(
  {
    // Reference to analysis session
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisSession",
      required: true
    },

    // Reference to related analysis
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis"
    },

    // Unique issue identifier
    issueKey: {
      type: String,
      required: true
    },

    // Affected UI node information
    nodeId: String,
    nodeName: String,
    nodeType: String,

    // Detected issue information
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

    // Usability principle
    principle: String,

    // Model confidence score
    confidenceScore: {
      type: Number,
      default: 0.85
    },

    status: {
      type: String,
      enum: ["open", "resolved", "ignored"],
      default: "open"
    },

    // Detection timestamps
    firstDetectedAt: {
      type: Date,
      default: Date.now
    },
    lastDetectedAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: Date,

    // Number of repeated detections
    occurrenceCount: {
      type: Number,
      default: 1
    }
  },

  // Automatically add createdAt and updatedAt
  {
    timestamps: true
  }
);

module.exports = mongoose.model("DetectedIssue", detectedIssueSchema);