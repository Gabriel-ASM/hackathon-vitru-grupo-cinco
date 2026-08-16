# Vitru · rotina por voz

Protótipo local de onboarding acadêmico por voz. A grade de `Aulas.json` é enviada ao agente Realtime, a conversa é transcrita e chamadas posteriores extraem a rotina e geram uma agenda semanal validada.

## Pré-requisitos

- Node.js 20.x, 21.x ou 22.x+
- Chave da API da OpenAI com acesso aos modelos configurados
- Navegador com WebRTC e permissão de microfone

## Instalação

```bash
npm install
npm install --prefix Analytics/vitru-analytics-dashboard
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Preencha `OPENAI_API_KEY` no `.env`. A chave fica apenas no backend; o navegador recebe um token efêmero para a sessão Realtime.

## Execução

```bash
npm run dev
```

Abra <http://localhost:5173>. Para acompanhar transcrição, extração, planejamento e eventos técnicos, use <http://localhost:5173/?debug=true>.

O comando principal também sobe o dashboard Analytics internamente e o expõe em <http://localhost:5173/analytics/>. O Calendário acadêmico fica disponível em <http://localhost:5173/calendario/>; os dois atalhos também aparecem no menu lateral do chat.

## Front e identidade de voz

O front principal Ã© o chat visual de `Front/SOFIA-EDU-CHAT/sofia&Edu-chat`. O botÃ£o `Falar` abre uma sessÃ£o Realtime ao vivo e usa a instituiÃ§Ã£o selecionada no seletor visual para definir a identidade:

- UNIASSELVI: Sofia com a voz Marin.
- UniCesumar: Edu com a voz Cedar.

As duas instituiÃ§Ãµes usam o modelo `gpt-realtime-2.1`; Cedar Ã© o preset/voz da UniCesumar. O campo de texto continua disponÃ­vel como apoio e, quando a sessÃ£o de voz estÃ¡ ativa, usa a mesma conversa Realtime.

## Fluxo

```text
Realtime Voice Agent (WebRTC)
        ↓
Transcrição da conversa
        ↓
Routine Extractor (Responses API + Structured Outputs)
        ↓
Schedule Generator (Responses API + Structured Outputs)
        ↓
Agenda validada
        ↓
Calendário completo e calendário acadêmico
```

`shared/mockSchedule.ts` lê a oferta com horário explícito de `Aulas.json` como aula fixa. As demais ofertas da mesma turma aparecem como alternativas temporárias e só substituem a aula atual quando o aluno confirma. A semana trabalha com uma única disciplina: a aula fixa é preservada e oito horas de `academic_activity` são distribuídas como leitura, exercícios, revisão ou estruturação de trabalhos relacionados a ela, sem serem apresentadas como aulas reais.

O sono e o despertar são tratados como campos independentes. Quando um deles não é confirmado, o fluxo abre uma única rodada curta para esclarecer os horários antes de gerar a semana.

Detalhes aproximáveis de compromissos comuns usam defaults operacionais (por exemplo, 60 minutos para uma reunião sem término ou para uma sessão de academia flexível) e ficam registrados como suposição, não como bloqueio. A rodada extra só é aberta quando há conflito, contradição ou outro ponto essencial que pode invalidar a semana; ela continua a conversa sem reapresentar a Sofia.

## Endpoints

- `POST /api/realtime/session`: cria a credencial efêmera da sessão de voz.
- `POST /api/routine/extract`: transforma a transcrição em rotina e decisões acadêmicas temporárias.
- `POST /api/schedule`: aplica uma eventual troca confirmada, gera os sete dias e valida conflitos, a aula fixa e as oito horas autônomas da disciplina selecionada.

## Configuração

```env
REALTIME_MODEL=gpt-realtime-2.1
PLANNER_MODEL=gpt-5.6-luna
PLANNER_REASONING_EFFORT=high
REALTIME_VOICE=marin
REALTIME_NOISE_REDUCTION=near_field
REALTIME_VAD_EAGERNESS=low
REALTIME_REASONING_EFFORT=low
REALTIME_MAX_OUTPUT_TOKENS=2048
VOICE_DIAGNOSTICS=false
```

Com `VOICE_DIAGNOSTICS=true`, o painel DEBUG permite comparar Marin, Cedar, Sage e Marin 1.5. Os logs NDJSON ficam em `logs/voice-sessions/`; o áudio gravado permanece no navegador.

## Verificação

```bash
npm test
npm run check
npm run build
```
