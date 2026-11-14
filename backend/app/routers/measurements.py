from fastapi import APIRouter

router = APIRouter(
    prefix="/measurements",
    tags=["Measurements"]
)


@router.get("/")
def get_measurements():
    return [
        {"metric": "heart_rate", "value": 72},
        {"metric": "sleep_duration", "value": 7.5}
    ]


@router.get("/{metric}")
def get_measurement(metric: str):
    return {
        "metric": metric,
        "value": 72
    }