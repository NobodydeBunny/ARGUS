const AnalysisSession = require("../databaseSchemas/AnalysisSession");
const Analysis = require("../databaseSchemas/Analysis");
const DetectedIssue = require("../databaseSchemas/DetectedIssue");
const Suggestion = require("../databaseSchemas/Suggestion");
const Report = require("../databaseSchemas/Report");

const getSessions = async (req, res) => {
  try {
    const sessions = await AnalysisSession.find().sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sessions",
      error: error.message
    });
  }
};

const getSessionById = async (req, res) => {
  try {
    const session = await AnalysisSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found"
      });
    }

    const analyses = await Analysis.find({ sessionId: session._id }).sort({ createdAt: 1 });
    const issues = await DetectedIssue.find({ sessionId: session._id }).sort({ firstDetectedAt: 1 });
    const suggestions = await Suggestion.find({ sessionId: session._id })
      .populate("issueId")
      .sort({ generatedAt: 1 });
    const reports = await Report.find({ sessionId: session._id }).sort({ generatedAt: 1 });

    res.status(200).json({
      session,
      analyses,
      issues,
      suggestions,
      reports
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch session",
      error: error.message
    });
  }
};

const terminateSession = async (req, res) => {
  try {
    const session = await AnalysisSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found"
      });
    }

    const activeAnalyses = await Analysis.find({
      sessionId: session._id,
      status: "processing"
    });

    if (activeAnalyses.length > 0) {
      return res.status(409).json({
        message: "Session cannot be terminated while analysis is processing"
      });
    }

    session.status = "terminated";
    session.terminatedAt = new Date();
    session.completedAt = session.completedAt || new Date();
    await session.save();

    res.status(200).json({
      message: "Session terminated safely",
      session
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to terminate session safely",
      error: error.message
    });
  }
};

module.exports = {
  getSessions,
  getSessionById,
  terminateSession
};