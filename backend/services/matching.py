"""
ReconcileX — Matching Engine
L1: Order-level matching (internal ledger ↔ processor transactions)
L2: Settlement-level matching (processor batches ↔ bank settlements)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class L1MatchResult:
    """Result of L1 order-level matching."""
    matched: pd.DataFrame          # rows with both internal + processor
    internal_only: pd.DataFrame    # internal records with no processor match
    processor_only: pd.DataFrame   # processor records with no internal match
    duplicates_internal: pd.DataFrame  # duplicate internal_payment_ids
    duplicates_processor: pd.DataFrame # duplicate processor_transaction_ids
    ambiguous: pd.DataFrame        # orders mapping to multiple candidates
    invalid_rows: pd.DataFrame     # rows with invalid data (NOT_A_NUMBER)
    summary: dict = field(default_factory=dict)


@dataclass
class L2MatchResult:
    """Result of L2 settlement-level matching."""
    matched: pd.DataFrame          # batches matched to bank entries
    proc_only: pd.DataFrame        # processor batches with no bank entry
    bank_only: pd.DataFrame        # bank entries with no processor batch
    duplicate_bank: pd.DataFrame   # multiple bank entries for same batch
    summary: dict = field(default_factory=dict)


def match_l1(
    internal: pd.DataFrame,
    processor: pd.DataFrame,
) -> L1MatchResult:
    """
    L1 Order-Level Matching.

    Join internal ledger and processor transactions on merchant_order_id.
    Detect: exact matches, missing records, duplicates, ambiguous matches,
    and invalid source rows.
    """
    # ── 1. Identify invalid processor rows (NOT_A_NUMBER) ──────────────
    invalid_rows = pd.DataFrame()
    if "is_valid_amount" in processor.columns:
        invalid_mask = ~processor["is_valid_amount"]
        invalid_rows = processor[invalid_mask].copy()
        # Keep invalid rows in processor for now — they'll be flagged
        logger.info(f"L1: {len(invalid_rows)} invalid processor rows detected")

    # ── 2. Separate CAPTURE and REFUND events ──────────────────────────
    captures = processor[processor["processor_event_type"] == "CAPTURE"].copy()
    refunds = processor[processor["processor_event_type"] == "REFUND"].copy()

    # ── 3. Detect duplicate internal_payment_ids ───────────────────────
    int_dup_mask = internal.duplicated(subset="internal_payment_id", keep=False)
    duplicates_internal = internal[int_dup_mask].copy()
    dup_int_ids = set(duplicates_internal["internal_payment_id"].unique())
    logger.info(f"L1: {len(dup_int_ids)} duplicate internal_payment_ids")

    # ── 4. Detect duplicate processor_transaction_ids ──────────────────
    proc_dup_mask = captures.duplicated(subset="processor_transaction_id", keep=False)
    duplicates_processor = captures[proc_dup_mask].copy()
    dup_proc_ids = set(duplicates_processor["processor_transaction_id"].unique())
    logger.info(f"L1: {len(dup_proc_ids)} duplicate processor_transaction_ids")

    # ── 5. Detect ambiguous matches (order maps to multiple candidates) ─
    # Count how many CAPTURE records each merchant_order_id has
    capture_counts = captures.groupby("merchant_order_id").size().reset_index(name="capture_count")
    internal_counts = internal.groupby("merchant_order_id").size().reset_index(name="internal_count")

    # An order is ambiguous if it has multiple captures OR multiple internals
    # (excluding pure duplicates which are exact copies)
    ambiguous_orders = set()

    # Check captures: group by merchant_order_id and look for distinct amounts
    for order_id, group in captures.groupby("merchant_order_id"):
        if len(group) > 1:
            # Check if these are true duplicates (same proc ID) or different records
            unique_proc_ids = group["processor_transaction_id"].nunique()
            if unique_proc_ids > 1:
                # Different processor transactions for same order → ambiguous
                ambiguous_orders.add(order_id)

    # ── 6. Perform the join ────────────────────────────────────────────
    # Use deduplicated versions for the primary join
    # Take first occurrence for duplicates (they'll be flagged separately)
    internal_dedup = internal.drop_duplicates(subset="merchant_order_id", keep="first")
    captures_dedup = captures.drop_duplicates(subset="merchant_order_id", keep="first")

    # Outer join on merchant_order_id
    merged = pd.merge(
        internal_dedup,
        captures_dedup,
        on="merchant_order_id",
        how="outer",
        suffixes=("_int", "_proc"),
        indicator=True,
    )

    # ── 7. Classify join results ───────────────────────────────────────
    both_mask = merged["_merge"] == "both"
    int_only_mask = merged["_merge"] == "left_only"
    proc_only_mask = merged["_merge"] == "right_only"

    matched = merged[both_mask].copy()
    internal_only = merged[int_only_mask].copy()
    processor_only = merged[proc_only_mask].copy()

    # ── 8. Attach refund info to matched records ───────────────────────
    refund_agg = refunds.groupby("merchant_order_id").agg(
        refund_gross=("gross_amount", "sum"),
        refund_count=("processor_transaction_id", "count"),
    ).reset_index()

    matched = pd.merge(
        matched, refund_agg, on="merchant_order_id", how="left"
    )
    matched["refund_gross"] = matched["refund_gross"].fillna(0)
    matched["refund_count"] = matched["refund_count"].fillna(0).astype(int)

    # Also check internal payment status for refund info
    matched["has_refund"] = (
        (matched["refund_count"] > 0)
        | (matched["payment_status"].isin(["PARTIALLY_REFUNDED", "REFUNDED"]))
    )

    # ── 9. Mark match method ──────────────────────────────────────────
    matched["match_method"] = "EXACT"
    matched["match_score"] = 1.0

    # Flag ambiguous matches
    matched.loc[
        matched["merchant_order_id"].isin(ambiguous_orders),
        "match_method"
    ] = "AMBIGUOUS"

    # Flag records with invalid data
    invalid_order_ids = set()
    if len(invalid_rows) > 0:
        invalid_order_ids = set(invalid_rows["merchant_order_id"].unique())
        matched.loc[
            matched["merchant_order_id"].isin(invalid_order_ids),
            "match_method"
        ] = "INVALID_DATA"

    # ── 10. Get ambiguous records detail ───────────────────────────────
    ambiguous_df = matched[matched["merchant_order_id"].isin(ambiguous_orders)].copy()

    # ── 11. Build summary ─────────────────────────────────────────────
    summary = {
        "total_internal": len(internal),
        "total_processor_captures": len(captures),
        "total_processor_refunds": len(refunds),
        "matched": len(matched),
        "internal_only": len(internal_only),
        "processor_only": len(processor_only),
        "duplicate_internal_ids": len(dup_int_ids),
        "duplicate_processor_ids": len(dup_proc_ids),
        "ambiguous_orders": len(ambiguous_orders),
        "invalid_rows": len(invalid_rows),
    }
    logger.info(f"L1 matching complete: {summary}")

    return L1MatchResult(
        matched=matched,
        internal_only=internal_only,
        processor_only=processor_only,
        duplicates_internal=duplicates_internal,
        duplicates_processor=duplicates_processor,
        ambiguous=ambiguous_df,
        invalid_rows=invalid_rows,
        summary=summary,
    )


def match_l2(
    processor: pd.DataFrame,
    bank: pd.DataFrame,
) -> L2MatchResult:
    """
    L2 Settlement-Level Matching.

    Aggregate processor transactions by settlement_batch_id,
    then match against bank settlement entries.
    """
    # ── 1. Filter to valid CAPTURE and REFUND records ──────────────────
    valid_proc = processor.copy()
    if "is_valid_amount" in valid_proc.columns:
        valid_proc = valid_proc[valid_proc["is_valid_amount"]].copy()

    # ── 2. Aggregate processor by settlement_batch_id ──────────────────
    batch_agg = valid_proc.groupby("settlement_batch_id").agg(
        total_gross=("gross_amount", "sum"),
        total_fee=("fee_amount", "sum"),
        total_net=("net_amount", "sum"),
        txn_count=("processor_transaction_id", "count"),
        batch_currency=("currency", "first"),  # assume same currency per batch
        latest_event_time=("processor_event_time", "max"),
    ).reset_index()

    logger.info(f"L2: {len(batch_agg)} processor batches aggregated")

    # ── 3. Detect duplicate bank entries ───────────────────────────────
    bank_dup_mask = bank.duplicated(subset="settlement_batch_id", keep=False)
    duplicate_bank = bank[bank_dup_mask].copy()
    dup_batch_ids = set(duplicate_bank["settlement_batch_id"].unique())
    logger.info(f"L2: {len(dup_batch_ids)} settlement_batch_ids with duplicate bank entries")

    # Use first bank entry for each batch for the primary join
    bank_dedup = bank.drop_duplicates(subset="settlement_batch_id", keep="first")

    # ── 4. Join processor batches with bank entries ────────────────────
    merged = pd.merge(
        batch_agg,
        bank_dedup,
        on="settlement_batch_id",
        how="outer",
        suffixes=("_proc", "_bank"),
        indicator=True,
    )

    # ── 5. Classify ────────────────────────────────────────────────────
    both_mask = merged["_merge"] == "both"
    proc_only_mask = merged["_merge"] == "left_only"
    bank_only_mask = merged["_merge"] == "right_only"

    matched = merged[both_mask].copy()
    proc_only = merged[proc_only_mask].copy()
    bank_only = merged[bank_only_mask].copy()

    # ── 6. Calculate settlement delay ──────────────────────────────────
    if len(matched) > 0 and "booked_at" in matched.columns:
        matched["settlement_delay"] = (
            matched["booked_at"] - matched["latest_event_time"]
        )
        matched["settlement_delay_days"] = (
            matched["settlement_delay"].dt.total_seconds() / 86400
        ).fillna(0).round(2)
    else:
        matched["settlement_delay_days"] = 0

    # ── 7. Mark match method ──────────────────────────────────────────
    matched["match_method"] = "EXACT"
    matched["match_score"] = 1.0

    # Flag batches with duplicate bank entries
    matched.loc[
        matched["settlement_batch_id"].isin(dup_batch_ids),
        "match_method"
    ] = "DUPLICATE_BANK"

    # Count bank entries per batch
    bank_counts = bank.groupby("settlement_batch_id").size().reset_index(name="bank_entry_count")
    matched = pd.merge(matched, bank_counts, on="settlement_batch_id", how="left")
    matched["bank_entry_count"] = matched["bank_entry_count"].fillna(0).astype(int)

    # ── 8. Build summary ─────────────────────────────────────────────
    summary = {
        "total_processor_batches": len(batch_agg),
        "total_bank_entries": len(bank),
        "matched": len(matched),
        "proc_only": len(proc_only),
        "bank_only": len(bank_only),
        "duplicate_bank_entries": len(dup_batch_ids),
    }
    logger.info(f"L2 matching complete: {summary}")

    return L2MatchResult(
        matched=matched,
        proc_only=proc_only,
        bank_only=bank_only,
        duplicate_bank=duplicate_bank,
        summary=summary,
    )
