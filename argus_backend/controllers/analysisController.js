const sequelize = require("../database");
const { Analysis, AnalysisSession, DetectedIssue, Suggestion } = require("../databaseSchemas");
const analyzeDesign = require("../aiEngine/hybridAnalyzer");

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
  const detailedSuggestion = issue.detailedRecommendation || issue.detailedSuggestion || issue.recommendation;
  const shortSuggestion = issue.shortSuggestion || issue.recommendation;
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
  detailedRecommendation: issue.detailedRecommendation || issue.detailedSuggestion || issue.recommendation,
  explanation: issue.explanation,
  evidenceSummary: issue.evidenceSummary,
  confidenceScore: issue.confidenceScore,
  fixType: getFixType(issue),
  generatedBy: issue.generatedBy || FEEDBACK_GENERATOR,
  detectedAt: detectedIssue.lastDetectedAt,
  suggestionGeneratedAt: suggestion.generatedAt
});

const createAnalysis = async (req, res) => {
  let existingSession = null;
  try {
    const startedAt = new Date();
    const frames = Array.isArray(req.body.frames) ? req.body.frames : [];
    const nodes = frames.length > 0
      ? frames.flatMap((frame) => Array.isArray(frame.nodes) ? frame.nodes : [])
      : (req.body.nodes || []);
    const frameCount = Number(req.body.frameCount || frames.length || (nodes.length > 0 ? 1 : 0));
    const issues = analyzeDesign(req.body);

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
          figmaPageName: req.body.designName,
          fileType: req.body.fileType || "Figma",
          scanMode: req.body.scanMode || "manual",
          frameCount,
          nodeCount: nodes.length,
          startedAt,
          status: "started"
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
        where: { sessionId: session._id, status: "open" },
        transaction
      });

      for (const oldIssue of openIssues) {
        if (!currentIssueKeys.includes(oldIssue.issueKey)) {
          oldIssue.status = "resolved";
          oldIssue.resolvedAt = new Date();
          await oldIssue.save({ transaction });
        }
      }

      const issueSnapshots = [];
      for (const issue of issues) {
        const issueKey = createIssueKey(issue);
        let detectedIssue = await DetectedIssue.findOne({
          where: { sessionId: session._id, issueKey },
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
            occurrenceCount: detectedIssue.occurrenceCount + 1,
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
          where: { sessionId: session._id, issueId: detectedIssue._id },
          transaction
        });
        const suggestionPayload = buildSuggestionPayload({ session, analysis, detectedIssue, issue });
        if (suggestion) {
          await suggestion.update(suggestionPayload, { transaction });
        } else {
          suggestion = await Suggestion.create(suggestionPayload, { transaction });
        }

        issueSnapshots.push(createIssueSnapshot({ detectedIssue, suggestion, issue }));
      }

      await analysis.update({
        issues: issueSnapshots,
        totalIssues: issueSnapshots.length,
        status: "completed",
        completedAt: new Date()
      }, { transaction });

      const totalIssues = await DetectedIssue.count({ where: { sessionId: session._id }, transaction });
      const totalSuggestions = await Suggestion.count({ where: { sessionId: session._id }, transaction });

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

    res.status(201).json(result);
  } catch (error) {
    if (existingSession) {
      try {
        await existingSession.update({
          status: "failed",
          errorMessage: error.message,
          completedAt: new Date()
        });
      } catch (_) {}
    }
    res.status(500).json({ message: "Failed to create analysis", error: error.message });
  }
};

const getAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.findAll({ order: [["createdAt", "DESC"]] });
    res.status(200).json(analyses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch analyses", error: error.message });
  }
};

const getAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.id);
    if (!analysis) return res.status(404).json({ message: "Analysis not found" });
    res.status(200).json(analysis);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch analysis", error: error.message });
  }
};

const deleteAnalysisById = async (req, res) => {
  try {
    const deleted = await Analysis.destroy({ where: { _id: req.params.id } });
    if (!deleted) return res.status(404).json({ message: "Analysis not found" });
    res.status(200).json({ message: "Analysis deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete analysis", error: error.message });
  }
};

module.exports = { getAnalyses, getAnalysisById, createAnalysis, deleteAnalysisById };
