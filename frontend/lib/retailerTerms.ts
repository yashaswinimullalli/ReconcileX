/**
 * ReconcileX — Retailer Plain English Translation Layer
 * Translates complex accounting / CPA jargon into intuitive terms for shop owners,
 * D2C merchants, and non-finance store managers.
 */

export const RETAILER_ROOT_CAUSES: Record<string, { label: string; desc: string; icon: string }> = {
  PROCESSOR_FEE_MISMATCH: {
    label: 'Payment Gateway Overcharged Fee',
    desc: 'The payment app (Razorpay/Stripe) deducted more commission than your agreed contract rate.',
    icon: '🚨',
  },
  SETTLEMENT_DELAY_IN_FLIGHT: {
    label: 'Money On The Way (Bank Delay)',
    desc: 'The customer paid and the payment app captured the funds; bank deposit typically takes 1–2 business days.',
    icon: '⏳',
  },
  SETTLEMENT_ROUNDING_ERROR: {
    label: '1-Cent Rounding Difference',
    desc: 'Tiny fraction-of-a-cent rounding between order tax and bulk settlement total. Safe to write off.',
    icon: '⚖️',
  },
  MISSING_IN_PROCESSOR: {
    label: 'Ghost Order (No Payment Received)',
    desc: 'Order was recorded in your store, but the payment gateway never received or captured any money.',
    icon: '👻',
  },
  MISSING_BANK_SETTLEMENT: {
    label: 'Missing Bank Deposit',
    desc: 'Payment app collected customer cash, but the batch never landed in your bank statement.',
    icon: '🏦',
  },
  AMOUNT_MISMATCH: {
    label: 'Bank Payout Shortfall',
    desc: 'The payout amount deposited in your bank was less than what the payment gateway captured.',
    icon: '📉',
  },
  AMBIGUOUS_MATCH: {
    label: 'Deposit Amount Difference',
    desc: 'Bank deposit differed from expected payout total and requires verification.',
    icon: '⚠️',
  },
  MISSING_IN_INTERNAL: {
    label: 'Orphan Payment (No Store Order)',
    desc: 'Money was captured on the payment app, but your store system has no order record for it.',
    icon: '❓',
  },
  DUPLICATE_INTERNAL: {
    label: 'Double-Billed Order',
    desc: 'Your store system accidentally saved the same order ID twice.',
    icon: '📑',
  },
  DUPLICATE_BANK_SETTLEMENT: {
    label: 'Duplicate Bank Credit',
    desc: 'Your bank statement shows two payouts for the same settlement batch.',
    icon: '🔄',
  },
  CURRENCY_CONVERSION_ERROR: {
    label: 'Foreign Currency Rate Issue',
    desc: 'Discrepancy caused by currency exchange rate fluctuations between billing and bank payout.',
    icon: '💱',
  },
  PARTIALLY_REFUNDED_CORRECTLY: {
    label: 'Partial Refund (Verified)',
    desc: 'Customer was refunded part of the order amount, and the gateway deduction matches correctly.',
    icon: '↩️',
  },
  FULLY_REFUNDED_CORRECTLY: {
    label: 'Full Refund (Verified)',
    desc: 'Order was cancelled and 100% refunded to the customer. Verified and accounted for.',
    icon: '🔄',
  },
  REFUND_TIMING_DISCREPANCY: {
    label: 'Refund in Transit',
    desc: 'Refund was initiated but has not yet completed the bank cycle.',
    icon: '⏳',
  },
  MATCHED: {
    label: 'Fully Paid & Verified in Bank',
    desc: 'Store bill, payment gateway capture, and bank payout match down to the exact penny.',
    icon: '✅',
  },
};

export const RETAILER_STATUSES: Record<string, { label: string; color: string; advice: string }> = {
  AUTO_RESOLVE: {
    label: 'Auto-Verified & Safe',
    color: 'emerald',
    advice: 'No action needed. ReconcileX verified the math and safely approved this record.',
  },
  MATCHED: {
    label: 'Fully Paid & Settled',
    color: 'emerald',
    advice: 'All money is in your bank account.',
  },
  NEEDS_REVIEW: {
    label: 'Action Needed (Check Details)',
    color: 'amber',
    advice: 'Review the discrepancy. You may need to verify with the customer or check payment status.',
  },
  EXCEPTION: {
    label: 'Money Gap (Claim / Dispute)',
    color: 'rose',
    advice: 'Discrepancy confirmed. You can request a fee refund or dispute with your payment provider.',
  },
};

export function getRetailerCause(rawCause?: string): { label: string; desc: string; icon: string } {
  if (!rawCause) {
    return {
      label: 'Clean Match',
      desc: 'No discrepancy detected.',
      icon: '✅',
    };
  }
  const clean = rawCause.toUpperCase().trim();
  return (
    RETAILER_ROOT_CAUSES[clean] || {
      label: clean.replace(/_/g, ' '),
      desc: 'Review transaction breakdown for details.',
      icon: '🔍',
    }
  );
}

export function getRetailerStatus(rawStatus?: string) {
  if (!rawStatus) return RETAILER_STATUSES.AUTO_RESOLVE;
  const clean = rawStatus.toUpperCase().trim();
  return RETAILER_STATUSES[clean] || RETAILER_STATUSES.NEEDS_REVIEW;
}

/**
 * Returns plain English merchant-friendly explanation of what happened to a transaction or payout
 */
export function getMerchantWhatHappened(record: {
  recon_level: string;
  work_key?: string;
  final_status: string;
  final_root_cause?: string;
  ml_prediction?: string;
  gross_diff?: number;
  settlement_diff?: number;
  currency?: string;
}): string {
  const isOrder = record.recon_level === 'L1_ORDER';
  const diff = isOrder ? Math.abs(record.gross_diff || 0) : Math.abs(record.settlement_diff || 0);
  const isClean = diff <= 0.01 && (record.final_status === 'AUTO_RESOLVE' || record.final_status === 'MATCHED');

  if (isClean) {
    return isOrder ? 'Payment matched' : 'Bank deposit matched';
  }

  // If bank deposit has a difference
  if (!isOrder && diff > 0.01) {
    const curr = record.currency === 'INR' || !record.currency ? '₹' : record.currency + ' ';
    return `Bank deposit is ${curr}${Math.round(diff).toLocaleString()} lower than expected.`;
  }

  const raw = (record.final_root_cause || record.ml_prediction || '').toUpperCase().trim();
  if (raw.includes('FEE')) return 'Payment fee looks different';
  if (raw.includes('DUPLICATE')) return 'Possible duplicate payment';
  if (raw.includes('MISSING_IN_PROCESSOR') || raw.includes('MISSING_PROCESSOR')) return 'Payment not found';
  if (raw.includes('MISSING_BANK')) return 'Bank deposit not found';
  if (raw.includes('CURRENCY')) return 'Currency doesn’t match';
  if (raw.includes('DELAY') || raw.includes('LATE')) return 'Bank deposit is delayed';
  if (raw.includes('AMBIGUOUS')) return 'Couldn’t confirm';
  if (raw.includes('AMOUNT')) return 'Amount doesn’t match';

  return diff > 0.01 ? 'Amount doesn’t match' : 'Payment matched';
}

/**
 * Returns clean merchant-friendly status badge info (Matched, Needs Review, Issue)
 */
export function getMerchantStatusBadge(final_status: string): {
  label: 'Matched' | 'Needs Review' | 'Issue';
  badgeClass: string;
  icon: string;
} {
  const status = (final_status || '').toUpperCase().trim();
  if (status === 'AUTO_RESOLVE' || status === 'MATCHED') {
    return {
      label: 'Matched',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      icon: '✅',
    };
  }
  if (status === 'EXCEPTION') {
    return {
      label: 'Issue',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      icon: '🔴',
    };
  }
  return {
    label: 'Needs Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    icon: '🟡',
  };
}

/**
 * Generates ready-to-copy dispute email for payment gateway support
 */
export function generateSupportDisputeEmail(record: {
  work_key: string;
  currency: string;
  expected_amount: number;
  settled_amount: number;
  fee_amount: number;
  unexplained_amount?: number;
  difference: number;
  predicted_cause?: string;
}): string {
  const cause = record.predicted_cause || 'Fee Discrepancy';
  return `Subject: Dispute / Clarification Request for Transaction [${record.work_key}]

Hello Payment Gateway Support Team,

I am writing to dispute a discrepancy detected on merchant transaction ${record.work_key}.

Summary of Transaction:
• Order Reference: ${record.work_key}
• Gross Billed Amount: ${record.currency} ${record.expected_amount.toFixed(2)}
• Gross Captured by Gateway: ${record.currency} ${record.settled_amount.toFixed(2)}
• Fee Deducted: ${record.currency} ${record.fee_amount.toFixed(2)}
• Discrepancy / Overcharge: ${record.currency} ${Math.abs(record.difference).toFixed(2)}
• Flagged Issue: ${cause}

Based on our agreed merchant pricing tier (2.9% + $0.30), the fee deducted exceeds the contractual formula. Please review this transaction and credit the excess fee variance back to our merchant settlement account.

Thank you,
Store Finance & Operations
ReconcileX Audit Ref: ${record.work_key}`;
}
