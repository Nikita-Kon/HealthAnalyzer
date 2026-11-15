from collections.abc import Sequence
from statistics import median


def _valid(values: Sequence[float]) -> list[float]:
    return [float(v) for v in values if v is not None]


def calculate_baseline(values: Sequence[float], minimum: int = 7) -> float | None:
    data = _valid(values)
    return float(median(data)) if len(data) >= minimum else None


def calculate_moving_average(values: Sequence[float], window: int = 7) -> list[float | None]:
    data = _valid(values)
    return [None] * max(0, len(data) - window + 1) + [
        sum(data[i-window+1:i+1]) / window for i in range(window-1, len(data))
    ] if len(data) >= window else [None] * len(data)


def calculate_deviation(current: float, baseline: float | None) -> float | None:
    if baseline is None or baseline == 0:
        return None
    return (float(current) - baseline) / baseline * 100


def calculate_trend(values: Sequence[float], threshold: float = 0.05) -> str:
    data = _valid(values)[-7:]
    if len(data) < 7:
        return "insufficient_data"
    start, end = median(data[:3]), median(data[-3:])
    if start == 0:
        return "stable" if end == 0 else "increasing"
    change = (end - start) / abs(start)
    return "increasing" if change > threshold else "decreasing" if change < -threshold else "stable"
