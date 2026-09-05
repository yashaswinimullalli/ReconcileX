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


def _format_num(val: Any) -> str:
    """Format numeric values as clean integers or decimals without trailing zeros."""
    if val is None or val == "":
        return ""
    try:
        f = float(val)
        return f"{int(f)}" if f.is_integer() else f"{round(f, 2):g}"
    except (ValueError, TypeError):
        return str(val)


def format_merchant_record(r: dict[str, Any]) -> dict[str, Any]:
    """Convert raw reconciliation database row into merchant-friendly export fields."""
    recon_level = r.get("recon_level")
    is_order = (recon_level == "L1_ORDER")
    rec_type = "ORDER" if is_order else "BANK_DEPOSIT"
    final_st = r.get("final_status", "")

    # Plain language status: Matched, Needs Review, Issue
    if final_st == "AUTO_RESOLVE":
        status = "Matched"
    elif final_st == "NEEDS_REVIEW":
        status = "Needs Review"
    elif final_st == "EXCEPTION":
        status = "Issue"
    else:
        status = "Needs Review" if (r.get("unexplained_amount") or 0) > 0 else "Matched"

    if is_order:
        order_id = r.get("work_key") or ""
        payment_id = r.get("processor_transaction_id") or r.get("internal_payment_id") or ""
        payout_id = r.get("settlement_batch_id") or ""
        sale_val = r.get("internal_gross")
        pay_val = r.get("processor_gross")
        sale_amt = _format_num(sale_val)
        pay_amt = _format_num(pay_val)
        exp_bank = ""
        bank_recv = ""
        diff_val = r.get("gross_diff", 0.0) or 0.0
        diff = _format_num(abs(diff_val))

        if status == "Matched":
            what_happened = "Payment matched"
        elif not payment_id:
            what_happened = "Payment not found"
        elif diff_val > 0:
            what_happened = f"Payment is ₹{diff} lower than order amount"
        elif diff_val < 0:
            what_happened = f"Payment is ₹{diff} higher than order amount"
        elif r.get("is_duplicate"):
            what_happened = "Possible duplicate payment"
        else:
            what_happened = "Payment matched" if diff_val == 0 else "Order and payment mismatch"

    else:
        order_id = ""
        payment_id = ""
        payout_id = r.get("work_key") or r.get("settlement_batch_id") or ""
        sale_amt = ""
        pay_amt = ""
        exp_val = r.get("expected_net_total")
        recv_val = r.get("credited_amount")
        exp_bank = _format_num(exp_val)
        bank_recv = _format_num(recv_val)
        diff_val = r.get("settlement_diff", 0.0) or 0.0
        diff = _format_num(abs(diff_val))

        if status == "Matched":
            what_happened = "Bank deposit matched"
        elif diff_val > 0:
            what_happened = f"Bank deposit is ₹{diff} lower than expected"
        elif diff_val < 0:
            what_happened = f"Bank deposit is ₹{diff} higher than expected"
        elif (r.get("settlement_delay_days") or 0) > 3:
            what_happened = "Bank deposit delayed"
        else:
            what_happened = "Bank deposit matched" if diff_val == 0 else "Bank deposit discrepancy"

    return {
        "record_type": rec_type,
        "order_id": order_id,
        "payment_id": payment_id,
        "payout_id": payout_id,
        "sale_amount": sale_amt,
        "payment_amount": pay_amt,
        "expected_bank_amount": exp_bank,
        "bank_received_amount": bank_recv,
        "difference": diff,
        "what_happened": what_happened,
        "status": status,
    }


@router.get("/batches/{batch_id}/export")
async def export_batch_results(
    batch_id: str,
    format: Literal["csv", "json"] = Query("csv"),
    type: Literal["all", "exceptions"] = Query("all"),
):
    """
    Export reconciliation batch results or exception reports as merchant-friendly CSV or JSON.
    """
    batch = await get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    status_filter = "UNRESOLVED" if type == "exceptions" else None
    records, total = await get_recon_records(
        batch_id=batch_id,
        final_status=status_filter,
        limit=10000,
        offset=0,
    )

    if total == 0 or len(records) == 0:
        raise HTTPException(
            status_code=400,
            detail="No reconciliation results available. Run reconciliation first.",
        )

    # Sort: ORDER records first by order_id, then BANK_DEPOSIT records by payout_id
    records.sort(
        key=lambda r: (
            0 if r.get("recon_level") == "L1_ORDER" else 1,
            r.get("work_key") or "",
        )
    )

    merchant_rows = [format_merchant_record(r) for r in records]

    if format == "json":
        return {
            "batch_id": batch_id,
            "export_type": type,
            "total_records": len(merchant_rows),
            "records": merchant_rows,
        }

    # CSV Format
    output = io.StringIO()
    fieldnames = [
        "record_type",
        "order_id",
        "payment_id",
        "payout_id",
        "sale_amount",
        "payment_amount",
        "expected_bank_amount",
        "bank_received_amount",
        "difference",
        "what_happened",
        "status",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\r\n")
    writer.writeheader()
    for row in merchant_rows:
        writer.writerow(row)

    csv_data = output.getvalue()
    filename = (
        f"reconciliation_report_{batch_id[:8]}.csv"
        if type == "all"
        else f"issues_report_{batch_id[:8]}.csv"
    )

    return Response(
        content=csv_data.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
