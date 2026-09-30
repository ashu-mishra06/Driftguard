# DriftGuard Results

These files are generated from the frozen backend artifacts and datasets.

`stress_test_metrics.json` contains Module A, Module B, static-baseline and
combined-verdict metrics. `module_b_mae_comparison.csv` compares the frozen
XGBoost predictor against the two-point baseline `V24 + 7*(V24 - V0)`.

`stress_test_component_results_v2.csv` is the component-level V2 evaluation
used to support the reviewer-facing domain-shift claims. The plot in
`plots/recall_comparison.png` is generated from the same numbers.

Run from the repository root:

```bash
python validation/run_stress_test.py
```
