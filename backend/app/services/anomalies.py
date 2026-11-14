from collections.abc import Mapping, Sequence
from statistics import median


def detect_statistical_anomaly(current: float, historical_values: Sequence[float], *,
                               minimum: int = 7, threshold: float = 3.5) -> dict:
    values = [float(v) for v in historical_values if v is not None]
    if len(values) < minimum:
        return {"status": "insufficient_data", "baseline": None, "mad": None, "robust_z": None}
    center = median(values)
    mad = median([abs(v - center) for v in values])
    if mad == 0:
        score = 0.0 if float(current) == center else float("inf")
    else:
        score = 0.67448975 * (float(current) - center) / mad
    return {"status": "statistical_anomaly" if abs(score) >= threshold else "within_baseline",
            "baseline": float(center), "mad": float(mad),
            "robust_z": score if score != float("inf") else None,
            "direction": "high" if current > center else "low" if current < center else None}


PAIRS = (
    (("resting_heart_rate", "sleep_duration"), "Elevated resting heart rate coincides with reduced sleep duration",
     lambda v: v.get("resting_heart_rate", "") == "high" and v.get("sleep_duration", "") == "low"),
    (("sleep_duration", "fatigue"), "Reduced sleep coincides with increased fatigue",
     lambda v: v.get("sleep_duration", "") == "low" and v.get("fatigue", "") == "high"),
    (("stress", "sleep_duration"), "Elevated stress coincides with a change in sleep duration",
     lambda v: v.get("stress", "") == "high" and v.get("sleep_duration", "") in {"low", "high"}),
    (("activity", "fatigue"), "Changed activity coincides with increased fatigue",
     lambda v: v.get("activity", "") in {"low", "high"} and v.get("fatigue", "") == "high"),
)


def detect_combined_anomalies(analysis_results: Sequence[Mapping]) -> list[dict]:
    directions = {item.get("metric"): item.get("direction") for item in analysis_results
                  if item.get("status") == "statistical_anomaly"}
    findings = []
    for metrics, message, matches in PAIRS:
        if all(metric in directions for metric in metrics) and matches(directions):
            findings.append({"metrics": list(metrics), "message": message,
                             "interpretation": "co-occurrence; does not imply causation"})
    return findings
