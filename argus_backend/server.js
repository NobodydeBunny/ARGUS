const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.set("json spaces", 2);
app.use(express.static("public"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error.message);
  });

app.get("/", (req, res) => {
  res.send("Argus Backend Running");
});

const PORT = process.env.PORT || 5000;

app.use("/api/analysis", require("./routes/analysisRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/suggestions", require("./routes/suggestionRoutes"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});