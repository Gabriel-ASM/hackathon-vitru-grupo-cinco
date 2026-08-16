import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { RealtimeRuntimeConfig } from "./config";
import { diagnosticEventTypes, type VoiceDiagnosticEvent } from "../shared/voice-diagnostics";
import type { AssistantVoiceProfile } from "../shared/voice-profile";

const maxStoredSessions = 20;
const maxTextLength = 2_000;

export type VoiceDiagnosticSession = {
  session_id: string;
  created_at: string;
  config: Pick<RealtimeRuntimeConfig, "realtimeModel" | "realtimeVoice" | "noiseReduction" | "vadEagerness" | "reasoningEffort" | "maxOutputTokens" | "preset"> & {
    institution?: AssistantVoiceProfile["institution"];
    assistant_name?: AssistantVoiceProfile["assistantName"];
  };
};

function sessionPath(directory: string, sessionId: string): string {
  if (!/^[a-f0-9-]{20,80}$/i.test(sessionId)) throw new Error("ID de sessão de diagnóstico inválido.");
  return path.join(directory, `${sessionId}.jsonl`);
}

async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

function sanitizeEvent(value: unknown): VoiceDiagnosticEvent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<VoiceDiagnosticEvent>;
  if (
    typeof candidate.type !== "string" ||
    !diagnosticEventTypes.includes(candidate.type as (typeof diagnosticEventTypes)[number]) ||
    typeof candidate.timestamp !== "string"
  ) return null;
  if (typeof candidate.elapsed_ms !== "number" || !Number.isFinite(candidate.elapsed_ms)) return null;

  const event: VoiceDiagnosticEvent = {
    type: candidate.type as VoiceDiagnosticEvent["type"],
    timestamp: candidate.timestamp,
    elapsed_ms: Math.max(0, Math.round(candidate.elapsed_ms)),
  };
  if (typeof candidate.turn_id === "string") event.turn_id = candidate.turn_id.slice(0, 100);
  if (typeof candidate.response_id === "string") event.response_id = candidate.response_id.slice(0, 100);
  if (typeof candidate.tool === "string") event.tool = candidate.tool.slice(0, 100);
  if (typeof candidate.text === "string") event.text = candidate.text.slice(0, maxTextLength);
  if (candidate.details && typeof candidate.details === "object") {
    const details: Record<string, string | number | boolean | null> = {};
    for (const [key, detail] of Object.entries(candidate.details)) {
      if (Object.keys(details).length >= 20) break;
      if (
        detail === null ||
        typeof detail === "string" ||
        typeof detail === "number" ||
        typeof detail === "boolean"
      ) {
        details[key.slice(0, 80)] = typeof detail === "string" ? detail.slice(0, 500) : detail;
      }
    }
    if (Object.keys(details).length > 0) event.details = details;
  }
  return event;
}

export async function createVoiceDiagnosticSession(
  directory: string,
  runtimeConfig: RealtimeRuntimeConfig,
  profile?: AssistantVoiceProfile,
): Promise<VoiceDiagnosticSession> {
  await ensureDirectory(directory);
  const session: VoiceDiagnosticSession = {
    session_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    config: {
      realtimeModel: runtimeConfig.realtimeModel,
      realtimeVoice: runtimeConfig.realtimeVoice,
      noiseReduction: runtimeConfig.noiseReduction,
      vadEagerness: runtimeConfig.vadEagerness,
      reasoningEffort: runtimeConfig.reasoningEffort,
      maxOutputTokens: runtimeConfig.maxOutputTokens,
      preset: runtimeConfig.preset,
      ...(profile
        ? { institution: profile.institution, assistant_name: profile.assistantName }
        : {}),
    },
  };
  await fs.writeFile(sessionPath(directory, session.session_id), `${JSON.stringify(session)}\n`, "utf8");
  await pruneDiagnosticSessions(directory);
  return session;
}

export async function appendVoiceDiagnosticEvents(
  directory: string,
  sessionId: string,
  values: unknown[],
): Promise<number> {
  const events = values.map(sanitizeEvent).filter((event): event is VoiceDiagnosticEvent => event !== null).slice(0, 100);
  if (events.length === 0) return 0;
  await fs.appendFile(sessionPath(directory, sessionId), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
  return events.length;
}

export async function readVoiceDiagnosticSession(directory: string, sessionId: string): Promise<string> {
  return fs.readFile(sessionPath(directory, sessionId), "utf8");
}

async function pruneDiagnosticSessions(directory: string): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map(async (entry) => ({
        name: entry.name,
        mtime: (await fs.stat(path.join(directory, entry.name))).mtimeMs,
      })),
  );
  files.sort((left, right) => right.mtime - left.mtime);
  await Promise.all(files.slice(maxStoredSessions).map((file) => fs.unlink(path.join(directory, file.name))));
}
