'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';

function getCurrencySymbol(code: string): string {
  const c = (code || '').toUpperCase();
  if (c.includes('USD') || c === '$') return '$';
  if (c.includes('EUR') || c === '€') return '€';
  if (c.includes('GBP') || c === '£') return '£';
  return '₹';
}

function normalizeCurrencyCode(code: string): string {
  const c = (code || '').toUpperCase();
  if (c.includes('USD') || c === '$') return 'USD';
  if (c.includes('EUR') || c === '€') return 'EUR';
  if (c.includes('GBP') || c === '£') return 'GBP';
  return 'INR';
}

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState('My Retail Store');
  const [currency, setCurrency] = useState('INR');
  const [detectedCurrency, setDetectedCurrency] = useState<string | null>(null);
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [provider, setProvider] = useState('Razorpay');
  const [expectedFeeRate, setExpectedFeeRate] = useState('2.00');
  const [fixedFee, setFixedFee] = useState('0.00');
  const [feeDifferenceAlert, setFeeDifferenceAlert] = useState('1.50');
  const [autoApproveMatches, setAutoApproveMatches] = useState(true);
  const [flagDelayedDeposits, setFlagDelayedDeposits] = useState(true);
  const [depositWindowDays, setDepositWindowDays] = useState('2');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSettingsAndDetectCurrency() {
      // 1. Detect currency from uploaded financial data if available
      let fileCurrency: string | null = null;
      try {
        const batches = await api.getBatches();
        if (batches && batches.length > 0) {
          const latestBatch = batches[0];
          const recRes = await api.getRecords(latestBatch.batch_id, { limit: 5 });
          if (recRes && recRes.records && recRes.records.length > 0) {
            const foundWithCurrency = recRes.records.find((r) => r.currency);
            if (foundWithCurrency && foundWithCurrency.currency) {
              fileCurrency = normalizeCurrencyCode(foundWithCurrency.currency);
            }
          }
        }
      } catch (err) {
        console.warn('Could not detect currency from uploaded batch:', err);
      }

      // 2. Load stored settings from localStorage
      let saved: any = null;
      try {
        const raw = localStorage.getItem('reconcilex_settings');
        if (raw) saved = JSON.parse(raw);
      } catch {
        // ignore storage errors
      }

      if (!isMounted) return;

      if (saved) {
        if (saved.businessName !== undefined) setBusinessName(saved.businessName);
        if (saved.provider !== undefined) setProvider(saved.provider);
        if (saved.expectedFeeRate !== undefined) setExpectedFeeRate(saved.expectedFeeRate);
        if (saved.fixedFee !== undefined) setFixedFee(saved.fixedFee);
        if (saved.feeDifferenceAlert !== undefined) setFeeDifferenceAlert(saved.feeDifferenceAlert);
        if (saved.autoApproveMatches !== undefined) setAutoApproveMatches(saved.autoApproveMatches);
        if (saved.flagDelayedDeposits !== undefined) setFlagDelayedDeposits(saved.flagDelayedDeposits);
        if (saved.depositWindowDays !== undefined) setDepositWindowDays(saved.depositWindowDays);
        if (saved.hasManualOverride) setHasManualOverride(true);
      }

      // 3. Set currency: Prioritize detected currency from uploaded files when present
      if (fileCurrency) {
        setDetectedCurrency(fileCurrency);
        // If user hasn't explicitly saved a manual override, adopt detected currency
        if (!saved?.hasManualOverride) {
          setCurrency(fileCurrency);
        } else if (saved?.currency) {
          setCurrency(normalizeCurrencyCode(saved.currency));
        } else {
          setCurrency(fileCurrency);
        }
      } else if (saved?.currency) {
        setCurrency(normalizeCurrencyCode(saved.currency));
      } else {
        setCurrency('INR');
      }
    }

    loadSettingsAndDetectCurrency();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    setHasManualOverride(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        'reconcilex_settings',
        JSON.stringify({
          businessName,
          currency,
          hasManualOverride,
          provider,
          expectedFeeRate,
          fixedFee,
          feeDifferenceAlert,
          autoApproveMatches,
          flagDelayedDeposits,
          depositWindowDays,
        })
      );
    } catch {
      // Storage quota or restriction
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const currencySymbol = getCurrencySymbol(currency);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      <Header />

      <main className="flex-1 p-6 md:p-8 max-w-3xl mx-auto w-full space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Settings
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Set up how ReconcileX checks your money.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settings saved</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* ================================================== */}
          {/* 1. STORE DETAILS */}
          {/* ================================================== */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
              <Store className="w-4 h-4 text-blue-600" />
              <span>Store Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="businessName" className="font-semibold text-slate-700 block">
                    Business Name
                  </label>
                  <span className="text-[11px] text-slate-400">Optional</span>
                </div>
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Retail Store"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="currency" className="font-semibold text-slate-700 block">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {detectedCurrency
                    ? `Currency is detected from your uploaded files (${currencySymbol} ${currency}).`
                    : 'Currency is detected from your uploaded files.'}
                </p>
              </div>
            </div>
          </section>

          {/* ================================================== */}
          {/* 2. PAYMENT FEES */}
          {/* ================================================== */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Payment Fees</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tell us the payment fees agreed with your payment provider so we can detect unusual deductions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="provider" className="font-semibold text-slate-700 block">
                  Payment Provider
                </label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                >
                  <option value="Razorpay">Razorpay</option>
                  <option value="Stripe">Stripe</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="feeRate" className="font-semibold text-slate-700 block">
                  Expected Fee Rate (%)
                </label>
                <div className="relative">
                  <input
                    id="feeRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={expectedFeeRate}
                    onChange={(e) => setExpectedFeeRate(e.target.value)}
                    placeholder="2.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors pr-8"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-semibold text-xs">%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="fixedFee" className="font-semibold text-slate-700 block">
                  Fixed Fee per Payment ({currencySymbol})
                </label>
                <div className="relative">
                  <input
                    id="fixedFee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={fixedFee}
                    onChange={(e) => setFixedFee(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors pr-8"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-semibold text-xs">{currencySymbol}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="feeAlert" className="font-semibold text-slate-700 block">
                  Fee Difference Alert ({currencySymbol})
                </label>
                <div className="relative">
                  <input
                    id="feeAlert"
                    type="number"
                    step="0.10"
                    min="0"
                    value={feeDifferenceAlert}
                    onChange={(e) => setFeeDifferenceAlert(e.target.value)}
                    placeholder="1.50"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors pr-8"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-semibold text-xs">{currencySymbol}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
              ReconcileX compares the actual fee in your payment report with these expected charges.
            </div>
          </section>

          {/* ================================================== */}
          {/* 3. VERIFICATION RULES */}
          {/* ================================================== */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Verification Rules</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <label className="flex items-start gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={autoApproveMatches}
                  onChange={(e) => setAutoApproveMatches(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    Automatically approve exact matches
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Mark a payment as matched when the key details and amount agree.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={flagDelayedDeposits}
                  onChange={(e) => setFlagDelayedDeposits(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div className="w-full">
                  <span className="font-bold text-slate-800 block text-xs">
                    Flag delayed bank deposits
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Ask for review when a payment has not reached your bank within the configured time window.
                  </span>

                  {flagDelayedDeposits && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">Expected bank deposit window:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="14"
                          value={depositWindowDays}
                          onChange={(e) => setDepositWindowDays(e.target.value)}
                          className="w-16 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <span className="text-slate-500 font-medium">business days</span>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
