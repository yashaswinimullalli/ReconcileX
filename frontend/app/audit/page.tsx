'use client';

import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatusBadge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { BatchSummary } from '@/lib/types';

export default function AuditExportPage() {
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
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header />

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <FileCheck2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Audit Trail &amp; Financial Reporting
              </h2>
              <p className="text-xs text-slate-500">
                Generate auditable regulatory reconciliation reports and immutable event dumps
              </p>
            </div>
          </div>
        </div>

        {/* Batch Selection Banner */}
        {batches.length > 0 && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Select Reconciliation Batch</span>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="mt-1 text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none"
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.name || b.batch_id} ({b.total_records} records, {b.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedBatch && (
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Batch Status</span>
                  <StatusBadge status={selectedBatch.status} size="sm" />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Match Rate</span>
                  <span className="font-bold text-emerald-600">
                    {(selectedBatch.match_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Processing Time</span>
                  <span className="font-mono text-slate-800">{selectedBatch.processing_time_ms} ms</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Option 1: Complete Reconciliation CSV */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Complete Reconciliation Ledger</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full export containing all 1,244 matched records, discrepancies, fee breakdowns, and root cause tags in CSV format.
              </p>
            </div>

            <a
              href={selectedBatchId ? api.getExportUrl(selectedBatchId, 'csv', 'all') : '#'}
              download
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors ${
                selectedBatchId
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-200 text-slate-400 pointer-events-none'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download Full CSV</span>
            </a>
          </div>

          {/* Option 2: Exceptions Only CSV */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl w-fit">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Exceptions &amp; Review Report</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Focused report containing unresolved discrepancies, unexplained monetary variances, and ML classifications for finance ops review.
              </p>
            </div>

            <a
              href={selectedBatchId ? api.getExportUrl(selectedBatchId, 'csv', 'exceptions') : '#'}
              download
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors ${
                selectedBatchId
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-200 text-slate-400 pointer-events-none'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download Exceptions CSV</span>
            </a>
          </div>

          {/* Option 3: Full JSON Audit Payload */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">JSON Audit Trail Archive</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Machine-readable JSON payload containing complete feature vectors, AI reasoning chains, and timestamps for regulatory audits.
              </p>
            </div>

            <a
              href={selectedBatchId ? api.getExportUrl(selectedBatchId, 'json', 'all') : '#'}
              target="_blank"
              rel="noreferrer"
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors ${
                selectedBatchId
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-400 pointer-events-none'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>View / Export JSON</span>
            </a>
          </div>
        </div>

        {/* Regulatory Compliance & Safety Note */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl flex items-start gap-4 text-xs">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-900">Audit Trail Integrity Guarantee</span>
            <p className="text-slate-600 leading-relaxed">
              Every decision produced by ReconcileX is backed by an immutable database record. The AI Investigator acts solely as an advisory reasoning layer and never mutates ledger balances autonomously without policy verification.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
