"""
ReconcileX — Data Normalization Service
Normalizes IDs, amounts, dates, and text across all three sources.
Handles data quality issues (e.g., NOT_A_NUMBER in processor gross_amount).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class NormalizationResult:
    """Result of normalizing a DataFrame."""
    df: pd.DataFrame
    quarantined_rows: pd.DataFrame  # rows removed due to data quality issues
    quarantine_reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _parse_iso_datetime(series: pd.Series) -> pd.Series:
    """Parse ISO datetime strings to pandas datetime, coercing errors to NaT."""
    return pd.to_datetime(series, utc=True, errors="coerce")


def _safe_float(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    """
    Convert a series to float64, returning (converted, mask_of_invalid).
    Invalid values become NaN; the boolean mask marks them.
    """
    converted = pd.to_numeric(series, errors="coerce")
    invalid_mask = series.notna() & converted.isna()
    return converted, invalid_mask


def normalize_internal_ledger(df: pd.DataFrame) -> NormalizationResult:
    """Normalize internal ledger records."""
    df = df.copy()
    warnings: list[str] = []
    quarantined = pd.DataFrame()
    quarantine_reasons: list[str] = []

    # Normalize IDs: strip, uppercase
    df["internal_payment_id"] = df["internal_payment_id"].str.strip().str.upper()
    df["merchant_order_id"] = df["merchant_order_id"].str.strip().str.upper()

    # Normalize dates
    df["occurred_at"] = _parse_iso_datetime(df["occurred_at"])
    nat_count = df["occurred_at"].isna().sum()
    if nat_count > 0:
        warnings.append(f"{nat_count} rows have unparseable occurred_at dates")

    # Normalize amounts
    df["gross_amount"], invalid = _safe_float(df["gross_amount"])
    if invalid.any():
        warnings.append(f"{invalid.sum()} rows have invalid gross_amount values")

    # Normalize currency
    df["currency"] = df["currency"].str.strip().str.upper()

    # Normalize status
    df["payment_status"] = df["payment_status"].str.strip().str.upper()

    # Normalize payment method
    if "payment_method" in df.columns:
        df["payment_method"] = df["payment_method"].str.strip().str.upper()

    # Normalize customer reference
    if "synthetic_customer_reference" in df.columns:
        df["synthetic_customer_reference"] = (
            df["synthetic_customer_reference"].str.strip().str.upper()
        )

    logger.info(f"Normalized internal_ledger: {len(df)} rows")
    return NormalizationResult(
        df=df,
        quarantined_rows=quarantined,
        quarantine_reasons=quarantine_reasons,
        warnings=warnings,
    )


def normalize_processor(df: pd.DataFrame) -> NormalizationResult:
    """
    Normalize processor transactions.
    Key: gross_amount is a string column that may contain 'NOT_A_NUMBER'.
    We preserve the raw value and create a parsed float column.
    """
    df = df.copy()
    warnings: list[str] = []
    quarantine_reasons: list[str] = []

    # Normalize IDs
    df["processor_transaction_id"] = df["processor_transaction_id"].str.strip().str.upper()
    df["merchant_order_id"] = df["merchant_order_id"].str.strip().str.upper()
    df["settlement_batch_id"] = df["settlement_batch_id"].str.strip().str.upper()

    # Normalize event type and status
    df["processor_event_type"] = df["processor_event_type"].str.strip().str.upper()
    df["processor_status"] = df["processor_status"].str.strip().str.upper()

    # Normalize dates
    df["processor_event_time"] = _parse_iso_datetime(df["processor_event_time"])

    # Handle gross_amount: store raw, parse to float
    df["gross_amount_raw"] = df["gross_amount"].astype(str).str.strip()
    df["gross_amount"], invalid_mask = _safe_float(df["gross_amount"])
    df["is_valid_amount"] = ~invalid_mask

    invalid_count = invalid_mask.sum()
    if invalid_count > 0:
        invalid_values = df.loc[invalid_mask, "gross_amount_raw"].unique().tolist()
        warnings.append(
            f"{invalid_count} rows have invalid gross_amount: {invalid_values}"
        )
        quarantine_reasons.append(
            f"gross_amount must be a decimal: found {invalid_values}"
        )

    # Quarantine rows with invalid amounts (keep in df but flag them)
    quarantined = df[invalid_mask].copy()

    # Normalize numeric columns
    df["fee_amount"] = pd.to_numeric(df["fee_amount"], errors="coerce").fillna(0)
    df["net_amount"] = pd.to_numeric(df["net_amount"], errors="coerce").fillna(0)

    # Normalize currency
    df["currency"] = df["currency"].str.strip().str.upper()

    logger.info(
        f"Normalized processor: {len(df)} rows, "
        f"{invalid_count} quarantined (invalid amount)"
    )
    return NormalizationResult(
        df=df,
        quarantined_rows=quarantined,
        quarantine_reasons=quarantine_reasons,
        warnings=warnings,
    )


def normalize_bank_settlements(df: pd.DataFrame) -> NormalizationResult:
    """Normalize bank settlement records."""
    df = df.copy()
    warnings: list[str] = []
    quarantined = pd.DataFrame()
    quarantine_reasons: list[str] = []

    # Normalize IDs
    df["bank_entry_id"] = df["bank_entry_id"].str.strip().str.upper()
    df["settlement_batch_id"] = df["settlement_batch_id"].str.strip().str.upper()

    # Normalize dates
    df["booked_at"] = _parse_iso_datetime(df["booked_at"])

    # Normalize amounts
    df["credited_amount"] = pd.to_numeric(df["credited_amount"], errors="coerce")

    # Normalize currency
    df["currency"] = df["currency"].str.strip().str.upper()

    # Normalize bank_reference and description
    if "bank_reference" in df.columns:
        df["bank_reference"] = df["bank_reference"].str.strip().str.upper()
    if "description" in df.columns:
        df["description"] = df["description"].str.strip()

    logger.info(f"Normalized bank_settlements: {len(df)} rows")
    return NormalizationResult(
        df=df,
        quarantined_rows=quarantined,
        quarantine_reasons=quarantine_reasons,
        warnings=warnings,
    )
