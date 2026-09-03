'use client';

import React, { useState } from 'react';
import { UploadCloud, X, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface CSVUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (batchId: string) => void;
}

export function CSVUploader({ isOpen, onClose, onSuccess }: CSVUploaderProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [processorFile, setProcessorFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [gtFile, setGtFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalFile || !processorFile || !bankFile) {
      setError('Please provide all 3 required CSV files.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('internal_ledger', internalFile);
      formData.append('processor_transactions', processorFile);
      formData.append('bank_settlements', bankFile);
      if (gtFile) {
        formData.append('ground_truth', gtFile);
      }
      if (batchName.trim()) {
        formData.append('name', batchName.trim());
      }

      const res = await api.uploadBatch(formData);
      onSuccess(res.batch_id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Ingest Reconciliation Batch</h2>
            <p className="text-xs text-slate-500">Provide payment, processor, and settlement CSVs</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Merchant Payout Run Jan 2026"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* 1. Internal Ledger */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              1. Internal Ledger CSV <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setInternalFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* 2. Processor Transactions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              2. Processor Transactions CSV <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setProcessorFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* 3. Bank Settlements */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              3. Bank Settlements CSV <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setBankFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* 4. Ground Truth (Optional) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              4. Ground Truth CSV (Optional for Benchmark Evaluation)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setGtFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !internalFile || !processorFile || !bankFile}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Execute Reconciliation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
