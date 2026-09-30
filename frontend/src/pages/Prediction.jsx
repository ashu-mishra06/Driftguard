import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { loadCSVData, getComponentIds, getComponentData } from "../utils/csvData";
import { loadAnalysisResults, getAnalysisForComponent } from "../utils/analysisStore";

function Prediction({ analysisResults = [] }) {
  const [data, setData] = useState([]);
  const [componentIds, setComponentIds] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState("");
  const [loading, setLoading] = useState(true);

  const effectiveResults = useMemo(
    () => (analysisResults.length ? analysisResults : loadAnalysisResults()),
    [analysisResults]
  );

  useEffect(() => {
    loadCSVData()
      .then((csv) => {
        setData(csv);
        const ids = getComponentIds(csv);
        setComponentIds(ids);
        setSelectedComponent((current) => current || ids[0] || "");
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load prediction data:", error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading prediction data...</div>;

  const rows = getComponentData(data, selectedComponent);

  if (!rows.length) {
    return <div>No component data found.</div>;
  }

  const component = rows[0];
  const analysis = getAnalysisForComponent(effectiveResults, selectedComponent);
  const moduleB = analysis?.module_b;
  const finalVerdict = analysis?.final_verdict || "NOT ANALYZED";

  const leakage0 = rows.find((row) => row.timestamp_h === 0)?.leakage_uA ?? 0;
  const leakage24 = rows.find((row) => row.timestamp_h === 24)?.leakage_uA ?? 0;
  const leakage168 = rows.find((row) => row.timestamp_h === 168)?.leakage_uA ?? 0;
  const earlyDriftRate = (Number(leakage24) - Number(leakage0)) / 24;

  const predictionMap = moduleB?.predicted_168h || {};
  const leakagePredicted168 = predictionMap.leakage ?? null;
  const maxDriftRatio = moduleB?.max_drift_ratio ?? null;
  const threshold = moduleB?.threshold_multiplier ?? 1.25;
  const dominantParameter =
    moduleB?.dominant_parameter ?? moduleB?.dominantParameter ?? "—";

  const moduleBFlagged = Boolean(moduleB?.flagged ?? moduleB?.flag);

  const trajectory = rows.map((row) => ({
    time: `${row.timestamp_h}h`,
    actual: row.leakage_uA,
  }));

  if (leakagePredicted168 !== null) {
    trajectory.push({ time: "168h predicted", actual: null, predicted: leakagePredicted168 });
  }

  return (
    <div className="prediction-page">
      <div className="page-heading">
        <h2>Prediction</h2>
        <p>Module B XGBoost 168h drift prediction from the FastAPI screening pipeline.</p>
      </div>

      <div className="prediction-controls">
        <label>Select Component</label>
        <select value={selectedComponent} onChange={(e) => setSelectedComponent(e.target.value)}>
          {componentIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>

      <div className="prediction-component-info">
        <strong>Component:</strong> {component.component_id} {" | "}
        <strong>Lot:</strong> {component.lot_id}
      </div>

      <div className="prediction-summary-grid">
        <div className="prediction-stat-card"><span>Leakage 0h</span><strong>{Number(leakage0).toFixed(3)} µA</strong></div>
        <div className="prediction-stat-card"><span>Leakage 24h</span><strong>{Number(leakage24).toFixed(3)} µA</strong></div>
        <div className="prediction-stat-card"><span>Leakage 168h</span><strong>{Number(leakage168).toFixed(3)} µA</strong></div>
        <div className="prediction-stat-card"><span>Early Drift Rate</span><strong>{earlyDriftRate.toFixed(4)} µA/hr</strong></div>
      </div>

      <div className="prediction-section">
        <h3>Leakage Time Series</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={trajectory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={3} name="Measured" />
            <Line type="monotone" dataKey="predicted" stroke="#dc2626" strokeWidth={3} strokeDasharray="8 5" name="Predicted 168h" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="prediction-summary-grid">
        <div className="prediction-stat-card">
          <span>Predicted Leakage 168h</span>
          <strong>{leakagePredicted168 !== null ? `${Number(leakagePredicted168).toFixed(3)} µA` : "N/A"}</strong>
        </div>
        <div className="prediction-stat-card">
          <span>Max Drift Ratio</span>
          <strong>{maxDriftRatio !== null ? `${Number(maxDriftRatio).toFixed(2)}×` : "N/A"}</strong>
        </div>
        <div className="prediction-stat-card">
          <span>Threshold</span>
          <strong>{Number(threshold).toFixed(2)}×</strong>
        </div>
        <div className="prediction-stat-card">
          <span>Module B</span>
          <strong>{moduleB ? (moduleBFlagged ? "FLAGGED" : "CLEAR") : "N/A"}</strong>
        </div>
      </div>

      <div className="prediction-verdict-card">
        <h3>Module B Drift Prediction</h3>
        {moduleB ? (
          <>
            <h2>{moduleBFlagged ? "DRIFT FLAGGED" : "DRIFT WITHIN LIMIT"}</h2>
            <p><strong>Dominant parameter:</strong> {dominantParameter}</p>
            <p>{moduleB.reason || moduleB.dominant_reason || "XGBoost prediction completed successfully."}</p>
            <p><strong>Final Verdict:</strong> {finalVerdict}</p>
            {analysis?.explanation && <p><strong>Screening explanation:</strong> {analysis.explanation}</p>}
          </>
        ) : (
          <>
            <h2>NOT ANALYZED</h2>
            <p>No backend result was found for this component. Upload and analyze the CSV first.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default Prediction;
