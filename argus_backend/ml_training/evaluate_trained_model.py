import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from build_training_dataset_from_figma import FEATURE_COLUMNS


def evaluate(dataset_csv, model_path, output_path):
    df = pd.read_csv(dataset_csv)
    X = df[FEATURE_COLUMNS].fillna(0)
    y_issue = df["issueLabel"]
    _, X_test, _, y_issue_test = train_test_split(
        X, y_issue, test_size=0.2, random_state=42, stratify=y_issue
    )
    bundle = joblib.load(model_path)
    pred = bundle["issue_model"].predict(X_test)
    result = {
        "accuracy": float(accuracy_score(y_issue_test, pred)),
        "classificationReport": classification_report(y_issue_test, pred, zero_division=0, output_dict=True)
    }
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="ml_training/ui_training_dataset.csv")
    parser.add_argument("--model", default="ml_training/trained_ui_model.pkl")
    parser.add_argument("--output", default="ml_training/evaluation_summary.json")
    args = parser.parse_args()
    evaluate(args.dataset, args.model, args.output)
