const { analyzeLayoutPatterns } = require("./layoutAnalysisModule");
const { analyzeColorPatterns } = require("./colorAnalysisModule");
const { analyzeErrorHandlingPatterns } = require("./errorHandlingModule");
const { classifyCandidates } = require("./uiIssueModel");
const { applyRecommendations } = require("./feedbackRecommendationModule");

const removeDuplicateIssues = (issues) => {
  const uniqueIssues = new Map();

  issues.forEach((issue) => {
    const key = `${issue.nodeId || issue.nodeName}-${issue.type}`;

    // Add issue if not already stored
    if (!uniqueIssues.has(key)) {
      uniqueIssues.set(key, issue);
      return;
    }

    const existingIssue = uniqueIssues.get(key);

    // Keep the issue with higher confidence
    if (issue.confidenceScore > existingIssue.confidenceScore) {
      uniqueIssues.set(key, issue);
    }
  });

  return Array.from(uniqueIssues.values());
};

const formatForDatabase = (issue) => {
  return {
    nodeId: issue.nodeId,
    nodeName: issue.nodeName,
    nodeType: issue.nodeType,
    type: issue.type,
    severity: issue.severity,
    principle: issue.principle,
    message: issue.message,
    recommendation: issue.recommendation,
    confidenceScore: issue.confidenceScore,
    fixType: issue.fixType,
    evidence: issue.evidence,
    explanation: issue.explanation
  };
};

// Run complete hybrid UI analysis
const analyzeDesign = (designData) => {
  const layoutCandidates = analyzeLayoutPatterns(designData);
  const colorCandidates = analyzeColorPatterns(designData);
  const errorHandlingCandidates = analyzeErrorHandlingPatterns(designData);

  // Combine all detected candidates
  const allCandidates = [
    ...layoutCandidates,
    ...colorCandidates,
    ...errorHandlingCandidates
  ];

  const classifiedIssues = classifyCandidates(allCandidates);
  
  const issuesWithRecommendations = applyRecommendations(classifiedIssues);
  
  const uniqueIssues = removeDuplicateIssues(issuesWithRecommendations);
  
  // Prepare final results for database
  return uniqueIssues.map(formatForDatabase);
};

module.exports = analyzeDesign;