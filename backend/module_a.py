"""DriftGuard Module A: runtime lot-relative anomaly detection.

Production rules from Core_SIH-2026_v3.1.txt:
- Uses only 0h, 24h and 96h measurements.
- Computes median + MAD at runtime for each (lot_id, timestamp_h).
- Applies a 2% measurement-tolerance margin.
- Component score is the maximum adjusted MAD score across all parameters/times.
- Frozen threshold is strict > 4.5.
- Flagged components receive a physics-informed signature match.

The V1 train_params table stored in Mohit's pickle is deliberately not loaded by
this module. The signature prototype values are copied from that calibration
artifact because the backend must work on unseen lot IDs at runtime.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable

import numpy as np
import pandas as pd


TOLERANCE = 0.02
ANOMALY_THRESHOLD = 4.5
MODULE_A_INPUT_TIMESTAMPS = (0, 24, 96)
PARAMETERS = ("iddq", "leakage", "prop_delay")

MEASUREMENT_COLUMNS = {
    "iddq": {0: "iddq_0h", 24: "iddq_24h", 96: "iddq_96h"},
    "leakage": {0: "leakage_0h", 24: "leakage_24h", 96: "leakage_96h"},
    "prop_delay": {0: "prop_delay_0h", 24: "prop_delay_24h", 96: "prop_delay_96h"},
}

# Prototype vectors from Re_Train_Module_A_inpkl.pkl / Mohit's notebook.
SIGNATURE_PROTOTYPES: Dict[str, np.ndarray] = {
    "Gate Oxide Degradation": np.array([0.80, 2.50, 0.02], dtype=float),
    "Bond Wire Fatigue": np.array([0.03, 0.05, 0.25], dtype=float),
    "Generic Latent Defect": np.array([0.60, 0.60, 0.12], dtype=float),
}

# Available type-level evaluation numbers in the supplied V2 artifact.
# These are informational UI confidence values; they are not used to create
# a model score or to leak ground-truth labels into production inference.
SIGNATURE_VALIDATION_CONFIDENCE = {
    "Gate Oxide Degradation": 0.75,
    "Bond Wire Fatigue": 1.00,
    "Generic Latent Defect": 0.88,
}


def _validate_columns(df: pd.DataFrame) -> None:
    required = [
        "component_id",
        "lot_id",
        "iddq_0h",
        "iddq_24h",
        "iddq_96h",
        "leakage_0h",
        "leakage_24h",
        "leakage_96h",
        "prop_delay_0h",
        "prop_delay_24h",
        "prop_delay_96h",
    ]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Module A missing required columns: {missing}")



def _build_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Compute per-lot runtime statistics for all three Module A timestamps."""
    rows = []
    for (lot_id,), lot_group in df.groupby(["lot_id"]):
        for timestamp in MODULE_A_INPUT_TIMESTAMPS:
            row = {"lot_id": lot_id, "timestamp_h": timestamp}
            for parameter in PARAMETERS:
                column = MEASUREMENT_COLUMNS[parameter][timestamp]
                values = lot_group[column].to_numpy(dtype=float)
                median = float(np.median(values))
                mad = float(np.median(np.abs(values - median)))
                row[f"{parameter}_median"] = median
                row[f"{parameter}_mad"] = mad
                row[f"{parameter}_count"] = int(values.size)
            rows.append(row)
    return pd.DataFrame(rows)



def _safe_score(value: float, median: float, mad: float) -> float:
    """Tolerance-adjusted MAD score with explicit MAD=0 protection."""
    adjusted_deviation = max(0.0, abs(value - median) - TOLERANCE * value)

    if mad == 0.0:
        if adjusted_deviation == 0.0:
            return 0.0
        return float("inf")

    return adjusted_deviation / mad



def _match_signature(vector: np.ndarray) -> tuple[str | None, float | None]:
    """Match a normalized parameter-drift vector to the frozen prototypes."""
    norm = float(np.linalg.norm(vector))
    if norm == 0.0 or not np.isfinite(norm):
        return None, None

    actual = vector / norm
    distances = {}
    for name, prototype in SIGNATURE_PROTOTYPES.items():
        prototype_norm = prototype / np.linalg.norm(prototype)
        distances[name] = float(np.linalg.norm(actual - prototype_norm))

    signature = min(distances, key=distances.get)
    return signature, distances[signature]



def detect_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """Run production Module A and return one row per component."""
    _validate_columns(df)

    result = df.copy()
    stats = _build_stats(result)

    score_records = []
    for parameter in PARAMETERS:
        for timestamp in MODULE_A_INPUT_TIMESTAMPS:
            value_column = MEASUREMENT_COLUMNS[parameter][timestamp]
            stats_key = stats[["lot_id", "timestamp_h", f"{parameter}_median", f"{parameter}_mad"]]
            merged = result[["component_id", "lot_id", value_column]].merge(
                stats_key[stats_key["timestamp_h"] == timestamp],
                on="lot_id",
                how="left",
            )
            merged["parameter"] = parameter
            merged["timestamp_h"] = timestamp
            merged["value"] = merged[value_column].astype(float)
            merged["score"] = merged.apply(
                lambda row: _safe_score(
                    float(row["value"]),
                    float(row[f"{parameter}_median"]),
                    float(row[f"{parameter}_mad"]),
                ),
                axis=1,
            )
            score_records.append(
                merged[
                    [
                        "component_id",
                        "lot_id",
                        "parameter",
                        "timestamp_h",
                        "value",
                        f"{parameter}_median",
                        f"{parameter}_mad",
                        "score",
                    ]
                ]
            )

    scores = pd.concat(score_records, ignore_index=True)

    component_rows = []
    for (component_id, lot_id), group in scores.groupby(["component_id", "lot_id"], sort=False):
        highest_idx = group["score"].idxmax()
        highest = group.loc[highest_idx]
        anomaly_score = float(group["score"].max())
        flagged = bool(anomaly_score > ANOMALY_THRESHOLD)

        parameter_pattern = np.array(
            [
                float(group.loc[group["parameter"] == p, "score"].max())
                for p in PARAMETERS
            ],
            dtype=float,
        )

        signature = None
        signature_distance = None
        signature_confidence = None
        cost_weight = None
        if flagged:
            signature, signature_distance = _match_signature(parameter_pattern)
            if signature is not None:
                signature_confidence = SIGNATURE_VALIDATION_CONFIDENCE.get(signature)
                cost_weight = {
                    "Gate Oxide Degradation": "high",
                    "Bond Wire Fatigue": "medium",
                    "Generic Latent Defect": "low",
                }.get(signature)

        if flagged:
            dominant_param = str(highest["parameter"])
            dominant_median = float(highest[f"{dominant_param}_median"])
            reason = (
                f"{_display_parameter(dominant_param)} "
                f"{float(highest["value"]):.4f} vs lot median "
                f"{dominant_median:.4f} "
                f"({anomaly_score:.2f} MAD after 2% tolerance)"
            )
            if signature:
                reason += f"; pattern matches {signature}"
        else:
            reason = "No significant anomaly detected"

        dominant_parameter = str(highest["parameter"])
        dominant_timestamp = int(highest["timestamp_h"])

        component_rows.append(
            {
                "component_id": str(component_id),
                "lot_id": str(lot_id),
                "anomaly_score": anomaly_score,
                "flagged": flagged,
                "method": "runtime_mad_zscore",
                "threshold": ANOMALY_THRESHOLD,
                "dominant_parameter": dominant_parameter,
                "dominant_timestamp_h": dominant_timestamp,
                "signature": signature,
                "signature_confidence": signature_confidence,
                "signature_distance": signature_distance,
                "cost_weight": cost_weight,
                "reason": reason,
            }
        )

    return pd.DataFrame(component_rows)



def _display_parameter(parameter: str) -> str:
    return {
        "iddq": "IDDQ",
        "leakage": "Leakage",
        "prop_delay": "Propagation Delay",
    }[parameter]


__all__ = [
    "ANOMALY_THRESHOLD",
    "TOLERANCE",
    "detect_outliers",
]
