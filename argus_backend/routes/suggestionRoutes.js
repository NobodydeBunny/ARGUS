const express = require("express");

// Import suggestion controller functions
const {
  getSuggestions
} = require("../controllers/suggestionController");

const router = express.Router();

router.get("/", getSuggestions);

module.exports = router;