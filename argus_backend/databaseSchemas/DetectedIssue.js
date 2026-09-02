const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const DetectedIssue = sequelize.define("DetectedIssue", {
  _id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, field: "id" },
  sessionId: { type: DataTypes.UUID, allowNull: false, field: "session_id" },
  analysisId: { type: DataTypes.UUID, field: "analysis_id" },
  issueKey: { type: DataTypes.STRING(700), allowNull: false, field: "issue_key" },
  nodeId: { type: DataTypes.STRING, field: "node_id" },
  nodeName: { type: DataTypes.STRING, field: "node_name" },
  nodeType: { type: DataTypes.STRING, field: "node_type" },
  issueType: { type: DataTypes.STRING, allowNull: false, field: "issue_type" },
  description: { type: DataTypes.TEXT, allowNull: false },
  severity: { type: DataTypes.ENUM("low", "medium", "high"), allowNull: false },
  principle: { type: DataTypes.STRING },
  confidenceScore: { type: DataTypes.DOUBLE, defaultValue: 0.85, field: "confidence_score" },
  status: { type: DataTypes.ENUM("open", "resolved", "ignored"), defaultValue: "open" },
  firstDetectedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "first_detected_at" },
  lastDetectedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "last_detected_at" },
  resolvedAt: { type: DataTypes.DATE, field: "resolved_at" },
  occurrenceCount: { type: DataTypes.INTEGER, defaultValue: 1, field: "occurrence_count" }
}, {
  tableName: "detected_issues",
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ["session_id", "issue_key"] }]
});

module.exports = DetectedIssue;
