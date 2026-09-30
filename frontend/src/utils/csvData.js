// src/utils/csvData.js
// The production input contract is WIDE format.
// UI pages use normalized LONG rows because that is convenient for charts.

import {
  UPLOADED_CSV_STORAGE_KEY,
} from "./analysisStore";

const REQUIRED_WIDE_COLUMNS = [
  "component_id",
  "lot_id",
  "iddq_0h",
  "iddq_24h",
  "iddq_96h",
  "iddq_168h",
  "leakage_0h",
  "leakage_24h",
  "leakage_96h",
  "leakage_168h",
  "prop_delay_0h",
  "prop_delay_24h",
  "prop_delay_96h",
  "prop_delay_168h",
];

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCSVRows(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error("CSV is empty or contains no data rows.");
  }

  const headers = parseCSVLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCSVLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    if (!row.component_id || !row.lot_id) {
      throw new Error(
        `CSV row ${rowIndex + 2} is missing component_id or lot_id.`
      );
    }

    return row;
  });
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasWideSchema(headers) {
  return REQUIRED_WIDE_COLUMNS.every((column) => headers.includes(column));
}

function hasLegacyLongSchema(headers) {
  const required = [
    "component_id",
    "lot_id",
    "timestamp_h",
    "iddq_uA",
    "leakage_uA",
    "prop_delay_ns",
  ];

  return required.every((column) => headers.includes(column));
}

function normalizeWideRows(rawRows) {
  const timestamps = [0, 24, 96, 168];

  return rawRows.flatMap((raw) =>
    timestamps.map((timestamp) => ({
      component_id: String(raw.component_id),
      lot_id: String(raw.lot_id),
      timestamp_h: timestamp,
      iddq_uA: toNumber(raw[`iddq_${timestamp}h`]),
      leakage_uA: toNumber(raw[`leakage_${timestamp}h`]),
      prop_delay_ns: toNumber(raw[`prop_delay_${timestamp}h`]),
      // `is_defective` is ground truth only. It is never sent to the model.
      is_defective:
        raw.is_defective === undefined || raw.is_defective === ""
          ? null
          : Number(raw.is_defective),
      defective:
        raw.is_defective === undefined || raw.is_defective === ""
          ? 0
          : Number(raw.is_defective),
      archetype: raw.archetype || "",
      curve_shape: raw.curve_shape || "",
      hidden_within_limits:
        raw.hidden_within_limits === ""
          ? null
          : String(raw.hidden_within_limits).toLowerCase() === "true",
    }))
  );
}

function normalizeLegacyRows(rawRows) {
  return rawRows.map((raw, index) => ({
    component_id: String(raw.component_id),
    lot_id: String(raw.lot_id),
    timestamp_h: Number(raw.timestamp_h),
    iddq_uA: toNumber(raw.iddq_uA),
    leakage_uA: toNumber(raw.leakage_uA),
    prop_delay_ns: toNumber(raw.prop_delay_ns),
    is_defective:
      raw.is_defective !== undefined
        ? toNumber(raw.is_defective)
        : toNumber(raw.defective),
    defective:
      raw.is_defective !== undefined
        ? toNumber(raw.is_defective)
        : toNumber(raw.defective),
    archetype: raw.archetype || "",
    curve_shape: raw.curve_shape || "",
    hidden_within_limits:
      raw.hidden_within_limits === undefined
        ? null
        : String(raw.hidden_within_limits).toLowerCase() === "true",
  }));
}

export function parseCSV(text) {
  const rawRows = parseCSVRows(text);
  const headers = Object.keys(rawRows[0] || {});

  if (hasWideSchema(headers)) {
    return normalizeWideRows(rawRows);
  }

  if (hasLegacyLongSchema(headers)) {
    return normalizeLegacyRows(rawRows);
  }

  throw new Error(
    "Unsupported CSV schema. Expected the final wide DriftGuard schema or the legacy long-format demo schema."
  );
}

export async function loadCSVData() {
  const uploadedCSV = localStorage.getItem(UPLOADED_CSV_STORAGE_KEY);

  const text = uploadedCSV || (await loadDemoCSV());
  return parseCSV(text);
}

async function loadDemoCSV() {
  const response = await fetch("/synthetic_components_500.csv");

  if (!response.ok) {
    throw new Error("Demo CSV could not be loaded.");
  }

  return response.text();
}

export function getComponentIds(data) {
  return [
    ...new Set((data || []).map((item) => String(item.component_id))),
  ];
}

export function getLotIds(data) {
  return [
    ...new Set((data || []).map((item) => String(item.lot_id))),
  ];
}

export function getComponentData(data, componentId) {
  return (data || [])
    .filter((item) => String(item.component_id) === String(componentId))
    .sort((a, b) => Number(a.timestamp_h) - Number(b.timestamp_h));
}

export function getLotData(data, lotId) {
  return (data || []).filter(
    (item) => String(item.lot_id) === String(lotId)
  );
}
