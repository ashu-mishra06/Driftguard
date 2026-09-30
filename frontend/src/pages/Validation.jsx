import React from "react";

function Validation({ validationResults, setValidationResults }) {
  return (
    <div className="validation-page">
      <div className="upload-page-header">
        <span className="upload-eyebrow">VALIDATION</span>

        <h1>Domain-Shift Stress Test</h1>

        <p>
          Compare DriftGuard performance on the original dataset
          and an unseen domain-shifted dataset.
        </p>
      </div>

      <div className="upload-panel">
        <div className="upload-panel-title">
          <div className="upload-title-icon">✓</div>

          <div>
            <h2>Validation Results</h2>

            <p>
              Stress-test results will be displayed here after
              the backend validation pipeline is connected.
            </p>
          </div>
        </div>

        {!validationResults ? (
          <div className="dataset-note">
            <strong>ⓘ Validation not loaded</strong>

            <p>
              The frontend is ready for the validation JSON.
              Once FastAPI provides the stress-test results,
              they can be stored in validationResults and
              displayed here.
            </p>
          </div>
        ) : (
          <div>
            <p>Validation results loaded.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Validation;