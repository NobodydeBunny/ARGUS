const fs = require("fs");
const path = require("path");

const pluginFolder = __dirname;

function readSource(fileName) {
  const filePath = path.join(pluginFolder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required UI source file: ${fileName}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

const css = readSource("ui.css");
const js = readSource("ui.js");

const welcomePage = readSource("welcome.html");
const dashboardPage = readSource("dashboard.html");
const resultsPage = readSource("results.html");
const reportPage = readSource("report.html");

const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Argus UI Analyzer</title>

  <style>
${css}
  </style>
</head>

<body>
  <div class="app">
${welcomePage}

${dashboardPage}

${resultsPage}

${reportPage}
  </div>

  <script>
${js}
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(pluginFolder, "ui.html"), finalHtml, "utf8");

console.log("ui.html generated successfully with separated UI files and embedded images.");
