'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { useAuth } from '@/lib/AuthContext';
import { useTransactions } from '@/lib/useTransactions';
import { seedDemoData } from '@/lib/demoData';
import { formatINR } from '@/lib/format';
import {
  MIN_DAYS,
  ForecastError,
  buildDailySeries,
  fetchForecast,
  shortDate,
} from '@/lib/forecast';
import StatCard from '@/components/StatCard';

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#fff',
        border: '3px solid #111827',
        boxShadow: '4px 4px 0px #111827',
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 160,
      }}
    >
      <p className="font-bold text-xs mb-1">{label}</p>
      {payload.map((p, i) => {
        if (p.name === 'band' || Array.isArray(p.value)) return null;
        return (
          <p key={i} className="text-xs">
            <span className="font-semibold">{p.name}: </span>
            {formatINR(p.value)}
          </p>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const { user } = useAuth();
  const { transactions, loading } = useTransactions();

  const [horizon, setHorizon] = useState(90);
  const [running, setRunning] = useState(false);
  const [forecast90, setForecast90] = useState(null);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);

  // Build the daily expense series from all transactions
  const series = useMemo(() => buildDailySeries(transactions), [transactions]);
  const trainingDays = series.length;
  const hasEnough = trainingDays >= MIN_DAYS;

  // Slice the 90-day result to the selected horizon (no new request)
  const forecastSlice = useMemo(
    () => (forecast90 ? forecast90.slice(0, horizon) : null),
    [forecast90, horizon]
  );

  // ── Stats from the current slice ────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!forecastSlice || forecastSlice.length === 0) return null;

    const total = forecastSlice.reduce((s, p) => s + p.yhat, 0);
    const avg = total / forecastSlice.length;
    const peak = forecastSlice.reduce((best, p) => (p.yhat > best.yhat ? p : best));

    // % change vs the actual last-<horizon>-days of real data
    const actualLast = series.slice(-horizon);
    const actualTotal = actualLast.reduce((s, p) => s + p.y, 0);
    const pctChange =
      actualTotal > 0 ? ((total - actualTotal) / actualTotal) * 100 : null;

    return { total, avg, pctChange, peak };
  }, [forecastSlice, series, horizon]);

  // ── Chart data ───────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const rows = [];

    // Last 60 days of actual data
    const last60 = series.slice(-60);
    for (const p of last60) {
      rows.push({ ds: p.ds, label: shortDate(p.ds), actual: p.y });
    }

    // Forecast slice
    if (forecastSlice) {
      for (const fp of forecastSlice) {
        rows.push({
          ds: fp.ds,
          label: shortDate(fp.ds),
          yhat: fp.yhat,
          band: [fp.yhat_lower, fp.yhat_upper],
        });
      }
    }

    return rows;
  }, [series, forecastSlice]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!hasEnough || running) return;
    setRunning(true);
    setError(null);
    setForecast90(null);
    try {
      const result = await fetchForecast(series, 90);
      setForecast90(result);
    } catch (err) {
      setError(err instanceof ForecastError ? err : new ForecastError('FORECAST_FAILED', String(err)));
    } finally {
      setRunning(false);
    }
  };

  const handleSeed = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      await seedDemoData(user.uid);
    } catch (err) {
      console.error('Seed error:', err);
    } finally {
      setSeeding(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── HEADER CARD ────────────────────────────────────────────────────── */}
      <div className="card card-static p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs ai-pill">
            PROPHET TIME-SERIES LAB
          </span>
        </div>
        <h1 className="text-3xl font-bold">Expense Forecast</h1>
        <p className="text-sm font-medium opacity-70">
          Training days available:{' '}
          <span className={`font-bold ${hasEnough ? 'text-green-700' : 'text-orange-600'}`}>
            {loading ? '…' : trainingDays}
          </span>{' '}
          / {MIN_DAYS} required
        </p>

        {/* Horizon selector */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold opacity-70">FORECAST HORIZON:</span>
          {[30, 60, 90].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold border-2 border-[#111827] transition-all ${
                horizon === h
                  ? 'bg-[#FF5722] text-white shadow-[3px_3px_0px_#111827]'
                  : 'bg-white hover:bg-[#FEF08A]'
              }`}
            >
              {h} days
            </button>
          ))}
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!hasEnough || running}
          className="px-6 py-2.5 rounded-xl text-sm accent-btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Training Prophet…' : 'Run Prophet Forecast'}
        </button>
      </div>

      {/* ── INSUFFICIENT DATA BANNER ────────────────────────────────────────── */}
      {!loading && !hasEnough && (
        <div
          className="card card-static p-5 flex flex-wrap items-center justify-between gap-4"
          style={{ background: '#FEF08A' }}
        >
          <div>
            <p className="font-bold text-sm">⚠ Not enough data to train Prophet</p>
            <p className="text-xs mt-1 opacity-80">
              You have <strong>{trainingDays}</strong> day(s) of expense data.
              Prophet needs at least <strong>{MIN_DAYS}</strong> days. Load demo data (6 months) to try it out.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2 rounded-xl text-xs accent-btn disabled:opacity-60"
            >
              {seeding ? 'Loading…' : 'Load Demo Data'}
            </button>
            <Link href="/dashboard" className="px-4 py-2 rounded-xl text-xs card font-bold flex items-center">
              ← Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* ── TRAINING SPINNER ────────────────────────────────────────────────── */}
      {running && (
        <div className="card card-static p-6 flex items-center gap-4">
          <span className="text-2xl animate-spin">⚙</span>
          <div>
            <p className="font-bold">Training Prophet…</p>
            <p className="text-xs opacity-70 mt-0.5">
              Fitting model on {trainingDays} days of data. This may take 10–30 seconds.
            </p>
          </div>
        </div>
      )}

      {/* ── ERROR CARD ───────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="card card-static p-6 space-y-3"
          style={{ background: '#FEE2E2', borderColor: '#B91C1C', boxShadow: '6px 6px 0px #B91C1C' }}
        >
          <p className="font-bold text-red-800 text-lg">
            {error.code === 'ML_SERVICE_DOWN'
              ? '🔌 ML Service Required'
              : error.code === 'FORECAST_TIMEOUT'
              ? '⏱ Forecast Request Timed Out'
              : '❌ Forecast Failed'}
          </p>
          <p className="text-sm text-red-700">{error.message}</p>
          {error.code === 'ML_SERVICE_DOWN' && (
            <div className="space-y-2 mt-2 pt-2 border-t border-red-200">
              <p className="text-xs font-bold text-red-800">
                To run the ML service locally:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-white/80 p-3 rounded-lg border border-red-200">
                  <p className="font-bold text-stone-700 font-sans mb-1">macOS / Linux</p>
                  <pre className="text-stone-900 overflow-x-auto whitespace-pre">
                    cd ml-service{'\n'}
                    source venv/bin/activate{'\n'}
                    uvicorn main:app --reload --port 8000
                  </pre>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-red-200">
                  <p className="font-bold text-stone-700 font-sans mb-1">Windows</p>
                  <pre className="text-stone-900 overflow-x-auto whitespace-pre">
                    cd ml-service{'\n'}
                    venv\Scripts\activate{'\n'}
                    uvicorn main:app --reload --port 8000
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RESULT: STAT CARDS + CHART ──────────────────────────────────────── */}
      {forecastSlice && stats && (
        <>
          {/* 4 stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              tint={1}
              label="PREDICTED SPEND"
              tag={`[NEXT ${horizon} DAYS]`}
              value={formatINR(stats.total)}
              note="Sum of forecast yhat values"
            />
            <StatCard
              tint={2}
              label="AVG PER DAY"
              tag="[FORECAST]"
              value={formatINR(stats.avg)}
              note={`Over the ${horizon}-day horizon`}
            />
            <StatCard
              tint={3}
              label="VS LAST PERIOD"
              tag="[% CHANGE]"
              value={
                stats.pctChange === null
                  ? '—'
                  : `${stats.pctChange >= 0 ? '+' : ''}${stats.pctChange.toFixed(1)}%`
              }
              note={`Compared to actual last ${horizon} days`}
            />
            <StatCard
              tint={4}
              label="PEAK DAY"
              tag="[FORECAST]"
              value={formatINR(stats.peak.yhat)}
              note={shortDate(stats.peak.ds)}
            />
          </div>

          {/* Chart */}
          <div className="card card-static p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold">Prophet Forecast — Expense Timeline</h3>
              <p className="text-xs opacity-70 mt-0.5">
                Black: last 60 days actual · Orange: {horizon}-day forecast · Lavender band: 80% confidence interval
              </p>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#111827' }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#111827' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip content={<ForecastTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 8 }}
                />
                {/* Confidence band (lavender) — drawn first so lines sit on top */}
                <Area
                  dataKey="band"
                  name="80% CI"
                  stroke="none"
                  fill="#DDD6FE"
                  fillOpacity={0.8}
                  connectNulls
                  legendType="rect"
                />
                {/* Actual spend — black line */}
                <Line
                  dataKey="actual"
                  name="Actual"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                {/* Forecast — orange line */}
                <Line
                  dataKey="yhat"
                  name="Forecast"
                  stroke="#FF5722"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
