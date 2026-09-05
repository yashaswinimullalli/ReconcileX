'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ViewMode = 'retailer' | 'pro';

interface ViewModeContextType {
  mode: ViewMode;
  toggleMode: () => void;
  setMode: (mode: ViewMode) => void;
  isRetailer: boolean;
}

const ViewModeContext = createContext<ViewModeContextType>({
  mode: 'retailer',
  toggleMode: () => {},
  setMode: () => {},
  isRetailer: true,
});

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  // Application is exclusively focused on Plain English Retailer View
  const mode: ViewMode = 'retailer';
  const setMode = () => {};
  const toggleMode = () => {};

  useEffect(() => {
    try {
      localStorage.setItem('reconcilex_view_mode', 'retailer');
    } catch {
      // ignore
    }
  }, []);

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        toggleMode,
        setMode,
        isRetailer: true,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
