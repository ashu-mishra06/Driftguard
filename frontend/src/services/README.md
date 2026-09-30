# DriftGuard API wiring

This directory contains the backend-facing client only. It does not change the
existing dashboard UI.

Use `analyzeCsv(file)` after a CSV has been selected:

```js
import { analyzeCsv } from "./services/driftguardApi";

const result = await analyzeCsv(file);
setAnalysis(result);
```

Set `VITE_DRIFTGUARD_API_URL` when the FastAPI server is not running on
`http://localhost:8000`.

The backend accepts the final wide CSV contract and returns:

- `metadata`
- `components[]`
- `summary`

Ground truth remains under `component.ground_truth` and is never used by the
analysis modules.
