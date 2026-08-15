# Vitru · rotina por voz

Protótipo local de onboarding acadêmico por voz. A grade mockada é enviada para o agente Realtime, a conversa é transcrita e uma chamada posterior organiza a rotina com Structured Outputs antes de gerar a agenda semanal validada.

## Pré-requisitos

- Node.js 20.x ou 22.x+
- Uma chave da API da OpenAI com acesso aos modelos configurados
- Navegador com WebRTC e permissão de microfone (Chrome ou Edge funcionam bem)

## Instalação

```bash
npm install
cp .env.example .env
```

No PowerShell, o segundo comando pode ser:

```powershell
Copy-Item .env.example .env
```

Preencha o `.env`:

```env
OPENAI_API_KEY=...
```

A chave principal fica somente no backend. O navegador recebe apenas um token efêmero para a sessão Realtime.

## Execução

```bash
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). Para acompanhar todo o fluxo, use [http://localhost:5173/?debug=true](http://localhost:5173/?debug=true).

## Arquitetura

```text
Realtime Voice Agent (WebRTC)
        ↓
Conversation transcript
        ↓
Routine Extractor (Responses API + Structured Outputs)
        ↓
Schedule Generator (Responses API + Structured Outputs)
        ↓
JSON validado
        ↓
Calendar UI determinística
```

O backend expõe:

- `POST /api/realtime/session`: cria o client secret efêmero usando `OPENAI_API_KEY`.
- `POST /api/routine/extract`: transforma a transcrição final em uma rotina estruturada, usando apenas fatos ditos pelo aluno.
- `POST /api/schedule`: chama o planejador e valida os sete dias, horários, sobreposições e aulas fixas.

Os prompts ficam separados em `server/prompts/voice-agent.ts`, `server/prompts/routine-extractor.ts` e `server/prompts/schedule-generator.ts`. A grade demo está em `shared/mockSchedule.ts` e começa na semana de `2026-08-17`.

## Configuração rápida

As configurações principais estão em `server/config.ts` e podem ser sobrescritas no `.env`:

```env
REALTIME_MODEL=gpt-realtime-2.1
PLANNER_MODEL=gpt-5.6
REALTIME_VOICE=marin
REALTIME_NOISE_REDUCTION=near_field
REALTIME_VAD_EAGERNESS=low
REALTIME_REASONING_EFFORT=low
REALTIME_MAX_OUTPUT_TOKENS=2048
VOICE_DIAGNOSTICS=false
```

Para comparar vozes e modelos no modo debug, ative `VOICE_DIAGNOSTICS=true`. O painel oferece os presets `marin_2_1`, `cedar_2_1`, `sage_2_1` e `marin_1_5`. O log NDJSON fica em `logs/voice-sessions/`; o áudio, quando autorizado, permanece apenas no navegador.

O preset atual usa `near_field`, adequado ao headset da demonstração. Para microfone de notebook ou ambiente aberto, use `REALTIME_NOISE_REDUCTION=far_field`. A conversa usa `low` no VAD para deixar o aluno concluir frases longas; em silêncio ou ruído, a ferramenta `wait_for_user` mantém a agente em silêncio. O sinal `complete_onboarding` encerra o diálogo, a despedida termina antes da tela de extração e o backend faz uma extração estruturada; somente quando há muitos warnings abre uma segunda rodada curta e focada, evitando uma nova entrevista completa.

## Verificação

```bash
npm run check
npm run build
```

O modo `?debug=true` mostra a transcrição, o estado estruturado, o JSON enviado ao planejador, o JSON retornado e erros técnicos sem expor a chave principal. O extrator faz inferências operacionais limitadas: quando trabalho/emprego/estágio recorrente tem horário mas não tem dias, assume segunda a sexta e registra a suposição; uma escala 6x1 só é usada quando o aluno a informa. Se a primeira extração devolver mais de três warnings, o protótipo abre uma única rodada de voz focada nos pontos ambíguos antes de liberar o planejador. A agenda resultante tem duas visões derivadas do mesmo JSON: rotina completa e aulas (com opção de mostrar estudo planejado).
