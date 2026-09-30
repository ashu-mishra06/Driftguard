# DriftGuard synthetic datasets: generation notes

**ALL DATA IS SYNTHETIC (our own assumptions, not real test data).** Regenerate with `python generate_data.py`. Every number below comes from `CONFIG` in that script.

Tags: **[SPEC]** = from the team's answers; **[CHOSEN]** = not specified, chosen when the script was written, and changeable in `CONFIG`.

## Files

| File | Purpose |
|---|---|
| `synthetic_components_v1.csv`, `..._v2_stresstest.csv` | ONE file per version: the 14 wide-format data columns (`component_id, lot_id`, + 12 value columns) plus 4 ground-truth label columns (`is_defective, archetype, curve_shape, hidden_within_limits`) |

**The label columns are ground truth, not model input.** Any script that feeds this file to Module A/B for inference must drop `is_defective, archetype, curve_shape, hidden_within_limits` first; only training/evaluation code should read them. The 168h value columns are ground truth for MAE and must never be a model input either. Module B uses 0h and 24h only.

## Shared model

- Datasheet limits (our assumptions; leakage from the problem statement): {'iddq': 60.0, 'leakage': 50.0, 'prop_delay': 8.0}. A defect is *hidden* if all three 168h values are below these limits.
- Normal drift: `v(t) = v0*(1 + a*(1 - exp(-t/60h)))`, a = {'iddq': 0.03, 'leakage': 0.03, 'prop_delay': 0.005} [SPEC]; per-component a ~ N(a, 0.3*a) [CHOSEN].
- Defects: `v(t) = normal(t) * (1 + M*g(t))`, M = archetype multiplier x U(0.7, 1.3) per parameter (uniform, independent) [SPEC/CHOSEN]. Multipliers: {'Gate Oxide': {'iddq': 0.8, 'leakage': 2.5, 'prop_delay': 0.02}, 'Bond Wire': {'iddq': 0.03, 'leakage': 0.05, 'prop_delay': 0.25}, 'Generic Latent': {'iddq': 0.6, 'leakage': 0.6, 'prop_delay': 0.12}}.
- Curve shapes (random, independent of archetype, exact counts): {'accelerating': 0.5, 'linear': 0.3, 'saturating': 0.1, 'step': 0.1}. accelerating `g=(e^(t/70)-1)/(e^(168/70)-1)`; linear `g=t/168`; saturating `g=(1-e^(-t/40))/(1-e^(-168/40))`; step `g=0,0,1,1` at 0/24/96/168h [CHOSEN]. The mix is not tuned to favour any model. Report Module B MAE per `curve_shape`.
- Severe defects [CHOSEN]: 35% of defects (random) have multipliers x2.0, so some defects exceed datasheet limits. Without this, almost every defect would stay inside the limits and a static-limit baseline would catch about none.
- Measurement noise: independent Gaussian, % of reading, every measurement including 0h.
- Drift rate definition: `(value_168h - value_0h) / 168` (units/hour) for predictions and ground truth. Safety slope = 95th percentile among non-defective v1 components, per parameter.

## v1

- Seed 42; 8 lots x 150 components = 1200; IDs from C0001, lots from L01.
- Baselines {'iddq': 12.0, 'leakage': 10.0, 'prop_delay': 5.4}; lot-to-lot +-{'iddq': 0.1, 'leakage': 0.1, 'prop_delay': 0.03} (uniform); within-lot std {'iddq': 0.06, 'leakage': 0.08, 'prop_delay': 0.02}; noise 2%.
- Defective: **96** by archetype {'Gate Oxide': 40, 'Bond Wire': 30, 'Generic Latent': 26}; by curve shape {'accelerating': 48, 'linear': 29, 'saturating': 10, 'step': 9}.
- Defects per lot: {'L01': 10, 'L02': 12, 'L03': 15, 'L04': 20, 'L05': 2, 'L06': 5, 'L07': 24, 'L08': 8}.
- **Hidden defects (all 168h values under datasheet limits): 79 of 96 (82%).** Defects exceeding a limit: 17.
- Normal components exceeding a limit at 168h: 0.

## v2_stresstest

- Seed 2026; 5 lots x 200 components = 1000; IDs from C2001, lots from L11.
- Baselines {'iddq': 14.0, 'leakage': 12.0, 'prop_delay': 5.8}; lot-to-lot +-{'iddq': 0.15, 'leakage': 0.15, 'prop_delay': 0.15} (uniform); within-lot std {'iddq': 0.06, 'leakage': 0.08, 'prop_delay': 0.02}; noise 4%.
- Defective: **100** by archetype {'Bond Wire': 50, 'Generic Latent': 30, 'Gate Oxide': 20}; by curve shape {'accelerating': 50, 'linear': 30, 'saturating': 10, 'step': 10}.
- Defects per lot: {'L11': 40, 'L12': 10, 'L13': 18, 'L14': 30, 'L15': 2}.
- **Hidden defects (all 168h values under datasheet limits): 69 of 100 (69%).** Defects exceeding a limit: 31.
- Normal components exceeding a limit at 168h: 0.
