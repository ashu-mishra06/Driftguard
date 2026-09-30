import { useEffect, useMemo, useState } from "react";
import {
  getResultVerdict,
  loadAnalysisResults,
} from "../utils/analysisStore";

const PAGE_SIZE = 50;

function verdictClass(verdict) {
  if (verdict === "REJECT") return "status-badge status-anomaly";
  if (verdict === "PASS") return "status-badge status-normal";
  return "status-badge";
}

function truthValue(result) {
  const value = result?.ground_truth?.is_defective;

  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

function evaluationLabel(result) {
  const actual = truthValue(result);
  const verdict = getResultVerdict(result);

  if (actual === null || !verdict) return "NOT AVAILABLE";

  const detected = verdict !== "PASS";

  if (actual && detected) return "TRUE POSITIVE";
  if (!actual && detected) return "FALSE POSITIVE";
  if (actual && !detected) return "FALSE NEGATIVE";
  return "TRUE NEGATIVE";
}

function isDetected(result) {
  const verdict = getResultVerdict(result);
  return verdict === "REJECT" || verdict === "FLAG_FOR_REVIEW";
}

function Validation({ analysisResults = [] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Also recover persisted results when this page is opened directly after a
  // refresh and the parent has not yet populated its in-memory state.
  const effectiveResults = useMemo(
    () => (analysisResults.length ? analysisResults : loadAnalysisResults()),
    [analysisResults]
  );

  useEffect(() => {
    setPage(1);
  }, [search, effectiveResults.length]);

  const validationRows = useMemo(
    () =>
      effectiveResults.map((result) => ({
        ...result,
        verdict: getResultVerdict(result),
        actualDefective: truthValue(result),
        evaluation: evaluationLabel(result),
      })),
    [effectiveResults]
  );

  const metrics = useMemo(() => {
    const labelled = validationRows.filter(
      (row) => row.actualDefective !== null
    );

    if (!labelled.length) {
      return {
        labelled: 0,
        defects: 0,
        detected: 0,
        tp: 0,
        fp: 0,
        tn: 0,
        fn: 0,
        precision: null,
        recall: null,
        accuracy: null,
      };
    }

    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    labelled.forEach((row) => {
      const actual = row.actualDefective === true;
      const predicted = isDetected(row);

      if (actual && predicted) tp += 1;
      else if (!actual && predicted) fp += 1;
      else if (!actual && !predicted) tn += 1;
      else fn += 1;
    });

    return {
      labelled: labelled.length,
      defects: tp + fn,
      detected: tp + fp,
      tp,
      fp,
      tn,
      fn,
      precision: tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0,
      recall: tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0,
      accuracy: (tp + tn) / labelled * 100,
    };
  }, [validationRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return validationRows;

    return validationRows.filter((row) => {
      const haystack = [
        row.component_id,
        row.lot_id,
        row.verdict,
        row.evaluation,
        row.module_a?.signature,
        row.module_b?.dominant_parameter,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [validationRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  if (!effectiveResults.length) {
    return (
      <div className="validation-page">
        <div className="upload-page-header">
          <span className="upload-eyebrow">VALIDATION</span>
          <h1>Domain-Shift Stress Test</h1>
          <p>
            Review the actual backend decisions against ground-truth labels in
            the uploaded validation dataset.
          </p>
        </div>

        <div className="upload-panel">
          <div className="dataset-note">
            <strong>ⓘ No analysis results available</strong>
            <p>
              Upload a wide-format CSV and click Analyze. The Validation page
              will then use the exact component results returned by FastAPI.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="validation-page">
      <div className="upload-page-header">
        <span className="upload-eyebrow">VALIDATION</span>
        <h1>Domain-Shift Stress Test</h1>
        <p>
          Component-level validation of the backend verdicts against the
          optional ground-truth labels carried by the uploaded dataset.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div className="dashboard-stat-card">
          <span className="stat-label">ANALYZED</span>
          <strong>{validationRows.length}</strong>
          <small>Backend component results</small>
        </div>

        <div className="dashboard-stat-card">
          <span className="stat-label">DEFECT LABELS</span>
          <strong>{metrics.labelled}</strong>
          <small>
            {metrics.labelled ? `${metrics.defects} defective` : "Not supplied"}
          </small>
        </div>

        <div className="dashboard-stat-card">
          <span className="stat-label">RECALL</span>
          <strong>
            {metrics.recall == null ? "—" : `${metrics.recall.toFixed(2)}%`}
          </strong>
          <small>Defect detection using non-PASS as detection</small>
        </div>

        <div className="dashboard-stat-card">
          <span className="stat-label">PRECISION</span>
          <strong>
            {metrics.precision == null ? "—" : `${metrics.precision.toFixed(2)}%`}
          </strong>
          <small>Among components flagged by the combined verdict</small>
        </div>
      </div>

      <div className="upload-panel" style={{ marginBottom: "20px" }}>
        <div className="upload-panel-title">
          <div className="upload-title-icon">✓</div>
          <div>
            <h2>Backend Result Verification</h2>
            <p>
              The Result column below is read directly from the backend's
              <code>verdict</code> field. It is not inferred from the ground
              truth label.
            </p>
          </div>
        </div>

        <div
          className="dataset-note"
          style={{ marginTop: "14px", marginBottom: 0 }}
        >
          <strong>Evaluation counts</strong>
          <p style={{ marginBottom: 0 }}>
            TP: {metrics.tp} · FP: {metrics.fp} · TN: {metrics.tn} · FN: {metrics.fn}
            {metrics.accuracy != null
              ? ` · Accuracy: ${metrics.accuracy.toFixed(2)}%`
              : ""}
          </p>
        </div>
      </div>

      <div className="components-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "18px 18px 0",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Component Results</h2>
            <p style={{ marginTop: "6px", color: "#6b7280" }}>
              Showing {filteredRows.length} matched components from {validationRows.length} analyzed.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search component, lot, verdict..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              minWidth: "280px",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
            }}
          />
        </div>

        <div className="component-table-container">
          <table>
            <thead>
              <tr>
                <th>Component ID</th>
                <th>Lot ID</th>
                <th>Module A</th>
                <th>Module B</th>
                <th>Result</th>
                <th>Ground Truth</th>
                <th>Evaluation</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.component_id}>
                  <td><strong>{row.component_id}</strong></td>
                  <td>{row.lot_id}</td>
                  <td>{row.module_a?.flagged ? "FLAGGED" : "CLEAR"}</td>
                  <td>{row.module_b?.flagged ? "FLAGGED" : "CLEAR"}</td>
                  <td>
                    <span className={verdictClass(row.verdict)}>
                      {row.verdict === "FLAG_FOR_REVIEW"
                        ? "FLAG FOR REVIEW"
                        : row.verdict || "—"}
                    </span>
                  </td>
                  <td>
                    {row.actualDefective === null
                      ? "—"
                      : row.actualDefective
                        ? "DEFECTIVE"
                        : "NORMAL"}
                  </td>
                  <td>{row.evaluation}</td>
                </tr>
              ))}

              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan="7" className="no-results">
                    No matching components.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 18px 18px",
            gap: "12px",
          }}
        >
          <span style={{ color: "#6b7280" }}>
            Page {safePage} of {totalPages}
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Validation;
