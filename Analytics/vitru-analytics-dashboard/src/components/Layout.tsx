import type { ReactNode } from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
}
