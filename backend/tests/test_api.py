from pathlib import Path

from fastapi.testclient import TestClient

from main import app


ROOT = Path(__file__).resolve().parents[3]
client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_analyze_wide_csv():
    with open(ROOT / "data" / "synthetic_components_v2_stresstest.csv", "rb") as handle:
        response = client.post(
            "/analyze",
            files={"file": ("synthetic_components_v2_stresstest.csv", handle, "text/csv")},
        )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["metadata"]["models_used"]["module_b"] == "xgboost_v3"
    assert payload["metadata"]["module_a_threshold"] == 4.5
    assert payload["metadata"]["module_b_threshold_multiplier"] == 1.25
    assert len(payload["components"]) == 1000
    assert payload["summary"] == {
        "total_flagged_a": 65,
        "total_flagged_b": 439,
        "total_reject": 53,
        "total_flag_for_review": 401,
        "total_pass": 546,
    }
    assert payload["components"][0]["ground_truth"] is None
