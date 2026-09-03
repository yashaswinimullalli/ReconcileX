"""
ReconcileX — Pydantic Request & Response Schemas
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Batch Schemas ──────────────────────────────────────────────────────

class BatchCreateResponse(BaseModel):
    batch_id: str
    status: str
    name: Optional[str] = None
    total_internal: int
    total_processor: int
    total_bank: int
    message: str


class BatchSummaryResponse(BaseModel):
    batch_id: str
    status: str
    name: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_time_ms: Optional[int] = 0

    # Counts
    total_records: int = 0
    matched_count: int = 0
    auto_resolved_count: int = 0
    ai_investigated_count: int = 0
    exception_count: int = 0
    needs_review_count: int = 0

    # Rates & Amounts
    match_rate: float = 0.0
    auto_resolve_rate: float = 0.0
    unresolved_amount: float = 0.0
    throughput_records_per_sec: float = 0.0

    # L1 vs L2 Breakdown
    l1_total: int = 0
    l1_matched: int = 0
    l1_exceptions: int = 0
    l2_total: int = 0
    l2_matched: int = 0
    l2_exceptions: int = 0

    # ML Metrics
    l1_accuracy: Optional[float] = None
    l1_f1: Optional[float] = None
    l2_accuracy: Optional[float] = None
    l2_f1: Optional[float] = None


# ── Record Schemas ─────────────────────────────────────────────────────

class ReconRecordListItem(BaseModel):
    id: str
    batch_id: str
    recon_level: str              # L1_ORDER | L2_SETTLEMENT
    work_key: str
    match_method: Optional[str] = None
    match_score: Optional[float] = 1.0

    # Discrepancy info
    internal_gross: Optional[float] = None
    processor_gross: Optional[float] = None
    gross_diff: Optional[float] = 0.0
    fee_amount: Optional[float] = 0.0
    expected_net_total: Optional[float] = None
    credited_amount: Optional[float] = None
    settlement_diff: Optional[float] = 0.0
    currency: Optional[str] = "INR"

    # ML & Decision
    ml_prediction: Optional[str] = None
    ml_confidence: Optional[float] = None
    final_status: str             # AUTO_RESOLVE | NEEDS_REVIEW | EXCEPTION
    final_root_cause: Optional[str] = None
    ai_investigated: bool = False

    # Ground truth (if available)
    ground_truth_outcome: Optional[str] = None


class ReconRecordListResponse(BaseModel):
    batch_id: str
    total: int
    page: int
    limit: int
    records: list[ReconRecordListItem]


class ExceptionRecordListItem(BaseModel):
    id: str
    batch_id: str
    recon_level: str
    work_key: str
    discrepancy_amount: float
    currency: Optional[str] = "INR"
    predicted_cause: str
    ml_confidence: float
    final_status: str             # NEEDS_REVIEW | EXCEPTION
    ai_investigated: bool = False
    ai_explanation: Optional[str] = None
    recommended_action: Optional[str] = None


class ExceptionListResponse(BaseModel):
    batch_id: str
    total: int
    page: int
    limit: int
    exceptions: list[ExceptionRecordListItem]


class RecordDetailResponse(BaseModel):
    id: str
    batch_id: str
    recon_level: str
    work_key: str

    # Source IDs
    internal_payment_id: Optional[str] = None
    processor_transaction_id: Optional[str] = None
    settlement_batch_id: Optional[str] = None
    bank_entry_id: Optional[str] = None

    # Matching
    match_method: Optional[str] = None
    match_score: Optional[float] = None

    # Discrepancy Waterfall
    expected_amount: float
    settled_amount: float
    difference: float
    fee_amount: float
    refund_amount: float
    unexplained_amount: float
    settlement_delay_days: Optional[float] = None
    currency: Optional[str] = "INR"
    currency_match: bool = True
    is_duplicate: bool = False

    # ML Prediction
    ml_prediction: Optional[str] = None
    ml_confidence: Optional[float] = None
    ml_feature_vector: Optional[dict[str, Any]] = None

    # AI Investigation
    ai_investigated: bool = False
    ai_decision: Optional[str] = None
    ai_root_cause: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_evidence: Optional[list[str]] = None
    ai_explanation: Optional[str] = None
    ai_recommended_action: Optional[str] = None

    # Final Decision
    final_status: str
    final_root_cause: Optional[str] = None
    policy_reason: Optional[str] = None

    # Ground Truth
    ground_truth_outcome: Optional[str] = None
    ground_truth_reason: Optional[str] = None
    ground_truth_difference: Optional[float] = None
    ground_truth_explanation: Optional[str] = None

    # Audit Trail
    audit_trail: list[dict[str, Any]] = []


# ── Evaluation Schemas ─────────────────────────────────────────────────

class EvaluationMetricsResponse(BaseModel):
    fee_policy: dict[str, Any]
    l1_metrics: dict[str, Any]
    l2_metrics: dict[str, Any]
