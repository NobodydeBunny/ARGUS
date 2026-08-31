const { analyzeLayoutPatterns } = require("./layoutAnalysisModule");
const { analyzeColorPatterns } = require("./colorAnalysisModule");
const { analyzeErrorHandlingPatterns } = require("./errorHandlingModule");
const { classifyCandidates } = require("./uiIssueModel");
const { applyRecommendations } = require("./feedbackRecommendationModule");

const createDedupKey = (issue) => {
  const nodeReference = issue.nodeId || issue.nodeName || "design";
  return `${nodeReference}-${issue.issueLabel || issue.type}`;
};

const deduplicateIssues = (issues) => {
  const issueMap = new Map();

  issues.forEach((issue) => {
    const key = createDedupKey(issue);
    const existing = issueMap.get(key);

    if (!existing || Number(issue.confidenceScore || 0) > Number(existing.confidenceScore || 0)) {
      issueMap.set(key, issue);
    }
  });

  return [...issueMap.values()].sort((first, second) => {
    const severityWeight = { high: 3, medium: 2, low: 1 };
    const severityDifference = (severityWeight[second.severity] || 0) - (severityWeight[first.severity] || 0);
    if (severityDifference !== 0) return severityDifference;
    return Number(second.confidenceScore || 0) - Number(first.confidenceScore || 0);
  });
};

const analyzeDesign = (designData) => {
  const layoutCandidates = analyzeLayoutPatterns(designData);
  const colorCandidates = analyzeColorPatterns(designData);
  const errorHandlingCandidates = analyzeErrorHandlingPatterns(designData);

  const allCandidates = [
    ...layoutCandidates,
    ...colorCandidates,
    ...errorHandlingCandidates
  ];

  const classifiedIssues = classifyCandidates(allCandidates);
  const issuesWithRecommendations = applyRecommendations(classifiedIssues);

  return deduplicateIssues(issuesWithRecommendations);
};

module.exports = analyzeDesign;
