import { useRef, useState } from "react";
import {
  saveAnalysisPayload,
  saveUploadedCSV,
} from "../utils/analysisStore";
import { API_BASE_URL } from "../services/driftguardApi";

function DataUpload({
  files,
  setFiles,
  selectedIndex,
  setSelectedIndex,
  setAnalysisResults,
}) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedFile = files[selectedIndex] || null;

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    setMessage("");
    setError("");

    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".csv")
    );

    if (validFiles.length !== selectedFiles.length) {
      setError("Only CSV files are supported. Non-CSV files were ignored.");
    }

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    const firstNewIndex = files.length;

    setFiles((previousFiles) => {
      const existingNames = new Set(previousFiles.map((file) => file.name));
      const newFiles = validFiles.filter((file) => !existingNames.has(file.name));
      return [...previousFiles, ...newFiles];
    });

    if (files.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex < 0) {
      setSelectedIndex(firstNewIndex);
    }

    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setFiles((previousFiles) =>
      previousFiles.filter((_, fileIndex) => fileIndex !== index)
    );

    if (index === selectedIndex) {
      setSelectedIndex((previousIndex) =>
        files.length <= 1
          ? 0
          : index >= files.length - 1
            ? Math.max(files.length - 2, 0)
            : previousIndex
      );
    } else if (index < selectedIndex) {
      setSelectedIndex((previousIndex) => Math.max(previousIndex - 1, 0));
    }
  };

  const handleSelectFile = (index) => {
    setSelectedIndex(index);
    setMessage("");
    setError("");
    setLoading(false);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      // Persist the exact uploaded CSV so every downstream page uses the same
      // dataset after navigation or refresh.
      const csvText = await selectedFile.text();
      saveUploadedCSV(csvText, selectedFile.name);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${responseText}`);
      }

      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error("FastAPI returned invalid JSON.");
      }

      // Normalize both V3 { components: [...] } and older [...] responses.
      const normalizedResults = saveAnalysisPayload(payload);

      if (normalizedResults.length === 0) {
        throw new Error(
          "Analysis completed, but the backend returned no component results."
        );
      }

      // Critical missing line in the old implementation:
      // update React state immediately so all routed pages receive the results.
      setAnalysisResults(normalizedResults);

      setFiles((previousFiles) =>
        previousFiles.map((file, index) =>
          index === selectedIndex
            ? {
                ...file,
                analyzed: true,
                analysisResult: payload,
              }
            : file
        )
      );

      setMessage(
        `${selectedFile.name} analyzed successfully — ${normalizedResults.length} component results available.`
      );

      // Keep the user on the upload page so the existing UI is not changed.
      // The sidebar can now open every result section immediately.
      // Uncomment the next line only if auto-navigation is desired:
      // navigate("/dashboard");
    } catch (err) {
      console.error("Analysis error:", err);

      if (String(err.message).includes("422")) {
        setError(`FastAPI rejected the CSV request (422). Details: ${err.message}`);
      } else if (
        String(err.message).includes("Failed to fetch") ||
        String(err.message).includes("NetworkError")
      ) {
        setError(
          `Could not connect to the DriftGuard backend at ${API_BASE_URL}. If it is hosted on a free tier, wait ~60 seconds for it to wake up and try again.`
        );
      } else {
        setError(`Analysis failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (size) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="data-upload-page">
      <div className="upload-page-header">
        <span className="upload-eyebrow">DATA UPLOAD</span>
        <h1>Upload Burn-In Dataset</h1>
        <p>
          Select CSV files containing component Burn-In time-series data for
          anomaly detection and 168h drift prediction.
        </p>
      </div>

      <div className="upload-main-grid">
        <div className="upload-panel">
          <div className="upload-panel-title">
            <div className="upload-title-icon">↑</div>
            <div>
              <h2>Upload Screening Dataset</h2>
              <p>
                Choose one or more CSV files containing component Burn-In
                measurements.
              </p>
            </div>
          </div>

          <div
            className="csv-drop-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="csv-upload-icon">↑</div>
            <h3>Select CSV files</h3>
            <p>You can select multiple CSV files</p>
            <button
              type="button"
              className="browse-button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Browse Files
            </button>
            <span className="supported-text">Supported format: .csv</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="selected-files-section">
              <div className="selected-files-header">
                <div>
                  <h3>Selected Files</h3>
                  <p>
                    {files.length} CSV {files.length === 1 ? "file" : "files"} selected
                  </p>
                </div>
                <span className="file-count-badge">{files.length}</span>
              </div>

              <div className="file-list">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={`file-item ${selectedIndex === index ? "active-file" : ""}`}
                    onClick={() => handleSelectFile(index)}
                  >
                    <button
                      type="button"
                      className="file-left file-select-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSelectFile(index);
                      }}
                    >
                      <div className="csv-file-icon">CSV</div>
                      <div className="file-details">
                        <strong>{file.name}</strong>
                        <span>{formatFileSize(file.size)}</span>
                        {file.analyzed && (
                          <span className="analyzed-label">✓ Analyzed</span>
                        )}
                      </div>
                    </button>

                    <div className="file-actions">
                      {selectedIndex === index && (
                        <span className="current-label">Current</span>
                      )}
                      <button
                        type="button"
                        className="remove-file-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        title="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFile && (
            <div className="current-file-box">
              <div>
                <span className="current-file-label">CURRENT DATASET</span>
                <strong>{selectedFile.name}</strong>
              </div>
              <span>
                {selectedFile.analyzed ? "Analysis completed" : "Ready for analysis"}
              </span>
            </div>
          )}

          <button
            type="button"
            className="analyze-button-large"
            onClick={handleAnalyze}
            disabled={!selectedFile || loading}
          >
            {loading ? "Analyzing..." : "▶  Analyze Current Dataset"}
          </button>

          {message && <div className="upload-message success">✓ {message}</div>}
          {error && <div className="upload-message error">✕ {error}</div>}
        </div>

        <div className="dataset-info-panel">
          <div className="dataset-info-title">
            <span>▤</span>
            <h2>Dataset Information</h2>
          </div>

          <div className="info-row"><span>File Format</span><strong>CSV</strong></div>
          <div className="info-row"><span>Processing Mode</span><strong>Local</strong></div>
          <div className="info-row"><span>Analysis Pipeline</span><strong>Module A → Module B</strong></div>
          <div className="info-row"><span>Time Points</span><strong>0h / 24h / 96h / 168h</strong></div>
          <div className="info-row"><span>Input Data</span><strong>Iddq, Leakage, Prop Delay</strong></div>
          <div className="info-row"><span>Target</span><strong>Anomaly Detection + 168h Prediction</strong></div>

          <div className="dataset-note">
            <strong>ⓘ Note</strong>
            <p>
              Final uploads use the wide DriftGuard schema. Optional ground-truth
              metadata is preserved for display/evaluation only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataUpload;
