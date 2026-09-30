# DriftGuard FastAPI Backend — Ashutosh Integration Track

This backend is the integration layer for the DriftGuard expert-evaluation core pipeline.

## Scope

- Wide CSV validation.
- FastAPI `/analyze` endpoint.
- Runtime Module A + frozen XGBoost Module B wiring.
- Combined verdict policy.
- Reviewer-readable JSON contract.
- Health/model-info endpoints.

The React client helper is in `../frontend/src/services/driftguardApi.js`.

## Input

One wide CSV, one row per component:

`component_id, lot_id, iddq_0h, iddq_24h, iddq_96h, iddq_168h, leakage_0h, leakage_24h, leakage_96h, leakage_168h, prop_delay_0h, prop_delay_24h, prop_delay_96h, prop_delay_168h`

Optional metadata may include `is_defective`, `archetype`, `curve_shape`, and `hidden_within_limits`.

Those labels are preserved for demo/evaluation only and are never passed to either module.

## Frozen integration rules

Module A:

- runtime lot median/MAD;
- 0h, 24h, 96h only;
- 2% tolerance;
- strict `anomaly_score > 4.5`.

Module B:

- frozen `driftguard_module_b_v3_FINAL.pkl`;
- 15 early-life features built from 0h/24h;
- XGBoost regressors for IDDQ, leakage, prop_delay;
- threshold `max_drift_ratio > 1.25`;
- locked drift formula uses the maximum absolute prediction difference to 0h/24h divided by `safety_slope * 168h`.

Verdict:

- A + B -> `REJECT`;
- A-only + high-cost signature -> `REJECT`;
- A-only otherwise -> `FLAG_FOR_REVIEW`;
- B-only -> `FLAG_FOR_REVIEW`;
- neither -> `PASS`.

The v3 specification calls this combined rule a proposal for approval. The backend exposes that fact as `policy_status`.

Cost weights are project assumptions, not sourced industry figures.

## Run locally

```bash
cd code/backend
python -m venv .venv
# activate the environment
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open `http://localhost:8000/docs`.

## Tests

From `code/backend`:

```bash
pytest -q
```

## Validation artifacts

From the repository root:

```bash
python validation/run_stress_test.py
```

Outputs are written to `/results` and `/results/plots`.
