const AnalysisSession = require("./AnalysisSession");
const Analysis = require("./Analysis");
const DetectedIssue = require("./DetectedIssue");
const Suggestion = require("./Suggestion");
const Report = require("./Report");

AnalysisSession.hasMany(Analysis, { foreignKey: "sessionId", as: "analyses", onDelete: "CASCADE" });
Analysis.belongsTo(AnalysisSession, { foreignKey: "sessionId", as: "session" });

AnalysisSession.hasMany(DetectedIssue, { foreignKey: "sessionId", as: "detectedIssues", onDelete: "CASCADE" });
DetectedIssue.belongsTo(AnalysisSession, { foreignKey: "sessionId", as: "session" });
Analysis.hasMany(DetectedIssue, { foreignKey: "analysisId", as: "detectedIssues", onDelete: "SET NULL" });
DetectedIssue.belongsTo(Analysis, { foreignKey: "analysisId", as: "analysis" });

AnalysisSession.hasMany(Suggestion, { foreignKey: "sessionId", as: "suggestions", onDelete: "CASCADE" });
Suggestion.belongsTo(AnalysisSession, { foreignKey: "sessionId", as: "session" });
Analysis.hasMany(Suggestion, { foreignKey: "analysisId", as: "suggestions", onDelete: "SET NULL" });
Suggestion.belongsTo(Analysis, { foreignKey: "analysisId", as: "analysis" });
DetectedIssue.hasMany(Suggestion, { foreignKey: "issueId", as: "suggestions", onDelete: "CASCADE" });
Suggestion.belongsTo(DetectedIssue, { foreignKey: "issueId", as: "issue" });

AnalysisSession.hasMany(Report, { foreignKey: "sessionId", as: "reports", onDelete: "CASCADE" });
Report.belongsTo(AnalysisSession, { foreignKey: "sessionId", as: "session" });
Analysis.hasMany(Report, { foreignKey: "analysisId", as: "reports", onDelete: "SET NULL" });
Report.belongsTo(Analysis, { foreignKey: "analysisId", as: "analysis" });

module.exports = { AnalysisSession, Analysis, DetectedIssue, Suggestion, Report };
