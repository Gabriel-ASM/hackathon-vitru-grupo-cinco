# 📊 Vitru Analytics — Análise do Resgate de Calouros (Sofia / Edu)

> **Hackathon Vitru 2026** · Dashboard Executivo B2B de Retenção Acadêmica e Viabilidade Financeira

Este repositório contém o **Dashboard Executivo de Tela Única** desenvolvido para demonstrar o impacto do tutor/mentor de IA via WhatsApp (**Sofia** na Uniasselvi e **Edu** na UniCesumar) no resgate de calouros e na blindagem de receita da Vitru Educação.

---

## 🎯 Principais Indicadores & Métricas

* 👥 **Onboarding com a Sofia/Edu (84,0%):** De 44.207 calouros que acessaram o AVA, 40.200 iniciaram e 37.134 finalizaram a criação da agenda de estudos adaptativa.
* 📉 **Sem Entregas na 1ª Disciplina (68% ➔ 28%):** Redução maciça de calouros "fantasma", resgatando **22.378 calouros** que passariam a primeira disciplina sem nenhuma entrega.
* 💰 **Receita Prospectada (LTV Potencial — R$ 108,9 mi):** LTV potencial acumulado (~R$ 13.920/aluno) destravado pelo resgate na etapa crítica da 1ª disciplina contra um custo de IA de apenas **R$ 0,15/aluno** (~R$ 8,3 mil total).
* ⏱️ **Tempo de Interação (1m 20s):** Fluxo ágil, acolhedor e sem digitação cansativa no celular.
* 🔄 **White-Label Theme Switcher:** Alternância instantânea de dados, cores institucionais e etapas de funil entre **Uniasselvi** (Sofia) e **UniCesumar** (Edu).

---

## 🗄️ Integração com o Banco da Vitru

Para detalhes de arquitetura de dados, parâmetros coletados e exemplo de payload JSON para ingestão no SIS, Data Lake e Salesforce da Vitru, consulte:

👉 **[PARAMETROS_BANCO_VITRU.md](./PARAMETROS_BANCO_VITRU.md)**

---

## 🚀 Como Executar o Projeto

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Gerar build de produção
npm run build
```

Acesse em seu navegador em `http://localhost:5173`.

---

## 🛠️ Stack Tecnológica

* **Framework:** React 19 + Vite + TypeScript
* **Estilização:** Tailwind CSS v4 + Lucide Icons
* **Gráficos:** Recharts
* **Acessibilidade:** Padrões WCAG 2.1 e navegação completa por teclado
