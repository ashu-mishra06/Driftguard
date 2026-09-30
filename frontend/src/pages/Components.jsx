import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  loadCSVData,
  getComponentIds,
} from "../utils/csvData";

function Components() {
  const [data, setData] = useState([]);
  const [components, setComponents] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCSVData()
      .then((csv) => {
        setData(csv);

        const componentIds = getComponentIds(csv);

        const componentList = componentIds.map((id) => {
          const rows = csv.filter(
            (item) => item.component_id === id
          );

          const first = rows.find(
            (item) => item.timestamp_h === 0
          );

          const value24 = rows.find(
            (item) => item.timestamp_h === 24
          );

          const value96 = rows.find(
            (item) => item.timestamp_h === 96
          );

          const value168 = rows.find(
            (item) => item.timestamp_h === 168
          );

          const defective = rows.some(
            (item) => item.defective === 1
          );

          return {
            id,
            lot: rows[0]?.lot_id,
            value0h: first?.leakage_uA ?? 0,
            value24h: value24?.leakage_uA ?? 0,
            value96h: value96?.leakage_uA ?? 0,
            value168h: value168?.leakage_uA ?? 0,
            status: defective ? "Anomaly" : "Normal",
          };
        });

        setComponents(componentList);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  const filteredComponents = components.filter((component) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      component.id.toLowerCase().includes(searchText) ||
      component.lot.toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "All" ||
      component.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div>Loading component data...</div>;
  }

  return (
    <div className="components-page">

      <div className="page-heading">
        <h2>Components</h2>
        <p>
          Monitor components from the uploaded Burn-In dataset.
        </p>
      </div>

      <div className="component-controls">

        <input
          type="text"
          placeholder="Search Component ID or Lot ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Normal">Normal</option>
          <option value="Anomaly">Anomaly</option>
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
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              {filteredComponents.map((component) => (

                <tr key={component.id}>

                  <td>
                    <Link
                      to={`/components/${component.id}`}
                      className="component-link"
                    >
                      <strong>
                        {component.id}
                      </strong>
                    </Link>
                  </td>

                  <td>{component.lot}</td>

                  <td>
                    {component.value0h.toFixed(3)} µA
                  </td>

                  <td>
                    {component.value24h.toFixed(3)} µA
                  </td>

                  <td>
                    {component.value96h.toFixed(3)} µA
                  </td>

                  <td>
                    {component.value168h.toFixed(3)} µA
                  </td>

                  <td>
                    {component.status === "Anomaly" ? (
                      <span className="status-badge status-anomaly">
                        Anomaly
                      </span>
                    ) : (
                      <span className="status-badge status-normal">
                        Normal
                      </span>
                    )}
                  </td>

                </tr>

              ))}

              {filteredComponents.length === 0 && (
                <tr>
                  <td colSpan="7" className="no-results">
                    No components found.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

      <p style={{ marginTop: "15px", color: "#6b7280" }}>
        Showing {filteredComponents.length} of{" "}
        {components.length} components from the CSV dataset.
      </p>

    </div>
  );
}

export default Components;