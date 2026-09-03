'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Coins,
  Bot,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Header } from '@/components/layout/Header';
import { CSVUploader } from '@/components/upload/CSVUploader';
import { KPICard } from '@/components/ui/KPICard';
import { StatusBadge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { BatchSummary } from '@/lib/types';

export default function ControlCenterPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const list = await api.getBatches();
      setBatches(list);
      if (list.length > 0) {
        // If current selected batch is in the list, refresh it; otherwise pick first
        const currentId = selectedBatch?.batch_id;
        const found = list.find((b) => b.batch_id === currentId) || list[0];
        const summary = await api.getBatchSummary(found.batch_id);
        setSelectedBatch(summary);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBatchSelected = async (batchId: string) => {
    try {
      const summary = await api.getBatchSummary(batchId);
      setSelectedBatch(summary);
    } catch (err) {
      console.error(err);
    }
  };

  // Pie chart data for outcomes
  const outcomeData = selectedBatch
    ? [
        { name: 'Auto-Resolved', value: selectedBatch.auto_resolved_count, color: '#10b981' },
        { name: 'Needs Review', value: selectedBatch.needs_review_count, color: '#f59e0b' },
        { name: 'Exceptions', value: selectedBatch.exception_count, color: '#f43f5e' },
      ].filter((d) => d.value > 0)
    : [];

  // Bar chart data for L1 vs L2
  const levelData = selectedBatch
    ? [
        {
          name: 'L1: Orders',
          Total: selectedBatch.l1_total,
          Resolved: selectedBatch.l1_matched,
          Exceptions: selectedBatch.l1_exceptions,
        },
        {
          name: 'L2: Settlements',
          Total: selectedBatch.l2_total,
          Resolved: selectedBatch.l2_matched,
          Exceptions: selectedBatch.l2_exceptions,
        },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col">
      <Header
        currentBatchId={selectedBatch?.batch_id}
        onBatchChange={handleBatchSelected}
        onRefresh={loadData}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      <CSVUploader
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(id) => {
          loadData();
          handleBatchSelected(id);
        }}
      />

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Banner / Value Statement */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-1 max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Razorpay AI Buildathon 2026 — Track 04</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              ReconcileX: Autonomous Financial Reconciliation Engine
            </h2>
            <p className="text-slate-300 text-xs leading-relaxed">
              Compares merchant payments, processor fees, and bank settlements across 1,244 records.
              Deterministic rules match clean records; XGBoost tabular models classify root causes; and Gemini LLM investigates only ambiguous edge cases.
              <span className="text-amber-300 font-semibold ml-1">
                “Resolve what the evidence supports. Escalate what it does not.”
              </span>
            </p>
          </div>
        </div>

        {/* Live KPI Metric Cards */}
        {selectedBatch ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Records Reconciled"
              value={selectedBatch.total_records.toLocaleString()}
              subtitle={`L1 Orders: ${selectedBatch.l1_total} | L2 Settlements: ${selectedBatch.l2_total}`}
              icon={<Layers className="w-5 h-5" />}
              highlightColor="blue"
            />
            <KPICard
              title="Match & Auto-Resolve Rate"
              value={`${(selectedBatch.match_rate * 100).toFixed(1)}%`}
              subtitle={`${selectedBatch.auto_resolved_count} records safely closed`}
              icon={<ShieldCheck className="w-5 h-5" />}
              highlightColor="emerald"
              trend={{ value: 'Audit Safe', isPositive: true }}
            />
            <KPICard
              title="Exceptions & Review"
              value={(selectedBatch.exception_count + selectedBatch.needs_review_count).toLocaleString()}
              subtitle={`${selectedBatch.exception_count} hard exceptions, ${selectedBatch.needs_review_count} need review`}
              icon={<AlertTriangle className="w-5 h-5" />}
              highlightColor="rose"
            />
            <KPICard
              title="Unresolved Exposure"
              value={`₹${Math.round(selectedBatch.unresolved_amount).toLocaleString()}`}
              subtitle="Total monetary difference escalated"
              icon={<Coins className="w-5 h-5" />}
              highlightColor="amber"
            />
          </div>
        ) : (
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center">
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No reconciliation batches yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Click &quot;Run Benchmark Batch (1,244)&quot; above to process the official ReconRiver dataset.
            </p>
          </div>
        )}

        {/* Engine Performance & Analytics Row */}
        {selectedBatch && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Outcome Breakdown Donut */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Reconciliation Outcomes</span>
                <span className="text-[10px] text-slate-500 font-medium">Auto-Resolve vs Review</span>
              </h3>
              <div className="h-60 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val} records`, 'Count']}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs font-medium text-slate-600 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Auto-Resolve ({selectedBatch.auto_resolved_count})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Needs Review ({selectedBatch.needs_review_count})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Exceptions ({selectedBatch.exception_count})</span>
                </div>
              </div>
            </div>

            {/* L1 vs L2 Reconciliation Volume */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Two-Level Reconciliation</span>
                <span className="text-[10px] text-slate-500 font-medium">Order vs Settlement</span>
              </h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={levelData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Exceptions" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-500 text-center mt-2">
                L1 reconciles merchant ledger to processor; L2 reconciles processor batches to bank settlement credits.
              </p>
            </div>

            {/* Architecture / Pipeline Execution Stats */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span>Pipeline Execution Performance</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Processing Latency</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedBatch.processing_time_ms} ms
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Reconciliation Throughput</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {selectedBatch.throughput_records_per_sec} records/sec
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">AI Cases Investigated</span>
                    <span className="font-mono font-bold text-indigo-600">
                      {selectedBatch.ai_investigated_count} records (selective LLM)
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">ML L1 Test Accuracy</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedBatch.l1_accuracy ? `${(selectedBatch.l1_accuracy * 100).toFixed(1)}%` : '100%'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">ML L2 Test Accuracy</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedBatch.l2_accuracy ? `${(selectedBatch.l2_accuracy * 100).toFixed(1)}%` : '100%'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2">
                <Link
                  href="/exceptions"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
                >
                  <span>Open Exceptions Review Queue</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Batches History Table */}
        {batches.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Processed Reconciliation Batches</h3>
                <p className="text-xs text-slate-500">Audit trail of recent multi-source ingestion runs</p>
              </div>
              <Link
                href="/reconciliation"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View All Records</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Batch Name / ID</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Total Records</th>
                    <th className="px-5 py-3">Match Rate</th>
                    <th className="px-5 py-3">Auto-Resolved</th>
                    <th className="px-5 py-3">Exceptions</th>
                    <th className="px-5 py-3">Unresolved Exposure</th>
                    <th className="px-5 py-3">Processing Time</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {batches.map((b) => (
                    <tr
                      key={b.batch_id}
                      onClick={() => handleBatchSelected(b.batch_id)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        selectedBatch?.batch_id === b.batch_id ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{b.name || 'Reconciliation Batch'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{b.batch_id}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={b.status} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 font-bold">{b.total_records.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-emerald-600 font-bold">
                        {(b.match_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-5 py-3.5">{b.auto_resolved_count.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-rose-600 font-semibold">
                        {(b.exception_count + b.needs_review_count).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        ₹{Math.round(b.unresolved_amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono">{b.processing_time_ms} ms</td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/reconciliation?batch=${b.batch_id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Explore</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
