import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="logo">
        <h2>DriftGuard</h2>
        <p>Screening System</p>
      </div>

      <nav>
  <NavLink
    to="/"
    className={({ isActive }) => isActive ? "active" : ""}
  >
    Data Upload
  </NavLink>

  <NavLink
    to="/dashboard"
    className={({ isActive }) => isActive ? "active" : ""}
  >
    Dashboard
  </NavLink>

  <NavLink
    to="/components"
    className={({ isActive }) => isActive ? "active" : ""}
  >
    Components
  </NavLink>

  <NavLink
    to="/lot-analysis"
    className={({ isActive }) => isActive ? "active" : ""}
  >
    Lot Analysis
  </NavLink>

  <NavLink
    to="/prediction"
    className={({ isActive }) => isActive ? "active" : ""}
  >
    Prediction
  </NavLink>
{/* <NavLink
  to="/validation"
  className={({ isActive }) => isActive ? "active" : ""}
>
  Validation
</NavLink> */}
</nav>

    </aside>
  );
}

export default Sidebar;

