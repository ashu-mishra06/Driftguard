from pathlib import Path

import pandas as pd

from module_a import ANOMALY_THRESHOLD, TOLERANCE, detect_outliers


ROOT = Path(__file__).resolve().parents[3]


def test_module_a_on_v2():
    df = pd.read_csv(ROOT / "data" / "synthetic_components_v2_stresstest.csv")
    result = detect_outliers(df)

    assert len(result) == len(df)
    assert result["flagged"].dtype == bool
    assert ANOMALY_THRESHOLD == 4.5
    assert TOLERANCE == 0.02
    assert set(result.columns) >= {
        "component_id",
        "lot_id",
        "anomaly_score",
        "flagged",
        "signature",
    }
