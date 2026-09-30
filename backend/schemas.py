from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class GroundTruth(BaseModel):
    model_config = ConfigDict(extra="allow")
    is_defective: Optional[bool] = None
    archetype: Optional[str] = None
    curve_shape: Optional[str] = None
    hidden_within_limits: Optional[bool] = None


class ModuleAResult(BaseModel):
    anomaly_score: float
    flagged: bool
    method: str
    threshold: float
    dominant_parameter: str
    dominant_timestamp_h: int
    signature: Optional[str] = None
    signature_confidence: Optional[float] = None
    signature_distance: Optional[float] = None
    cost_weight: Optional[str] = None
    reason: str


class ModuleBParameterResult(BaseModel):
    predicted_168h: float
    predicted_drift: float
    safety_drift: float
    drift_ratio: float
    flagged: bool


class ModuleBResult(BaseModel):
    predicted_168h: Dict[str, float]
    per_parameter: Dict[str, ModuleBParameterResult]
    max_drift_ratio: float
    flagged: bool
    dominant_parameter: str
    threshold_multiplier: float
    model_used: str
    flagged_parameters: List[str]
    reason: str


class ComponentResult(BaseModel):
    component_id: str
    lot_id: str
    timestamps_available: List[str]
    raw_values: Dict[str, Dict[str, float]]
    module_a: ModuleAResult
    module_b: ModuleBResult
    verdict: str = Field(pattern=r"^(REJECT|FLAG_FOR_REVIEW|PASS)$")
    explanation: str
    recommendation: str
    cost_weight: Optional[str] = None
    ground_truth: Optional[GroundTruth] = None


class AnalysisMetadata(BaseModel):
    upload_timestamp: str
    total_components: int
    lots: List[str]
    models_used: Dict[str, str]
    module_a_threshold: float
    module_b_threshold_multiplier: float
    labels_supplied: bool
    policy_status: str


class AnalysisSummary(BaseModel):
    total_flagged_a: int
    total_flagged_b: int
    total_reject: int
    total_flag_for_review: int
    total_pass: int


class AnalysisResponse(BaseModel):
    metadata: AnalysisMetadata
    components: List[ComponentResult]
    summary: AnalysisSummary
