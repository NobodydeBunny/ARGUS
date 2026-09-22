// This small page talks directly to the local Argus backend.
const API_URL = "http://localhost:5000/api";

const analysisForm = document.getElementById("analysisForm");
const analysisResult = document.getElementById("analysisResult");
const reportResult = document.getElementById("reportResult");
const generateReportBtn = document.getElementById("generateReportBtn");
const exportLink = document.getElementById("exportLink");

// Keep the latest records so the report button knows what to use.
let currentAnalysisId = null;
let currentReportId = null;

analysisForm.addEventListener("submit", async (event) => {
  // Send the values from the demo form for a quick analysis.
  event.preventDefault();

  const designData = {
    designName: document.getElementById("designName").value,
    fileType: document.getElementById("fileType").value,
    fontSize: Number(document.getElementById("fontSize").value),
    contrastRatio: Number(document.getElementById("contrastRatio").value),
    spacing: Number(document.getElementById("spacing").value)
  };

  try {
    const response = await fetch(`${API_URL}/analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(designData)
    });

    const data = await response.json();

    // Show the response and make report generation available.
    currentAnalysisId = data._id;
    currentReportId = null;

    analysisResult.textContent = JSON.stringify(data, null, 2);
    reportResult.textContent = "No report yet.";
    exportLink.classList.add("hidden");
    generateReportBtn.disabled = false;
  } catch (error) {
    analysisResult.textContent = "Failed to analyze design.";
  }
});

generateReportBtn.addEventListener("click", async () => {
  if (!currentAnalysisId) {
    return;
  }

  try {
    // Build a report from the analysis that was just created.
    const response = await fetch(`${API_URL}/reports/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        analysisId: currentAnalysisId
      })
    });

    const data = await response.json();

    currentReportId = data._id;

    reportResult.textContent = JSON.stringify(data, null, 2);
    exportLink.href = `${API_URL}/reports/${currentReportId}/export`;
    exportLink.classList.remove("hidden");
  } catch (error) {
    reportResult.textContent = "Failed to generate report.";
  }
});