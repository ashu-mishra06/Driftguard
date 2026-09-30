import { useRef, useState } from "react";
// import { useRef, useState, useEffect } from "react";

function DataUpload({
  files,
  setFiles,
  selectedIndex,
  setSelectedIndex,
}) {
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedFile = files[selectedIndex] || null;

  // -----------------------------
  // ADD MULTIPLE CSV FILES
  // -----------------------------
  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    setMessage("");
    setError("");

    if (selectedFiles.length === 0) {
      return;
    }

    const validFiles = selectedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".csv")
    );

    if (validFiles.length !== selectedFiles.length) {
      setError(
        "Only CSV files are supported. Non-CSV files were ignored."
      );
    }

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setFiles((previousFiles) => {
      const existingNames = new Set(
        previousFiles.map((file) => file.name)
      );

      const newFiles = validFiles.filter(
        (file) => !existingNames.has(file.name)
      );

      return [...previousFiles, ...newFiles];
    });

    // If this is the first upload, select the first file.
    if (files.length === 0) {
      setSelectedIndex(0);
    }

    // Reset input so the same file can be selected again later.
    event.target.value = "";
  };

  // -----------------------------
  // REMOVE FILE
  // -----------------------------
  const handleRemoveFile = (index) => {
    setFiles((previousFiles) => {
      const updatedFiles = previousFiles.filter(
        (_, fileIndex) => fileIndex !== index
      );

      return updatedFiles;
    });

    if (index === selectedIndex) {
      setSelectedIndex((previousIndex) => {
        if (files.length <= 1) {
          return 0;
        }

        if (index >= files.length - 1) {
          return Math.max(files.length - 2, 0);
        }

        return index;
      });
    } else if (index < selectedIndex) {
      setSelectedIndex((previousIndex) =>
        Math.max(previousIndex - 1, 0)
      );
    }
  };

  // -----------------------------
  // SELECT FILE
  // -----------------------------
  const handleSelectFile = (index) => {
     console.log("Switching CSV file:", files[index]?.name);
    setSelectedIndex(index);
    setMessage("");
    setError("");
      setLoading(false);
      // loadCSVPreview(file);
  };


const handleAnalyze = async () => {
  if (!selectedFile) {
    setError("Please select a CSV file first.");
    return;
  }

  setLoading(true);
  setMessage("");
  setError("");

  console.log("Analyzing file:", selectedFile.name);

  try {
    const formData = new FormData();

    formData.append("file", selectedFile);

    const response = await fetch(
      "http://localhost:8000/analyze",
      {
        method: "POST",
        body: formData,
      }
    );

    // Read the response body even when FastAPI returns an error
    const responseText = await response.text();

    console.log("FastAPI status:", response.status);
    console.log("FastAPI response:", responseText);

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${responseText}`
      );
    }

    const result = JSON.parse(responseText);

    console.log("Analysis result:", result);

    localStorage.setItem(
      "burnInAnalysisResults",
      JSON.stringify(result)
    );

    setFiles((previousFiles) =>
      previousFiles.map((file, index) =>
        index === selectedIndex
          ? {
              ...file,
              analyzed: true,
              analysisResult: result,
            }
          : file
      )
    );

    setMessage(
      `${selectedFile.name} analyzed successfully.`
    );

  } catch (err) {
    console.error("Analysis error:", err);

    if (err.message.includes("422")) {
      setError(
        `FastAPI rejected the CSV request (422). Details: ${err.message}`
      );
    } else if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError")
    ) {
      setError(
        "Could not connect to FastAPI. Make sure the backend is running on localhost:8000."
      );
    } else {
      setError(`Analysis failed: ${err.message}`);
    }

  } finally {
    setLoading(false);
  }
};



  // -----------------------------
  // FORMAT FILE SIZE
  // -----------------------------
  const formatFileSize = (size) => {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="data-upload-page">

      {/* PAGE HEADER */}
      <div className="upload-page-header">
        <span className="upload-eyebrow">
          DATA UPLOAD
        </span>

        <h1>Upload Burn-In Dataset</h1>

        <p>
          Select CSV files containing component Burn-In
          time-series data for anomaly detection and
          168h drift prediction.
        </p>
      </div>

      {/* MAIN UPLOAD AREA */}
      <div className="upload-main-grid">

        {/* LEFT SIDE */}
        <div className="upload-panel">

          <div className="upload-panel-title">
            <div className="upload-title-icon">
              ↑
            </div>

            <div>
              <h2>Upload Screening Dataset</h2>

              <p>
                Choose one or more CSV files containing
                component Burn-In measurements.
              </p>
            </div>
          </div>

          {/* DROP AREA */}
          <div
            className="csv-drop-area"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <div className="csv-upload-icon">
              ↑
            </div>

            <h3>
              Select CSV files
            </h3>

            <p>
              You can select multiple CSV files
            </p>

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

            <span className="supported-text">
              Supported format: .csv
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </div>

          {/* SELECTED FILES */}
          {files.length > 0 && (
            <div className="selected-files-section">

              <div className="selected-files-header">
                <div>
                  <h3>Selected Files</h3>

                  <p>
                    {files.length} CSV{" "}
                    {files.length === 1
                      ? "file"
                      : "files"}{" "}
                    selected
                  </p>
                </div>

                <span className="file-count-badge">
                  {files.length}
                </span>
              </div>

              <div className="file-list">

                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={`file-item ${
                      selectedIndex === index
                        ? "active-file"
                        : ""
                    }`}              
                    onClick={() =>
                        handleSelectFile(index)
                    }
                  >


                    {/* FILE SELECT BUTTON */}
    <button
      type="button"
      className="file-left file-select-button"
      onClick={() => handleSelectFile(index)}
    >

      <div className="csv-file-icon">
        CSV
      </div>

      <div className="file-details">

        <strong>
          {file.name}
        </strong>

        <span>
          {formatFileSize(file.size)}
        </span>

        {file.analyzed && (
          <span className="analyzed-label">
            ✓ Analyzed
          </span>
        )}

      </div>

    </button>

                    <div className="file-actions">

                      {selectedIndex === index && (
                        <span className="current-label">
                          Current
                        </span>
                      )}

                      <button
                        type="button"
                        className="remove-file-button"

                        onClick={() => handleRemoveFile(index)}
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

          {/* CURRENT FILE */}
          {selectedFile && (
            <div className="current-file-box">

              <div>
                <span className="current-file-label">
                  CURRENT DATASET
                </span>

                <strong>
                  {selectedFile.name}
                </strong>
              </div>

              <span>
                {selectedFile.analyzed
                  ? "Analysis completed"
                  : "Ready for analysis"}
              </span>

            </div>
          )}



          {/* ANALYZE BUTTON */}
          <button
          type= "button"
            className="analyze-button-large"
            onClick={handleAnalyze}
            disabled={!selectedFile || loading}
          >
            {loading
              ? "Analyzing..."
              : "▶  Analyze Current Dataset"}
          </button>

          {/* MESSAGE */}
          {message && (
            <div className="upload-message success">
              ✓ {message}
            </div>
          )}

          {error && (
            <div className="upload-message error">
              ✕ {error}
            </div>
          )}

        </div>

        {/* RIGHT SIDE */}
        <div className="dataset-info-panel">

          <div className="dataset-info-title">
            <span>▤</span>
            <h2>Dataset Information</h2>
          </div>

          <div className="info-row">
            <span>File Format</span>
            <strong>CSV</strong>
          </div>

          <div className="info-row">
            <span>Processing Mode</span>
            <strong>Local</strong>
          </div>

          <div className="info-row">
            <span>Analysis Pipeline</span>
            <strong>Module A → Module B</strong>
          </div>

          <div className="info-row">
            <span>Time Points</span>
            <strong>0h / 24h / 96h / 168h</strong>
          </div>

          <div className="info-row">
            <span>Input Data</span>
            <strong>
              Iddq, Leakage, Prop Delay
            </strong>
          </div>

          <div className="info-row">
            <span>Target</span>
            <strong>
              Anomaly Detection + 168h Prediction
            </strong>
          </div>

          <div className="dataset-note">

            <strong>
              ⓘ Note
            </strong>

            <p>
              Ensure the CSV file contains all required
              columns including component details,
              lot_id and time-series measurements.
            </p>

          </div>

        </div>

      </div>

      {/* PROCESSING PIPELINE */}
      <div className="processing-section">

        <div className="processing-header">

          <div>
            <span className="processing-icon">
              ⌘
            </span>

            <h2>
              Processing Pipeline
            </h2>
          </div>

          <p>
            Each selected dataset is processed individually.
          </p>

        </div>

        <div className="pipeline-row">

          <div className="pipeline-item active">
            <span>1</span>

            <div>
              <strong>CSV Upload</strong>
              <p>Select dataset</p>
            </div>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-item">
            <span>2</span>

            <div>
              <strong>Module A</strong>
              <p>Median / MAD anomaly</p>
            </div>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-item">
            <span>3</span>

            <div>
              <strong>Module B</strong>
              <p>168h drift prediction</p>
            </div>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-item">
            <span>4</span>

            <div>
              <strong>Results</strong>
              <p>Pass / Reject + Explanation</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default DataUpload;