const express = require("express");

// Import session controller functions
const {
  getSessions,
  getSessionById,
  terminateSession
} = require("../controllers/sessionController");

const router = express.Router();

router.get("/", getSessions);
router.get("/:id", getSessionById);
router.patch("/:id/terminate", terminateSession);

module.exports = router;