"""
Test suite covering User Prompt #10 test cases:
1. Normal matched case
2. Small discrepancy
3. Large discrepancy
4. Missing payment
5. Gemini API failure
6. Invalid Gemini response
"""
import json
import unittest
from unittest.mock import MagicMock, patch

from services.ai_investigator import AIInvestigator, AIInvestigationResult


class TestUserScenarios(unittest.TestCase):

    def setUp(self):
        self.investigator = AIInvestigator(api_key="test-key", model_name="gemini-1.5-flash")

    def test_1_normal_matched_case(self):
        """Test a clean matched case."""
        result = self.investigator._create_fallback(
            reason="Matched case",
            ml_prediction="MATCHED"
        )
        self.assertEqual(result.decision, "MATCH")
        self.assertEqual(result.root_cause, "MATCHED")

    def test_2_small_discrepancy(self):
        """Test small discrepancy handling (e.g. ₹20 variance)."""
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "issue_type": "Deposit difference",
            "confidence": 0.95,
            "summary": "₹20 less was deposited than expected due to a small fee or rounding difference.",
            "evidence": ["Bank deposit is ₹4,390 against expected ₹4,410", "₹20 unexplained difference"],
            "recommended_action": "Review bank settlement statement for minor adjustment.",
            "needs_human_review": True
        })
        self.investigator._model = MagicMock()
        self.investigator._model.generate_content.return_value = mock_response

        res = self.investigator.investigate(
            recon_level="L2_SETTLEMENT",
            work_key="SB-002",
            record_context={"expected": 4410, "deposited": 4390},
            discrepancy_info={"gap": 20},
            ml_prediction="SETTLEMENT_DELAY",
            ml_confidence=0.88,
        )
        self.assertEqual(res.decision, "NEEDS_REVIEW")
        self.assertEqual(res.root_cause, "Deposit difference")
        self.assertIn("₹20", res.plain_english_explanation)
        self.assertFalse(res.fallback_used)

    def test_3_large_discrepancy(self):
        """Test large discrepancy handling (e.g. ₹2,456 shortfall)."""
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "issue_type": "Bank deposit short",
            "confidence": 0.98,
            "summary": "₹2,456 less was deposited than expected. Bank deposit was ₹1,170 while expected payout was ₹3,626.",
            "evidence": ["Expected payout: ₹3,626", "Actual bank credit: ₹1,170", "Shortfall: ₹2,456"],
            "recommended_action": "Verify if partial payout batch was executed by payment gateway.",
            "needs_human_review": True
        })
        self.investigator._model = MagicMock()
        self.investigator._model.generate_content.return_value = mock_response

        res = self.investigator.investigate(
            recon_level="L2_SETTLEMENT",
            work_key="SB-003",
            record_context={"expected": 3626, "deposited": 1170},
            discrepancy_info={"gap": 2456},
            ml_prediction="MISSING_BANK_DEPOSIT",
            ml_confidence=0.92,
        )
        self.assertEqual(res.decision, "NEEDS_REVIEW")
        self.assertEqual(res.root_cause, "Bank deposit short")
        self.assertIn("₹2,456", res.plain_english_explanation)

    def test_4_missing_payment(self):
        """Test missing payment (e.g. order exists but no payment)."""
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "issue_type": "Payment not found",
            "confidence": 0.99,
            "summary": "Order exists, but no matching payment record was found.",
            "evidence": ["Store order ORD-1042 recorded for ₹500", "No processor transaction found"],
            "recommended_action": "Check gateway checkout logs for customer abandoned cart or failed authorization.",
            "needs_human_review": True
        })
        self.investigator._model = MagicMock()
        self.investigator._model.generate_content.return_value = mock_response

        res = self.investigator.investigate(
            recon_level="L1_ORDER",
            work_key="ORD-1042",
            record_context={"order_id": "ORD-1042", "gross_amount": 500},
            discrepancy_info={"missing": "payment_record"},
            ml_prediction="MISSING_IN_PROCESSOR",
            ml_confidence=0.95,
        )
        self.assertEqual(res.decision, "NEEDS_REVIEW")
        self.assertEqual(res.root_cause, "Payment not found")
        self.assertEqual(res.plain_english_explanation, "Order exists, but no matching payment record was found.")

    def test_5_gemini_api_failure(self):
        """Test Gemini API throwing an exception (e.g. network timeout or 503)."""
        self.investigator._model = MagicMock()
        self.investigator._model.generate_content.side_effect = Exception("API connection timed out")

        res = self.investigator.investigate(
            recon_level="L2_SETTLEMENT",
            work_key="SB-003",
            record_context={},
            discrepancy_info={},
            ml_prediction="MISSING_BANK_DEPOSIT",
            ml_confidence=0.90,
        )
        self.assertTrue(res.fallback_used)
        self.assertEqual(
            res.plain_english_explanation,
            "AI investigation unavailable. This case has been safely sent for human review."
        )
        self.assertEqual(res.decision, "NEEDS_REVIEW")

    def test_6_invalid_gemini_response(self):
        """Test Gemini returning non-JSON or invalid JSON output."""
        mock_response = MagicMock()
        mock_response.text = "Error: Internal server error or HTML response <html>500</html>"
        self.investigator._model = MagicMock()
        self.investigator._model.generate_content.return_value = mock_response

        res = self.investigator.investigate(
            recon_level="L1_ORDER",
            work_key="ORD-9999",
            record_context={},
            discrepancy_info={},
            ml_prediction="FEE_MISMATCH",
            ml_confidence=0.85,
        )
        self.assertTrue(res.fallback_used)
        self.assertEqual(
            res.plain_english_explanation,
            "AI investigation unavailable. This case has been safely sent for human review."
        )


if __name__ == "__main__":
    unittest.main()
