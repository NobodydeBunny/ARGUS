const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Report = sequelize.define("Report", {
  _id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, field: "id" },
  sessionId: { type: DataTypes.UUID, allowNull: false, field: "session_id" },
  analysisId: { type: DataTypes.UUID, field: "analysis_id" },
  title: { type: DataTypes.STRING, allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: false },
  reportFormat: { type: DataTypes.STRING, defaultValue: "TXT", field: "report_format" },
  filePath: { type: DataTypes.TEXT, field: "file_path" },
  generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "generated_at" },
  totalIssues: { type: DataTypes.INTEGER, defaultValue: 0, field: "total_issues" },
  highSeverityCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "high_severity_count" },
  mediumSeverityCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "medium_severity_count" },
  lowSeverityCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "low_severity_count" },
  issues: { type: DataTypes.JSONB, defaultValue: [] },
  suggestions: { type: DataTypes.JSONB, defaultValue: [] },
  recommendations: { type: DataTypes.JSONB, defaultValue: [] },
  exportHistory: { type: DataTypes.JSONB, defaultValue: [], field: "export_history" },
  status: { type: DataTypes.ENUM("generated", "exported", "export_failed", "export_cancelled"), defaultValue: "generated" }
}, {
  tableName: "reports",
  timestamps: true,
  underscored: true
});

module.exports = Report;
