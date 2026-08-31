import json
import sys
from pathlib import Path

import joblib
import pandas as pd

MODEL_PATH = Path("ml_training/trained_ui_model.pkl")
COLUMNS_PATH = Path("ml_training/model_columns.json")


def load_columns(bundle):
    if COLUMNS_PATH.exists():
        with open(COLUMNS_PATH, "r", encoding="utf-8") as file:
            return json.load(file)
    return bundle.get("feature_columns", [])


def predict(payload):
    if not MODEL_PATH.exists():
        return {"error": "trained_ui_model.pkl not found"}

    bundle = joblib.load(MODEL_PATH)
    columns = load_columns(bundle)
    features = payload.get("features", payload)
    row = {column: float(features.get(column, 0) or 0) for column in columns}
    X = pd.DataFrame([row], columns=columns)

    issue_model = bundle["issue_model"]
    severity_model = bundle["severity_model"]
    suggestion_model = bundle["suggestion_model"]

    issue_label = issue_model.predict(X)[0]
    severity = severity_model.predict(X)[0]
    suggestion = suggestion_model.predict(X)[0]

    confidence = 0.6
    if hasattr(issue_model, "predict_proba"):
        probabilities = issue_model.predict_proba(X)[0]
        confidence = float(max(probabilities))

    return {
        "issueLabel": issue_label,
        "severity": severity,
        "suggestionCategory": suggestion,
        "confidenceScore": round(confidence, 4),
        "modelVersion": bundle.get("modelVersion", "Random Forest UI Issue Classifier v2.0")
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Prediction payload JSON is required")
        payload = json.loads(sys.argv[1])
        print(json.dumps(predict(payload)))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
