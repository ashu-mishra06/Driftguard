"""DriftGuard Module B inference using the frozen XGBoost v3 artifact."""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd


MODEL_PATH = (
    Path(__file__).resolve().parent
    / "models"
    / "driftguard_module_b_v3_FINAL.pkl"
)

PARAMETERS = ("iddq", "leakage", "prop_delay")
EXPECTED_RAW_FEATURES = [
    "iddq_0h",
    "iddq_24h",
    "leakage_0h",
    "leakage_24h",
    "prop_delay_0h",
    "prop_delay_24h",
]
EXPECTED_ENGINEERED_FEATURES = [
    "iddq_delta_24h",
    "iddq_rate_24h",
    "iddq_ratio_24h",
    "leakage_delta_24h",
    "leakage_rate_24h",
    "leakage_ratio_24h",
    "prop_delay_delta_24h",
    "prop_delay_rate_24h",
    "prop_delay_ratio_24h",
]

FROZEN_THRESHOLD = 1.25
PREDICTION_HORIZON_HOURS = 168.0

# Frozen constants from the supplied v3 specification/artifact.
FROZEN_SAFETY_SLOPES = {
    "iddq": 0.027820833,
    "leakage": 0.024041667,
    "prop_delay": 0.010827083,
}


def _load_bundle() -> dict:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Module B model not found: {MODEL_PATH}")

    bundle = joblib.load(MODEL_PATH)

    feature_columns = bundle.get("feature_columns")
    if feature_columns != EXPECTED_RAW_FEATURES + EXPECTED_ENGINEERED_FEATURES:
        raise ValueError(
            "Frozen Module B artifact feature_columns do not match the v3 contract."
        )

    if float(bundle.get("ratio_threshold")) != FROZEN_THRESHOLD:
        raise ValueError(
            "Frozen Module B artifact threshold differs from the required 1.25."
        )

    artifact_slopes = bundle.get("safety_slopes", {})
    for parameter, expected in FROZEN_SAFETY_SLOPES.items():
        if not np.isclose(float(artifact_slopes.get(parameter)), expected):
            raise ValueError(
                f"Frozen Module B artifact safety slope mismatch for {parameter}."
            )

    if set(bundle.get("models", {})) != set(PARAMETERS):
        raise ValueError("Frozen Module B artifact must contain three parameter models.")

    return bundle


MODULE_B = _load_bundle()
MODELS = MODULE_B["models"]
FEATURES = MODULE_B["feature_columns"]
SAFETY_SLOPES = FROZEN_SAFETY_SLOPES.copy()


def add_drift_features(df: pd.DataFrame) -> pd.DataFrame:
    """Reproduce the exact 15-feature engineering used by the frozen model."""
    out = df.copy()
    for parameter in PARAMETERS:
        v0 = out[f"{parameter}_0h"].astype(float)
        v24 = out[f"{parameter}_24h"].astype(float)

        out[f"{parameter}_delta_24h"] = v24 - v0
        out[f"{parameter}_rate_24h"] = (v24 - v0) / 24.0
        out[f"{parameter}_ratio_24h"] = np.where(
            np.abs(v0) > 1e-12,
            v24 / v0,
            1.0,
        )
    return out



def _predict_for_parameter(
    feature_frame: pd.DataFrame,
    source_df: pd.DataFrame,
    parameter: str,
) -> pd.DataFrame:
    model = MODELS[parameter]
    prediction = np.asarray(model.predict(feature_frame[FEATURES]), dtype=float)

    v0 = source_df[f"{parameter}_0h"].to_numpy(dtype=float)
    v24 = source_df[f"{parameter}_24h"].to_numpy(dtype=float)

    # Locked v3 formula from the acceptance criteria:
    # max(|pred_168h - v0|, |pred_168h - v24|) /
    # (safety_slope * 168h)
    predicted_drift = np.maximum(
        np.abs(prediction - v0),
        np.abs(prediction - v24),
    )
    safety_drift = SAFETY_SLOPES[parameter] * PREDICTION_HORIZON_HOURS
    drift_ratio = predicted_drift / safety_drift
    flagged = drift_ratio > FROZEN_THRESHOLD

    return pd.DataFrame(
        {
            "predicted_168h": prediction,
            "predicted_drift": predicted_drift,
            "safety_drift": safety_drift,
            "drift_ratio": drift_ratio,
            "flagged": flagged,
        },
        index=source_df.index,
    )



def predict_drift(df: pd.DataFrame) -> pd.DataFrame:
    """Run Module B for one-row-per-component wide input."""
    required = ["component_id", "lot_id", *EXPECTED_RAW_FEATURES]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Module B missing required columns: {missing}")

    if df[EXPECTED_RAW_FEATURES].isna().any().any():
        raise ValueError("Module B received missing 0h/24h values.")

    feature_frame = add_drift_features(df)
    result = df[["component_id", "lot_id"]].copy()
    per_parameter: Dict[str, pd.DataFrame] = {}

    for parameter in PARAMETERS:
        per_parameter[parameter] = _predict_for_parameter(
            feature_frame,
            df,
            parameter,
        )

        prediction_result = per_parameter[parameter]
        result[f"{parameter}_predicted_168h"] = prediction_result["predicted_168h"].to_numpy()
        result[f"{parameter}_predicted_drift"] = prediction_result["predicted_drift"].to_numpy()
        result[f"{parameter}_safety_drift"] = prediction_result["safety_drift"].to_numpy()
        result[f"{parameter}_drift_ratio"] = prediction_result["drift_ratio"].to_numpy()
        result[f"{parameter}_flagged"] = prediction_result["flagged"].to_numpy(dtype=bool)

    ratio_columns = [f"{p}_drift_ratio" for p in PARAMETERS]
    flag_columns = [f"{p}_flagged" for p in PARAMETERS]

    result["max_drift_ratio"] = result[ratio_columns].max(axis=1)
    result["flagged"] = result[flag_columns].any(axis=1)
    result["dominant_parameter"] = result[ratio_columns].idxmax(axis=1).str.replace(
        "_drift_ratio", "", regex=False
    )
    result["model_used"] = "xgboost_v3"
    result["threshold_multiplier"] = FROZEN_THRESHOLD

    def flagged_parameters(row: pd.Series) -> list[str]:
        return [
            parameter
            for parameter in PARAMETERS
            if bool(row[f"{parameter}_flagged"])
        ]

    result["flagged_parameters"] = result.apply(flagged_parameters, axis=1)

    def make_reason(row: pd.Series) -> str:
        flagged = row["flagged_parameters"]
        if not flagged:
            return "Predicted 168h drift remains within the frozen safety ratio threshold for all parameters."

        pieces = []
        for parameter in flagged:
            pieces.append(
                f"{_display_parameter(parameter)} drift ratio = "
                f"{row[f'{parameter}_drift_ratio']:.2f}x"
            )
        return (
            "Module B flag: "
            + "; ".join(pieces)
            + f" (threshold {FROZEN_THRESHOLD:.2f}x)."
        )

    result["reason"] = result.apply(make_reason, axis=1)
    return result



def _display_parameter(parameter: str) -> str:
    return {
        "iddq": "IDDQ",
        "leakage": "Leakage",
        "prop_delay": "Propagation Delay",
    }[parameter]


__all__ = [
    "FROZEN_SAFETY_SLOPES",
    "FROZEN_THRESHOLD",
    "MODEL_PATH",
    "add_drift_features",
    "predict_drift",
]
