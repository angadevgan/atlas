import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_squared_error, r2_score,
)

from app.core.config import settings

ALGORITHMS = {
    "classification": {
        "random_forest": RandomForestClassifier,
        "logistic_regression": LogisticRegression,
    },
    "regression": {
        "random_forest": RandomForestRegressor,
        "linear_regression": LinearRegression,
    },
}


def train_model(dataset_path: str, target_column: str, task_type: str,
                 algorithm: str, hyperparameters: dict | None = None) -> dict:
    df = pd.read_csv(dataset_path)
    if target_column not in df.columns:
        raise ValueError(f"target_column '{target_column}' not found in dataset")

    X = df.drop(columns=[target_column])
    y = df[target_column]
    X = pd.get_dummies(X)
    feature_columns = list(X.columns)

    label_encoder = None
    if task_type == "classification" and y.dtype == object:
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model_cls = ALGORITHMS.get(task_type, {}).get(algorithm)
    if model_cls is None:
        raise ValueError(f"Unsupported combination: {task_type}/{algorithm}")

    model = model_cls(**(hyperparameters or {}))
    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    if task_type == "classification":
        metrics = {
            "accuracy": round(accuracy_score(y_test, preds), 4),
            "f1": round(f1_score(y_test, preds, average="weighted"), 4),
            "precision": round(precision_score(y_test, preds, average="weighted", zero_division=0), 4),
            "recall": round(recall_score(y_test, preds, average="weighted"), 4),
        }
    else:
        metrics = {
            "rmse": round(mean_squared_error(y_test, preds) ** 0.5, 4),
            "r2": round(r2_score(y_test, preds), 4),
        }

    os.makedirs(settings.artifact_dir, exist_ok=True)
    artifact_name = os.path.basename(dataset_path).split(".")[0]
    artifact_path = os.path.join(settings.artifact_dir, f"{artifact_name}.joblib")
    joblib.dump(
        {"model": model, "label_encoder": label_encoder, "feature_columns": feature_columns},
        artifact_path,
    )

    file_size = os.path.getsize(artifact_path)

    return {
        "file_path": artifact_path,
        "file_size_bytes": file_size,
        "metrics": metrics,
        "feature_columns": feature_columns,
    }


def predict(artifact_path: str, input_payload: dict) -> dict:
    bundle = joblib.load(artifact_path)
    model = bundle["model"]
    label_encoder = bundle["label_encoder"]
    feature_columns = bundle["feature_columns"]

    row = pd.DataFrame([input_payload])
    row = pd.get_dummies(row)
    row = row.reindex(columns=feature_columns, fill_value=0)

    raw_pred = model.predict(row)[0]
    if label_encoder is not None:
        raw_pred = label_encoder.inverse_transform([raw_pred])[0]

    result = {"prediction": raw_pred if not hasattr(raw_pred, "item") else raw_pred.item()}

    confidence = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(row)[0]
        result["probabilities"] = proba.tolist()
        confidence = float(max(proba))

    result["confidence"] = confidence
    return result
