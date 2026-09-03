const { Analysis, AnalysisSession, DetectedIssue, Suggestion, Report } = require("../databaseSchemas");
const { generateUsabilityReportPdf } = require("../utils/pdfReportGenerator");
const buildReportData = async (analysisId) => {
  const analysis = await Analysis.findByPk(analysisId);
  if (!analysis) return null;

  const session = await AnalysisSession.findByPk(analysis.sessionId);
  if (!session) return null;

  const issues = await DetectedIssue.findAll({
    where: { sessionId: session._id },
    order: [["firstDetectedAt", "ASC"]]
  });
  const suggestions = await Suggestion.findAll({
    where: { sessionId: session._id },
    order: [["generatedAt", "ASC"]]
  });

  const highSeverityCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumSeverityCount = issues.filter((issue) => issue.severity === "medium").length;
  const lowSeverityCount = issues.filter((issue) => issue.severity === "low").length;
  const recommendations = suggestions.map((suggestion) => suggestion.description);

  return { analysis, session, issues, suggestions, highSeverityCount, mediumSeverityCount, lowSeverityCount, recommendations };
};

const populateReport = async (report) => {
  if (!report) return null;
  const json = report.toJSON();
  const [session, analysis] = await Promise.all([
    AnalysisSession.findByPk(report.sessionId),
    report.analysisId ? Analysis.findByPk(report.analysisId) : null
  ]);
  json.sessionId = session ? session.toJSON() : report.sessionId;
  json.analysisId = analysis ? analysis.toJSON() : report.analysisId;
  return json;
};

const generateReport = async (req, res) => {
  try {
    const reportData = await buildReportData(req.body.analysisId);
    if (!reportData) return res.status(404).json({ message: "Analysis or session not found" });

    const { analysis, session, issues, suggestions, highSeverityCount, mediumSeverityCount, lowSeverityCount, recommendations } = reportData;
    const report = await Report.create({
      sessionId: session._id,
      analysisId: analysis._id,
      title: `Unified UI Analysis Report for ${analysis.designName}`,
      summary: `Session ${session._id} tracked ${issues.length} detected issue record(s) and ${suggestions.length} AI suggestion(s).`,
      reportFormat: "PDF",
      generatedAt: new Date(),
      totalIssues: issues.length,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      issues: issues.map((issue) => ({
        issueId: String(issue._id), issueKey: issue.issueKey, frameId: issue.frameId, frameName: issue.frameName,
        nodeId: issue.nodeId, nodeName: issue.nodeName, nodeType: issue.nodeType, issueType: issue.issueType,
        description: issue.description, severity: issue.severity,
        principle: issue.principle, confidenceScore: issue.confidenceScore, status: issue.status,
        firstDetectedAt: issue.firstDetectedAt, lastDetectedAt: issue.lastDetectedAt,
        resolvedAt: issue.resolvedAt, occurrenceCount: issue.occurrenceCount
      })),
      suggestions: suggestions.map((suggestion) => ({
        suggestionId: String(suggestion._id), issueId: String(suggestion.issueId), description: suggestion.description,
        shortSuggestion: suggestion.shortSuggestion, detailedSuggestion: suggestion.detailedSuggestion,
        explanation: suggestion.explanation, evidenceSummary: suggestion.evidenceSummary, priority: suggestion.priority,
        fixType: suggestion.fixType, generatedBy: suggestion.generatedBy, generatedAt: suggestion.generatedAt
      })),
      recommendations,
      exportHistory: [],
      status: "generated"
    });

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate report", error: error.message });
  }
};

const getReports = async (req, res) => {
  try {
    const reports = await Report.findAll({ order: [["createdAt", "DESC"]] });
    const populated = await Promise.all(reports.map(populateReport));
    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reports", error: error.message });
  }
};

const getReportById = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.status(200).json(await populateReport(report));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch report", error: error.message });
  }
};

const deleteReportById = async (req, res) => {
  try {
    const deleted = await Report.destroy({ where: { _id: req.params.id } });
    if (!deleted) return res.status(404).json({ message: "Report not found" });
    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete report", error: error.message });
  }
};

const exportReportById = async (req, res) => {
  try {
    const report =
      await Report.findByPk(
        req.params.id
      );

    if (!report) {
      return res
        .status(404)
        .json({
          message:
            "Report not found"
        });
    }

    const [
      session,
      analysis
    ] = await Promise.all([
      AnalysisSession.findByPk(
        report.sessionId
      ),

      report.analysisId
        ? Analysis.findByPk(
            report.analysisId
          )
        : null
    ]);

    if (
      !session ||
      !analysis
    ) {
      return res
        .status(404)
        .json({
          message:
            "Report session or analysis not found"
        });
    }

    const sessionIssues =
      await DetectedIssue.findAll({
        where: {
          sessionId:
            session._id
        },

        order: [
          [
            "firstDetectedAt",
            "ASC"
          ]
        ]
      });

    const sessionSuggestions =
      await Suggestion.findAll({
        where: {
          sessionId:
            session._id
        },

        order: [
          [
            "generatedAt",
            "ASC"
          ]
        ]
      });

    const safeDesignName = String(
      analysis.designName ||
        "design"
    )
      .replace(
        /[^a-z0-9-_]+/gi,
        "-"
      )
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const fileName =
      `ARGUS-${safeDesignName}-Usability-Report.pdf`;

    const pdfBuffer =
      await generateUsabilityReportPdf({
        analysis,
        session,
        issues:
          sessionIssues,
        suggestions:
          sessionSuggestions
      });

    const exportHistory =
      Array.isArray(
        report.exportHistory
      )
        ? [...report.exportHistory]
        : [];

    exportHistory.push({
      exportedAt:
        new Date(),

      status: "success",

      fileName,

      filePath:
        fileName,

      message:
        "PDF usability report exported successfully"
    });

    await report.update({
      filePath:
        fileName,

      reportFormat:
        "PDF",

      status:
        "exported",

      exportHistory
    });

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.setHeader(
      "Content-Length",
      pdfBuffer.length
    );

    res.send(pdfBuffer);
  } catch (error) {
    try {
      const report =
        await Report.findByPk(
          req.params.id
        );

      if (report) {
        const exportHistory =
          Array.isArray(
            report.exportHistory
          )
            ? [
                ...report.exportHistory
              ]
            : [];

        exportHistory.push({
          exportedAt:
            new Date(),

          status:
            "failed",

          fileName:
            "",

          filePath:
            "",

          message:
            error.message
        });

        await report.update({
          status:
            "export_failed",

          exportHistory
        });
      }
    } catch (
      logError
    ) {
      console.log(
        "Failed to record export failure:",
        logError.message
      );
    }

    console.error(
      "PDF export failed:",
      error
    );

    res
      .status(500)
      .json({
        message:
          "Failed to export PDF report",

        error:
          error.message
      });
  }
};

const cancelReportExport = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const exportHistory = Array.isArray(report.exportHistory) ? [...report.exportHistory] : [];
    exportHistory.push({ exportedAt: new Date(), status: "cancelled", fileName: "", filePath: "", message: "Report export cancelled by user" });
    await report.update({ status: "export_cancelled", exportHistory });

    res.status(200).json({ message: "Report export cancelled", report });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel report export", error: error.message });
  }
};

module.exports = { generateReport, getReports, getReportById, deleteReportById, exportReportById, cancelReportExport };
