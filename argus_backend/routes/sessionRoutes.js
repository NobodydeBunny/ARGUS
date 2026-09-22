const express = require("express");
const {
  getSessions,
  getSessionById,
  terminateSession
} = require("../controllers/sessionController");

const router = express.Router();

// A session keeps the scans made during one run of the plugin together.
router.get("/", getSessions);
router.get("/:id", getSessionById);
router.patch("/:id/terminate", terminateSession);

module.exports = router;