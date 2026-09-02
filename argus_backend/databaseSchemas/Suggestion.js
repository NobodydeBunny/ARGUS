const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Suggestion = sequelize.define("Suggestion", {
  _id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, field: "id" },
  sessionId: { type: DataTypes.UUID, allowNull: false, field: "session_id" },
  issueId: { type: DataTypes.UUID, allowNull: false, field: "issue_id" },
  analysisId: { type: DataTypes.UUID, field: "analysis_id" },
  description: { type: DataTypes.TEXT, allowNull: false },
  shortSuggestion: { type: DataTypes.TEXT, field: "short_suggestion" },
  detailedSuggestion: { type: DataTypes.TEXT, field: "detailed_suggestion" },
  explanation: { type: DataTypes.TEXT },
  evidenceSummary: { type: DataTypes.TEXT, field: "evidence_summary" },
  priority: { type: DataTypes.ENUM("low", "medium", "high"), allowNull: false },
  fixType: { type: DataTypes.STRING, defaultValue: "general", field: "fix_type" },
  generatedBy: { type: DataTypes.STRING, defaultValue: "Argus Dynamic AI Feedback Generator v1.0", field: "generated_by" },
  generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "generated_at" }
}, {
  tableName: "suggestions",
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ["session_id", "issue_id"] }]
});

module.exports = Suggestion;
