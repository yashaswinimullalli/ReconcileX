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


COLUMN_ALIASES: dict[str, list[str]] = {
    "merchant_order_id": ["order_id", "order_number", "order_no", "invoice_id", "invoice_number", "bill_no", "bill_id", "orderid"],
    "internal_payment_id": ["payment_id", "transaction_id", "internal_id", "txn_id", "sale_id"],
    "gross_amount": ["amount", "total_amount", "order_total", "total", "bill_amount", "subtotal", "sale_amount"],
    "fee_amount": ["fee", "fees", "processing_fee", "gateway_fee", "commission", "charge"],
    "net_amount": ["net", "settled_amount", "payout_amount", "after_fees"],
    "currency": ["curr", "currency_code"],
    "occurred_at": ["date", "order_date", "created_at", "timestamp", "time", "order_time", "datetime"],
    "payment_status": ["status", "order_status", "state"],
    "processor_transaction_id": ["gateway_transaction_id", "processor_id", "razorpay_payment_id", "payment_id", "stripe_charge_id", "txn_id"],
    "processor_event_type": ["event_type", "type", "action"],
    "processor_event_time": ["event_time", "transaction_time", "date", "created_at", "time", "timestamp"],
    "processor_status": ["status", "gateway_status"],
    "settlement_batch_id": ["payout_id", "payout_batch_id", "settlement_id", "batch_id", "deposit_id"],
    "bank_entry_id": ["utr", "utr_number", "reference_id", "bank_reference", "txn_ref", "transaction_ref"],
    "booked_at": ["settlement_date", "deposit_date", "credit_date", "date", "timestamp", "payout_date"],
    "credited_amount": ["deposit_amount", "credit_amount", "amount", "net_amount", "settled_amount"],
}


def _apply_smart_column_mapping(df: pd.DataFrame, required_columns: set[str], source_name: str) -> tuple[pd.DataFrame, list[str]]:
    """Automatically map common column aliases and supply friendly defaults."""
    warnings: list[str] = []
    col_map = {}
    lower_to_actual = {c.strip().lower(): c for c in df.columns}

    # 1. Direct lowercase match or alias match
    for req in required_columns:
        if req in df.columns:
            continue
        req_lower = req.lower()
        if req_lower in lower_to_actual:
            col_map[lower_to_actual[req_lower]] = req
            continue

        # Check aliases
        aliases = COLUMN_ALIASES.get(req, [])
        for alias in aliases:
            if alias in lower_to_actual:
                col_map[lower_to_actual[alias]] = req
                warnings.append(f"Auto-mapped column '{lower_to_actual[alias]}' to '{req}'")
                break

    if col_map:
        df = df.rename(columns=col_map)

    # 2. Friendly default fallbacks if still missing
    if "internal_payment_id" in required_columns and "internal_payment_id" not in df.columns:
        if "merchant_order_id" in df.columns:
            df["internal_payment_id"] = "PAY-" + df["merchant_order_id"].astype(str)
            warnings.append("Auto-generated 'internal_payment_id' from 'merchant_order_id'")

    if "currency" in required_columns and "currency" not in df.columns:
        df["currency"] = "INR"
        warnings.append("Defaulted missing 'currency' to 'INR'")

    if "payment_status" in required_columns and "payment_status" not in df.columns:
        df["payment_status"] = "CAPTURED"

    if "processor_event_type" in required_columns and "processor_event_type" not in df.columns:
        df["processor_event_type"] = "CAPTURE"

    if "processor_status" in required_columns and "processor_status" not in df.columns:
        df["processor_status"] = "SETTLED"

    if "fee_amount" in required_columns and "fee_amount" not in df.columns:
        df["fee_amount"] = 0.0

    if "net_amount" in required_columns and "net_amount" not in df.columns:
        if "gross_amount" in df.columns and "fee_amount" in df.columns:
            df["net_amount"] = pd.to_numeric(df["gross_amount"], errors="coerce") - pd.to_numeric(df["fee_amount"], errors="coerce")

    if "bank_entry_id" in required_columns and "bank_entry_id" not in df.columns:
        df["bank_entry_id"] = "BANK-REF-" + pd.Series(range(1, len(df) + 1)).astype(str)

    return df, warnings


def validate_csv(
    content: bytes | str,
    required_columns: set[str],
    source_name: str,
) -> IngestionResult:
    """
    Parse and validate a CSV file against required columns with auto-mapping.
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

    # Clean whitespace in column names
    df.columns = df.columns.str.strip()

    # Apply smart column mapping & defaults
    df, mapping_warnings = _apply_smart_column_mapping(df, required_columns, source_name)
    warnings.extend(mapping_warnings)

    # Check required columns
    actual_columns = set(df.columns)
    missing = required_columns - actual_columns
    if missing:
        readable_hints = []
        for col in sorted(missing):
            aliases = ", ".join(COLUMN_ALIASES.get(col, [])[:3])
            readable_hints.append(f"'{col}' (can also name it: {aliases})")
        return IngestionResult(
            success=False,
            errors=[
                f"{source_name} is missing column: {', '.join(readable_hints)}. "
                "Download the sample template for exact format."
            ],
        )

    # Check for extra columns (warning only)
    extra = actual_columns - required_columns
    if extra:
        warnings.append(f"{source_name} has extra columns (kept): {sorted(extra)}")

    # Strip whitespace from string columns
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str).str.strip()

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
