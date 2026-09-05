'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { BatchSummary, ExceptionRecordListItem } from '@/lib/types';
import { getRetailerCause } from '@/lib/retailerTerms';

type FilterType = 'ALL' | 'BANK_DEPOSITS' | 'ORDERS';

interface IssueInfo {
  issue: string;
  whatHappened: string;
  status: 'MATCHED' | 'NEEDS_REVIEW' | 'ISSUE';
}

function getIssueDetails(ex: ExceptionRecordListItem): IssueInfo {
  const isL2 = ex.recon_level === 'L2_SETTLEMENT';
  const diff = Math.round(ex.discrepancy_amount || 0);

  if (isL2) {
    if (diff === 0) {
      return {
        issue: 'Bank deposit matched',
        whatHappened: 'Expected payout matches bank deposit.',
        status: 'MATCHED',
      };
    }
    if (diff >= 100) {
      return {
        issue: 'Bank deposit short',
        whatHappened: `₹${diff.toLocaleString()} less was deposited than expected.`,
        status: 'NEEDS_REVIEW',
      };
    }
    return {
      issue: 'Deposit difference',
      whatHappened: `₹${diff.toLocaleString()} less was deposited than expected.`,
      status: 'NEEDS_REVIEW',
    };
  }

  // L1 Order
  const cause = (ex.predicted_cause || '').toUpperCase();
  if (cause.includes('MISSING_IN_PROCESSOR')) {
    return {
      issue: 'Payment not found',
      whatHappened: 'Order exists, but no matching payment record was found.',
      status: 'ISSUE',
    };
  }
  if (cause.includes('FEE')) {
    return {
      issue: 'Fee difference',
      whatHappened: `₹${diff.toLocaleString()} fee difference between gateway and expected rate.`,
      status: 'NEEDS_REVIEW',
    };
  }
  if (cause.includes('DELAY') || cause.includes('LATE')) {
    return {
      issue: 'Deposit pending',
      whatHappened: 'Payment captured, awaiting bank deposit.',
      status: 'NEEDS_REVIEW',
    };
  }
  if (cause.includes('DUPLICATE')) {
    return {
      issue: 'Duplicate record',
      whatHappened: 'Multiple matching records detected.',
      status: 'ISSUE',
    };
  }
  if (diff === 0) {
    return {
      issue: 'Order matched',
      whatHappened: 'Order and payment amounts match.',
      status: 'MATCHED',
    };
  }
  return {
    issue: 'Payment difference',
    whatHappened: `₹${diff.toLocaleString()} difference between order and payment record.`,
    status: 'NEEDS_REVIEW',
  };
}

export default function MoneyIssuesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [exceptions, setExceptions] = useState<ExceptionRecordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
    let ignore = false;
    if (!selectedBatchId) {
      setExceptions([]);
      setIsLoading(false);
      return;
    }

    async function fetchExceptions() {
      try {
        setIsLoading(true);
        const res = await api.getExceptions(selectedBatchId, { page: 1, limit: 100 });
        if (!ignore) {
          setExceptions(res.exceptions);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load exceptions:', err);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchExceptions();
    return () => {
      ignore = true;
    };
  }, [selectedBatchId]);

  // Compute total money gap
  const totalMoneyGap = useMemo(() => {
    return exceptions.reduce((sum, ex) => sum + (ex.discrepancy_amount || 0), 0);
  }, [exceptions]);

  // Filter exceptions
  const filteredExceptions = useMemo(() => {
    return exceptions.filter((ex) => {
      // 1. Type Filter
      if (activeFilter === 'BANK_DEPOSITS' && ex.recon_level !== 'L2_SETTLEMENT') return false;
      if (activeFilter === 'ORDERS' && ex.recon_level !== 'L1_ORDER') return false;

      // 2. Search Box Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesKey = ex.work_key.toLowerCase().includes(q);
        const details = getIssueDetails(ex);
        const matchesIssue =
          details.issue.toLowerCase().includes(q) ||
          details.whatHappened.toLowerCase().includes(q);
        if (!matchesKey && !matchesIssue) return false;
      }

      return true;
    });
  }, [exceptions, activeFilter, searchQuery]);

  const bankDepositCount = useMemo(() => {
    return exceptions.filter((e) => e.recon_level === 'L2_SETTLEMENT').length;
  }, [exceptions]);

  const orderCount = useMemo(() => {
    return exceptions.filter((e) => e.recon_level === 'L1_ORDER').length;
  }, [exceptions]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      <Header />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Metric Chips */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-2xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Money Issues
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review payments, deposits, and discrepancies that need your attention.
                </p>
              </div>
            </div>
          </div>

          {/* Top Summary Chips */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200/80 font-semibold text-rose-800 shadow-2xs">
              Total gap to review: <strong>₹{Math.round(totalMoneyGap).toLocaleString()}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 font-medium text-slate-700 shadow-2xs">
              Items needing attention: <strong className="text-slate-900">{exceptions.length}</strong>
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({exceptions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('BANK_DEPOSITS')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeFilter === 'BANK_DEPOSITS'
                    ? 'bg-white text-purple-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bank Deposits ({bankDepositCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('ORDERS')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeFilter === 'ORDERS'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders ({orderCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by ID or issue description…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Order / Deposit</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Issue</th>
                  <th className="py-3.5 px-5">What happened</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      <span>Loading money issues...</span>
                    </td>
                  </tr>
                ) : filteredExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold text-slate-900 text-sm">
                        No outstanding money issues!
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        All payments and bank deposits reconciled cleanly.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredExceptions.map((ex) => {
                    const isL2 = ex.recon_level === 'L2_SETTLEMENT';
                    const details = getIssueDetails(ex);
                    const amount = Math.round(ex.discrepancy_amount || 0);

                    return (
                      <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Order / Deposit */}
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{ex.work_key}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                isL2
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {isL2 ? 'Bank Deposit' : 'Order'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Amount */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          ₹{amount.toLocaleString()}
                        </td>

                        {/* 3. Issue */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {details.issue}
                        </td>

                        {/* 4. What happened */}
                        <td className="py-3.5 px-5 text-slate-600">
                          “{details.whatHappened}”
                        </td>

                        {/* 5. Status */}
                        <td className="py-3.5 px-4">
                          {details.status === 'MATCHED' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span>✅</span>
                              <span>Matched</span>
                            </span>
                          )}
                          {details.status === 'NEEDS_REVIEW' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <span>🟡</span>
                              <span>Needs Review</span>
                            </span>
                          )}
                          {details.status === 'ISSUE' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <span>🔴</span>
                              <span>Issue</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Action */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/exceptions/${ex.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <span>Investigate</span>
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
        </div>
      </main>
    </div>
  );
}
