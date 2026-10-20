const express = require("express");
const {
  getSuggestions
} = require("../controllers/suggestionController");

const router = express.Router();

router.get("/", getSuggestions);

module.exports = router;