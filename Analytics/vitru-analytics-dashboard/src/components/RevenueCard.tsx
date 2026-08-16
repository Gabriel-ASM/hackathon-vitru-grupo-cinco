import { DollarSign } from 'lucide-react';
import type { BrandTokens, KpiIndicator } from '../types';
import { cn } from '../lib/utils';

interface RevenueCardProps {
  indicator: KpiIndicator;
  tokens: BrandTokens;
}

export function RevenueCard({ indicator, tokens }: RevenueCardProps) {

  return (
    <article
      className={cn(
        'bg-white rounded-xl shadow-md p-5 flex flex-col gap-3',
        'border-l-4',
        'hover:-translate-y-1 hover:shadow-lg focus-within:shadow-lg',
        'transition-all duration-300 cursor-default outline-none',
      )}
      style={{ borderLeftColor: tokens.colorGraphic }}
      tabIndex={0}
      aria-label={`${indicator.title}: ${indicator.value}`}
    >

      <div className="flex items-center gap-2">
        <DollarSign
          size={18}
          aria-hidden="true"
          style={{ color: tokens.colorAccentText }}
        />
        <span className="text-sm font-medium text-slate-500">{indicator.title}</span>
      </div>

      <p
        className="text-3xl font-bold tracking-tight leading-none"
        style={{ color: tokens.colorAccentText }}
      >
        {indicator.value}
      </p>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-slate-500 font-medium">
          Custo IA (OpenAI API):{' '}
          <span className="font-bold text-slate-700">R$ 0,15/aluno</span> (~R$ 8,3 mil total)
        </p>
        <p className="text-xs text-slate-400 leading-snug">
          {indicator.contextHtml
            // eslint-disable-next-line react/no-danger
            ? <span dangerouslySetInnerHTML={{ __html: indicator.contextHtml }} />
            : indicator.context}
        </p>
      </div>
    </article>
  );
}
