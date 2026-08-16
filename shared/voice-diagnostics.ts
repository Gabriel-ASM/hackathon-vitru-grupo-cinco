export const diagnosticEventTypes = [
  "session_created",
  "session_updated",
  "user_speech_started",
  "user_speech_stopped",
  "user_transcript_completed",
  "response_created",
  "assistant_audio_started",
  "assistant_audio_stopped",
  "assistant_transcript_completed",
  "response_done",
  "response_incomplete",
  "tool_started",
  "tool_completed",
  "interrupted",
  "extraction_started",
  "extraction_completed",
  "clarification_reused_draft",
  "planner_started",
  "planner_completed",
  "planner_failed",
  "error",
] as const;

export type DiagnosticEventType = (typeof diagnosticEventTypes)[number];

export type VoiceDiagnosticEvent = {
  type: DiagnosticEventType;
  timestamp: string;
  elapsed_ms: number;
  turn_id?: string;
  response_id?: string;
  tool?: string;
  text?: string;
  details?: Record<string, string | number | boolean | null>;
};

export type VoiceSessionMetrics = {
  user_turns: number;
  assistant_turns: number;
  tool_calls: number;
  interruptions: number;
  errors: number;
  incomplete_responses: number;
  duplicate_responses: number;
  speech_to_first_audio_ms: number[];
};

export function calculateVoiceMetrics(events: VoiceDiagnosticEvent[]): VoiceSessionMetrics {
  const pendingSpeechStops: number[] = [];
  const metrics: VoiceSessionMetrics = {
    user_turns: 0,
    assistant_turns: 0,
    tool_calls: 0,
    interruptions: 0,
    errors: 0,
    incomplete_responses: 0,
    duplicate_responses: 0,
    speech_to_first_audio_ms: [],
  };

  for (const event of events) {
    if (event.type === "user_speech_stopped") {
      metrics.user_turns += 1;
      pendingSpeechStops.push(event.elapsed_ms);
    } else if (event.type === "assistant_transcript_completed") {
      metrics.assistant_turns += 1;
    } else if (event.type === "tool_started") {
      metrics.tool_calls += 1;
    } else if (event.type === "interrupted") {
      metrics.interruptions += 1;
      pendingSpeechStops.pop();
    } else if (event.type === "error") {
      metrics.errors += 1;
    } else if (event.type === "response_incomplete") {
      metrics.incomplete_responses += 1;
    } else if (event.type === "assistant_audio_started") {
      const speechStop = pendingSpeechStops.shift();
      if (speechStop !== undefined) metrics.speech_to_first_audio_ms.push(event.elapsed_ms - speechStop);
    }
  }

  const seenAssistantResponses = new Set<string>();
  for (const event of events) {
    if (event.type !== "assistant_transcript_completed" || !event.text) continue;
    const key = event.text.trim();
    if (seenAssistantResponses.has(key)) metrics.duplicate_responses += 1;
    seenAssistantResponses.add(key);
  }

  return metrics;
}
