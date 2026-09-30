import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadCSVData, getComponentIds } from "../utils/csvData";
import { loadAnalysisResults } from "../utils/analysisStore";

function verdictClass(verdict) {
  if (verdict === "REJECT") return "status-badge status-anomaly";
  if (verdict === "PASS") return "status-badge status-normal";
  return "status-badge";
}

function Components({ analysisResults = [] }) {
  const [data, setData] = useState([]);
  const [components, setComponents] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCSVData()
      .then((csv) => {
        setData(csv);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load component dataset:", error);
        setLoading(false);
      });
  }, []);

  const effectiveResults = useMemo(
    () => (analysisResults.length ? analysisResults : loadAnalysisResults()),
    [analysisResults]
  );

  useEffect(() => {
    if (!data.length) {
      setComponents([]);
      return;
    }

    const componentIds = getComponentIds(data);

    const componentList = componentIds.map((id) => {
      const rows = data.filter((item) => item.component_id === id);
      const result = effectiveResults.find(
        (item) => String(item.component_id) === String(id)
      );

      return {
        id,
        lot: rows[0]?.lot_id || "—",
        value0h: rows.find((row) => row.timestamp_h === 0)?.leakage_uA ?? 0,
        value24h: rows.find((row) => row.timestamp_h === 24)?.leakage_uA ?? 0,
        value96h: rows.find((row) => row.timestamp_h === 96)?.leakage_uA ?? 0,
        value168h: rows.find((row) => row.timestamp_h === 168)?.leakage_uA ?? 0,
        verdict: result?.final_verdict || "NOT ANALYZED",
        moduleAFlag: Boolean(result?.module_a?.flagged ?? result?.module_a?.flag),
        moduleBFlag: Boolean(result?.module_b?.flagged ?? result?.module_b?.flag),
        groundTruth:
          rows.some((row) => row.is_defective === 1 || row.defective === 1),
      };
    });

    setComponents(componentList);
  }, [data, effectiveResults]);

  const filteredComponents = components.filter((component) => {
    const searchText = search.toLowerCase();
    const matchesSearch =
      component.id.toLowerCase().includes(searchText) ||
      String(component.lot).toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "All" || component.verdict === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) return <div>Loading component data...</div>;

  return (
    <div className="components-page">
      <div className="page-heading">
        <h2>Components</h2>
        <p>Monitor components from the analyzed Burn-In dataset.</p>
      </div>

      <div className="component-controls">
        <input
          type="text"
          placeholder="Search Component ID or Lot ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All Results</option>
          <option value="PASS">PASS</option>
          <option value="FLAG_FOR_REVIEW">FLAG FOR REVIEW</option>
          <option value="REJECT">REJECT</option>
          <option value="NOT ANALYZED">NOT ANALYZED</option>
        </select>
      </div>

      <div className="components-card">
        <div className="component-table-container">
          <table>
            <thead>
              <tr>
                <th>Component ID</th>
                <th>Lot ID</th>
                <th>0h Leakage</th>
                <th>24h Leakage</th>
                <th>96h Leakage</th>
                <th>168h Leakage</th>
                <th>Module A</th>
                <th>Module B</th>
                <th>Verdict</th>
              </tr>
            </thead>

            <tbody>
              {filteredComponents.map((component) => (
                <tr key={component.id}>
                  <td>
                    <Link to={`/components/${component.id}`} className="component-link">
                      <strong>{component.id}</strong>
                    </Link>
                  </td>
                  <td>{component.lot}</td>
                  <td>{Number(component.value0h).toFixed(3)} µA</td>
                  <td>{Number(component.value24h).toFixed(3)} µA</td>
                  <td>{Number(component.value96h).toFixed(3)} µA</td>
                  <td>{Number(component.value168h).toFixed(3)} µA</td>
                  <td>{component.moduleAFlag ? "FLAGGED" : "CLEAR"}</td>
                  <td>{component.moduleBFlag ? "FLAGGED" : "CLEAR"}</td>
                  <td>
                    <span className={verdictClass(component.verdict)}>
                      {component.verdict === "FLAG_FOR_REVIEW"
                        ? "FLAG FOR REVIEW"
                        : component.verdict}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredComponents.length === 0 && (
                <tr>
                  <td colSpan="9" className="no-results">
                    No components found. Upload and analyze a dataset first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: "15px", color: "#6b7280" }}>
        Showing {filteredComponents.length} of {components.length} components from the current dataset.
      </p>
    </div>
  );
}

export default Components;
