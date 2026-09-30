from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from module_a import ANOMALY_THRESHOLD, detect_outliers
from module_b import FROZEN_THRESHOLD, predict_drift
from schemas import AnalysisResponse
from verdict import POLICY_STATUS, compute_verdict


app = FastAPI(
    title="DriftGuard Backend",
    version="3.1.0",
    description="FastAPI integration layer for DriftGuard SIH expert-evaluation pipeline.",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


REQUIRED_COLUMNS = [
    "component_id",
    "lot_id",
    "iddq_0h",
    "iddq_24h",
    "iddq_96h",
    "iddq_168h",
    "leakage_0h",
    "leakage_24h",
    "leakage_96h",
    "leakage_168h",
    "prop_delay_0h",
    "prop_delay_24h",
    "prop_delay_96h",
    "prop_delay_168h",
]

OPTIONAL_METADATA_COLUMNS = [
    "is_defective",
    "archetype",
    "curve_shape",
    "hidden_within_limits",
]
PARAMETER_KEYS = ("iddq", "leakage", "prop_delay")
TIMESTAMPS = (0, 24, 96, 168)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "running", "service": "DriftGuard Backend", "version": "3.1.0"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/model-info")
def model_info() -> dict[str, Any]:
    return {
        "module_a": {
            "model_used": "robust_zscore_v1",
            "threshold": ANOMALY_THRESHOLD,
            "tolerance": 0.02,
            "input_timestamps": ["0h", "24h", "96h"],
        },
        "module_b": {
            "model_used": "xgboost_v3",
            "threshold_multiplier": FROZEN_THRESHOLD,
            "input_timestamps": ["0h", "24h"],
            "prediction_timestamp": "168h",
        },
        "policy_status": POLICY_STATUS,
    }



def _parse_bool(value: Any) -> Optional[bool]:
    if pd.isna(value):
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer, float, np.floating)):
        if value in (0, 1):
            return bool(int(value))
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return True
    if text in {"0", "false", "no", "n"}:
        return False
    raise ValueError(f"Unsupported boolean value: {value!r}")



def validate_and_normalize_csv(df: pd.DataFrame) -> pd.DataFrame:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(
            "CSV is missing required wide-format columns: " + ", ".join(missing)
        )

    if df.empty:
        raise ValueError("CSV contains no component rows.")

    if df["component_id"].isna().any() or df["lot_id"].isna().any():
        raise ValueError("component_id and lot_id cannot contain missing values.")

    if df["component_id"].duplicated().any():
        duplicates = df.loc[df["component_id"].duplicated(), "component_id"].astype(str).unique().tolist()
        raise ValueError(
            f"Wide-format CSV must contain one row per component. Duplicate component_id values: {duplicates[:10]}"
        )

    numeric_columns = [column for column in REQUIRED_COLUMNS if column not in {"component_id", "lot_id"}]
    normalized = df.copy()
    for column in numeric_columns:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce")

    if normalized[numeric_columns].isna().any().any():
        bad_columns = normalized[numeric_columns].columns[
            normalized[numeric_columns].isna().any()
        ].tolist()
        raise ValueError(
            "Required numeric measurement columns contain missing/non-numeric values: "
            + ", ".join(bad_columns)
        )

    numeric_array = normalized[numeric_columns].to_numpy(dtype=float)
    if not np.isfinite(numeric_array).all():
        raise ValueError("Measurement columns must contain only finite numeric values.")

    for column in ["component_id", "lot_id"]:
        normalized[column] = normalized[column].astype(str).str.strip()
        if (normalized[column] == "").any():
            raise ValueError(f"{column} cannot contain empty strings.")

    if "is_defective" in normalized.columns:
        normalized["is_defective"] = normalized["is_defective"].map(_parse_bool)
    if "hidden_within_limits" in normalized.columns:
        normalized["hidden_within_limits"] = normalized["hidden_within_limits"].map(_parse_bool)

    return normalized



def _clean_value(value: Any) -> Any:
    if value is None or (isinstance(value, float) and not np.isfinite(value)):
        return None
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    if isinstance(value, np.bool_):
        return bool(value)
    return value




def _build_raw_values_explicit(row: pd.Series) -> Dict[str, Dict[str, float]]:
    return {
        "iddq": {f"{t}h": float(row[f"iddq_{t}h"]) for t in TIMESTAMPS},
        "leakage": {f"{t}h": float(row[f"leakage_{t}h"]) for t in TIMESTAMPS},
        "prop_delay": {f"{t}h": float(row[f"prop_delay_{t}h"]) for t in TIMESTAMPS},
    }



def _ground_truth_from_row(row: pd.Series) -> Optional[Dict[str, Any]]:
    supplied = any(column in row.index for column in OPTIONAL_METADATA_COLUMNS)
    if not supplied:
        return None

    payload: Dict[str, Any] = {}
    for column in OPTIONAL_METADATA_COLUMNS:
        if column in row.index:
            payload[column] = _clean_value(row[column])
    return payload



def _build_component(
    row: pd.Series,
    module_a_row: pd.Series,
    module_b_row: pd.Series,
) -> Dict[str, Any]:
    a = {
        "anomaly_score": float(module_a_row["anomaly_score"]),
        "flagged": bool(module_a_row["flagged"]),
        "method": str(module_a_row["method"]),
        "threshold": float(module_a_row["threshold"]),
        "dominant_parameter": str(module_a_row["dominant_parameter"]),
        "dominant_timestamp_h": int(module_a_row["dominant_timestamp_h"]),
        "signature": module_a_row["signature"],
        "signature_confidence": _clean_value(module_a_row["signature_confidence"]),
        "signature_distance": _clean_value(module_a_row["signature_distance"]),
        "cost_weight": module_a_row["cost_weight"],
        "reason": str(module_a_row["reason"]),
    }

    per_parameter = {}
    predicted = {}
    for parameter in PARAMETER_KEYS:
        predicted[parameter] = float(module_b_row[f"{parameter}_predicted_168h"])
        per_parameter[parameter] = {
            "predicted_168h": float(module_b_row[f"{parameter}_predicted_168h"]),
            "predicted_drift": float(module_b_row[f"{parameter}_predicted_drift"]),
            "safety_drift": float(module_b_row[f"{parameter}_safety_drift"]),
            "drift_ratio": float(module_b_row[f"{parameter}_drift_ratio"]),
            "flagged": bool(module_b_row[f"{parameter}_flagged"]),
        }

    b = {
        "predicted_168h": predicted,
        "per_parameter": per_parameter,
        "max_drift_ratio": float(module_b_row["max_drift_ratio"]),
        "flagged": bool(module_b_row["flagged"]),
        "dominant_parameter": str(module_b_row["dominant_parameter"]),
        "threshold_multiplier": float(module_b_row["threshold_multiplier"]),
        "model_used": str(module_b_row["model_used"]),
        "flagged_parameters": list(module_b_row["flagged_parameters"]),
        "reason": str(module_b_row["reason"]),
    }

    verdict = compute_verdict(a, b)

    result = {
        "component_id": str(row["component_id"]),
        "lot_id": str(row["lot_id"]),
        "timestamps_available": [f"{t}h" for t in TIMESTAMPS],
        "raw_values": _build_raw_values_explicit(row),
        "module_a": a,
        "module_b": b,
        "verdict": verdict["verdict"],
        "explanation": verdict["explanation"],
        "recommendation": verdict["recommendation"],
        "cost_weight": verdict["cost_weight"],
    }

    gt = _ground_truth_from_row(row)
    if gt is not None:
        result["ground_truth"] = gt
    return result


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(BytesIO(contents))
        df = validate_and_normalize_csv(df)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}") from exc

    try:
        module_a_df = detect_outliers(df)
        module_b_df = predict_drift(df)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis pipeline failed: {exc}") from exc

    module_a_index = module_a_df.set_index("component_id")
    module_b_index = module_b_df.set_index("component_id")

    components: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        component_id = str(row["component_id"])
        components.append(
            _build_component(
                row,
                module_a_index.loc[component_id],
                module_b_index.loc[component_id],
            )
        )

    summary = {
        "total_flagged_a": int(module_a_df["flagged"].sum()),
        "total_flagged_b": int(module_b_df["flagged"].sum()),
        "total_reject": sum(c["verdict"] == "REJECT" for c in components),
        "total_flag_for_review": sum(c["verdict"] == "FLAG_FOR_REVIEW" for c in components),
        "total_pass": sum(c["verdict"] == "PASS" for c in components),
    }

    labels_supplied = "is_defective" in df.columns
    response = {
        "metadata": {
            "upload_timestamp": datetime.now(timezone.utc).isoformat(),
            "total_components": int(len(df)),
            "lots": sorted(df["lot_id"].astype(str).unique().tolist()),
            "models_used": {
                "module_a": "robust_zscore_v1",
                "module_b": "xgboost_v3",
            },
            "module_a_threshold": ANOMALY_THRESHOLD,
            "module_b_threshold_multiplier": FROZEN_THRESHOLD,
            "labels_supplied": labels_supplied,
            "policy_status": POLICY_STATUS,
        },
        "components": components,
        "summary": summary,
    }
    return response
