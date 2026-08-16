# Vitru · Sofia/Edu — rotina acadêmica por voz

Protótipo demonstrável para o Hackathon Vitru. A Sofia (Uniasselvi) ou o Edu (UniCesumar) conversa com o aluno por voz, entende a rotina real, monta uma semana possível e publica os compromissos acadêmicos no calendário integrado.

## O que a banca deve ver

1. O aluno escolhe a identidade da instituição e toca em **Falar**.
2. A conversa Realtime coleta apenas informações que não estão na grade acadêmica: disponibilidade, trabalho, deslocamentos, preferências e compromissos.
3. O sistema extrai uma rotina estruturada, esclarece apenas conflitos essenciais e gera uma semana de segunda a domingo.
4. **Atualizar calendário** grava o recorte acadêmico em JSON estruturado no navegador.
5. O menu lateral abre o **Calendário acadêmico** e o **Analytics**.

## Entregas do produto

### Onboarding por voz

- WebRTC com sessão Realtime efêmera criada pelo backend.
- Sofia para Uniasselvi e Edu para UniCesumar, com voz e identidade visual próprias.
- Transcrição, encerramento manual e rodada curta de esclarecimento quando existe um conflito real.
- Campo de texto disponível como fallback para demonstração sem microfone.

### Planejamento semanal

- A grade de `Aulas.json` é a fonte da aula fixa e das ofertas temporárias.
- O planejador preserva aulas confirmadas, respeita sono, trabalho e compromissos e valida sobreposições.
- O resultado é validado por schema antes de chegar à interface.
- Atividades autônomas mantêm a disciplina selecionada; não são apresentadas como novas aulas.

### Calendário acadêmico

- A ação **Atualizar calendário** persiste somente o recorte acadêmico no contrato `sofiaAcademicCalendar.v2`.
- A rota `/calendario/` exibe uma grade semanal de segunda a domingo, das 00:00 às 23:59.
- Cada compromisso é clicável e abre seus detalhes ao lado do card de recompensas.
- A meta do dia usa os eventos realmente importados. Quando não há uma tarefa acadêmica, a tela não inventa uma atividade.

### Analytics

- O botão de acesso fica no menu lateral e abre `/analytics/`.
- O dashboard é uma indicação visual com dados demonstrativos; não existe integração direta com banco ou com o calendário nesta versão.
- O objetivo da tela é mostrar como os dados de agenda e engajamento podem alimentar indicadores executivos em uma próxima etapa.

## Arquitetura

```text
Front/SOFIA-EDU-CHAT       interface principal e menu lateral
        │
        ├── /api/realtime/session   credencial efêmera de voz
        ├── /api/routine/extract    rotina estruturada
        └── /api/schedule           semana validada
                    │
                    ▼
              shared/               schemas, regras e contrato do calendário
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  /calendario/             /analytics/
  visão acadêmica          dashboard indicativo
```

| Camada | Local | Responsabilidade |
| --- | --- | --- |
| Interface | `Front/SOFIA-EDU-CHAT/sofia&Edu-chat` | Chat, identidade visual, voz e atalhos |
| Sessão de voz | `client/src/voice` | WebRTC, eventos Realtime e diagnósticos |
| Backend | `server/` | Sessões, extração, planejamento e validação |
| Domínio compartilhado | `shared/` | Tipos, schemas, regras de rotina e importação acadêmica |
| Calendário | `Calendário/sistema-de-recompensa-/calendario` | Grade semanal e detalhes de compromissos |
| Analytics | `Analytics/vitru-analytics-dashboard` | Dashboard demonstrativo acessível pelo menu |

## Como executar

Use Node.js 20 LTS ou 22 LTS. Node 21 não está na faixa suportada pelo Vite usado no projeto.

A instalação deve ser feita a partir da raiz do repositório, e o Analytics possui dependências próprias:

```bash
npm install
npm --prefix Analytics/vitru-analytics-dashboard install
cp .env.example .env
npm run dev
```

No PowerShell:

```powershell
Set-Location "C:\caminho\para\Hackathon Vitru"
npm install
npm --prefix ".\Analytics\vitru-analytics-dashboard" install
Copy-Item .env.example .env
npm run dev
```

Preencha `OPENAI_API_KEY` no `.env`. A chave fica somente no backend; o navegador recebe uma credencial efêmera para a sessão de voz.

## URLs da demonstração

- Chat principal: <http://localhost:5173/>
- Painel de diagnóstico: <http://localhost:5173/?debug=true>
- Calendário acadêmico: <http://localhost:5173/calendario/>
- Analytics: <http://localhost:5173/analytics/>
- Servidor local: <http://localhost:3001/>

Durante o desenvolvimento, `npm run dev` inicia client, server e Analytics. O Vite encaminha `/api`, `/calendario` e `/analytics` para os serviços correspondentes.

## Configuração local

O `.env.example` contém os valores demonstrativos:

```env
OPENAI_API_KEY=
PORT=3001
REALTIME_MODEL=gpt-realtime-2.1
PLANNER_MODEL=gpt-5.6-luna
PLANNER_REASONING_EFFORT=high
REALTIME_VOICE=marin
REALTIME_NOISE_REDUCTION=near_field
REALTIME_VAD_EAGERNESS=medium
REALTIME_REASONING_EFFORT=low
REALTIME_MAX_OUTPUT_TOKENS=2048
VOICE_DIAGNOSTICS=false
```

Ative `VOICE_DIAGNOSTICS=true` somente quando precisar investigar uma sessão. Os registros são locais e ficam em `logs/voice-sessions/`, que não faz parte da submissão.

## Validação antes da banca

```bash
npm test
npm run check
npm run build
```

O build inclui o dashboard Analytics. Para uma apresentação sem chamadas reais à API, a interface visual e o calendário continuam navegáveis, mas a conversa por voz e a geração de uma nova semana exigem `OPENAI_API_KEY`.

## Limites conhecidos da versão demonstrável

- `Aulas.json` é uma fixture local; a integração com SIS/AVA ainda é um próximo passo.
- O calendário usa `localStorage` para demonstrar o contrato de importação; não há persistência de produção.
- O Analytics usa dados mockados e não consome diretamente a agenda.
- Não há link real para uma tarefa no AVA; o calendário mostra o compromisso importado e seus detalhes.
- Logs, dependências instaladas, builds e segredos locais ficam fora do Git.
