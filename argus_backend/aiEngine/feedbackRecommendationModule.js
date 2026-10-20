const { generateDynamicSuggestions } = require("./dynamicSuggestionGenerator");

const getPriority = (severity) => {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
};

const applyRecommendations = (issues) => {
  return generateDynamicSuggestions(issues).map((issue) => {
    const confidence = Number(issue.confidenceScore || issue.evidenceScore || 0.6);

    return {
      ...issue,
      suggestionPriority: getPriority(issue.severity),
      confidenceScore: Number(Math.max(0, Math.min(1, confidence)).toFixed(3)),
      generatedBy: "Argus Dynamic AI Feedback Generator v1.0"
    };
  });
};

module.exports = {
  applyRecommendations
};
