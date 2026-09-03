"""
ReconcileX — Discrepancy Detection Service
Calculates financial discrepancies for L1 (order) and L2 (settlement) records.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def detect_l1_discrepancies(
    matched: pd.DataFrame,
    fee_rate_pct: float = 0.025,
    fee_fixed: float = 0.50,
) -> pd.DataFrame:
    """
    Calculate L1 (order-level) discrepancies for matched records.

    For each matched record, computes:
    - gross_diff: internal.gross - processor.gross
    - fee_amount, net_amount
    - expected_fee based on policy
    - fee_diff: actual fee vs expected fee
    - refund amounts
    - time difference
    - currency match
    - unexplained amount
    """
    df = matched.copy()

    # ── Gross amount difference ────────────────────────────────────────
    int_gross = pd.to_numeric(df.get("gross_amount_int", df.get("gross_amount")), errors="coerce").fillna(0)
    proc_gross = pd.to_numeric(df.get("gross_amount_proc", 0), errors="coerce").fillna(0)

    df["internal_gross"] = int_gross
    df["processor_gross"] = proc_gross
    df["gross_diff"] = int_gross - proc_gross
    df["gross_diff_abs"] = df["gross_diff"].abs()

    # Avoid division by zero
    safe_int_gross = int_gross.replace(0, np.nan)
    df["gross_diff_pct"] = (df["gross_diff"] / safe_int_gross).fillna(0)

    # ── Fee analysis ──────────────────────────────────────────────────
    df["fee_amount"] = pd.to_numeric(df.get("fee_amount", 0), errors="coerce").fillna(0)
    df["net_amount"] = pd.to_numeric(df.get("net_amount", 0), errors="coerce").fillna(0)

    # Expected fee based on policy: fee = gross * rate + fixed
    df["expected_fee"] = (proc_gross * fee_rate_pct + fee_fixed).round(2)
    df["fee_diff"] = (df["fee_amount"] - df["expected_fee"]).round(2)
    df["fee_diff_abs"] = df["fee_diff"].abs()

    # Fee as percentage of gross
    df["fee_pct"] = (df["fee_amount"] / proc_gross.replace(0, np.nan)).fillna(0)

    # ── Refund analysis ───────────────────────────────────────────────
    df["refund_gross"] = pd.to_numeric(df.get("refund_gross", 0), errors="coerce").fillna(0)
    df["refund_count"] = pd.to_numeric(df.get("refund_count", 0), errors="coerce").fillna(0).astype(int)
    df["has_refund"] = df.get("has_refund", False).fillna(False)

    # Refund ratio (negative amounts → take absolute)
    df["refund_amount_abs"] = df["refund_gross"].abs()
    df["refund_ratio"] = (df["refund_amount_abs"] / int_gross.replace(0, np.nan)).fillna(0)
    df["is_full_refund"] = (df["refund_ratio"] >= 0.99) & df["has_refund"]
    df["is_partial_refund"] = (df["refund_ratio"] > 0) & (df["refund_ratio"] < 0.99) & df["has_refund"]

    # ── Time difference ───────────────────────────────────────────────
    if "occurred_at" in df.columns and "processor_event_time" in df.columns:
        # Both should be datetime; compute difference in seconds
        try:
            td = df["processor_event_time"] - df["occurred_at"]
            df["time_diff_seconds"] = td.dt.total_seconds().fillna(0).astype(int)
        except Exception:
            df["time_diff_seconds"] = 0
    else:
        df["time_diff_seconds"] = 0

    # ── Currency match ────────────────────────────────────────────────
    int_currency = df.get("currency_int", df.get("currency", ""))
    proc_currency = df.get("currency_proc", "")
    if isinstance(int_currency, pd.Series) and isinstance(proc_currency, pd.Series):
        df["currency_match"] = (int_currency == proc_currency).astype(int)
    else:
        df["currency_match"] = 1

    # ── Duplicate flags ───────────────────────────────────────────────
    # These are set during matching; ensure they exist
    if "match_method" not in df.columns:
        df["match_method"] = "EXACT"

    # ── Unexplained amount ────────────────────────────────────────────
    # What portion of the gross difference cannot be explained by fees?
    df["explained_by_fee"] = df["fee_amount"]
    df["unexplained_amount"] = (df["gross_diff_abs"] - df["fee_amount"]).clip(lower=0)

    # ── Valid amount flag ─────────────────────────────────────────────
    df["gross_amount_valid"] = df.get("is_valid_amount", True)
    if "is_valid_amount" in df.columns:
        df["gross_amount_valid"] = df["is_valid_amount"].fillna(True).astype(int)
    else:
        df["gross_amount_valid"] = 1

    logger.info(f"L1 discrepancy detection: {len(df)} records processed")
    return df


def detect_l2_discrepancies(
    matched: pd.DataFrame,
    settlement_window_days: int = 3,
) -> pd.DataFrame:
    """
    Calculate L2 (settlement-level) discrepancies for matched records.

    For each matched batch, computes:
    - expected net total (sum of processor net_amounts)
    - credited amount (from bank)
    - settlement difference
    - settlement delay
    - currency match
    """
    df = matched.copy()

    # ── Settlement amount difference ──────────────────────────────────
    df["expected_net_total"] = pd.to_numeric(df.get("total_net", 0), errors="coerce").fillna(0)
    df["credited_amount_val"] = pd.to_numeric(
        df.get("credited_amount", 0), errors="coerce"
    ).fillna(0)

    df["settlement_diff"] = (df["expected_net_total"] - df["credited_amount_val"]).round(2)
    df["settlement_diff_abs"] = df["settlement_diff"].abs()

    safe_expected = df["expected_net_total"].replace(0, np.nan)
    df["settlement_diff_pct"] = (df["settlement_diff"] / safe_expected).fillna(0)

    # ── Settlement delay ──────────────────────────────────────────────
    df["settlement_delay_days"] = pd.to_numeric(
        df.get("settlement_delay_days", 0), errors="coerce"
    ).fillna(0)
    df["is_late_settlement"] = (df["settlement_delay_days"] > settlement_window_days).astype(int)

    # ── Currency match ────────────────────────────────────────────────
    proc_currency = df.get("batch_currency", df.get("currency_proc", ""))
    bank_currency = df.get("currency", df.get("currency_bank", ""))
    if isinstance(proc_currency, pd.Series) and isinstance(bank_currency, pd.Series):
        df["currency_match"] = (proc_currency == bank_currency).astype(int)
    else:
        df["currency_match"] = 1

    # ── Duplicate bank entries ────────────────────────────────────────
    df["bank_entry_count"] = pd.to_numeric(
        df.get("bank_entry_count", 1), errors="coerce"
    ).fillna(1).astype(int)
    df["is_duplicate_bank"] = (df["bank_entry_count"] > 1).astype(int)

    # ── Batch size ────────────────────────────────────────────────────
    df["batch_size"] = pd.to_numeric(df.get("txn_count", 1), errors="coerce").fillna(1).astype(int)

    # ── Has bank entry (always True for matched) ──────────────────────
    df["has_bank_entry"] = 1

    # ── Has processor batch (always True for matched) ─────────────────
    df["has_processor_batch"] = 1

    logger.info(f"L2 discrepancy detection: {len(df)} records processed")
    return df
