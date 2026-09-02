"""
ARGUS - Better Metadata Model Trainer
=====================================

Purpose:
  Train a better model for the ARGUS UI Analyzer project using the structured
  Figma metadata dataset.

This script expects that you already created:
  ml_training/ui_training_dataset.csv

using:
  python ml_training/build_training_dataset_from_figma.py --dataset-zip dataset_Figma_v2.zip --output ml_training/ui_training_dataset.csv

Outputs:
  ml_training/trained_ui_model.pkl
  ml_training/model_columns.json
  ml_training/model_metrics.json
  ml_training/confusion_issueLabel.png
  ml_training/confusion_severity.png
  ml_training/confusion_suggestionCategory.png

This output format is compatible with the current ARGUS backend predict_ui_issue.py.
"""

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, ConfusionMatrixDisplay
from sklearn.model_selection import train_test_split

from build_training_dataset_from_figma import FEATURE_COLUMNS


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure all required feature columns exist and contain numeric values."""
    for column in FEATURE_COLUMNS:
        if column not in df.columns:
            df[column] = 0

    X = df[FEATURE_COLUMNS].copy()

    for column in FEATURE_COLUMNS:
        X[column] = pd.to_numeric(X[column], errors="coerce").fillna(0)

    return X


def make_model(model_type: str):
    """Create a classifier model.

    ExtraTrees usually works very well for structured metadata because it can
    separate many rule-like numeric patterns without much feature scaling.
    """
    if model_type == "extra_trees":
        return ExtraTreesClassifier(
            n_estimators=500,
            max_depth=None,
            min_samples_split=2,
            min_samples_leaf=1,
            max_features="sqrt",
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
            bootstrap=False,
        )

    if model_type == "random_forest":
        return RandomForestClassifier(
            n_estimators=350,
            max_depth=32,
            min_samples_split=2,
            min_samples_leaf=1,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )

    if model_type == "voting":
        extra = make_model("extra_trees")
        forest = make_model("random_forest")
        return VotingClassifier(
            estimators=[
                ("extra_trees", extra),
                ("random_forest", forest),
            ],
            voting="soft",
            n_jobs=-1,
        )

    raise ValueError(f"Unknown model_type: {model_type}")


def save_confusion_matrix(y_true, y_pred, labels, title, output_path):
    """Save a confusion matrix as a PNG image."""
    matrix = confusion_matrix(y_true, y_pred, labels=labels)

    fig_width = max(8, len(labels) * 0.9)
    fig_height = max(6, len(labels) * 0.7)

    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    display = ConfusionMatrixDisplay(confusion_matrix=matrix, display_labels=labels)
    display.plot(ax=ax, cmap="Blues", xticks_rotation=90, colorbar=False, values_format="d")
    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(output_path, dpi=220)
    plt.close(fig)


def train(dataset_csv, model_path, columns_path, metrics_path, model_type):
    dataset_csv = Path(dataset_csv)
    model_path = Path(model_path)
    columns_path = Path(columns_path)
    metrics_path = Path(metrics_path)

    if not dataset_csv.exists():
        raise FileNotFoundError(f"Dataset CSV not found: {dataset_csv}")

    df = pd.read_csv(dataset_csv)

    required_targets = ["issueLabel", "severity", "suggestionCategory"]
    for target in required_targets:
        if target not in df.columns:
            raise ValueError(f"Missing required target column: {target}")

    X = prepare_features(df)
    y_issue = df["issueLabel"].astype(str)
    y_severity = df["severity"].astype(str)
    y_suggestion = df["suggestionCategory"].astype(str)

    # Split once so all three target models are evaluated on exactly the same rows.
    split = train_test_split(
        X,
        y_issue,
        y_severity,
        y_suggestion,
        test_size=0.20,
        random_state=42,
        stratify=y_issue,
    )

    (
        X_train,
        X_test,
        y_issue_train,
        y_issue_test,
        y_severity_train,
        y_severity_test,
        y_suggestion_train,
        y_suggestion_test,
    ) = split

    print(f"Dataset rows: {len(df)}")
    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")
    print(f"Model type: {model_type}")

    issue_model = make_model(model_type)
    severity_model = make_model(model_type)
    suggestion_model = make_model(model_type)

    print("\nTraining issue label model...")
    issue_model.fit(X_train, y_issue_train)

    print("Training severity model...")
    severity_model.fit(X_train, y_severity_train)

    print("Training suggestion category model...")
    suggestion_model.fit(X_train, y_suggestion_train)

    issue_pred = issue_model.predict(X_test)
    severity_pred = severity_model.predict(X_test)
    suggestion_pred = suggestion_model.predict(X_test)

    issue_accuracy = accuracy_score(y_issue_test, issue_pred)
    severity_accuracy = accuracy_score(y_severity_test, severity_pred)
    suggestion_accuracy = accuracy_score(y_suggestion_test, suggestion_pred)

    issue_labels = sorted(y_issue.unique().tolist())
    severity_labels = sorted(y_severity.unique().tolist())
    suggestion_categories = sorted(y_suggestion.unique().tolist())

    metrics = {
        "modelVersion": f"ARGUS Structured Metadata {model_type} v3.0",
        "datasetRows": int(len(df)),
        "trainingRows": int(len(X_train)),
        "testRows": int(len(X_test)),
        "modelType": model_type,
        "featureColumns": FEATURE_COLUMNS,
        "issueLabelAccuracy": float(issue_accuracy),
        "severityAccuracy": float(severity_accuracy),
        "suggestionCategoryAccuracy": float(suggestion_accuracy),
        "issueLabelReport": classification_report(y_issue_test, issue_pred, zero_division=0, output_dict=True),
        "severityReport": classification_report(y_severity_test, severity_pred, zero_division=0, output_dict=True),
        "suggestionCategoryReport": classification_report(y_suggestion_test, suggestion_pred, zero_division=0, output_dict=True),
        "issueLabels": issue_labels,
        "severityLabels": severity_labels,
        "suggestionCategories": suggestion_categories,
    }

    bundle = {
        "modelVersion": metrics["modelVersion"],
        "issue_model": issue_model,
        "severity_model": severity_model,
        "suggestion_model": suggestion_model,
        "feature_columns": FEATURE_COLUMNS,
        "metrics": metrics,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path, compress=3)

    with open(columns_path, "w", encoding="utf-8") as file:
        json.dump(FEATURE_COLUMNS, file, indent=2)

    with open(metrics_path, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    output_dir = metrics_path.parent
    save_confusion_matrix(
        y_issue_test,
        issue_pred,
        issue_labels,
        "issueLabel Confusion Matrix",
        output_dir / "confusion_issueLabel.png",
    )
    save_confusion_matrix(
        y_severity_test,
        severity_pred,
        severity_labels,
        "severity Confusion Matrix",
        output_dir / "confusion_severity.png",
    )
    save_confusion_matrix(
        y_suggestion_test,
        suggestion_pred,
        suggestion_categories,
        "suggestionCategory Confusion Matrix",
        output_dir / "confusion_suggestionCategory.png",
    )

    print("\nTraining complete.")
    print(f"Saved model: {model_path}")
    print(f"Saved columns: {columns_path}")
    print(f"Saved metrics: {metrics_path}")
    print(f"Issue label accuracy: {issue_accuracy:.4f}")
    print(f"Severity accuracy: {severity_accuracy:.4f}")
    print(f"Suggestion category accuracy: {suggestion_accuracy:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="ml_training/ui_training_dataset.csv")
    parser.add_argument("--model", default="ml_training/trained_ui_model.pkl")
    parser.add_argument("--columns", default="ml_training/model_columns.json")
    parser.add_argument("--metrics", default="ml_training/model_metrics.json")
    parser.add_argument(
        "--model-type",
        default="extra_trees",
        choices=["extra_trees", "random_forest", "voting"],
        help="extra_trees is recommended first. voting may be slower but can be tested later.",
    )
    args = parser.parse_args()

    train(args.dataset, args.model, args.columns, args.metrics, args.model_type)
