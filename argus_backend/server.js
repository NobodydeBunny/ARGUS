const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sequelize = require("./database");
require("./databaseSchemas");

const {
  setDatabaseStatus,
  getDatabaseStatus
} = require("./database/dbStatus");

// Set up the main backend app and its shared middleware.
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.set("json spaces", 2);
app.use(express.static("public"));

// A quick welcome response for checking that the server is alive.
app.get("/", (req, res) => {
  res.send("Argus Backend Running with Supabase PostgreSQL");
});

app.get("/api/health", async (req, res) => {
  // Let the plugin know whether the backend and database are available.
  const databaseStatus = getDatabaseStatus();

  res.status(200).json({
    status: "running",
    backend: "Argus Backend",
    database: databaseStatus.databaseAvailable ? "connected" : "unavailable",
    persistenceEnabled: databaseStatus.databaseAvailable,
    lastDatabaseError: databaseStatus.lastDatabaseError,
    lastCheckedAt: databaseStatus.lastCheckedAt
  });
});

app.use("/api/analysis", require("./routes/analysisRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/suggestions", require("./routes/suggestionRoutes"));

// Use the environment port when one is provided, otherwise use the local default.
const PORT = process.env.PORT || 5000;

// Keep checking the database so its status can recover without restarting the server.
const checkDatabaseConnection = async () => {
  try {
    await sequelize.authenticate();
    setDatabaseStatus(true);
    console.log("Database connection restored.");
  } catch (error) {
    setDatabaseStatus(false, error);
    console.log("Database still unavailable:", error.message);
  }
};

const startServer = async () => {
  // Try the database first, but still start the API if it is temporarily unavailable.
  try {
    await sequelize.authenticate();
    setDatabaseStatus(true);

    console.log("Supabase PostgreSQL connected");

    // Only sync tables when this has been deliberately enabled.
    if (String(process.env.DB_SYNC).toLowerCase() === "true") {
      await sequelize.sync({ alter: false });
      console.log("Database models synchronized");
    }
  } catch (error) {
    setDatabaseStatus(false, error);

    console.error("Database connection failed:", error.message);
    console.log("Backend will continue running without database persistence.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Give the database another chance every 30 seconds.
setInterval(checkDatabaseConnection, 30000);

// Start listening after the initial database check.
startServer();