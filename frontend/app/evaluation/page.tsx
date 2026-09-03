'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  BrainCircuit,
  BarChart3,
  Award,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { EvaluationMetricsResponse } from '@/lib/types';

export default function EvaluationPage() {
  const [metrics, setMetrics] = useState<EvaluationMetricsResponse | null>(null);
  const [activeModelTab, setActiveModelTab] = useState<'L1' | 'L2'>('L1');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setIsLoading(true);
        const data = await api.getEvaluationMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const activeModel = activeModelTab === 'L1' ? metrics?.l1_metrics : metrics?.l2_metrics;

  // Format feature importance for bar chart
  const featureData = activeModel?.feature_importance
    ? Object.entries(activeModel.feature_importance)
        .map(([name, score]) => ({
          name: name.replace(/_/g, ' '),
          importance: Number((score * 100).toFixed(1)),
        }))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 8)
    : [];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header />

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Title & Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                <BrainCircuit className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Model Evaluation &amp; Benchmark Metrics
                </h2>
                <p className="text-xs text-slate-500">
                  Real, non-fabricated metrics evaluated on held-out test splits from ReconRiver
                </p>
              </div>
            </div>
          </div>

          {metrics?.fee_policy && (
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 shadow-2xs">
              <span className="text-slate-400">Derived Fee Policy: </span>
              <span className="font-bold text-blue-600">
                {(metrics.fee_policy.rate * 100).toFixed(2)}% + ₹{metrics.fee_policy.fixed.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Model Tabs: L1 vs L2 */}
        <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl w-fit text-xs font-semibold">
          <button
            onClick={() => setActiveModelTab('L1')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeModelTab === 'L1'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            L1 Order Classifier (11 Classes)
          </button>
          <button
            onClick={() => setActiveModelTab('L2')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeModelTab === 'L2'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            L2 Settlement Classifier (6 Classes)
          </button>
        </div>

        {/* Metrics Summary Cards */}
        {activeModel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Held-Out Accuracy
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">
                  {(activeModel.accuracy * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                  Test Split
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {activeModel.test_size} test samples evaluated
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Weighted F1 Score
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-600">
                  {(activeModel.f1 * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                  Macro/Weighted
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Balanced across imbalanced classes</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mean Confidence
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-600">
                  {(activeModel.avg_confidence * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Softmax probability calibration</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Training Split Size
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {activeModel.train_size}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">80/20 Stratified</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{activeModel.n_classes} target classes</p>
            </div>
          </div>
        )}

        {/* Feature Importance & Confusion Matrix Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feature Importance Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>XGBoost Feature Importance</span>
              <span className="text-[10px] text-slate-400 font-mono">Normalized Gain</span>
            </h3>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Relative Gain']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="importance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-slate-500">
              Features capture counterparty presence, monetary discrepancies, fee policies, refund ratios, and settlement delay days.
            </p>
          </div>

          {/* Classification Report Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 overflow-hidden">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>Held-Out Per-Class Classification Report</span>
              <span className="text-[10px] text-slate-400 font-mono">scikit-learn</span>
            </h3>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Class</th>
                    <th className="py-2 px-3">Precision</th>
                    <th className="py-2 px-3">Recall</th>
                    <th className="py-2 px-3">F1</th>
                    <th className="py-2 px-3">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {activeModel &&
                    Object.entries(activeModel.per_class_report)
                      .filter(([key]) => !['accuracy', 'macro avg', 'weighted avg'].includes(key))
                      .map(([cls, row]) => (
                        <tr key={cls} className="hover:bg-slate-50/60">
                          <td className="py-1.5 px-3 font-semibold font-mono text-slate-800 text-[11px]">
                            {cls}
                          </td>
                          <td className="py-1.5 px-3 font-mono">{(row.precision * 100).toFixed(0)}%</td>
                          <td className="py-1.5 px-3 font-mono">{(row.recall * 100).toFixed(0)}%</td>
                          <td className="py-1.5 px-3 font-mono font-bold text-blue-600">
                            {(row['f1-score'] * 100).toFixed(0)}%
                          </td>
                          <td className="py-1.5 px-3 font-mono text-slate-500">{row.support}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-500">
              Evaluated on the held-out 20% test partition without synthetic label fabrication.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
