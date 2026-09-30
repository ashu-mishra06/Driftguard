
import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";

import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Components from "./pages/Components.jsx";
import ComponentDetails from "./pages/ComponentDetails.jsx";
import LotAnalysis from "./pages/LotAnalysis.jsx";
import Prediction from "./pages/Prediction.jsx";
import DataUpload from "./pages/DataUpload.jsx";
import Validation from "./pages/Validation.jsx";

function App() {
  // --------------------------------------------------
  // CSV FILE STATE
  // --------------------------------------------------
  // Stores all uploaded CSV files.
  const [files, setFiles] = useState([]);

  // Stores which uploaded CSV is currently selected.
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [analysisResults, setAnalysisResults] = useState([]);

  const [validationResults, setValidationResults] = useState(null);

  return (
    <div className="app">

      <Sidebar />

      <div className="main-area">

        <Header />

        <main className="content">

          <Routes>

            {/* =========================================
                DATA UPLOAD
                ========================================= */}
            <Route
              path="/"
              element={
                <DataUpload
                  files={files}
                  setFiles={setFiles}
                  selectedIndex={selectedIndex}
                  setSelectedIndex={setSelectedIndex}
                  analysisResults={analysisResults}
                  setAnalysisResults={setAnalysisResults}
                />
              }
            />

            {/* =========================================
                DASHBOARD
                ========================================= */}
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  analysisResults={analysisResults}
                />
              }
            />

            {/* =========================================
                COMPONENTS
                ========================================= */}
            <Route
              path="/components"
              element={
                <Components
                  analysisResults={analysisResults}
                />
              }
            />

            {/* =========================================
                COMPONENT DETAILS
                ========================================= */}
            <Route
              path="/components/:id"
              element={
                <ComponentDetails
                  analysisResults={analysisResults}
                />
              }
            />

            {/* =========================================
                LOT ANALYSIS
                ========================================= */}
            <Route
              path="/lot-analysis"
              element={
                <LotAnalysis
                  analysisResults={analysisResults}
                />
              }
            />

            {/* =========================================
                PREDICTION
                ========================================= */}
            <Route
              path="/prediction"
              element={
                <Prediction
                  analysisResults={analysisResults}
                />
              }
            />

            {/* =========================================
                VALIDATION / STRESS TEST
                ========================================= */}
            <Route
              path="/validation"
              element={
                <Validation
                  validationResults={validationResults}
                  setValidationResults={setValidationResults}
                />
              }
            />

          </Routes>

        </main>

      </div>

    </div>
  );
}

export default App;
