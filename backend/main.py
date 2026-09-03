"""
ReconcileX — FastAPI Application Entrypoint
AI Finance Controller for Multi-Source Financial Reconciliation
Razorpay AI Buildathon 2026 · Track 04
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.batches import router as batches_router
from api.export import router as export_router
from api.records import router as records_router
from config import CORS_ORIGINS
from models.database import init_db
from services.ml_classifier import ml_classifier_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("reconcilex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown handlers."""
    logger.info("Initializing ReconcileX database and services...")
    await init_db()
    # Reload ML artifacts if needed
    ml_classifier_service._load_artifacts()
    logger.info("ReconcileX backend is ready!")
    yield
    logger.info("Shutting down ReconcileX...")


app = FastAPI(
    title="ReconcileX API",
    description="AI Finance Controller for Multi-Source Financial Reconciliation — Razorpay Track 04",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for hackathon local & preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────
app.include_router(batches_router, prefix="/api")
app.include_router(records_router, prefix="/api")
app.include_router(export_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint confirming services are active."""
    return {
        "status": "healthy",
        "service": "ReconcileX AI Finance Controller",
        "models_loaded": {
            "l1": ml_classifier_service.l1_bundle is not None,
            "l2": ml_classifier_service.l2_bundle is not None,
        },
        "fee_policy": ml_classifier_service.fee_policy,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
