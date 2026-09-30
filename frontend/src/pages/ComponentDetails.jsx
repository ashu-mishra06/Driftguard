import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { loadCSVData, getComponentData } from "../utils/csvData";
import { loadAnalysisResults, getAnalysisForComponent } from "../utils/analysisStore";

function ComponentDetails({ analysisResults = [] }) {
  const { id } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const effectiveResults = useMemo(
    () => (analysisResults.length ? analysisResults : loadAnalysisResults()),
    [analysisResults]
  );

  const analysis = getAnalysisForComponent(effectiveResults, id);

  useEffect(() => {
    loadCSVData()
      .then((data) => {
        setRows(getComponentData(data, id));
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load component details:", error);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div>Loading component...</div>;

  if (rows.length === 0) {
    return (
      <div>
        <h2>Component not found</h2>
        <Link to="/components">Back to Components</Link>
      </div>
    );
  }

  const component = rows[0];
  const finalVerdict = analysis?.final_verdict || "NOT ANALYZED";
  const rejected = finalVerdict === "REJECT";

  const moduleA = analysis?.module_a;
  const moduleB = analysis?.module_b;
  const signature =
    moduleA?.matched_signature ?? moduleA?.signature ?? null;
  const signatureConfidence =
    moduleA?.signature_confidence ?? moduleA?.confidence ?? null;

  const predictionMap = moduleB?.predicted_168h || {};
  const leakagePrediction = predictionMap.leakage ?? null;
  const maxDriftRatio = moduleB?.max_drift_ratio ?? null;
  const dominantParameter =
    moduleB?.dominant_parameter ??
    moduleB?.dominantParameter ??
    null;

  return (
    <div className="component-details-page">
      <Link to="/components" className="back-button">← Back to Components</Link>

      <div className="page-heading">
        <h2>{component.component_id}</h2>
        <p>Component details from the current analyzed CSV dataset.</p>
      </div>

      <div className="detail-card">
        <div className="detail-header">
          <div>
            <h3>{component.component_id}</h3>
            <p>Lot: {component.lot_id}</p>
          </div>

          <span
            className={
              finalVerdict === "PASS"
                ? "status-badge status-normal"
                : finalVerdict === "REJECT"
                  ? "status-badge status-anomaly"
                  : "status-badge"
            }
          >
            {finalVerdict}
          </span>
        </div>

        <div className="measurement-grid">
          {rows.map((row) => (
            <div className="measurement-card" key={row.timestamp_h}>
              <span>{row.timestamp_h}h</span>
              <strong>{Number(row.leakage_uA).toFixed(3)} µA</strong>
              <small>Leakage</small>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-card detail-chart">
        <h3>Leakage Current Trend</h3>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={rows} margin={{ top: 15, right: 25, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp_h" label={{ value: "Time (hours)", position: "bottom", offset: 15 }} />
            <YAxis label={{ value: "Leakage (µA)", angle: -90, position: "insideLeft", offset: 5 }} />
            <Tooltip />
            <Line type="monotone" dataKey="leakage_uA" stroke="#2563eb" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="analysis-grid">
        <div className="detail-card">
          <h3>Module A</h3>
          {moduleA ? (
            <>
              <p><strong>Status:</strong> {(moduleA.flagged ?? moduleA.flag) ? "FLAGGED" : "CLEAR"}</p>
              <p><strong>Anomaly Score:</strong> {Number(moduleA.anomaly_score ?? 0).toFixed(2)}</p>
              <p><strong>Signature:</strong> {signature || "No clear signature"}</p>
              {signatureConfidence !== null && (
                <p><strong>Confidence:</strong> {(Number(signatureConfidence) * 100).toFixed(1)}%</p>
              )}
              <p>{moduleA.reason || moduleA.dominant_reason || "No Module A explanation supplied."}</p>
            </>
          ) : (
            <p>No Module A result returned by the backend.</p>
          )}
        </div>

        <div className="detail-card">
          <h3>Module B</h3>
          {moduleB ? (
            <>
              <p><strong>Status:</strong> {(moduleB.flagged ?? moduleB.flag) ? "FLAGGED" : "CLEAR"}</p>
              {dominantParameter && <p><strong>Dominant Parameter:</strong> {dominantParameter}</p>}
              {leakagePrediction !== null && (
                <p><strong>Predicted Leakage 168h:</strong> {Number(leakagePrediction).toFixed(3)} µA</p>
              )}
              {maxDriftRatio !== null && (
                <p><strong>Maximum Drift Ratio:</strong> {Number(maxDriftRatio).toFixed(2)}×</p>
              )}
              <p>{moduleB.reason || moduleB.dominant_reason || "No Module B explanation supplied."}</p>
            </>
          ) : (
            <p>No Module B result returned by the backend.</p>
          )}
        </div>
      </div>

      <div className="detail-card explanation-box">
        <h3>Final Screening Explanation</h3>
        <p>
          {analysis?.explanation ||
            "This component has measurement data, but no persisted backend analysis result was found for it."}
        </p>
      </div>

      <div className="detail-card recommendation-card">
        <h3>Recommended Action</h3>
        <p>
          {rejected
            ? "Immediate rejection according to the current backend verdict rule."
            : finalVerdict === "FLAG_FOR_REVIEW"
              ? "Send for manual QA review according to the current backend verdict rule."
              : finalVerdict === "PASS"
                ? "Proceed according to the current screening pipeline."
                : "Run analysis before making a screening decision."}
        </p>
      </div>
    </div>
  );
}

export default ComponentDetails;
