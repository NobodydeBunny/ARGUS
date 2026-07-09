const Analysis = require("../databaseSchemas/Analysis");
const AnalysisSession = require("../databaseSchemas/AnalysisSession");
const DetectedIssue = require("../databaseSchemas/DetectedIssue");
const Suggestion = require("../databaseSchemas/Suggestion");
const analyzeDesign = require("../aiEngine/hybridAnalyzer");

const getFixType = (issueType) => {
  const type = issueType.toLowerCase();

  if (type.includes("font")) return "typography";
  if (type.includes("contrast")) return "color";
  if (type.includes("spacing")) return "spacing";
  if (type.includes("layout")) return "layout";

  return "general";
};

const createIssueKey = (issue) => {
  const nodeReference = issue.nodeId || issue.nodeName || "unknown-node";
  return `${nodeReference}-${issue.type}`;
};

const rollbackCreatedRecords = async ({
  createdAnalysisId,
  createdIssueIds,
  createdSuggestionIds,
  createdNewSession,
  sessionId
}) => {
  if (createdSuggestionIds.length > 0) {
    await Suggestion.deleteMany({
      _id: { $in: createdSuggestionIds }
    });
  }

  if (createdIssueIds.length > 0) {
    await DetectedIssue.deleteMany({
      _id: { $in: createdIssueIds }
    });
  }

  if (createdAnalysisId) {
    await Analysis.findByIdAndDelete(createdAnalysisId);
  }

  if (createdNewSession && sessionId) {
    await AnalysisSession.findByIdAndDelete(sessionId);
  }
};

const createAnalysis = async (req, res) => {
  let session = null;
  let createdNewSession = false;
  let createdAnalysisId = null;
  const createdIssueIds = [];
  const createdSuggestionIds = [];

  try {
    const startedAt = new Date();
    const nodes = req.body.nodes || [];
    const issues = analyzeDesign(req.body);

    if (req.body.sessionId) {
      session = await AnalysisSession.findById(req.body.sessionId);
    }

    if (!session) {
      session = await AnalysisSession.create({
        modelName: "Random Forest UI Issue Classifier",
        modelVersion: "1.0",
        analysisMethod: "trained_metadata_model",
        designName: req.body.designName,
        designId: req.body.designId || "figma-current-page",
        figmaPageName: req.body.designName,
        fileType: req.body.fileType || "Figma",
        scanMode: req.body.scanMode || "manual",
        nodeCount: nodes.length,
        startedAt,
        status: "started"
      });

      createdNewSession = true;
    }

    const analysis = await Analysis.create({
      modelName: "Random Forest UI Issue Classifier",
      modelVersion: "1.0",
      analysisMethod: "trained_metadata_model",
      sessionId: session._id,
      designName: req.body.designName,
      fileType: req.body.fileType || "Figma",
      scanMode: req.body.scanMode || "manual",
      nodeCount: nodes.length,
      nodes,
      totalIssues: issues.length,
      status: "processing",
      startedAt
    });

    createdAnalysisId = analysis._id;

    const currentIssueKeys = issues.map(createIssueKey);

    const openIssues = await DetectedIssue.find({
      sessionId: session._id,
      status: "open"
    });

    for (const oldIssue of openIssues) {
      if (!currentIssueKeys.includes(oldIssue.issueKey)) {
        oldIssue.status = "resolved";
        oldIssue.resolvedAt = new Date();
        await oldIssue.save();
      }
    }

    const issueSnapshots = [];

    for (const issue of issues) {
      const issueKey = createIssueKey(issue);

      let detectedIssue = await DetectedIssue.findOne({
        sessionId: session._id,
        issueKey
      });

      if (detectedIssue) {
        detectedIssue.analysisId = analysis._id;
        detectedIssue.lastDetectedAt = new Date();
        detectedIssue.occurrenceCount += 1;
        detectedIssue.status = "open";
        detectedIssue.resolvedAt = undefined;
        await detectedIssue.save();
      } else {
        detectedIssue = await DetectedIssue.create({
          sessionId: session._id,
          analysisId: analysis._id,
          issueKey,
          nodeId: issue.nodeId,
          nodeName: issue.nodeName,
          nodeType: issue.nodeType,
          issueType: issue.type,
          description: issue.message,
          severity: issue.severity,
          principle: issue.principle,
          confidenceScore: issue.confidenceScore || 0.85,
          status: "open",
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date(),
          occurrenceCount: 1
        });

        createdIssueIds.push(detectedIssue._id);
      }

      let suggestion = await Suggestion.findOne({
        sessionId: session._id,
        issueId: detectedIssue._id
      });

      if (!suggestion) {
        suggestion = await Suggestion.create({
          sessionId: session._id,
          issueId: detectedIssue._id,
          analysisId: analysis._id,
          description: issue.recommendation,
          priority: issue.severity,
          fixType: getFixType(issue.type),
          generatedAt: new Date()
        });

        createdSuggestionIds.push(suggestion._id);
      }

      issueSnapshots.push({
        issueId: detectedIssue._id.toString(),
        suggestionId: suggestion._id.toString(),
        nodeName: issue.nodeName,
        nodeType: issue.nodeType,
        type: issue.type,
        severity: issue.severity,
        principle: issue.principle,
        message: issue.message,
        recommendation: issue.recommendation,
        detectedAt: detectedIssue.lastDetectedAt,
        suggestionGeneratedAt: suggestion.generatedAt
      });
    }

    analysis.issues = issueSnapshots;
    analysis.totalIssues = issueSnapshots.length;
    analysis.status = "completed";
    analysis.completedAt = new Date();
    await analysis.save();

    const allSessionIssues = await DetectedIssue.find({
      sessionId: session._id
    });

    const allSessionSuggestions = await Suggestion.find({
      sessionId: session._id
    });

    session.totalIssues = allSessionIssues.length;
    session.totalSuggestions = allSessionSuggestions.length;
    session.completedAt = new Date();
    session.status = "completed";
    session.lastAnalysisId = analysis._id;
    await session.save();

    res.status(201).json(analysis);
  } catch (error) {
    try {
      await rollbackCreatedRecords({
        createdAnalysisId,
        createdIssueIds,
        createdSuggestionIds,
        createdNewSession,
        sessionId: session ? session._id : null
      });
    } catch (rollbackError) {
      console.log("Rollback failed:", rollbackError.message);
    }

    if (session && !createdNewSession) {
      session.status = "failed";
      session.errorMessage = error.message;
      session.completedAt = new Date();
      await session.save();
    }

    res.status(500).json({
      message: "Failed to create analysis",
      error: error.message
    });
  }
};

const getAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find().sort({ createdAt: -1 });
    res.status(200).json(analyses);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch analyses",
      error: error.message
    });
  }
};

const getAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        message: "Analysis not found"
      });
    }

    res.status(200).json(analysis);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch analysis",
      error: error.message
    });
  }
};

const deleteAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findByIdAndDelete(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        message: "Analysis not found"
      });
    }

    res.status(200).json({
      message: "Analysis deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete analysis",
      error: error.message
    });
  }
};

module.exports = {
  getAnalyses,
  getAnalysisById,
  createAnalysis,
  deleteAnalysisById
};