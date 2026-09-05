import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'ReconcileX — AI Finance Controller',
  description:
    'AI Finance Controller for multi-source financial reconciliation, discrepancy detection, and explainable exceptions. Razorpay Track 04.',
};

import { ClientProviders } from '@/components/providers/ClientProviders';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen flex">
        <ClientProviders>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
            {children}
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
