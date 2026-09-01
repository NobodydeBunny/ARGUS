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

    // Backward compatible field used by reports and older UI code.
    description: { type: String, required: true },

    // New dynamic feedback fields generated from model result + design evidence.
    shortSuggestion: String,
    detailedSuggestion: String,
    explanation: String,
    evidenceSummary: String,

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true
    },
    fixType: {
      type: String,
      enum: [
        "typography",
        "color",
        "spacing",
        "layout",
        "accessibility",
        "general",
        "navigation_control",
        "component_style",
        "layout_alignment",
        "layout_simplification",
        "information_architecture",
        "color_token",
        "color_semantics",
        "accessibility_color",
        "error_state_design",
        "error_recovery",
        "confirmation_flow",
        "manual_review"
      ],
      default: "general"
    },
    generatedBy: {
      type: String,
      default: "Argus Dynamic AI Feedback Generator v1.0"
    },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Suggestion", suggestionSchema);
