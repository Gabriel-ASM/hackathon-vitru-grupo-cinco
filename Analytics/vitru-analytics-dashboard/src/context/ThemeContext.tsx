import { createContext, useContext, useState, type ReactNode } from 'react';
import { mockData } from '../data/mockData';
import type { BrandId, BrandTokens } from '../types';

interface ThemeContextValue {
  brandId: BrandId;
  tokens: BrandTokens;
  setBrand: (id: BrandId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [brandId, setBrandId] = useState<BrandId>('uniasselvi');

  const setBrand = (id: BrandId) => {
    if (id !== 'uniasselvi' && id !== 'unicesumar') {
      console.warn(`[ThemeProvider] Marca desconhecida rejeitada: "${id}"`);
      return;
    }
    setBrandId(id);
  };

  return (
    <ThemeContext.Provider value={{ brandId, tokens: mockData[brandId], setBrand }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
