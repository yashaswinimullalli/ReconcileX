'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TableProperties,
  AlertTriangle,
  LineChart,
  FileCheck2,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const navItems = [
  {
    name: 'Control Center',
    href: '/',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: 'Reconciliation',
    href: '/reconciliation',
    icon: TableProperties,
    badge: null,
  },
  {
    name: 'Exceptions Queue',
    href: '/exceptions',
    icon: AlertTriangle,
    badge: 'Review',
    badgeColor: 'bg-amber-100 text-amber-800',
  },
  {
    name: 'Evaluation & ML',
    href: '/evaluation',
    icon: LineChart,
    badge: 'Metrics',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  {
    name: 'Audit & Export',
    href: '/audit',
    icon: FileCheck2,
    badge: null,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 min-h-screen flex flex-col border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl tracking-tighter">
          Rx
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-white">ReconcileX</span>
            <span className="text-[10px] font-semibold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded">
              AI
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Finance Controller</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Operations
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Track info / Footer */}
      <div className="p-4 border-t border-slate-800 text-xs">
        <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-1.5 text-blue-400 font-semibold text-[11px] mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Track 04: AI Finance Controller</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Razorpay AI Buildathon 2026. Automated multi-source reconciliation loop with explainability.
          </p>
        </div>
      </div>
    </aside>
  );
}
