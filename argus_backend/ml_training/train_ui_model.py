import json
import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

DATASET_PATH = "ml_training/ui_training_dataset.csv"
MODEL_PATH = "ml_training/trained_ui_model.pkl"
COLUMNS_PATH = "ml_training/model_columns.json"

df = pd.read_csv(DATASET_PATH)

feature_columns = [
    "isModalLike",
    "hasExitControl",
    "hasDestructiveAction",
    "hasUndoOption",
    "hasConfirmationDialog",
    "controlDensity",
    "spacingDeviation",
    "alignmentDeviation",
    "cornerRadiusDeviation",
    "colorPatternDeviation",
    "sameColorDifferentActions",
    "errorContrastRatio"
]

X = df[feature_columns]
y_issue = df["issueLabel"]
y_severity = df["severity"]
y_suggestion = df["suggestionCategory"]

issue_model = RandomForestClassifier(n_estimators=100, random_state=42)
severity_model = RandomForestClassifier(n_estimators=100, random_state=42)
suggestion_model = RandomForestClassifier(n_estimators=100, random_state=42)

issue_model.fit(X, y_issue)
severity_model.fit(X, y_severity)
suggestion_model.fit(X, y_suggestion)

bundle = {
    "issue_model": issue_model,
    "severity_model": severity_model,
    "suggestion_model": suggestion_model
}

joblib.dump(bundle, MODEL_PATH)

with open(COLUMNS_PATH, "w") as file:
    json.dump(feature_columns, file, indent=2)

print("Model trained successfully.")
print(f"Saved model: {MODEL_PATH}")