'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TableProperties,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useViewMode } from '@/lib/ViewModeContext';

export function Sidebar() {
  const pathname = usePathname();
  const { isRetailer } = useViewMode();

  // Hide sidebar completely on the landing page
  if (pathname === '/') {
    return null;
  }

  const navItems = [
    {
      name: 'Cash Overview',
      desc: 'Where is my money?',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: '',
    },
    {
      name: 'Orders & Payouts',
      desc: 'Customer bills vs bank',
      href: '/reconciliation',
      icon: TableProperties,
      badge: null,
      badgeColor: '',
    },
    {
      name: 'Money Issues',
      desc: 'Payments & deposit gaps',
      href: '/exceptions',
      icon: AlertTriangle,
      badge: 'Review',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    },
    {
      name: 'Reports',
      desc: 'Tax & accountant files',
      href: '/audit',
      icon: FileCheck2,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 min-h-screen flex flex-col border-r border-slate-800 select-none">
      {/* Brand Header */}
      <Link href="/" className="p-5 border-b border-slate-800 flex items-center gap-3 hover:bg-slate-800/40 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl tracking-tighter">
          Rx
        </div>
        <div>
          <div className="font-bold text-lg tracking-tight text-white leading-tight">
            ReconcileX
          </div>
          <div className="text-[10px] text-slate-400 font-medium">AI Finance Controller</div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Store Operations
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="truncate">
                  <div className="leading-tight truncate">{item.name}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </div>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Retailer Quick-Guide Box */}
      <div className="p-4 border-t border-slate-800 text-xs">
        {isRetailer ? (
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-800/80 rounded-xl p-3 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>How It Protects Your Money</span>
            </div>
            <ol className="text-[10px] text-slate-300 space-y-1 leading-snug list-decimal list-inside">
              <li>Checks customer orders against payment app fees</li>
              <li>Confirms exact cash deposited in your bank</li>
              <li>Spot and investigate unexplained fees and gaps</li>
            </ol>
          </div>
        ) : (
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-1.5 text-blue-400 font-semibold text-[11px] mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Track 04: AI Finance Controller</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Razorpay AI Buildathon 2026. Automated multi-source reconciliation loop with explainability.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
