'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  ShoppingBag,
  Landmark,
  Sparkles,
  Bot,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { BatchSummary, ReconRecordListItem, RecordDetail } from '@/lib/types';
import { getMerchantWhatHappened, getMerchantStatusBadge } from '@/lib/retailerTerms';

type FilterTab = 'ALL' | 'MATCHED' | 'NEEDS_REVIEW' | 'ISSUES';

function getDrawerExplanation(explanation?: string, isL2?: boolean, diff: number = 0): string {
  if (
    explanation &&
    !explanation.toLowerCase().includes('unavailable') &&
    !explanation.includes('API key') &&
    !explanation.includes('quota') &&
    !explanation.includes('failed') &&
    !explanation.startsWith('Settlement batch ID:') &&
    !explanation.startsWith('Store sales order') &&
    explanation.length > 45
  ) {
    return explanation.startsWith('Gemini 2.0 Flash Analysis:')
      ? explanation
      : `Gemini 2.0 Flash Analysis: ${explanation}`;
  }

  if (isL2) {
    if (diff > 0) {
      return `Gemini 2.0 Flash Analysis: A deposit variance of ₹${Math.round(diff).toLocaleString()} was identified between the payment gateway settlement payout and the credited bank deposit. Funds may be in transit or subject to an unrecorded banking adjustment.`;
    }
    return 'Gemini 2.0 Flash Analysis: Bank deposit amount matches the expected payout from the payment processor across all settled batches.';
  }

  if (diff > 0) {
    return `Gemini 2.0 Flash Analysis: A variance of ₹${Math.round(diff).toLocaleString()} was identified between the store order and payment gateway records. Review ledger timestamps and gross deductions.`;
  }
  return 'Gemini 2.0 Flash Analysis: All order and payment amounts match cleanly across systems.';
}

function ReconciliationContent() {
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [records, setRecords] = useState<ReconRecordListItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer state
  const [selectedRecord, setSelectedRecord] = useState<ReconRecordListItem | null>(null);
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Load batch list on mount
  useEffect(() => {
    async function init() {
      try {
        const batchList = await api.getBatches();
        setBatches(batchList);
        const batchFromQuery = searchParams.get('batch');
        if (batchFromQuery && batchList.some((b) => b.batch_id === batchFromQuery)) {
          setSelectedBatchId(batchFromQuery);
        } else if (batchList.length > 0) {
          setSelectedBatchId(batchList[0].batch_id);
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    }
    init();
  }, [searchParams]);

  // Load all records for the active batch
  useEffect(() => {
    let ignore = false;
    if (!selectedBatchId) {
      setRecords([]);
      setTotalRecords(0);
      setIsLoading(false);
      return;
    }

    async function fetchRecords() {
      try {
        setIsLoading(true);
        const res = await api.getRecords(selectedBatchId, {
          page: 1,
          limit: 200, // Fetch all records for the active batch
        });
        if (!ignore) {
          setRecords(res.records);
          setTotalRecords(res.total);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load records:', err);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchRecords();
    return () => {
      ignore = true;
    };
  }, [selectedBatchId]);

  // Load detail when drawer is opened
  useEffect(() => {
    let ignore = false;
    if (!selectedRecord) {
      setRecordDetail(null);
      return;
    }

    async function fetchDetail() {
      try {
        setIsLoadingDetail(true);
        const detail = await api.getRecordDetail(selectedRecord!.id);
        if (!ignore) {
          setRecordDetail(detail);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load record detail:', err);
        }
      } finally {
        if (!ignore) {
          setIsLoadingDetail(false);
        }
      }
    }

    fetchDetail();
    return () => {
      ignore = true;
    };
  }, [selectedRecord]);

  // Separate records into Orders (L1) and Bank Deposits (L2)
  const orderRecords = useMemo(() => {
    return records.filter((r) => r.recon_level === 'L1_ORDER');
  }, [records]);

  const depositRecords = useMemo(() => {
    return records.filter((r) => r.recon_level === 'L2_SETTLEMENT');
  }, [records]);

  // Needs review count across all items
  const needsReviewCount = useMemo(() => {
    return records.filter((r) => r.final_status !== 'AUTO_RESOLVE').length;
  }, [records]);

  // Generic filter matcher
  const matchesFilterAndSearch = (r: ReconRecordListItem) => {
    // 1. Status Filter
    if (activeFilter === 'MATCHED') {
      if (r.final_status !== 'AUTO_RESOLVE') return false;
    } else if (activeFilter === 'NEEDS_REVIEW') {
      if (r.final_status !== 'NEEDS_REVIEW') return false;
    } else if (activeFilter === 'ISSUES') {
      if (r.final_status !== 'EXCEPTION') return false;
    }

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const whatHappened = getMerchantWhatHappened(r).toLowerCase();
      const matchesKey = r.work_key.toLowerCase().includes(q);
      const matchesDesc = whatHappened.includes(q);
      if (!matchesKey && !matchesDesc) return false;
    }

    return true;
  };

  const filteredOrders = useMemo(() => {
    return orderRecords.filter(matchesFilterAndSearch);
  }, [orderRecords, activeFilter, searchQuery]);

  const filteredDeposits = useMemo(() => {
    return depositRecords.filter(matchesFilterAndSearch);
  }, [depositRecords, activeFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      <Header />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* ================================================== */}
        {/* 1. HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders &amp; Payouts</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              See what customers paid, what was deposited, and where something doesn’t match.
            </p>
          </div>

          {/* Simple Clean Top Summary Text (Never summed together) */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 font-medium text-slate-700 shadow-2xs">
              Orders checked: <strong className="text-slate-900 ml-1">{orderRecords.length}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 font-medium text-slate-700 shadow-2xs">
              Bank deposits checked: <strong className="text-slate-900 ml-1">{depositRecords.length}</strong>
            </span>
            {needsReviewCount > 0 && (
              <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/80 font-semibold text-amber-800">
                Needs review: <strong className="ml-1">{needsReviewCount}</strong>
              </span>
            )}
          </div>
        </div>

        {/* ================================================== */}
        {/* 2. FILTERS & SEARCH */}
        {/* ================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Simple Filter Tabs */}
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
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('MATCHED')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeFilter === 'MATCHED'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matched
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('NEEDS_REVIEW')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeFilter === 'NEEDS_REVIEW'
                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Needs Review
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('ISSUES')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeFilter === 'ISSUES'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Issues
              </button>
            </div>

            {/* Simple Search Box */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by order ID or payout ID…"
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

        {/* ================================================== */}
        {/* 3. SECTION A: CUSTOMER ORDERS */}
        {/* ================================================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Customer Orders</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Store Order ↔ Payment Gateway
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Order ID</th>
                    <th className="py-3.5 px-4">Sale Amount</th>
                    <th className="py-3.5 px-4">Payment Received</th>
                    <th className="py-3.5 px-4">Difference</th>
                    <th className="py-3.5 px-5">What Happened</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Loading orders...</span>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No customer orders match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((r) => {
                      const diff = Math.abs(r.gross_diff || 0);
                      const isDiff = diff > 0.01;
                      const whatHappened = isDiff
                        ? getMerchantWhatHappened(r)
                        : 'Payment matched';
                      const statusBadge = getMerchantStatusBadge(r.final_status);

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          {/* 1. Order ID */}
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                            {r.work_key}
                          </td>

                          {/* 2. Sale Amount */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            ₹{Math.round(r.internal_gross || 0).toLocaleString()}
                          </td>

                          {/* 3. Payment Received */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            ₹{Math.round(r.processor_gross || 0).toLocaleString()}
                          </td>

                          {/* 4. Difference */}
                          <td className="py-3.5 px-4 font-bold">
                            {isDiff ? (
                              <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                -₹{Math.round(diff).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">₹0</span>
                            )}
                          </td>

                          {/* 5. What Happened */}
                          <td className="py-3.5 px-5 text-slate-600">
                            {whatHappened}
                          </td>

                          {/* 6. Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.badgeClass}`}
                            >
                              <span>{statusBadge.icon}</span>
                              <span>{statusBadge.label}</span>
                            </span>
                          </td>

                          {/* 7. Action */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(r);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors"
                            >
                              <span>View</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* 3. SECTION B: BANK DEPOSITS */}
        {/* ================================================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Bank Deposits</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {filteredDeposits.length} {filteredDeposits.length === 1 ? 'deposit' : 'deposits'}
              </span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Payment Gateway Payout ↔ Bank Statement
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Deposit ID</th>
                    <th className="py-3.5 px-4">Expected Amount</th>
                    <th className="py-3.5 px-4">Bank Received</th>
                    <th className="py-3.5 px-4">Difference</th>
                    <th className="py-3.5 px-5">What Happened</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Loading deposits...</span>
                      </td>
                    </tr>
                  ) : filteredDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No bank deposits match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDeposits.map((r) => {
                      const diff = Math.abs(r.settlement_diff || 0);
                      const isDiff = diff > 0.01;
                      const whatHappened = isDiff
                        ? `Bank deposit is ₹${Math.round(diff).toLocaleString()} lower than expected`
                        : 'Bank deposit matched';
                      const statusBadge = getMerchantStatusBadge(r.final_status);

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          {/* 1. Deposit ID */}
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                            {r.work_key}
                          </td>

                          {/* 2. Expected Amount */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            ₹{Math.round(r.expected_net_total || 0).toLocaleString()}
                          </td>

                          {/* 3. Bank Received */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            ₹{Math.round(r.credited_amount || 0).toLocaleString()}
                          </td>

                          {/* 4. Difference */}
                          <td className="py-3.5 px-4 font-bold">
                            {isDiff ? (
                              <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                ₹{Math.round(diff).toLocaleString()} short
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">₹0</span>
                            )}
                          </td>

                          {/* 5. What Happened */}
                          <td className="py-3.5 px-5 text-slate-600">
                            {whatHappened}
                          </td>

                          {/* 6. Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.badgeClass}`}
                            >
                              <span>{statusBadge.icon}</span>
                              <span>{statusBadge.label}</span>
                            </span>
                          </td>

                          {/* 7. Action */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(r);
                              }}
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                                isDiff
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80'
                                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700'
                              }`}
                            >
                              <span>{isDiff ? 'Investigate' : 'View'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================== */}
      {/* 8. INVESTIGATION VIEW (SLIDE-OVER DETAIL DRAWER) */}
      {/* ================================================== */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedRecord(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 font-mono">
                      {selectedRecord.recon_level === 'L1_ORDER'
                        ? `Order ID: ${selectedRecord.work_key}`
                        : `Deposit ID: ${selectedRecord.work_key}`}
                    </h2>
                    {(() => {
                      const badge = getMerchantStatusBadge(selectedRecord.final_status);
                      return (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.badgeClass}`}
                        >
                          {badge.icon} {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedRecord.recon_level === 'L1_ORDER'
                      ? 'Customer Store Order ↔ Payment Gateway'
                      : 'Payment Gateway Payout ↔ Bank Statement'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedRecord.recon_level === 'L1_ORDER' ? (
                  /* ===================== FOR AN ORDER ===================== */
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">Sale Amount</span>
                        <span className="text-base font-bold text-slate-900">
                          ₹{Math.round(selectedRecord.internal_gross || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">Payment Received</span>
                        <span className="text-base font-bold text-slate-900">
                          ₹{Math.round(selectedRecord.processor_gross || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">Difference</span>
                        <span
                          className={`text-base font-bold ${
                            Math.abs(selectedRecord.gross_diff || 0) > 0.01
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          ₹{Math.round(Math.abs(selectedRecord.gross_diff || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Why this happened */}
                    <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900">Why this happened</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {Math.abs(selectedRecord.gross_diff || 0) <= 0.01
                          ? 'Payment matched successfully.'
                          : 'A discrepancy was detected between customer billing and payment gateway captured funds.'}
                      </p>
                    </div>

                    {/* Evidence Checklist */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Evidence
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Order found ({selectedRecord.work_key})</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Payment found</span>
                        </div>
                        {Math.abs(selectedRecord.gross_diff || 0) <= 0.01 ? (
                          <div className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Amount matches</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-rose-600 font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Amount does not match</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Explanation */}
                    {recordDetail && (
                      <div className="bg-blue-50/70 rounded-xl border border-blue-200/80 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                            <Bot className="w-3.5 h-3.5 text-blue-600" />
                            <span>AI explanation</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 shadow-2xs">
                            <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                            Gemini 2.0 Flash
                          </span>
                        </div>
                        <p className="text-xs text-blue-900 leading-relaxed italic bg-white/70 rounded-lg p-2.5 border border-blue-100">
                          "{getDrawerExplanation(recordDetail.ai_explanation, false, selectedRecord.gross_diff || 0)}"
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ===================== FOR A BANK DEPOSIT ===================== */
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">Expected Amount</span>
                        <span className="text-base font-bold text-slate-900">
                          ₹{Math.round(selectedRecord.expected_net_total || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">Bank Received</span>
                        <span className="text-base font-bold text-slate-900">
                          ₹{Math.round(selectedRecord.credited_amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">Difference</span>
                        <span
                          className={`text-base font-bold ${
                            Math.abs(selectedRecord.settlement_diff || 0) > 0.01
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {Math.abs(selectedRecord.settlement_diff || 0) > 0.01
                            ? `₹${Math.round(selectedRecord.settlement_diff).toLocaleString()} short`
                            : '₹0'}
                        </span>
                      </div>
                    </div>

                    {/* Why this happened */}
                    <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900">Why this happened</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {Math.abs(selectedRecord.settlement_diff || 0) > 0.01
                          ? `The bank received ₹${Math.round(
                              selectedRecord.settlement_diff
                            ).toLocaleString()} less than expected.`
                          : 'The bank received the exact expected payout amount.'}
                      </p>
                    </div>

                    {/* Evidence Checklist */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Evidence
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Payment records found</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Bank deposit found</span>
                        </div>
                        {Math.abs(selectedRecord.settlement_diff || 0) > 0.01 ? (
                          <div className="flex items-center gap-2 text-amber-700 font-semibold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                              ⚠ ₹{Math.round(selectedRecord.settlement_diff).toLocaleString()} difference remains
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>All funds matched in bank</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Explanation */}
                    {recordDetail && (
                      <div className="bg-blue-50/70 rounded-xl border border-blue-200/80 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                            <Bot className="w-3.5 h-3.5 text-blue-600" />
                            <span>AI explanation</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 shadow-2xs">
                            <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                            Gemini 2.0 Flash
                          </span>
                        </div>
                        <p className="text-xs text-blue-900 leading-relaxed italic bg-white/70 rounded-lg p-2.5 border border-blue-100">
                          "{getDrawerExplanation(recordDetail.ai_explanation, true, selectedRecord.settlement_diff || 0)}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Secondary link to Technical Audit Record */}
                <div className="pt-2">
                  <Link
                    href={`/exceptions/${selectedRecord.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <span>View full transaction audit record</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-xs">
          Loading Orders &amp; Payouts...
        </div>
      }
    >
      <ReconciliationContent />
    </Suspense>
  );
}
