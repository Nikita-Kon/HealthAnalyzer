from collections import defaultdict
from datetime import date, datetime, timedelta
from .statistics import calculate_baseline, calculate_deviation, calculate_trend
from .anomalies import detect_statistical_anomaly, detect_combined_anomalies


def analyze_health(measurements, as_of):
    cutoff = date.fromisoformat(as_of) if isinstance(as_of, str) else as_of
    rows = []

    for row in measurements:
        timestamp = row["measured_at"]
        day = date.fromisoformat(timestamp[:10]) if isinstance(timestamp, str) else timestamp.date() if isinstance(timestamp, datetime) else timestamp
        if day <= cutoff and row.get("value") is not None:
            rows.append({**row, "_day": day})
    by_metric = defaultdict(list)

    for row in rows:
        by_metric[row["metric"]].append(row)

    findings, metrics_result = [], {}
    lower_bad = {"sleep_duration", "sleep_score", "mood", "readiness"}
    higher_bad = {"resting_heart_rate", "fatigue", "stress"}

    for metric, series in by_metric.items():
        series.sort(key=lambda r: r["_day"])
        current_row = series[-1]
        current_day = current_row["_day"]

        history = [r["value"] for r in series if current_day - timedelta(days=14) <= r["_day"] < current_day]
        result = detect_statistical_anomaly(current_row["value"], history)
        baseline = calculate_baseline(history)
        trend_rows = [r["value"] for r in series if current_day - timedelta(days=6) <= r["_day"] <= current_day]
        trend = calculate_trend(trend_rows)

        metrics_result[metric] = {"value": current_row["value"], "unit": current_row.get("unit"),
            "measured_at": current_day.isoformat(), "baseline": baseline,
            "deviation_percent": calculate_deviation(current_row["value"], baseline), "trend": trend,
            "sample_count": len(history)}

        if result["status"] == "statistical_anomaly":
            direction = result["direction"]
            actionable = (direction == "low" and metric in lower_bad) or (direction == "high" and metric in higher_bad)
            if actionable:
                findings.append({"metric": metric, "status": result["status"], "current": current_row["value"],
                    "baseline": result["baseline"], "unit": current_row.get("unit"),
                    "deviation_percent": calculate_deviation(current_row["value"], result["baseline"]),
                    "method": "personal_baseline_mad", "sample_count": len(history), "direction": direction})

    combined = detect_combined_anomalies(findings)
    status = "change_detected" if findings else "insufficient_data" if not metrics_result or any(m["baseline"] is None for m in metrics_result.values()) else "no_change_detected"
    return {"as_of": cutoff.isoformat(), "status": status, "metrics": metrics_result,
            "findings": findings, "combined_findings": combined}
