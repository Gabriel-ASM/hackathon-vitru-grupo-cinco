import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateWeeklySchedule } from "../../shared/schemas/schedule";
import {
  createEmptyRoutine,
  routineExtractionResultSchema,
  type StudentRoutine,
} from "../../shared/schemas/routine";
import { MOCK_SCHEDULE } from "../../shared/mockSchedule";
import {
  buildRoutineClarificationContext,
  shouldClarifyRoutine,
} from "../../shared/routine-clarification";
import type { WeeklySchedule } from "../../shared/types";
import type {
  DiagnosticEventType,
  VoiceDiagnosticEvent,
} from "../../shared/voice-diagnostics";
import { parseReferenceText } from "../../shared/voice-transcript";
import { CalendarView } from "./components/CalendarView";
import { DebugPanel } from "./components/DebugPanel";
import { type TranscriptEntry, type VoicePreset, useRealtimeVoice } from "./hooks/useRealtimeVoice";

type Screen = "welcome" | "conversation" | "extracting" | "ready" | "calendar";

type DiagnosticRecorder = (
  type: DiagnosticEventType,
  fields?: Partial<Pick<VoiceDiagnosticEvent, "text" | "details">>,
) => void;

const dayLabels: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

function friendlyVoiceError(error: string | null): string | null {
  if (!error) return null;
  if (/NotAllowed|Permission|microfone|microphone|denied/i.test(error)) {
    return "Não consegui acessar seu microfone. Verifique a permissão do navegador e tente novamente.";
  }
  return "Não consegui iniciar a conversa de voz. Tente novamente.";
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function SchedulePreview() {
  return (
    <aside className="schedule-preview">
      <div className="preview-heading">
        <p className="eyebrow">Contexto já carregado</p>
        <h2>Grade acadêmica</h2>
      </div>
      <p className="muted">A agente já conhece estes horários e não vai perguntar por eles.</p>
      <div className="class-list">
        {MOCK_SCHEDULE.classes.map((academicClass) => (
          <div className="class-row" key={academicClass.id ?? academicClass.name}>
            <strong>{academicClass.name}</strong>
            <span>{dayLabels[academicClass.day]} · {academicClass.start}–{academicClass.end}</span>
          </div>
        ))}
      </div>
      <div className="async-hours">
        <strong>{MOCK_SCHEDULE.asynchronous_hours_week}h</strong>
        <span>de aulas assíncronas na semana</span>
      </div>
    </aside>
  );
}

function App() {
  const debug = useMemo(
    () => new URLSearchParams(window.location.search).get("debug") === "true",
    [],
  );
  const [screen, setScreen] = useState<Screen>("welcome");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const [referenceText, setReferenceText] = useState("");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const extractionInFlightRef = useRef(false);
  const extractionAbortRef = useRef<AbortController | null>(null);
  const extractionSourceRef = useRef<"voice" | "reference">("voice");
  const stopVoiceRef = useRef<() => void>(() => undefined);
  const routineClarificationRoundsRef = useRef(0);
  const clarificationStartRef = useRef<string | null>(null);
  const diagnosticRecorderRef = useRef<DiagnosticRecorder>(() => undefined);
  const [routine, setRoutine] = useState<StudentRoutine>(() => createEmptyRoutine());
  const [onboardingSummary, setOnboardingSummary] = useState("");
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [plannerRequest, setPlannerRequest] = useState<unknown>(null);
  const [plannerResponse, setPlannerResponse] = useState<unknown>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);
  const [recordDebugAudio, setRecordDebugAudio] = useState(false);
  const [voicePreset, setVoicePreset] = useState<VoicePreset>("marin_2_1");
  const [routineClarificationContext, setRoutineClarificationContext] = useState<string | null>(null);
  const [clarificationActive, setClarificationActive] = useState(false);

  const handleTranscript = useCallback((entry: TranscriptEntry) => {
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript((current) => [...current, entry]);
  }, []);

  const extractRoutine = useCallback(async (
    sourceTranscript?: TranscriptEntry[],
    source?: "voice" | "reference",
  ) => {
    if (extractionInFlightRef.current) return;
    const transcriptSnapshot = [...(sourceTranscript ?? transcriptRef.current)];
    const extractionSource = source ?? extractionSourceRef.current;
    extractionSourceRef.current = extractionSource;
    const extractionStartedAt = performance.now();
    extractionInFlightRef.current = true;
    const abortController = new AbortController();
    extractionAbortRef.current = abortController;
    setScreen("extracting");
    setExtractionLoading(true);
    setExtractionError(null);
    diagnosticRecorderRef.current("extraction_started", {
      details: {
        transcript_entries: transcriptSnapshot.length,
        source: extractionSource,
        clarification_round: routineClarificationRoundsRef.current,
      },
    });
    if (extractionSource === "voice") stopVoiceRef.current();

    try {
      const httpResponse = await fetch("/api/routine/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          academic_schedule: MOCK_SCHEDULE,
          transcript: transcriptSnapshot,
        }),
      });
      const data = (await httpResponse.json().catch(() => ({}))) as unknown;
      if (!httpResponse.ok) {
        const errorData = data as { error?: string; details?: unknown };
        throw new Error(errorData.error ?? "Não consegui organizar a rotina.");
      }

      const parsed = routineExtractionResultSchema.parse(data);
      setRoutine(parsed.routine);
      setOnboardingSummary(parsed.summary);
      setExtractionWarnings(parsed.warnings);
      diagnosticRecorderRef.current("extraction_completed", {
        details: {
          warnings: parsed.warnings.length,
          duration_ms: Math.round(performance.now() - extractionStartedAt),
          warning_text: parsed.warnings.join(" | ").slice(0, 500),
          clarification_round: routineClarificationRoundsRef.current,
        },
      });
      if (extractionSource === "voice") stopVoiceRef.current();
      if (shouldClarifyRoutine(parsed.warnings, extractionSource, routineClarificationRoundsRef.current)) {
        routineClarificationRoundsRef.current += 1;
        setRoutineClarificationContext(
          buildRoutineClarificationContext(parsed.warnings, parsed.routine),
        );
        setClarificationActive(true);
        setScreen("conversation");
      } else {
        setRoutineClarificationContext(null);
        setClarificationActive(false);
        setScreen("ready");
      }
    } catch (error) {
      if (abortController.signal.aborted) return;
      const message = formatError(error);
      diagnosticRecorderRef.current("error", {
        details: {
          stage: "routine_extraction",
          message,
          duration_ms: Math.round(performance.now() - extractionStartedAt),
        },
      });
      setExtractionError(message);
    } finally {
      if (extractionAbortRef.current === abortController) {
        extractionAbortRef.current = null;
        extractionInFlightRef.current = false;
      }
      setExtractionLoading(false);
    }
  }, []);

  const handleCompleted = useCallback(() => {
    void extractRoutine();
  }, [extractRoutine]);

  const handleTechnicalEvent = useCallback((event: unknown) => {
    if (!event || typeof event !== "object") return;
    const eventValue = event as { type?: string; error?: unknown; details?: unknown };
    if (
      eventValue.type === "error" ||
      eventValue.type === "connection_error" ||
      eventValue.type === "routine_tool_validation_error"
    ) {
      setTechnicalError(JSON.stringify(event, null, 2));
    }
  }, []);

  const voice = useRealtimeVoice({
    schedule: MOCK_SCHEDULE,
    onTranscript: handleTranscript,
    onCompleted: handleCompleted,
    onTechnicalEvent: handleTechnicalEvent,
  });
  stopVoiceRef.current = voice.stop;
  diagnosticRecorderRef.current = voice.recordDiagnostic;

  useEffect(() => {
    if (!routineClarificationContext || extractionLoading) return;
    const context = routineClarificationContext;
    if (clarificationStartRef.current === context) return;
    clarificationStartRef.current = context;
    setRoutineClarificationContext(null);
    void voice.start(debug && recordDebugAudio, voicePreset, context);
  }, [
    debug,
    extractionLoading,
    recordDebugAudio,
    routineClarificationContext,
    voice.start,
    voicePreset,
  ]);

  const handleReferenceTextChange = useCallback((value: string) => {
    setReferenceText(value);
    setReferenceError(null);
  }, []);

  const handleUseReferenceText = useCallback(() => {
    const parsedTranscript = parseReferenceText(referenceText);
    if (parsedTranscript.length === 0) {
      setReferenceError("Cole uma descrição ou transcrição antes de processar.");
      return;
    }

    voice.stop();
    transcriptRef.current = parsedTranscript;
    setTranscript(parsedTranscript);
    setReferenceError(null);
    setTechnicalError(null);
    setPlannerError(null);
    setPlannerRequest(null);
    setPlannerResponse(null);
    setWeeklySchedule(null);
    setExtractionWarnings([]);
    routineClarificationRoundsRef.current = 0;
    clarificationStartRef.current = null;
    setRoutineClarificationContext(null);
    setClarificationActive(false);
    void extractRoutine(parsedTranscript, "reference");
  }, [extractRoutine, referenceText, voice]);

  const startConversation = async () => {
    setTechnicalError(null);
    setPlannerError(null);
    setExtractionError(null);
    setReferenceError(null);
    extractionSourceRef.current = "voice";
    setExtractionWarnings([]);
    routineClarificationRoundsRef.current = 0;
    clarificationStartRef.current = null;
    setRoutineClarificationContext(null);
    setClarificationActive(false);
    setScreen("conversation");
    await voice.start(debug && recordDebugAudio, voicePreset);
  };

  const generateSchedule = async () => {
    const requestBody = {
      academic_schedule: MOCK_SCHEDULE,
      routine,
      pedagogical_rules: {
        extra_study_minutes_per_class_hour: 30,
        description: "Reservar aproximadamente 30 minutos de estudo extraclasse para cada hora de aula.",
      },
      week_start: "2026-08-17",
    };

    setPlannerRequest(requestBody);
    setPlannerResponse(null);
    setPlannerError(null);
    setTechnicalError(null);
    setPlannerLoading(true);
    voice.stop();

    try {
      const plannerHttpResponse = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const plannerData = (await plannerHttpResponse.json().catch(() => ({}))) as {
        schedule?: unknown;
        error?: string;
        details?: unknown;
      };
      setPlannerResponse(plannerData.schedule ?? plannerData);

      if (!plannerHttpResponse.ok || !plannerData.schedule) {
        const details = typeof plannerData.details === "string" ? plannerData.details : "";
        throw new Error(details || plannerData.error || "O Schedule Generator falhou.");
      }

      const validatedSchedule = validateWeeklySchedule(plannerData.schedule, MOCK_SCHEDULE);
      setWeeklySchedule(validatedSchedule);
      setScreen("calendar");
    } catch (error) {
      const message = formatError(error);
      setPlannerError(message);
      setTechnicalError(message);
    } finally {
      setPlannerLoading(false);
    }
  };

  const resetPrototype = () => {
    voice.stop();
    extractionAbortRef.current?.abort();
    extractionAbortRef.current = null;
    extractionInFlightRef.current = false;
    extractionSourceRef.current = "voice";
    routineClarificationRoundsRef.current = 0;
    clarificationStartRef.current = null;
    setRoutineClarificationContext(null);
    setClarificationActive(false);
    setScreen("welcome");
    transcriptRef.current = [];
    setTranscript([]);
    setRoutine(createEmptyRoutine());
    setOnboardingSummary("");
    setExtractionWarnings([]);
    setExtractionError(null);
    setReferenceError(null);
    setExtractionLoading(false);
    setPlannerRequest(null);
    setPlannerResponse(null);
    setPlannerError(null);
    setTechnicalError(null);
    setWeeklySchedule(null);
  };

  const voiceError = friendlyVoiceError(voice.error);
  const connectionFailed = voice.connectionState === "error" || voice.connectionState === "disconnected";

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Vitru · rotina</span>
        <span className="prototype-label">Protótipo local</span>
      </header>

      {screen === "welcome" && (
        <main className="page-grid">
          <section className="hero-card">
            <p className="eyebrow">Onboarding por voz</p>
            <h1>Vamos organizar sua semana</h1>
            <p className="hero-copy">Sua grade já está aqui. Agora quero entender um pouco da sua rotina.</p>
            <button className="primary-button" type="button" onClick={startConversation}>
              Começar conversa
            </button>
            {voiceError && <p className="error-message">{voiceError}</p>}
          </section>
          <SchedulePreview />
        </main>
      )}

      {screen === "conversation" && (
        <main className="single-column">
          <section className="voice-card">
            <div className="status-line">
              <span className={`mic-indicator ${voice.connectionState === "connected" ? "mic-indicator--on" : ""}`} aria-hidden="true">
                <span /><span /><span />
              </span>
              <strong>{voice.connectionState === "connecting" ? "Preparando conversa" : "Conversando"}</strong>
              {debug && voice.lastEventType && <small>{voice.lastEventType}</small>}
            </div>
            <h1>
              {voice.connectionState === "connecting"
                ? "Só um instante…"
                : clarificationActive
                  ? "Só mais alguns detalhes"
                  : "Pode falar naturalmente"}
            </h1>
            <p className="muted">
              {clarificationActive
                ? "Vou confirmar apenas os pontos que podem mudar os horários da sua semana."
                : "A agente vai fazer uma pergunta por vez e ouvir suas pausas."}
            </p>

            <div className="transcript-preview" aria-live="polite">
              {transcript.slice(-4).map((entry, index) => (
                <p key={`${entry.timestamp}-${index}`} className={`transcript-line transcript-line--${entry.role}`}>
                  <strong>{entry.role === "user" ? "Você" : "IA"}</strong>{entry.text}
                </p>
              ))}
              {voice.assistantDraft && (
                <p className="transcript-line transcript-line--assistant"><strong>IA</strong>{voice.assistantDraft}</p>
              )}
              {transcript.length === 0 && !voice.assistantDraft && <p className="muted">A transcrição aparecerá aqui.</p>}
            </div>

            {voiceError && <p className="error-message">{voiceError}</p>}
            {connectionFailed ? (
              <button className="secondary-button" type="button" onClick={() => void voice.reconnect()}>
                Reconectar
              </button>
            ) : (
              <button className="secondary-button" type="button" onClick={voice.finishManually}>
                Encerrar onboarding
              </button>
            )}
          </section>
        </main>
      )}

      {screen === "extracting" && (
        <main className="single-column">
          <section className="ready-card">
            <p className="eyebrow">Organizando a conversa</p>
            <h1>Estou entendendo sua rotina.</h1>
            <p className="hero-copy">
              Vou transformar o que você contou em informações práticas para montar uma semana possível.
            </p>
            {extractionError ? (
              <div className="error-box">
                <p>{extractionError}</p>
                <button className="secondary-button" type="button" onClick={() => void extractRoutine()} disabled={extractionLoading}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              <p className="muted">Só um instante…</p>
            )}
          </section>
        </main>
      )}

      {screen === "ready" && (
        <main className="single-column">
          <section className="ready-card">
            <p className="eyebrow">Onboarding concluído</p>
            <h1>Entendi sua rotina.</h1>
            <p className="hero-copy">{onboardingSummary || "Já tenho contexto suficiente para montar uma semana possível."}</p>
            {extractionWarnings.length > 0 && (
              <div className="warning-box">
                <strong>Um detalhe ficou aberto:</strong>
                <ul>
                  {extractionWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}
            <button className="primary-button" type="button" onClick={() => void generateSchedule()} disabled={plannerLoading}>
              {plannerLoading ? "Montando sua semana…" : "Gerar minha semana"}
            </button>
            {plannerError && (
              <div className="error-box">
                <p>Não consegui montar sua semana.</p>
                <button className="secondary-button" type="button" onClick={() => void generateSchedule()} disabled={plannerLoading}>
                  Tentar novamente
                </button>
              </div>
            )}
          </section>
        </main>
      )}

      {screen === "calendar" && weeklySchedule && (
        <main className="single-column">
          <CalendarView schedule={weeklySchedule} />
          <button className="secondary-button reset-button" type="button" onClick={resetPrototype}>
            Refazer onboarding
          </button>
        </main>
      )}

      {debug && (
        <DebugPanel
          transcript={transcript}
          routine={routine}
          extractionWarnings={extractionWarnings}
          extractionError={extractionError}
          referenceText={referenceText}
          onReferenceTextChange={handleReferenceTextChange}
          onUseReferenceText={handleUseReferenceText}
          referenceLoading={extractionLoading}
          referenceError={referenceError}
          plannerRequest={plannerRequest}
          plannerResponse={plannerResponse}
          technicalError={technicalError}
          recordAudio={recordDebugAudio}
          onRecordAudioChange={setRecordDebugAudio}
          voicePreset={voicePreset}
          onVoicePresetChange={setVoicePreset}
          diagnosticSessionId={voice.diagnosticSessionId}
          diagnosticEvents={voice.diagnosticEvents}
          recordedAudioUrl={voice.recordedAudioUrl}
          onDownloadDiagnosticLog={voice.downloadDiagnosticLog}
        />
      )}
    </div>
  );
}

export default App;
