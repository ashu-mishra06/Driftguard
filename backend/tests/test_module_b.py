from pathlib import Path

import pandas as pd

from module_b import FROZEN_THRESHOLD, predict_drift


ROOT = Path(__file__).resolve().parents[3]


def test_module_b_on_v2():
    df = pd.read_csv(ROOT / "data" / "synthetic_components_v2_stresstest.csv")
    result = predict_drift(df)

    assert len(result) == len(df)
    assert FROZEN_THRESHOLD == 1.25
    assert result["flagged"].dtype == bool
    for parameter in ("iddq", "leakage", "prop_delay"):
        assert f"{parameter}_predicted_168h" in result.columns
        assert f"{parameter}_drift_ratio" in result.columns
