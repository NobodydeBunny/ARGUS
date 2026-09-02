const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sequelize = require("./database");
require("./databaseSchemas");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.set("json spaces", 2);
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("Argus Backend Running with Supabase PostgreSQL");
});

app.get("/api/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: "ok", database: "Supabase PostgreSQL" });
  } catch (error) {
    res.status(503).json({ status: "error", database: "unavailable", error: error.message });
  }
});

app.use("/api/analysis", require("./routes/analysisRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/suggestions", require("./routes/suggestionRoutes"));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Supabase PostgreSQL connected");

    // In development this verifies that Sequelize models match the SQL schema.
    // Keep DB_SYNC=false for the shared Supabase project after running supabase/schema.sql.
    if (String(process.env.DB_SYNC).toLowerCase() === "true") {
      await sequelize.sync({ alter: false });
      console.log("Database models synchronized");
    }

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
