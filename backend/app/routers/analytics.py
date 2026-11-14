from fastapi import APIRouter

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


@router.get("/summary")
def get_summary():
    return {
        "average_heart_rate": 70,
        "average_sleep_duration": 7.2
    }