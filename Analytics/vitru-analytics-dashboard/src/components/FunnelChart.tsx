import { Component, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

// Error boundary para o Recharts
class ChartErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-[320px] text-sm text-slate-400">
          Visualização do gráfico temporariamente indisponível.
        </div>
      );
    }
    return this.props.children;
  }
}

function FunnelChartInner() {
  const { tokens } = useTheme();

  const firstStep = tokens.funnelSteps[0];
  const lastStep = tokens.funnelSteps[tokens.funnelSteps.length - 1];
  const ariaLabel =
    `Comparativo de retenção — ${tokens.assistantName}. ` +
    `Etapa inicial (${firstStep.step}): Cenário Atual ${firstStep.atual.toFixed(1)}%, ` +
    `Cenário Projetado ${firstStep.projetado.toFixed(1)}%. ` +
    `Etapa final (${lastStep.step}): Cenário Atual ${lastStep.atual.toFixed(1)}%, ` +
    `Cenário Projetado ${lastStep.projetado.toFixed(1)}%.`;

  return (
    <section aria-label="Funil comparativo de retenção">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-700">
          Funil de Retenção | Cenário Atual vs. Com {tokens.assistantName}
        </h2>
        <span className="text-xs text-slate-400 italic">
          * Dados do Cenário Projetado são estimativas para demonstração
        </span>
      </div>

      <div
        className="bg-white rounded-xl shadow-sm p-5"
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={tokens.funnelSteps}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={tokens.colorNeutral}  stopOpacity={0.15} />
                <stop offset="95%" stopColor={tokens.colorNeutral}  stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradGraphic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={tokens.colorGraphic} stopOpacity={0.2} />
                <stop offset="95%" stopColor={tokens.colorGraphic} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

            <XAxis
              dataKey="step"
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />

            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />

            <Tooltip
              formatter={(value: unknown) => {
                const num = Array.isArray(value) ? Number(value[0]) : Number(value);
                return isNaN(num) ? ['—'] : [`${num.toFixed(1)}%`];
              }}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
              }}
            />

            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
            />

            <Area
              type="monotone"
              dataKey="atual"
              name="Cenário Atual"
              stroke={tokens.colorNeutral}
              strokeWidth={2}
              fill="url(#gradNeutral)"
              strokeDasharray="5 3"
              dot={{ r: 4, fill: tokens.colorNeutral, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive
              animationDuration={600}
            />

            <Area
              type="monotone"
              dataKey="projetado"
              name={`Com ${tokens.assistantName}`}
              stroke={tokens.colorGraphic}
              strokeWidth={2.5}
              fill="url(#gradGraphic)"
              dot={{ r: 4, fill: tokens.colorGraphic, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function FunnelChart() {
  return (
    <ChartErrorBoundary>
      <FunnelChartInner />
    </ChartErrorBoundary>
  );
}
