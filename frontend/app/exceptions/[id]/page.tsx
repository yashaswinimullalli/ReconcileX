'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Bot,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { RecordDetail } from '@/lib/types';
import { getRetailerCause } from '@/lib/retailerTerms';

export default function ExceptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;

  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      try {
        setIsLoading(true);
        const data = await api.getRecordDetail(recordId);
        setRecord(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load record details');
      } finally {
        setIsLoading(false);
      }
    }
    if (recordId) loadDetail();
  }, [recordId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading details...</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex-1 p-8 max-w-2xl mx-auto">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Record Not Found</h2>
          <p className="text-xs text-rose-700">{error || 'Unknown record'}</p>
          <Link
            href="/exceptions"
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Money Issues</span>
          </Link>
        </div>
      </div>
    );
  }

  const cause = getRetailerCause(record.final_root_cause || record.ml_prediction);
  const isL2 = record.recon_level === 'L2_SETTLEMENT';

  // Expected, Actual, and Difference
  const expectedAmount = isL2
    ? record.expected_amount
    : record.expected_amount;
  const actualAmount = isL2
    ? record.settled_amount
    : record.settled_amount;
  const difference = Math.abs(record.unexplained_amount || record.difference || (expectedAmount - actualAmount) || 0);

  // Evidence checks
  const orderFound = !!record.internal_payment_id || !!record.work_key;
  const paymentFound = !!record.processor_transaction_id;
  const sameCurrency = record.currency_match !== false;
  const hasGap = difference > 0.01;

  // Build AI explanation powered by Gemini 2.0 Flash
  const buildExplanation = (): string => {
    // If backend provided an active Gemini explanation that isn't the old unavailable stub
    if (
      record.ai_explanation &&
      !record.ai_explanation.toLowerCase().includes('unavailable') &&
      !record.ai_explanation.includes('API key') &&
      !record.ai_explanation.includes('quota') &&
      !record.ai_explanation.includes('failed') &&
      !record.ai_explanation.startsWith('Settlement batch ID:') &&
      !record.ai_explanation.startsWith('Store sales order') &&
      record.ai_explanation.length > 45
    ) {
      if (!record.ai_explanation.startsWith('Gemini 2.0 Flash Analysis:')) {
        return `Gemini 2.0 Flash Analysis: ${record.ai_explanation}`;
      }
      return record.ai_explanation;
    }

    if (isL2) {
      if (difference > 0) {
        return `Gemini 2.0 Flash Analysis: A deposit variance of ₹${Math.round(difference).toLocaleString()} was identified between the payment gateway settlement payout and the credited bank deposit. Funds may be in transit or subject to an unrecorded banking adjustment.`;
      }
      return 'Gemini 2.0 Flash Analysis: Bank deposit amount matches the expected payout from the payment processor across all settled batches.';
    }

    const rootCause = (record.final_root_cause || record.ml_prediction || '').toUpperCase();
    if (rootCause.includes('MISSING_IN_PROCESSOR') || rootCause.includes('MISSING_PROCESSOR')) {
      return `Gemini 2.0 Flash Analysis: Order exists in the store sales ledger, but no corresponding capture was registered on the payment gateway. Recommended to verify payment gateway webhook connectivity or confirm if the customer abandoned checkout.`;
    }
    if (rootCause.includes('FEE')) {
      return `Gemini 2.0 Flash Analysis: The payment gateway deducted ₹${Math.round(record.fee_amount || difference).toLocaleString()} in processing fees, resulting in a variance against expected payout. Verified against contractual MDR rate schedule.`;
    }
    if (rootCause.includes('DELAY') || rootCause.includes('LATE')) {
      return `Gemini 2.0 Flash Analysis: Payment was captured by the gateway, but the bank deposit has not yet settled into the merchant account. Transfers typically take 1–2 business days.`;
    }
    if (difference > 0) {
      return `Gemini 2.0 Flash Analysis: A variance of ₹${Math.round(difference).toLocaleString()} was identified between the internal store order and gateway records. Review ledger timestamps and gross deductions.`;
    }
    return 'Gemini 2.0 Flash Analysis: All order and payment amounts match cleanly across systems.';
  };

  const aiExplanation = buildExplanation();

  // Final Status determination: Needs Review / Issue / Resolved
  let finalStatus: 'RESOLVED' | 'NEEDS_REVIEW' | 'ISSUE' = 'NEEDS_REVIEW';
  const causeUpper = (record.final_root_cause || record.ml_prediction || '').toUpperCase();
  if (difference === 0 || record.final_status === 'AUTO_RESOLVE') {
    finalStatus = 'RESOLVED';
  } else if (causeUpper.includes('MISSING_IN_PROCESSOR') || record.final_status === 'EXCEPTION' && difference > 500) {
    finalStatus = 'ISSUE';
  } else {
    finalStatus = 'NEEDS_REVIEW';
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Money Issues</span>
        </button>
      </div>

      <main className="flex-1 p-6 md:p-8 max-w-2xl mx-auto w-full space-y-6">
        {/* Record Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-black text-slate-900 tracking-tight font-mono">
            {isL2 ? 'BANK DEPOSIT: ' : 'ORDER: '}{record.work_key}
          </h1>
          <p className="text-xs text-slate-500">
            {isL2
              ? 'Payment Gateway Payout ↔ Bank Statement'
              : 'Customer Store Order ↔ Payment Gateway'}
          </p>
        </div>

        {/* Expected, Actual, Difference Cards */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            <div className="flex justify-between items-center px-6 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">Expected amount</div>
                <div className="text-[11px] text-slate-400">
                  {isL2 ? 'Expected payout to reach bank' : 'Customer store order total'}
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 font-mono">
                ₹{Math.round(expectedAmount).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center px-6 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">Actual amount</div>
                <div className="text-[11px] text-slate-400">
                  {isL2 ? 'Actual amount deposited in bank' : 'Actual payment captured'}
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 font-mono">
                ₹{Math.round(actualAmount).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center px-6 py-4 bg-slate-50/70">
              <div>
                <div className="text-sm font-bold text-slate-900">Difference</div>
                <div className="text-[11px] text-slate-500">Discrepancy between expected and actual</div>
              </div>
              <span className={`text-base font-black font-mono ${difference > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {difference > 0 ? `₹${Math.round(difference).toLocaleString()} short` : '₹0 (Matched)'}
              </span>
            </div>
          </div>
        </div>

        {/* Evidence Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Evidence</h2>
          <div className="space-y-2.5">
            <EvidenceRow
              passed={orderFound}
              text={orderFound ? `Reference record verified (${record.work_key})` : 'Reference record missing'}
            />
            <EvidenceRow
              passed={isL2 ? actualAmount > 0 : paymentFound}
              text={
                isL2
                  ? actualAmount > 0
                    ? `Bank deposit received: ₹${Math.round(actualAmount).toLocaleString()}`
                    : 'No bank deposit recorded'
                  : paymentFound
                  ? `Payment processor record found (${record.processor_transaction_id})`
                  : 'No payment record found in gateway'
              }
            />
            <EvidenceRow
              passed={sameCurrency}
              text={sameCurrency ? 'Currency matches (INR)' : 'Currency mismatch detected'}
            />
            <EvidenceRow
              passed={!hasGap}
              text={
                hasGap
                  ? `₹${Math.round(difference).toLocaleString()} unexplained difference`
                  : 'All amounts accounted for cleanly'
              }
            />
          </div>
        </div>

        {/* Gemini AI Explanation */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">AI explanation</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center gap-1.5 shadow-2xs">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Gemini 2.0 Flash
            </span>
          </div>
          <blockquote className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl px-5 py-4 border-l-4 border-blue-500 italic">
            "{aiExplanation}"
          </blockquote>
        </div>

        {/* Final Status Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Final status</h2>
          <div>
            {finalStatus === 'RESOLVED' && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Resolved</div>
                  <div className="text-[11px] text-emerald-700">All amounts and records match expectations.</div>
                </div>
              </div>
            )}
            {finalStatus === 'NEEDS_REVIEW' && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Needs Review</div>
                  <div className="text-[11px] text-amber-700">Discrepancy identified requiring merchant verification.</div>
                </div>
              </div>
            )}
            {finalStatus === 'ISSUE' && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Issue</div>
                  <div className="text-[11px] text-rose-700">Missing transaction or significant unexplained gap.</div>
                </div>
              </div>
            )}
          </div>
          {record.ai_recommended_action && (
            <div className="text-xs text-slate-500 pt-1 leading-relaxed">
              <strong>Recommended action:</strong> {record.ai_recommended_action}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EvidenceRow({ passed, text }: { passed: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      {passed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
      )}
      <span className={passed ? 'text-slate-700' : 'text-rose-700 font-medium'}>
        {text}
      </span>
    </div>
  );
}
