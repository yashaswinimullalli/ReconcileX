import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    neutral?: boolean;
  };
  highlightColor?: 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo';
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  highlightColor = 'blue',
}: KPICardProps) {
  const colorBorders = {
    emerald: 'hover:border-emerald-300',
    amber: 'hover:border-amber-300',
    rose: 'hover:border-rose-300',
    blue: 'hover:border-blue-300',
    indigo: 'hover:border-indigo-300',
  }[highlightColor];

  const iconBg = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  }[highlightColor];

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm transition-all duration-150 ${colorBorders}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.neutral
                ? 'text-slate-500'
                : trend.isPositive
                ? 'text-emerald-600'
                : 'text-rose-600'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
