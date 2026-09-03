"""
ReconcileX — Export & Evaluation API Routes
Enables CSV/JSON exports and serves evaluation/benchmark analytics.
"""
from __future__ import annotations

import csv
import io
import json
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response

from config import ML_DIR
from models.database import get_batch_by_id, get_recon_records
from models.schemas import EvaluationMetricsResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Export & Evaluation"])


@router.get("/batches/{batch_id}/export")
async def export_batch_results(
    batch_id: str,
    format: Literal["csv", "json"] = Query("csv"),
    type: Literal["all", "exceptions"] = Query("all"),
):
    """
    Export reconciliation batch results or exception reports as CSV or JSON.
    """
    batch = await get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    status_filter = "EXCEPTION" if type == "exceptions" else None
    records, total = await get_recon_records(
        batch_id=batch_id,
        final_status=status_filter,
        limit=10000,
        offset=0,
    )

    if format == "json":
        return {
            "batch_id": batch_id,
            "export_type": type,
            "total_records": total,
            "records": records,
        }

    # CSV Format
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    headers = [
        "Record ID",
        "Recon Level",
        "Work Key",
        "Internal Payment ID",
        "Processor Txn ID",
        "Settlement Batch ID",
        "Bank Entry ID",
        "Match Method",
        "Gross Diff",
        "Fee Amount",
        "Settlement Diff",
        "Unexplained Amount",
        "Currency",
        "ML Prediction",
        "ML Confidence",
        "Final Status",
        "Final Root Cause",
        "AI Investigated",
        "Policy Reason",
    ]
    writer.writerow(headers)

    for r in records:
        writer.writerow([
            r.get("id"),
            r.get("recon_level"),
            r.get("work_key"),
            r.get("internal_payment_id") or "",
            r.get("processor_transaction_id") or "",
            r.get("settlement_batch_id") or "",
            r.get("bank_entry_id") or "",
            r.get("match_method") or "",
            r.get("gross_diff", 0.0),
            r.get("fee_amount", 0.0),
            r.get("settlement_diff", 0.0),
            r.get("unexplained_amount", 0.0),
            r.get("currency", "INR"),
            r.get("ml_prediction") or "",
            r.get("ml_confidence", 0.0),
            r.get("final_status"),
            r.get("final_root_cause") or "",
            "YES" if r.get("ai_investigated") else "NO",
            r.get("policy_reason") or "",
        ])

    csv_data = output.getvalue()
    filename = f"reconcilex_{type}_{batch_id[:8]}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/evaluation/metrics", response_model=EvaluationMetricsResponse)
async def get_evaluation_metrics():
    """
    Retrieve held-out test evaluation metrics for L1 and L2 XGBoost classifiers.
    Includes confusion matrix, classification report, and feature importances.
    """
    metrics_path = ML_DIR / "metrics.json"
    if not metrics_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Evaluation metrics not found. Please train models first.",
        )

    try:
        with open(metrics_path, "r") as f:
            data = json.load(f)
        return EvaluationMetricsResponse(
            fee_policy=data.get("fee_policy", {}),
            l1_metrics=data.get("l1", {}),
            l2_metrics=data.get("l2", {}),
        )
    except Exception as e:
        logger.error(f"Error reading metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to load metrics")
