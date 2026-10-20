const { AnalysisSession, Analysis, DetectedIssue, Suggestion, Report } = require("../databaseSchemas");

const getSessions = async (req, res) => {
  try {
    const sessions = await AnalysisSession.findAll({ order: [["createdAt", "DESC"]] });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sessions", error: error.message });
  }
};

const getSessionById = async (req, res) => {
  try {
    const session = await AnalysisSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const analyses = await Analysis.findAll({ where: { sessionId: session._id }, order: [["createdAt", "ASC"]] });
    const issues = await DetectedIssue.findAll({ where: { sessionId: session._id }, order: [["firstDetectedAt", "ASC"]] });
    const suggestionsRaw = await Suggestion.findAll({
      where: { sessionId: session._id },
      include: [{ model: DetectedIssue, as: "issue", required: false }],
      order: [["generatedAt", "ASC"]]
    });
    const suggestions = suggestionsRaw.map((item) => {
      const json = item.toJSON();
      json.issueId = json.issue || json.issueId;
      delete json.issue;
      return json;
    });
    const reports = await Report.findAll({ where: { sessionId: session._id }, order: [["generatedAt", "ASC"]] });

    res.status(200).json({ session, analyses, issues, suggestions, reports });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch session", error: error.message });
  }
};

const terminateSession = async (req, res) => {
  try {
    const session = await AnalysisSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const activeAnalyses = await Analysis.count({ where: { sessionId: session._id, status: "processing" } });
    if (activeAnalyses > 0) {
      return res.status(409).json({ message: "Session cannot be terminated while analysis is processing" });
    }

    await session.update({
      status: "terminated",
      terminatedAt: new Date(),
      completedAt: session.completedAt || new Date()
    });

    res.status(200).json({ message: "Session terminated safely", session });
  } catch (error) {
    res.status(500).json({ message: "Failed to terminate session safely", error: error.message });
  }
};

module.exports = { getSessions, getSessionById, terminateSession };
