'use client';

import React, { useState } from 'react';
import { Play, UploadCloud, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface HeaderProps {
  currentBatchId?: string;
  onBatchChange?: (batchId: string) => void;
  onRefresh?: () => void;
  onOpenUpload?: () => void;
}

export function Header({
  currentBatchId,
  onBatchChange,
  onRefresh,
  onOpenUpload,
}: HeaderProps) {
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);

  const handleRunDemo = async () => {
    try {
      setIsRunningDemo(true);
      const res = await api.runDemoBatch();
      setDemoSuccess(true);
      if (onBatchChange && res.batch_id) {
        onBatchChange(res.batch_id);
      }
      if (onRefresh) onRefresh();
      setTimeout(() => setDemoSuccess(false), 4000);
    } catch (err: any) {
      alert(`Demo batch run failed: ${err.message}`);
    } finally {
      setIsRunningDemo(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      {/* Title / Context */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Financial Operations Console
        </h1>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono border border-slate-200">
          ReconRiver 1,244 Records
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <span>Upload 3 CSVs</span>
          </button>
        )}

        <button
          onClick={handleRunDemo}
          disabled={isRunningDemo}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all ${
            demoSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
          } ${isRunningDemo ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isRunningDemo ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Running Reconciliation Engine...</span>
            </>
          ) : demoSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Reconciled 1,244 Records!</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Benchmark Batch (1,244)</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
