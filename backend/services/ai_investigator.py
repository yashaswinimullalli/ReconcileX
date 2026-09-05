"""
ReconcileX — AI Investigation Service
LLM-powered reasoning for ambiguous or complex financial exceptions.
Uses Google Gemini with structured JSON output and strict failure handling.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from config import AI_TIMEOUT_SECONDS, GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# Try importing google-generativeai
try:
    import google.generativeai as genai
    HAS_GENAI = True
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
except ImportError:
    HAS_GENAI = False
    logger.warning("google-generativeai is not installed; AI investigator will use fallback")


@dataclass
class AIInvestigationResult:
    """Structured response from the AI investigator."""
    decision: str  # MATCH | EXCEPTION | DUPLICATE_CANDIDATE | NEEDS_REVIEW
    root_cause: str
    confidence: float
    evidence: list[str] = field(default_factory=list)
    recommended_action: str = ""
    plain_english_explanation: str = ""
    raw_response: Optional[dict[str, Any]] = None
    fallback_used: bool = False


class AIInvestigator:
    """Invokes LLM for complex cases and guarantees a safe structured fallback."""

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.model_name = model_name or GEMINI_MODEL
        self._model = None

        if HAS_GENAI and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self._model = genai.GenerativeModel(
                    model_name=self.model_name,
                    generation_config={
                        "response_mime_type": "application/json",
                        "temperature": 0.1,
                    },
                )
                logger.info(f"AI investigator initialized with model {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not initialize Gemini model: {e}")

    def investigate(
        self,
        recon_level: str,
        work_key: str,
        record_context: dict[str, Any],
        discrepancy_info: dict[str, Any],
        ml_prediction: str,
        ml_confidence: float,
    ) -> AIInvestigationResult:
        """
        Conduct an LLM-assisted investigation of an ambiguous financial record.
        Always returns an AIInvestigationResult (never raises an unhandled exception).
        """
        # If Gemini is not configured, return safe deterministic fallback
        if self._model is None:
            return self._create_fallback(
                reason="Gemini API key not configured or model unavailable",
                ml_prediction=ml_prediction,
            )

        prompt = self._build_prompt(
            recon_level=recon_level,
            work_key=work_key,
            record_context=record_context,
            discrepancy_info=discrepancy_info,
            ml_prediction=ml_prediction,
            ml_confidence=ml_confidence,
        )

        try:
            response = self._model.generate_content(
                prompt,
                request_options={"timeout": AI_TIMEOUT_SECONDS},
            )
            raw_text = response.text
            parsed = json.loads(raw_text)

            # Validate required fields from Gemini structured JSON
            issue_type = str(parsed.get("issue_type") or parsed.get("root_cause") or ml_prediction)
            summary = str(parsed.get("summary") or parsed.get("plain_english_explanation") or f"Discrepancy identified: {issue_type}")
            confidence = float(parsed.get("confidence", 0.70))
            confidence = max(0.0, min(1.0, confidence))
            
            raw_evidence = parsed.get("evidence", [])
            evidence = [str(item) for item in raw_evidence] if isinstance(raw_evidence, list) else [str(raw_evidence)]
            if not evidence:
                evidence = ["Evidence analyzed by Gemini AI Investigator."]

            recommended_action = str(parsed.get("recommended_action", "Review discrepancy records."))
            needs_human_review = bool(parsed.get("needs_human_review", True))

            # Map to deterministic policy decision
            decision = str(parsed.get("decision", "NEEDS_REVIEW")).upper()
            if decision not in {"MATCH", "EXCEPTION", "DUPLICATE_CANDIDATE", "NEEDS_REVIEW"}:
                decision = "NEEDS_REVIEW" if needs_human_review else "MATCH"

            return AIInvestigationResult(
                decision=decision,
                root_cause=issue_type,
                confidence=round(confidence, 4),
                evidence=evidence,
                recommended_action=recommended_action,
                plain_english_explanation=summary,
                raw_response=parsed,
                fallback_used=False,
            )

        except Exception as e:
            logger.warning(f"AI investigation failed for {work_key}: {e}. Returning safe fallback.")
            return self._create_fallback(
                reason="AI call timed out or returned invalid response",
                ml_prediction=ml_prediction,
            )

    def _build_prompt(
        self,
        recon_level: str,
        work_key: str,
        record_context: dict[str, Any],
        discrepancy_info: dict[str, Any],
        ml_prediction: str,
        ml_confidence: float,
    ) -> str:
        """Construct a structured prompt for the financial investigator."""
        return f"""You are ReconcileX AI Investigator, an AI Finance Controller specialized in multi-source financial reconciliation for merchants.

Analyze the financial discrepancy for this {recon_level} record ({work_key}).

SOURCE RECORD CONTEXT:
{json.dumps(record_context, indent=2, default=str)}

DISCREPANCY EVIDENCE:
{json.dumps(discrepancy_info, indent=2, default=str)}

ML MODEL PREDICTION:
- Class: {ml_prediction}
- Confidence: {ml_confidence:.2%}

TASK:
1. Reconcile the financial evidence (amounts, fees, refunds, settlement timing).
2. Check if the difference is explainable (e.g. processor fee, partial refund, rounding, or delay).
3. Provide an audit-ready, plain English explanation for a merchant.

OUTPUT FORMAT:
Respond ONLY with valid JSON matching this exact structure:
{{
  "issue_type": "<concise description of the issue>",
  "confidence": <float between 0.0 and 1.0>,
  "summary": "<simple 1-2 sentence explanation written for a merchant without accounting jargon>",
  "evidence": [
    "<factual evidence point 1>",
    "<factual evidence point 2>"
  ],
  "recommended_action": "<actionable next step for the merchant or finance operations>",
  "needs_human_review": true
}}

SAFETY CONSTRAINTS:
- NEVER fabricate numbers or invent evidence.
- Do NOT approve refunds or modify records.
- Be concise, objective, and truthful.
"""

    def _create_fallback(self, reason: str, ml_prediction: str) -> AIInvestigationResult:
        """Safe deterministic fallback when AI fails or is unavailable."""
        decision = "MATCH" if ml_prediction == "MATCHED" else "NEEDS_REVIEW"
        return AIInvestigationResult(
            decision=decision,
            root_cause=ml_prediction,
            confidence=0.0,
            evidence=[
                "AI investigation unavailable. This case has been safely sent for human review.",
                "Deterministic reconciliation evidence and records preserved.",
            ],
            recommended_action="Conduct manual inspection of ledger records and bank credit entries.",
            plain_english_explanation="AI investigation unavailable. This case has been safely sent for human review.",
            raw_response={"fallback_reason": reason},
            fallback_used=True,
        )


ai_investigator = AIInvestigator()
