import sys
import json
import joblib
import numpy as np
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent

MODEL_PATH = CURRENT_DIR / "trained_ui_model.pkl"
COLUMNS_PATH = CURRENT_DIR / "model_columns.json"


def safe_number(value):
    try:
        if value is None:
            return 0.0

        value = float(value)

        if np.isnan(value) or np.isinf(value):
            return 0.0

        return value
    except Exception:
        return 0.0


def load_model_bundle():
    return joblib.load(MODEL_PATH)


def load_feature_columns(model_bundle):
    if "feature_columns" in model_bundle:
        return model_bundle["feature_columns"]

    if COLUMNS_PATH.exists():
        with open(COLUMNS_PATH, "r", encoding="utf-8") as file:
            return json.load(file)

    raise ValueError("Feature columns were not found.")


def build_feature_row(input_data, feature_columns):
    row = []

    for column in feature_columns:
        row.append(safe_number(input_data.get(column, 0)))

    return row


def get_input_payload():
    if len(sys.argv) >= 2:
        return json.loads(sys.argv[1])

    raw_input = sys.stdin.read()

    if not raw_input.strip():
        raise ValueError("Input JSON argument or stdin JSON payload is required.")

    return json.loads(raw_input)


def normalize_input_payload(payload):
    if isinstance(payload, dict) and isinstance(payload.get("batch"), list):
        return payload["batch"], True

    if isinstance(payload, list):
        return payload, True

    if isinstance(payload, dict) and isinstance(payload.get("features"), dict):
        return [payload["features"]], False

    if isinstance(payload, dict):
        return [payload], False

    raise ValueError("Invalid input format.")


def predict_batch(input_rows):
    model_bundle = load_model_bundle()
    feature_columns = load_feature_columns(model_bundle)

    issue_model = model_bundle["issue_model"]
    severity_map = model_bundle.get("severity_map", {})
    suggestion_map = model_bundle.get("suggestion_map", {})

    X = [
        build_feature_row(input_data, feature_columns)
        for input_data in input_rows
    ]

    issue_labels = issue_model.predict(X)

    confidence_scores = [0.0 for _ in issue_labels]
    probability_rows = [{} for _ in issue_labels]

    try:
        model_step = issue_model.named_steps["model"]

        if hasattr(model_step, "predict_proba"):
            probabilities = issue_model.predict_proba(X)
            classes = model_step.classes_

            for index, row_probabilities in enumerate(probabilities):
                probability_rows[index] = {
                    str(label): float(prob)
                    for label, prob in zip(classes, row_probabilities)
                }

                confidence_scores[index] = float(max(row_probabilities))
    except Exception:
        confidence_scores = [0.0 for _ in issue_labels]
        probability_rows = [{} for _ in issue_labels]

    model_version = model_bundle.get(
        "modelVersion",
        "ARGUS Final Improved Structured Metadata Model"
    )

    outputs = []

    for issue_label, confidence_score, probability_details in zip(
        issue_labels,
        confidence_scores,
        probability_rows
    ):
        severity = severity_map.get(issue_label, "medium")
        suggestion_category = suggestion_map.get(issue_label, "review_ui_pattern")

        outputs.append({
            "issueLabel": str(issue_label),
            "severity": str(severity),
            "suggestionCategory": str(suggestion_category),
            "confidenceScore": confidence_score,
            "probabilities": probability_details,
            "modelVersion": model_version
        })

    return outputs


def main():
    try:
        payload = get_input_payload()
        input_rows, is_batch = normalize_input_payload(payload)

        predictions = predict_batch(input_rows)

        if is_batch:
            print(json.dumps(predictions))
        else:
            print(json.dumps(predictions[0]))

    except Exception as error:
        fallback = {
            "issueLabel": "review_required",
            "severity": "medium",
            "suggestionCategory": "review_ui_pattern",
            "confidenceScore": 0.0,
            "error": str(error)
        }

        print(json.dumps(fallback))


if __name__ == "__main__":
    main()