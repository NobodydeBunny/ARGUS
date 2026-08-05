import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from build_training_dataset_from_figma import FEATURE_COLUMNS


def train(dataset_csv, model_path, columns_path, metrics_path):
    df = pd.read_csv(dataset_csv)
    for column in FEATURE_COLUMNS:
        if column not in df.columns:
            df[column] = 0
    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].fillna(0)

    X = df[FEATURE_COLUMNS]
    y_issue = df["issueLabel"]
    y_severity = df["severity"]
    y_suggestion = df["suggestionCategory"]

    X_train, X_test, y_issue_train, y_issue_test, y_severity_train, y_severity_test, y_suggestion_train, y_suggestion_test = train_test_split(
        X, y_issue, y_severity, y_suggestion,
        test_size=0.2,
        random_state=42,
        stratify=y_issue
    )

    common_params = {
        "n_estimators": 140,
        "max_depth": 22,
        "min_samples_leaf": 2,
        "random_state": 42,
        "n_jobs": -1,
        "class_weight": "balanced_subsample"
    }

    issue_model = RandomForestClassifier(**common_params)
    severity_model = RandomForestClassifier(**common_params)
    suggestion_model = RandomForestClassifier(**common_params)

    print("Training issue label model...")
    issue_model.fit(X_train, y_issue_train)
    print("Training severity model...")
    severity_model.fit(X_train, y_severity_train)
    print("Training suggestion model...")
    suggestion_model.fit(X_train, y_suggestion_train)

    issue_pred = issue_model.predict(X_test)
    severity_pred = severity_model.predict(X_test)
    suggestion_pred = suggestion_model.predict(X_test)

    metrics = {
        "datasetRows": int(len(df)),
        "trainingRows": int(len(X_train)),
        "testRows": int(len(X_test)),
        "featureColumns": FEATURE_COLUMNS,
        "issueLabelAccuracy": float(accuracy_score(y_issue_test, issue_pred)),
        "severityAccuracy": float(accuracy_score(y_severity_test, severity_pred)),
        "suggestionCategoryAccuracy": float(accuracy_score(y_suggestion_test, suggestion_pred)),
        "issueLabelReport": classification_report(y_issue_test, issue_pred, zero_division=0, output_dict=True),
        "severityReport": classification_report(y_severity_test, severity_pred, zero_division=0, output_dict=True),
        "suggestionCategoryReport": classification_report(y_suggestion_test, suggestion_pred, zero_division=0, output_dict=True),
        "issueLabels": sorted(df["issueLabel"].unique().tolist()),
        "severityLabels": sorted(df["severity"].unique().tolist()),
        "suggestionCategories": sorted(df["suggestionCategory"].unique().tolist())
    }

    bundle = {
        "modelVersion": "Random Forest UI Issue Classifier v2.0",
        "issue_model": issue_model,
        "severity_model": severity_model,
        "suggestion_model": suggestion_model,
        "feature_columns": FEATURE_COLUMNS,
        "metrics": metrics
    }

    Path(model_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path, compress=3)
    with open(columns_path, "w", encoding="utf-8") as file:
        json.dump(FEATURE_COLUMNS, file, indent=2)
    with open(metrics_path, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    print(f"Saved model to {model_path}")
    print(f"Issue label accuracy: {metrics['issueLabelAccuracy']:.4f}")
    print(f"Severity accuracy: {metrics['severityAccuracy']:.4f}")
    print(f"Suggestion accuracy: {metrics['suggestionCategoryAccuracy']:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="ml_training/ui_training_dataset.csv")
    parser.add_argument("--model", default="ml_training/trained_ui_model.pkl")
    parser.add_argument("--columns", default="ml_training/model_columns.json")
    parser.add_argument("--metrics", default="ml_training/model_metrics.json")
    args = parser.parse_args()
    train(args.dataset, args.model, args.columns, args.metrics)
