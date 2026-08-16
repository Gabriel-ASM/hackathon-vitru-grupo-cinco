import { brazilianPortugueseFarewellInstructions } from "../../../shared/voice-style";
import type { StudentSchedule } from "../../../shared/types";
import type { TranscriptEntry } from "../../../shared/voice-transcript";
import type {
  DiagnosticEventType,
  VoiceDiagnosticEvent,
} from "../../../shared/voice-diagnostics";
import type { Institution } from "../../../shared/voice-profile";

export type VoicePreset = "marin_2_1" | "cedar_2_1" | "sage_2_1" | "marin_1_5";
export type RealtimeVoiceActivity =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "disconnected"
  | "error";

export type RealtimeVoiceSessionOptions = {
  schedule: StudentSchedule;
  institution: Institution;
  onTranscript: (entry: TranscriptEntry) => void;
  onAssistantDraft?: (text: string) => void;
  onStateChange?: (state: RealtimeVoiceActivity) => void;
  onTechnicalEvent?: (event: unknown) => void;
  onDiagnosticEvent?: (event: VoiceDiagnosticEvent) => void;
  onCompleted?: () => void;
};

type StartOptions = {
  clarificationContext?: string;
  presentationAlreadyShown?: boolean;
  preset?: VoicePreset;
};

type SessionResponse = {
  value?: string;
  error?: string;
  details?: string;
  diagnostic_session_id?: string;
};

type ToolCallEvent = {
  call_id?: string;
  name?: string;
  arguments?: string;
  item?: Record<string, unknown>;
};

function technicalError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error("Erro desconhecido ao conectar a voz.");
}

async function getMicrophoneStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador não oferece acesso ao microfone.");
  }

  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name !== "OverconstrainedError" && name !== "NotFoundError") throw error;
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

function diagnosticTypeForRealtimeEvent(eventType: string): DiagnosticEventType | null {
  const mapping: Record<string, DiagnosticEventType> = {
    "session.created": "session_created",
    "session.updated": "session_updated",
    "input_audio_buffer.speech_started": "user_speech_started",
    "input_audio_buffer.speech_stopped": "user_speech_stopped",
    "conversation.item.input_audio_transcription.completed": "user_transcript_completed",
    "input_audio_transcription.completed": "user_transcript_completed",
    "response.created": "response_created",
    "output_audio_buffer.stopped": "assistant_audio_stopped",
    "output_audio_buffer.cleared": "interrupted",
    "response.done": "response_done",
    "response.cancelled": "interrupted",
    "conversation.item.truncated": "interrupted",
    error: "error",
  };
  return mapping[eventType] ?? null;
}

function responseDiagnosticDetails(
  event: Record<string, any>,
): Record<string, string | number | boolean | null> | undefined {
  if (event.type !== "response.done") return undefined;
  const response = event.response;
  if (!response || typeof response !== "object") return undefined;

  const details: Record<string, string | number | boolean | null> = {};
  if (typeof response.status === "string") details.status = response.status;
  const reason = response.status_details?.reason;
  if (typeof reason === "string") details.reason = reason;
  if (typeof response.max_output_tokens === "number") {
    details.max_output_tokens = response.max_output_tokens;
  }
  const usage = response.usage;
  if (usage && typeof usage === "object") {
    if (typeof usage.output_tokens === "number") details.output_tokens = usage.output_tokens;
    const outputDetails = usage.output_token_details;
    if (outputDetails && typeof outputDetails === "object") {
      if (typeof outputDetails.audio_tokens === "number") details.audio_tokens = outputDetails.audio_tokens;
      if (typeof outputDetails.text_tokens === "number") details.text_tokens = outputDetails.text_tokens;
    }
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

function responseIdForEvent(event: Record<string, any>): string | undefined {
  if (typeof event.response?.id === "string") return event.response.id;
  if (typeof event.response_id === "string") return event.response_id;
  return undefined;
}

function mergeTranscriptParts(parts: string[]): string {
  let merged = "";
  for (const part of parts) {
    const clean = part.trim();
    if (!clean) continue;
    if (!merged) {
      merged = clean;
      continue;
    }
    if (merged === clean || merged.includes(clean)) continue;
    if (clean.includes(merged)) {
      merged = clean;
      continue;
    }
    merged = `${merged} ${clean}`;
  }
  return merged;
}

export class RealtimeVoiceSession {
  private readonly options: RealtimeVoiceSessionOptions;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private activity: RealtimeVoiceActivity = "idle";
  private error: string | null = null;
  private assistantDraft = "";
  private assistantTranscriptParts = new Map<string, string[]>();
  private activeAssistantResponseId: string | null = null;
  private handledCallIds = new Set<string>();
  private lastAssistantMessage = "";
  private responseHasAudio = false;
  private assistantAudioResponses = new Set<string>();
  private completionPending = false;
  private farewellPending = false;
  private farewellResponseId: string | null = null;
  private farewellResponseDone = false;
  private farewellAudioStopped = false;
  private farewellFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private completedNotified = false;
  private selectedPreset: VoicePreset | undefined;
  private clarificationContext: string | undefined;
  private presentationAlreadyShown = false;
  private diagnosticSessionId: string | null = null;
  private diagnosticStartedAt: number | null = null;
  private diagnosticEvents: VoiceDiagnosticEvent[] = [];
  private diagnosticQueue: VoiceDiagnosticEvent[] = [];
  private diagnosticFlushPromise: Promise<boolean> | null = null;

  constructor(options: RealtimeVoiceSessionOptions) {
    this.options = options;
  }

  get state(): RealtimeVoiceActivity {
    return this.activity;
  }

  get diagnosticSession(): string | null {
    return this.diagnosticSessionId;
  }

  get diagnostics(): VoiceDiagnosticEvent[] {
    return [...this.diagnosticEvents];
  }

  get lastError(): string | null {
    return this.error;
  }

  private setState(next: RealtimeVoiceActivity): void {
    if (this.activity === next) return;
    this.activity = next;
    this.options.onStateChange?.(next);
  }

  private emitDiagnostic(
    type: DiagnosticEventType,
    fields: Partial<Pick<VoiceDiagnosticEvent, "response_id" | "tool" | "text" | "details">> = {},
  ): void {
    if (!this.diagnosticSessionId) return;
    const startedAt = this.diagnosticStartedAt ?? performance.now();
    const event: VoiceDiagnosticEvent = {
      type,
      timestamp: new Date().toISOString(),
      elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)),
      ...fields,
    };
    this.diagnosticEvents.push(event);
    this.diagnosticQueue.push(event);
    this.options.onDiagnosticEvent?.(event);
    if (this.diagnosticQueue.length >= 10) void this.flushDiagnosticEvents();
  }

  async flushDiagnosticEvents(): Promise<boolean> {
    while (true) {
      const sessionId = this.diagnosticSessionId;
      if (!sessionId || this.diagnosticQueue.length === 0) return true;

      if (this.diagnosticFlushPromise) {
        if (!(await this.diagnosticFlushPromise)) return false;
        continue;
      }

      const batch = this.diagnosticQueue.splice(0, 100);
      const request = (async () => {
        try {
          const result = await fetch(`/api/debug/voice-sessions/${encodeURIComponent(sessionId)}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events: batch }),
            keepalive: true,
          });
          if (!result.ok) {
            this.diagnosticQueue.unshift(...batch);
            return false;
          }
          return true;
        } catch {
          this.diagnosticQueue.unshift(...batch);
          return false;
        }
      })();
      this.diagnosticFlushPromise = request;
      const flushed = await request;
      if (this.diagnosticFlushPromise === request) this.diagnosticFlushPromise = null;
      if (!flushed) return false;
    }
  }

  private addTranscript(role: TranscriptEntry["role"], text: string): void {
    const cleanText = text.trim();
    if (!cleanText) return;
    this.options.onTranscript({
      role,
      text: cleanText,
      timestamp: new Date().toISOString(),
    });
  }

  private setAssistantDraft(next: string): void {
    this.assistantDraft = next;
    this.options.onAssistantDraft?.(next);
  }

  private sendEvent(event: Record<string, unknown>): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") return false;
    this.dataChannel.send(JSON.stringify(event));
    return true;
  }

  sendText(text: string): boolean {
    const cleanText = text.trim();
    if (!cleanText) return false;
    const sent = this.sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: cleanText }],
      },
    });
    if (!sent) return false;
    return this.sendEvent({ type: "response.create" });
  }

  private handleToolCall(event: ToolCallEvent): void {
    const item = event.item;
    const callId = event.call_id ?? (typeof item?.call_id === "string" ? item.call_id : undefined);
    const name = event.name ?? (typeof item?.name === "string" ? item.name : undefined);
    if (!callId || !name || this.handledCallIds.has(callId)) return;

    this.handledCallIds.add(callId);
    this.emitDiagnostic("tool_started", { tool: name, details: { call_id: callId } });

    if (name === "wait_for_user") {
      this.sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ ok: true, waiting: true }),
        },
      });
      this.emitDiagnostic("tool_completed", { tool: name, details: { ok: true, waiting: true } });
      this.setState("listening");
      return;
    }

    if (name === "complete_onboarding") {
      this.completionPending = true;
      this.sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ ok: true }),
        },
      });
      this.emitDiagnostic("tool_completed", { tool: name, details: { ok: true } });
    }
  }

  private completeAfterFarewell(force = false): void {
    if (!this.farewellPending || !this.farewellResponseDone) return;
    if (!force && !this.farewellAudioStopped) return;
    if (this.farewellFallbackTimer !== null) {
      clearTimeout(this.farewellFallbackTimer);
      this.farewellFallbackTimer = null;
    }
    this.farewellPending = false;
    this.farewellResponseId = null;
    this.farewellResponseDone = false;
    this.farewellAudioStopped = false;
    if (this.completedNotified) return;
    this.completedNotified = true;
    this.options.onCompleted?.();
  }

  private handleRealtimeEvent(event: Record<string, any>): void {
    const eventType = typeof event.type === "string" ? event.type : "unknown";
    const eventResponseId = responseIdForEvent(event);
    this.options.onTechnicalEvent?.(event);

    const diagnosticType = diagnosticTypeForRealtimeEvent(eventType);
    if (diagnosticType) {
      this.emitDiagnostic(diagnosticType, {
        response_id: eventResponseId,
        text: eventType === "response.done"
          ? undefined
          : typeof (event.transcript ?? event.text) === "string"
            ? event.transcript ?? event.text
            : undefined,
        details:
          responseDiagnosticDetails(event) ??
          (event.error?.message ? { message: String(event.error.message) } : undefined),
      });
      if (eventType === "response.done" && event.response?.status === "incomplete") {
        this.emitDiagnostic("response_incomplete", {
          response_id: eventResponseId,
          details: responseDiagnosticDetails(event),
        });
      }
    }

    if (eventType === "session.created" || eventType === "session.updated") {
      this.setState("listening");
    }
    if (eventType === "input_audio_buffer.speech_started") this.setState("listening");
    if (eventType === "input_audio_buffer.speech_stopped") this.setState("thinking");
    if (eventType === "response.created") {
      this.responseHasAudio = false;
      this.activeAssistantResponseId = eventResponseId ?? null;
      if (this.farewellPending && !this.farewellResponseId) {
        this.farewellResponseId = eventResponseId ?? null;
      }
      this.setState("thinking");
    }

    if (
      eventType === "output_audio_buffer.started" ||
      eventType === "response.audio.delta" ||
      eventType === "response.output_audio.delta"
    ) {
      const alreadyEmitted = eventResponseId
        ? this.assistantAudioResponses.has(eventResponseId)
        : this.responseHasAudio;
      if (!alreadyEmitted) {
        if (eventResponseId) this.assistantAudioResponses.add(eventResponseId);
        this.responseHasAudio = true;
        this.emitDiagnostic("assistant_audio_started", { response_id: eventResponseId });
      }
      this.setState("speaking");
    }

    if (eventType === "output_audio_buffer.stopped") {
      if (this.farewellPending && this.farewellResponseId && (!eventResponseId || this.farewellResponseId === eventResponseId)) {
        this.farewellAudioStopped = true;
        this.completeAfterFarewell();
      } else {
        this.setState("listening");
      }
    }

    if (eventType === "output_audio_buffer.cleared" || eventType === "response.cancelled" || eventType === "conversation.item.truncated") {
      this.setState("listening");
    }

    if (eventType === "error") {
      this.error = event.error?.message ?? "A sessão de voz retornou um erro.";
      this.setState("error");
      return;
    }

    if (
      eventType === "conversation.item.input_audio_transcription.completed" ||
      eventType === "input_audio_transcription.completed"
    ) {
      this.addTranscript("user", event.transcript ?? event.text ?? "");
    }

    if (
      eventType === "response.audio_transcript.delta" ||
      eventType === "response.output_audio_transcript.delta" ||
      eventType === "response.output_text.delta"
    ) {
      const delta = String(event.delta ?? "");
      if (delta) this.setAssistantDraft(`${this.assistantDraft}${delta}`);
    }

    if (
      eventType === "response.audio_transcript.done" ||
      eventType === "response.output_audio_transcript.done" ||
      eventType === "response.output_text.done"
    ) {
      const finalText = String(event.transcript ?? event.text ?? "").trim();
      const responseId = eventResponseId ?? this.activeAssistantResponseId;
      if (finalText) {
        if (responseId) {
          const parts = this.assistantTranscriptParts.get(responseId) ?? [];
          if (!parts.some((part) => part.trim() === finalText)) parts.push(finalText);
          this.assistantTranscriptParts.set(responseId, parts);
          this.setAssistantDraft(mergeTranscriptParts(parts));
        } else {
          this.setAssistantDraft(mergeTranscriptParts([this.assistantDraft, finalText]));
        }
      }
    }

    if (eventType === "response.function_call_arguments.done") this.handleToolCall(event);
    if (eventType === "response.output_item.done" && event.item?.type === "function_call") {
      this.handleToolCall({ item: event.item });
    }

    if (eventType === "response.done") {
      const responseId = eventResponseId ?? this.activeAssistantResponseId;
      const responseParts = responseId ? this.assistantTranscriptParts.get(responseId) ?? [] : [];
      const finalText = mergeTranscriptParts(responseParts.length > 0 ? responseParts : [this.assistantDraft]);
      if (finalText) {
        this.emitDiagnostic("assistant_transcript_completed", {
          response_id: responseId ?? undefined,
          text: finalText,
          details: { parts: responseParts.length },
        });
        if (finalText.trim() !== this.lastAssistantMessage.trim()) {
          this.addTranscript("assistant", finalText);
          this.lastAssistantMessage = finalText;
        }
      }
      if (responseId) this.assistantTranscriptParts.delete(responseId);
      this.activeAssistantResponseId = null;
      this.setAssistantDraft("");

      if (this.completionPending) {
        this.completionPending = false;
        this.farewellPending = true;
        this.farewellResponseId = null;
        this.farewellResponseDone = false;
        this.farewellAudioStopped = false;
        const farewellSent = this.sendEvent({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            tool_choice: "none",
            instructions: brazilianPortugueseFarewellInstructions,
          },
        });
        if (!farewellSent) {
          this.farewellPending = false;
          this.completeAfterFarewell(true);
        }
      } else if (
        this.farewellPending &&
        (!this.farewellResponseId || !responseId || this.farewellResponseId === responseId)
      ) {
        this.farewellResponseDone = true;
        this.completeAfterFarewell();
        if (this.farewellPending && this.farewellFallbackTimer === null) {
          this.farewellFallbackTimer = setTimeout(() => this.completeAfterFarewell(true), 10_000);
        }
      } else if (this.activity !== "error") {
        this.setState("listening");
      }
      this.responseHasAudio = false;
    }
  }

  private clearTransport(): void {
    const dataChannel = this.dataChannel;
    const peerConnection = this.peerConnection;
    dataChannel?.close();
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }
    this.localStream?.getTracks().forEach((track) => track.stop());
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove();
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.localStream = null;
    this.audioElement = null;
  }

  stop(): void {
    void this.flushDiagnosticEvents();
    this.clearTransport();
    this.assistantDraft = "";
    this.assistantTranscriptParts.clear();
    this.activeAssistantResponseId = null;
    this.handledCallIds.clear();
    this.lastAssistantMessage = "";
    this.responseHasAudio = false;
    this.assistantAudioResponses.clear();
    this.completionPending = false;
    this.farewellPending = false;
    this.farewellResponseId = null;
    this.farewellResponseDone = false;
    this.farewellAudioStopped = false;
    this.completedNotified = false;
    if (this.farewellFallbackTimer !== null) {
      clearTimeout(this.farewellFallbackTimer);
      this.farewellFallbackTimer = null;
    }
    this.setAssistantDraft("");
    this.setState("idle");
  }

  async start(startOptions: StartOptions = {}): Promise<void> {
    this.selectedPreset = startOptions.preset;
    this.clarificationContext = startOptions.clarificationContext;
    this.presentationAlreadyShown = startOptions.presentationAlreadyShown ?? false;
    await this.flushDiagnosticEvents();
    this.stop();
    this.error = null;
    this.diagnosticEvents = [];
    this.diagnosticQueue = [];
    this.diagnosticSessionId = null;
    this.diagnosticStartedAt = null;
    this.setState("connecting");

    let stream: MediaStream | null = null;
    try {
      stream = await getMicrophoneStream();
      this.localStream = stream;

      const body: Record<string, unknown> = {
        schedule: this.options.schedule,
        institution: this.options.institution,
        clarification_context: this.clarificationContext,
        presentation_already_shown: this.presentationAlreadyShown,
      };
      if (this.selectedPreset) body.preset = this.selectedPreset;

      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const tokenData = (await tokenResponse.json().catch(() => ({}))) as SessionResponse;
      if (!tokenResponse.ok || !tokenData.value) {
        throw new Error(tokenData.details ?? tokenData.error ?? "Não consegui criar a sessão de voz.");
      }

      if (tokenData.diagnostic_session_id) {
        this.diagnosticSessionId = tokenData.diagnostic_session_id;
        this.diagnosticStartedAt = performance.now();
      }

      const peerConnection = new RTCPeerConnection();
      this.peerConnection = peerConnection;

      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      audioElement.setAttribute("aria-hidden", "true");
      audioElement.style.display = "none";
      document.body.appendChild(audioElement);
      this.audioElement = audioElement;

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        audioElement.srcObject = remoteStream;
        void audioElement.play().catch(() => undefined);
      };

      peerConnection.addTrack(stream.getAudioTracks()[0], stream);

      const dataChannel = peerConnection.createDataChannel("oai-events");
      this.dataChannel = dataChannel;
      dataChannel.onmessage = (event) => {
        try {
          this.handleRealtimeEvent(JSON.parse(event.data) as Record<string, any>);
        } catch (parseError) {
          this.options.onTechnicalEvent?.({
            type: "event_parse_error",
            error: technicalError(parseError).message,
          });
        }
      };
      dataChannel.onerror = () => {
        this.error = "O canal de dados da sessão de voz apresentou um erro.";
        this.setState("error");
      };
      dataChannel.onopen = () => {
        this.setState("listening");
        this.sendEvent({ type: "response.create" });
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") this.setState("listening");
        if (peerConnection.connectionState === "disconnected") this.setState("disconnected");
        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
          this.error = "A conexão Realtime foi encerrada.";
          this.setState("error");
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenData.value}`,
          "Content-Type": "application/sdp",
        },
      });
      const answerSdp = await sdpResponse.text();
      if (!sdpResponse.ok) throw new Error(answerSdp || "A API da OpenAI recusou a conexão WebRTC.");
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (caughtError) {
      stream?.getTracks().forEach((track) => track.stop());
      this.clearTransport();
      const normalizedError = technicalError(caughtError);
      this.error = normalizedError.message;
      this.setState("error");
      this.options.onTechnicalEvent?.({ type: "connection_error", error: normalizedError.message });
      throw normalizedError;
    }
  }

  async reconnect(): Promise<void> {
    await this.start({
      clarificationContext: this.clarificationContext,
      presentationAlreadyShown: this.presentationAlreadyShown,
      preset: this.selectedPreset,
    });
  }

  finishManually(): void {
    if (this.completionPending) return;
    this.options.onCompleted?.();
    this.stop();
  }

  downloadDiagnosticLog(): void {
    if (!this.diagnosticSessionId && this.diagnosticEvents.length === 0) return;
    const payload = {
      session_id: this.diagnosticSessionId,
      events: this.diagnosticEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vitru-voice-${this.diagnosticSessionId ?? "session"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
