const Analysis = require("../databaseSchemas/Analysis");
const AnalysisSession = require("../databaseSchemas/AnalysisSession");
const DetectedIssue = require("../databaseSchemas/DetectedIssue");
const Suggestion = require("../databaseSchemas/Suggestion");
const Report = require("../databaseSchemas/Report");

const buildReportData = async (analysisId) => {
  const analysis = await Analysis.findById(analysisId);

  if (!analysis) {
    return null;
  }

  const session = await AnalysisSession.findById(analysis.sessionId);

  if (!session) {
    return null;
  }

  const issues = await DetectedIssue.find({
    sessionId: session._id
  }).sort({ firstDetectedAt: 1 });

  const suggestions = await Suggestion.find({
    sessionId: session._id
  }).sort({ generatedAt: 1 });

  const highSeverityCount = issues.filter(
    issue => issue.severity === "high"
  ).length;

  const mediumSeverityCount = issues.filter(
    issue => issue.severity === "medium"
  ).length;

  const lowSeverityCount = issues.filter(
    issue => issue.severity === "low"
  ).length;

  const recommendations = suggestions.map(
    suggestion => suggestion.description
  );

  return {
    analysis,
    session,
    issues,
    suggestions,
    highSeverityCount,
    mediumSeverityCount,
    lowSeverityCount,
    recommendations
  };
};

const generateReport = async (req, res) => {
  try {
    const reportData = await buildReportData(req.body.analysisId);

    if (!reportData) {
      return res.status(404).json({
        message: "Analysis or session not found"
      });
    }

    const {
      analysis,
      session,
      issues,
      suggestions,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      recommendations
    } = reportData;

    const report = await Report.create({
      sessionId: session._id,
      analysisId: analysis._id,
      title: `Unified UI Analysis Report for ${analysis.designName}`,
      summary: `Session ${session._id} tracked ${issues.length} detected issue record(s) and ${suggestions.length} AI suggestion(s).`,
      reportFormat: "TXT",
      generatedAt: new Date(),
      totalIssues: issues.length,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      issues: issues.map(issue => ({
        issueId: issue._id.toString(),
        issueKey: issue.issueKey,
        nodeId: issue.nodeId,
        nodeName: issue.nodeName,
        nodeType: issue.nodeType,
        issueType: issue.issueType,
        description: issue.description,
        severity: issue.severity,
        principle: issue.principle,
        confidenceScore: issue.confidenceScore,
        status: issue.status,
        firstDetectedAt: issue.firstDetectedAt,
        lastDetectedAt: issue.lastDetectedAt,
        resolvedAt: issue.resolvedAt,
        occurrenceCount: issue.occurrenceCount
      })),
      suggestions: suggestions.map(suggestion => ({
        suggestionId: suggestion._id.toString(),
        issueId: suggestion.issueId.toString(),
        description: suggestion.description,
        priority: suggestion.priority,
        fixType: suggestion.fixType,
        generatedBy: suggestion.generatedBy,
        generatedAt: suggestion.generatedAt
      })),
      recommendations,
      status: "generated"
    });

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate report",
      error: error.message
    });
  }
};

const getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("sessionId")
      .populate("analysisId")
      .sort({ createdAt: -1 });

    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch reports",
      error: error.message
    });
  }
};

const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("sessionId")
      .populate("analysisId");

    if (!report) {
      return res.status(404).json({
        message: "Report not found"
      });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch report",
      error: error.message
    });
  }
};

const deleteReportById = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found"
      });
    }

    res.status(200).json({
      message: "Report deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete report",
      error: error.message
    });
  }
};

const exportReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("sessionId")
      .populate("analysisId");

    if (!report) {
      return res.status(404).json({
        message: "Report not found"
      });
    }

    const sessionIssues = await DetectedIssue.find({
      sessionId: report.sessionId._id
    }).sort({ firstDetectedAt: 1 });

    const sessionSuggestions = await Suggestion.find({
      sessionId: report.sessionId._id
    }).sort({ generatedAt: 1 });

    const fileName = `argus-session-report-${report.sessionId._id}.txt`;

    const issueText = sessionIssues.map((issue, index) => {
      const relatedSuggestions = sessionSuggestions.filter(
        suggestion => suggestion.issueId.toString() === issue._id.toString()
      );

      const suggestionText = relatedSuggestions.map((suggestion, suggestionIndex) => {
        return `   Suggestion ${suggestionIndex + 1}: ${suggestion.description}
   Priority: ${suggestion.priority}
   Fix Type: ${suggestion.fixType}
   Generated By: ${suggestion.generatedBy}
   Generated At: ${suggestion.generatedAt}`;
      }).join("\n");

      return `${index + 1}. Issue ID: ${issue._id}
   Issue Key: ${issue.issueKey}
   Node ID: ${issue.nodeId}
   Node: ${issue.nodeName}
   Node Type: ${issue.nodeType}
   Issue Type: ${issue.issueType}
   Severity: ${issue.severity}
   Principle: ${issue.principle}
   Description: ${issue.description}
   Confidence Score: ${issue.confidenceScore}
   Status: ${issue.status}
   First Detected At: ${issue.firstDetectedAt}
   Last Detected At: ${issue.lastDetectedAt}
   Resolved At: ${issue.resolvedAt || "Not resolved yet"}
   Occurrence Count: ${issue.occurrenceCount}
${suggestionText || "   No suggestion recorded."}`;
    }).join("\n\n");

    const reportText = `
ARGUS UNIFIED UI ANALYSIS REPORT

Report ID: ${report._id}
Session ID: ${report.sessionId._id}
Analysis ID: ${report.analysisId._id}

Design Name: ${report.analysisId.designName}
File Type: ${report.analysisId.fileType}
Latest Scan Mode: ${report.analysisId.scanMode}
Latest Node Count: ${report.analysisId.nodeCount}

Session Started At: ${report.sessionId.startedAt}
Session Completed At: ${report.sessionId.completedAt}
Session Terminated At: ${report.sessionId.terminatedAt || "Not terminated"}
Session Status: ${report.sessionId.status}

Model Name: ${report.sessionId.modelName || "Random Forest UI Issue Classifier"}
Model Version: ${report.sessionId.modelVersion || "1.0"}
Analysis Method: ${report.sessionId.analysisMethod || "trained_metadata_model"}

Report Generated At: ${report.generatedAt}
Report Format: ${report.reportFormat}

SESSION SUMMARY
${report.summary}

SESSION ISSUE COUNTS
Total Issue Records: ${sessionIssues.length}
High Severity: ${sessionIssues.filter(issue => issue.severity === "high").length}
Medium Severity: ${sessionIssues.filter(issue => issue.severity === "medium").length}
Low Severity: ${sessionIssues.filter(issue => issue.severity === "low").length}
Open Issues: ${sessionIssues.filter(issue => issue.status === "open").length}
Resolved Issues: ${sessionIssues.filter(issue => issue.status === "resolved").length}

DETECTED ISSUE HISTORY AND AI SUGGESTIONS
${issueText || "No UI issues detected during this session."}

EXPORT STATUS
Export Status: Success
Exported At: ${new Date()}
`;

    report.filePath = fileName;
    report.status = "exported";
    report.exportHistory.push({
      exportedAt: new Date(),
      status: "success",
      fileName,
      filePath: fileName,
      message: "Report exported successfully"
    });

    await report.save();

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.send(reportText);
  } catch (error) {
    try {
      const report = await Report.findById(req.params.id);

      if (report) {
        report.status = "export_failed";
        report.exportHistory.push({
          exportedAt: new Date(),
          status: "failed",
          fileName: "",
          filePath: "",
          message: error.message
        });

        await report.save();
      }
    } catch (logError) {
      console.log("Failed to record export failure:", logError.message);
    }

    res.status(500).json({
      message: "Failed to export report",
      error: error.message
    });
  }
};

const cancelReportExport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found"
      });
    }

    report.status = "export_cancelled";
    report.exportHistory.push({
      exportedAt: new Date(),
      status: "cancelled",
      fileName: "",
      filePath: "",
      message: "Report export cancelled by user"
    });

    await report.save();

    res.status(200).json({
      message: "Report export cancelled",
      report
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to cancel report export",
      error: error.message
    });
  }
};

module.exports = {
  generateReport,
  getReports,
  getReportById,
  deleteReportById,
  exportReportById,
  cancelReportExport
};