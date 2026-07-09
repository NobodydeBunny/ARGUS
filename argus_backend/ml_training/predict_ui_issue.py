import sys
import json
import joblib
import pandas as pd

MODEL_PATH = "ml_training/trained_ui_model.pkl"
COLUMNS_PATH = "ml_training/model_columns.json"

bundle = joblib.load(MODEL_PATH)

with open(COLUMNS_PATH, "r") as file:
    feature_columns = json.load(file)

input_json = json.loads(sys.argv[1])

row = {}
for column in feature_columns:
    row[column] = input_json.get(column, 0)

X = pd.DataFrame([row], columns=feature_columns)

issue_model = bundle["issue_model"]
severity_model = bundle["severity_model"]
suggestion_model = bundle["suggestion_model"]

issue_label = issue_model.predict(X)[0]
severity = severity_model.predict(X)[0]
suggestion_category = suggestion_model.predict(X)[0]

probabilities = issue_model.predict_proba(X)[0]
confidence = float(max(probabilities))

result = {
    "issueLabel": issue_label,
    "severity": severity,
    "suggestionCategory": suggestion_category,
    "confidenceScore": round(confidence, 2)
}

print(json.dumps(result))