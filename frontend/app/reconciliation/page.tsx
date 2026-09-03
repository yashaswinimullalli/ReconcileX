'use client';

import React, { Suspense, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowRight,
  Bot,
  AlertCircle,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatusBadge, LevelBadge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { BatchSummary, ReconLevel, ReconRecordListItem } from '@/lib/types';

function ReconciliationContent() {
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [records, setRecords] = useState<ReconRecordListItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [activeTab, setActiveTab] = useState<ReconLevel | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [isLoading, setIsLoading] = useState(true);

  // Load batches list on mount
  useEffect(() => {
    async function init() {
      try {
        const list = await api.getBatches();
        setBatches(list);
        const queryBatch = searchParams.get('batch');
        if (queryBatch && list.some((b) => b.batch_id === queryBatch)) {
          setSelectedBatchId(queryBatch);
        } else if (list.length > 0) {
          setSelectedBatchId(list[0].batch_id);
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    }
    init();
  }, [searchParams]);

  // Load records when batch, tab, status, or page changes
  useEffect(() => {
    if (!selectedBatchId) return;

    async function fetchRecords() {
      try {
        setIsLoading(true);
        const res = await api.getRecords(selectedBatchId, {
          recon_level: activeTab !== 'ALL' ? activeTab : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          page,
          limit,
        });
        setRecords(res.records);
        setTotalRecords(res.total);
      } catch (err) {
        console.error('Failed to load records:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecords();
  }, [selectedBatchId, activeTab, statusFilter, page, limit]);

  // Filter client-side search query
  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.work_key.toLowerCase().includes(q) ||
      (r.ml_prediction && r.ml_prediction.toLowerCase().includes(q)) ||
      (r.final_root_cause && r.final_root_cause.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        currentBatchId={selectedBatchId}
        onBatchChange={(id) => {
          setSelectedBatchId(id);
          setPage(1);
        }}
        onRefresh={() => setPage(1)}
      />

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Title & Batch Picker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Multi-Source Reconciliation Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare records across Internal Ledger, Processor (fees/refunds), and Bank Settlements
            </p>
          </div>

          {batches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Active Batch:</span>
              <select
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.name || b.batch_id.slice(0, 16)} ({b.total_records} records)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Tab switchers: ALL | L1_ORDER | L2_SETTLEMENT */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => {
                  setActiveTab('ALL');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Records
              </button>
              <button
                onClick={() => {
                  setActiveTab('L1_ORDER');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'L1_ORDER'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                L1: Orders (Ledger ↔ Processor)
              </button>
              <button
                onClick={() => {
                  setActiveTab('L2_SETTLEMENT');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'L2_SETTLEMENT'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                L2: Settlements (Processor ↔ Bank)
              </button>
            </div>

            {/* Status dropdown filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="AUTO_RESOLVE">Auto-Resolved</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="EXCEPTION">Exceptions</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Settlement Batch ID, or ML prediction..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Work Key / Entity</th>
                  <th className="px-5 py-3">Level</th>
                  <th className="px-5 py-3">Expected Amount</th>
                  <th className="px-5 py-3">Settled Amount</th>
                  <th className="px-5 py-3">Difference</th>
                  <th className="px-5 py-3">Fee / Deductions</th>
                  <th className="px-5 py-3">ML Prediction</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Decision</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      <span>Loading reconciliation records...</span>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isL1 = r.recon_level === 'L1_ORDER';
                    const expAmt = isL1 ? r.internal_gross : r.expected_net_total;
                    const setAmt = isL1 ? r.processor_gross : r.credited_amount;
                    const diff = isL1 ? r.gross_diff : r.settlement_diff;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900 font-mono">{r.work_key}</div>
                          {r.ground_truth_outcome && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              GT: {r.ground_truth_outcome}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <LevelBadge level={r.recon_level} />
                        </td>
                        <td className="px-5 py-3 font-mono font-medium">
                          {expAmt !== undefined ? `${r.currency} ${expAmt.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-mono font-medium">
                          {setAmt !== undefined ? `${r.currency} ${setAmt.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-mono">
                          <span
                            className={
                              Math.abs(diff) > 0.01
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-600'
                            }
                          >
                            {r.currency} {diff.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-500">
                          {r.fee_amount > 0 ? `${r.currency} ${r.fee_amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-slate-800">
                            {r.final_root_cause || r.ml_prediction || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {r.ml_confidence !== undefined ? (
                            <span className="font-mono text-xs text-slate-600 font-semibold">
                              {(r.ml_confidence * 100).toFixed(0)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={r.final_status} size="sm" />
                            {r.ai_investigated && (
                              <span
                                title="Investigated by Gemini LLM"
                                className="p-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px]"
                              >
                                <Bot className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/exceptions/${r.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredRecords.length} of {totalRecords} records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-xs">
          Loading reconciliation data...
        </div>
      }
    >
      <ReconciliationContent />
    </Suspense>
  );
}
