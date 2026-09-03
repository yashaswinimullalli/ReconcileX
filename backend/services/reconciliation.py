"""
ReconcileX — Full Reconciliation Pipeline Orchestrator
Executes the multi-source reconciliation loop:
Ingestion -> Normalization -> Matching -> Discrepancy -> ML -> AI -> Policy -> DB Persistence
"""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np
import pandas as pd

from models.database import (
    insert_audit_entries,
    insert_batch,
    insert_recon_records,
    update_batch,
)
from services.ai_investigator import ai_investigator
from services.discrepancy import detect_l1_discrepancies, detect_l2_discrepancies
from services.ingestion import ingest_batch
from services.matching import match_l1, match_l2
from services.ml_classifier import ml_classifier_service
from services.normalization import (
    normalize_bank_settlements,
    normalize_internal_ledger,
    normalize_processor,
)
from services.policy_engine import policy_engine

logger = logging.getLogger(__name__)


class ReconciliationPipeline:
    """Orchestrates the entire multi-source financial reconciliation workflow."""

    @classmethod
    async def run(
        cls,
        batch_id: str,
        internal_content: bytes | str,
        processor_content: bytes | str,
        bank_content: bytes | str,
        ground_truth_content: Optional[bytes | str] = None,
        batch_name: Optional[str] = None,
    ) -> dict[str, Any]:
        """Run the full reconciliation batch pipeline."""
        start_time = time.time()
        logger.info(f"Starting reconciliation pipeline for batch {batch_id}")

        # ── 1. Ingestion ────────────────────────────────────────────────
        ingest_res = ingest_batch(
            internal_content=internal_content,
            processor_content=processor_content,
            bank_content=bank_content,
        )
        if not ingest_res.success:
            raise ValueError(f"Ingestion failed: {'; '.join(ingest_res.errors)}")

        internal_df = ingest_res.internal_ledger.df
        processor_df = ingest_res.processor.df
        bank_df = ingest_res.bank_settlements.df

        # Optional ground truth
        gt_df = None
        if ground_truth_content:
            try:
                import io
                if isinstance(ground_truth_content, bytes):
                    gt_df = pd.read_csv(io.BytesIO(ground_truth_content))
                else:
                    gt_df = pd.read_csv(ground_truth_content)
            except Exception as e:
                logger.warning(f"Could not parse ground truth: {e}")

        # ── 2. Normalization ────────────────────────────────────────────
        norm_internal = normalize_internal_ledger(internal_df)
        norm_proc = normalize_processor(processor_df)
        norm_bank = normalize_bank_settlements(bank_df)

        int_clean = norm_internal.df
        proc_clean = norm_proc.df
        bank_clean = norm_bank.df

        # ── 3. L1 Matching & Discrepancies ──────────────────────────────
        l1_match = match_l1(int_clean, proc_clean)
        fee_rate = ml_classifier_service.fee_policy.get("rate", 0.029)
        fee_fixed = ml_classifier_service.fee_policy.get("fixed", 0.30)
        l1_matched_disc = detect_l1_discrepancies(
            l1_match.matched, fee_rate_pct=fee_rate, fee_fixed=fee_fixed
        )

        dup_int_ids = set(l1_match.duplicates_internal["internal_payment_id"].unique())
        dup_proc_ids = set(l1_match.duplicates_processor["processor_transaction_id"].unique())
        ambiguous_order_ids = set(l1_match.ambiguous["merchant_order_id"].unique())
        invalid_order_ids = (
            set(l1_match.invalid_rows["merchant_order_id"].unique())
            if len(l1_match.invalid_rows) > 0
            else set()
        )

        from ml.features import extract_l1_features, extract_l2_features
        l1_features_df = extract_l1_features(
            matched_df=l1_matched_disc,
            internal_only_df=l1_match.internal_only,
            processor_only_df=l1_match.processor_only,
            duplicates_internal_ids=dup_int_ids,
            duplicates_processor_ids=dup_proc_ids,
            ambiguous_order_ids=ambiguous_order_ids,
            invalid_order_ids=invalid_order_ids,
        )

        # ── 4. L2 Matching & Discrepancies ──────────────────────────────
        l2_match = match_l2(proc_clean, bank_clean)
        l2_matched_disc = detect_l2_discrepancies(l2_match.matched)
        l2_features_df = extract_l2_features(
            matched_df=l2_matched_disc,
            proc_only_df=l2_match.proc_only,
            bank_only_df=l2_match.bank_only,
        )

        # ── 5. ML Predictions ───────────────────────────────────────────
        l1_predictions = ml_classifier_service.predict_l1(l1_features_df)
        l2_predictions = ml_classifier_service.predict_l2(l2_features_df)

        l1_pred_map = {p.work_key: p for p in l1_predictions}
        l2_pred_map = {p.work_key: p for p in l2_predictions}

        # ── 6. Policy & AI Evaluation + Record Assembly ─────────────────
        records_to_insert = []
        audit_entries = []
        now_iso = datetime.now(timezone.utc).isoformat()

        # Build lookup maps for source records
        int_by_order = int_clean.drop_duplicates("merchant_order_id").set_index("merchant_order_id").to_dict(orient="index")
        proc_captures = proc_clean[proc_clean["processor_event_type"] == "CAPTURE"]
        proc_by_order = proc_captures.drop_duplicates("merchant_order_id").set_index("merchant_order_id").to_dict(orient="index")
        bank_by_batch = bank_clean.drop_duplicates("settlement_batch_id").set_index("settlement_batch_id").to_dict(orient="index")

        # Ground truth maps
        gt_order_map = {}
        gt_settle_map = {}
        if gt_df is not None:
            gt_order = gt_df[gt_df["result_scope"] == "ORDER"].drop_duplicates("work_key")
            gt_order_map = gt_order.set_index("work_key").to_dict(orient="index")
            gt_settle = gt_df[gt_df["result_scope"] == "SETTLEMENT"].drop_duplicates("work_key")
            gt_settle_map = gt_settle.set_index("work_key").to_dict(orient="index")

        # Metrics accumulators
        counts = {
            "l1_total": len(l1_features_df),
            "l1_matched": 0,
            "l1_exceptions": 0,
            "l2_total": len(l2_features_df),
            "l2_matched": 0,
            "l2_exceptions": 0,
            "matched_count": 0,
            "auto_resolved_count": 0,
            "ai_investigated_count": 0,
            "exception_count": 0,
            "needs_review_count": 0,
            "unresolved_amount": 0.0,
        }

        # ── Process L1 Records ──────────────────────────────────────────
        for _, feat_row in l1_features_df.iterrows():
            work_key = feat_row["work_key"]
            pred_item = l1_pred_map.get(work_key)
            int_rec = int_by_order.get(work_key, {})
            proc_rec = proc_by_order.get(work_key, {})
            gt_rec = gt_order_map.get(work_key, {})

            record_id = str(uuid.uuid4())
            pred_class = pred_item.prediction if pred_item else "UNKNOWN"
            pred_conf = pred_item.confidence if pred_item else 0.0

            gross_diff = float(feat_row.get("gross_diff", 0.0))
            fee_amt = float(feat_row.get("fee_amount", 0.0))
            unexplained = max(0.0, abs(gross_diff) - fee_amt)
            is_ambiguous = work_key in ambiguous_order_ids
            has_invalid = int(feat_row.get("gross_amount_valid", 1)) == 0

            # Determine if AI is needed
            should_ai = policy_engine.should_investigate_with_ai(
                ml_prediction=pred_class,
                ml_confidence=pred_conf,
                unexplained_amount=unexplained,
                is_ambiguous=is_ambiguous,
                has_invalid_data=has_invalid,
            )

            ai_res = None
            if should_ai:
                counts["ai_investigated_count"] += 1
                ai_res = ai_investigator.investigate(
                    recon_level="L1_ORDER",
                    work_key=work_key,
                    record_context={"internal": int_rec, "processor": proc_rec},
                    discrepancy_info={
                        "gross_diff": gross_diff,
                        "fee_amount": fee_amt,
                        "fee_diff": float(feat_row.get("fee_diff", 0.0)),
                        "unexplained": unexplained,
                        "is_duplicate_internal": bool(feat_row.get("is_duplicate_internal", 0)),
                        "is_duplicate_processor": bool(feat_row.get("is_duplicate_processor", 0)),
                    },
                    ml_prediction=pred_class,
                    ml_confidence=pred_conf,
                )

            # Policy Decision
            decision = policy_engine.evaluate(
                ml_prediction=pred_class,
                ml_confidence=pred_conf,
                unexplained_amount=unexplained,
                currency_match=bool(feat_row.get("currency_match", 1)),
                is_duplicate=bool(feat_row.get("is_duplicate_internal", 0) or feat_row.get("is_duplicate_processor", 0)),
                is_ambiguous=is_ambiguous,
                ai_decision=ai_res.decision if ai_res else None,
                ai_confidence=ai_res.confidence if ai_res else None,
            )

            # Update counters
            if decision.final_status == "AUTO_RESOLVE":
                counts["auto_resolved_count"] += 1
                counts["matched_count"] += 1
                counts["l1_matched"] += 1
            elif decision.final_status == "NEEDS_REVIEW":
                counts["needs_review_count"] += 1
                counts["unresolved_amount"] += unexplained
            else:
                counts["exception_count"] += 1
                counts["l1_exceptions"] += 1
                counts["unresolved_amount"] += abs(gross_diff)

            record_entry = {
                "id": record_id,
                "batch_id": batch_id,
                "recon_level": "L1_ORDER",
                "work_key": work_key,
                "internal_payment_id": int_rec.get("internal_payment_id"),
                "processor_transaction_id": proc_rec.get("processor_transaction_id"),
                "settlement_batch_id": proc_rec.get("settlement_batch_id"),
                "bank_entry_id": None,
                "match_method": "EXACT" if not is_ambiguous else "AMBIGUOUS",
                "match_score": 1.0 if not is_ambiguous else 0.5,
                "internal_gross": float(int_rec.get("gross_amount", 0.0)),
                "processor_gross": float(proc_rec.get("gross_amount", 0.0)) if proc_rec.get("gross_amount") is not None else 0.0,
                "gross_diff": gross_diff,
                "fee_amount": fee_amt,
                "net_amount": float(proc_rec.get("net_amount", 0.0)),
                "refund_amount": float(feat_row.get("refund_ratio", 0.0) * float(int_rec.get("gross_amount", 0.0))),
                "time_diff_seconds": int(feat_row.get("time_diff_seconds", 0)),
                "expected_net_total": 0.0,
                "credited_amount": 0.0,
                "settlement_diff": 0.0,
                "settlement_delay_days": 0.0,
                "currency": int_rec.get("currency", proc_rec.get("currency", "INR")),
                "currency_match": int(feat_row.get("currency_match", 1)),
                "is_duplicate": int(feat_row.get("is_duplicate_internal", 0) or feat_row.get("is_duplicate_processor", 0)),
                "unexplained_amount": unexplained,
                "ml_prediction": pred_class,
                "ml_confidence": pred_conf,
                "ml_feature_vector": pred_item.feature_vector if pred_item else {},
                "ai_investigated": 1 if ai_res else 0,
                "ai_decision": ai_res.decision if ai_res else None,
                "ai_root_cause": ai_res.root_cause if ai_res else None,
                "ai_confidence": ai_res.confidence if ai_res else None,
                "ai_evidence": ai_res.evidence if ai_res else None,
                "ai_explanation": ai_res.evidence[0] if (ai_res and ai_res.evidence) else None,
                "ai_recommended_action": ai_res.recommended_action if ai_res else None,
                "final_status": decision.final_status,
                "final_root_cause": decision.final_root_cause,
                "policy_reason": decision.policy_reason,
                "ground_truth_outcome": gt_rec.get("expected_outcome"),
                "ground_truth_reason": gt_rec.get("expected_reason_code"),
                "ground_truth_difference": gt_rec.get("expected_difference"),
                "ground_truth_explanation": gt_rec.get("explanation"),
                "created_at": now_iso,
            }
            records_to_insert.append(record_entry)

            audit_entries.append({
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "recon_record_id": record_id,
                "step": "PIPELINE_RESOLVE",
                "action": decision.final_status,
                "details": {
                    "ml": pred_class,
                    "confidence": pred_conf,
                    "policy": decision.policy_reason,
                    "ai_called": bool(ai_res),
                },
                "created_at": now_iso,
            })

        # ── Process L2 Records ──────────────────────────────────────────
        for _, feat_row in l2_features_df.iterrows():
            work_key = feat_row["work_key"]
            pred_item = l2_pred_map.get(work_key)
            bank_rec = bank_by_batch.get(work_key, {})
            gt_rec = gt_settle_map.get(work_key, {})

            record_id = str(uuid.uuid4())
            pred_class = pred_item.prediction if pred_item else "UNKNOWN"
            pred_conf = pred_item.confidence if pred_item else 0.0

            settle_diff = float(feat_row.get("settlement_diff", 0.0))
            is_dup_bank = bool(feat_row.get("is_duplicate_bank", 0))

            should_ai = policy_engine.should_investigate_with_ai(
                ml_prediction=pred_class,
                ml_confidence=pred_conf,
                unexplained_amount=abs(settle_diff),
                is_ambiguous=is_dup_bank,
            )

            ai_res = None
            if should_ai:
                counts["ai_investigated_count"] += 1
                ai_res = ai_investigator.investigate(
                    recon_level="L2_SETTLEMENT",
                    work_key=work_key,
                    record_context={"bank": bank_rec},
                    discrepancy_info={
                        "expected_net_total": float(feat_row.get("expected_net_total", 0.0)),
                        "credited_amount": float(feat_row.get("credited_amount_val", 0.0)),
                        "settlement_diff": settle_diff,
                        "settlement_delay_days": float(feat_row.get("settlement_delay_days", 0.0)),
                        "is_duplicate_bank": is_dup_bank,
                    },
                    ml_prediction=pred_class,
                    ml_confidence=pred_conf,
                )

            decision = policy_engine.evaluate(
                ml_prediction=pred_class,
                ml_confidence=pred_conf,
                unexplained_amount=abs(settle_diff),
                currency_match=bool(feat_row.get("currency_match", 1)),
                is_duplicate=is_dup_bank,
                ai_decision=ai_res.decision if ai_res else None,
                ai_confidence=ai_res.confidence if ai_res else None,
            )

            if decision.final_status == "AUTO_RESOLVE":
                counts["auto_resolved_count"] += 1
                counts["matched_count"] += 1
                counts["l2_matched"] += 1
            elif decision.final_status == "NEEDS_REVIEW":
                counts["needs_review_count"] += 1
                counts["unresolved_amount"] += abs(settle_diff)
            else:
                counts["exception_count"] += 1
                counts["l2_exceptions"] += 1
                counts["unresolved_amount"] += abs(settle_diff)

            record_entry = {
                "id": record_id,
                "batch_id": batch_id,
                "recon_level": "L2_SETTLEMENT",
                "work_key": work_key,
                "internal_payment_id": None,
                "processor_transaction_id": None,
                "settlement_batch_id": work_key,
                "bank_entry_id": bank_rec.get("bank_entry_id"),
                "match_method": "EXACT" if not is_dup_bank else "DUPLICATE_BANK",
                "match_score": 1.0 if not is_dup_bank else 0.5,
                "internal_gross": 0.0,
                "processor_gross": 0.0,
                "gross_diff": 0.0,
                "fee_amount": 0.0,
                "net_amount": 0.0,
                "refund_amount": 0.0,
                "time_diff_seconds": 0,
                "expected_net_total": float(feat_row.get("expected_net_total", 0.0)),
                "credited_amount": float(feat_row.get("credited_amount_val", 0.0)),
                "settlement_diff": settle_diff,
                "settlement_delay_days": float(feat_row.get("settlement_delay_days", 0.0)),
                "currency": bank_rec.get("currency", "INR"),
                "currency_match": int(feat_row.get("currency_match", 1)),
                "is_duplicate": int(is_dup_bank),
                "unexplained_amount": abs(settle_diff),
                "ml_prediction": pred_class,
                "ml_confidence": pred_conf,
                "ml_feature_vector": pred_item.feature_vector if pred_item else {},
                "ai_investigated": 1 if ai_res else 0,
                "ai_decision": ai_res.decision if ai_res else None,
                "ai_root_cause": ai_res.root_cause if ai_res else None,
                "ai_confidence": ai_res.confidence if ai_res else None,
                "ai_evidence": ai_res.evidence if ai_res else None,
                "ai_explanation": ai_res.evidence[0] if (ai_res and ai_res.evidence) else None,
                "ai_recommended_action": ai_res.recommended_action if ai_res else None,
                "final_status": decision.final_status,
                "final_root_cause": decision.final_root_cause,
                "policy_reason": decision.policy_reason,
                "ground_truth_outcome": gt_rec.get("expected_outcome"),
                "ground_truth_reason": gt_rec.get("expected_reason_code"),
                "ground_truth_difference": gt_rec.get("expected_difference"),
                "ground_truth_explanation": gt_rec.get("explanation"),
                "created_at": now_iso,
            }
            records_to_insert.append(record_entry)

            audit_entries.append({
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "recon_record_id": record_id,
                "step": "PIPELINE_RESOLVE",
                "action": decision.final_status,
                "details": {
                    "ml": pred_class,
                    "confidence": pred_conf,
                    "policy": decision.policy_reason,
                    "ai_called": bool(ai_res),
                },
                "created_at": now_iso,
            })

        # ── 7. Commit to Database ───────────────────────────────────────
        await insert_recon_records(records_to_insert)
        await insert_audit_entries(audit_entries)

        elapsed_ms = int((time.time() - start_time) * 1000)
        total_recs = counts["l1_total"] + counts["l2_total"]
        match_rate = round(counts["matched_count"] / total_recs, 4) if total_recs > 0 else 0.0

        batch_updates = {
            "status": "COMPLETED",
            "l1_total": counts["l1_total"],
            "l1_matched": counts["l1_matched"],
            "l1_exceptions": counts["l1_exceptions"],
            "l2_total": counts["l2_total"],
            "l2_matched": counts["l2_matched"],
            "l2_exceptions": counts["l2_exceptions"],
            "total_records": total_recs,
            "matched_count": counts["matched_count"],
            "auto_resolved_count": counts["auto_resolved_count"],
            "ai_investigated_count": counts["ai_investigated_count"],
            "exception_count": counts["exception_count"],
            "needs_review_count": counts["needs_review_count"],
            "match_rate": match_rate,
            "unresolved_amount": round(counts["unresolved_amount"], 2),
            "processing_time_ms": elapsed_ms,
            "l1_ml_accuracy": ml_classifier_service.metrics.get("l1", {}).get("accuracy") if ml_classifier_service.metrics else 1.0,
            "l1_ml_f1": ml_classifier_service.metrics.get("l1", {}).get("f1") if ml_classifier_service.metrics else 1.0,
            "l2_ml_accuracy": ml_classifier_service.metrics.get("l2", {}).get("accuracy") if ml_classifier_service.metrics else 1.0,
            "l2_ml_f1": ml_classifier_service.metrics.get("l2", {}).get("f1") if ml_classifier_service.metrics else 1.0,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        await update_batch(batch_id, batch_updates)
        logger.info(f"Reconciliation completed for {batch_id} in {elapsed_ms}ms. Total: {total_recs}, Match rate: {match_rate:.2%}")

        return {**batch_updates, "batch_id": batch_id}
