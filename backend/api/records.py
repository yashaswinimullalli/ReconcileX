"""
ReconcileX — Records & Exception Investigation API Routes
Provides paginated record lists, exception queues, and deep audit investigations.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from models.database import get_record_detail, get_recon_records, insert_audit_entries
from models.schemas import (
    ExceptionListResponse,
    ExceptionRecordListItem,
    ReconRecordListItem,
    ReconRecordListResponse,
    RecordDetailResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Records"])


@router.get("/batches/{batch_id}/records", response_model=ReconRecordListResponse)
async def list_records(
    batch_id: str,
    recon_level: Optional[str] = Query(None, description="Filter by L1_ORDER or L2_SETTLEMENT"),
    status: Optional[str] = Query(None, description="Filter by AUTO_RESOLVE, NEEDS_REVIEW, EXCEPTION"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Retrieve paginated reconciliation records for a batch."""
    offset = (page - 1) * limit
    records, total = await get_recon_records(
        batch_id=batch_id,
        recon_level=recon_level,
        final_status=status,
        limit=limit,
        offset=offset,
    )

    items = []
    for r in records:
        items.append(
            ReconRecordListItem(
                id=r["id"],
                batch_id=r["batch_id"],
                recon_level=r["recon_level"],
                work_key=r["work_key"],
                match_method=r.get("match_method"),
                match_score=r.get("match_score", 1.0),
                internal_gross=r.get("internal_gross"),
                processor_gross=r.get("processor_gross"),
                gross_diff=r.get("gross_diff", 0.0),
                fee_amount=r.get("fee_amount", 0.0),
                expected_net_total=r.get("expected_net_total"),
                credited_amount=r.get("credited_amount"),
                settlement_diff=r.get("settlement_diff", 0.0),
                currency=r.get("currency", "INR"),
                ml_prediction=r.get("ml_prediction"),
                ml_confidence=r.get("ml_confidence"),
                final_status=r["final_status"],
                final_root_cause=r.get("final_root_cause"),
                ai_investigated=bool(r.get("ai_investigated", 0)),
                ground_truth_outcome=r.get("ground_truth_outcome"),
            )
        )

    return ReconRecordListResponse(
        batch_id=batch_id,
        total=total,
        page=page,
        limit=limit,
        records=items,
    )


@router.get("/batches/{batch_id}/exceptions", response_model=ExceptionListResponse)
async def list_exceptions(
    batch_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Retrieve unresolved cases (NEEDS_REVIEW and EXCEPTION) in priority queue order."""
    offset = (page - 1) * limit
    # Get records where final_status != 'AUTO_RESOLVE'
    # We query both statuses or fetch without AUTO_RESOLVE
    all_unresolved = []
    total_unresolved = 0

    for st in ["EXCEPTION", "NEEDS_REVIEW"]:
        recs, tot = await get_recon_records(
            batch_id=batch_id,
            final_status=st,
            limit=limit,
            offset=0,
        )
        all_unresolved.extend(recs)
        total_unresolved += tot

    # Sort so EXCEPTION comes first, then NEEDS_REVIEW
    all_unresolved.sort(
        key=lambda x: (0 if x.get("final_status") == "EXCEPTION" else 1, -abs(float(x.get("unexplained_amount", 0.0))))
    )
    paged = all_unresolved[offset : offset + limit]

    items = []
    for r in paged:
        level = r.get("recon_level", "L1_ORDER")
        diff_val = (
            abs(float(r.get("gross_diff", 0.0)))
            if level == "L1_ORDER"
            else abs(float(r.get("settlement_diff", 0.0)))
        )
        items.append(
            ExceptionRecordListItem(
                id=r["id"],
                batch_id=r["batch_id"],
                recon_level=level,
                work_key=r["work_key"],
                discrepancy_amount=round(diff_val, 2),
                currency=r.get("currency", "INR"),
                predicted_cause=r.get("final_root_cause") or r.get("ml_prediction") or "UNKNOWN_EXCEPTION",
                ml_confidence=round(float(r.get("ml_confidence", 0.0)), 4),
                final_status=r.get("final_status", "NEEDS_REVIEW"),
                ai_investigated=bool(r.get("ai_investigated", 0)),
                ai_explanation=r.get("ai_explanation"),
                recommended_action=r.get("ai_recommended_action"),
            )
        )

    return ExceptionListResponse(
        batch_id=batch_id,
        total=total_unresolved,
        page=page,
        limit=limit,
        exceptions=items,
    )


@router.get("/records/{record_id}", response_model=RecordDetailResponse)
async def get_single_record(record_id: str):
    """
    Retrieve comprehensive record detail including discrepancy waterfall,
    ML feature vector, AI investigation reasoning, policy justification, and audit history.
    """
    r = await get_record_detail(record_id)
    if not r:
        raise HTTPException(status_code=404, detail="Reconciliation record not found")

    level = r.get("recon_level", "L1_ORDER")
    if level == "L1_ORDER":
        exp_amt = float(r.get("internal_gross", 0.0))
        settled_amt = float(r.get("processor_gross", 0.0))
        diff = float(r.get("gross_diff", 0.0))
    else:
        exp_amt = float(r.get("expected_net_total", 0.0))
        settled_amt = float(r.get("credited_amount", 0.0))
        diff = float(r.get("settlement_diff", 0.0))

    evidence_list = r.get("ai_evidence")
    if isinstance(evidence_list, str):
        try:
            evidence_list = json.loads(evidence_list)
        except Exception:
            evidence_list = [evidence_list]

    return RecordDetailResponse(
        id=r["id"],
        batch_id=r["batch_id"],
        recon_level=level,
        work_key=r["work_key"],
        internal_payment_id=r.get("internal_payment_id"),
        processor_transaction_id=r.get("processor_transaction_id"),
        settlement_batch_id=r.get("settlement_batch_id"),
        bank_entry_id=r.get("bank_entry_id"),
        match_method=r.get("match_method"),
        match_score=r.get("match_score"),
        expected_amount=round(exp_amt, 2),
        settled_amount=round(settled_amt, 2),
        difference=round(diff, 2),
        fee_amount=round(float(r.get("fee_amount", 0.0)), 2),
        refund_amount=round(float(r.get("refund_amount", 0.0)), 2),
        unexplained_amount=round(float(r.get("unexplained_amount", 0.0)), 2),
        settlement_delay_days=r.get("settlement_delay_days"),
        currency=r.get("currency", "INR"),
        currency_match=bool(r.get("currency_match", 1)),
        is_duplicate=bool(r.get("is_duplicate", 0)),
        ml_prediction=r.get("ml_prediction"),
        ml_confidence=r.get("ml_confidence"),
        ml_feature_vector=r.get("ml_feature_vector"),
        ai_investigated=bool(r.get("ai_investigated", 0)),
        ai_decision=r.get("ai_decision"),
        ai_root_cause=r.get("ai_root_cause"),
        ai_confidence=r.get("ai_confidence"),
        ai_evidence=evidence_list,
        ai_explanation=r.get("ai_explanation"),
        ai_recommended_action=r.get("ai_recommended_action"),
        final_status=r["final_status"],
        final_root_cause=r.get("final_root_cause"),
        policy_reason=r.get("policy_reason"),
        ground_truth_outcome=r.get("ground_truth_outcome"),
        ground_truth_reason=r.get("ground_truth_reason"),
        ground_truth_difference=r.get("ground_truth_difference"),
        ground_truth_explanation=r.get("ground_truth_explanation"),
        audit_trail=r.get("audit_trail", []),
    )
