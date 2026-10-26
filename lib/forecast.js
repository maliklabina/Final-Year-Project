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
 * POST the daily series to the forecast service.
 *
 * Routing strategy:
 *   • Dev (localhost)        → always use /api/forecast (Next.js proxies to ML service,
 *                              avoids any browser CORS / mixed-content issues)
 *   • Deployed static site   → ML service cannot be proxied; throw ML_SERVICE_DOWN
 *                              immediately unless NEXT_PUBLIC_ML_SERVICE_URL is set
 *                              pointing to a deployed ML service.
 *
 * Throws ForecastError on any failure.
 */
export async function fetchForecast(series, periods = 90) {
  // ── Determine the URL ──────────────────────────────────────────────────────
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  // If an explicit public ML URL is provided, always use it directly
  const explicitMlUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL;

  let url;
  if (explicitMlUrl) {
    // Deployed ML service URL provided via env — call it directly
    url = `${explicitMlUrl}/forecast`;
  } else if (isLocalhost) {
    // Local dev — use Next.js API proxy route (avoids CORS issues)
    url = '/api/forecast';
  } else {
    // Deployed static site with no ML service URL configured
    throw new ForecastError(
      'ML_SERVICE_DOWN',
      'The Expense Forecast feature requires the local ML service to be running. ' +
        'This feature is only available when running the app locally.'
    );
  }

  // ── Fetch with a generous timeout (Prophet can take ~30s) ─────────────────
  let res;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000); // 2 min timeout
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: series, periods }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ForecastError(
        'FORECAST_TIMEOUT',
        'The forecast request timed out (>2 min). Try again or reduce the dataset.'
      );
    }
    throw new ForecastError(
      'ML_SERVICE_DOWN',
      `Cannot connect to the forecast service (${url}). ` +
        'Make sure the ML service is running on port 8000.'
    );
  }

  // ── Safely parse JSON ──────────────────────────────────────────────────────
  // An empty body (e.g. a crashed route handler) would otherwise throw a raw
  // SyntaxError that bypasses the ForecastError path.
  let body = {};
  try {
    body = await res.json();
  } catch {
    throw new ForecastError(
      'FORECAST_PARSE_ERROR',
      `Server returned an empty or invalid response (HTTP ${res.status}). ` +
        'Check that the ML service (uvicorn) is running and healthy.'
    );
  }

  if (!res.ok) {
    const detail = body?.detail ?? {};
    throw new ForecastError(
      detail.code ?? 'FORECAST_FAILED',
      detail.message ?? 'An unknown forecast error occurred.'
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
