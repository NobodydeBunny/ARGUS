const express = require("express");
const {
  getAnalyses,
  getAnalysisById,
  createAnalysis,
  deleteAnalysisById
} = require("../controllers/analysisController");

const router = express.Router();

// These routes handle creating and viewing design analyses.
router.get("/", getAnalyses);
router.get("/:id", getAnalysisById);
router.post("/", createAnalysis);
router.delete("/:id", deleteAnalysisById);

module.exports = router;