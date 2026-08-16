import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

export function AssessmentGrid() {
  const { tokens } = useTheme();

  return (
    <section aria-label="Entrega por avaliação">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-700">
          Aumento na Entrega por Avaliação
        </h2>
        <span className="text-xs text-slate-400 italic">
          * Cenário Projetado são estimativas para demonstração
        </span>
      </div>

      <div
        className={cn(
          'grid gap-3',
          tokens.assessments.length <= 4
            ? 'grid-cols-2 sm:grid-cols-4'
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        )}
      >
        {tokens.assessments.map(assessment => {
          const delta = assessment.projetado - assessment.atual;
          const deltaLabel = `+${delta.toFixed(1)}%`;
          const projectedCount = Math.round(55884 * (assessment.projetado / 100)).toLocaleString('pt-BR');

          return (
            <article
              key={assessment.id}
              className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              tabIndex={0}
              aria-label={`${assessment.label}: atual ${assessment.atual.toFixed(1)}%, projetado ${assessment.projetado.toFixed(1)}%`}
            >
              {/* Label */}
              <p className="text-xs font-semibold text-slate-500 leading-tight">
                {assessment.label}
              </p>

              {/* Barra de progresso dupla */}
              <div className="flex flex-col gap-1.5">
                {/* Cenário Atual */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-slate-400">Atual</span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {assessment.atual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${assessment.atual}%`,
                        backgroundColor: tokens.colorNeutral,
                      }}
                    />
                  </div>
                </div>

                {/* Cenário Projetado */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px]" style={{ color: tokens.colorAccentText }}>
                      Com {tokens.assistantName}
                    </span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: tokens.colorAccentText }}
                    >
                      {assessment.projetado.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{
                        width: `${assessment.projetado}%`,
                        backgroundColor: tokens.colorGraphic,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Delta e Contagem Absoluta */}
              <p
                className="text-base font-bold tracking-tight mt-1"
                style={{ color: tokens.colorAccentText }}
              >
                {deltaLabel}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight">
                <strong className="text-slate-700">~{projectedCount}</strong> alunos projetados nesta etapa
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
