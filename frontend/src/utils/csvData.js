// src/utils/csvData.js

export async function loadCSVData() {
  // First try to use the CSV uploaded by the user.
  const uploadedCSV = localStorage.getItem(
    "burnInUploadedCSV"
  );

  // If an uploaded CSV exists, use it.
  // Otherwise, fall back to the demo CSV.
  const text = uploadedCSV
    ? uploadedCSV
    : await loadDemoCSV();

  return parseCSV(text);
}


// Load the original demo CSV from /public
async function loadDemoCSV() {
  const response = await fetch(
    "/synthetic_components_500.csv"
  );

  if (!response.ok) {
    throw new Error(
      "CSV file could not be loaded."
    );
  }

  return await response.text();
}


// Convert CSV text into JavaScript objects
function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error(
      "CSV file is empty or contains no data."
    );
  }

  const headers = lines[0]
    .split(",")
    .map((header) => header.trim());

  const data = lines.slice(1).map((line) => {
    const values = line.split(",");

    const row = {};

    headers.forEach((header, index) => {
      row[header] =
        values[index]?.trim() || "";
    });

    return {
      component_id: row.component_id,
      lot_id: row.lot_id,
      timestamp_h: Number(row.timestamp_h),
      iddq_uA: Number(row.iddq_uA),
      leakage_uA: Number(row.leakage_uA),
      prop_delay_ns: Number(row.prop_delay_ns),
      defective: Number(row.defective),
    };
  });

  return data;
}


export function getComponentIds(data) {
  return [
    ...new Set(
      data.map(
        (item) => item.component_id
      )
    ),
  ];
}


export function getLotIds(data) {
  return [
    ...new Set(
      data.map(
        (item) => item.lot_id
      )
    ),
  ];
}


export function getComponentData(
  data,
  componentId
) {
  return data
    .filter(
      (item) =>
        item.component_id === componentId
    )
    .sort(
      (a, b) =>
        a.timestamp_h - b.timestamp_h
    );
}


export function getLotData(
  data,
  lotId
) {
  return data.filter(
    (item) =>
      item.lot_id === lotId
  );
}
