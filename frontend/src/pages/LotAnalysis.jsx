import { useEffect, useMemo, useState } from "react";
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

import { loadCSVData, getLotIds, getLotData } from "../utils/csvData";
import { loadAnalysisResults } from "../utils/analysisStore";

function verdictClass(verdict) {
  if (verdict === "REJECT") return "status-badge status-anomaly";
  if (verdict === "PASS") return "status-badge status-normal";
  return "status-badge";
}

function LotAnalysis({ analysisResults = [] }) {
  const [data, setData] = useState([]);
  const [lotIds, setLotIds] = useState([]);
  const [selectedLot, setSelectedLot] = useState("");
  const [loading, setLoading] = useState(true);

  const effectiveResults = useMemo(
    () => (analysisResults.length ? analysisResults : loadAnalysisResults()),
    [analysisResults]
  );

  useEffect(() => {
    loadCSVData()
      .then((csv) => {
        setData(csv);
        const lots = getLotIds(csv);
        setLotIds(lots);
        setSelectedLot((current) => current || lots[0] || "");
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load lot analysis:", error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading lot analysis...</div>;

  const lotRows = getLotData(data, selectedLot);
  const componentIds = [...new Set(lotRows.map((row) => row.component_id))];

  const baseline =
    lotRows.length > 0
      ? lotRows.reduce((sum, row) => sum + Number(row.leakage_uA || 0), 0) / lotRows.length
      : 0;

  const componentData = componentIds.map((componentId) => {
    const rows = lotRows.filter((row) => row.component_id === componentId);
    const lastRow = rows.find((row) => row.timestamp_h === 168);
    const result = effectiveResults.find(
      (item) => String(item.component_id) === String(componentId)
    );
    const verdict = result?.final_verdict || "NOT ANALYZED";

    return {
      component_id: componentId,
      leakage: Number(lastRow?.leakage_uA || 0),
      defective: rows.some((row) => row.is_defective === 1 || row.defective === 1),
      verdict,
    };
  });

  const defectiveCount = lotRows.filter(
    (row) => row.timestamp_h === 0 && (row.is_defective === 1 || row.defective === 1)
  ).length;

  return (
    <div className="lot-analysis-page">
      <div className="page-heading">
        <h2>Lot Analysis</h2>
        <p>Lot-level analysis using the current dataset and backend screening results.</p>
      </div>

      <div className="lot-controls">
        <label>Select Lot</label>
        <select value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)}>
          {lotIds.map((lot) => <option key={lot} value={lot}>{lot}</option>)}
        </select>
      </div>

      <div className="lot-summary-grid">
        <div className="lot-stat-card"><span>Lot</span><strong>{selectedLot || "—"}</strong></div>
        <div className="lot-stat-card"><span>Components</span><strong>{componentIds.length}</strong></div>
        <div className="lot-stat-card"><span>Baseline Leakage</span><strong>{baseline.toFixed(3)} µA</strong></div>
        <div className="lot-stat-card"><span>Ground Truth Defects</span><strong>{defectiveCount}</strong></div>
      </div>

      <div className="detail-card lot-chart-card">
        <h3>Leakage at 168h</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={componentData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="component_id" />
            <YAxis />
            <Tooltip />
            <ReferenceLine y={baseline} label="Lot Baseline" />
            <Bar dataKey="leakage" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="detail-card lot-table-card">
        <h3>Component Analysis</h3>
        <div className="component-table-container">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>168h Leakage</th>
                <th>Deviation</th>
                <th>Ground Truth</th>
                <th>Screening Result</th>
              </tr>
            </thead>
            <tbody>
              {componentData.map((item) => {
                const deviation = item.leakage - baseline;
                return (
                  <tr key={item.component_id}>
                    <td>{item.component_id}</td>
                    <td>{item.leakage.toFixed(3)} µA</td>
                    <td>{deviation >= 0 ? "+" : ""}{deviation.toFixed(3)} µA</td>
                    <td>
                      <span className={item.defective ? "status-badge status-anomaly" : "status-badge status-normal"}>
                        {item.defective ? "Defective" : "Normal"}
                      </span>
                    </td>
                    <td>
                      <span className={verdictClass(item.verdict)}>
                        {item.verdict === "FLAG_FOR_REVIEW" ? "FLAG FOR REVIEW" : item.verdict}
                      </span>
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
