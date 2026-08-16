---
type: project-portfolio
tags:
  - projeto/hackathon
  - arquitetura/dados
  - integracao/banco-vitru
  - payload/json
  - pitch/apresentacao
created: 2026-08-16
updated: 2026-08-16
status: active
---

# 🗄️ 36.19 — Parâmetros de Integração & Alimentação do Banco Vitru (Sofia/Edu)

> **Resumo Executivo para Apresentação:**  
> A Sofia (Uniasselvi) e o Edu (UniCesumar) não são apenas assistentes virtuais de chat: eles atuam como **sensores comportamentais de primeira milha**. Este documento consolida os **parâmetros essenciais e de alto valor** que a inteligência artificial coleta na interação de onboarding (1m 20s) e devolve estruturado para enriquecer a base de dados da Vitru (SIS, Data Lake e Salesforce).

---

## 🎯 1. O Princípio: Coleta Mínima, Máximo Valor (Zero Fricção)

A Vitru já possui os dados cadastrais e acadêmicos do calouro. A IA **não pergunta o que o sistema já sabe**. Ela coleta exclusivamente o **contexto invisível de rotina** que hoje impede o aluno de estudar.

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       O QUE A VITRU JÁ POSSUI        │       │      O QUE A SOFIA/EDU DESCOBRE      │
│         (Input do Sistema)           │       │    (Novo Valor para o Banco Vitru)   │
├──────────────────────────────────────┤  ──►  ├──────────────────────────────────────┤
│ • Matrícula & Curso                  │       │ • Janela de estudo viável (ex: 20min)│
│ • Polo / Modalidade                  │       │ • Regime de trabalho & Transporte    │
│ • Disciplinas do Semestre            │       │ • Horários de pico de foco           │
│ • Prazos da 1ª Atividade / Prova     │       │ • Agenda sincronizada (.ics/Google)  │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

---

## 📊 2. Os 5 Blocos de Parâmetros Relevantes (Schema Essencial)

| # | Bloco de Dados | Parâmetros Principais | Tipo | Utilidade para a Vitru |
| :-: | :--- | :--- | :-: | :--- |
| **1** | **Identificação & Sessão** | `aluno_id`<br>`instituicao`<br>`onboarding_concluido` | `UUID`<br>`Enum`<br>`Boolean` | Vincula a sessão ao R.A./Matrícula (`uniasselvi` ou `unicesumar`) e valida que 84% concluíram o fluxo. |
| **2** | **Rotina & Mobilidade** | `regime_trabalho`<br>`tempo_deslocamento_min`<br>`meio_transporte` | `Enum`<br>`Integer`<br>`Enum` | Identifica quem estuda no ônibus/trem, trabalha por escala ou CLT, permitindo calibrar micro-leituras. |
| **3** | **Disponibilidade Real** | `janela_estudo_diaria_min`<br>`dias_preferenciais`<br>`turno_preferencial` | `Integer`<br>`Array`<br>`Enum` | Define se o aluno tem 15, 30 ou 60 minutos livres e se prefere noites ou fins de semana. |
| **4** | **Plano & Compromisso** | `agenda_criada`<br>`canal_lembrete`<br>`data_primeira_microacao` | `Boolean`<br>`Enum`<br>`DateTime` | Alimenta o gatilho da 1ª ação acadêmica (ex: ler 15 min na terça às 20h30) para evitar o abandono. |
| **5** | **Score de Resgate (IA)** | `status_resgate`<br>`indice_consistencia_inicial` | `Enum`<br>`Float (0-100)` | Sinaliza para a gestão B2B que o calouro saiu do grupo de "Risco Fantasma" (68% ➔ 28%). |

---

## 📦 3. Payload JSON Demonstrativo (Exemplo Realista)

Payload compacto e direto enviado via Webhook/API para o banco da Vitru após a finalização do onboarding com a Sofia:

```json
{
  "evento": "onboarding_rotina_concluido",
  "timestamp": "2026-08-16T10:15:30Z",
  "aluno": {
    "aluno_id": "ALU-2026-88421",
    "instituicao": "uniasselvi",
    "polo_id": "SP-IBIRAPUERA-01",
    "curso": "Engenharia de Software"
  },
  "perfil_rotina": {
    "regime_trabalho": "integral_clt",
    "tempo_deslocamento_min": 45,
    "meio_transporte": "transporte_publico"
  },
  "disponibilidade": {
    "tempo_diario_min": 20,
    "dias_selecionados": ["terca", "quinta", "sabado"],
    "turno_preferencial": "noite"
  },
  "planejamento_academico": {
    "agenda_ativa": true,
    "canal_sincronizacao": "google_calendar",
    "primeira_microacao": {
      "disciplina": "Lógica de Programação",
      "atividade_alvo": "Avaliação I",
      "data_agendada": "2026-08-18T20:30:00Z",
      "duracao_min": 20
    }
  },
  "metricas_resgate": {
    "calouro_resgatado": true,
    "score_engajamento_inicial": 88.5
  }
}
```

---

## 💼 4. Por que Esses Dados São Valiosos no Pitch? (Impacto C-Level)

1. **Inteligência Preditiva em Escala:**  
   Com esses 5 parâmetros, a Vitru descobre o mapa comportamental de **+920 mil estudantes**, identificando os horários ideais para envio de nudges e notificações sem incomodar o aluno.
2. **Alimentação Direta do Salesforce:**  
   O campo `primeira_microacao` dispara o fluxo no Salesforce Marketing Cloud para avisar o aluno 10 minutos antes, garantindo que ele cumpra a 1ª atividade.
3. **Redução Comprovada do Aluno Fantasma:**  
   Alimenta os painéis gerenciais provando em tempo real a transição da taxa de calouros sem entregas de **68% para 28%**, destravando os **R$ 108,9 mi em LTV Potencial**.
