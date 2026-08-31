const pages = {
      welcome: document.getElementById("welcomePage"),
      dashboard: document.getElementById("dashboardPage"),
      results: document.getElementById("resultsPage"),
      report: document.getElementById("reportPage")
    };

    const startBtn = document.getElementById("startBtn");
    const welcomeCloseBtn = document.getElementById("welcomeCloseBtn");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const scanToggleBtn = document.getElementById("scanToggleBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const resultsBtn = document.getElementById("resultsBtn");
    const goWelcomeBtn = document.getElementById("goWelcomeBtn");
    const goReportBtn = document.getElementById("goReportBtn");
    const closePluginBtn = document.getElementById("closePluginBtn");
    const backToDashboardFromResults = document.getElementById("backToDashboardFromResults");
    const backToDashboardFromReport = document.getElementById("backToDashboardFromReport");
    const refreshResultsBtn = document.getElementById("refreshResultsBtn");
    const openReportFromResultsBtn = document.getElementById("openReportFromResultsBtn");
    const generateReportBtn = document.getElementById("generateReportBtn");
    const exportReportBtn = document.getElementById("exportReportBtn");
    const cancelExportBtn = document.getElementById("cancelExportBtn");

    const monitorStatusText = document.getElementById("monitorStatusText");
    const runningBadge = document.getElementById("runningBadge");
    const framesScannedValue = document.getElementById("framesScannedValue");
    const issuesDetectedValue = document.getElementById("issuesDetectedValue");
    const lastScanTime = document.getElementById("lastScanTime");
    const criticalCount = document.getElementById("criticalCount");
    const moderateCount = document.getElementById("moderateCount");
    const minorCount = document.getElementById("minorCount");
    const dashboardIssues = document.getElementById("dashboardIssues");
    const jsonOutput = document.getElementById("jsonOutput");
    const statusOutput = document.getElementById("statusOutput");
    const resultsList = document.getElementById("resultsList");

    const reportTotalIssues = document.getElementById("reportTotalIssues");
    const reportCritical = document.getElementById("reportCritical");
    const reportModerate = document.getElementById("reportModerate");
    const reportMinor = document.getElementById("reportMinor");
    const reportTitle = document.getElementById("reportTitle");
    const reportProjectName = document.getElementById("reportProjectName");
    const reportDate = document.getElementById("reportDate");
    const reportTopIssues = document.getElementById("reportTopIssues");
    const reportStatusOutput = document.getElementById("reportStatusOutput");

    let currentAnalysisId = null;
    let currentReportId = null;
    let isScanning = false;
    let latestAnalysis = null;
    let latestReport = null;
    let latestDesignData = null;

    function showPage(pageName) {
      Object.values(pages).forEach(page => page.classList.remove("active"));
      pages[pageName].classList.add("active");
    }

    function sendPluginMessage(message) {
      parent.postMessage(
        {
          pluginMessage: message
        },
        "*"
      );
    }

    function setStatus(message, isError = false) {
      statusOutput.textContent = message;
      statusOutput.classList.toggle("error", isError);
      reportStatusOutput.textContent = message;
      reportStatusOutput.classList.toggle("error", isError);
    }

    function requestPluginClose() {
      const confirmed = confirm("Are you sure you want to stop Argus UI Analyzer?");

      if (!confirmed) {
        setStatus("Plugin termination cancelled.");
        return;
      }

      sendPluginMessage({
        type: "request-close-plugin"
      });
    }

    function updateScanningUi() {
      scanToggleBtn.textContent = isScanning
        ? "Disable Near Real-Time Scanning"
        : "Enable Near Real-Time Scanning";

      runningBadge.textContent = isScanning ? "RUNNING" : "IDLE";
      runningBadge.classList.toggle("paused", !isScanning);

      monitorStatusText.textContent = isScanning
        ? "● MONITORING ACTIVE"
        : "● READY";
    }

    function getSeverityClass(severity) {
      if (severity === "high") return "critical-card";
      if (severity === "medium") return "moderate-card";
      return "minor-card";
    }

    function getSeverityLabel(severity) {
      if (severity === "high") return "critical";
      if (severity === "medium") return "moderate";
      return "minor";
    }

    function getIssueCounts(issues) {
      return {
        high: issues.filter(issue => issue.severity === "high").length,
        medium: issues.filter(issue => issue.severity === "medium").length,
        low: issues.filter(issue => issue.severity === "low").length
      };
    }

    function safeText(value, fallback = "N/A") {
      return value == null || value === "" ? fallback : String(value);
    }

    function escapeHtml(value, fallback = "N/A") {
      return safeText(value, fallback)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function getDynamicSuggestion(issue) {
      return issue.detailedRecommendation ||
        issue.detailedSuggestion ||
        issue.recommendation ||
        "Review this element because it differs from the expected UI pattern.";
    }

    function renderDashboardIssues(issues) {
      if (!issues || issues.length === 0) {
        dashboardIssues.innerHTML = `
          <div class="issue-card">
            <h5>No UI issues detected</h5>
            <p>The selected design does not show detectable issues based on the current analysis.</p>
          </div>
        `;
        return;
      }

      dashboardIssues.innerHTML = issues.slice(0, 5).map(issue => `
        <div class="issue-card ${getSeverityClass(issue.severity)}">
          <h5>${escapeHtml(issue.type)}</h5>
          <p>${escapeHtml(issue.message, "Pattern issue detected in the selected design.")}</p>
          <p class="frame">Layer: ${escapeHtml(issue.nodeName, "Unknown")}</p>
          <div class="suggestion">
            <h4>✨ REAL-TIME AI SUGGESTION</h4>
            <p>${escapeHtml(getDynamicSuggestion(issue))}</p>
            <p>${escapeHtml(issue.explanation || "")}</p>
          </div>
        </div>
      `).join("");
    }

    function renderResults(issues) {
      if (!issues || issues.length === 0) {
        resultsList.innerHTML = `
          <div class="issue-card">
            <h2>No UI issues detected</h2>
            <p class="description">No design problems were detected in the latest analysis.</p>
          </div>
        `;
        return;
      }

      resultsList.innerHTML = issues.map(issue => `
        <div class="issue-card ${getSeverityClass(issue.severity)}">
          <div class="title-row">
            <h2>${escapeHtml(issue.type)}</h2>
            <span class="badge ${issue.severity || "low"}">${getSeverityLabel(issue.severity)}</span>
          </div>

          <p class="description">
            ${escapeHtml(issue.message, "The AI model detected a possible UI pattern issue.")}
          </p>

          <p class="frame">
            Layer: ${escapeHtml(issue.nodeName, "Unknown")} · Type: ${escapeHtml(issue.nodeType, "Unknown")}
          </p>

          <div class="suggestion">
            <h4>✨ REAL-TIME AI SUGGESTION</h4>
            <p>${escapeHtml(getDynamicSuggestion(issue))}</p>
          </div>

          <div class="suggestion">
            <h4>WHY ARGUS SAYS THIS</h4>
            <p>${escapeHtml(issue.explanation || "The suggestion was generated from the detected issue type and Figma metadata evidence.")}</p>
            <p>${escapeHtml(issue.evidenceSummary || "")}</p>
          </div>
        </div>
      `).join("");
    }

    function updateReportSummaryFromAnalysis(analysis) {
      const issues = analysis && analysis.issues ? analysis.issues : [];
      const counts = getIssueCounts(issues);

      reportTotalIssues.textContent = issues.length;
      reportCritical.textContent = counts.high;
      reportModerate.textContent = counts.medium;
      reportMinor.textContent = counts.low;

      if (analysis) {
        reportProjectName.textContent = analysis.designName || "Current Figma Selection";
        reportDate.textContent = new Date().toLocaleString();
        reportTitle.textContent = "Argus UI Design Analysis Report";
      }

      if (issues.length === 0) {
        reportTopIssues.innerHTML = "<p>No top issues available.</p>";
      } else {
        reportTopIssues.innerHTML = issues.slice(0, 3).map(issue => `
          <p><span>•</span> ${escapeHtml(issue.type)} in ${escapeHtml(issue.nodeName, "Unknown layer")}</p>
          <p>${escapeHtml(getDynamicSuggestion(issue))}</p>
        `).join("");
      }
    }

    function renderAnalysis(analysis) {
      latestAnalysis = analysis;
      const issues = analysis.issues || [];
      const counts = getIssueCounts(issues);

      currentAnalysisId = analysis._id;
      currentReportId = null;

      framesScannedValue.textContent = analysis.nodeCount || (latestDesignData && latestDesignData.nodeCount) || 0;
      issuesDetectedValue.textContent = analysis.totalIssues || issues.length;
      criticalCount.textContent = counts.high;
      moderateCount.textContent = counts.medium;
      minorCount.textContent = counts.low;
      lastScanTime.textContent = new Date().toLocaleTimeString();

      generateReportBtn.disabled = false;
      exportReportBtn.disabled = true;
      cancelExportBtn.classList.add("hide");

      renderDashboardIssues(issues);
      renderResults(issues);
      updateReportSummaryFromAnalysis(analysis);
    }

    startBtn.onclick = () => {
      showPage("dashboard");
      setStatus("Select one or more Figma layers, then run analysis.");
    };

    welcomeCloseBtn.onclick = requestPluginClose;
    closePluginBtn.onclick = requestPluginClose;

    analyzeBtn.onclick = () => {
      setStatus("Analyzing selected Figma layers...");
      showPage("dashboard");

      sendPluginMessage({
        type: "analyze-selection"
      });
    };

    scanToggleBtn.onclick = () => {
      isScanning = !isScanning;
      updateScanningUi();

      setStatus(isScanning
        ? "Near real-time scanning is enabled. Argus will monitor design changes."
        : "Near real-time scanning is disabled.");

      sendPluginMessage({
        type: isScanning ? "enable-realtime-scan" : "disable-realtime-scan"
      });
    };

    pauseBtn.onclick = () => {
      if (!isScanning) {
        setStatus("Near real-time scanning is already paused.");
        return;
      }

      isScanning = false;
      updateScanningUi();

      sendPluginMessage({
        type: "disable-realtime-scan"
      });

      setStatus("Near real-time scanning paused.");
    };

    resultsBtn.onclick = () => {
      showPage("results");
    };

    goWelcomeBtn.onclick = () => {
      showPage("welcome");
    };

    goReportBtn.onclick = () => {
      showPage("report");
    };

    backToDashboardFromResults.onclick = () => {
      showPage("dashboard");
    };

    backToDashboardFromReport.onclick = () => {
      showPage("dashboard");
    };

    refreshResultsBtn.onclick = () => {
      renderResults(latestAnalysis ? latestAnalysis.issues : []);
      setStatus("Results refreshed.");
    };

    openReportFromResultsBtn.onclick = () => {
      showPage("report");
    };

    generateReportBtn.onclick = () => {
      if (!currentAnalysisId) {
        setStatus("Please analyze a design first.", true);
        return;
      }

      setStatus("Generating report...");

      sendPluginMessage({
        type: "generate-report",
        analysisId: currentAnalysisId
      });
    };

    exportReportBtn.onclick = () => {
      if (!currentReportId) {
        setStatus("Please generate a report first.", true);
        return;
      }

      const confirmed = confirm("Do you want to export this report now?");

      if (!confirmed) {
        sendPluginMessage({
          type: "cancel-export",
          reportId: currentReportId
        });

        setStatus("Report export cancelled.");
        return;
      }

      sendPluginMessage({
        type: "export-report",
        reportId: currentReportId
      });

      cancelExportBtn.classList.remove("hide");
    };

    cancelExportBtn.onclick = () => {
      if (!currentReportId) {
        setStatus("No report is available to cancel.", true);
        return;
      }

      sendPluginMessage({
        type: "cancel-export",
        reportId: currentReportId
      });

      cancelExportBtn.classList.add("hide");
      setStatus("Report export cancelled.");
    };

    onmessage = (event) => {
      const msg = event.data.pluginMessage;

      if (!msg) {
        return;
      }

      if (msg.type === "design-data") {
        latestDesignData = msg.data;
        jsonOutput.textContent = JSON.stringify(msg.data, null, 2);
        framesScannedValue.textContent = msg.data.nodeCount || 0;
      }

      if (msg.type === "analysis-result") {
        renderAnalysis(msg.data);
        setStatus("Analysis completed.");
      }

      if (msg.type === "report-result") {
        latestReport = msg.data;
        currentReportId = msg.data._id;
        exportReportBtn.disabled = false;
        cancelExportBtn.classList.add("hide");

        reportTitle.textContent = msg.data.title || "Argus UI Design Analysis Report";
        reportProjectName.textContent = latestAnalysis ? latestAnalysis.designName : "Current Figma Selection";
        reportDate.textContent = new Date(msg.data.generatedAt || Date.now()).toLocaleString();

        reportStatusOutput.textContent = "Report generated. You can export it now.";
        reportStatusOutput.classList.remove("error");

        showPage("report");
      }

      if (msg.type === "scan-status") {
        setStatus(msg.message);
      }

      if (msg.type === "system-status") {
        setStatus(msg.message);

        if (msg.message && msg.message.toLowerCase().includes("export")) {
          cancelExportBtn.classList.add("hide");
        }
      }

      if (msg.type === "processing-limit") {
        setStatus(msg.message, true);
      }

      if (msg.type === "close-blocked") {
        setStatus(msg.message, true);
      }

      if (msg.type === "error") {
        setStatus(msg.message, true);
      }
    };

    updateScanningUi();
