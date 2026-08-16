# Vitru Analytics

Dashboard executivo demonstrativo acessível pelo atalho **Analytics** do menu lateral.

## Escopo atual

- React, Vite, TypeScript, Tailwind CSS e Recharts.
- Alternância visual entre Uniasselvi e UniCesumar.
- KPIs, funil e indicadores de retenção com dados demonstrativos.
- Sem leitura direta do calendário, banco Vitru ou Salesforce nesta versão.

## Executar isoladamente

A partir da raiz do repositório:

```bash
npm --prefix Analytics/vitru-analytics-dashboard install
npm --prefix Analytics/vitru-analytics-dashboard run dev -- --host 127.0.0.1 --port 5174
```

Na demonstração completa, basta usar `npm run dev` na raiz. O Vite encaminha `/analytics/` para este dashboard.
