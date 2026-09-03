'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Coins,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  FileQuestion,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatusBadge, LevelBadge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { BatchSummary, ExceptionRecordListItem } from '@/lib/types';

export default function ExceptionsQueuePage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [exceptions, setExceptions] = useState<ExceptionRecordListItem[]>([]);
  const [totalExceptions, setTotalExceptions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  useEffect(() => {
    async function init() {
      try {
        const list = await api.getBatches();
        setBatches(list);
        if (list.length > 0) {
          setSelectedBatchId(list[0].batch_id);
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;

    async function fetchExceptions() {
      try {
        setIsLoading(true);
        const res = await api.getExceptions(selectedBatchId, { page, limit });
        setExceptions(res.exceptions);
        setTotalExceptions(res.total);
      } catch (err) {
        console.error('Failed to load exceptions:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchExceptions();
  }, [selectedBatchId, page, limit]);

  const totalPages = Math.ceil(totalExceptions / limit) || 1;

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
        {/* Header & Context */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Exception &amp; Review Queue
                </h2>
                <p className="text-xs text-slate-500">
                  Finance Controller triage workspace for escalated discrepancies and ambiguous cases
                </p>
              </div>
            </div>
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
                className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.name || b.batch_id.slice(0, 16)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Philosophy Card */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Zero-Force Resolution Guarantee:</span>
            <p className="text-amber-800 leading-relaxed">
              ReconcileX never forces matches when evidence is incomplete or unexplained variance exceeds policy.
              Items in this queue are sorted by priority: actionable hard exceptions first, followed by ambiguous cases investigated by Gemini LLM.
            </p>
          </div>
        </div>

        {/* Exception Cards / Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Work Key</th>
                  <th className="px-5 py-3">Level</th>
                  <th className="px-5 py-3">Discrepancy</th>
                  <th className="px-5 py-3">Root Cause</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">AI Explanation / Action</th>
                  <th className="px-5 py-3 text-right">Investigate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      <span>Loading exception queue...</span>
                    </td>
                  </tr>
                ) : exceptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                      <span>No outstanding exceptions! All records reconciled cleanly.</span>
                    </td>
                  </tr>
                ) : (
                  exceptions.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-900 font-mono">{ex.work_key}</div>
                      </td>
                      <td className="px-5 py-3">
                        <LevelBadge level={ex.recon_level} />
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-rose-600">
                        {ex.currency} {ex.discrepancy_amount.toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-800">
                          {ex.predicted_cause.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono font-semibold text-slate-600">
                        {(ex.ml_confidence * 100).toFixed(0)}%
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={ex.final_status} size="sm" />
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        {ex.ai_investigated ? (
                          <div className="flex items-start gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                              {ex.ai_explanation || ex.recommended_action || 'Investigated by LLM.'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Deterministic policy escalation
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/exceptions/${ex.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {exceptions.length} of {totalExceptions} exceptions
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
