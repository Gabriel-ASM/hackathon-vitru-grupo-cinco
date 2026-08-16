# Especificações para o Agente Kiro (Claude Opus 5)

Este documento contém todo o escopo, arquitetura de dados e os prompts passo-a-passo que devem ser enviados para o Kiro (ou qualquer IA como o Cursor/Windsurf) para construir o `vitru-analytics-dashboard` do zero.

---

## 🎯 Contexto para o Kiro
O objetivo deste projeto é construir uma única tela de **Dashboard Executivo B2B** chamada "Análise de Resgate de Calouros".
Ela servirá para demonstrar à diretoria da Vitru Educação (Uniasselvi/UniCesumar) o impacto do nosso produto (Sofia/Edu - um tutor IA via WhatsApp) na diminuição da evasão e aumento da entrega de atividades dos alunos calouros.

**A Dor:**
Alunos têm um tempo longo para entregar atividades online (Avaliação I, II ou A.E. 01, M.A.P.A.). Por desorganização, eles acabam esquecendo, o que gera uma taxa de apenas `33,8%` de entrega (`PC_ATIVIDADE_ENTREGUE`).
Mesmo perdendo essas atividades, muitos comparecem à Prova Presencial Final (`PC_DESEMP_PROVA` = 58,9%) na tentativa desesperada de salvar o semestre, ou desistem no meio do caminho.

**A Solução:**
Um dashboard comparando o "Cenário Atual" vs "Cenário Projetado com IA", provando que o tutor via WhatsApp resolve essa desorganização, gerando ROI/LTV gigantesco com custo baixíssimo de API.

---

## 📦 Stack e Dependências
Para o Kiro, você deve pedir a instalação destas libs:
- `tailwindcss`, `postcss`, `autoprefixer`
- `lucide-react` (para ícones)
- `recharts` (para os gráficos do funil e retenção)
- `clsx`, `tailwind-merge` (utilitários de classe)

---

## 🚀 PASSO A PASSO (PROMPTS PARA COPIAR E COLAR NO KIRO)

### 📌 PROMPT 1 - Setup Inicial e Componentes Base
*Copie o texto abaixo e jogue no chat do Kiro para iniciar:*

> "Kiro, estamos em um projeto React + Vite + TypeScript recém criado. O nosso objetivo é construir um Dashboard Executivo B2B focado em retenção de alunos para a diretoria da Vitru.
> 
> **Passo 1:** Configure o TailwindCSS corretamente criando o `tailwind.config.js` e o `index.css`.
> **Passo 2:** Instale as dependências: `lucide-react`, `recharts`, `clsx`, e `tailwind-merge`.
> **Passo 3:** Limpe o `App.tsx` e crie um layout base em `src/components/Layout.tsx` com um Header simples. Esse Header deve ter no canto direito um botão/dropdown de "Tema Dinâmico" que permita alternar o estado global entre duas marcas: 'Uniasselvi' e 'UniCesumar'.
> - Se for Uniasselvi: O tema do dashboard deve usar destaques em Amarelo (`#FBBF24` ou similar) e Preto.
> - Se for UniCesumar: O tema deve usar destaques em Azul (`#1D4ED8` ou similar) e Branco.
> 
> Me avise quando concluir o setup para irmos para os dados."

---

### 📌 PROMPT 2 - Mock de Dados e Lógica do Tema
*Copie o texto abaixo e jogue no Kiro:*

> "Excelente. Agora vamos criar os dados mockados em `src/data/mockData.ts`.
> Precisamos de dados que vão popular um 'Funil Comparativo' e 'Cards de Impacto'. A estrutura dos nomes das etapas do funil MUDA de acordo com o tema selecionado.
> 
> Exporte um objeto que contenha dados separados para Uniasselvi e UniCesumar.
> 
> **Para Uniasselvi:**
> - Nome das etapas do Funil: "Avaliação I", "Avaliação II", "Avaliação III (Disc.)", "Avaliação IV (Obj.)".
> - Título do Dash: "Análise do Resgate de Calouros da Sofia"
> 
> **Para UniCesumar:**
> - Nome das etapas do Funil: "A.E. 01", "A.E. 02 + M.A.P.A", "Avaliação Presencial".
> - Título do Dash: "Análise do Resgate de Calouros do Edu"
> 
> **Dados do Funil (para ambos):**
> Os dados do funil devem ter o "Cenário Atual" (baixíssimo no começo, subindo na prova final) vs "Com IA" (retenção altíssima desde o início). Exemplo de estrutura do array para o Recharts:
> `[{ step: 'Etapa 1', atual: 33.8, projetado: 75.0 }, { step: 'Etapa 2', atual: 30.1, projetado: 72.5 }, ...]`
> 
> **KPIs (Cards) para ambos:**
> - Calouros Atingidos: "De 500k calouros, 430k completaram o onboarding."
> - Aumento na Entrega: "+ 41,1% na entrega inicial"
> - ROI / Viabilidade: "Custo IA (OpenAI API): R$ 0,15/aluno | Lucro Retido (LTV Salvo): R$ 12,5 Milhões"
> - Tempo Médio: "1m 45s de interação"
> 
> Crie este arquivo de dados."

---

### 📌 PROMPT 3 - Construção da Tela de Dashboard (Funil e Cards)
*Copie o texto abaixo e jogue no Kiro:*

> "Agora, vamos construir a UI principal da página no `App.tsx` usando o `Layout.tsx` e o `mockData.ts` que criamos.
> 
> A página principal deve conter:
> 
> 1. O título do Dashboard (mudando dinamicamente baseado no tema).
> 2. **Sessão Superior (Cards de Impacto):** Um grid com 4 cards limpos e modernos exibindo as KPIs (Adoção, Aumento na Entrega, ROI e Tempo Médio). Dê um destaque visual luxuoso/premium para o card de **ROI / Viabilidade**, pois ele é o argumento de lucro para a diretoria. Use ícones do Lucide.
> 3. **Sessão Central (O Funil):** Um gráfico grande de Área (AreaChart) ou Barras Laterais (BarChart) do Recharts. Ele deve comparar lado a lado (ou em sobreposição transparente) a linha/barra do 'Cenário Atual' contra o 'Cenário Projetado com IA'. Lembre-se: o nome do eixo X (Etapas) deve pegar os nomes dinâmicos da base dependendo do tema escolhido.
> 4. **Estilo:** O dashboard não pode parecer um 'template admin' genérico. Ele deve ter respiro (padding generoso), cantos levemente arredondados, sombras suaves (`shadow-sm` ou `shadow-md`), sem bordas ultra marcadas. Design limpo estilo Vercel / Linear.
> 
> Gere os componentes e integre tudo."

---

### 📌 PROMPT 4 - Refinamento e Efeitos (Finalização)
*Copie o texto abaixo e jogue no Kiro:*

> "Ficou ótimo! Vamos agora polir e trazer aquele aspecto 'Premium'.
> 
> 1. Adicione animações suaves no Theme Switcher para que a troca de cores entre Amarelo (Uniasselvi) e Azul (UniCesumar) não seja seca. Use classes como `transition-colors duration-500`.
> 2. Nos Cards de KPI, adicione um efeito de hover sutil (`hover:-translate-y-1 hover:shadow-lg transition-all`).
> 3. No gráfico do Recharts, configure as animações (`isAnimationActive={true}`) e ajuste a grossura das linhas/barras para ficarem mais elegantes (use os hex codes primários da marca ativa para a barra de "Com IA" e um cinza suave para a barra "Cenário Atual").
> 4. Certifique-se de que a paleta de fundo geral não é 100% branca, use um fundo off-white (ex: `bg-slate-50` ou `bg-gray-50`) para dar contraste com os cards brancos.
> 
> Faça esses ajustes finais e me entregue a versão pronta para rodar."
