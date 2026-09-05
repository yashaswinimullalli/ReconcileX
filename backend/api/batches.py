"""
ReconcileX — Batches API Routes
Handles batch creation, file uploads, demo loading, and batch summary metrics.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from config import DATA_DIR
from models.database import get_batch_by_id, insert_batch, list_all_batches
from models.schemas import BatchCreateResponse, BatchSummaryResponse
from services.reconciliation import ReconciliationPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batches", tags=["Batches"])


@router.get("", response_model=list[BatchSummaryResponse])
async def get_all_batches():
    """List all reconciliation batches."""
    batches = await list_all_batches()
    result = []
    for b in batches:
        result.append(
            BatchSummaryResponse(
                batch_id=b["id"],
                status=b.get("status", "PENDING"),
                name=b.get("name"),
                created_at=b.get("created_at"),
                completed_at=b.get("completed_at"),
                processing_time_ms=b.get("processing_time_ms", 0),
                total_records=b.get("total_records", 0),
                matched_count=b.get("matched_count", 0),
                auto_resolved_count=b.get("auto_resolved_count", 0),
                ai_investigated_count=b.get("ai_investigated_count", 0),
                exception_count=b.get("exception_count", 0),
                needs_review_count=b.get("needs_review_count", 0),
                match_rate=b.get("match_rate", 0.0),
                unresolved_amount=b.get("unresolved_amount", 0.0),
                l1_total=b.get("l1_total", 0),
                l1_matched=b.get("l1_matched", 0),
                l1_exceptions=b.get("l1_exceptions", 0),
                l2_total=b.get("l2_total", 0),
                l2_matched=b.get("l2_matched", 0),
                l2_exceptions=b.get("l2_exceptions", 0),
                l1_accuracy=b.get("l1_ml_accuracy"),
                l1_f1=b.get("l1_ml_f1"),
                l2_accuracy=b.get("l2_ml_accuracy"),
                l2_f1=b.get("l2_ml_f1"),
            )
        )
    return result


@router.post("/clear")
@router.delete("/clear")
async def clear_all_batches():
    """Clear all batches and records for a completely clean slate."""
    from models.database import clear_all_data
    await clear_all_data()
    return {"message": "All reconciliation data cleared successfully", "status": "CLEAN"}


@router.post("", response_model=BatchCreateResponse)
async def create_and_run_batch(
    internal_ledger: UploadFile = File(...),
    processor_transactions: UploadFile = File(...),
    bank_settlements: UploadFile = File(...),
    ground_truth: Optional[UploadFile] = File(None),
    name: Optional[str] = Form(None),
):
    """
    Upload source CSVs and execute multi-source financial reconciliation immediately.
    """
    batch_id = str(uuid.uuid4())
    batch_name = name or f"Recon Batch {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Read uploaded bytes
    internal_bytes = await internal_ledger.read()
    processor_bytes = await processor_transactions.read()
    bank_bytes = await bank_settlements.read()
    gt_bytes = await ground_truth.read() if ground_truth else None

    # Register batch in database
    await insert_batch({
        "id": batch_id,
        "name": batch_name,
        "status": "PROCESSING",
        "created_at": now_iso,
    })

    try:
        # Run reconciliation pipeline synchronously for demo speed
        await ReconciliationPipeline.run(
            batch_id=batch_id,
            internal_content=internal_bytes,
            processor_content=processor_bytes,
            bank_content=bank_bytes,
            ground_truth_content=gt_bytes,
            batch_name=batch_name,
        )

        return BatchCreateResponse(
            batch_id=batch_id,
            status="COMPLETED",
            name=batch_name,
            total_internal=len(internal_bytes.splitlines()) - 1,
            total_processor=len(processor_bytes.splitlines()) - 1,
            total_bank=len(bank_bytes.splitlines()) - 1,
            message="Reconciliation batch processed successfully.",
        )

    except Exception as e:
        logger.error(f"Error processing batch {batch_id}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Reconciliation error: {str(e)}")


@router.post("/demo", response_model=BatchCreateResponse)
async def create_demo_batch():
    """
    One-click reconciliation run. Uses the 6-order mini dataset if present,
    or falls back to the built-in ReconRiver benchmark dataset.
    """
    mini_internal = DATA_DIR / "mini_store_sales_orders.csv"
    mini_processor = DATA_DIR / "mini_payment_app_report.csv"
    mini_bank = DATA_DIR / "mini_bank_statement.csv"

    if mini_internal.exists() and mini_processor.exists() and mini_bank.exists():
        internal_path = mini_internal
        processor_path = mini_processor
        bank_path = mini_bank
        gt_path = DATA_DIR / "ground_truth.csv"
        batch_name = "6-Order Test Batch"
        total_int_count = 6
        total_proc_count = 6
        total_bnk_count = 3
        msg = "6-order test batch processed successfully."
    else:
        internal_path = DATA_DIR / "internal_ledger.csv"
        processor_path = DATA_DIR / "processor_transactions.csv"
        bank_path = DATA_DIR / "bank_settlements.csv"
        gt_path = DATA_DIR / "ground_truth.csv"
        batch_name = "ReconRiver Mixed-Exceptions Benchmark (1,244 records)"
        total_int_count = 1010
        total_proc_count = 1075
        total_bnk_count = 219
        msg = "Benchmark dataset processed successfully."

    if not (internal_path.exists() and processor_path.exists() and bank_path.exists()):
        raise HTTPException(
            status_code=404,
            detail="Bundled reconciliation dataset files not found on server.",
        )

    batch_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    internal_bytes = internal_path.read_bytes()
    processor_bytes = processor_path.read_bytes()
    bank_bytes = bank_path.read_bytes()
    gt_bytes = gt_path.read_bytes() if gt_path.exists() else None

    await insert_batch({
        "id": batch_id,
        "name": batch_name,
        "status": "PROCESSING",
        "created_at": now_iso,
    })

    try:
        await ReconciliationPipeline.run(
            batch_id=batch_id,
            internal_content=internal_bytes,
            processor_content=processor_bytes,
            bank_content=bank_bytes,
            ground_truth_content=gt_bytes,
            batch_name=batch_name,
        )

        return BatchCreateResponse(
            batch_id=batch_id,
            status="COMPLETED",
            name=batch_name,
            total_internal=total_int_count,
            total_processor=total_proc_count,
            total_bank=total_bnk_count,
            message=msg,
        )
    except Exception as e:
        logger.error(f"Error executing demo batch: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process demo batch: {str(e)}")


@router.get("/{batch_id}/summary", response_model=BatchSummaryResponse)
async def get_batch_summary(batch_id: str):
    """Retrieve KPI metrics and summary for a reconciliation batch."""
    batch = await get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    proc_time = batch.get("processing_time_ms", 0) or 1
    total_recs = batch.get("total_records", 0)
    throughput = round(total_recs / (proc_time / 1000.0), 1) if proc_time > 0 else 0.0

    matched = batch.get("matched_count", 0)
    auto_resolved = batch.get("auto_resolved_count", 0)

    return BatchSummaryResponse(
        batch_id=batch["id"],
        status=batch.get("status", "PENDING"),
        name=batch.get("name"),
        created_at=batch.get("created_at"),
        completed_at=batch.get("completed_at"),
        processing_time_ms=proc_time,
        total_records=total_recs,
        matched_count=matched,
        auto_resolved_count=auto_resolved,
        ai_investigated_count=batch.get("ai_investigated_count", 0),
        exception_count=batch.get("exception_count", 0),
        needs_review_count=batch.get("needs_review_count", 0),
        match_rate=batch.get("match_rate", 0.0),
        auto_resolve_rate=round(auto_resolved / total_recs, 4) if total_recs > 0 else 0.0,
        unresolved_amount=batch.get("unresolved_amount", 0.0),
        throughput_records_per_sec=throughput,
        l1_total=batch.get("l1_total", 0),
        l1_matched=batch.get("l1_matched", 0),
        l1_exceptions=batch.get("l1_exceptions", 0),
        l2_total=batch.get("l2_total", 0),
        l2_matched=batch.get("l2_matched", 0),
        l2_exceptions=batch.get("l2_exceptions", 0),
        l1_accuracy=batch.get("l1_ml_accuracy"),
        l1_f1=batch.get("l1_ml_f1"),
        l2_accuracy=batch.get("l2_ml_accuracy"),
        l2_f1=batch.get("l2_ml_f1"),
    )
