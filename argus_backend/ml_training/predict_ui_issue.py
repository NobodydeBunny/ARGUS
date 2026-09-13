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
    except:
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
    return [row]

def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError("Input JSON argument is required.")

        input_data = json.loads(sys.argv[1])
        if isinstance(input_data, dict) and isinstance(input_data.get("features"), dict):
            input_data = input_data["features"]

        model_bundle = load_model_bundle()
        feature_columns = load_feature_columns(model_bundle)

        issue_model = model_bundle["issue_model"]
        severity_map = model_bundle.get("severity_map", {})
        suggestion_map = model_bundle.get("suggestion_map", {})

        X = build_feature_row(input_data, feature_columns)

        issue_label = issue_model.predict(X)[0]

        confidence_score = 0.0
        probability_details = {}

        if hasattr(issue_model.named_steps["model"], "predict_proba"):
            probabilities = issue_model.predict_proba(X)[0]
            classes = issue_model.named_steps["model"].classes_

            probability_details = {
                str(label): float(prob)
                for label, prob in zip(classes, probabilities)
            }

            confidence_score = float(max(probabilities))

        severity = severity_map.get(issue_label, "medium")
        suggestion_category = suggestion_map.get(issue_label, "review_ui_pattern")

        output = {
            "issueLabel": str(issue_label),
            "severity": str(severity),
            "suggestionCategory": str(suggestion_category),
            "confidenceScore": confidence_score,
            "probabilities": probability_details,
            "modelVersion": model_bundle.get("modelVersion", "ARGUS Final Improved Structured Metadata Model")
        }

        print(json.dumps(output))

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