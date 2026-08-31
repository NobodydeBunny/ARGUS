import argparse
import json
import math
import os
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

FEATURE_COLUMNS = [
    "nodeCount", "screenWidth", "screenHeight", "screenArea",
    "isModalLike", "modalConfidence", "hasExitControl", "hasDestructiveAction",
    "hasUndoOption", "hasConfirmationDialog", "interactiveElementCount", "textElementCount",
    "errorElementCount", "buttonCount", "inputCount", "controlDensity", "textDensity",
    "averageSpacing", "spacingDeviation", "maxSpacingGap", "alignmentDeviation",
    "misalignedElementCount", "cornerRadiusDeviation", "buttonHeightDeviation",
    "buttonWidthDeviation", "buttonAspectRatioDeviation", "colorCount", "actionColorCount",
    "sameActionColorDeviation", "differentActionSameColorScore", "colorPatternDeviation",
    "errorContrastRatio", "errorVisibilityScore", "backgroundContrastAverage",
    "destructiveActionCount", "confirmationControlCount", "layoutGroupSize", "overlayPresent",
    "module_layout", "module_color", "module_error", "module_normal"
]

EXIT_KEYWORDS = ["close", "cancel", "back", "exit", "dismiss", "x", "return", "go back"]
MODAL_KEYWORDS = ["modal", "dialog", "popup", "overlay", "confirmation", "confirm", "alert"]
BUTTON_HINTS = ["button", "btn", "submit", "save", "continue", "next", "cancel", "delete", "remove", "reset", "confirm", "login", "register", "create", "restore", "apply"]
DESTRUCTIVE_KEYWORDS = ["delete", "remove", "discard", "reset", "erase", "clear", "deactivate", "disable", "logout", "sign out", "permanent", "destroy"]
CONFIRMATION_KEYWORDS = ["confirm", "confirmation", "are you sure", "warning", "cannot be undone", "proceed"]
UNDO_KEYWORDS = ["undo", "restore", "recover", "revert", "back up", "rollback"]
ERROR_KEYWORDS = ["error", "invalid", "wrong", "required", "failed", "failure", "warning", "try again", "danger", "alert", "not allowed"]
ACTION_KEYWORDS = ["login", "register", "submit", "save", "continue", "next", "confirm", "delete", "remove", "reset", "cancel", "restore", "apply", "update", "create", "send", "pay"]

LABEL_MAP = {
    "normal": "no_issue",
    "missing_exit": "missing_exit_control",
    "missing_undo": "destructive_without_undo",
    "missing_confirmation": "irreversible_without_confirmation"
}

SUGGESTION_MAP = {
    "no_issue": "no_action_needed",
    "missing_exit_control": "add_back_cancel_or_close",
    "spacing_inconsistency": "standardize_spacing",
    "button_shape_inconsistency": "standardize_component_shape",
    "alignment_inconsistency": "align_to_common_layout_pattern",
    "overloaded_screen": "reduce_density_and_group_controls",
    "color_inconsistency": "standardize_action_color",
    "same_color_different_actions": "differentiate_action_colors",
    "weak_error_visibility": "improve_error_state_visibility",
    "destructive_without_undo": "add_undo_or_recovery_option",
    "irreversible_without_confirmation": "add_confirmation_step"
}


def norm(value):
    return str(value or "").lower().strip()


def label(node):
    return f"{norm(node.get('name'))} {norm(node.get('text'))} {norm(node.get('iconName'))}"


def includes_any(text, keywords):
    text = norm(text)
    return any(keyword in text for keyword in keywords)


def number(value):
    try:
        if value is None:
            return 0.0
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return 0.0
        return result
    except Exception:
        return 0.0


def fill_color(node):
    color = node.get("fillColor")
    if isinstance(color, dict) and "r" in color:
        return {"r": round(number(color.get("r"))), "g": round(number(color.get("g"))), "b": round(number(color.get("b")))}
    fills = node.get("fills")
    if isinstance(fills, list):
        for fill in fills:
            if isinstance(fill, dict) and fill.get("type") == "SOLID" and fill.get("visible", True) is not False and isinstance(fill.get("color"), dict):
                c = fill["color"]
                return {"r": round(number(c.get("r")) * 255), "g": round(number(c.get("g")) * 255), "b": round(number(c.get("b")) * 255)}
    return None


def color_distance(a, b):
    if not a or not b:
        return 0.0
    return math.sqrt((number(a.get("r")) - number(b.get("r"))) ** 2 + (number(a.get("g")) - number(b.get("g"))) ** 2 + (number(a.get("b")) - number(b.get("b"))) ** 2)


def color_bucket(color, bucket_size=16):
    if not color:
        return None
    return tuple(round(number(color.get(k)) / bucket_size) * bucket_size for k in ("r", "g", "b"))


def exact_color_key(color):
    if not color:
        return None
    return tuple(round(number(color.get(k))) for k in ("r", "g", "b"))


def luminance(color):
    if not color:
        return 0.0
    vals = []
    for key in ("r", "g", "b"):
        channel = number(color.get(key)) / 255.0
        vals.append(channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2]


def contrast_ratio(foreground, background):
    if not foreground or not background:
        return 0.0
    l1, l2 = luminance(foreground), luminance(background)
    lighter, darker = max(l1, l2), min(l1, l2)
    return round((lighter + 0.05) / (darker + 0.05), 2)


def is_frame_like(node):
    return str(node.get("type", "")).upper() in {"FRAME", "GROUP", "COMPONENT", "INSTANCE", "MODAL", "OVERLAY"}


def is_button_like(node):
    node_type = str(node.get("type", "")).upper()
    text = label(node)
    return node_type in {"BUTTON", "RECTANGLE", "INSTANCE", "COMPONENT"} or "button" in norm(node.get("componentId")) or "button" in norm(node.get("mainComponentId")) or any(k in text for k in BUTTON_HINTS)


def is_input_like(node):
    node_type = str(node.get("type", "")).upper()
    text = label(node)
    return node_type == "INPUT" or "input" in norm(node.get("componentId")) or "input" in text or "field" in text


def action_type(node):
    text = label(node)
    for keyword in ACTION_KEYWORDS:
        if keyword in text:
            return keyword
    return None


def is_action_node(node):
    return action_type(node) is not None


def is_exit_node(node):
    return node.get("hasCloseButton") is True or includes_any(label(node), EXIT_KEYWORDS)


def is_destructive_node(node):
    return includes_any(label(node), DESTRUCTIVE_KEYWORDS)


def is_confirmation_node(node):
    return includes_any(label(node), CONFIRMATION_KEYWORDS)


def is_undo_node(node):
    return includes_any(label(node), UNDO_KEYWORDS)


def is_error_node(node):
    return includes_any(label(node), ERROR_KEYWORDS)


def children(node, nodes):
    return [child for child in nodes if child.get("parentId") == node.get("nodeId")]


def is_modal_like(node, nodes):
    text = label(node)
    node_type = str(node.get("type", "")).upper()
    child_nodes = children(node, nodes)
    width, height = number(node.get("width")), number(node.get("height"))
    has_modal_name = includes_any(text, MODAL_KEYWORDS)
    has_overlay = node.get("overlay") is True or "overlay" in text or any("overlay" in label(child) for child in child_nodes)
    has_confirmation_content = any(is_confirmation_node(child) or is_destructive_node(child) for child in child_nodes)
    size_looks_dialog = width > 180 and height > 120 and width <= 650 and height <= 520
    return node_type == "MODAL" or has_modal_name or (is_frame_like(node) and size_looks_dialog and (has_overlay or has_confirmation_content))


def average(values):
    vals = [number(v) for v in values if number(v) or number(v) == 0]
    return sum(vals) / len(vals) if vals else 0.0


def std(values):
    vals = [number(v) for v in values]
    if len(vals) <= 1:
        return 0.0
    mean = average(vals)
    return math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))


def rng(values):
    vals = [number(v) for v in values]
    return max(vals) - min(vals) if len(vals) > 1 else 0.0


def vertical_gaps(nodes):
    sorted_nodes = sorted([node for node in nodes if node.get("y") is not None and node.get("height") is not None], key=lambda n: number(n.get("y")))
    gaps = []
    for i in range(1, len(sorted_nodes)):
        previous_bottom = number(sorted_nodes[i - 1].get("y")) + number(sorted_nodes[i - 1].get("height"))
        gap = number(sorted_nodes[i].get("y")) - previous_bottom
        if 0 <= gap < 300:
            gaps.append(gap)
    return gaps


def alignment_stats(nodes):
    candidates = [n for n in nodes if n.get("x") is not None and not is_frame_like(n)]
    if len(candidates) < 3:
        return 0.0, 0
    x_positions = [round(number(n.get("x"))) for n in candidates]
    buckets = Counter(round(x / 8) * 8 for x in x_positions)
    expected_x = buckets.most_common(1)[0][0]
    deviations = [abs(x - expected_x) for x in x_positions]
    return max(deviations) if deviations else 0.0, sum(1 for value in deviations if value > 16)


def nearest_background(node, nodes):
    parent_id = node.get("parentId")
    parent = next((n for n in nodes if n.get("nodeId") == parent_id), None)
    parent_color = fill_color(parent) if parent else None
    if parent_color:
        return parent_color
    frames = [n for n in nodes if is_frame_like(n)]
    nx, ny = number(node.get("x")), number(node.get("y"))
    containers = []
    for frame in frames:
        if frame.get("nodeId") == node.get("nodeId"):
            continue
        x, y, w, h = number(frame.get("x")), number(frame.get("y")), number(frame.get("width")), number(frame.get("height"))
        if nx >= x and ny >= y and nx <= x + w and ny <= y + h:
            containers.append(frame)
    containers.sort(key=lambda n: number(n.get("width")) * number(n.get("height")))
    for container in containers:
        color = fill_color(container)
        if color:
            return color
    return {"r": 255, "g": 255, "b": 255}


def build_features(design, category="normal"):
    nodes = [n for n in design.get("nodes", []) if n.get("visible", True) is not False]
    frames = [n for n in nodes if is_frame_like(n)]
    main = max(frames, key=lambda n: number(n.get("width")) * number(n.get("height")), default=(nodes[0] if nodes else {}))
    screen_width, screen_height = number(main.get("width")), number(main.get("height"))
    screen_area = screen_width * screen_height

    buttons = [n for n in nodes if is_button_like(n)]
    inputs = [n for n in nodes if is_input_like(n)]
    interactive_nodes = [n for n in nodes if is_button_like(n) or is_input_like(n) or is_action_node(n) or is_exit_node(n)]
    text_nodes = [n for n in nodes if str(n.get("type", "")).upper() == "TEXT"]
    error_nodes = [n for n in nodes if is_error_node(n)]
    destructive_nodes = [n for n in nodes if is_destructive_node(n)]
    confirmation_nodes = [n for n in nodes if is_confirmation_node(n)]
    modal_nodes = [n for n in nodes if is_modal_like(n, nodes)]

    all_spacing = vertical_gaps([n for n in nodes if not is_frame_like(n)]) + [number(n.get("itemSpacing") or n.get("spacing")) for n in nodes if 0 < number(n.get("itemSpacing") or n.get("spacing")) < 250]
    align_dev, misaligned = alignment_stats(nodes)

    corner_radii = [number(n.get("cornerRadius")) for n in buttons]
    button_heights = [number(n.get("height")) for n in buttons if number(n.get("height")) > 0]
    button_widths = [number(n.get("width")) for n in buttons if number(n.get("width")) > 0]
    button_ratios = [number(n.get("width")) / max(number(n.get("height")), 1) for n in buttons if number(n.get("width")) > 0]

    colors = [fill_color(n) for n in nodes]
    colors = [c for c in colors if c]
    color_count = len(set(color_bucket(c) for c in colors if color_bucket(c)))

    action_nodes = [{"node": n, "actionType": action_type(n), "color": fill_color(n)} for n in nodes if is_action_node(n)]
    action_nodes = [item for item in action_nodes if item["actionType"] and item["color"]]
    action_color_count = len(set((item["actionType"], exact_color_key(item["color"])) for item in action_nodes))

    same_action_color_deviation = 0.0
    by_action = defaultdict(list)
    for item in action_nodes:
        by_action[item["actionType"]].append(item["color"])
    for group in by_action.values():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                same_action_color_deviation = max(same_action_color_deviation, color_distance(group[i], group[j]))

    different_action_same_color_score = 0
    for i in range(len(action_nodes)):
        for j in range(i + 1, len(action_nodes)):
            if action_nodes[i]["actionType"] != action_nodes[j]["actionType"] and color_distance(action_nodes[i]["color"], action_nodes[j]["color"]) <= 24:
                different_action_same_color_score += 1

    error_contrasts = []
    for n in error_nodes:
        ratio = number(n.get("contrastRatio")) or contrast_ratio(fill_color(n), nearest_background(n, nodes))
        if ratio > 0:
            error_contrasts.append(ratio)

    text_contrasts = []
    for n in text_nodes:
        ratio = number(n.get("contrastRatio")) or contrast_ratio(fill_color(n), nearest_background(n, nodes))
        if ratio > 0:
            text_contrasts.append(ratio)

    control_density = len(interactive_nodes) / (screen_area / 10000) if screen_area > 0 else 0
    text_density = len(text_nodes) / (screen_area / 10000) if screen_area > 0 else 0
    module_layout = 1 if category == "layout" else 0
    module_color = 1 if category == "color" else 0
    module_error = 1 if category == "error" else 0
    module_normal = 1 if category == "normal" else 0

    row = {
        "nodeCount": len(nodes),
        "screenWidth": screen_width,
        "screenHeight": screen_height,
        "screenArea": screen_area,
        "isModalLike": 1 if modal_nodes else 0,
        "modalConfidence": min(1, 0.45 + len(modal_nodes) * 0.15) if modal_nodes else 0,
        "hasExitControl": 1 if any(is_exit_node(n) for n in nodes) else 0,
        "hasDestructiveAction": 1 if destructive_nodes else 0,
        "hasUndoOption": 1 if any(is_undo_node(n) for n in nodes) else 0,
        "hasConfirmationDialog": 1 if confirmation_nodes or any("confirm" in label(n) for n in modal_nodes) else 0,
        "interactiveElementCount": len(interactive_nodes),
        "textElementCount": len(text_nodes),
        "errorElementCount": len(error_nodes),
        "buttonCount": len(buttons),
        "inputCount": len(inputs),
        "controlDensity": control_density,
        "textDensity": text_density,
        "averageSpacing": average(all_spacing),
        "spacingDeviation": std(all_spacing),
        "maxSpacingGap": rng(all_spacing),
        "alignmentDeviation": align_dev,
        "misalignedElementCount": misaligned,
        "cornerRadiusDeviation": rng(corner_radii),
        "buttonHeightDeviation": rng(button_heights),
        "buttonWidthDeviation": rng(button_widths),
        "buttonAspectRatioDeviation": rng(button_ratios),
        "colorCount": color_count,
        "actionColorCount": action_color_count,
        "sameActionColorDeviation": same_action_color_deviation,
        "differentActionSameColorScore": different_action_same_color_score,
        "colorPatternDeviation": max(same_action_color_deviation / 255.0, float(different_action_same_color_score)),
        "errorContrastRatio": min(error_contrasts) if error_contrasts else average(text_contrasts),
        "errorVisibilityScore": max(0, min(1, (4.5 - min(error_contrasts)) / 4.5)) if error_contrasts else 0,
        "backgroundContrastAverage": average(text_contrasts),
        "destructiveActionCount": len(destructive_nodes),
        "confirmationControlCount": len(confirmation_nodes),
        "layoutGroupSize": max(len(buttons), len(inputs), len(text_nodes)),
        "overlayPresent": 1 if any(n.get("overlay") is True or "overlay" in label(n) for n in nodes) else 0,
        "module_layout": module_layout,
        "module_color": module_color,
        "module_error": module_error,
        "module_normal": module_normal,
    }
    for col in FEATURE_COLUMNS:
        row[col] = number(row.get(col))
    return row


def resolve_dataset_zip(path_arg):
    if path_arg:
        return Path(path_arg)
    local_candidates = [
        Path("ml_training/dataset_Figma_v2.zip"),
        Path("dataset_Figma_v2.zip"),
        Path("../dataset_Figma_v2.zip"),
        Path("../../dataset_Figma_v2.zip"),
    ]
    for candidate in local_candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("dataset_Figma_v2.zip was not found. Pass it with --dataset-zip PATH")


def build_dataset(dataset_zip, output_csv, limit_per_category=None):
    rows = []
    with zipfile.ZipFile(dataset_zip) as archive:
        all_names = archive.namelist()
        name_set = set(all_names)
        annotations = [name for name in all_names if name.startswith("dataset_Figma/annotations/") and name.endswith(".json")]
        annotations.sort()
        category_counts = Counter()
        for index, annotation_name in enumerate(annotations, start=1):
            annotation = json.loads(archive.read(annotation_name))
            category = annotation.get("category", "normal")
            if limit_per_category and category_counts[category] >= limit_per_category:
                continue
            design_id = annotation["designId"]
            design_name = f"dataset_Figma/designs/{category}/{design_id}.json"
            if design_name not in name_set:
                continue
            design = json.loads(archive.read(design_name))
            raw_label = annotation.get("expectedLabel") or annotation.get("mutation") or category
            issue_label = LABEL_MAP.get(raw_label, raw_label)
            severity = annotation.get("severity") or "medium"
            if issue_label == "no_issue" or severity == "none":
                severity = "low"
            features = build_features(design, category)
            features.update({
                "designId": design_id,
                "category": category,
                "screenType": annotation.get("screenType", design.get("screenType", "unknown")),
                "theme": annotation.get("theme", design.get("theme", "unknown")),
                "issueLabel": issue_label,
                "severity": severity,
                "suggestionCategory": SUGGESTION_MAP.get(issue_label, "review_ui_pattern")
            })
            rows.append(features)
            category_counts[category] += 1
            if index % 10000 == 0:
                print(f"Processed {index} annotations; rows={len(rows)}")
    df = pd.DataFrame(rows)
    Path(output_csv).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)
    print(f"Saved {len(df)} rows to {output_csv}")
    print(df["issueLabel"].value_counts())
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-zip", default=None, help="Path to dataset_Figma_v2.zip")
    parser.add_argument("--output", default="ml_training/ui_training_dataset.csv")
    parser.add_argument("--limit-per-category", type=int, default=None)
    args = parser.parse_args()
    dataset_zip = resolve_dataset_zip(args.dataset_zip)
    build_dataset(dataset_zip, args.output, args.limit_per_category)
