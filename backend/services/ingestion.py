"""
ReconcileX — Data Ingestion Service
Validates and loads CSV files for the three reconciliation sources.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ── Expected schemas ───────────────────────────────────────────────────

INTERNAL_LEDGER_REQUIRED = {
    "internal_payment_id",
    "merchant_order_id",
    "occurred_at",
    "gross_amount",
    "currency",
    "payment_status",
}

PROCESSOR_REQUIRED = {
    "processor_transaction_id",
    "merchant_order_id",
    "processor_event_type",
    "processor_event_time",
    "gross_amount",
    "fee_amount",
    "net_amount",
    "currency",
    "settlement_batch_id",
    "processor_status",
}

BANK_SETTLEMENTS_REQUIRED = {
    "bank_entry_id",
    "settlement_batch_id",
    "booked_at",
    "credited_amount",
    "currency",
}


@dataclass
class IngestionResult:
    """Result of ingesting a single CSV file."""
    success: bool
    df: Optional[pd.DataFrame] = None
    row_count: int = 0
    quarantined_count: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class BatchIngestionResult:
    """Result of ingesting all three source files."""
    success: bool
    internal_ledger: Optional[IngestionResult] = None
    processor: Optional[IngestionResult] = None
    bank_settlements: Optional[IngestionResult] = None
    errors: list[str] = field(default_factory=list)


def validate_csv(
    content: bytes | str,
    required_columns: set[str],
    source_name: str,
) -> IngestionResult:
    """
    Parse and validate a CSV file against required columns.
    Returns IngestionResult with the DataFrame or error details.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Parse CSV
    try:
        if isinstance(content, bytes):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_csv(content)
    except Exception as e:
        return IngestionResult(
            success=False,
            errors=[f"Failed to parse {source_name} CSV: {str(e)}"],
        )

    if df.empty:
        return IngestionResult(
            success=False,
            errors=[f"{source_name} CSV is empty"],
        )

    # Check required columns
    actual_columns = set(df.columns)
    missing = required_columns - actual_columns
    if missing:
        return IngestionResult(
            success=False,
            errors=[f"{source_name} is missing required columns: {sorted(missing)}"],
        )

    # Check for extra columns (warning only)
    extra = actual_columns - required_columns
    if extra:
        warnings.append(f"{source_name} has extra columns (kept): {sorted(extra)}")

    # Strip whitespace from string columns
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].str.strip()

    row_count = len(df)
    logger.info(f"Ingested {source_name}: {row_count} rows, {len(df.columns)} columns")

    return IngestionResult(
        success=True,
        df=df,
        row_count=row_count,
        errors=errors,
        warnings=warnings,
    )


def ingest_internal_ledger(content: bytes | str) -> IngestionResult:
    """Validate and load internal_ledger.csv."""
    return validate_csv(content, INTERNAL_LEDGER_REQUIRED, "internal_ledger")


def ingest_processor(content: bytes | str) -> IngestionResult:
    """Validate and load processor_transactions.csv."""
    return validate_csv(content, PROCESSOR_REQUIRED, "processor_transactions")


def ingest_bank_settlements(content: bytes | str) -> IngestionResult:
    """Validate and load bank_settlements.csv."""
    return validate_csv(content, BANK_SETTLEMENTS_REQUIRED, "bank_settlements")


def ingest_batch(
    internal_content: bytes | str,
    processor_content: bytes | str,
    bank_content: bytes | str,
) -> BatchIngestionResult:
    """Ingest all three source files for a reconciliation batch."""
    errors: list[str] = []

    internal = ingest_internal_ledger(internal_content)
    processor = ingest_processor(processor_content)
    bank = ingest_bank_settlements(bank_content)

    if not internal.success:
        errors.extend(internal.errors)
    if not processor.success:
        errors.extend(processor.errors)
    if not bank.success:
        errors.extend(bank.errors)

    success = internal.success and processor.success and bank.success

    return BatchIngestionResult(
        success=success,
        internal_ledger=internal,
        processor=processor,
        bank_settlements=bank,
        errors=errors,
    )
