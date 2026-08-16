import { useTheme } from '../context/ThemeContext';
import { ThemeSwitcher } from './ThemeSwitcher';

export function Header() {
  const { tokens } = useTheme();

  const isUniasselvi = tokens.id === 'uniasselvi';

  return (
    <header
      className="sticky top-0 z-10 shadow-sm"
      style={{
        backgroundColor: isUniasselvi ? tokens.colorBackground : '#FFFFFF',
        borderBottom: isUniasselvi
          ? `3px solid ${tokens.colorPrimary}`
          : '1px solid #E2E8F0',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Barra vertical colorida */}
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: tokens.colorPrimary }}
            aria-hidden="true"
          />
          {/* Logo pill com cor da marca */}
          <span
            className="text-[10px] font-bold px-2 py-1 rounded"
            style={{
              backgroundColor: tokens.colorPrimary,
              color: isUniasselvi ? '#1A1A1A' : '#FFFFFF',
              letterSpacing: '0.05em',
            }}
          >
            {tokens.label.toUpperCase()}
          </span>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: isUniasselvi ? '#FFFFFF' : '#1E293B' }}
          >
            {tokens.dashboardTitle}
          </h1>
        </div>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
