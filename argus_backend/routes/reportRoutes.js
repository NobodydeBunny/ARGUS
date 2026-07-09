const express = require("express");
const {
  generateReport,
  getReports,
  getReportById,
  deleteReportById,
  exportReportById,
  cancelReportExport
} = require("../controllers/reportController");

const router = express.Router();

router.get("/", getReports);
router.get("/:id/export", exportReportById);
router.patch("/:id/export/cancel", cancelReportExport);
router.get("/:id", getReportById);
router.post("/generate", generateReport);
router.delete("/:id", deleteReportById);

module.exports = router;