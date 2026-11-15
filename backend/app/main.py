import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (registers every table on Base.metadata)
from app.database import Base, engine
from app.routers import astronauts, measurements, analytics

# Built dashboard (cd frontend && npm run build). Served from the same domain as the API, so no CORS is needed.
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend" / "dist"))

# A fresh clone has no database yet: create empty tables so the API answers with empty lists instead of 500s.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AstroHealth API")

app.include_router(astronauts.router, prefix="/api/v1")
app.include_router(measurements.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


if (FRONTEND_DIST / "index.html").is_file():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def home():
        return {"message": "AstroHealth API is running"}
