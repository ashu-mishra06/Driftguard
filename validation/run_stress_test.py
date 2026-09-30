"""Generate reviewer-readable DriftGuard validation artifacts.

Important:
- V2 is evaluated only with the frozen production artifacts.
- Module A runtime statistics are computed from the dataset being scored.
- Module B V2 uses the frozen XGBoost v3 model and the locked v3 drift-ratio formula.
- Ground-truth labels are used only in this offline evaluation script.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, f1_score, mean_absolute_error, mean_squared_error, precision_score, r2_score, recall_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "code" / "backend"
DATA = ROOT / "data"
RESULTS = ROOT / "results"
PLOTS = RESULTS / "plots"
RESULTS.mkdir(exist_ok=True)
PLOTS.mkdir(exist_ok=True)

sys.path.insert(0, str(BACKEND))
from module_a import detect_outliers  # noqa: E402
from module_b import FROZEN_THRESHOLD, FROZEN_SAFETY_SLOPES, add_drift_features, predict_drift  # noqa: E402
from verdict import compute_verdict  # noqa: E402


PARAMETERS = ("iddq", "leakage", "prop_delay")


def evaluate_flags(y_true: pd.Series, y_pred: pd.Series) -> dict:
    tn, fp, fn, tp = confusion_matrix(
        y_true.astype(int),
        y_pred.astype(int),
        labels=[0, 1],
    ).ravel()
    return {
        "tp": int(tp),
        "fp": int(fp),
        "fn": int(fn),
        "tn": int(tn),
        "accuracy": float((tp + tn) / (tp + tn + fp + fn)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "specificity": float(tn / (tn + fp) if (tn + fp) else 0.0),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }


def load_dataset(dataset: str, labels: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    return pd.read_csv(DATA / dataset), pd.read_csv(DATA / labels)


def run_production_pipeline(df: pd.DataFrame, labels: pd.DataFrame) -> pd.DataFrame:
    a = detect_outliers(df)
    b = predict_drift(df)
    merged = a.merge(b, on=["component_id", "lot_id"], validate="one_to_one")

    verdicts = []
    for _, row in merged.iterrows():
        decision = compute_verdict(
            {
                "flagged": bool(row["flagged_x"]),
                "signature": row["signature"],
                "signature_confidence": row["signature_confidence"],
            },
            {"flagged": bool(row["flagged_y"])},
        )
        verdicts.append(decision)

    merged["verdict"] = [item["verdict"] for item in verdicts]
    return merged.merge(labels, on="component_id", how="left", validate="one_to_one")


def fit_v1_module_b_validation(v1: pd.DataFrame, labels: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
    """Train only on the V1 development split and evaluate on held-out V1.

    The frozen model's selected hyperparameter configurations are reused for
    this offline validation; no V2 data enters model selection.
    """
    import joblib

    model_path = BACKEND / "models" / "driftguard_module_b_v3_FINAL.pkl"
    bundle = joblib.load(model_path)
    feature_columns = bundle["feature_columns"]
    best_configs = bundle["best_configs"]

    ids = v1["component_id"].unique()
    train_ids, val_ids = train_test_split(ids, test_size=0.20, random_state=42)
    train = v1[v1["component_id"].isin(train_ids)].copy()
    val = v1[v1["component_id"].isin(val_ids)].copy()

    train_eng = add_drift_features(train)
    val_eng = add_drift_features(val)

    predictions = {}
    mae_rows = []
    flags = pd.DataFrame({"component_id": val["component_id"].values})

    for parameter in PARAMETERS:
        model = XGBRegressor(
            objective="reg:squarederror",
            random_state=42,
            n_jobs=-1,
            tree_method="hist",
            **best_configs[parameter],
        )
        model.fit(train_eng[feature_columns], train_eng[f"{parameter}_168h"], verbose=False)
        pred = model.predict(val_eng[feature_columns])
        actual = val[f"{parameter}_168h"].to_numpy(dtype=float)
        predictions[parameter] = pred

        linear_pred = val[f"{parameter}_24h"].to_numpy(dtype=float) + 7.0 * (
            val[f"{parameter}_24h"].to_numpy(dtype=float) - val[f"{parameter}_0h"].to_numpy(dtype=float)
        )

        mae_rows.append({
            "dataset": "V1 held-out",
            "parameter": parameter,
            "xgboost_mae": float(mean_absolute_error(actual, pred)),
            "linear_baseline_mae": float(mean_absolute_error(actual, linear_pred)),
            "xgboost_rmse": float(np.sqrt(mean_squared_error(actual, pred))),
            "linear_baseline_rmse": float(np.sqrt(mean_squared_error(actual, linear_pred))),
            "xgboost_r2": float(r2_score(actual, pred)),
            "linear_baseline_r2": float(r2_score(actual, linear_pred)),
        })

        v0 = val[f"{parameter}_0h"].to_numpy(dtype=float)
        v24 = val[f"{parameter}_24h"].to_numpy(dtype=float)
        ratio = np.maximum(np.abs(pred - v0), np.abs(pred - v24)) / (
            FROZEN_SAFETY_SLOPES[parameter] * 168.0
        )
        flags[f"{parameter}_ratio"] = ratio

    flags["max_drift_ratio"] = flags[[f"{p}_ratio" for p in PARAMETERS]].max(axis=1)
    flags["module_b_flag"] = flags["max_drift_ratio"] > FROZEN_THRESHOLD
    flags = flags.merge(labels[["component_id", "is_defective"]], on="component_id", validate="one_to_one")

    metrics = evaluate_flags(flags["is_defective"], flags["module_b_flag"])
    return {"metrics": metrics, "mae_rows": mae_rows, "validation_component_count": len(val)}, flags


def static_baseline(df: pd.DataFrame) -> pd.Series:
    limits = {"iddq": 60.0, "leakage": 50.0, "prop_delay": 8.0}
    flags = np.zeros(len(df), dtype=bool)
    for parameter, limit in limits.items():
        for timestamp in (0, 24, 96):
            flags |= df[f"{parameter}_{timestamp}h"].to_numpy(dtype=float) > limit
    return pd.Series(flags.astype(int), index=df.index)


def main() -> None:
    v1, v1_labels = load_dataset("synthetic_components_v1 (1).csv", "synthetic_components_v1_labels.csv")
    v2, v2_labels = load_dataset("synthetic_components_v2_stresstest.csv", "synthetic_components_v2_stresstest_labels.csv")

    # Production V2: this is the reviewer-facing blind evaluation.
    v2_pipeline = run_production_pipeline(v2, v2_labels)
    v2_a = evaluate_flags(v2_pipeline["is_defective"], v2_pipeline["flagged_x"])
    v2_b = evaluate_flags(v2_pipeline["is_defective"], v2_pipeline["flagged_y"])
    v2_reject = evaluate_flags(
        v2_pipeline["is_defective"],
        v2_pipeline["verdict"].eq("REJECT"),
    )

    static_pred = static_baseline(v2)
    static_metrics = evaluate_flags(v2_pipeline["is_defective"], static_pred)

    # V1 Module A runtime-stat validation on held-out components.
    v1_ids = v1["component_id"].unique()
    _, v1_val_ids = train_test_split(v1_ids, test_size=0.20, random_state=42)
    v1_val = v1[v1["component_id"].isin(v1_val_ids)].copy()
    v1_val_labels = v1_labels[v1_labels["component_id"].isin(v1_val_ids)].copy()
    v1_a_pred = detect_outliers(v1_val)
    v1_a_eval = v1_a_pred.merge(v1_val_labels, on="component_id", validate="one_to_one")
    v1_a = evaluate_flags(v1_a_eval["is_defective"], v1_a_eval["flagged"])

    # V1 Module B held-out validation with selected configurations.
    v1_b_detail, _ = fit_v1_module_b_validation(v1, v1_labels)

    hidden_mask = v2_pipeline["hidden_within_limits"].eq(True) & v2_pipeline["is_defective"].eq(1)
    a_hidden_detected = int((hidden_mask & v2_pipeline["flagged_x"].eq(True)).sum())
    b_hidden_detected = int((hidden_mask & v2_pipeline["flagged_y"].eq(True)).sum())
    hidden_total = int(hidden_mask.sum())

    verdict_counts = v2_pipeline["verdict"].value_counts().to_dict()

    # MAE comparison on the final frozen V2 predictor vs two-point linear baseline.
    frozen_bundle = __import__("joblib").load(BACKEND / "models" / "driftguard_module_b_v3_FINAL.pkl")
    v2_features = add_drift_features(v2)[frozen_bundle["feature_columns"]]
    mae_rows = list(v1_b_detail["mae_rows"])
    for parameter in PARAMETERS:
        pred = frozen_bundle["models"][parameter].predict(v2_features)
        actual = v2[f"{parameter}_168h"].to_numpy(dtype=float)
        linear_pred = v2[f"{parameter}_24h"].to_numpy(dtype=float) + 7.0 * (
            v2[f"{parameter}_24h"].to_numpy(dtype=float) - v2[f"{parameter}_0h"].to_numpy(dtype=float)
        )
        mae_rows.append({
            "dataset": "V2 blind",
            "parameter": parameter,
            "xgboost_mae": float(mean_absolute_error(actual, pred)),
            "linear_baseline_mae": float(mean_absolute_error(actual, linear_pred)),
            "xgboost_rmse": float(np.sqrt(mean_squared_error(actual, pred))),
            "linear_baseline_rmse": float(np.sqrt(mean_squared_error(actual, linear_pred))),
            "xgboost_r2": float(r2_score(actual, pred)),
            "linear_baseline_r2": float(r2_score(actual, linear_pred)),
        })

    summary = {
        "module_a": {
            "v1_held_out_runtime_stats": v1_a,
            "v2_blind": v2_a,
        },
        "module_b": {
            "v1_held_out": v1_b_detail["metrics"],
            "v2_blind": v2_b,
        },
        "static_baseline": {"v2_blind": static_metrics},
        "combined_verdict": {
            "v2_counts": {
                "REJECT": int(verdict_counts.get("REJECT", 0)),
                "FLAG_FOR_REVIEW": int(verdict_counts.get("FLAG_FOR_REVIEW", 0)),
                "PASS": int(verdict_counts.get("PASS", 0)),
            },
            "reject_precision": v2_reject["precision"],
            "reject_recall": v2_reject["recall"],
        },
        "hidden_defects_v2": {
            "total": hidden_total,
            "module_a_detected": a_hidden_detected,
            "module_a_recall": a_hidden_detected / hidden_total if hidden_total else 0.0,
            "module_b_detected": b_hidden_detected,
            "module_b_recall": b_hidden_detected / hidden_total if hidden_total else 0.0,
        },
        "flag_counts_v2": {
            "module_a": int(v2_pipeline["flagged_x"].sum()),
            "module_b": int(v2_pipeline["flagged_y"].sum()),
        },
        "locked_rules": {
            "module_a_threshold": 4.5,
            "module_a_tolerance": 0.02,
            "module_b_threshold": 1.25,
            "module_b_drift_formula": "max(abs(pred_168h-v0), abs(pred_168h-v24)) / (safety_slope*168h)",
        },
    }

    (RESULTS / "stress_test_metrics.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    pd.DataFrame(mae_rows).to_csv(RESULTS / "module_b_mae_comparison.csv", index=False)

    export_columns = [
        "component_id", "lot_id", "is_defective", "archetype", "curve_shape", "hidden_within_limits",
        "anomaly_score", "flagged_x", "signature", "signature_confidence",
        "flagged_y", "max_drift_ratio", "verdict",
    ]
    v2_pipeline[export_columns].to_csv(RESULTS / "stress_test_component_results_v2.csv", index=False)

    chart = pd.DataFrame([
        {"method": "Module A", "dataset": "V1 held-out", "recall_pct": v1_a["recall"] * 100},
        {"method": "Module A", "dataset": "V2 blind", "recall_pct": v2_a["recall"] * 100},
        {"method": "Module B", "dataset": "V1 held-out", "recall_pct": v1_b_detail["metrics"]["recall"] * 100},
        {"method": "Module B", "dataset": "V2 blind", "recall_pct": v2_b["recall"] * 100},
        {"method": "Static baseline", "dataset": "V2 blind", "recall_pct": static_metrics["recall"] * 100},
    ])
    chart.to_csv(RESULTS / "recall_comparison.csv", index=False)

    fig, ax = plt.subplots(figsize=(10, 6))
    labels = ["A V1", "A V2", "B V1", "B V2", "Static V2"]
    values = chart["recall_pct"].tolist()
    ax.bar(labels, values)
    ax.set_ylabel("Recall (%)")
    ax.set_title("DriftGuard validation recall")
    ax.set_ylim(0, 100)
    for i, value in enumerate(values):
        ax.text(i, min(value + 2, 98), f"{value:.1f}%", ha="center")
    fig.tight_layout()
    fig.savefig(PLOTS / "recall_comparison.png", dpi=180)
    plt.close(fig)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
