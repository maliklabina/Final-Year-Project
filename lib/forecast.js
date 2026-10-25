import { toDateInputValue, fromDateInput } from './format';

// ── Constants ─────────────────────────────────────────────────────────────────
export const MIN_DAYS = 90;

// ── Error class ───────────────────────────────────────────────────────────────
export class ForecastError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ForecastError';
  }
}

// ── buildDailySeries ──────────────────────────────────────────────────────────
/**
 * Convert expense transactions to a continuous daily series.
 *
 * - Filters to expenses only.
 * - Sums amounts per local calendar day (using toDateInputValue).
 * - Fills every day between the first and last observed day with 0.
 * - Uses Array.from(map.keys()) — NOT spread — for Map iteration.
 */
export function buildDailySeries(transactions) {
  // Keep only expenses
  const expenses = transactions.filter((t) => t.type === 'expense');
  if (expenses.length === 0) return [];

  // Aggregate per local day string
  const map = new Map();
  for (const t of expenses) {
    const key = toDateInputValue(t.date);
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }

  // Find min/max dates
  const keys = Array.from(map.keys()).sort();
  if (keys.length === 0) return [];

  const start = fromDateInput(keys[0]);
  const end = fromDateInput(keys[keys.length - 1]);

  // Build continuous range
  const series = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const ds = toDateInputValue(cursor);
    series.push({ ds, y: map.get(ds) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

// ── fetchForecast ─────────────────────────────────────────────────────────────
/**
 * POST the daily series to the Next.js proxy route.
 * Throws ForecastError on non-2xx responses.
 */
export async function fetchForecast(series, periods = 90) {
  const mlBase = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000';
  const url = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !process.env.NEXT_PUBLIC_ML_SERVICE_URL
    ? '/api/forecast'
    : `${mlBase}/forecast`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: series, periods }),
    });
  } catch {
    throw new ForecastError(
      'ML_SERVICE_DOWN',
      `Cannot connect to the forecast service at ${url}. Make sure it is running.`
    );
  }

  // Safely parse — an empty body (e.g. a crashed route handler) would
  // otherwise throw a raw SyntaxError that bypasses the ForecastError path.
  let body = {};
  try {
    body = await res.json();
  } catch {
    throw new ForecastError(
      'FORECAST_PARSE_ERROR',
      `Server returned an empty or invalid response (HTTP ${res.status}). ` +
        'Make sure the ML service is running and try again.'
    );
  }

  if (!res.ok) {
    const detail = body?.detail ?? {};
    throw new ForecastError(
      detail.code ?? 'FORECAST_FAILED',
      detail.message ?? 'An unknown error occurred.'
    );
  }

  return body.forecast;
}

// ── shortDate ─────────────────────────────────────────────────────────────────
/**
 * Format a "YYYY-MM-DD" string as "11 Oct" style using en-IN locale.
 */
export function shortDate(ds) {
  const d = fromDateInput(ds);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
