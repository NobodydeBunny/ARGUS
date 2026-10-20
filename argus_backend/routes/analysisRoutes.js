const express = require("express");
const {
  getAnalyses,
  getAnalysisById,
  createAnalysis,
  deleteAnalysisById
} = require("../controllers/analysisController");

const router = express.Router();

router.get("/", getAnalyses);
router.get("/:id", getAnalysisById);
router.post("/", createAnalysis);
router.delete("/:id", deleteAnalysisById);

module.exports = router;