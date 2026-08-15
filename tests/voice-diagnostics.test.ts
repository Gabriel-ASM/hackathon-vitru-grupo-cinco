import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createEmptyRoutine,
  mergeRoutinePatch,
  routinePatchSchema,
} from "../shared/schemas/routine";
import { calculateVoiceMetrics, type VoiceDiagnosticEvent } from "../shared/voice-diagnostics";
import { appendVoiceDiagnosticEvents, createVoiceDiagnosticSession, readVoiceDiagnosticSession } from "../server/voice-diagnostics";

test("mescla patch de rotina sem apagar categorias não alteradas", () => {
  const current = createEmptyRoutine();
  current.hobbies = [{ description: "Violão", days: ["saturday"], start: "15:00", end: "16:00", notes: null }];

  const parsed = routinePatchSchema.parse({
    wake_time: "06:30",
    study_preferences: { preferred_periods: ["morning"] },
  });
  const next = mergeRoutinePatch(current, parsed);

  assert.equal(next.wake_time, "06:30");
  assert.deepEqual(next.hobbies, current.hobbies);
  assert.deepEqual(next.study_preferences.preferred_periods, ["morning"]);
  assert.deepEqual(next.study_preferences.avoid_periods, []);
});

test("calcula latência entre fim da fala e primeiro áudio", () => {
  const events: VoiceDiagnosticEvent[] = [
    { type: "user_speech_stopped", timestamp: "2026-01-01T00:00:00.000Z", elapsed_ms: 1000 },
    { type: "assistant_audio_started", timestamp: "2026-01-01T00:00:01.250Z", elapsed_ms: 2250 },
    { type: "assistant_transcript_completed", timestamp: "2026-01-01T00:00:02.000Z", elapsed_ms: 3000, text: "Tudo bem." },
  ];
  const metrics = calculateVoiceMetrics(events);

  assert.equal(metrics.user_turns, 1);
  assert.equal(metrics.assistant_turns, 1);
  assert.deepEqual(metrics.speech_to_first_audio_ms, [1250]);
});

test("nÃ£o atribui a prÃ³xima resposta Ã  fala que foi interrompida", () => {
  const metrics = calculateVoiceMetrics([
    { type: "user_speech_stopped", timestamp: "2026-01-01T00:00:00.000Z", elapsed_ms: 1000 },
    { type: "interrupted", timestamp: "2026-01-01T00:00:00.100Z", elapsed_ms: 1100 },
    { type: "user_speech_stopped", timestamp: "2026-01-01T00:00:01.000Z", elapsed_ms: 2000 },
    { type: "assistant_audio_started", timestamp: "2026-01-01T00:00:01.250Z", elapsed_ms: 2250 },
  ]);

  assert.deepEqual(metrics.speech_to_first_audio_ms, [250]);
  assert.equal(metrics.interruptions, 1);
});

test("contabiliza resposta incompleta sem confundir com erro de transporte", () => {
  const metrics = calculateVoiceMetrics([
    {
      type: "response_done",
      timestamp: "2026-01-01T00:00:00.000Z",
      elapsed_ms: 100,
      details: { status: "incomplete", reason: "max_output_tokens" },
    },
    {
      type: "response_incomplete",
      timestamp: "2026-01-01T00:00:00.001Z",
      elapsed_ms: 101,
      details: { reason: "max_output_tokens" },
    },
  ]);

  assert.equal(metrics.incomplete_responses, 1);
  assert.equal(metrics.errors, 0);
});

test("persiste somente eventos diagnósticos sanitizados", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vitru-voice-diagnostics-"));
  try {
    const runtimeConfig = {
      realtimeModel: "gpt-realtime-2.1",
      realtimeVoice: "marin" as const,
      noiseReduction: "near_field" as const,
      vadEagerness: "medium" as const,
      reasoningEffort: "low" as const,
      maxOutputTokens: 2048,
      preset: "marin_2_1" as const,
    };
    const session = await createVoiceDiagnosticSession(directory, runtimeConfig);
    const accepted = await appendVoiceDiagnosticEvents(directory, session.session_id, [
      {
        type: "user_transcript_completed",
        timestamp: "2026-01-01T00:00:00.000Z",
        elapsed_ms: 10,
        text: "Olá",
        audio: "não deve ser armazenado",
      },
      { type: "response.audio.delta", audio: "base64 não aceito" },
      {
        type: "assistant_audio_stopped",
        timestamp: "2026-01-01T00:00:00.100Z",
        elapsed_ms: 100,
        details: { status: "completed", output_tokens: 42 },
      },
    ]);
    const contents = await readVoiceDiagnosticSession(directory, session.session_id);

    assert.equal(accepted, 2);
    assert.match(contents, /Olá/);
    assert.doesNotMatch(contents, /base64 não aceito/);
    assert.doesNotMatch(contents, /não deve ser armazenado/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
