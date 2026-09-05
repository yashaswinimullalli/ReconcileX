'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  X,
  AlertCircle,
  Loader2,
  ShoppingBag,
  CreditCard,
  Landmark,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface CSVUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (batchId: string) => void;
}

// Client-side CSV generator for sample downloads
function downloadSampleCSV(type: 'store' | 'processor' | 'bank') {
  let filename = '';
  let csvContent = '';

  if (type === 'store') {
    filename = '1_store_sales_orders.csv';
    csvContent =
      'merchant_order_id,gross_amount,occurred_at,currency,payment_status\n' +
      'ORD-2026-001,1500.00,2026-01-15T10:30:00Z,INR,CAPTURED\n' +
      'ORD-2026-002,2850.50,2026-01-15T11:15:00Z,INR,CAPTURED\n' +
      'ORD-2026-003,799.00,2026-01-15T12:00:00Z,INR,CAPTURED\n' +
      'ORD-2026-004,4200.00,2026-01-15T14:20:00Z,INR,CAPTURED\n' +
      'ORD-2026-005,1250.00,2026-01-15T16:45:00Z,INR,CAPTURED\n';
  } else if (type === 'processor') {
    filename = '2_payment_gateway_report.csv';
    csvContent =
      'merchant_order_id,processor_transaction_id,gross_amount,fee_amount,net_amount,settlement_batch_id,processor_event_time,currency\n' +
      'ORD-2026-001,pay_RPZ_98124a,1500.00,30.00,1470.00,BATCH-20260116-01,2026-01-15T10:31:00Z,INR\n' +
      'ORD-2026-002,pay_RPZ_98125b,2850.50,57.01,2793.49,BATCH-20260116-01,2026-01-15T11:16:00Z,INR\n' +
      'ORD-2026-003,pay_RPZ_98126c,799.00,15.98,783.02,BATCH-20260116-01,2026-01-15T12:01:00Z,INR\n' +
      'ORD-2026-004,pay_RPZ_98127d,4200.00,84.00,4116.00,BATCH-20260116-01,2026-01-15T14:21:00Z,INR\n' +
      'ORD-2026-005,pay_RPZ_98128e,1250.00,25.00,1225.00,BATCH-20260116-01,2026-01-15T16:46:00Z,INR\n';
  } else if (type === 'bank') {
    filename = '3_bank_statement_payouts.csv';
    csvContent =
      'settlement_batch_id,bank_entry_id,credited_amount,booked_at,currency\n' +
      'BATCH-20260116-01,UTR-HDFC-98234101,10387.51,2026-01-16T15:00:00Z,INR\n';
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface FileSlotProps {
  label: string;
  icon: React.ReactNode;
  file: File | null;
  onFileChange: (file: File | null) => void;
  sampleType: 'store' | 'processor' | 'bank';
  accentColor: string;
}

function FileSlot({ label, icon, file, onFileChange, sampleType, accentColor }: FileSlotProps) {
  const borderColor = file ? 'border-emerald-300 bg-emerald-50/30' : `border-slate-200 hover:border-${accentColor}-300`;

  return (
    <div className={`p-4 rounded-xl border-2 border-dashed ${borderColor} transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => downloadSampleCSV(sampleType)}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
        >
          <Download className="w-3 h-3" />
          <span>Sample</span>
        </button>
      </div>

      {file ? (
        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-emerald-200">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="truncate max-w-[200px]">{file.name}</span>
            <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-xs text-slate-500">
          <UploadCloud className="w-4 h-4" />
          <span>Choose CSV file</span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

export function CSVUploader({ isOpen, onClose, onSuccess }: CSVUploaderProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [processorFile, setProcessorFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filesReady = internalFile && processorFile && bankFile;
  const fileCount = [internalFile, processorFile, bankFile].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalFile || !processorFile || !bankFile) {
      setError('Please upload all 3 files to continue.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('internal_ledger', internalFile);
      formData.append('processor_transactions', processorFile);
      formData.append('bank_settlements', bankFile);

      const res = await api.uploadBatch(formData);
      onSuccess(res.batch_id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Upload Your Files</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              3 CSV files needed to check your money
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <FileSlot
            label="1. Store Sales / Orders"
            icon={<ShoppingBag className="w-4 h-4 text-blue-600" />}
            file={internalFile}
            onFileChange={setInternalFile}
            sampleType="store"
            accentColor="blue"
          />

          <FileSlot
            label="2. Payment Gateway Report"
            icon={<CreditCard className="w-4 h-4 text-indigo-600" />}
            file={processorFile}
            onFileChange={setProcessorFile}
            sampleType="processor"
            accentColor="indigo"
          />

          <FileSlot
            label="3. Bank Statement"
            icon={<Landmark className="w-4 h-4 text-emerald-600" />}
            file={bankFile}
            onFileChange={setBankFile}
            sampleType="bank"
            accentColor="emerald"
          />

          {/* Footer */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <span className="text-xs text-slate-400">
              {fileCount}/3 files selected
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !filesReady}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload & Check</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
