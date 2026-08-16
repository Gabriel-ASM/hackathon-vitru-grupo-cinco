import {
  Users, TrendingUp, DollarSign, Clock, UserX,
  type LucideProps,
} from 'lucide-react';
import type { FunctionComponent } from 'react';
import type { KpiIndicator } from '../types';
import { cn } from '../lib/utils';

const iconMap: Record<string, FunctionComponent<LucideProps>> = {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Ghost: UserX, // Lucide não tem Ghost; UserX representa "aluno sumido"
  UserX,
};

interface KpiCardProps {
  indicator: KpiIndicator;
  accentColor: string;
}

export function KpiCard({ indicator, accentColor }: KpiCardProps) {
  const Icon = iconMap[indicator.icon] ?? Users;

  return (
    <article
      className={cn(
        'bg-white rounded-xl shadow-sm p-5 flex flex-col gap-3',
        'hover:-translate-y-1 hover:shadow-md focus-within:shadow-md',
        'transition-all duration-300 cursor-default outline-none',
      )}
      tabIndex={0}
      aria-label={`${indicator.title}: ${indicator.value}`}
    >
      <div className="flex items-center gap-2">
        <Icon size={18} aria-hidden="true" style={{ color: accentColor }} />
        <span className="text-sm font-medium text-slate-500">{indicator.title}</span>
      </div>
      <p
        className="text-3xl font-bold tracking-tight leading-none"
        style={{ color: accentColor }}
      >
        {indicator.value}
      </p>
      <p className="text-xs text-slate-400 leading-snug">
        {indicator.contextHtml
          // eslint-disable-next-line react/no-danger
          ? <span dangerouslySetInnerHTML={{ __html: indicator.contextHtml }} />
          : indicator.context}
      </p>
    </article>
  );
}
