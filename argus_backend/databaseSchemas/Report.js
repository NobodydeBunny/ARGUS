const mongoose = require("mongoose");

const reportIssueSchema = new mongoose.Schema(
  {
    issueId: String,
    nodeName: String,
    nodeType: String,
    issueType: String,
    description: String,
    severity: String,
    principle: String,
    confidenceScore: Number,
    status: String,
    detectedAt: Date
  },
  { _id: false }
);

const reportSuggestionSchema = new mongoose.Schema(
  {
    suggestionId: String,
    issueId: String,
    description: String,
    priority: String,
    fixType: String,
    generatedBy: String,
    generatedAt: Date
  },
  { _id: false }
);

const exportHistorySchema = new mongoose.Schema(
  {
    exportedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["success", "failed", "cancelled"],
      required: true
    },

    fileName: String,
    filePath: String,
    message: String
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
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

    // Report information
    title: { type: String, required: true },
    summary: { type: String, required: true },
    reportFormat: { type: String, default: "TXT" },
    filePath: String,
    generatedAt: { type: Date, default: Date.now },

    // Issue severity counts
    totalIssues: { type: Number, default: 0 },
    highSeverityCount: { type: Number, default: 0 },
    mediumSeverityCount: { type: Number, default: 0 },
    lowSeverityCount: { type: Number, default: 0 },

    // Report issue and suggestion data
    issues: [reportIssueSchema],
    suggestions: [reportSuggestionSchema],
    recommendations: [String],

    exportHistory: [exportHistorySchema],

    status: {
      type: String,
      enum: [
        "generated",
        "exported",
        "export_failed",
        "export_cancelled"
      ],
      default: "generated"
    }
  },

  // Automatically add createdAt and updatedAt
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);