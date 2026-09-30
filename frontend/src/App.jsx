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

import { loadAnalysisResults } from "./utils/analysisStore.js";

function App() {
  // Uploaded files are kept in memory for the current UI session.
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // IMPORTANT: initialize this from persisted backend results so a page refresh
  // does not make all downstream sections appear empty.
  const [analysisResults, setAnalysisResults] = useState(() =>
    loadAnalysisResults()
  );

  return (
    <div className="app">
      <Sidebar />

      <div className="main-area">
        <Header />

        <main className="content">
          <Routes>
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

            <Route
              path="/dashboard"
              element={<Dashboard analysisResults={analysisResults} />}
            />

            <Route
              path="/components"
              element={<Components analysisResults={analysisResults} />}
            />

            <Route
              path="/components/:id"
              element={
                <ComponentDetails analysisResults={analysisResults} />
              }
            />

            <Route
              path="/lot-analysis"
              element={<LotAnalysis analysisResults={analysisResults} />}
            />

            <Route
              path="/prediction"
              element={<Prediction analysisResults={analysisResults} />}
            />

            <Route
              path="/validation"
              element={<Validation analysisResults={analysisResults} />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
