export type BrandId = 'uniasselvi' | 'unicesumar';

export interface FunnelStep {
  step: string;
  atual: number;
  projetado: number;
}

export interface AssessmentStep {
  id: string;
  label: string;
  atual: number;    // % de entrega no cenário atual
  projetado: number; // % de entrega projetada com IA
}

export interface KpiIndicator {
  id: string;
  icon: string;
  title: string;
  value: string;
  context: string;
  contextHtml?: string; // permite <strong> inline para destaques
  sourceMetric?: string;
}

export interface BrandTokens {
  id: BrandId;
  label: string;
  dashboardTitle: string;
  assistantName: string;
  colorPrimary: string;
  colorGraphic: string;
  colorAccentText: string;
  colorNeutral: string;
  colorBackground: string;
  funnelSteps: FunnelStep[];
  assessments: AssessmentStep[];
  kpis: KpiIndicator[];
}

export interface MockData {
  uniasselvi: BrandTokens;
  unicesumar: BrandTokens;
}
