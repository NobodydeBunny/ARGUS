const sequelize = require("../database");
const { Analysis, AnalysisSession, DetectedIssue, Suggestion } = require("../databaseSchemas");
const analyzeDesign = require("../aiEngine/hybridAnalyzer");
const { getDatabaseStatus } = require("../database/dbStatus");

const MODEL_NAME = "Random Forest UI Issue Classifier";
const MODEL_VERSION = "2.0";
const ANALYSIS_METHOD = "trained_metadata_model_with_dynamic_feedback";
const FEEDBACK_GENERATOR = "Argus Dynamic AI Feedback Generator v1.0";

const getFixType = (issue) => {
  if (issue.fixType) return issue.fixType;

  const type = String(issue.type || issue.issueLabel || "").toLowerCase();

  if (type.includes("font")) return "typography";
  if (type.includes("contrast") || type.includes("color")) return "color";
  if (type.includes("spacing")) return "spacing";
  if (type.includes("align") || type.includes("layout") || type.includes("overloaded")) return "layout";
  if (type.includes("exit") || type.includes("back") || type.includes("close")) return "navigation_control";
  if (type.includes("undo")) return "error_recovery";
  if (type.includes("confirmation")) return "confirmation_flow";

  return "general";
};

const createIssueKey = (issue) => {
  const frameReference = issue.frameId || issue.frameName || "unknown-frame";
  const nodeReference = issue.nodeId || issue.nodeName || "unknown-node";
  const label = issue.issueLabel || issue.type || "unknown-issue";

  return `${frameReference}-${nodeReference}-${label}`;
};

const buildSuggestionPayload = ({ session, analysis, detectedIssue, issue }) => {
  const detailedSuggestion =
    issue.detailedRecommendation ||
    issue.detailedSuggestion ||
    issue.recommendation ||
    "Review this UI element and improve it based on the detected usability issue.";

  const shortSuggestion =
    issue.shortSuggestion ||
    issue.recommendation ||
    "Improve the detected usability issue.";

  return {
    sessionId: session._id,
    issueId: detectedIssue._id,
    analysisId: analysis._id,
    description: detailedSuggestion,
    shortSuggestion,
    detailedSuggestion,
    explanation: issue.explanation,
    evidenceSummary: issue.evidenceSummary,
    priority: issue.suggestionPriority || issue.severity || "medium",
    fixType: getFixType(issue),
    generatedBy: issue.generatedBy || FEEDBACK_GENERATOR,
    generatedAt: new Date()
  };
};

const createIssueSnapshot = ({ detectedIssue, suggestion, issue }) => ({
  issueId: String(detectedIssue._id),
  suggestionId: String(suggestion._id),
  frameId: issue.frameId,
  frameName: issue.frameName,
  nodeId: issue.nodeId,
  nodeName: issue.nodeName,
  nodeType: issue.nodeType,
  type: issue.type,
  issueLabel: issue.issueLabel,
  severity: issue.severity,
  principle: issue.principle,
  message: issue.message,
  recommendation: issue.recommendation,
  shortSuggestion: issue.shortSuggestion,
  detailedRecommendation:
    issue.detailedRecommendation ||
    issue.detailedSuggestion ||
    issue.recommendation,
  explanation: issue.explanation,
  evidenceSummary: issue.evidenceSummary,
  confidenceScore: issue.confidenceScore,
  fixType: getFixType(issue),
  generatedBy: issue.generatedBy || FEEDBACK_GENERATOR,
  detectedAt: detectedIssue.lastDetectedAt,
  suggestionGeneratedAt: suggestion.generatedAt
});

const buildTemporaryAnalysisResult = ({
  req,
  startedAt,
  frames,
  nodes,
  frameCount,
  issues,
  databaseStatus
}) => {
  const completedAt = new Date();
  const temporaryAnalysisId = `temp-analysis-${Date.now()}`;
  const temporarySessionId = req.body.sessionId || `temp-session-${Date.now()}`;

  return {
    _id: temporaryAnalysisId,
    sessionId: temporarySessionId,
    modelName: MODEL_NAME,
    modelVersion: MODEL_VERSION,
    analysisMethod: ANALYSIS_METHOD,
    designName: req.body.designName || "Untitled Figma Design",
    designId: req.body.designId || "figma-current-page",
    fileType: req.body.fileType || "Figma",
    scanMode: req.body.scanMode || "manual",
    frameCount,
    frames,
    nodeCount: nodes.length,
    nodes,
    totalIssues: issues.length,
    issues,
    status: "completed_without_database",
    persistenceEnabled: false,
    databaseStatus: "unavailable",
    databaseError: databaseStatus.lastDatabaseError,
    message: "Analysis completed successfully, but database saving is temporarily unavailable.",
    startedAt,
    completedAt
  };
};

const createAnalysis = async (req, res) => {
  let existingSession = null;

  try {
    const startedAt = new Date();

    const frames = Array.isArray(req.body.frames) ? req.body.frames : [];

    const nodes = frames.length > 0
      ? frames.flatMap((frame) => Array.isArray(frame.nodes) ? frame.nodes : [])
      : (Array.isArray(req.body.nodes) ? req.body.nodes : []);

    const frameCount = Number(
      req.body.frameCount ||
      frames.length ||
      (nodes.length > 0 ? 1 : 0)
    );

    const issues = analyzeDesign(req.body);
    const databaseStatus = getDatabaseStatus();

    /*
      Important fix:
      If Supabase/PostgreSQL is unavailable, do not stop analysis.
      Return temporary results without saving to the database.
    */
    if (!databaseStatus.databaseAvailable) {
      const temporaryResult = buildTemporaryAnalysisResult({
        req,
        startedAt,
        frames,
        nodes,
        frameCount,
        issues,
        databaseStatus
      });

      return res.status(201).json(temporaryResult);
    }

    if (req.body.sessionId) {
      existingSession = await AnalysisSession.findByPk(req.body.sessionId);
    }

    const result = await sequelize.transaction(async (transaction) => {
      let session = existingSession;

      if (!session) {
        session = await AnalysisSession.create({
          modelName: MODEL_NAME,
          modelVersion: MODEL_VERSION,
          analysisMethod: ANALYSIS_METHOD,
          designName: req.body.designName || "Untitled Figma Design",
          designId: req.body.designId || "figma-current-page",
          figmaPageName: req.body.figmaPageName || req.body.designName,
          fileType: req.body.fileType || "Figma",
          scanMode: req.body.scanMode || "manual",
          frameCount,
          nodeCount: nodes.length,
          totalIssues: 0,
          totalSuggestions: 0,
          startedAt,
          status: "started",
          errorMessage: null
        }, { transaction });
      }

      const analysis = await Analysis.create({
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        analysisMethod: ANALYSIS_METHOD,
        sessionId: session._id,
        designName: req.body.designName || "Untitled Figma Design",
        fileType: req.body.fileType || "Figma",
        scanMode: req.body.scanMode || "manual",
        frameCount,
        frames,
        nodeCount: nodes.length,
        nodes,
        totalIssues: issues.length,
        status: "processing",
        startedAt
      }, { transaction });

      const currentIssueKeys = issues.map(createIssueKey);

      const openIssues = await DetectedIssue.findAll({
        where: {
          sessionId: session._id,
          status: "open"
        },
        transaction
      });

      for (const oldIssue of openIssues) {
        if (!currentIssueKeys.includes(oldIssue.issueKey)) {
          await oldIssue.update({
            status: "resolved",
            resolvedAt: new Date()
          }, { transaction });
        }
      }

      const issueSnapshots = [];

      for (const issue of issues) {
        const issueKey = createIssueKey(issue);

        let detectedIssue = await DetectedIssue.findOne({
          where: {
            sessionId: session._id,
            issueKey
          },
          transaction
        });

        if (detectedIssue) {
          await detectedIssue.update({
            analysisId: analysis._id,
            frameId: issue.frameId,
            frameName: issue.frameName,
            nodeId: issue.nodeId,
            nodeName: issue.nodeName,
            nodeType: issue.nodeType,
            issueType: issue.type,
            description: issue.message,
            severity: issue.severity,
            principle: issue.principle,
            confidenceScore: issue.confidenceScore || detectedIssue.confidenceScore || 0.85,
            lastDetectedAt: new Date(),
            occurrenceCount: Number(detectedIssue.occurrenceCount || 0) + 1,
            status: "open",
            resolvedAt: null
          }, { transaction });
        } else {
          detectedIssue = await DetectedIssue.create({
            sessionId: session._id,
            analysisId: analysis._id,
            issueKey,
            frameId: issue.frameId,
            frameName: issue.frameName,
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
          }, { transaction });
        }

        let suggestion = await Suggestion.findOne({
          where: {
            sessionId: session._id,
            issueId: detectedIssue._id
          },
          transaction
        });

        const suggestionPayload = buildSuggestionPayload({
          session,
          analysis,
          detectedIssue,
          issue
        });

        if (suggestion) {
          await suggestion.update(suggestionPayload, { transaction });
        } else {
          suggestion = await Suggestion.create(suggestionPayload, { transaction });
        }

        issueSnapshots.push(createIssueSnapshot({
          detectedIssue,
          suggestion,
          issue
        }));
      }

      await analysis.update({
        issues: issueSnapshots,
        totalIssues: issueSnapshots.length,
        status: "completed",
        completedAt: new Date()
      }, { transaction });

      const totalIssues = await DetectedIssue.count({
        where: { sessionId: session._id },
        transaction
      });

      const totalSuggestions = await Suggestion.count({
        where: { sessionId: session._id },
        transaction
      });

      await session.update({
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        analysisMethod: ANALYSIS_METHOD,
        frameCount,
        nodeCount: nodes.length,
        scanMode: req.body.scanMode || "manual",
        totalIssues,
        totalSuggestions,
        completedAt: new Date(),
        status: "completed",
        lastAnalysisId: analysis._id,
        errorMessage: null
      }, { transaction });

      return analysis;
    });

    return res.status(201).json(result);
  } catch (error) {
    if (existingSession) {
      try {
        await existingSession.update({
          status: "failed",
          errorMessage: error.message,
          completedAt: new Date()
        });
      } catch (_) {
        // Avoid hiding the original error.
      }
    }

    return res.status(500).json({
      message: "Failed to create analysis",
      error: error.message
    });
  }
};

const getAnalyses = async (req, res) => {
  try {
    const databaseStatus = getDatabaseStatus();

    if (!databaseStatus.databaseAvailable) {
      return res.status(503).json({
        message: "Database is unavailable. Stored analyses cannot be fetched now.",
        databaseStatus: "unavailable",
        persistenceEnabled: false,
        error: databaseStatus.lastDatabaseError
      });
    }

    const analyses = await Analysis.findAll({
      order: [["createdAt", "DESC"]]
    });

    return res.status(200).json(analyses);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch analyses",
      error: error.message
    });
  }
};

const getAnalysisById = async (req, res) => {
  try {
    const databaseStatus = getDatabaseStatus();

    if (!databaseStatus.databaseAvailable) {
      return res.status(503).json({
        message: "Database is unavailable. Stored analysis cannot be fetched now.",
        databaseStatus: "unavailable",
        persistenceEnabled: false,
        error: databaseStatus.lastDatabaseError
      });
    }

    const analysis = await Analysis.findByPk(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        message: "Analysis not found"
      });
    }

    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch analysis",
      error: error.message
    });
  }
};

const deleteAnalysisById = async (req, res) => {
  try {
    const databaseStatus = getDatabaseStatus();

    if (!databaseStatus.databaseAvailable) {
      return res.status(503).json({
        message: "Database is unavailable. Analysis cannot be deleted now.",
        databaseStatus: "unavailable",
        persistenceEnabled: false,
        error: databaseStatus.lastDatabaseError
      });
    }

    const deleted = await Analysis.destroy({
      where: {
        _id: req.params.id
      }
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Analysis not found"
      });
    }

    return res.status(200).json({
      message: "Analysis deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
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