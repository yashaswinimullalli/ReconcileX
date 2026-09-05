'use client';

import React, { useState } from 'react';
import { Play, UploadCloud, RefreshCw, CheckCircle2, ShoppingBag, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface HeaderProps {
  currentBatchId?: string;
  onBatchChange?: (batchId: string) => void;
  onRefresh?: () => void;
  onOpenUpload?: () => void;
  onClear?: () => void;
}

export function Header({
  currentBatchId,
  onBatchChange,
  onRefresh,
  onOpenUpload,
  onClear,
}: HeaderProps) {
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Demo batch run failed: ${msg}`);
    } finally {
      setIsRunningDemo(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-end sticky top-0 z-10 shadow-xs">


      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">


        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-slate-600" />
            <span>Upload 3 Files</span>
          </button>
        )}

        {currentBatchId && onClear && (
          <button
            onClick={async () => {
              if (window.confirm('Are you sure you want to clear all data and start completely fresh?')) {
                try {
                  setIsClearing(true);
                  await api.clearAllBatches();
                  onClear();
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : String(e);
                  alert(`Failed to clear: ${msg}`);
                } finally {
                  setIsClearing(false);
                }
              }
            }}
            disabled={isClearing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-2xs transition-colors"
            title="Wipe database and return to clean state"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>{isClearing ? 'Clearing...' : 'Clear'}</span>
          </button>
        )}

        <button
          onClick={handleRunDemo}
          disabled={isRunningDemo}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all ${
            demoSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
          } ${isRunningDemo ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isRunningDemo ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Reconciling...</span>
            </>
          ) : demoSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Reconciliation Complete!</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Reconciliation</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
