'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Coins,
  CheckCircle2,
  Clock,
  Download,
  Check,
  ArrowRight,
  HelpCircle,
  Building,
  CreditCard,
  Landmark,
} from 'lucide-react';
import { StatusBadge, LevelBadge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { RecordDetail } from '@/lib/types';

export default function ExceptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;

  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewedSuccess, setReviewedSuccess] = useState(false);

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
          <p className="text-xs font-semibold text-slate-500">Loading investigation case...</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Investigation Record Not Found</h2>
          <p className="text-xs text-rose-700">{error || 'Unknown record identifier'}</p>
          <Link
            href="/exceptions"
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exceptions Queue</span>
          </Link>
        </div>
      </div>
    );
  }

  const isL1 = record.recon_level === 'L1_ORDER';

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      {/* Top Navigation Bar */}
      <div className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 text-sm">{record.work_key}</span>
            <LevelBadge level={record.recon_level} />
            <StatusBadge status={record.final_status} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setReviewedSuccess(true);
              setTimeout(() => setReviewedSuccess(false), 3000);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-all ${
              reviewedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {reviewedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Reviewed &amp; Certified</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sign-Off Decision</span>
              </>
            )}
          </button>
        </div>
      </div>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Hero Section: 3-Source Comparison Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span>Multi-Source Ledger Comparison</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              Match Method: {record.match_method || 'EXACT'} ({((record.match_score || 1) * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 text-xs">
            {/* Source 1: Internal Ledger */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <Building className="w-4 h-4 text-blue-600" />
                <span>1. Merchant Internal Ledger</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Payment / Order ID</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {record.internal_payment_id || record.work_key}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Gross Ledger Amount</span>
                  <span className="font-mono font-extrabold text-slate-900 text-lg">
                    {record.currency} {record.expected_amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Currency Match</span>
                  <span className={`font-semibold ${record.currency_match ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {record.currency_match ? 'Matched' : 'Currency Mismatch Detected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Source 2: Processor Transactions */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>2. Payment Processor (Gateway)</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Processor Txn ID</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {record.processor_transaction_id || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Gross Captured</span>
                  <span className="font-mono font-extrabold text-slate-900 text-lg">
                    {record.currency} {record.settled_amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Configured Fee</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {record.fee_amount > 0 ? `${record.currency} ${record.fee_amount.toFixed(2)}` : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Source 3: Bank Settlement */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <Landmark className="w-4 h-4 text-emerald-600" />
                <span>3. Bank Settlement Deposit</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Batch / Entry ID</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {record.settlement_batch_id || record.bank_entry_id || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Net Credited</span>
                  <span className="font-mono font-extrabold text-slate-900 text-lg">
                    {record.currency} {(record.settled_amount - record.fee_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Settlement Window</span>
                  <span className="font-semibold text-slate-700">
                    {record.settlement_delay_days ? `${record.settlement_delay_days} days` : 'Within Window (T+2)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Discrepancy Waterfall & ML Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Discrepancy Waterfall */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>Financial Discrepancy Waterfall</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">Audit Trail Breakdown</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Expected Ledger Amount</span>
                <span className="font-mono font-bold text-slate-900">
                  {record.currency} {record.expected_amount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Actual Settled / Captured</span>
                <span className="font-mono font-bold text-slate-900">
                  {record.currency} {record.settled_amount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-rose-600 font-bold">Total Gross Difference</span>
                <span className="font-mono font-extrabold text-rose-600">
                  {record.currency} {Math.abs(record.difference).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 pl-4 text-slate-500">
                <span>(-) Processor Fee Deduction</span>
                <span className="font-mono">
                  {record.currency} {record.fee_amount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 pl-4 text-slate-500">
                <span>(-) Linked Refund Amount</span>
                <span className="font-mono">
                  {record.currency} {record.refund_amount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900">Unexplained Residual Variance</span>
                <span
                  className={`font-mono font-extrabold text-sm ${
                    record.unexplained_amount > 0.01 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {record.currency} {record.unexplained_amount.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              {record.unexplained_amount > 0.01
                ? `Evidence cannot account for ${record.currency} ${record.unexplained_amount.toFixed(2)}. Escalated to controller review.`
                : 'Variance is completely accounted for by verified processor fee and refund records.'}
            </p>
          </div>

          {/* Machine Learning Root-Cause Classification */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Tabular ML Classification (XGBoost)
                </h3>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-700">
                  Supervised Model
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Predicted Root Cause:</span>
                  <span className="font-bold text-sm text-slate-900">
                    {record.ml_prediction || 'UNKNOWN'}
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Model Confidence:</span>
                    <span className="font-mono font-bold text-blue-600">
                      {record.ml_confidence !== undefined
                        ? `${(record.ml_confidence * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(record.ml_confidence || 0.5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Ground Truth Validation */}
              {record.ground_truth_outcome && (
                <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-900 font-bold">
                    <span>ReconRiver Ground Truth Benchmark:</span>
                    <span className="font-mono">{record.ground_truth_outcome}</span>
                  </div>
                  {record.ground_truth_explanation && (
                    <p className="text-emerald-800 text-[11px] leading-relaxed">
                      {record.ground_truth_explanation}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Policy Enforcement Statement */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Policy Engine Justification:</span>
              <p className="text-slate-600 leading-relaxed">
                {record.policy_reason || 'Record evaluated against zero-force matching policy.'}
              </p>
            </div>
          </div>
        </div>

        {/* AI Investigator Section (Gemini Reasoning) */}
        {record.ai_investigated ? (
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 rounded-2xl border border-indigo-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-indigo-950">AI Investigator (Gemini 2.0 Flash)</h3>
                  <p className="text-xs text-indigo-700">Auditable unstructured evidence synthesis</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-800 font-medium">LLM Recommendation:</span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-900 font-bold text-xs rounded-full border border-indigo-300">
                  {record.ai_decision || 'NEEDS_REVIEW'}
                </span>
              </div>
            </div>

            {/* AI Evidence points */}
            {record.ai_evidence && record.ai_evidence.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                  Supporting Evidence:
                </span>
                <ul className="space-y-1.5 text-xs text-indigo-950">
                  {record.ai_evidence.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-indigo-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Action */}
            {record.ai_recommended_action && (
              <div className="p-3.5 bg-indigo-600/10 border border-indigo-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-indigo-900">Recommended Controller Action:</span>
                <p className="text-indigo-950 font-medium leading-relaxed">
                  {record.ai_recommended_action}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">Deterministic Resolution</span>
                <p className="text-slate-500 text-[11px]">
                  This case met the high-confidence deterministic criteria and did not require LLM escalation, preserving operational cost and latency.
                </p>
              </div>
            </div>
            <span className="font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-bold">
              0 LLM Tokens Spent
            </span>
          </div>
        )}

        {/* Audit Trail Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Immutable Audit Trail Timeline</span>
          </h3>

          <div className="space-y-3 relative pl-6 border-l-2 border-slate-200 text-xs">
            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white" />
              <div className="font-bold text-slate-900">Ingested &amp; Normalized</div>
              <div className="text-slate-500 text-[11px]">IDs standardized, gross amounts parsed, timestamps UTC converted</div>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white" />
              <div className="font-bold text-slate-900">Multi-Source Cross-Matching</div>
              <div className="text-slate-500 text-[11px]">
                {record.recon_level === 'L1_ORDER'
                  ? 'Matched internal ledger with processor captures by merchant_order_id'
                  : 'Aggregated processor batch net total and joined bank credited amount'}
              </div>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-white" />
              <div className="font-bold text-slate-900">ML Classification (XGBoost)</div>
              <div className="text-slate-500 text-[11px]">
                Classified as <span className="font-mono font-bold text-slate-800">{record.ml_prediction}</span> with {((record.ml_confidence || 0) * 100).toFixed(1)}% confidence
              </div>
            </div>

            {record.ai_investigated && (
              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-white" />
                <div className="font-bold text-slate-900">AI Investigation (Gemini)</div>
                <div className="text-slate-500 text-[11px]">
                  Unstructured evidence synthesized; recommended <span className="font-bold">{record.ai_decision}</span>
                </div>
              </div>
            )}

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white" />
              <div className="font-bold text-slate-900">Final Policy Decision</div>
              <div className="text-slate-500 text-[11px]">
                Status resolved to <span className="font-bold text-slate-800">{record.final_status}</span>: {record.policy_reason}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
