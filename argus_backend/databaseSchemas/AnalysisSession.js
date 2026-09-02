const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const AnalysisSession = sequelize.define("AnalysisSession", {
  _id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, field: "id" },
  designName: { type: DataTypes.STRING, allowNull: false, field: "design_name" },
  designId: { type: DataTypes.STRING, defaultValue: "figma-current-page", field: "design_id" },
  figmaPageName: { type: DataTypes.STRING, field: "figma_page_name" },
  fileType: { type: DataTypes.STRING, defaultValue: "Figma", field: "file_type" },
  modelName: { type: DataTypes.STRING, defaultValue: "Random Forest UI Issue Classifier", field: "model_name" },
  modelVersion: { type: DataTypes.STRING, defaultValue: "2.0", field: "model_version" },
  analysisMethod: { type: DataTypes.STRING, defaultValue: "trained_metadata_model_with_dynamic_feedback", field: "analysis_method" },
  scanMode: { type: DataTypes.STRING, defaultValue: "manual", field: "scan_mode" },
  nodeCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "node_count" },
  totalIssues: { type: DataTypes.INTEGER, defaultValue: 0, field: "total_issues" },
  totalSuggestions: { type: DataTypes.INTEGER, defaultValue: 0, field: "total_suggestions" },
  startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "started_at" },
  completedAt: { type: DataTypes.DATE, field: "completed_at" },
  terminatedAt: { type: DataTypes.DATE, field: "terminated_at" },
  status: { type: DataTypes.ENUM("started", "completed", "failed", "terminated"), defaultValue: "started" },
  lastAnalysisId: { type: DataTypes.UUID, field: "last_analysis_id" },
  errorMessage: { type: DataTypes.TEXT, field: "error_message" }
}, {
  tableName: "analysis_sessions",
  timestamps: true,
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  underscored: true
});

module.exports = AnalysisSession;
