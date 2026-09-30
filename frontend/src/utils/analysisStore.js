// Centralized persistence helpers for backend analysis results.
//
// DriftGuard v3 returns the final decision in `verdict`.
// Older prototype builds used `final_verdict` and a few UI paths used `result`.
// Normalize those names here so every page consumes one reliable shape.

export const ANALYSIS_STORAGE_KEY = "burnInAnalysisResults";
export const ANALYSIS_PAYLOAD_STORAGE_KEY = "burnInAnalysisPayload";
export const UPLOADED_CSV_STORAGE_KEY = "burnInUploadedCSV";
export const UPLOADED_FILE_NAME_STORAGE_KEY = "burnInUploadedFileName";

export const VALID_VERDICTS = new Set([
  "REJECT",
  "FLAG_FOR_REVIEW",
  "PASS",
]);

export function getResultVerdict(result) {
  const candidates = [
    result?.verdict,
    result?.final_verdict,
    result?.result,
  ];

  return (
    candidates
      .map((value) => (value == null ? "" : String(value).trim().toUpperCase()))
      .find((value) => VALID_VERDICTS.has(value)) || null
  );
}

function normalizeComponentResult(component) {
  if (!component || typeof component !== "object") {
    return null;
  }

  const verdict = getResultVerdict(component);

  // Keep the V3 contract name (`verdict`) and expose the legacy alias in the
  // frontend store so older pages do not become "NOT ANALYZED".
  return {
    ...component,
    verdict,
    final_verdict: verdict,
  };
}

export function normalizeAnalysisPayload(payload) {
  if (!payload) {
    return [];
  }

  let components = [];

  // Final V3 contract: { metadata, components, summary }
  if (Array.isArray(payload.components)) {
    components = payload.components;
  }
  // Older backend versions returned the component array directly.
  else if (Array.isArray(payload)) {
    components = payload;
  }
  // Harmless wrappers used by older integrations.
  else if (Array.isArray(payload.results)) {
    components = payload.results;
  }
  else if (Array.isArray(payload.data)) {
    components = payload.data;
  }

  return components
    .map(normalizeComponentResult)
    .filter(Boolean);
}

export function loadAnalysisResults() {
  try {
    const rawPayload = localStorage.getItem(ANALYSIS_PAYLOAD_STORAGE_KEY);
    if (rawPayload) {
      return normalizeAnalysisPayload(JSON.parse(rawPayload));
    }

    const legacy = localStorage.getItem(ANALYSIS_STORAGE_KEY);
    return legacy
      ? normalizeAnalysisPayload(JSON.parse(legacy))
      : [];
  } catch (error) {
    console.error("Failed to load stored analysis results:", error);
    return [];
  }
}

export function saveAnalysisPayload(payload) {
  const components = normalizeAnalysisPayload(payload);

  localStorage.setItem(
    ANALYSIS_PAYLOAD_STORAGE_KEY,
    JSON.stringify(payload)
  );

  // Store the normalized component list for all legacy/current UI consumers.
  localStorage.setItem(
    ANALYSIS_STORAGE_KEY,
    JSON.stringify(components)
  );

  return components;
}

export function saveUploadedCSV(text, filename = "uploaded.csv") {
  localStorage.setItem(UPLOADED_CSV_STORAGE_KEY, text);
  localStorage.setItem(UPLOADED_FILE_NAME_STORAGE_KEY, filename);
}

export function loadUploadedCSV() {
  return localStorage.getItem(UPLOADED_CSV_STORAGE_KEY);
}

export function clearAnalysisState() {
  localStorage.removeItem(ANALYSIS_STORAGE_KEY);
  localStorage.removeItem(ANALYSIS_PAYLOAD_STORAGE_KEY);
}

export function getAnalysisForComponent(results, componentId) {
  const normalizedId = String(componentId);

  return (results || []).find(
    (result) => String(result?.component_id) === normalizedId
  ) || null;
}
