import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Building2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { BrandId } from '../types';

const brands: { id: BrandId; label: string }[] = [
  { id: 'uniasselvi', label: 'Uniasselvi' },
  { id: 'unicesumar', label: 'UniCesumar' },
];

export function ThemeSwitcher() {
  const { brandId, setBrand } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const currentIndex = brands.findIndex(b => b.id === brandId);
    if (e.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (currentIndex + 1) % brands.length;
      (listRef.current?.children[next] as HTMLElement)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (currentIndex - 1 + brands.length) % brands.length;
      (listRef.current?.children[prev] as HTMLElement)?.focus();
    }
  }

  function selectBrand(id: BrandId) {
    setBrand(id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        aria-label="Identidade visual"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 cursor-pointer"
      >
        <Building2 size={15} className="text-slate-400" aria-hidden="true" />
        <span>{brands.find(b => b.id === brandId)?.label}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Identidade visual"
          className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50"
        >
          {brands.map(brand => (
            <li
              key={brand.id}
              role="option"
              aria-selected={brand.id === brandId}
              tabIndex={0}
              onClick={() => selectBrand(brand.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectBrand(brand.id);
                }
              }}
              className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-slate-50"
            >
              <span>{brand.label}</span>
              {brand.id === brandId && (
                <Check size={14} className="text-slate-600" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
