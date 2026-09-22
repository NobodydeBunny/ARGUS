const express = require("express");
const {
  getSuggestions
} = require("../controllers/suggestionController");

const router = express.Router();

// Suggestions can be filtered by the session or issue they belong to.
router.get("/", getSuggestions);

module.exports = router;