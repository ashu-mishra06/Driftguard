import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import {
  loadCSVData,
  getLotIds,
  getLotData,
} from "../utils/csvData";

function LotAnalysis() {
  const [data, setData] = useState([]);
  const [lotIds, setLotIds] = useState([]);
  const [selectedLot, setSelectedLot] = useState("");
  const [analysisResults, setAnalysisResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLotAnalysis() {
      try {
        // Load uploaded CSV data
        const csv = await loadCSVData();

        setData(csv);

        const lots = getLotIds(csv);

        setLotIds(lots);

        if (lots.length > 0) {
          setSelectedLot(lots[0]);
        }

        // Load FastAPI analysis results
        const storedResults =
          localStorage.getItem("burnInAnalysisResults");

        if (storedResults) {
          setAnalysisResults(
            JSON.parse(storedResults)
          );
        }

        setLoading(false);
      } catch (error) {
        console.error(
          "Failed to load lot analysis:",
          error
        );
        setLoading(false);
      }
    }

    loadLotAnalysis();
  }, []);

  if (loading) {
    return <div>Loading lot analysis...</div>;
  }

  const lotRows = getLotData(
    data,
    selectedLot
  );

  const baseline =
    lotRows.length > 0
      ? lotRows.reduce(
          (sum, row) => sum + row.leakage_uA,
          0
        ) / lotRows.length
      : 0;

  // Dataset ground truth — informational only
  const defectiveCount = lotRows.filter(
    (row) => row.defective === 1
  ).length;

  const componentIds = [
    ...new Set(
      lotRows.map((row) => row.component_id)
    ),
  ];

  const componentData = componentIds.map(
    (componentId) => {

      const rows = lotRows.filter(
        (row) =>
          row.component_id === componentId
      );

      const lastRow = rows.find(
        (row) => row.timestamp_h === 168
      );

      const value =
        lastRow?.leakage_uA ?? 0;

      // Find backend result
      const analysis = analysisResults.find(
        (result) =>
          result.component_id === componentId
      );

      const rejected =
        analysis?.final_verdict === "REJECT";

      return {
        component_id: componentId,
        leakage: value,

        // Dataset ground truth
        defective: rows.some(
          (row) => row.defective === 1
        ),

        // Backend screening result
        verdict:
          analysis?.final_verdict ||
          "NOT ANALYZED",

        rejected,
        analysis,
      };
    }
  );

  const maxValue =
    componentData.length > 0
      ? Math.max(
          ...componentData.map(
            (item) => item.leakage
          )
        )
      : 0;

  return (
    <div className="lot-analysis-page">

      <div className="page-heading">

        <h2>
          Lot Analysis
        </h2>

        <p>
          Lot-level analysis using Burn-In measurements
          and backend screening results.
        </p>

      </div>

      <div className="lot-controls">

        <label>
          Select Lot
        </label>

        <select
          value={selectedLot}
          onChange={(e) =>
            setSelectedLot(e.target.value)
          }
        >
          {lotIds.map((lot) => (
            <option
              key={lot}
              value={lot}
            >
              {lot}
            </option>
          ))}
        </select>

      </div>

      <div className="lot-summary-grid">

        <div className="lot-stat-card">
          <span>Lot</span>
          <strong>{selectedLot}</strong>
        </div>

        <div className="lot-stat-card">
          <span>Components</span>
          <strong>
            {componentIds.length}
          </strong>
        </div>

        <div className="lot-stat-card">
          <span>Baseline Leakage</span>
          <strong>
            {baseline.toFixed(3)} µA
          </strong>
        </div>

        <div className="lot-stat-card">
          <span>Dataset Defective Records</span>
          <strong>
            {defectiveCount}
          </strong>
        </div>

      </div>

      <div className="detail-card lot-chart-card">

        <h3>
          Leakage at 168h
        </h3>

        <ResponsiveContainer
          width="100%"
          height={400}
        >

          <BarChart data={componentData}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="component_id"
            />

            <YAxis />

            <Tooltip />

            <ReferenceLine
              y={baseline}
              label="Lot Baseline"
            />

            <Bar
              dataKey="leakage"
              fill="#2563eb"
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

      <div className="detail-card lot-table-card">

        <h3>
          Component Analysis
        </h3>

        <div className="component-table-container">

          <table>

            <thead>
              <tr>
                <th>Component</th>
                <th>168h Leakage</th>
                <th>Deviation</th>
                <th>Dataset Status</th>
                <th>Screening Result</th>
              </tr>
            </thead>

            <tbody>

              {componentData.map((item) => {

                const deviation =
                  item.leakage - baseline;

                return (
                  <tr
                    key={item.component_id}
                  >

                    <td>
                      {item.component_id}
                    </td>

                    <td>
                      {item.leakage.toFixed(3)} µA
                    </td>

                    <td>
                      {deviation >= 0
                        ? "+"
                        : ""}
                      {deviation.toFixed(3)} µA
                    </td>

                    <td>

                      {item.defective ? (
                        <span className="status-badge status-anomaly">
                          Defective
                        </span>
                      ) : (
                        <span className="status-badge status-normal">
                          Normal
                        </span>
                      )}

                    </td>

                    <td>

                      {item.rejected ? (
                        <span className="status-badge status-anomaly">
                          REJECT
                        </span>
                      ) : item.verdict === "PASS" ? (
                        <span className="status-badge status-normal">
                          PASS
                        </span>
                      ) : (
                        <span className="status-badge">
                          NOT ANALYZED
                        </span>
                      )}

                    </td>

                  </tr>
                );

              })}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}

export default LotAnalysis;
