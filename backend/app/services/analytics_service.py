"""Glue between dbQuery and the analytics functions: loads data, runs analytics, shapes the API result."""

from datetime import date, timedelta

from app.services import dbQuery
from app.services.analytics import analyze_health

# Metrics analysed for every crew member (personal baseline needs ~14 days + 7 for the trend)
ANALYTICS_METRICS = (
    "resting_heart_rate", "sleep_duration", "sleep_score", "stress",
    "mood", "fatigue", "exercise_duration", "readiness",
)
LOOKBACK_DAYS = 30
LABELS = {
    "resting_heart_rate": "Resting heart rate", "sleep_duration": "Sleep duration",
    "sleep_score": "Sleep score", "stress": "Stress", "mood": "Mood", "fatigue": "Fatigue",
    "exercise_duration": "Exercise", "readiness": "Readiness",
}


def _rows(astronaut_id, as_of):
    rows = []
    for metric in ANALYTICS_METRICS:
        unit = dbQuery.DAILY_SERIES[metric][4]
        series = dbQuery.getMetricSeries(astronaut_id, metric, as_of - timedelta(days=LOOKBACK_DAYS), as_of)
        rows += [
            {"metric": metric, "value": point["value"], "unit": unit, "measured_at": point["date"]}
            for point in series
        ]
    return rows


def _round(value):
    return None if value is None else round(value, 2)


def _finding(metric, current, anomaly):
    label = LABELS[metric]
    base = {"metric": metric, "unit": dbQuery.DAILY_SERIES[metric][4], "method": "personal_baseline_mad"}

    if current is None:
        return {**base, "status": "insufficient_data", "current": None, "baseline": None,
                "deviation_percent": None, "sample_count": 0, "trend": "insufficient_data",
                "message": f"No {label.lower()} data in the last {LOOKBACK_DAYS} days"}

    finding = {**base, "current": current["value"], "baseline": _round(current["baseline"]),
               "deviation_percent": _round(current["deviation_percent"]), "sample_count": current["sample_count"],
               "trend": current["trend"], "measured_at": current["measured_at"]}

    if anomaly is not None:
        side = "above" if anomaly["direction"] == "high" else "below"
        return {**finding, "status": "statistical_anomaly", "direction": anomaly["direction"],
                "message": f"{label} is {side} personal baseline"}
    if current["baseline"] is None:
        return {**finding, "status": "insufficient_data",
                "message": f"Only {current['sample_count']} of 7 required observations in the previous 14 days"}
    return {**finding, "status": "normal", "message": f"{label} is within personal baseline"}


def getAnalytics(astronaut_id, as_of):
    """Analytics result for one astronaut on a replay date, in the API contract shape."""
    as_of = date.fromisoformat(as_of) if isinstance(as_of, str) else as_of
    result = analyze_health(_rows(astronaut_id, as_of), as_of)

    anomalies = {finding["metric"]: finding for finding in result["findings"]}
    findings = [
        _finding(metric, result["metrics"].get(metric), anomalies.get(metric))
        for metric in ANALYTICS_METRICS
    ]

    if anomalies:
        status = "change_detected"
    elif all(finding["status"] == "insufficient_data" for finding in findings):
        status = "insufficient_data"
    else:
        status = "no_change_detected"

    return {
        "as_of": as_of.isoformat(),
        "status": status,
        "findings": findings,
        "combined_findings": [
            {"metrics": combined["metrics"], "message": combined["message"]}
            for combined in result["combined_findings"]
        ],
    }
