import { useEffect, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  loadCSVData,
  getComponentIds,
  getComponentData,
} from "../utils/csvData";

function Prediction() {
  const [data, setData] = useState([]);
  const [componentIds, setComponentIds] = useState([]);
  const [selectedComponent, setSelectedComponent] =
    useState("");
  const [analysisResults, setAnalysisResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPredictionData() {
      try {
        // Load uploaded CSV data
        const csv = await loadCSVData();

        setData(csv);

        const ids = getComponentIds(csv);

        setComponentIds(ids);

        if (ids.length > 0) {
          setSelectedComponent(ids[0]);
        }

        // Load FastAPI analysis results
        const storedResults =
          localStorage.getItem("burnInAnalysisResults");

        if (storedResults) {
          setAnalysisResults(JSON.parse(storedResults));
        }

        setLoading(false);
      } catch (error) {
        console.error(
          "Failed to load prediction data:",
          error
        );
        setLoading(false);
      }
    }

    loadPredictionData();
  }, []);

  if (loading) {
    return <div>Loading prediction data...</div>;
  }

  const rows = getComponentData(
    data,
    selectedComponent
  );

  if (rows.length === 0) {
    return <div>No component data found.</div>;
  }

  const component = rows[0];

  // Find backend result for selected component
  const analysis = analysisResults.find(
    (result) =>
      result.component_id === selectedComponent
  );

  const moduleB = analysis?.module_b;

  const finalVerdict =
    analysis?.final_verdict || "NOT ANALYZED";

  const leakage0 =
    rows.find(
      (row) => row.timestamp_h === 0
    )?.leakage_uA ?? 0;

  const leakage24 =
    rows.find(
      (row) => row.timestamp_h === 24
    )?.leakage_uA ?? 0;

  const leakage168 =
    rows.find(
      (row) => row.timestamp_h === 168
    )?.leakage_uA ?? 0;

  // Early drift is kept as a descriptive measurement.
  // It is NOT used for the final screening decision.
  const earlyDriftRate =
    (leakage24 - leakage0) / 24;

  // Try the common backend prediction field names
  const predictedDrift =
    moduleB?.predicted_drift_rate ??
    moduleB?.predicted_drift ??
    moduleB?.drift_rate ??
    null;

  const safetySlope =
    moduleB?.safety_slope ??
    moduleB?.threshold ??
    null;

  const moduleBFlagged =
    moduleB?.flagged;

  return (
    <div className="prediction-page">

      <div className="page-heading">

        <h2>
          Prediction
        </h2>

        <p>
          Module B drift prediction from the FastAPI
          screening pipeline.
        </p>

      </div>

      <div className="prediction-controls">

        <label>
          Select Component
        </label>

        <select
          value={selectedComponent}
          onChange={(e) =>
            setSelectedComponent(e.target.value)
          }
        >

          {componentIds.map((id) => (
            <option
              key={id}
              value={id}
            >
              {id}
            </option>
          ))}

        </select>

      </div>

      <div className="prediction-component-info">

        <strong>
          Component:
        </strong>{" "}
        {component.component_id}

        {" | "}

        <strong>
          Lot:
        </strong>{" "}
        {component.lot_id}

      </div>

      <div className="prediction-summary-grid">

        <div className="prediction-stat-card">

          <span>
            Leakage 0h
          </span>

          <strong>
            {leakage0.toFixed(3)} µA
          </strong>

        </div>

        <div className="prediction-stat-card">

          <span>
            Leakage 24h
          </span>

          <strong>
            {leakage24.toFixed(3)} µA
          </strong>

        </div>

        <div className="prediction-stat-card">

          <span>
            Leakage 168h
          </span>

          <strong>
            {leakage168.toFixed(3)} µA
          </strong>

        </div>

        <div className="prediction-stat-card">

          <span>
            Early Drift Rate
          </span>

          <strong>
            {earlyDriftRate.toFixed(4)} µA/hr
          </strong>

        </div>

      </div>

      <div className="prediction-section">

        <h3>
          Leakage Time Series
        </h3>

        <ResponsiveContainer
          width="100%"
          height={350}
        >

          <LineChart data={rows}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="timestamp_h"
            />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="leakage_uA"
              stroke="#2563eb"
              strokeWidth={3}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

      <div className="prediction-summary-grid">

        <div className="prediction-stat-card">

          <span>
            Predicted Drift Rate
          </span>

          <strong>
            {predictedDrift !== null
              ? Number(predictedDrift).toFixed(4)
              : "N/A"}
          </strong>

        </div>

        <div className="prediction-stat-card">

          <span>
            Safety Slope
          </span>

          <strong>
            {safetySlope !== null
              ? Number(safetySlope).toFixed(4)
              : "N/A"}
          </strong>

        </div>

        <div className="prediction-stat-card">

          <span>
            Module B
          </span>

          <strong>
            {moduleBFlagged === undefined
              ? "N/A"
              : moduleBFlagged
              ? "FLAGGED"
              : "NORMAL"}
          </strong>

        </div>

        <div className="prediction-stat-card">

          <span>
            Final Verdict
          </span>

          <strong>
            {finalVerdict}
          </strong>

        </div>

      </div>

      <div className="prediction-verdict-card">

        <h3>
          Module B Drift Prediction
        </h3>

        {moduleB ? (
          <>
            <h2>
              {moduleBFlagged
                ? "DRIFT FLAGGED"
                : "DRIFT WITHIN LIMIT"}
            </h2>

            <p>
              {moduleB.reason ||
                "Module B prediction completed successfully."}
            </p>

            {analysis?.explanation && (
              <p>
                <strong>
                  Screening explanation:
                </strong>{" "}
                {analysis.explanation}
              </p>
            )}
          </>
        ) : (
          <>
            <h2>
              NOT ANALYZED
            </h2>

            <p>
              No Module B result was found for this
              component. Upload and analyze the CSV
              before viewing backend predictions.
            </p>
          </>
        )}

      </div>

    </div>
  );
}

export default Prediction;
