'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  Coins,
  ShoppingBag,
  CreditCard,
  Landmark,
  ArrowRight,
  ExternalLink,
  UploadCloud,
  Play,
  FileCheck2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { CSVUploader } from '@/components/upload/CSVUploader';
import { api } from '@/lib/api';
import { BatchSummary, ReconRecordListItem } from '@/lib/types';
import { getRetailerCause } from '@/lib/retailerTerms';

export default function ControlCenterPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null);
  const [records, setRecords] = useState<ReconRecordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRunningCardDemo, setIsRunningCardDemo] = useState(false);

  const loadData = async (targetBatchId?: string) => {
    try {
      setIsLoading(true);
      const list = await api.getBatches();
      setBatches(list);

      // Only load a batch if a targetBatchId is explicitly specified
      const batchToLoad = targetBatchId || selectedBatch?.batch_id;
      if (batchToLoad) {
        const found = list.find((b) => b.batch_id === batchToLoad);
        if (found) {
          const summary = await api.getBatchSummary(found.batch_id);
          setSelectedBatch(summary);

          const recordsRes = await api.getRecords(found.batch_id, { limit: 200 });
          setRecords(recordsRes.records || []);
          return;
        }
      }

      // Default initial state: start on the clean 'Ready to Verify' screen
      setSelectedBatch(null);
      setRecords([]);
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
      setSelectedBatch(null);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBatchSelected = async (batchId: string) => {
    try {
      setIsLoading(true);
      const summary = await api.getBatchSummary(batchId);
      setSelectedBatch(summary);
      const recordsRes = await api.getRecords(batchId, { limit: 200 });
      setRecords(recordsRes.records || []);
    } catch (err) {
      console.error('Failed to switch batch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute Money-Flow Totals
  const orderRecords = records.filter((r) => r.recon_level === 'L1_ORDER');
  const settlementRecords = records.filter((r) => r.recon_level === 'L2_SETTLEMENT');

  const storeSalesTotal = orderRecords.reduce((acc, r) => acc + (r.internal_gross || 0), 0);
  const gatewayFeesTotal = orderRecords.reduce((acc, r) => acc + (r.fee_amount || 0), 0);
  const gatewayNetTotal = storeSalesTotal - gatewayFeesTotal;
  const bankSettledTotal = settlementRecords.reduce((acc, r) => acc + (r.credited_amount || 0), 0);
  const expectedBankTotal =
    settlementRecords.reduce((acc, r) => acc + (r.expected_net_total || 0), 0) || gatewayNetTotal;

  // Differences and gaps
  const payoutGaps = settlementRecords.filter((r) => (r.settlement_diff || 0) > 0.01);
  const totalIssuesCount = (selectedBatch?.exception_count || 0) + (selectedBatch?.needs_review_count || 0);

  // Filter top unresolved discrepancies (payout gaps first, then order discrepancies)
  const unresolvedIssues = records
    .filter((r) => r.final_status !== 'AUTO_RESOLVE')
    .sort((a, b) => (b.settlement_diff || b.gross_diff || 0) - (a.settlement_diff || a.gross_diff || 0))
    .slice(0, 6);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      {/* 1. Header */}
      <Header
        currentBatchId={selectedBatch?.batch_id}
        onBatchChange={handleBatchSelected}
        onRefresh={() => loadData(selectedBatch?.batch_id)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onClear={() => {
          setBatches([]);
          setSelectedBatch(null);
          setRecords([]);
        }}
      />

      <CSVUploader
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={async (id) => {
          await loadData(id);
          await handleBatchSelected(id);
        }}
      />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-7">
        {selectedBatch ? (
          <>
            {/* 2. Three Key Cash Cards (Sales, Bank Deposits, Money Gaps) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Total Sales */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Customer Sales Billed
                  </span>
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <ShoppingBag className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">
                    ₹{Math.round(storeSalesTotal).toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-blue-600 mt-1">
                    {selectedBatch.l1_total} store orders billed to customers
                  </div>
                </div>
              </div>

              {/* Card 2: Money in Bank */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Cash in Your Bank
                  </span>
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Landmark className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">
                    ₹{Math.round(bankSettledTotal).toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-emerald-600 mt-1">
                    Credited across {selectedBatch.l2_total} bank payout deposits
                  </div>
                </div>
              </div>

              {/* Card 3: Missing Cash to Review */}
              <div className={`rounded-2xl p-6 border shadow-xs transition-all space-y-3 ${
                selectedBatch.unresolved_amount > 0
                  ? 'bg-white border-rose-200/90'
                  : 'bg-white border-emerald-200/90'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Missing Cash to Review
                  </span>
                  <span className={`p-2 rounded-xl ${
                    selectedBatch.unresolved_amount > 0
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {selectedBatch.unresolved_amount > 0 ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </span>
                </div>
                <div>
                  <div className={`text-3xl font-black tracking-tight ${
                    selectedBatch.unresolved_amount > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    ₹{Math.round(selectedBatch.unresolved_amount).toLocaleString()}
                  </div>
                  <div className={`text-xs font-medium mt-1 ${
                    selectedBatch.unresolved_amount > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {selectedBatch.unresolved_amount > 0
                      ? payoutGaps.length > 0
                        ? `${payoutGaps.length} bank payout deposit${payoutGaps.length === 1 ? '' : 's'} short`
                        : `${totalIssuesCount} discrepancy items need review`
                      : 'All sales and payouts accounted for ✓'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Transparent Cash Journey Tracker */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    How Your Money Added Up
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track every rupee from customer order billing to final bank deposit credit.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Verification Active
                </span>
              </div>

              {/* 4 Pipeline Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-500 font-medium block">1. Customer Billed</span>
                  <span className="text-xl font-black text-slate-900 block">
                    ₹{Math.round(storeSalesTotal).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500">{selectedBatch.l1_total} store orders placed</span>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-500 font-medium block">2. Gateway Fees</span>
                  <span className="text-xl font-black text-slate-900 block">
                    -₹{Math.round(gatewayFeesTotal).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500">Payment app commission</span>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
                  <span className="text-blue-800 font-medium block">3. Expected in Bank</span>
                  <span className="text-xl font-black text-blue-950 block">
                    ₹{Math.round(expectedBankTotal).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-blue-700">Net payout owed to you</span>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                  <span className="text-emerald-800 font-medium block">4. Received in Bank</span>
                  <span className="text-xl font-black text-emerald-950 block">
                    ₹{Math.round(bankSettledTotal).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-700">{selectedBatch.l2_total} payout deposits</span>
                </div>
              </div>

              {/* Math Summary Bar */}
              {selectedBatch.unresolved_amount > 0 ? (
                <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <span className="font-semibold text-rose-900">
                      Missing Cash: ₹{Math.round(selectedBatch.unresolved_amount).toLocaleString()}
                    </span>
                    <span className="text-rose-700 hidden md:inline">
                      (Gateway owed ₹{Math.round(expectedBankTotal).toLocaleString()}, but bank received ₹{Math.round(bankSettledTotal).toLocaleString()})
                    </span>
                  </div>
                  <span className="font-bold text-rose-800 text-[11px]">
                    {payoutGaps.length > 0 ? `${payoutGaps.length} Bank Payouts Short` : 'Action Required'}
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">
                    Exact Match — All ₹{Math.round(expectedBankTotal).toLocaleString()} expected was received in your bank.
                  </span>
                </div>
              )}
            </div>

            {/* 4. Bank Deposits (If any settlement records exist) */}
            {settlementRecords.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Bank Deposits</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                        {settlementRecords.length} Deposits
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comparing payment gateway settlement batches against cash credited in your bank statement.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-5">Payout Batch ID</th>
                        <th className="py-3 px-4">Expected to Reach Bank</th>
                        <th className="py-3 px-4">Bank Received</th>
                        <th className="py-3 px-4">Difference / Gap</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {settlementRecords.map((batchRec) => {
                        const hasDiff = (batchRec.settlement_diff || 0) > 0.01;
                        return (
                          <tr key={batchRec.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-slate-900">
                              <span className="font-mono">{batchRec.work_key}</span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              ₹{Math.round(batchRec.expected_net_total || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              ₹{Math.round(batchRec.credited_amount || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 font-bold">
                              {hasDiff ? (
                                <span className="text-rose-600">
                                  -₹{Math.round(batchRec.settlement_diff).toLocaleString()} Short
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-medium">₹0 (Exact Match)</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {hasDiff ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Deposit Shortfall</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Matched ✓</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Link
                                href={`/exceptions/${batchRec.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg text-xs transition-colors"
                              >
                                <span>Investigate</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Issues Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Issues Need Your Attention</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                      {selectedBatch.exception_count + selectedBatch.needs_review_count}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Orders with fee differences or missing payment gateway records requiring attention.
                  </p>
                </div>

                <Link
                  href="/exceptions"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                >
                  <span>View All Issues</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {unresolvedIssues.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-5">Order / Reference</th>
                        <th className="py-3 px-4">Difference</th>
                        <th className="py-3 px-4">Issue Type</th>
                        <th className="py-3 px-5">Explanation</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {unresolvedIssues.map((issue) => {
                        const cause = getRetailerCause(issue.final_root_cause);
                        const issueAmount =
                          issue.recon_level === 'L2_SETTLEMENT'
                            ? (issue.settlement_diff || 0)
                            : (issue.gross_diff !== 0 ? issue.gross_diff : (issue.fee_amount && issue.final_root_cause?.includes('FEE') ? issue.fee_amount : 0));

                        return (
                          <tr key={issue.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{issue.work_key}</span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {issue.recon_level === 'L1_ORDER' ? 'Order' : 'Bank Deposit'}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-bold text-rose-600">
                              ₹{Math.abs(Math.round(issueAmount)).toLocaleString()}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                                <span>{cause.icon}</span>
                                <span>{cause.label}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-5 text-slate-500 max-w-xs truncate" title={cause.desc}>
                              {cause.desc}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <Link
                                href={`/exceptions/${issue.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg text-xs transition-colors"
                              >
                                <span>View</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                  <span className="font-bold text-slate-800">All checks are 100% clean and safe!</span>
                  <span>No unresolved payment gaps or differences found.</span>
                </div>
              )}
            </div>

            {/* 5. One Compact Reconciliation Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">
                    Reconciliation Completed
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {selectedBatch.l1_matched} of {selectedBatch.l1_total} orders matched • {selectedBatch.l2_matched} of {selectedBatch.l2_total} bank deposits matched
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="text-right hidden md:block">
                  <span className="text-[11px] text-slate-400 block">Difference to Review</span>
                  <span className="font-bold text-rose-600 text-sm">
                    ₹{Math.round(selectedBatch.unresolved_amount).toLocaleString()}
                  </span>
                </div>

                <a
                  href={api.getExportUrl(selectedBatch.batch_id, 'csv')}
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors shrink-0"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export CSV</span>
                </a>

                <Link
                  href="/reconciliation"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors shrink-0"
                >
                  <span>All Orders &amp; Bank Deposits</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </>
        ) : (
          /* Clean Minimal Empty State when no batch is loaded */
          <div className="bg-white border border-slate-200/80 rounded-2xl p-10 shadow-xs text-center space-y-6 max-w-2xl mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">
                Ready to Verify Store Cash &amp; Fees
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Upload your store sales, payment gateway records, and bank statements to verify every rupee with zero manual work.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload 3 Files</span>
              </button>

              <button
                onClick={async () => {
                  try {
                    setIsRunningCardDemo(true);
                    const res = await api.runDemoBatch();
                    if (res.batch_id) {
                      await loadData(res.batch_id);
                      await handleBatchSelected(res.batch_id);
                    }
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    alert(`Run failed: ${msg}`);
                  } finally {
                    setIsRunningCardDemo(false);
                  }
                }}
                disabled={isRunningCardDemo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isRunningCardDemo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                    <span>Reconciling...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-slate-600" />
                    <span>Run Reconciliation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
