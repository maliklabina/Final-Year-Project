from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
from prophet import Prophet
import logging

# Suppress noisy Prophet / cmdstanpy logs
logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

app = FastAPI(title="FinSight ML Service", version="1.0.0")

# Allow requests from the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ─────────────────────────────────────────────────

class DayPoint(BaseModel):
    ds: str   # "YYYY-MM-DD"
    y: float


class ForecastRequest(BaseModel):
    data: List[DayPoint]
    periods: int = 90


class ForecastPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float


class ForecastResponse(BaseModel):
    forecast: List[ForecastPoint]


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "FinSight ML Service"}


# ── Forecast endpoint ──────────────────────────────────────────────────────────

@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest):
    if len(req.data) < 7:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INSUFFICIENT_DATA",
                "message": f"Need at least 7 data points, got {len(req.data)}.",
            },
        )

    # Build DataFrame
    df = pd.DataFrame([{"ds": p.ds, "y": p.y} for p in req.data])
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].clip(lower=0)  # expenses can't be negative

    # Fit Prophet
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,   # regularise — prevents overfitting on small datasets
        seasonality_prior_scale=10,
        interval_width=0.80,            # 80 % confidence band
    )

    # Add Indian festival seasonality as custom regressors via country holidays
    try:
        model.add_country_holidays(country_name="IN")
    except Exception:
        pass  # silently skip if holidays package not available

    model.fit(df)

    # Forecast
    future = model.make_future_dataframe(periods=req.periods, freq="D")
    raw = model.predict(future)

    # Return only the future rows (not the historical fitted values)
    forecast_df = raw[raw["ds"] > df["ds"].max()][["ds", "yhat", "yhat_lower", "yhat_upper"]]
    forecast_df = forecast_df.head(req.periods)

    # Clip negatives (spending can't be < 0)
    forecast_df["yhat"]       = forecast_df["yhat"].clip(lower=0)
    forecast_df["yhat_lower"] = forecast_df["yhat_lower"].clip(lower=0)
    forecast_df["yhat_upper"] = forecast_df["yhat_upper"].clip(lower=0)

    result = [
        ForecastPoint(
            ds=row["ds"].strftime("%Y-%m-%d"),
            yhat=round(row["yhat"], 2),
            yhat_lower=round(row["yhat_lower"], 2),
            yhat_upper=round(row["yhat_upper"], 2),
        )
        for _, row in forecast_df.iterrows()
    ]

    return ForecastResponse(forecast=result)
