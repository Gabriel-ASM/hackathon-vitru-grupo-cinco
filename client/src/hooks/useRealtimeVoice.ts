import { useCallback, useEffect, useRef, useState } from "react";
import { brazilianPortugueseFarewellInstructions } from "../../../shared/voice-style";
import type { StudentSchedule } from "../../../shared/types";
import type { TranscriptEntry } from "../../../shared/voice-transcript";
import type {
  DiagnosticEventType,
  VoiceDiagnosticEvent,
} from "../../../shared/voice-diagnostics";

export type { TranscriptEntry } from "../../../shared/voice-transcript";

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type VoicePreset = "marin_2_1" | "cedar_2_1" | "sage_2_1" | "marin_1_5";

type UseRealtimeVoiceOptions = {
  schedule: StudentSchedule;
  onTranscript: (entry: TranscriptEntry) => void;
  onCompleted: () => void;
  onTechnicalEvent?: (event: unknown) => void;
  onDiagnosticEvent?: (event: VoiceDiagnosticEvent) => void;
};

type SessionResponse = {
  value?: string;
  error?: string;
  details?: string;
  diagnostic_session_id?: string;
};

type RecorderState = {
  recorder: MediaRecorder;
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  chunks: Blob[];
  remoteSource?: MediaStreamAudioSourceNode;
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

function responseDiagnosticDetails(event: Record<string, any>): Record<string, string | number | boolean | null> | undefined {
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

export function useRealtimeVoice(options: UseRealtimeVoiceOptions) {
  const optionsRef = useRef(options);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const assistantDraftRef = useRef("");
  const assistantTranscriptPartsRef = useRef(new Map<string, string[]>());
  const activeAssistantResponseIdRef = useRef<string | null>(null);
  const handledCallIdsRef = useRef(new Set<string>());
  const lastAssistantMessageRef = useRef("");
  const responseHasAudioRef = useRef(false);
  const assistantAudioResponsesRef = useRef(new Set<string>());
  const completionPendingRef = useRef(false);
  const farewellPendingRef = useRef(false);
  const farewellResponseIdRef = useRef<string | null>(null);
  const farewellResponseDoneRef = useRef(false);
  const farewellAudioStoppedRef = useRef(false);
  const farewellFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagnosticSessionIdRef = useRef<string | null>(null);
  const selectedPresetRef = useRef<VoicePreset>("marin_2_1");
  const diagnosticStartedAtRef = useRef<number | null>(null);
  const diagnosticEventsRef = useRef<VoiceDiagnosticEvent[]>([]);
  const diagnosticQueueRef = useRef<VoiceDiagnosticEvent[]>([]);
  const diagnosticFlushPromiseRef = useRef<Promise<boolean> | null>(null);
  const clarificationContextRef = useRef<string | undefined>(undefined);
  const recorderRef = useRef<RecorderState | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [lastEventType, setLastEventType] = useState<string | null>(null);
  const [diagnosticSessionId, setDiagnosticSessionId] = useState<string | null>(null);
  const [diagnosticEvents, setDiagnosticEvents] = useState<VoiceDiagnosticEvent[]>([]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const flushDiagnosticEvents = useCallback(async () => {
    while (true) {
      const sessionId = diagnosticSessionIdRef.current;
      if (!sessionId || diagnosticQueueRef.current.length === 0) return;

      const inFlight = diagnosticFlushPromiseRef.current;
      if (inFlight) {
        if (!(await inFlight)) return;
        continue;
      }

      const batch = diagnosticQueueRef.current.splice(0, 100);
      const request = (async () => {
        try {
          const result = await fetch(`/api/debug/voice-sessions/${encodeURIComponent(sessionId)}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events: batch }),
            keepalive: true,
          });
          if (!result.ok) {
            diagnosticQueueRef.current.unshift(...batch);
            return false;
          }
          return true;
        } catch {
          diagnosticQueueRef.current.unshift(...batch);
          return false;
        }
      })();
      diagnosticFlushPromiseRef.current = request;
      const flushed = await request;
      if (diagnosticFlushPromiseRef.current === request) {
        diagnosticFlushPromiseRef.current = null;
      }
      if (!flushed) return;
    }
  }, []);

  const emitDiagnostic = useCallback(
    (
      type: DiagnosticEventType,
      fields: Partial<Pick<VoiceDiagnosticEvent, "turn_id" | "response_id" | "tool" | "text" | "details">> = {},
    ) => {
      if (!diagnosticSessionIdRef.current) return;
      const startedAt = diagnosticStartedAtRef.current ?? performance.now();
      const event: VoiceDiagnosticEvent = {
        type,
        timestamp: new Date().toISOString(),
        elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        ...fields,
      };
      diagnosticEventsRef.current.push(event);
      diagnosticQueueRef.current.push(event);
      setDiagnosticEvents([...diagnosticEventsRef.current]);
      optionsRef.current.onDiagnosticEvent?.(event);
      if (diagnosticQueueRef.current.length >= 10) void flushDiagnosticEvents();
    },
    [flushDiagnosticEvents],
  );

  const addTranscript = useCallback((role: TranscriptEntry["role"], text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    optionsRef.current.onTranscript({
      role,
      text: cleanText,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const sendEvent = useCallback((event: Record<string, unknown>): boolean => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify(event));
    return true;
  }, []);

  const connectRemoteRecording = useCallback((remoteStream: MediaStream) => {
    const recorderState = recorderRef.current;
    if (!recorderState || recorderState.remoteSource) return;
    recorderState.remoteSource = recorderState.context.createMediaStreamSource(remoteStream);
    recorderState.remoteSource.connect(recorderState.destination);
  }, []);

  const stopRecording = useCallback(() => {
    const recorderState = recorderRef.current;
    recorderRef.current = null;
    if (!recorderState) return;

    let contextClosed = false;
    const closeContext = () => {
      if (contextClosed) return;
      contextClosed = true;
      void recorderState.context.close().catch(() => undefined);
    };
    if (recorderState.recorder.state === "inactive") {
      closeContext();
      return;
    }

    recorderState.recorder.addEventListener("stop", closeContext, { once: true });
    try {
      recorderState.recorder.requestData?.();
      recorderState.recorder.stop();
    } catch {
      closeContext();
    }
  }, []);

  const startRecording = useCallback((stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") {
      optionsRef.current.onTechnicalEvent?.({
        type: "recording_unavailable",
        message: "Este navegador não oferece gravação local de áudio.",
      });
      return;
    }

    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      optionsRef.current.onTechnicalEvent?.({
        type: "recording_unavailable",
        message: "Este navegador não oferece mixagem local de áudio.",
      });
      return;
    }

    const context = new AudioContextConstructor();
    const destination = context.createMediaStreamDestination();
    context.createMediaStreamSource(stream).connect(destination);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(destination.stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      if (recordedAudioUrlRef.current) URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = url;
      setRecordedAudioUrl(url);
    };
    recorderRef.current = { recorder, context, destination, chunks };
    recorder.start(250);
  }, []);

  const completeAfterFarewell = useCallback((force = false) => {
    if (!farewellPendingRef.current || !farewellResponseDoneRef.current) return;
    if (!force && !farewellAudioStoppedRef.current) return;

    if (farewellFallbackTimerRef.current !== null) {
      clearTimeout(farewellFallbackTimerRef.current);
      farewellFallbackTimerRef.current = null;
    }
    farewellPendingRef.current = false;
    farewellResponseIdRef.current = null;
    farewellResponseDoneRef.current = false;
    farewellAudioStoppedRef.current = false;
    optionsRef.current.onCompleted();
  }, []);

  const handleToolCall = useCallback(
    (event: { call_id?: string; name?: string; arguments?: string; item?: Record<string, unknown> }) => {
      const item = event.item;
      const callId = event.call_id ?? (typeof item?.call_id === "string" ? item.call_id : undefined);
      const name = event.name ?? (typeof item?.name === "string" ? item.name : undefined);
      if (!callId || !name || handledCallIdsRef.current.has(callId)) return;

      handledCallIdsRef.current.add(callId);
      emitDiagnostic("tool_started", { tool: name, details: { call_id: callId } });

      if (name === "wait_for_user") {
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ ok: true, waiting: true }),
          },
        });
        emitDiagnostic("tool_completed", { tool: name, details: { ok: true, waiting: true } });
        return;
      }

      if (name === "complete_onboarding") {
        completionPendingRef.current = true;
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ ok: true }),
          },
        });
        emitDiagnostic("tool_completed", { tool: name, details: { ok: true } });
      }
    },
    [emitDiagnostic, sendEvent],
  );

  const handleRealtimeEvent = useCallback(
    (event: Record<string, any>) => {
      const eventType = typeof event.type === "string" ? event.type : "unknown";
      const eventResponseId = responseIdForEvent(event);
      setLastEventType(eventType);
      optionsRef.current.onTechnicalEvent?.(event);

      const diagnosticType = diagnosticTypeForRealtimeEvent(eventType);
      if (diagnosticType) {
        emitDiagnostic(diagnosticType, {
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
          emitDiagnostic("response_incomplete", {
            response_id: eventResponseId,
            details: responseDiagnosticDetails(event),
          });
        }
      }

      if (eventType === "response.created") {
        responseHasAudioRef.current = false;
        activeAssistantResponseIdRef.current = eventResponseId ?? null;
        if (farewellPendingRef.current && !farewellResponseIdRef.current) {
          farewellResponseIdRef.current = eventResponseId ?? null;
        }
      }

      if (
        eventType === "output_audio_buffer.started" ||
        eventType === "response.audio.delta" ||
        eventType === "response.output_audio.delta"
      ) {
        const alreadyEmitted = eventResponseId
          ? assistantAudioResponsesRef.current.has(eventResponseId)
          : responseHasAudioRef.current;
        if (!alreadyEmitted) {
          if (eventResponseId) assistantAudioResponsesRef.current.add(eventResponseId);
          responseHasAudioRef.current = true;
          emitDiagnostic("assistant_audio_started", {
            response_id: eventResponseId,
          });
        }
      }

      if (eventType === "output_audio_buffer.stopped" && farewellPendingRef.current) {
        if (farewellResponseIdRef.current && (!eventResponseId || farewellResponseIdRef.current === eventResponseId)) {
          farewellAudioStoppedRef.current = true;
          completeAfterFarewell();
        }
      }

      if (eventType === "error") {
        const message = event.error?.message ?? "A sessão de voz retornou um erro.";
        setError(message);
        setConnectionState("error");
        return;
      }

      if (eventType === "session.created" || eventType === "session.updated") {
        setConnectionState("connected");
      }

      if (
        eventType === "conversation.item.input_audio_transcription.completed" ||
        eventType === "input_audio_transcription.completed"
      ) {
        addTranscript("user", event.transcript ?? event.text ?? "");
      }

      if (
        eventType === "response.audio_transcript.delta" ||
        eventType === "response.output_audio_transcript.delta" ||
        eventType === "response.output_text.delta"
      ) {
        const delta = String(event.delta ?? "");
        if (delta) {
          setAssistantDraft((current) => {
            const next = current + delta;
            assistantDraftRef.current = next;
            return next;
          });
        }
      }

      if (
        eventType === "response.audio_transcript.done" ||
        eventType === "response.output_audio_transcript.done" ||
        eventType === "response.output_text.done"
      ) {
        const finalText = String(event.transcript ?? event.text ?? "").trim();
        const responseId = eventResponseId ?? activeAssistantResponseIdRef.current;
        if (finalText) {
          if (responseId) {
            const parts = assistantTranscriptPartsRef.current.get(responseId) ?? [];
            if (!parts.some((part) => part.trim() === finalText)) parts.push(finalText);
            assistantTranscriptPartsRef.current.set(responseId, parts);
            setAssistantDraft(mergeTranscriptParts(parts));
          } else {
            assistantDraftRef.current = mergeTranscriptParts([assistantDraftRef.current, finalText]);
            setAssistantDraft(assistantDraftRef.current);
          }
        }
      }

      if (eventType === "response.function_call_arguments.done") handleToolCall(event);
      if (eventType === "response.output_item.done" && event.item?.type === "function_call") {
        handleToolCall({ item: event.item });
      }

      if (eventType === "response.done") {
        const responseId = eventResponseId ?? activeAssistantResponseIdRef.current;
        const responseParts = responseId ? assistantTranscriptPartsRef.current.get(responseId) ?? [] : [];
        const finalText = mergeTranscriptParts(responseParts.length > 0 ? responseParts : [assistantDraftRef.current]);
        if (finalText) {
          emitDiagnostic("assistant_transcript_completed", {
            response_id: responseId ?? undefined,
            text: finalText,
            details: { parts: responseParts.length },
          });
          if (finalText.trim() !== lastAssistantMessageRef.current.trim()) {
            addTranscript("assistant", finalText);
            lastAssistantMessageRef.current = finalText;
          }
        }
        if (responseId) assistantTranscriptPartsRef.current.delete(responseId);
        activeAssistantResponseIdRef.current = null;
        assistantDraftRef.current = "";
        setAssistantDraft("");

        if (completionPendingRef.current) {
          completionPendingRef.current = false;
          farewellPendingRef.current = true;
          farewellResponseIdRef.current = null;
          farewellResponseDoneRef.current = false;
          farewellAudioStoppedRef.current = false;
          const farewellSent = sendEvent({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              tool_choice: "none",
              instructions: brazilianPortugueseFarewellInstructions,
            },
          });
          if (!farewellSent) {
            farewellPendingRef.current = false;
            optionsRef.current.onCompleted();
          }
        } else if (
          farewellPendingRef.current &&
          (!farewellResponseIdRef.current || !responseId || farewellResponseIdRef.current === responseId)
        ) {
          farewellResponseDoneRef.current = true;
          completeAfterFarewell();
          if (farewellPendingRef.current && farewellFallbackTimerRef.current === null) {
            farewellFallbackTimerRef.current = setTimeout(() => completeAfterFarewell(true), 10_000);
          }
        }
        responseHasAudioRef.current = false;
      }
    },
    [addTranscript, completeAfterFarewell, emitDiagnostic, handleToolCall, sendEvent],
  );

  const stop = useCallback(() => {
    void flushDiagnosticEvents();
    stopRecording();

    const dataChannel = dataChannelRef.current;
    const peerConnection = peerConnectionRef.current;
    dataChannel?.close();
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
    }

    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    audioElementRef.current = null;
    assistantDraftRef.current = "";
    assistantTranscriptPartsRef.current.clear();
    activeAssistantResponseIdRef.current = null;
    handledCallIdsRef.current.clear();
    lastAssistantMessageRef.current = "";
    responseHasAudioRef.current = false;
    assistantAudioResponsesRef.current.clear();
    completionPendingRef.current = false;
    farewellPendingRef.current = false;
    farewellResponseIdRef.current = null;
    farewellResponseDoneRef.current = false;
    farewellAudioStoppedRef.current = false;
    if (farewellFallbackTimerRef.current !== null) {
      clearTimeout(farewellFallbackTimerRef.current);
      farewellFallbackTimerRef.current = null;
    }
    setAssistantDraft("");
    setConnectionState("idle");
  }, [flushDiagnosticEvents, stopRecording]);

  const start = useCallback(
    async (recordAudio = false, preset?: VoicePreset, clarificationContext?: string) => {
      if (preset) selectedPresetRef.current = preset;
      clarificationContextRef.current = clarificationContext;
      await flushDiagnosticEvents();
      stop();
      setError(null);
      setLastEventType(null);
      setDiagnosticEvents([]);
      diagnosticEventsRef.current = [];
      diagnosticQueueRef.current = [];
      diagnosticSessionIdRef.current = null;
      diagnosticStartedAtRef.current = null;
      setDiagnosticSessionId(null);
      setConnectionState("connecting");

      let stream: MediaStream | null = null;
      try {
        stream = await getMicrophoneStream();
        localStreamRef.current = stream;
        if (recordAudio) startRecording(stream);

        const tokenResponse = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schedule: optionsRef.current.schedule,
            preset: selectedPresetRef.current,
            clarification_context: clarificationContextRef.current,
          }),
        });
        const tokenData = (await tokenResponse.json().catch(() => ({}))) as SessionResponse;
        if (!tokenResponse.ok || !tokenData.value) {
          throw new Error(tokenData.details ?? tokenData.error ?? "Não consegui criar a sessão de voz.");
        }

        if (tokenData.diagnostic_session_id) {
          diagnosticSessionIdRef.current = tokenData.diagnostic_session_id;
          diagnosticStartedAtRef.current = performance.now();
          setDiagnosticSessionId(tokenData.diagnostic_session_id);
        }

        const peerConnection = new RTCPeerConnection();
        peerConnectionRef.current = peerConnection;

        const audioElement = document.createElement("audio");
        audioElement.autoplay = true;
        audioElement.setAttribute("aria-hidden", "true");
        audioElement.style.display = "none";
        document.body.appendChild(audioElement);
        audioElementRef.current = audioElement;

        peerConnection.ontrack = (event) => {
          const remoteStream = event.streams[0];
          audioElement.srcObject = remoteStream;
          connectRemoteRecording(remoteStream);
          void audioElement.play().catch(() => undefined);
        };

        peerConnection.addTrack(stream.getAudioTracks()[0], stream);

        const dataChannel = peerConnection.createDataChannel("oai-events");
        dataChannelRef.current = dataChannel;
        dataChannel.onmessage = (event) => {
          try {
            handleRealtimeEvent(JSON.parse(event.data) as Record<string, any>);
          } catch (parseError) {
            optionsRef.current.onTechnicalEvent?.({
              type: "event_parse_error",
              error: technicalError(parseError).message,
            });
          }
        };
        dataChannel.onerror = () => {
          setError("O canal de dados da sessão de voz apresentou um erro.");
        };
        dataChannel.onopen = () => {
          setConnectionState("connected");
          sendEvent({ type: "response.create" });
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "connected") setConnectionState("connected");
          if (peerConnection.connectionState === "disconnected") setConnectionState("disconnected");
          if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
            setConnectionState("error");
            setError("A conexão Realtime foi encerrada.");
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
        stop();
        const normalizedError = technicalError(caughtError);
        setError(normalizedError.message);
        setConnectionState("error");
        optionsRef.current.onTechnicalEvent?.({
          type: "connection_error",
          error: normalizedError.message,
        });
      }
    },
    [connectRemoteRecording, flushDiagnosticEvents, handleRealtimeEvent, sendEvent, startRecording, stop],
  );

  const reconnect = useCallback(async () => {
    await start(false, selectedPresetRef.current, clarificationContextRef.current);
  }, [start]);

  const finishManually = useCallback(() => {
    if (completionPendingRef.current) return;
    optionsRef.current.onCompleted();
    stop();
  }, [stop]);

  const downloadDiagnosticLog = useCallback(() => {
    if (!diagnosticSessionIdRef.current && diagnosticEventsRef.current.length === 0) return;
    const payload = {
      session_id: diagnosticSessionIdRef.current,
      events: diagnosticEventsRef.current,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vitru-voice-${diagnosticSessionIdRef.current ?? "session"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    start,
    stop,
    reconnect,
    finishManually,
    downloadDiagnosticLog,
    connectionState,
    error,
    assistantDraft,
    lastEventType,
    diagnosticSessionId,
    diagnosticEvents,
    recordDiagnostic: emitDiagnostic,
    flushDiagnostics: flushDiagnosticEvents,
    recordedAudioUrl,
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
