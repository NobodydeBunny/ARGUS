const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Analysis = sequelize.define("Analysis", {
  _id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, field: "id" },
  sessionId: { type: DataTypes.UUID, allowNull: false, field: "session_id" },
  designName: { type: DataTypes.STRING, allowNull: false, field: "design_name" },
  fileType: { type: DataTypes.STRING, allowNull: false, field: "file_type" },
  scanMode: { type: DataTypes.STRING, defaultValue: "manual", field: "scan_mode" },
  modelName: { type: DataTypes.STRING, defaultValue: "Random Forest UI Issue Classifier", field: "model_name" },
  modelVersion: { type: DataTypes.STRING, defaultValue: "2.0", field: "model_version" },
  analysisMethod: { type: DataTypes.STRING, defaultValue: "trained_metadata_model_with_dynamic_feedback", field: "analysis_method" },
  frameCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "frame_count" },
  frames: { type: DataTypes.JSONB, defaultValue: [] },
  nodeCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "node_count" },
  nodes: { type: DataTypes.JSONB, defaultValue: [] },
  totalIssues: { type: DataTypes.INTEGER, defaultValue: 0, field: "total_issues" },
  issues: { type: DataTypes.JSONB, defaultValue: [] },
  status: { type: DataTypes.STRING, defaultValue: "completed" },
  startedAt: { type: DataTypes.DATE, field: "started_at" },
  completedAt: { type: DataTypes.DATE, field: "completed_at" }
}, {
  tableName: "analyses",
  timestamps: true,
  underscored: true
});

module.exports = Analysis;
