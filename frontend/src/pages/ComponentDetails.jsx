import { useEffect, useState } from "react";
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

import {
  loadCSVData,
  getComponentData,
} from "../utils/csvData";

function ComponentDetails() {
  const { id } = useParams();

  const [rows, setRows] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadComponentDetails() {
      try {
        // Load measurement data
        const data = await loadCSVData();

        const componentRows = getComponentData(data, id);
        setRows(componentRows);

        // Load backend analysis results
        const storedResults =
          localStorage.getItem("burnInAnalysisResults");

        const analysisResults = storedResults
          ? JSON.parse(storedResults)
          : [];

        const componentAnalysis = analysisResults.find(
          (result) => result.component_id === id
        );

        setAnalysis(componentAnalysis || null);
        setLoading(false);
      } catch (error) {
        console.error(
          "Failed to load component details:",
          error
        );
        setLoading(false);
      }
    }

    loadComponentDetails();
  }, [id]);

  if (loading) {
    return <div>Loading component...</div>;
  }

  if (rows.length === 0) {
    return (
      <div>
        <h2>Component not found</h2>
        <Link to="/components">
          Back to Components
        </Link>
      </div>
    );
  }

  const component = rows[0];

  // Dataset ground truth — informational only
  const defective = rows.some(
    (row) => row.defective === 1
  );

  const first = rows.find(
    (row) => row.timestamp_h === 0
  );

  const last = rows.find(
    (row) => row.timestamp_h === 168
  );

  const leakageIncrease =
    first && last
      ? last.leakage_uA - first.leakage_uA
      : 0;

  // Backend screening verdict
  const finalVerdict =
    analysis?.final_verdict || "NOT ANALYZED";

  const rejected =
    finalVerdict === "REJECT";

  // Risk is based on backend verdict
  const risk = rejected
    ? "High"
    : "Low";

  return (
    <div className="component-details-page">

      <Link
        to="/components"
        className="back-button"
      >
        ← Back to Components
      </Link>

      <div className="page-heading">
        <h2>{component.component_id}</h2>
        <p>
          Component details from the real CSV dataset.
        </p>
      </div>

      <div className="detail-card">

        <div className="detail-header">

          <div>
            <h3>
              {component.component_id}
            </h3>

            <p>
              Lot: {component.lot_id}
            </p>
          </div>

          <span
            className={
              rejected
                ? "status-badge status-anomaly"
                : "status-badge status-normal"
            }
          >
            {finalVerdict}
          </span>

        </div>

        <div className="measurement-grid">

          {rows.map((row) => (
            <div
              className="measurement-card"
              key={row.timestamp_h}
            >
              <span>
                {row.timestamp_h}h
              </span>

              <strong>
                {row.leakage_uA.toFixed(3)} µA
              </strong>

              <small>
                Leakage
              </small>
            </div>
          ))}

        </div>

      </div>

      <div className="detail-card detail-chart">

        <h3>
          Leakage Current Trend
        </h3>

        <ResponsiveContainer
          width="100%"
          height={380}
        >
          <LineChart data={rows}
          margin={{
      top: 15,
      right: 25,
      left: 20,
      bottom: 10,
    }}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="timestamp_h"
              //   tick={{ fontSize: 13 }}
              label={{
                value: "Time (hours)",
                position: "Bottom",
                offset: 25,
                
              }}
                // dataKey="timestamp_h"
                // tick={{ fontSize: 13 }}
                // tickMargin={10}
            />

            <YAxis
              label={{
                value: "Leakage (µA)",
                angle: -90,
                position: "insideLeft",
                offset: 5,
              }}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="leakage_uA"
              stroke="#2563eb"
              strokeWidth={3}
            />

          </LineChart>
        </ResponsiveContainer>
{/* 
  <div className="chart-axis-label">
    Time (hours)
  </div> */}

      </div>

      <div className="analysis-grid">

        <div className="detail-card">

          <h3>
            Screening Result
          </h3>

          <div className="risk-display">

          <span>Risk Level : </span>
          <strong>{risk}</strong>

          </div>

          <p>
            Final Verdict :
            { " "}
            <strong>
              {finalVerdict}
            </strong>
          </p>

          <p>
            Dataset Defective Flag :
            {  " "}
            <strong>
              {defective ? "Yes" : "No"}
            </strong>
          </p>

        </div>

        <div className="detail-card">

          <h3>
            Explanation
          </h3>

          <div className="explanation-box">

            {analysis?.explanation ||
              "No backend analysis is available for this component."}

          </div>

        </div>

      </div>

      <div className="analysis-grid">

        <div className="detail-card">

          <h3>
            Module A — Anomaly Detection
          </h3>

          {analysis?.module_a ? (
            <>
              <p>
                Flagged :
                { " "}
                <strong>
                  {analysis.module_a.flagged
                    ? "Yes"
                    : "No"}
                </strong>
              </p>

              <p>
                Anomaly Score :
                { " "}
                <strong>
                  {analysis.module_a.anomaly_score !==
                  undefined
                    ? Number(
                        analysis.module_a.anomaly_score
                      ).toFixed(3)
                    : "N/A"}
                </strong>
              </p>

              <div className="explanation-box">
                {analysis.module_a.reason ||
                  "No Module A reason provided."}
              </div>
            </>
          ) : (
            <p>
              Module A analysis not available.
            </p>
          )}

        </div>

        <div className="detail-card">

          <h3>
            Module B — Drift Prediction
          </h3>

          {analysis?.module_b ? (
            <>
              <p>
                Flagged :
                { " "}
                <strong>
                  {analysis.module_b.flagged
                    ? "Yes"
                    : "No"}
                </strong>
              </p>

              <div className="explanation-box">
                {analysis.module_b.reason ||
                  "No Module B reason provided."}
              </div>
            </>
          ) : (
            <p>
              Module B analysis not available.
            </p>
          )}

        </div>

      </div>

      <div className="recommendation-card">

        <h3>
          QA Recommendation
        </h3>
        <div className="recommendation-text">
        {rejected
          ? "Send this component for QA inspection based on the screening result."
          : "Component can continue normal screening based on the screening result."}
        </div>

      </div>

    </div>
  );
}

export default ComponentDetails;
