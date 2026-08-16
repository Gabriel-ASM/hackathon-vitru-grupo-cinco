import { useTheme } from '../context/ThemeContext';
import { KpiCard } from './KpiCard';
import { RevenueCard } from './RevenueCard';

export function KpiGrid() {
  const { tokens } = useTheme();

  return (
    <section aria-label="Indicadores executivos">
      <h2 className="sr-only">Indicadores executivos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tokens.kpis.map(kpi =>
          kpi.id === 'revenue' ? (
            <RevenueCard key={kpi.id} indicator={kpi} tokens={tokens} />
          ) : (
            <KpiCard key={kpi.id} indicator={kpi} accentColor={tokens.colorAccentText} />
          )
        )}
      </div>
    </section>
  );
}
