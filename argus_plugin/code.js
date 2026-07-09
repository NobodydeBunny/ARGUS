figma.showUI(__html__, {
  width: 340,
  height: 700
});

const MAX_ANALYSIS_NODES = 80;

let realtimeScanEnabled = false;
let scanTimer = null;
let listeningPage = null;
let isAnalyzing = false;
let isGeneratingReport = false;
let activeSessionId = null;

function sendStatus(message) {
  figma.ui.postMessage({
    type: "system-status",
    message
  });
}

function hasCriticalOperation() {
  return isAnalyzing || isGeneratingReport;
}

function getFontSize(node) {
  if (node.type === "TEXT" && typeof node.fontSize === "number") {
    return node.fontSize;
  }

  return null;
}

function getNodeSpacing(node) {
  if ("itemSpacing" in node && typeof node.itemSpacing === "number") {
    return node.itemSpacing;
  }

  return null;
}

function getPaintColor(paints) {
  if (!paints || paints.length === 0) {
    return null;
  }

  const firstPaint = paints[0];

  if (firstPaint.type !== "SOLID") {
    return null;
  }

  return {
    r: Math.round(firstPaint.color.r * 255),
    g: Math.round(firstPaint.color.g * 255),
    b: Math.round(firstPaint.color.b * 255)
  };
}

function calculateSimpleContrast(node) {
  if (node.type !== "TEXT") {
    return null;
  }

  const textColor = getPaintColor(node.fills);

  if (!textColor) {
    return null;
  }

  const averageBrightness = (textColor.r + textColor.g + textColor.b) / 3;

  if (averageBrightness > 180) {
    return 3.2;
  }

  return 5.1;
}

function getTextContent(node) {
  if (node.type === "TEXT") {
    return node.characters || "";
  }

  return "";
}

function getCornerRadius(node) {
  if ("cornerRadius" in node && typeof node.cornerRadius === "number") {
    return node.cornerRadius;
  }

  return null;
}

function getLayoutMode(node) {
  if ("layoutMode" in node) {
    return node.layoutMode;
  }

  return null;
}

function getPadding(node, side) {
  if (side in node && typeof node[side] === "number") {
    return node[side];
  }

  return null;
}

function getComponentReference(node) {
  if ("componentId" in node) {
    return node.componentId;
  }

  return null;
}

function getMainComponentReference(node) {
  if ("mainComponent" in node && node.mainComponent) {
    return node.mainComponent.id;
  }

  return null;
}

function getPrimaryFillColor(node) {
  if (!("fills" in node) || !Array.isArray(node.fills)) {
    return null;
  }

  const solidFill = node.fills.find(fill => fill.type === "SOLID");

  if (!solidFill || !solidFill.color) {
    return null;
  }

  return {
    r: Math.round(solidFill.color.r * 255),
    g: Math.round(solidFill.color.g * 255),
    b: Math.round(solidFill.color.b * 255)
  };
}

function extractNodeData(node) {
  return {
    nodeId: node.id,
    parentId: node.parent ? node.parent.id : null,
    name: node.name,
    type: node.type,
    text: getTextContent(node),
    x: "x" in node ? node.x : null,
    y: "y" in node ? node.y : null,
    width: "width" in node ? node.width : null,
    height: "height" in node ? node.height : null,
    fontSize: getFontSize(node),
    fillColor: getPrimaryFillColor(node),
    fills: "fills" in node && Array.isArray(node.fills) ? node.fills : [],
    contrastRatio: calculateSimpleContrast(node),
    spacing: getNodeSpacing(node),
    itemSpacing: getNodeSpacing(node),
    cornerRadius: getCornerRadius(node),
    layoutMode: getLayoutMode(node),
    paddingTop: getPadding(node, "paddingTop"),
    paddingRight: getPadding(node, "paddingRight"),
    paddingBottom: getPadding(node, "paddingBottom"),
    paddingLeft: getPadding(node, "paddingLeft"),
    visible: node.visible,
    childrenCount: "children" in node ? node.children.length : 0,
    componentId: getComponentReference(node),
    mainComponentId: getMainComponentReference(node)
  };
}

function collectNodeAndChildren(node, collectedNodes) {
  if (node.removed) {
    return;
  }

  collectedNodes.push(extractNodeData(node));

  if ("children" in node) {
    node.children.forEach((child) => {
      collectNodeAndChildren(child, collectedNodes);
    });
  }
}

function collectSelectedNodes() {
  const selectedNodes = figma.currentPage.selection;
  const collectedNodes = [];

  selectedNodes.forEach((node) => {
    collectNodeAndChildren(node, collectedNodes);
  });

  return collectedNodes;
}

async function runAnalysis(reason) {
  if (isAnalyzing) {
    sendStatus("Analysis is already running. Please wait.");
    return;
  }

  const nodes = collectSelectedNodes();

  if (nodes.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select at least one layer or frame in Figma."
    });

    return;
  }

  if (nodes.length > MAX_ANALYSIS_NODES) {
    figma.ui.postMessage({
      type: "processing-limit",
      message: `Processing limitation detected. You selected ${nodes.length} nodes. Please select 80 nodes or fewer for near real-time analysis.`
    });

    return;
  }

  const designData = {
    sessionId: activeSessionId,
    designName: figma.currentPage.name || "Untitled",
    fileType: "Figma",
    scanMode: reason,
    nodeCount: nodes.length,
    nodes
  };

  figma.ui.postMessage({
    type: "design-data",
    data: designData
  });

  try {
    isAnalyzing = true;
    sendStatus("Analyzing design changes...");

    const response = await fetch("http://localhost:5000/api/analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(designData)
    });

    const result = await response.json();

    if (!response.ok) {
      figma.ui.postMessage({
        type: "error",
        message: result.message || "Analysis failed."
      });

      return;
    }

    if (result.sessionId) {
      activeSessionId = result.sessionId;
    }

    figma.ui.postMessage({
      type: "analysis-result",
      data: result
    });

    sendStatus("Analysis completed.");
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: "Could not connect to Argus backend. Make sure the backend is running."
    });
  } finally {
    isAnalyzing = false;
  }
}

function scheduleRealtimeScan(reason) {
  if (!realtimeScanEnabled) {
    return;
  }

  clearTimeout(scanTimer);

  scanTimer = setTimeout(() => {
    runAnalysis(reason);
  }, 1200);
}

function handleNodeChange() {
  scheduleRealtimeScan("near-real-time");
}

function handleSelectionChange() {
  scheduleRealtimeScan("selection-change");
}

function bindPageListener() {
  if (listeningPage) {
    listeningPage.off("nodechange", handleNodeChange);
  }

  listeningPage = figma.currentPage;
  listeningPage.on("nodechange", handleNodeChange);
}

function stopPluginProcesses() {
  realtimeScanEnabled = false;
  clearTimeout(scanTimer);

  if (listeningPage) {
    listeningPage.off("nodechange", handleNodeChange);
  }
}

bindPageListener();

figma.on("selectionchange", handleSelectionChange);

figma.on("currentpagechange", () => {
  bindPageListener();
  scheduleRealtimeScan("page-change");
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === "analyze-selection") {
    runAnalysis("manual");
  }

  if (msg.type === "enable-realtime-scan") {
    realtimeScanEnabled = true;

    figma.ui.postMessage({
      type: "scan-status",
      message: "Near real-time scanning enabled."
    });

    runAnalysis("near-real-time-start");
  }

  if (msg.type === "disable-realtime-scan") {
    realtimeScanEnabled = false;
    clearTimeout(scanTimer);

    figma.ui.postMessage({
      type: "scan-status",
      message: "Near real-time scanning disabled."
    });
  }

  if (msg.type === "generate-report") {
    if (isGeneratingReport) {
      sendStatus("Report generation is already running. Please wait.");
      return;
    }

    try {
      isGeneratingReport = true;
      sendStatus("Generating report...");

      const response = await fetch("http://localhost:5000/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          analysisId: msg.analysisId
        })
      });

      const report = await response.json();

      if (!response.ok) {
        figma.ui.postMessage({
          type: "error",
          message: report.message || "Report generation failed."
        });

        return;
      }

      figma.ui.postMessage({
        type: "report-result",
        data: report
      });

      sendStatus("Report generated.");
    } catch (error) {
      figma.ui.postMessage({
        type: "error",
        message: "Could not generate report. Make sure the backend is running."
      });
    } finally {
      isGeneratingReport = false;
    }
  }

  if (msg.type === "export-report") {
    if (!msg.reportId) {
      figma.ui.postMessage({
        type: "error",
        message: "No report is available for export."
      });

      return;
    }

    figma.openExternal(`http://localhost:5000/api/reports/${msg.reportId}/export`);

    figma.ui.postMessage({
      type: "system-status",
      message: "Report export started."
    });
  }

  if (msg.type === "cancel-export") {
    if (!msg.reportId) {
      figma.ui.postMessage({
        type: "error",
        message: "No report is available to cancel export."
      });

      return;
    }

    try {
      await fetch(`http://localhost:5000/api/reports/${msg.reportId}/export/cancel`, {
        method: "PATCH"
      });

      figma.ui.postMessage({
        type: "system-status",
        message: "Report export cancelled and recorded."
      });
    } catch (error) {
      figma.ui.postMessage({
        type: "error",
        message: "Could not record cancelled export."
      });
    }
  }

  if (msg.type === "request-close-plugin") {
    if (hasCriticalOperation()) {
      figma.ui.postMessage({
        type: "close-blocked",
        message: "Argus is still processing. Please wait until the current operation finishes."
      });

      return;
    }

    stopPluginProcesses();

    if (activeSessionId) {
      try {
        await fetch(`http://localhost:5000/api/sessions/${activeSessionId}/terminate`, {
          method: "PATCH"
        });
      } catch (error) {
        console.log("Could not terminate session safely.");
      }
    }

    figma.closePlugin();
  }
};