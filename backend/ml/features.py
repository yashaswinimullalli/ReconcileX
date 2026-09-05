"""
ReconcileX — Feature Engineering
Extracts ML feature vectors from reconciliation records for L1 and L2 classification.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── L1 Feature Columns ────────────────────────────────────────────────
L1_FEATURE_COLUMNS = [
    "has_internal",
    "has_processor",
    "gross_amount_valid",
    "gross_diff",
    "gross_diff_pct",
    "fee_amount",
    "fee_pct",
    "fee_diff",
    "time_diff_seconds",
    "currency_match",
    "has_refund",
    "refund_ratio",
    "is_duplicate_internal",
    "is_duplicate_processor",
    "candidate_count",
    "payment_status_encoded",
]

# ── L2 Feature Columns ────────────────────────────────────────────────
L2_FEATURE_COLUMNS = [
    "has_bank_entry",
    "has_processor_batch",
    "expected_net_total",
    "credited_amount_val",
    "settlement_diff",
    "settlement_diff_pct",
    "settlement_delay_days",
    "currency_match",
    "is_duplicate_bank",
]

# ── Payment status encoding ───────────────────────────────────────────
PAYMENT_STATUS_MAP = {
    "CAPTURED": 0,
    "PARTIALLY_REFUNDED": 1,
    "REFUNDED": 2,
}


def extract_l1_features(
    matched_df: pd.DataFrame,
    internal_only_df: pd.DataFrame,
    processor_only_df: pd.DataFrame,
    duplicates_internal_ids: set[str],
    duplicates_processor_ids: set[str],
    ambiguous_order_ids: set[str],
    invalid_order_ids: set[str],
    include_processor_only: bool = False,
) -> pd.DataFrame:
    """
    Build L1 feature matrix from matched, missing, and duplicate records.

    Returns a DataFrame with one row per work_key (merchant_order_id)
    and all L1_FEATURE_COLUMNS.
    """
    rows = []

    # ── Process matched records ────────────────────────────────────────
    for _, r in matched_df.iterrows():
        order_id = r["merchant_order_id"]

        # Count how many processor captures exist for this order
        candidate_count = 1
        if order_id in ambiguous_order_ids:
            candidate_count = 2  # simplified; actual count tracked during matching

        gross_diff = float(r.get("gross_diff", 0.0))
        internal_gross = float(r.get("internal_gross", 0.0))
        gross_diff_pct = abs(gross_diff) / (internal_gross + 1e-9)
        fee_amt = float(r.get("fee_amount", 0.0))
        fee_pct = fee_amt / (internal_gross + 1e-9)

        feat = {
            "work_key": order_id,
            "has_internal": 1,
            "has_processor": 1,
            "gross_amount_valid": int(r.get("gross_amount_valid", 1)),
            "gross_diff": gross_diff,
            "gross_diff_pct": gross_diff_pct,
            "fee_amount": fee_amt,
            "fee_pct": fee_pct,
            "fee_diff": float(r.get("fee_diff", 0.0)),
            "time_diff_seconds": int(r.get("time_diff_seconds", 0)),
            "currency_match": int(r.get("currency_match", 1)),
            "has_refund": int(r.get("has_refund", 0)),
            "refund_ratio": float(r.get("refund_ratio", 0.0)),
            "is_duplicate_internal": int(
                r.get("internal_payment_id", "") in duplicates_internal_ids
            ),
            "is_duplicate_processor": int(
                r.get("processor_transaction_id", "") in duplicates_processor_ids
            ),
            "candidate_count": candidate_count,
            "payment_status_encoded": PAYMENT_STATUS_MAP.get(
                str(r.get("payment_status", "CAPTURED")).upper(), 0
            ),
        }
        rows.append(feat)

    # ── Process internal-only records (MISSING_PROCESSOR) ──────────────
    for _, r in internal_only_df.iterrows():
        order_id = r["merchant_order_id"]
        feat = {
            "work_key": order_id,
            "has_internal": 1,
            "has_processor": 0,
            "gross_amount_valid": 1,
            "gross_diff": float(r.get("gross_amount", 0.0)),
            "gross_diff_pct": 1.0,
            "fee_amount": 0,
            "fee_pct": 0,
            "fee_diff": 0,
            "time_diff_seconds": 0,
            "currency_match": 1,
            "has_refund": 0,
            "refund_ratio": 0,
            "is_duplicate_internal": int(
                r.get("internal_payment_id", "") in duplicates_internal_ids
            ),
            "is_duplicate_processor": 0,
            "candidate_count": 0,
            "payment_status_encoded": PAYMENT_STATUS_MAP.get(
                str(r.get("payment_status", "CAPTURED")).upper(), 0
            ),
        }
        rows.append(feat)

    # ── Process processor-only records (optional) ──────────────────────
    if include_processor_only and processor_only_df is not None and not processor_only_df.empty:
        for _, r in processor_only_df.iterrows():
            order_id = r["merchant_order_id"]
            feat = {
                "work_key": order_id,
                "has_internal": 0,
                "has_processor": 1,
                "gross_amount_valid": int(r.get("is_valid_amount", True)),
                "gross_diff": 0,
                "gross_diff_pct": 0,
                "fee_amount": float(r.get("fee_amount", 0)),
                "fee_pct": 0,
                "fee_diff": 0,
                "time_diff_seconds": 0,
                "currency_match": 1,
                "has_refund": 0,
                "refund_ratio": 0,
                "is_duplicate_internal": 0,
                "is_duplicate_processor": int(
                    r.get("processor_transaction_id", "") in duplicates_processor_ids
                ),
                "candidate_count": 1,
                "payment_status_encoded": 0,
            }
            rows.append(feat)

    features_df = pd.DataFrame(rows)

    # Replace inf / NaN
    features_df = features_df.replace([np.inf, -np.inf], 0)
    for col in L1_FEATURE_COLUMNS:
        if col in features_df.columns:
            features_df[col] = features_df[col].fillna(0)

    logger.info(f"L1 features extracted: {len(features_df)} records, {len(L1_FEATURE_COLUMNS)} features")
    return features_df


def extract_l2_features(
    matched_df: pd.DataFrame,
    proc_only_df: pd.DataFrame,
    bank_only_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Build L2 feature matrix from matched, proc-only, and bank-only records.

    Returns a DataFrame with one row per work_key (settlement_batch_id)
    and all L2_FEATURE_COLUMNS.
    """
    rows = []

    # ── Process matched records ────────────────────────────────────────
    for _, r in matched_df.iterrows():
        batch_id = r["settlement_batch_id"]
        feat = {
            "work_key": batch_id,
            "has_bank_entry": 1,
            "has_processor_batch": 1,
            "expected_net_total": float(r.get("expected_net_total", 0)),
            "credited_amount_val": float(r.get("credited_amount_val", r.get("credited_amount", 0))),
            "settlement_diff": float(r.get("settlement_diff", 0)),
            "settlement_diff_pct": float(r.get("settlement_diff_pct", 0)),
            "settlement_delay_days": float(r.get("settlement_delay_days", 0)),
            "currency_match": int(r.get("currency_match", 1)),
            "is_duplicate_bank": int(r.get("is_duplicate_bank", 0)),
        }
        rows.append(feat)

    # ── Process processor-only batches (MISSING_BANK_SETTLEMENT) ──────
    for _, r in proc_only_df.iterrows():
        batch_id = r["settlement_batch_id"]
        feat = {
            "work_key": batch_id,
            "has_bank_entry": 0,
            "has_processor_batch": 1,
            "expected_net_total": float(r.get("total_net", 0)),
            "credited_amount_val": 0,
            "settlement_diff": float(r.get("total_net", 0)),
            "settlement_diff_pct": 1.0,
            "settlement_delay_days": 0,
            "currency_match": 1,
            "is_duplicate_bank": 0,
        }
        rows.append(feat)

    # ── Process bank-only entries (MISSING_PROCESSOR batch) ────────────
    for _, r in bank_only_df.iterrows():
        batch_id = r["settlement_batch_id"]
        feat = {
            "work_key": batch_id,
            "has_bank_entry": 1,
            "has_processor_batch": 0,
            "expected_net_total": 0,
            "credited_amount_val": float(r.get("credited_amount", 0)),
            "settlement_diff": -float(r.get("credited_amount", 0)),
            "settlement_diff_pct": -1.0,
            "settlement_delay_days": 0,
            "currency_match": 1,
            "is_duplicate_bank": 0,
        }
        rows.append(feat)

    features_df = pd.DataFrame(rows)

    # Replace inf / NaN
    features_df = features_df.replace([np.inf, -np.inf], 0)
    for col in L2_FEATURE_COLUMNS:
        if col in features_df.columns:
            features_df[col] = features_df[col].fillna(0)

    logger.info(f"L2 features extracted: {len(features_df)} records, {len(L2_FEATURE_COLUMNS)} features")
    return features_df
