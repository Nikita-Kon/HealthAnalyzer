from fastapi import FastAPI

from app.routers import astronauts, measurements, analytics

app = FastAPI(title="AstroHealth API")

app.include_router(astronauts.router, prefix="/api/v1")
app.include_router(measurements.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.get("/")
def home():
    return {"message": "AstroHealth API is running"}