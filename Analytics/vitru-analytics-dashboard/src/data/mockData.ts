import type { MockData } from '../types';

// ============================================================
// DADOS REAIS DO DATASET (457.427 alunos, 55.884 calouros)
// ============================================================
// Total alunos no dataset:              457.427
// Calouros (TP_ALUNO = CALOURO):        55.884  (12,2% do total)
// Nunca acessaram AVA (QT_DIA_ACESSO_TOTAL = 0): 97.638 (21,3%)
// Acessaram AVA pelo menos 1 dia:       359.789 (78,7%)
// Nunca entregaram atividade (PC_ATIVIDADE_ENTREGUE = 0): 66,2%
// Nunca fizeram prova (PC_DESEMP_PROVA = 0): 41,1%
// "Fantasmas" (prova=0 E atividade=0):  32,0%
// Fez questionário Espaço Calouro:      ~9,7% dos calouros
// ============================================================

export const mockData: MockData = {
  uniasselvi: {
    id: 'uniasselvi',
    label: 'Uniasselvi',
    dashboardTitle: 'Análise do Resgate de Calouros da Sofia',
    assistantName: 'Sofia',
    // Cores extraídas diretamente do AVA da Uniasselvi (print do usuário)
    colorPrimary: '#FFD100',    // Amarelo institucional — uso decorativo/fundo
    colorGraphic: '#C49D00',    // Amarelo escuro — objetos gráficos (3,2:1 s/ branco)
    colorAccentText: '#8A6E00', // Dourado escuro — textos de acento (5,2:1 s/ branco)
    colorNeutral: '#94A3B8',    // Slate-400 — série "Cenário Atual"
    colorBackground: '#1A1A1A', // Preto AVA Uniasselvi (para badge/contraste)
    funnelSteps: [
      // Avaliações da Uniasselvi: I, II, III (Discursiva), IV (Prova Final)
      // PC_ATIVIDADE_ENTREGUE real médio: 33,8% (66,2% nunca entregam nada)
      // PC_DESEMP_PROVA real: 58,9% tentam a prova final
      { step: 'Avaliação I',         atual: 33.8, projetado: 72.0 },
      { step: 'Avaliação II',        atual: 31.2, projetado: 69.5 },
      { step: 'Aval. III (Disc.)',   atual: 29.5, projetado: 67.0 },
      { step: 'Aval. IV (Final)',    atual: 58.9, projetado: 80.0 },
    ],
    // Cards individuais por avaliação (percentual que entrega cada etapa)
    // Dados mockados para demonstração — PC_ATIVIDADE_ENTREGUE é agregado
    assessments: [
      { id: 'av1', label: 'Avaliação I',       atual: 33.8, projetado: 72.0 },
      { id: 'av2', label: 'Avaliação II',      atual: 31.2, projetado: 69.5 },
      { id: 'av3', label: 'Aval. III (Disc.)', atual: 29.5, projetado: 67.0 },
      { id: 'av4', label: 'Aval. IV (Final)',  atual: 58.9, projetado: 80.0 },
    ],
    kpis: [
      {
        id: 'adoption',
        icon: 'Users',
        title: 'Onboarding com a Sofia',
        value: '84,0%',
        context: '',
        contextHtml: 'Dos <strong>44.207</strong> calouros que acessaram o AVA, <strong>40.200</strong> iniciaram e <strong>37.134</strong> finalizaram a criação da agenda',
        sourceMetric: 'Calouros com QT_DIA_ACESSO_TOTAL>0: 44.207 (79,1% dos 55.884 calouros); 84% conversão',
      },
      {
        id: 'ghost',
        icon: 'UserX',
        title: 'Sem Entregas na 1ª Disciplina',
        value: '68% → 28%',
        context: '',
        contextHtml: '<strong>38.025</strong> calouros sem nenhuma entrega na 1ª disciplina vs. <strong>15.647</strong> projetados com a Sofia (<strong>22.378</strong> resgatados)',
        sourceMetric: 'PC_ATIVIDADE_ENTREGUE=0; n=38.025 (68,0% dos 55.884 calouros na 1ª disciplina)',
      },
      {
        id: 'revenue',
        icon: 'DollarSign',
        title: 'Receita Prospectada (LTV Potencial)',
        value: 'R$ 108,9 mi',
        context: 'LTV potencial acumulado (~R$ 13.920/aluno) destravado ao resgatar 22.378 calouros na etapa crítica da 1ª disciplina.',
        contextHtml: 'LTV potencial acumulado (~R$ 13.920/aluno) destravado ao resgatar <strong>22.378</strong> calouros na etapa crítica da 1ª disciplina.',
        sourceMetric: '22.378 calouros retidos × retenção ponderada de curso',
      },
      {
        id: 'time',
        icon: 'Clock',
        title: 'Tempo de Interação',
        value: '1m 20s',
        context: 'tempo médio do onboarding completo com a Sofia',
        sourceMetric: 'Estimativa wizard — dado mockado para demonstração',
      },
    ],
  },

  unicesumar: {
    id: 'unicesumar',
    label: 'UniCesumar',
    dashboardTitle: 'Análise do Resgate de Calouros do Edu',
    assistantName: 'Edu',
    // Azul institucional UniCesumar (extraído do logo oficial)
    colorPrimary: '#005BAA',    // Azul UniCesumar — principal
    colorGraphic: '#005BAA',    // Azul — objetos gráficos (6,2:1 s/ branco)
    colorAccentText: '#004080', // Azul escuro — textos (8,1:1 s/ branco)
    colorNeutral: '#94A3B8',
    colorBackground: '#FFFFFF',
    funnelSteps: [
      // Metodologia UniCesumar: A.E. (Atividades de Estudo) + M.A.P.A. + Presencial
      { step: 'A.E. 01 (Obj.)',     atual: 33.8, projetado: 72.0 },
      { step: 'A.E. 02 (Obj.)',     atual: 31.5, projetado: 69.0 },
      { step: 'A.E. 03 (Obj.)',     atual: 29.8, projetado: 67.5 },
      { step: 'M.A.P.A.',           atual: 27.2, projetado: 64.0 },
      { step: 'Aval. Presencial',   atual: 58.9, projetado: 79.5 },
    ],
    assessments: [
      { id: 'ae1',      label: 'A.E. 01 (Obj.)',   atual: 33.8, projetado: 72.0 },
      { id: 'ae2',      label: 'A.E. 02 (Obj.)',   atual: 31.5, projetado: 69.0 },
      { id: 'ae3',      label: 'A.E. 03 (Obj.)',   atual: 29.8, projetado: 67.5 },
      { id: 'mapa',     label: 'M.A.P.A.',         atual: 27.2, projetado: 64.0 },
      { id: 'presencial',label: 'Aval. Presencial', atual: 58.9, projetado: 79.5 },
    ],
    kpis: [
      {
        id: 'adoption',
        icon: 'Users',
        title: 'Onboarding com o Edu',
        value: '84,0%',
        context: '',
        contextHtml: 'Dos <strong>44.207</strong> calouros que acessaram o AVA, <strong>40.200</strong> iniciaram e <strong>37.134</strong> finalizaram a criação da agenda',
        sourceMetric: 'Calouros com QT_DIA_ACESSO_TOTAL>0: 44.207 (79,1% dos 55.884 calouros); 84% conversão',
      },
      {
        id: 'ghost',
        icon: 'UserX',
        title: 'Sem Entregas na 1ª Disciplina',
        value: '68% → 28%',
        context: '',
        contextHtml: '<strong>38.025</strong> calouros sem nenhuma entrega na 1ª disciplina vs. <strong>15.647</strong> projetados com o Edu (<strong>22.378</strong> resgatados)',
        sourceMetric: 'PC_ATIVIDADE_ENTREGUE=0; n=38.025 (68,0% dos 55.884 calouros na 1ª disciplina)',
      },
      {
        id: 'revenue',
        icon: 'DollarSign',
        title: 'Receita Prospectada (LTV Potencial)',
        value: 'R$ 108,9 mi',
        context: 'LTV potencial acumulado (~R$ 13.920/aluno) destravado ao resgatar 22.378 calouros na etapa crítica da 1ª disciplina.',
        contextHtml: 'LTV potencial acumulado (~R$ 13.920/aluno) destravado ao resgatar <strong>22.378</strong> calouros na etapa crítica da 1ª disciplina.',
        sourceMetric: '22.378 calouros retidos × retenção ponderada de curso',
      },
      {
        id: 'time',
        icon: 'Clock',
        title: 'Tempo de Interação',
        value: '1m 45s',
        context: 'tempo médio do onboarding completo com o Edu',
        sourceMetric: 'Estimativa wizard — dado mockado para demonstração',
      },
    ],
  },
};
