const { Suggestion, DetectedIssue } = require("../databaseSchemas");

const getSuggestions = async (req, res) => {
  try {
    const where = {};
    if (req.query.sessionId) where.sessionId = req.query.sessionId;
    if (req.query.issueId) where.issueId = req.query.issueId;

    const rows = await Suggestion.findAll({
      where,
      include: [{ model: DetectedIssue, as: "issue", required: false }],
      order: [["createdAt", "DESC"]]
    });

    const suggestions = rows.map((item) => {
      const json = item.toJSON();
      json.issueId = json.issue || json.issueId;
      delete json.issue;
      return json;
    });

    res.status(200).json(suggestions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch suggestions", error: error.message });
  }
};

module.exports = { getSuggestions };
