const API_URL = "http://localhost:5000/api";

const analysisForm = document.getElementById("analysisForm");
const analysisResult = document.getElementById("analysisResult");
const reportResult = document.getElementById("reportResult");
const generateReportBtn = document.getElementById("generateReportBtn");
const exportLink = document.getElementById("exportLink");

let currentAnalysisId = null;
let currentReportId = null;

analysisForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Collect design input values
  const designData = {
    designName: document.getElementById("designName").value,
    fileType: document.getElementById("fileType").value,
    fontSize: Number(document.getElementById("fontSize").value),
    contrastRatio: Number(document.getElementById("contrastRatio").value),
    spacing: Number(document.getElementById("spacing").value)
  };

  try {
    // Send design data for analysis
    const response = await fetch(`${API_URL}/analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(designData)
    });

    const data = await response.json();

    currentAnalysisId = data._id;
    currentReportId = null;

    // Display analysis result
    analysisResult.textContent =
      JSON.stringify(data, null, 2);

    // Reset report section
    reportResult.textContent = "No report yet.";
    exportLink.classList.add("hidden");
    generateReportBtn.disabled = false;

  } catch (error) {
    analysisResult.textContent =
      "Failed to analyze design.";
  }
});

generateReportBtn.addEventListener("click", async () => {
  if (!currentAnalysisId) {
    return;
  }

  try {
    // Generate report from analysis
    const response = await fetch(
      `${API_URL}/reports/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          analysisId: currentAnalysisId
        })
      }
    );

    const data = await response.json();

    currentReportId = data._id;

    // Display report result
    reportResult.textContent =
      JSON.stringify(data, null, 2);

    // Enable report export link
    exportLink.href =
      `${API_URL}/reports/${currentReportId}/export`;

    exportLink.classList.remove("hidden");

  } catch (error) {
    reportResult.textContent =
      "Failed to generate report.";
  }
});