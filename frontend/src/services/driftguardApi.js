export const API_BASE_URL = import.meta.env.VITE_DRIFTGUARD_API_URL || "http://localhost:8000";

export async function analyzeCsv(file) {
  if (!(file instanceof File)) {
    throw new Error("Please provide a CSV File object.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail || "DriftGuard analysis failed.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payload;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error("Backend health check failed.");
  }
  return response.json();
}

export async function getModelInfo() {
  const response = await fetch(`${API_BASE_URL}/model-info`);
  if (!response.ok) {
    throw new Error("Unable to fetch DriftGuard model information.");
  }
  return response.json();
}
