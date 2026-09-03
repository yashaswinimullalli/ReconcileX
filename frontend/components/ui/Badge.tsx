import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className = '' }: BadgeProps) {
  const normalized = status.toUpperCase();

  let colors = 'bg-slate-100 text-slate-700 border-slate-300';
  let dotColor = 'bg-slate-400';

  if (normalized === 'AUTO_RESOLVE' || normalized === 'MATCHED') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    dotColor = 'bg-emerald-500';
  } else if (normalized === 'NEEDS_REVIEW' || normalized === 'AMBIGUOUS_MATCH' || normalized === 'PARTIAL_SETTLEMENT') {
    colors = 'bg-amber-50 text-amber-700 border-amber-300';
    dotColor = 'bg-amber-500';
  } else if (
    normalized === 'EXCEPTION' ||
    normalized.includes('MISMATCH') ||
    normalized.includes('DUPLICATE') ||
    normalized.includes('INVALID') ||
    normalized.includes('MISSING')
  ) {
    colors = 'bg-rose-50 text-rose-700 border-rose-300';
    dotColor = 'bg-rose-500';
  } else if (normalized.includes('REFUND')) {
    colors = 'bg-purple-50 text-purple-700 border-purple-300';
    dotColor = 'bg-purple-500';
  } else if (normalized === 'LATE_SETTLEMENT') {
    colors = 'bg-orange-50 text-orange-700 border-orange-300';
    dotColor = 'bg-orange-500';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${colors} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function LevelBadge({ level }: { level: string }) {
  const isL1 = level === 'L1_ORDER';
  return (
    <span
      className={`inline-flex items-center text-xs font-mono font-medium px-2 py-0.5 rounded border ${
        isL1
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
      }`}
    >
      {isL1 ? 'L1: ORDER' : 'L2: SETTLEMENT'}
    </span>
  );
}
