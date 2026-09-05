'use client';

import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Building2,
  Calendar,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { BatchSummary } from '@/lib/types';

export default function ReportsPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const list = await api.getBatches();
        setBatches(list);
        if (list.length > 0) {
          setSelectedBatchId(list[0].batch_id);
        }
      } catch (err) {
        console.error('Failed to load reports summary:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  // Computed metrics directly from actual data
  const ordersChecked = selectedBatch ? (selectedBatch.l1_total ?? 0) : 0;
  const bankDepositsChecked = selectedBatch ? (selectedBatch.l2_total ?? 0) : 0;
  const totalRecords = selectedBatch ? (selectedBatch.total_records ?? 0) : 0;
  const matchRate = selectedBatch ? Math.round((selectedBatch.match_rate ?? 0) * 100) : 0;
  const issuesFound = selectedBatch
    ? (selectedBatch.exception_count ?? 0) + (selectedBatch.needs_review_count ?? 0)
    : 0;
  const amountNeedingReview = selectedBatch ? (selectedBatch.unresolved_amount ?? 0) : 0;

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 min-h-screen">
      <Header />

      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
        {/* Page Title & Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Reports
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Download reconciliation and issues reports for your store and accountant.
              </p>
            </div>
          </div>

          {/* Clean Upload / Date Selector (if multiple exist) */}
          {batches.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                aria-label="Select reconciliation report date"
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.created_at
                      ? new Date(b.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : b.batch_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs font-semibold">Loading report data...</p>
          </div>
        ) : !selectedBatch || totalRecords === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No reconciliation results available</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              No reconciliation results available. Run a reconciliation first.
            </p>
          </div>
        ) : (
          <>
            {/* 1. RECONCILIATION SUMMARY */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Reconciliation Summary
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overview of verified transactions and items requiring investigation.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Metric 1: Orders checked */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                    <span>Orders checked</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {ordersChecked.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400">Customer store sales</div>
                </div>

                {/* Metric 2: Bank deposits checked */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Bank deposits checked</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {bankDepositsChecked.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400">Payout settlements</div>
                </div>

                {/* Metric 3: Match rate */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="text-xs text-slate-500 font-medium">
                    Match rate
                  </div>
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {matchRate}%
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    Cleanly matched
                  </div>
                </div>

                {/* Metric 4: Issues found */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Issues found</span>
                  </div>
                  <div
                    className={`text-2xl font-black font-mono ${
                      issuesFound > 0 ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {issuesFound.toLocaleString()}
                  </div>
                  <div
                    className={`text-[11px] font-medium ${
                      issuesFound > 0 ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    {issuesFound > 0 ? 'Needs attention' : 'Zero issues'}
                  </div>
                </div>

                {/* Metric 5: Amount needing review */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1 col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-500 font-medium">
                    Amount needing review
                  </div>
                  <div
                    className={`text-2xl font-black font-mono ${
                      amountNeedingReview > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    ₹{Math.round(amountNeedingReview).toLocaleString()}
                  </div>
                  <div
                    className={`text-[11px] font-medium ${
                      amountNeedingReview > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {amountNeedingReview > 0 ? 'Discrepancy total' : 'All balanced'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2 & 3. DOWNLOADABLE REPORTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Report 1: Full Reconciliation Report */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {totalRecords} {totalRecords === 1 ? 'row' : 'rows'} ready
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Reconciliation Report
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Complete results for orders, payments and bank deposits ({ordersChecked} orders, {bankDepositsChecked} bank deposits).
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={selectedBatchId && totalRecords > 0 ? api.getExportUrl(selectedBatchId, 'csv', 'all') : '#'}
                    download={`reconciliation_report_${selectedBatchId.slice(0, 8)}.csv`}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors ${
                      selectedBatchId && totalRecords > 0
                        ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 pointer-events-none cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Reconciliation CSV</span>
                  </a>
                </div>
              </div>

              {/* Report 2: Issues Report */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        issuesFound > 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {issuesFound} {issuesFound === 1 ? 'row' : 'rows'} ready
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Issues Report
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {issuesFound > 0
                        ? `Contains only unresolved items (${issuesFound} ${issuesFound === 1 ? 'discrepancy' : 'discrepancies'} requiring attention).`
                        : 'No unresolved discrepancies in this run. Everything is matched.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  {issuesFound > 0 ? (
                    <a
                      href={selectedBatchId ? api.getExportUrl(selectedBatchId, 'csv', 'exceptions') : '#'}
                      download={`issues_report_${selectedBatchId.slice(0, 8)}.csv`}
                      className="w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Issues CSV</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>No Issues to Download</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
