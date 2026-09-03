"""
ReconcileX — Configuration and Constants
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "reconriver"
ML_DIR = BASE_DIR / "ml"
DB_DIR = BASE_DIR / "db"

# ── Database ───────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_DIR / 'reconcilex.db'}")

# ── AI ─────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
AI_TIMEOUT_SECONDS = int(os.getenv("AI_TIMEOUT_SECONDS", "15"))

# ── Reconciliation Constants ───────────────────────────────────────────
# Fee policy: derived from clean MATCHED records during training
# Format: fee = gross_amount * FEE_RATE_PCT + FEE_FIXED
# These are placeholder defaults; actual values are computed in ml/train.py
DEFAULT_FEE_RATE_PCT = 0.025    # 2.5%
DEFAULT_FEE_FIXED = 0.50       # fixed component

# Settlement window (days)
SETTLEMENT_WINDOW_DAYS = 3

# ── ML Thresholds ──────────────────────────────────────────────────────
ML_AUTO_RESOLVE_CONFIDENCE = 0.85   # auto-resolve if confidence >= this
ML_AI_INVESTIGATE_THRESHOLD = 0.70  # send to AI if confidence < this
ML_AMBIGUOUS_CLASSES = {"AMBIGUOUS_MATCH", "INVALID_SOURCE_ROW"}  # always send to AI

# ── Policy Engine ──────────────────────────────────────────────────────
# Classes that can be auto-resolved when confidence is high
AUTO_RESOLVABLE_CLASSES = {
    "MATCHED",
    "FEE_MISMATCH",
    "REFUND_MATCHED",
    "PARTIAL_REFUND",
    "LATE_SETTLEMENT",
}

# Classes that are always exceptions (never auto-resolve)
ALWAYS_EXCEPTION_CLASSES = {
    "CURRENCY_MISMATCH",
    "INVALID_SOURCE_ROW",
}

# ── API ────────────────────────────────────────────────────────────────
API_PREFIX = "/api"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
