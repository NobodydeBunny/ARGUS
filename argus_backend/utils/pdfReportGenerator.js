const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const PAGE_MARGIN = 50;

const COLORS = {
  primary: "#243B53",
  primaryDark: "#102A43",
  primaryTint: "#EAF2F8",
  accent: "#0F766E",

  dark: "#111827",
  text: "#374151",
  muted: "#6B7280",
  light: "#F8FAFC",

  high: "#9F1239",
  highBackground: "#FFF1F2",

  medium: "#92400E",
  mediumBackground: "#FFFBEB",

  low: "#166534",
  lowBackground: "#F0FDF4",

  border: "#E2E8F0",
  white: "#FFFFFF"
};

const logoPath = path.join(
  __dirname,
  "..",
  "assets",
  "argus_logo.jpeg"
);

// Put the logo in a box without stretching it.
const drawLogo = (doc, x, y, maxWidth, maxHeight) => {
  if (!fs.existsSync(logoPath)) return 0;

  const image = doc.openImage(logoPath);

  const ratio = Math.min(
    maxWidth / image.width,
    maxHeight / image.height
  );

  const width = image.width * ratio;
  const height = image.height * ratio;

  const drawX = x + (maxWidth - width) / 2;
  const drawY = y + (maxHeight - height) / 2;

  doc.image(logoPath, drawX, drawY, {
    width,
    height
  });

  return width;
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
// These helpers keep the report text readable even when some data is missing.

const getValue = (source, keys, fallback = "-") => {
  if (!source) return fallback;

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }

    if (
      source.dataValues &&
      source.dataValues[key] !== undefined &&
      source.dataValues[key] !== null &&
      source.dataValues[key] !== ""
    ) {
      return source.dataValues[key];
    }
  }

  return fallback;
};

const normalizeId = (value) => {
  if (!value || value === "-") return "";
  return String(value);
};

const humanize = (value = "") => {
  if (!value || value === "-") return "-";

  return String(value)
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const capitalize = (value = "") => {
  if (!value) return "-";

  return (
    String(value).charAt(0).toUpperCase() +
    String(value).slice(1)
  );
};

const formatStatus = (value) => {
  if (!value || value === "-") return "-";
  return humanize(value);
};

const formatOccurrence = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "-"
  ) {
    return "1";
  }

  return String(value);
};

const formatDate = (value) => {
  if (!value || value === "-") return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatConfidence = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "-"
  ) {
    return "-";
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return "-";
  }

  if (numberValue > 1) {
    return `${Math.round(numberValue)}%`;
  }

  return `${Math.round(numberValue * 100)}%`;
};

const severityStyle = (severity) => {
  switch ((severity || "").toLowerCase()) {
    case "high":
      return {
        text: COLORS.high,
        background: COLORS.highBackground
      };

    case "low":
      return {
        text: COLORS.low,
        background: COLORS.lowBackground
      };

    default:
      return {
        text: COLORS.medium,
        background: COLORS.mediumBackground
      };
  }
};

const getAnalyzedFrameNames = (
  analysis,
  session,
  issues = []
) => {
  const frameNames = [];

  if (Array.isArray(analysis?.frames)) {
    analysis.frames.forEach((frame) => {
      const frameName =
        getValue(frame, ["frameName", "name"], "");

      if (
        frameName &&
        frameName !== "-" &&
        !frameNames.includes(frameName)
      ) {
        frameNames.push(frameName);
      }
    });
  }

  if (
    frameNames.length === 0 &&
    Array.isArray(session?.frames)
  ) {
    session.frames.forEach((frame) => {
      const frameName =
        getValue(frame, ["frameName", "name"], "");

      if (
        frameName &&
        frameName !== "-" &&
        !frameNames.includes(frameName)
      ) {
        frameNames.push(frameName);
      }
    });
  }

  if (
    frameNames.length === 0 &&
    Array.isArray(issues)
  ) {
    issues.forEach((issue) => {
      const frameName =
        getValue(issue, ["frameName", "frame_name"], "");

      if (
        frameName &&
        frameName !== "-" &&
        !frameNames.includes(frameName)
      ) {
        frameNames.push(frameName);
      }
    });
  }

  return frameNames;
};

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
// Small drawing helpers used to keep the PDF pages looking consistent.

const ensureSpace = (
  doc,
  requiredHeight = 120
) => {
  const bottomSafeArea = 65;

  if (
    doc.y + requiredHeight >
    doc.page.height - bottomSafeArea
  ) {
    doc.addPage();
    drawPageHeader(doc);
  }
};

const drawPageHeader = (doc) => {
  if (fs.existsSync(logoPath)) {
    drawLogo(doc, PAGE_MARGIN, 22, 24, 31);
  }

  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      "ARGUS  ·  Usability Analysis Report",
      PAGE_MARGIN + 34,
      33
    );

  doc
    .moveTo(PAGE_MARGIN, 62)
    .lineTo(doc.page.width - PAGE_MARGIN, 62)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();

  doc.y = 88;
};

const drawSeverityPill = (
  doc,
  severity,
  x,
  y,
  {
    width = 62,
    align = "left"
  } = {}
) => {
  const style = severityStyle(severity);
  const label = `${capitalize(severity)}`;
  const pillWidth = width;
  const pillHeight = 16;
  const drawX =
    align === "right"
      ? x - pillWidth
      : x;

  doc
    .roundedRect(drawX, y, pillWidth, pillHeight, 8)
    .fill(style.background);

  doc
    .fontSize(7.5)
    .fillColor(style.text)
    .text(label.toUpperCase(), drawX, y + 4.5, {
      width: pillWidth,
      align: "center"
    });

  return {
    x: drawX,
    width: pillWidth,
    height: pillHeight
  };
};

const drawSectionLabel = (
  doc,
  label,
  color = COLORS.accent
) => {
  const y = doc.y;

  doc
    .rect(PAGE_MARGIN, y + 2, 6, 6)
    .fill(color);

  doc
    .fontSize(9.5)
    .fillColor(COLORS.dark)
    .text(label, PAGE_MARGIN + 12, y);

  doc.y = y + 15;
};

const drawMetaField = (
  doc,
  x,
  y,
  width,
  label,
  value
) => {
  doc
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(label.toUpperCase(), x, y, {
      width
    });

  doc
    .fontSize(9)
    .fillColor(COLORS.dark)
    .text(String(value || "-"), x, y + 11, {
      width,
      lineGap: 1
    });
};

const drawInfoGrid = (
  doc,
  title,
  fields,
  {
    background = COLORS.light,
    border = COLORS.border
  } = {}
) => {
  const cardX = PAGE_MARGIN;
  const cardWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  const padding = 14;
  const gap = 14;
  const colWidth =
    (cardWidth - padding * 2 - gap) / 2;

  const titleHeight = title ? 24 : 0;

  const rowHeights = [];

  for (
    let i = 0;
    i < fields.length;
    i += 2
  ) {
    const left = fields[i];
    const right = fields[i + 1];

    const leftHeight = left
      ? doc.heightOfString(String(left.value || "-"), {
          width: colWidth,
          lineGap: 1
        }) + 15
      : 0;

    const rightHeight = right
      ? doc.heightOfString(String(right.value || "-"), {
          width: colWidth,
          lineGap: 1
        }) + 15
      : 0;

    rowHeights.push(
      Math.max(36, leftHeight, rightHeight)
    );
  }

  const cardHeight =
    padding +
    titleHeight +
    rowHeights.reduce((sum, h) => sum + h, 0) +
    padding -
    4;

  ensureSpace(doc, cardHeight + 20);

  const startY = doc.y;

  doc
    .roundedRect(
      cardX,
      startY,
      cardWidth,
      cardHeight,
      6
    )
    .fillAndStroke(
      background,
      border
    );

  let contentY =
    startY +
    padding;

  if (title) {
    doc
      .fontSize(9.5)
      .fillColor(COLORS.dark)
      .text(
        title,
        cardX + padding,
        contentY,
        {
          width:
            cardWidth -
            padding * 2
        }
      );

    contentY += titleHeight;
  }

  let currentY = contentY;

  for (
    let i = 0;
    i < fields.length;
    i += 2
  ) {
    const left = fields[i];
    const right = fields[i + 1];
    const rowIndex = Math.floor(i / 2);

    if (left) {
      drawMetaField(
        doc,
        cardX + padding,
        currentY,
        colWidth,
        left.label,
        left.value
      );
    }

    if (right) {
      drawMetaField(
        doc,
        cardX + padding + colWidth + gap,
        currentY,
        colWidth,
        right.label,
        right.value
      );
    }

    currentY += rowHeights[rowIndex];
  }

  doc.y =
    startY +
    cardHeight +
    16;
};

const drawTextSection = (
  doc,
  label,
  text,
  {
    color = COLORS.accent,
    indent = 12
  } = {}
) => {
  const contentWidth =
    doc.page.width -
    PAGE_MARGIN * 2 -
    indent;

  const safeText =
    text ||
    "No additional information available.";

  const requiredHeight =
    doc.heightOfString(safeText, {
      width: contentWidth,
      lineGap: 2
    }) + 30;

  ensureSpace(doc, requiredHeight);

  doc.x = PAGE_MARGIN;

  drawSectionLabel(
    doc,
    label,
    color
  );

  doc.y += 4;

  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(
      safeText,
      PAGE_MARGIN + indent,
      doc.y,
      {
        width: contentWidth,
        lineGap: 2
      }
    );

  doc.moveDown(1.1);
};

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------
// The first page gives the report its title and a quick overview.

const drawCoverHeader = (
  doc,
  analysis,
  session,
  frameNames
) => {
  const bandHeight = 150;

  doc
    .rect(
      0,
      0,
      doc.page.width,
      bandHeight
    )
    .fill(COLORS.primary);

  doc
    .rect(
      0,
      bandHeight,
      doc.page.width,
      4
    )
    .fill(COLORS.accent);

  if (fs.existsSync(logoPath)) {
    drawLogo(doc, PAGE_MARGIN, 32, 54, 70);
  }

  const textX =
    fs.existsSync(logoPath)
      ? PAGE_MARGIN + 72
      : PAGE_MARGIN;

  doc
    .fontSize(24)
    .fillColor(COLORS.white)
    .text(
      "ARGUS",
      textX,
      45
    );

  doc
    .fontSize(14)
    .fillColor(COLORS.white)
    .text(
      "Usability Analysis Report",
      textX,
      74
    );

  doc
    .fontSize(9)
    .fillColor("#CBD5E1")
    .text(
      "Clear usability insights and actionable design recommendations",
      textX,
      96
    );

  doc.y =
    bandHeight + 36;

  const cardX =
    PAGE_MARGIN;

  const cardWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  const cardY =
    doc.y;

  const rowHeight = 34;

  const cardHeight =
    rowHeight * 3 + 10;

  const col2X =
    cardX +
    cardWidth / 2;

  doc
    .roundedRect(
      cardX,
      cardY,
      cardWidth,
      cardHeight,
      6
    )
    .fillAndStroke(
      COLORS.light,
      COLORS.border
    );

  const analyzedFramesText =
    Array.isArray(frameNames) &&
    frameNames.length > 0
      ? frameNames.join(", ")
      : "N/A";

  const metadataRows = [
    [
      [
        "Design",
        getValue(
          analysis,
          ["designName", "design_name"],
          "Untitled"
        )
      ],
      [
        "Analysis Mode",
        capitalize(
          getValue(
            analysis,
            ["scanMode", "scan_mode"],
            "manual"
          )
        )
      ]
    ],
    [
      [
        "Frames Analyzed",
        analyzedFramesText
      ],
      [
        "Elements Analyzed",
        String(
          getValue(
            analysis,
            ["nodeCount", "node_count"],
            0
          )
        )
      ]
    ],
    [
      [
        "Generated",
        formatDate(new Date())
      ],
      null
    ]
  ];

  metadataRows.forEach(
    (row, rowIndex) => {
      const rowY =
        cardY +
        14 +
        rowIndex *
          rowHeight;

      row.forEach(
        (cell, cellIndex) => {
          if (!cell) {
            return;
          }

          const [
            label,
            value
          ] = cell;

          const x =
            cellIndex === 0
              ? cardX + 16
              : col2X + 6;

          doc
            .fontSize(7.5)
            .fillColor(
              COLORS.muted
            )
            .text(
              label.toUpperCase(),
              x,
              rowY,
              {
                width:
                  cardWidth /
                    2 -
                  28
              }
            );

          doc
            .fontSize(10)
            .fillColor(
              COLORS.dark
            )
            .text(
              String(value || "-"),
              x,
              rowY + 11,
              {
                width:
                  cardWidth /
                    2 -
                  28
              }
            );
        }
      );
    }
  );

  doc.y =
    cardY +
    cardHeight +
    36;
};

const drawSummaryCards = (
  doc,
  counts
) => {
  const cardWidth = 145;
  const cardHeight = 72;
  const gap = 18;

  const startX =
    (doc.page.width - (cardWidth * 3 + gap * 2)) / 2;

  const y = doc.y;

  const cards = [
    {
      label: "High Priority",
      count: counts.high,
      severity: "high"
    },
    {
      label: "Medium Priority",
      count: counts.medium,
      severity: "medium"
    },
    {
      label: "Low Priority",
      count: counts.low,
      severity: "low"
    }
  ];

  cards.forEach((card, index) => {
    const x =
      startX +
      index *
        (cardWidth + gap);

    const style =
      severityStyle(card.severity);

    doc
      .roundedRect(
        x,
        y,
        cardWidth,
        cardHeight,
        8
      )
      .fill(style.background);

    doc
      .roundedRect(
        x,
        y,
        cardWidth,
        4,
        2
      )
      .fill(style.text);

    doc
      .fontSize(24)
      .fillColor(style.text)
      .text(
        String(card.count),
        x,
        y + 16,
        {
          width: cardWidth,
          align: "center"
        }
      );

    doc
      .fontSize(8.5)
      .fillColor(style.text)
      .text(
        card.label.toUpperCase(),
        x,
        y + 46,
        {
          width: cardWidth,
          align: "center"
        }
      );
  });

  doc.y =
    y +
    cardHeight +
    42;
};

// ---------------------------------------------------------------------------
// Issues at a Glance
// ---------------------------------------------------------------------------
// Summarize the important findings before showing every detail.

const drawOverview = (
  doc,
  issues
) => {
  ensureSpace(doc, 140);

  doc
    .fontSize(14)
    .fillColor(COLORS.dark)
    .text("Issues at a Glance", PAGE_MARGIN, doc.y);

  doc.moveDown(1);

  const tableX = PAGE_MARGIN;
  const tableWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  const columns = {
    index: {
      x: tableX + 8,
      width: 24
    },
    type: {
      x: tableX + 38,
      width: 145
    },
    location: {
      x: tableX + 190,
      width: 145
    },
    status: {
      x: tableX + 340,
      width: 60
    },
    severity: {
      x: tableX + tableWidth - 70,
      width: 62
    }
  };

  const headerY = doc.y;
  const headerHeight = 28;

  doc
    .rect(
      tableX,
      headerY,
      tableWidth,
      headerHeight
    )
    .fill(COLORS.light);

  doc
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(
      "#",
      columns.index.x,
      headerY + 10,
      {
        width: columns.index.width
      }
    )
    .text(
      "ISSUE TYPE",
      columns.type.x,
      headerY + 10,
      {
        width: columns.type.width
      }
    )
    .text(
      "FRAME / LAYER",
      columns.location.x,
      headerY + 10,
      {
        width: columns.location.width
      }
    )
    .text(
      "STATUS",
      columns.status.x,
      headerY + 10,
      {
        width: columns.status.width
      }
    )
    .text(
      "SEVERITY",
      columns.severity.x,
      headerY + 10,
      {
        width: columns.severity.width,
        align: "right"
      }
    );

  doc.y =
    headerY +
    headerHeight;

  issues.forEach((issue, index) => {
    ensureSpace(doc, 50);

    const rowHeight = 46;
    const rowY = doc.y;

    if (index % 2 === 1) {
      doc
        .rect(
          tableX,
          rowY,
          tableWidth,
          rowHeight
        )
        .fill(COLORS.light);
    }

    const frameName =
      getValue(
        issue,
        ["frameName", "frame_name"],
        "Current Design"
      );

    const layerName =
      getValue(
        issue,
        ["nodeName", "layerName", "node_name"],
        "Design element"
      );

    const status =
      formatStatus(
        getValue(
          issue,
          ["status"],
          "open"
        )
      );

    doc
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(
        String(index + 1).padStart(2, "0"),
        columns.index.x,
        rowY + 15,
        {
          width: columns.index.width
        }
      );

    doc
      .fontSize(8.5)
      .fillColor(COLORS.dark)
      .text(
        getValue(
          issue,
          ["issueType", "issue_type"],
          "Usability Issue"
        ),
        columns.type.x,
        rowY + 10,
        {
          width: columns.type.width,
          height: rowHeight - 12,
          ellipsis: true
        }
      );

    doc
      .fontSize(7.8)
      .fillColor(COLORS.text)
      .text(
        `Frame: ${frameName}\nLayer: ${layerName}`,
        columns.location.x,
        rowY + 7,
        {
          width: columns.location.width,
          height: rowHeight - 8,
          lineGap: 2,
          ellipsis: true
        }
      );

    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        status,
        columns.status.x,
        rowY + 15,
        {
          width: columns.status.width,
          ellipsis: true
        }
      );

    drawSeverityPill(
      doc,
      getValue(issue, ["severity"], "medium"),
      columns.severity.x + columns.severity.width,
      rowY + 14,
      {
        width: 62,
        align: "right"
      }
    );

    doc
      .moveTo(
        tableX,
        rowY + rowHeight
      )
      .lineTo(
        tableX + tableWidth,
        rowY + rowHeight
      )
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    doc.y =
      rowY +
      rowHeight;
  });

  doc.moveDown(1.6);
};

// ---------------------------------------------------------------------------
// Individual issue detail cards
// ---------------------------------------------------------------------------
// Each issue gets its own explanation, evidence, and suggested next step.

const findSuggestion = (
  issue,
  suggestions = []
) => {
  const issueId =
    normalizeId(
      getValue(
        issue,
        ["_id", "id", "issueId"],
        ""
      )
    );

  const issueKey =
    normalizeId(
      getValue(
        issue,
        ["issueKey", "issue_key"],
        ""
      )
    );

  return suggestions.find((suggestion) => {
    const suggestionIssueId =
      normalizeId(
        getValue(
          suggestion,
          [
            "issueId",
            "issue_id",
            "detectedIssueId",
            "detected_issue_id"
          ],
          ""
        )
      );

    const suggestionIssueKey =
      normalizeId(
        getValue(
          suggestion,
          ["issueKey", "issue_key"],
          ""
        )
      );

    return (
      suggestionIssueId === issueId ||
      suggestionIssueKey === issueKey
    );
  });
};

const drawIssueCard = (
  doc,
  issue,
  suggestion,
  index
) => {
  ensureSpace(doc, 360);

  const severityValue =
    getValue(
      issue,
      ["severity"],
      "medium"
    );

  const severity =
    severityStyle(severityValue);

  const cardX = PAGE_MARGIN;
  const cardWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  const startY = doc.y;
  const headerHeight = 42;
  const barWidth = 5;

  const issueType =
    getValue(
      issue,
      ["issueType", "issue_type"],
      "Usability Issue"
    );

  const frameName =
    getValue(
      issue,
      ["frameName", "frame_name"],
      "Current Design"
    );

  const layerName =
    getValue(
      issue,
      ["nodeName", "layerName", "node_name"],
      "Design element"
    );

  const nodeType =
    getValue(
      issue,
      ["nodeType", "node_type"],
      "-"
    );

  const nodeId =
    getValue(
      issue,
      ["nodeId", "node_id"],
      "-"
    );

  const issueKey =
    getValue(
      issue,
      ["issueKey", "issue_key"],
      "-"
    );

  const status =
    formatStatus(
      getValue(
        issue,
        ["status"],
        "open"
      )
    );

  const firstDetectedAt =
    formatDate(
      getValue(
        issue,
        [
          "firstDetectedAt",
          "first_detected_at",
          "createdAt",
          "created_at"
        ],
        null
      )
    );

  const lastDetectedAt =
    formatDate(
      getValue(
        issue,
        [
          "lastDetectedAt",
          "last_detected_at",
          "updatedAt",
          "updated_at"
        ],
        null
      )
    );

  const resolvedAtRaw =
    getValue(
      issue,
      ["resolvedAt", "resolved_at"],
      null
    );

  const resolvedAt =
    resolvedAtRaw
      ? formatDate(resolvedAtRaw)
      : "Not resolved yet";

  const occurrenceCount =
    formatOccurrence(
      getValue(
        issue,
        [
          "occurrenceCount",
          "occurrence_count"
        ],
        1
      )
    );

  const confidence =
    formatConfidence(
      getValue(
        issue,
        [
          "confidenceScore",
          "confidence_score"
        ],
        null
      )
    );

  const principle =
    getValue(
      issue,
      ["principle"],
      "Not specified"
    );

  const description =
    getValue(
      issue,
      ["description"],
      "A usability concern was detected."
    );

  const evidenceText =
    getValue(
      suggestion,
      [
        "evidenceSummary",
        "evidence_summary",
        "evidence"
      ],
      null
    ) ||
    getValue(
      suggestion,
      ["explanation"],
      null
    ) ||
    "ARGUS identified a deviation from the expected usability pattern.";

  const recommendation =
    getValue(
      suggestion,
      [
        "detailedSuggestion",
        "detailed_suggestion"
      ],
      null
    ) ||
    getValue(
      suggestion,
      [
        "shortSuggestion",
        "short_suggestion"
      ],
      null
    ) ||
    getValue(
      suggestion,
      ["description"],
      null
    ) ||
    "Review this element and apply a consistent usability pattern.";

  const suggestionPriority =
    humanize(
      getValue(
        suggestion,
        ["priority"],
        severityValue
      )
    );

  const fixType =
    humanize(
      getValue(
        suggestion,
        ["fixType", "fix_type"],
        "review_ui_pattern"
      )
    );

  const generatedBy =
    getValue(
      suggestion,
      ["generatedBy", "generated_by"],
      "ARGUS AI Recommendation Engine"
    );

  const generatedAt =
    formatDate(
      getValue(
        suggestion,
        [
          "generatedAt",
          "generated_at",
          "createdAt",
          "created_at"
        ],
        null
      )
    );

  doc
    .roundedRect(
      cardX,
      startY,
      cardWidth,
      headerHeight,
      6
    )
    .fill(COLORS.light);

  doc
    .rect(
      cardX,
      startY,
      barWidth,
      headerHeight
    )
    .fill(severity.text);

  const badgeCenterX =
    cardX + 22;

  const badgeCenterY =
    startY +
    headerHeight / 2;

  doc
    .circle(
      badgeCenterX,
      badgeCenterY,
      11
    )
    .fill(COLORS.accent);

  doc
    .fontSize(9)
    .fillColor(COLORS.white)
    .text(
      String(index + 1),
      badgeCenterX - 11,
      badgeCenterY - 5,
      {
        width: 22,
        align: "center"
      }
    );

  doc
    .fontSize(11)
    .fillColor(COLORS.dark)
    .text(
      issueType,
      cardX + 46,
      startY + 13,
      {
        width:
          cardWidth -
          46 -
          92
      }
    );

  drawSeverityPill(
    doc,
    severityValue,
    cardX + cardWidth - 12,
    startY + 13,
    {
      width: 78,
      align: "right"
    }
  );

  doc.y =
    startY +
    headerHeight +
    18;

  drawInfoGrid(
    doc,
    "Issue Details",
    [
      {
        label: "Frame",
        value: frameName
      },
      {
        label: "Layer",
        value: layerName
      },
      {
        label: "Layer Type",
        value: nodeType
      },
      {
        label: "Usability Principle",
        value: principle
      },
      {
        label: "Confidence",
        value: confidence
      },
      {
        label: "Status",
        value: status
      },
      {
        label: "First Detected",
        value: firstDetectedAt
      },
      {
        label: "Last Detected",
        value: lastDetectedAt
      },
      {
        label: "Resolved At",
        value: resolvedAt
      },
      {
        label: "Times Detected",
        value: occurrenceCount
      }
    ]
  );

  drawInfoGrid(
    doc,
    "Technical Reference",
    [
      {
        label: "Node ID",
        value: nodeId
      },
      {
        label: "Issue Key",
        value: issueKey
      }
    ],
    {
      background: COLORS.white,
      border: COLORS.border
    }
  );

  drawTextSection(
    doc,
    "What's wrong?",
    description
  );

  drawTextSection(
    doc,
    "Why ARGUS flagged it",
    evidenceText,
    {
      color: severity.text
    }
  );

  const recommendationTextWidth =
    cardWidth -
    40;

  const boxHeight =
    doc.heightOfString(
      recommendation,
      {
        width: recommendationTextWidth,
        lineGap: 2
      }
    ) + 58;

  ensureSpace(
    doc,
    boxHeight + 24
  );

  const boxY = doc.y;

  doc
    .roundedRect(
      cardX,
      boxY,
      cardWidth,
      boxHeight,
      6
    )
    .fill(COLORS.primaryTint);

  doc
    .rect(
      cardX,
      boxY,
      4,
      boxHeight
    )
    .fill(COLORS.accent);

  doc
    .fontSize(9.5)
    .fillColor(COLORS.primaryDark)
    .text(
      "Recommended Improvement",
      cardX + 16,
      boxY + 14
    );

  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(
      recommendation,
      cardX + 16,
      boxY + 33,
      {
        width: recommendationTextWidth,
        lineGap: 2
      }
    );

  doc.y =
    boxY +
    boxHeight +
    16;

  drawInfoGrid(
    doc,
    "AI Suggestion Details",
    [
      {
        label: "Priority",
        value: suggestionPriority
      },
      {
        label: "Fix Type",
        value: fixType
      },
      {
        label: "Generated By",
        value: generatedBy
      },
      {
        label: "Generated At",
        value: generatedAt
      }
    ],
    {
      background: COLORS.white,
      border: COLORS.border
    }
  );

  doc.moveDown(0.7);
};

const groupIssuesByFrame = (issues) => {
  const groups = new Map();

  issues.forEach((issue) => {
    const frameName =
      getValue(
        issue,
        ["frameName", "frame_name"],
        "Current Design"
      );

    if (!groups.has(frameName)) {
      groups.set(frameName, []);
    }

    groups
      .get(frameName)
      .push(issue);
  });

  return groups;
};

// ---------------------------------------------------------------------------
// Action plan
// ---------------------------------------------------------------------------
// Finish with a practical list of things the designer can work on.

const drawActionPlan = (
  doc,
  issues,
  suggestions
) => {
  doc.addPage();
  drawPageHeader(doc);

  doc
    .fontSize(15)
    .fillColor(COLORS.dark)
    .text("Recommended Action Plan");

  doc.moveDown(0.7);

  const sorted = [...issues].sort(
    (a, b) => {
      const order = {
        high: 0,
        medium: 1,
        low: 2
      };

      const aSeverity =
        String(
          getValue(
            a,
            ["severity"],
            "medium"
          )
        ).toLowerCase();

      const bSeverity =
        String(
          getValue(
            b,
            ["severity"],
            "medium"
          )
        ).toLowerCase();

      return (
        (order[aSeverity] ?? 3) -
        (order[bSeverity] ?? 3)
      );
    }
  );

  const contentWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  sorted.forEach((issue, index) => {
    const suggestion =
      findSuggestion(
        issue,
        suggestions
      );

    const severity =
      getValue(
        issue,
        ["severity"],
        "medium"
      );

    const style =
      severityStyle(severity);

    const text =
      getValue(
        suggestion,
        [
          "shortSuggestion",
          "short_suggestion"
        ],
        null
      ) ||
      getValue(
        suggestion,
        ["description"],
        null
      ) ||
      getValue(
        issue,
        ["description"],
        null
      ) ||
      "Review and resolve this usability issue.";

    const actionFrameName =
      getValue(
        issue,
        ["frameName", "frame_name"],
        "Current Design"
      );

    const actionLayerName =
      getValue(
        issue,
        ["nodeName", "layerName", "node_name"],
        "Design element"
      );

    const textWidth =
      contentWidth -
      34;

    const textHeight =
      doc.heightOfString(
        text,
        {
          width: textWidth,
          lineGap: 2
        }
      );

    const badgeText =
      `${capitalize(severity)} · Frame: ${actionFrameName} · Layer: ${actionLayerName}`;

    const badgeHeight =
      doc.heightOfString(
        badgeText.toUpperCase(),
        {
          width: textWidth,
          lineGap: 1
        }
      );

    const rowHeight =
      Math.max(
        textHeight +
          badgeHeight +
          38,
        58
      );

    ensureSpace(
      doc,
      rowHeight + 6
    );

    const rowY = doc.y;

    doc
      .circle(
        PAGE_MARGIN + 10,
        rowY + 11,
        10
      )
      .fill(style.text);

    doc
      .fontSize(9)
      .fillColor(COLORS.white)
      .text(
        String(index + 1),
        PAGE_MARGIN,
        rowY + 6,
        {
          width: 20,
          align: "center"
        }
      );

    doc
      .fontSize(9.5)
      .fillColor(COLORS.dark)
      .text(
        text,
        PAGE_MARGIN + 26,
        rowY,
        {
          width: textWidth,
          lineGap: 2
        }
      );

    doc
      .fontSize(7.5)
      .fillColor(style.text)
      .text(
        badgeText.toUpperCase(),
        PAGE_MARGIN + 26,
        rowY + textHeight + 8,
        {
          width: textWidth,
          lineGap: 1
        }
      );

    doc.y =
      rowY +
      rowHeight;
  });

  doc.moveDown(1.4);

  ensureSpace(doc, 66);

  const noteY = doc.y;
  const noteWidth = contentWidth;

  const noteText =
    "After applying the recommended improvements, run ARGUS again to verify whether the identified usability concerns have been resolved.";

  const noteHeight =
    doc.heightOfString(
      noteText,
      {
        width: noteWidth - 24,
        lineGap: 2
      }
    ) + 28;

  doc
    .roundedRect(
      PAGE_MARGIN,
      noteY,
      noteWidth,
      noteHeight,
      6
    )
    .fillAndStroke(
      COLORS.light,
      COLORS.border
    );

  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      noteText,
      PAGE_MARGIN + 12,
      noteY + 14,
      {
        width: noteWidth - 24,
        lineGap: 2
      }
    );

  doc.y =
    noteY +
    noteHeight;
};

const addPageNumbers = (doc) => {
  const range =
    doc.bufferedPageRange();

  for (
    let i = range.start;
    i < range.start + range.count;
    i++
  ) {
    doc.switchToPage(i);

    const footerY =
      doc.page.height -
      PAGE_MARGIN -
      18;

    doc.save();

    doc
      .moveTo(
        PAGE_MARGIN,
        footerY - 8
      )
      .lineTo(
        doc.page.width - PAGE_MARGIN,
        footerY - 8
      )
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        "ARGUS Usability Analysis Report",
        PAGE_MARGIN,
        footerY,
        {
          width:
            (doc.page.width -
              PAGE_MARGIN * 2) /
            2,
          lineBreak: false
        }
      )
      .text(
        `Page ${i + 1} of ${range.count}`,
        PAGE_MARGIN +
          (doc.page.width -
            PAGE_MARGIN * 2) /
            2,
        footerY,
        {
          width:
            (doc.page.width -
              PAGE_MARGIN * 2) /
            2,
          align: "right",
          lineBreak: false
        }
      );

    doc.restore();
  }
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
// Build the complete PDF and return it as a buffer for download.

const generateUsabilityReportPdf = ({
  analysis,
  session,
  issues,
  suggestions
}) => {
  return new Promise(
    (resolve, reject) => {
      const safeAnalysis =
        analysis || {};

      const safeSession =
        session || {};

      const safeIssues =
        Array.isArray(issues)
          ? issues
          : [];

      const safeSuggestions =
        Array.isArray(suggestions)
          ? suggestions
          : [];

      const doc =
        new PDFDocument({
          size: "A4",

          margin:
            PAGE_MARGIN,

          bufferPages:
            true,

          info: {
            Title:
              "ARGUS Usability Analysis Report",

            Author:
              "ARGUS"
          }
        });

      const chunks = [];

      doc.on(
        "data",
        (chunk) =>
          chunks.push(chunk)
      );

      doc.on(
        "end",
        () =>
          resolve(
            Buffer.concat(
              chunks
            )
          )
      );

      doc.on(
        "error",
        reject
      );

      const frameNames =
        getAnalyzedFrameNames(
          safeAnalysis,
          safeSession,
          safeIssues
        );

      drawCoverHeader(
        doc,
        safeAnalysis,
        safeSession,
        frameNames
      );

      doc
        .fontSize(18)
        .fillColor(
          COLORS.dark
        )
        .text(
          `${
            safeIssues.length
          } Usability Issue${
            safeIssues.length === 1
              ? ""
              : "s"
          } Detected`,
          {
            align:
              "center"
          }
        );

      const counts = {
        high:
          safeIssues.filter(
            (issue) =>
              String(
                getValue(
                  issue,
                  ["severity"],
                  ""
                )
              ).toLowerCase() ===
              "high"
          ).length,

        medium:
          safeIssues.filter(
            (issue) =>
              String(
                getValue(
                  issue,
                  ["severity"],
                  ""
                )
              ).toLowerCase() ===
              "medium"
          ).length,

        low:
          safeIssues.filter(
            (issue) =>
              String(
                getValue(
                  issue,
                  ["severity"],
                  ""
                )
              ).toLowerCase() ===
              "low"
          ).length
      };

      drawSummaryCards(
        doc,
        counts
      );

      if (
        safeIssues.length === 0
      ) {
        doc
          .fontSize(12)
          .fillColor(
            COLORS.low
          )
          .text(
            "No usability issues were detected in the analyzed design.",
            {
              align:
                "center"
            }
          );
      } else {
        drawOverview(
          doc,
          safeIssues
        );

        const grouped =
          groupIssuesByFrame(
            safeIssues
          );

        let issueNumber = 0;

        for (
          const [
            frameName,
            frameIssues
          ] of grouped.entries()
        ) {
          doc.addPage();

          drawPageHeader(
            doc
          );

          doc
            .fontSize(15)
            .fillColor(
              COLORS.dark
            )
            .text(
              frameName
            );

          doc
            .fontSize(8)
            .fillColor(
              COLORS.muted
            )
            .text(
              `${
                frameIssues.length
              } usability issue${
                frameIssues.length ===
                1
                  ? ""
                  : "s"
              } detected`
            );

          doc.moveDown(
            1.6
          );

          frameIssues.forEach(
            (issue) => {
              const suggestion =
                findSuggestion(
                  issue,
                  safeSuggestions
                );

              drawIssueCard(
                doc,
                issue,
                suggestion,
                issueNumber
              );

              issueNumber++;
            }
          );
        }

        drawActionPlan(
          doc,
          safeIssues,
          safeSuggestions
        );
      }

      addPageNumbers(
        doc
      );

      doc.end();
    }
  );
};

module.exports = {
  generateUsabilityReportPdf
};