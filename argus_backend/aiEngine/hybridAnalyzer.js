const { analyzeLayoutPatterns } = require("./layoutAnalysisModule");
const { analyzeColorPatterns } = require("./colorAnalysisModule");
const { analyzeErrorHandlingPatterns } = require("./errorHandlingModule");
const { classifyCandidates } = require("./uiIssueModel");
const { applyRecommendations } = require("./feedbackRecommendationModule");

// Keep one simple name for each issue so repeated findings do not pile up.
const createDedupKey = (issue) => {
  const frameReference = issue.frameId || issue.frameName || "frame";
  const nodeReference = issue.nodeId || issue.nodeName || "design";
  return `${frameReference}-${nodeReference}-${issue.issueLabel || issue.type}`;
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

const buildFrameGroups = (designData) => {
  if (Array.isArray(designData.frames) && designData.frames.length > 0) {
    return designData.frames
      .filter((frame) => frame && Array.isArray(frame.nodes))
      .map((frame) => ({
        frameId: frame.frameId,
        frameName: frame.frameName || "Unknown Frame",
        frameType: frame.frameType || "FRAME",
        nodeCount: Number(frame.nodeCount || frame.nodes.length),
        nodes: frame.nodes
      }));
  }

  // Older plugin data may not have frames, so group the old flat list here.
  const groups = new Map();
  const nodes = Array.isArray(designData.nodes) ? designData.nodes : [];

  nodes.forEach((node) => {
    const frameId = node.rootFrameId || "legacy-frame";
    if (!groups.has(frameId)) {
      groups.set(frameId, {
        frameId,
        frameName: node.rootFrameName || "Legacy Selection",
        frameType: "FRAME",
        nodes: []
      });
    }
    groups.get(frameId).nodes.push(node);
  });

  return [...groups.values()].map((frame) => ({
    ...frame,
    nodeCount: frame.nodes.length
  }));
};

const analyzeDesign = (designData) => {
  // This is the main trip through the AI checks for a selected design.
  const frameGroups = buildFrameGroups(designData);
  const allCandidates = [];

  frameGroups.forEach((frame) => {
    const frameData = {
      ...designData,
      frameId: frame.frameId,
      frameName: frame.frameName,
      frameType: frame.frameType,
      nodeCount: frame.nodeCount,
      nodes: frame.nodes
    };

    // Each checker looks at a different kind of design problem.
    const layoutCandidates = analyzeLayoutPatterns(frameData);
    const colorCandidates = analyzeColorPatterns(frameData);
    const errorHandlingCandidates = analyzeErrorHandlingPatterns(frameData);

    const frameCandidates = [
      ...layoutCandidates,
      ...colorCandidates,
      ...errorHandlingCandidates
    ].map((candidate) => ({
      ...candidate,
      frameId: frame.frameId,
      frameName: frame.frameName
    }));

    allCandidates.push(...frameCandidates);
  });

  // Turn raw findings into friendly issues, then attach suggestions.
  const classifiedIssues = classifyCandidates(allCandidates);
  const issuesWithRecommendations = applyRecommendations(classifiedIssues);

  return deduplicateIssues(issuesWithRecommendations);
};

module.exports = analyzeDesign;
