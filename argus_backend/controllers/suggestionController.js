const Suggestion = require("../databaseSchemas/Suggestion");

const getSuggestions = async (req, res) => {
  try {
    const filter = {};

    // Filter by session ID
    if (req.query.sessionId) {
      filter.sessionId = req.query.sessionId;
    }

    // Filter by issue ID
    if (req.query.issueId) {
      filter.issueId = req.query.issueId;
    }

    // Get matching suggestions
    const suggestions = await Suggestion.find(filter)
      .populate("issueId")
      .sort({ createdAt: -1 });

    res.status(200).json(suggestions);

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch suggestions",
      error: error.message
    });
  }
};


module.exports = {
  getSuggestions
};