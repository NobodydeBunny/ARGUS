const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const PAGE_MARGIN = 50;

const COLORS = {
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  primaryTint: "#EEF2FF",
  dark: "#111827",
  text: "#374151",
  muted: "#6B7280",
  light: "#F9FAFB",

  high: "#B91C1C",
  highBackground: "#FEE2E2",

  medium: "#B45309",
  mediumBackground: "#FEF3C7",

  low: "#047857",
  lowBackground: "#D1FAE5",

  border: "#E5E7EB",
  white: "#FFFFFF"
};

const logoPath = path.join(
  __dirname,
  "..",
  "assets",
  "argus_logo.jpeg"
);

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatConfidence = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Math.round(Number(value) * 100)}%`;
};

const capitalize = (value = "") => {
  if (!value) return "-";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
};

const getAnalyzedFrameNames = (
  analysis,
  session,
  issues = []
) => {
  const frameNames = [];

  /*
   * Primary source:
   * analysis.frames contains the nested metadata
   * extracted from the analyzed Figma frames.
   */
  if (Array.isArray(analysis?.frames)) {
    analysis.frames.forEach((frame) => {
      if (
        frame &&
        frame.frameName &&
        !frameNames.includes(frame.frameName)
      ) {
        frameNames.push(frame.frameName);
      }
    });
  }

  /*
   * Optional fallback:
   * If frame information is stored in the session.
   */
  if (
    frameNames.length === 0 &&
    Array.isArray(session?.frames)
  ) {
    session.frames.forEach((frame) => {
      if (
        frame &&
        frame.frameName &&
        !frameNames.includes(frame.frameName)
      ) {
        frameNames.push(frame.frameName);
      }
    });
  }

  /*
   * Final fallback:
   * Each detected issue already contains frameName,
   * so frame names can still be reconstructed even
   * if the analysis snapshot does not contain frames.
   */
  if (
    frameNames.length === 0 &&
    Array.isArray(issues)
  ) {
    issues.forEach((issue) => {
      if (
        issue &&
        issue.frameName &&
        !frameNames.includes(issue.frameName)
      ) {
        frameNames.push(issue.frameName);
      }
    });
  }

  return frameNames;
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

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

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
    doc.image(
      logoPath,
      PAGE_MARGIN,
      26,
      {
        width: 22,
        height: 22
      }
    );
  }

  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      "ARGUS  ·  Usability Analysis Report",
      PAGE_MARGIN + 30,
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

// Small rounded "pill" used for severity everywhere in the document
const drawSeverityPill = (
  doc,
  severity,
  x,
  y,
  { width = 62, align = "left" } = {}
) => {
  const style = severityStyle(severity);
  const label = `${capitalize(severity)}`;
  const pillWidth = width;
  const pillHeight = 16;
  const drawX =
    align === "right" ? x - pillWidth : x;

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

  return { x: drawX, width: pillWidth, height: pillHeight };
};

// A small colored square used as a section-heading bullet
const drawSectionLabel = (doc, label, color = COLORS.primary) => {
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

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

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
    .fill(COLORS.primaryDark);

  if (fs.existsSync(logoPath)) {
    doc.image(
      logoPath,
      PAGE_MARGIN,
      42,
      {
        width: 46,
        height: 46
      }
    );
  }

  const textX =
    fs.existsSync(logoPath)
      ? PAGE_MARGIN + 60
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
    .fillColor("#C7D2FE")
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

  /*
   * Convert the frame-name array into
   * readable report text.
   */
  const analyzedFramesText =
    Array.isArray(frameNames) &&
    frameNames.length > 0
      ? frameNames.join(", ")
      : "N/A";

  const metadataRows = [
    [
      [
        "Design",
        analysis.designName ||
          "Untitled"
      ],

      [
        "Analysis Mode",
        capitalize(
          analysis.scanMode ||
            "manual"
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
          analysis.nodeCount ||
            0
        )
      ]
    ],

    [
      [
        "Generated",
        formatDate(
          new Date()
        )
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
              value,
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
    { label: "High Priority", count: counts.high, severity: "high" },
    { label: "Medium Priority", count: counts.medium, severity: "medium" },
    { label: "Low Priority", count: counts.low, severity: "low" }
  ];

  cards.forEach((card, index) => {
    const x = startX + index * (cardWidth + gap);
    const style = severityStyle(card.severity);

    doc
      .roundedRect(x, y, cardWidth, cardHeight, 8)
      .fill(style.background);

    doc
      .roundedRect(x, y, cardWidth, 4, 2)
      .fill(style.text);

    doc
      .fontSize(24)
      .fillColor(style.text)
      .text(String(card.count), x, y + 16, {
        width: cardWidth,
        align: "center"
      });

    doc
      .fontSize(8.5)
      .fillColor(style.text)
      .text(card.label.toUpperCase(), x, y + 46, {
        width: cardWidth,
        align: "center"
      });
  });

  doc.y = y + cardHeight + 42;
};

// ---------------------------------------------------------------------------
// "Issues at a Glance" table
// ---------------------------------------------------------------------------

const drawOverview = (
  doc,
  issues
) => {
  ensureSpace(doc, 120);

  doc
    .fontSize(14)
    .fillColor(COLORS.dark)
    .text("Issues at a Glance", PAGE_MARGIN, doc.y);

  doc.moveDown(1);

  const tableX = PAGE_MARGIN;
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const columns = {
    index: { x: tableX + 8, width: 24 },
    type: { x: tableX + 36, width: 230 },
    element: { x: tableX + 270, width: 130 },
    severity: { x: tableX + tableWidth - 70, width: 62 }
  };

  const headerY = doc.y;
  const headerHeight = 26;

  doc
    .rect(tableX, headerY, tableWidth, headerHeight)
    .fill(COLORS.light);

  doc
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text("#", columns.index.x, headerY + 9, { width: columns.index.width })
    .text("ISSUE TYPE", columns.type.x, headerY + 9, { width: columns.type.width })
    .text("ELEMENT", columns.element.x, headerY + 9, { width: columns.element.width })
    .text("SEVERITY", columns.severity.x, headerY + 9, {
      width: columns.severity.width,
      align: "right"
    });

  doc.y = headerY + headerHeight;

  issues.forEach((issue, index) => {
    ensureSpace(doc, 36);

    const rowHeight = 32;
    const rowY = doc.y;

    if (index % 2 === 1) {
      doc.rect(tableX, rowY, tableWidth, rowHeight).fill(COLORS.light);
    }

    doc
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(String(index + 1).padStart(2, "0"), columns.index.x, rowY + 10, {
        width: columns.index.width
      });

    doc
      .fillColor(COLORS.dark)
      .text(issue.issueType || "Usability Issue", columns.type.x, rowY + 10, {
        width: columns.type.width,
        ellipsis: true
      });

    doc
      .fillColor(COLORS.muted)
      .text(issue.nodeName || "Design element", columns.element.x, rowY + 10, {
        width: columns.element.width,
        ellipsis: true
      });

    drawSeverityPill(
      doc,
      issue.severity,
      columns.severity.x + columns.severity.width,
      rowY + 8,
      { width: 62, align: "right" }
    );

    doc
      .moveTo(tableX, rowY + rowHeight)
      .lineTo(tableX + tableWidth, rowY + rowHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    doc.y = rowY + rowHeight;
  });

  doc.moveDown(1.6);
};

// ---------------------------------------------------------------------------
// Individual issue detail cards
// ---------------------------------------------------------------------------

const findSuggestion = (
  issue,
  suggestions
) => {
  return suggestions.find(
    (suggestion) =>
      String(suggestion.issueId) ===
      String(issue._id)
  );
};

const drawMetaField = (doc, x, y, width, label, value) => {
  doc
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(label.toUpperCase(), x, y, { width });

  doc
    .fontSize(9)
    .fillColor(COLORS.dark)
    .text(value, x, y + 11, { width });
};

const drawIssueCard = (
  doc,
  issue,
  suggestion,
  index
) => {
  ensureSpace(doc, 300);

  const severity = severityStyle(issue.severity);
  const cardX = PAGE_MARGIN;
  const cardWidth = doc.page.width - PAGE_MARGIN * 2;
  const startY = doc.y;
  const headerHeight = 38;
  const barWidth = 5;

  // Card header strip
  doc
    .roundedRect(cardX, startY, cardWidth, headerHeight, 5)
    .fill(COLORS.light);

  // Numbered badge
  const badgeCenterX = cardX + 20;
  const badgeCenterY = startY + headerHeight / 2;

  doc
    .circle(badgeCenterX, badgeCenterY, 11)
    .fill(COLORS.primary);

  doc
    .fontSize(9)
    .fillColor(COLORS.white)
    .text(String(index + 1), badgeCenterX - 11, badgeCenterY - 5, {
      width: 22,
      align: "center"
    });

  doc
    .fontSize(11)
    .fillColor(COLORS.dark)
    .text(
      issue.issueType || "Usability Issue",
      cardX + 42,
      startY + 12,
      { width: cardWidth - 42 - 90 }
    );

  drawSeverityPill(
    doc,
    issue.severity,
    cardX + cardWidth - 12,
    startY + 11,
    { width: 78, align: "right" }
  );

  doc.y = startY + headerHeight + 20;

  // Left accent bar spanning the metadata + body area, drawn after we know
  // where the card ends (see below) — placeholder color rect drawn now at
  // the header only keeps things simple and avoids a second height pass.
  doc
    .rect(cardX, startY, barWidth, headerHeight)
    .fill(severity.text);

  // Metadata grid: Frame / Element on one row, Principle / Confidence below
  const metaColWidth = (cardWidth - 24) / 2;
  const metaX1 = cardX + 12;
  const metaX2 = cardX + 12 + metaColWidth + 12;
  const metaRowY1 = doc.y;

  drawMetaField(
    doc,
    metaX1,
    metaRowY1,
    metaColWidth,
    "Frame",
    issue.frameName || "-"
  );

  drawMetaField(
    doc,
    metaX2,
    metaRowY1,
    metaColWidth,
    "Element",
    issue.nodeName || "Design element"
  );

  const metaRowY2 = metaRowY1 + 30;

  drawMetaField(
    doc,
    metaX1,
    metaRowY2,
    metaColWidth,
    "Usability Principle",
    issue.principle || "Not specified"
  );

  drawMetaField(
    doc,
    metaX2,
    metaRowY2,
    metaColWidth,
    "Confidence",
    formatConfidence(issue.confidenceScore)
  );

  doc.y = metaRowY2 + 38;

  doc.x = PAGE_MARGIN;
  drawSectionLabel(doc, "What's wrong?");

  doc.y += 4;

  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(
      issue.description || "A usability concern was detected.",
      PAGE_MARGIN + 12,
      doc.y,
      { width: cardWidth - 12, lineGap: 2 }
    );

  doc.moveDown(1.1);

  doc.x = PAGE_MARGIN;
  drawSectionLabel(doc, "Evidence");

  doc.y += 4;

  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(
      suggestion?.evidenceSummary ||
        suggestion?.explanation ||
        "ARGUS identified a deviation from the expected usability pattern.",
      PAGE_MARGIN + 12,
      doc.y,
      { width: cardWidth - 12, lineGap: 2 }
    );

  doc.moveDown(1.3);

  const recommendation =
    suggestion?.detailedSuggestion ||
    suggestion?.shortSuggestion ||
    suggestion?.description ||
    "Review this element and apply a consistent usability pattern.";

  const recommendationTextWidth = cardWidth - 24 - 12;

  const boxHeight =
    doc.heightOfString(recommendation, {
      width: recommendationTextWidth,
      lineGap: 2
    }) + 54;

  ensureSpace(doc, boxHeight + 20);

  const boxY = doc.y;

  doc
    .roundedRect(cardX, boxY, cardWidth, boxHeight, 6)
    .fill(COLORS.primaryTint);

  doc
    .rect(cardX, boxY, 3, boxHeight)
    .fill(COLORS.primary);

  doc
    .fontSize(9)
    .fillColor(COLORS.primaryDark)
    .text("Recommended Improvement", cardX + 16, boxY + 14);

  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(recommendation, cardX + 16, boxY + 31, {
      width: recommendationTextWidth,
      lineGap: 2
    });

  doc.y = boxY + boxHeight + 34;
};

const groupIssuesByFrame = (issues) => {
  const groups = new Map();

  issues.forEach((issue) => {
    const frameName =
      issue.frameName ||
      "Current Design";

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

      return (
        (order[a.severity] ?? 3) -
        (order[b.severity] ?? 3)
      );
    }
  );

  const contentWidth = doc.page.width - PAGE_MARGIN * 2;

  sorted.forEach((issue, index) => {
    const suggestion = findSuggestion(issue, suggestions);
    const style = severityStyle(issue.severity);

    const text =
      suggestion?.shortSuggestion ||
      suggestion?.description ||
      issue.description ||
      "Review and resolve this usability issue.";

    const textWidth = contentWidth - 34;
    const textHeight = doc.heightOfString(text, { width: textWidth, lineGap: 2 });
    const rowHeight = Math.max(textHeight + 34, 48);

    ensureSpace(doc, rowHeight + 6);

    const rowY = doc.y;

    doc
      .circle(PAGE_MARGIN + 10, rowY + 11, 10)
      .fill(style.text);

    doc
      .fontSize(9)
      .fillColor(COLORS.white)
      .text(String(index + 1), PAGE_MARGIN, rowY + 6, {
        width: 20,
        align: "center"
      });

    doc
      .fontSize(9.5)
      .fillColor(COLORS.dark)
      .text(text, PAGE_MARGIN + 26, rowY, { width: textWidth, lineGap: 2 });

    const badgeText = issue.frameName
      ? `${capitalize(issue.severity)} · ${issue.frameName}`
      : capitalize(issue.severity);

    doc
      .fontSize(7.5)
      .fillColor(style.text)
      .text(badgeText.toUpperCase(), PAGE_MARGIN + 26, rowY + textHeight + 8, {
        width: textWidth
      });

    doc.y = rowY + rowHeight;
  });

  doc.moveDown(1.4);

  ensureSpace(doc, 66);

  const noteY = doc.y;
  const noteWidth = contentWidth;
  const noteText =
    "After applying the recommended improvements, run ARGUS again to verify whether the identified usability concerns have been resolved.";
  const noteHeight = doc.heightOfString(noteText, { width: noteWidth - 24, lineGap: 2 }) + 28;

  doc
    .roundedRect(PAGE_MARGIN, noteY, noteWidth, noteHeight, 6)
    .fillAndStroke(COLORS.light, COLORS.border);

  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(noteText, PAGE_MARGIN + 12, noteY + 14, {
      width: noteWidth - 24,
      lineGap: 2
    });

  doc.y = noteY + noteHeight;
};

const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();

  for (
    let i = range.start;
    i < range.start + range.count;
    i++
  ) {
    doc.switchToPage(i);

    const footerY = doc.page.height - PAGE_MARGIN - 18;

    doc.save();

    doc
      .moveTo(PAGE_MARGIN, footerY - 8)
      .lineTo(doc.page.width - PAGE_MARGIN, footerY - 8)
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
          width: (doc.page.width - PAGE_MARGIN * 2) / 2,
          lineBreak: false
        }
      )
      .text(
        `Page ${i + 1} of ${range.count}`,
        PAGE_MARGIN + (doc.page.width - PAGE_MARGIN * 2) / 2,
        footerY,
        {
          width: (doc.page.width - PAGE_MARGIN * 2) / 2,
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

const generateUsabilityReportPdf = ({
  analysis,
  session,
  issues,
  suggestions
}) => {
  return new Promise(
    (resolve, reject) => {
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

      /*
       * ---------------------------------------------------
       * Extract analyzed frame names
       * ---------------------------------------------------
       */

      const frameNames =
        getAnalyzedFrameNames(
          analysis,
          session,
          issues
        );

      /*
       * The cover now receives actual frame names
       * instead of analysis.frameCount.
       */
      drawCoverHeader(
        doc,
        analysis,
        session,
        frameNames
      );

      /*
       * ---------------------------------------------------
       * Overall issue count
       * ---------------------------------------------------
       */

      doc
        .fontSize(18)
        .fillColor(
          COLORS.dark
        )
        .text(
          `${
            issues.length
          } Usability Issue${
            issues.length === 1
              ? ""
              : "s"
          } Detected`,
          {
            align:
              "center"
          }
        );

      /*
       * ---------------------------------------------------
       * Severity counts
       * ---------------------------------------------------
       */

      const counts = {
        high:
          issues.filter(
            (issue) =>
              issue.severity ===
              "high"
          ).length,

        medium:
          issues.filter(
            (issue) =>
              issue.severity ===
              "medium"
          ).length,

        low:
          issues.filter(
            (issue) =>
              issue.severity ===
              "low"
          ).length
      };

      drawSummaryCards(
        doc,
        counts
      );

      /*
       * ---------------------------------------------------
       * No-issue condition
       * ---------------------------------------------------
       */

      if (
        issues.length === 0
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
        /*
         * -------------------------------------------------
         * Issues at a Glance
         * -------------------------------------------------
         */

        drawOverview(
          doc,
          issues
        );

        /*
         * -------------------------------------------------
         * Group detected issues by originating frame
         * -------------------------------------------------
         */

        const grouped =
          groupIssuesByFrame(
            issues
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
                  suggestions
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

        /*
         * -------------------------------------------------
         * Recommended action plan
         * -------------------------------------------------
         */

        drawActionPlan(
          doc,
          issues,
          suggestions
        );
      }

      /*
       * ---------------------------------------------------
       * Footer + page numbering
       * ---------------------------------------------------
       */

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