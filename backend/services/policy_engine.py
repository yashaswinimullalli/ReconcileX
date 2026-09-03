"""
ReconcileX — Policy & Decision Engine
Deterministic financial decision layer.
Strictly governs whether records are AUTO_RESOLVE, NEEDS_REVIEW, or EXCEPTION.

Core Rule: "Resolve what the evidence supports. Escalate what it does not."
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from config import (
    ALWAYS_EXCEPTION_CLASSES,
    AUTO_RESOLVABLE_CLASSES,
    ML_AI_INVESTIGATE_THRESHOLD,
    ML_AMBIGUOUS_CLASSES,
    ML_AUTO_RESOLVE_CONFIDENCE,
)

logger = logging.getLogger(__name__)


@dataclass
class PolicyDecision:
    """Final decision produced by the deterministic policy layer."""
    final_status: str           # AUTO_RESOLVE | NEEDS_REVIEW | EXCEPTION
    final_root_cause: str       # Clean class name / reason
    policy_reason: str          # Justification of the policy decision
    requires_ai: bool           # Whether this case warranted AI investigation


class PolicyEngine:
    """
    Deterministic rules engine.
    Ensures safe, auditable outcomes regardless of ML or LLM variability.
    """

    @staticmethod
    def should_investigate_with_ai(
        ml_prediction: str,
        ml_confidence: float,
        unexplained_amount: float,
        is_ambiguous: bool = False,
        has_invalid_data: bool = False,
    ) -> bool:
        """Determine if a record should be escalated to the AI investigator."""
        if has_invalid_data:
            return True
        if is_ambiguous or ml_prediction in ML_AMBIGUOUS_CLASSES:
            return True
        if ml_confidence < ML_AI_INVESTIGATE_THRESHOLD:
            return True
        if unexplained_amount > 0 and ml_confidence < 0.90:
            return True
        return False

    @classmethod
    def evaluate(
        cls,
        ml_prediction: str,
        ml_confidence: float,
        unexplained_amount: float = 0.0,
        currency_match: bool = True,
        is_duplicate: bool = False,
        is_ambiguous: bool = False,
        ai_decision: Optional[str] = None,
        ai_confidence: Optional[float] = None,
    ) -> PolicyDecision:
        """
        Evaluate all signals and return a deterministic PolicyDecision.
        """
        requires_ai = cls.should_investigate_with_ai(
            ml_prediction=ml_prediction,
            ml_confidence=ml_confidence,
            unexplained_amount=unexplained_amount,
            is_ambiguous=is_ambiguous,
        )

        # ── 1. HARD SAFETY GATES (Never auto-resolve) ───────────────────
        if not currency_match or ml_prediction == "CURRENCY_MISMATCH":
            return PolicyDecision(
                final_status="EXCEPTION",
                final_root_cause="CURRENCY_MISMATCH",
                policy_reason="Currencies differ across sources; cannot resolve across currency borders.",
                requires_ai=requires_ai,
            )

        if ml_prediction == "INVALID_SOURCE_ROW":
            return PolicyDecision(
                final_status="EXCEPTION",
                final_root_cause="INVALID_SOURCE_ROW",
                policy_reason="Source row quarantined due to invalid gross_amount format.",
                requires_ai=requires_ai,
            )

        if is_duplicate or ml_prediction in {"DUPLICATE_INTERNAL", "DUPLICATE_PROCESSOR", "DUPLICATE_BANK_ENTRY"}:
            return PolicyDecision(
                final_status="EXCEPTION",
                final_root_cause=ml_prediction,
                policy_reason="Duplicate identifiers detected across payment records.",
                requires_ai=requires_ai,
            )

        # ── 2. AI INVESTIGATION PRESENT ─────────────────────────────────
        if ai_decision is not None:
            # AI provided an opinion; validate against financial evidence
            if ai_decision == "MATCH" and unexplained_amount <= 0.01 and ml_confidence >= 0.70:
                return PolicyDecision(
                    final_status="AUTO_RESOLVE",
                    final_root_cause=ml_prediction,
                    policy_reason=f"AI confirmed match with supporting evidence; no unexplained difference.",
                    requires_ai=requires_ai,
                )
            elif ai_decision == "EXCEPTION":
                return PolicyDecision(
                    final_status="EXCEPTION",
                    final_root_cause=ml_prediction,
                    policy_reason="AI identified actionable discrepancy with high confidence.",
                    requires_ai=requires_ai,
                )
            else:
                # Default for ambiguous or uncertain AI responses
                return PolicyDecision(
                    final_status="NEEDS_REVIEW",
                    final_root_cause=ml_prediction if ml_prediction != "MATCHED" else "AMBIGUOUS_MATCH",
                    policy_reason="Evidence incomplete or discrepancy exceeds automated resolution policy.",
                    requires_ai=requires_ai,
                )

        # ── 3. DETERMINISTIC ML POLICY (No AI invocation) ───────────────
        if ml_prediction == "MATCHED":
            if ml_confidence >= ML_AUTO_RESOLVE_CONFIDENCE and unexplained_amount <= 0.01:
                return PolicyDecision(
                    final_status="AUTO_RESOLVE",
                    final_root_cause="MATCHED",
                    policy_reason="Exact match verified with high confidence and zero unexplained variance.",
                    requires_ai=requires_ai,
                )
            else:
                return PolicyDecision(
                    final_status="NEEDS_REVIEW",
                    final_root_cause="AMBIGUOUS_MATCH",
                    policy_reason="Match confidence below auto-resolve threshold or variance detected.",
                    requires_ai=requires_ai,
                )

        if ml_prediction in AUTO_RESOLVABLE_CLASSES:
            # E.g. clean FEE_MISMATCH, PARTIAL_REFUND, REFUND_MATCHED, LATE_SETTLEMENT
            if ml_confidence >= ML_AUTO_RESOLVE_CONFIDENCE and unexplained_amount <= 0.01:
                return PolicyDecision(
                    final_status="AUTO_RESOLVE",
                    final_root_cause=ml_prediction,
                    policy_reason=f"Known acceptable business variance ({ml_prediction}) with high confidence.",
                    requires_ai=requires_ai,
                )
            else:
                return PolicyDecision(
                    final_status="NEEDS_REVIEW",
                    final_root_cause=ml_prediction,
                    policy_reason=f"Variance type {ml_prediction} detected but confidence/unexplained variance requires human sign-off.",
                    requires_ai=requires_ai,
                )

        if ml_prediction in {"MISSING_INTERNAL", "MISSING_PROCESSOR", "MISSING_BANK_SETTLEMENT"}:
            return PolicyDecision(
                final_status="EXCEPTION",
                final_root_cause=ml_prediction,
                policy_reason=f"One-sided entry: missing corresponding financial counterparty record ({ml_prediction}).",
                requires_ai=requires_ai,
            )

        if ml_prediction == "AMOUNT_MISMATCH":
            return PolicyDecision(
                final_status="EXCEPTION",
                final_root_cause="AMOUNT_MISMATCH",
                policy_reason="Gross amounts differ between internal ledger and processor.",
                requires_ai=requires_ai,
            )

        # Fallthrough safety
        return PolicyDecision(
            final_status="NEEDS_REVIEW",
            final_root_cause=ml_prediction,
            policy_reason="Default escalation: insufficient evidence to safely auto-resolve.",
            requires_ai=requires_ai,
        )


policy_engine = PolicyEngine()
