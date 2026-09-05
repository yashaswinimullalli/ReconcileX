'use client';

import React from 'react';
import { ViewModeProvider } from '@/lib/ViewModeContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ViewModeProvider>{children}</ViewModeProvider>;
}
