const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeText = (value, fallback = "this element") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const roundNumber = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(digits));
};

const normalizeRgb = (color) => {
  if (!color) return null;

  if (typeof color === "string") {
    const hex = color.trim().replace("#", "");
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
  }

  if (typeof color === "object") {
    const r = Number(color.r);
    const g = Number(color.g);
    const b = Number(color.b);

    if ([r, g, b].every(Number.isFinite)) {
      return {
        r: clamp(Math.round(r), 0, 255),
        g: clamp(Math.round(g), 0, 255),
        b: clamp(Math.round(b), 0, 255)
      };
    }
  }

  return null;
};

const rgbToHex = (color) => {
  const rgb = normalizeRgb(color);
  if (!rgb) return null;

  return `#${[rgb.r, rgb.g, rgb.b]
    .map(channel => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
};

const colorDistance = (firstColor, secondColor) => {
  const first = normalizeRgb(firstColor);
  const second = normalizeRgb(secondColor);
  if (!first || !second) return Number.POSITIVE_INFINITY;

  return Math.sqrt(
    Math.pow(first.r - second.r, 2) +
    Math.pow(first.g - second.g, 2) +
    Math.pow(first.b - second.b, 2)
  );
};

const namedColors = [
  { name: "red", rgb: { r: 220, g: 40, b: 40 } },
  { name: "blue", rgb: { r: 30, g: 110, b: 240 } },
  { name: "green", rgb: { r: 30, g: 160, b: 100 } },
  { name: "orange", rgb: { r: 245, g: 130, b: 20 } },
  { name: "yellow", rgb: { r: 245, g: 200, b: 30 } },
  { name: "purple", rgb: { r: 135, g: 70, b: 200 } },
  { name: "black", rgb: { r: 10, g: 10, b: 10 } },
  { name: "white", rgb: { r: 250, g: 250, b: 250 } },
  { name: "gray", rgb: { r: 130, g: 130, b: 130 } }
];

const getReadableColorName = (color) => {
  const rgb = normalizeRgb(color);
  const hex = rgbToHex(color);

  if (!rgb) return "unknown color";

  const nearest = namedColors
    .map(item => ({ ...item, distance: colorDistance(rgb, item.rgb) }))
    .sort((first, second) => first.distance - second.distance)[0];

  if (!nearest || nearest.distance > 95) {
    return hex || "custom color";
  }

  return nearest.name;
};

const describeColor = (color) => {
  const hex = rgbToHex(color);
  const name = getReadableColorName(color);
  return hex ? `${name} (${hex})` : name;
};

const sentenceJoin = (parts) => parts.filter(Boolean).join(" ");

const createFeedback = ({ shortSuggestion, detailedSuggestion, explanation, evidenceSummary }) => ({
  shortSuggestion,
  detailedSuggestion,
  explanation,
  evidenceSummary,
  recommendation: detailedSuggestion || shortSuggestion
});

const buildColorInconsistencyFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName);
  const actionType = evidence.actionType ? ` for the "${evidence.actionType}" action` : "";

  const actualColor = evidence.actualColor || evidence.actualColorRgb || evidence.nodeColor || evidence.outlierColor || evidence.currentColor;
  const expectedColor = evidence.expectedColor || evidence.expectedColorRgb || evidence.themeColor || evidence.dominantColor || evidence.referenceColor;

  const actualDescription = describeColor(actualColor);
  const expectedDescription = describeColor(expectedColor);
  const similarCount = evidence.similarElementsCount || evidence.matchingThemeElements || evidence.referenceElementCount;

  return createFeedback({
    shortSuggestion: `Change ${nodeName} from ${actualDescription} to ${expectedDescription}.`,
    detailedSuggestion: sentenceJoin([
      `${nodeName}${actionType} uses ${actualDescription}, but the dominant visual pattern in this design uses ${expectedDescription}.`,
      `This breaks color consistency and can make the element look like it belongs to a different theme or action group.`,
      `Update ${nodeName} to ${expectedDescription} so it follows the established UI color pattern.`
    ]),
    explanation: similarCount
      ? `Argus compared this node with ${similarCount} similar or theme-related element(s) and found that its color is an outlier.`
      : "Argus detected that this node color is different from the dominant color pattern used in the selected design.",
    evidenceSummary: `Actual color: ${actualDescription}. Expected color: ${expectedDescription}.`
  });
};

const buildSameColorDifferentActionsFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName);
  const sharedColor = describeColor(evidence.sharedColor || evidence.actualColor || evidence.nodeColor);
  const firstAction = evidence.firstAction || evidence.actionA || "one action";
  const secondAction = evidence.secondAction || evidence.actionB || "another action";

  return createFeedback({
    shortSuggestion: `Use a different color for ${nodeName} to separate action meanings.`,
    detailedSuggestion: `${nodeName} shares ${sharedColor} with different actions such as "${firstAction}" and "${secondAction}". Users may misunderstand which action is primary, secondary, cancel, or destructive. Assign different colors or button styles to actions with different meanings.`,
    explanation: "Argus found that multiple action types are visually represented with the same or nearly same color.",
    evidenceSummary: `Shared color: ${sharedColor}. Actions found: ${firstAction}, ${secondAction}.`
  });
};

const buildErrorVisibilityFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this error message");
  const ratio = roundNumber(evidence.errorContrastRatio || evidence.contrastRatio, 2);
  const foreground = describeColor(evidence.foregroundColor || evidence.actualColor || evidence.nodeColor);
  const background = describeColor(evidence.backgroundColor);

  return createFeedback({
    shortSuggestion: `Make ${nodeName} easier to notice and read.`,
    detailedSuggestion: ratio
      ? `${nodeName} has a contrast ratio of ${ratio}, which may be too low for clear error visibility. Use a stronger error color, increase contrast against the background, and add clear styling such as an icon, border, or helper text.`
      : `${nodeName} does not stand out clearly from the surrounding interface. Use a stronger error color, clearer contrast, and supportive styling such as an icon, border, or helper text.`,
    explanation: "Argus checked error-related text, icon, or warning metadata against its surrounding background and detected weak visibility.",
    evidenceSummary: ratio
      ? `Contrast ratio: ${ratio}. Foreground: ${foreground}. Background: ${background}.`
      : `Foreground: ${foreground}. Background: ${background}.`
  });
};

const buildPoorErrorStyleFeedback = (issue) => {
  const nodeName = safeText(issue.nodeName, "this error state");

  return createFeedback({
    shortSuggestion: `Style ${nodeName} as a clear error state.`,
    detailedSuggestion: `${nodeName} appears to be related to an error or validation state, but the metadata does not show a strong error style. Use an error color, validation icon, border highlight, and short helper text so users can immediately recognize the problem and recover from it.`,
    explanation: "Argus detected error-related wording but did not find enough visual styling evidence to make the error state clearly noticeable.",
    evidenceSummary: "Expected error-state evidence: distinct color, icon, border, or clear validation wording."
  });
};

const buildSpacingFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this layout group");
  const actual = roundNumber(evidence.actualSpacing || evidence.outlierSpacing || evidence.maxSpacingGap, 1);
  const expected = roundNumber(evidence.expectedSpacing || evidence.averageSpacing || evidence.referenceSpacing, 1);

  return createFeedback({
    shortSuggestion: `Adjust the spacing around ${nodeName}.`,
    detailedSuggestion: actual !== null && expected !== null
      ? `${nodeName} uses about ${actual}px spacing, while related elements use around ${expected}px. This creates an uneven layout rhythm. Change the spacing to approximately ${expected}px or align it with your design system spacing scale.`
      : `${nodeName} has spacing that differs from related elements. Adjust the gap so similar labels, inputs, cards, or buttons use a consistent spacing pattern.`,
    explanation: "Argus compared spacing values between repeated or nearby UI elements and found a significant deviation.",
    evidenceSummary: actual !== null && expected !== null
      ? `Actual spacing: ${actual}px. Expected spacing: ${expected}px.`
      : "Spacing deviation detected among related elements."
  });
};

const buildButtonShapeFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this button");
  const actualRadius = roundNumber(evidence.actualCornerRadius || evidence.outlierCornerRadius, 1);
  const expectedRadius = roundNumber(evidence.expectedCornerRadius || evidence.averageCornerRadius || evidence.referenceCornerRadius, 1);
  const actualHeight = roundNumber(evidence.actualHeight || evidence.outlierHeight, 1);
  const expectedHeight = roundNumber(evidence.expectedHeight || evidence.averageHeight || evidence.referenceHeight, 1);

  const radiusText = actualRadius !== null && expectedRadius !== null
    ? ` Its corner radius is ${actualRadius}px while similar buttons use about ${expectedRadius}px.`
    : "";

  const heightText = actualHeight !== null && expectedHeight !== null
    ? ` Its height is ${actualHeight}px while similar buttons use about ${expectedHeight}px.`
    : "";

  return createFeedback({
    shortSuggestion: `Make ${nodeName} match the common button style.`,
    detailedSuggestion: `${nodeName} has a different shape from similar buttons.${radiusText}${heightText} Match its corner radius, height, width, and proportions with the repeated button pattern in this design.`,
    explanation: "Argus compared button metadata such as corner radius, height, width, and proportions across similar button-like elements.",
    evidenceSummary: sentenceJoin([radiusText.trim(), heightText.trim()]) || "Button shape deviation detected."
  });
};

const buildAlignmentFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName);
  const actualX = roundNumber(evidence.actualX || evidence.outlierX, 1);
  const expectedX = roundNumber(evidence.expectedX || evidence.referenceX, 1);
  const misalignedCount = evidence.misalignedElementCount;

  return createFeedback({
    shortSuggestion: `Align ${nodeName} with the related elements.`,
    detailedSuggestion: actualX !== null && expectedX !== null
      ? `${nodeName} is positioned around x=${actualX}, while the related alignment group is around x=${expectedX}. Move it closer to x=${expectedX} so the layout follows the same visual edge or grid line.`
      : `${nodeName} is not aligned with related UI elements. Reposition it to follow the same visual edge, column, or grid line used by nearby elements.`,
    explanation: misalignedCount
      ? `Argus detected ${misalignedCount} element(s) that deviate from the common alignment group.`
      : "Argus compared x-position metadata and found that this element deviates from the common alignment group.",
    evidenceSummary: actualX !== null && expectedX !== null
      ? `Actual x-position: ${actualX}. Expected x-position: ${expectedX}.`
      : "Alignment deviation detected."
  });
};

const buildOverloadedScreenFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this screen");
  const totalElements = evidence.nodeCount || evidence.totalElements || evidence.childCount;
  const interactiveCount = evidence.interactiveElementCount;
  const density = roundNumber(evidence.controlDensity, 2);

  return createFeedback({
    shortSuggestion: `Reduce visual overload in ${nodeName}.`,
    detailedSuggestion: `${nodeName} contains many UI elements${totalElements ? ` (${totalElements} nodes)` : ""}${interactiveCount ? ` including ${interactiveCount} interactive controls` : ""}. This can increase cognitive load and make the screen harder to scan. Group related controls, remove unnecessary elements, improve hierarchy, or split complex content into separate sections.`,
    explanation: "Argus measured element count, interactive control count, and density to detect a possible overloaded screen.",
    evidenceSummary: density !== null
      ? `Control density score: ${density}.`
      : `Element count: ${totalElements || "high"}.`
  });
};

const buildMissingExitFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this modal or screen");
  const isModal = Number(evidence.isModalLike || evidence.modalConfidence || 0) > 0;

  return createFeedback({
    shortSuggestion: `Add a visible Close, Cancel, or Back control to ${nodeName}.`,
    detailedSuggestion: `${nodeName}${isModal ? " appears to behave like a modal/dialog" : " is part of a user flow"}, but Argus did not detect a clear way to exit safely. Add a visible Close, Cancel, Back, or Dismiss control so users can leave the flow without feeling trapped.`,
    explanation: "Argus scanned the frame and its child nodes for standard exit controls such as Close, Cancel, Back, X, or Dismiss.",
    evidenceSummary: "Exit control detected: no."
  });
};

const buildDestructiveFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this destructive action");
  const actionText = evidence.destructiveActionText || evidence.actionType || nodeName;

  return createFeedback({
    shortSuggestion: `Add Undo or recovery support for ${nodeName}.`,
    detailedSuggestion: `${nodeName} appears to perform a destructive action${actionText ? ` such as "${actionText}"` : ""}, but Argus did not detect an Undo, Restore, or recovery option. Add an Undo message, restore option, or temporary recovery path so users can correct accidental actions.`,
    explanation: "Argus detected destructive wording such as Delete, Remove, Reset, Discard, or Clear and checked whether a recovery option was visible.",
    evidenceSummary: "Destructive action detected: yes. Undo/recovery detected: no."
  });
};

const buildConfirmationFeedback = (issue) => {
  const evidence = issue.evidence || {};
  const nodeName = safeText(issue.nodeName, "this irreversible action");
  const actionText = evidence.destructiveActionText || evidence.actionType || nodeName;

  return createFeedback({
    shortSuggestion: `Add a confirmation step before ${nodeName}.`,
    detailedSuggestion: `${nodeName} may trigger an irreversible or high-risk action${actionText ? ` such as "${actionText}"` : ""}, but Argus did not detect a confirmation dialog. Add a confirmation step with clear Cancel and Confirm options before the action is completed.`,
    explanation: "Argus looked for confirmation wording or modal/dialog controls near destructive or irreversible actions.",
    evidenceSummary: "Confirmation dialog detected: no."
  });
};

const buildFallbackFeedback = (issue) => {
  const nodeName = safeText(issue.nodeName);

  return createFeedback({
    shortSuggestion: `Review ${nodeName}.`,
    detailedSuggestion: `${nodeName} does not follow the expected UI pattern detected in the selected design metadata. Review the element and adjust it to match the surrounding layout, color, interaction, or error-handling pattern.`,
    explanation: "Argus detected a possible issue but did not receive enough evidence for a more specific recommendation.",
    evidenceSummary: "Manual review recommended."
  });
};

const normalizeLabel = (issue) => {
  const label = issue.issueLabel || issue.candidateType || issue.type || issue.recommendationCategory || "review_ui_pattern";
  return String(label).toLowerCase().replace(/\s+/g, "_");
};

const generateDynamicSuggestion = (issue) => {
  const label = normalizeLabel(issue);

  let feedback;

  switch (label) {
    case "color_inconsistency":
    case "same_action_uses_different_colors":
      feedback = buildColorInconsistencyFeedback(issue);
      break;

    case "same_color_different_actions":
    case "different_actions_use_the_same_color":
      feedback = buildSameColorDifferentActionsFeedback(issue);
      break;

    case "weak_error_visibility":
    case "low_contrast_error_message":
      feedback = buildErrorVisibilityFeedback(issue);
      break;

    case "poor_error_state_styling":
      feedback = buildPoorErrorStyleFeedback(issue);
      break;

    case "spacing_inconsistency":
      feedback = buildSpacingFeedback(issue);
      break;

    case "button_shape_inconsistency":
      feedback = buildButtonShapeFeedback(issue);
      break;

    case "alignment_inconsistency":
      feedback = buildAlignmentFeedback(issue);
      break;

    case "overloaded_screen":
      feedback = buildOverloadedScreenFeedback(issue);
      break;

    case "modal_without_exit":
    case "missing_exit_control":
      feedback = buildMissingExitFeedback(issue);
      break;

    case "destructive_without_undo":
      feedback = buildDestructiveFeedback(issue);
      break;

    case "irreversible_without_confirmation":
      feedback = buildConfirmationFeedback(issue);
      break;

    default:
      feedback = buildFallbackFeedback(issue);
      break;
  }

  return {
    ...issue,
    ...feedback,
    
    generatedBy: "Argus Dynamic AI Feedback Generator v1.0"
  };
};

const generateDynamicSuggestions = (issues) => issues.map(generateDynamicSuggestion);

module.exports = {
  generateDynamicSuggestion,
  generateDynamicSuggestions,
  rgbToHex,
  getReadableColorName,
  describeColor
};
