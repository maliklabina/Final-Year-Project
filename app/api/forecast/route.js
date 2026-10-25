import { NextResponse } from 'next/server';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';

export async function POST(req) {
  let upstream;
  try {
    upstream = await fetch(`${ML_SERVICE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await req.text(),
    });
  } catch {
    return NextResponse.json(
      {
        detail: {
          code: 'ML_SERVICE_DOWN',
          message:
            'The forecast service is not running. Start it with: uvicorn main:app --reload --port 8000',
        },
      },
      { status: 503 }
    );
  }

  // Safely parse the upstream body — Prophet may return an empty or
  // non-JSON body on certain errors, which would crash the route handler
  // and cause Next.js to send an empty response (triggering the
  // "Unexpected end of JSON input" error on the client).
  let json;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      {
        detail: {
          code: 'FORECAST_PARSE_ERROR',
          message:
            `ML service returned an unreadable response (HTTP ${upstream.status}). ` +
            'Check the uvicorn terminal for errors.',
        },
      },
      { status: 502 }
    );
  }

  return NextResponse.json(json, { status: upstream.status });
}
