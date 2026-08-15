import "dotenv/config";

export const realtimePresets = [
  "marin_2_1",
  "cedar_2_1",
  "sage_2_1",
  "marin_1_5",
] as const;

export type RealtimePreset = (typeof realtimePresets)[number];
export type NoiseReduction = "near_field" | "far_field";
export type VadEagerness = "low" | "medium" | "high" | "auto";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export const realtimeVoices = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;
export type RealtimeVoice = (typeof realtimeVoices)[number];

const port = Number(process.env.PORT ?? 3001);
const configuredNoiseReduction: NoiseReduction =
  process.env.REALTIME_NOISE_REDUCTION === "far_field" ? "far_field" : "near_field";
const configuredVadEagerness: VadEagerness = ["low", "medium", "high", "auto"].includes(
  process.env.REALTIME_VAD_EAGERNESS ?? "",
)
  ? (process.env.REALTIME_VAD_EAGERNESS as VadEagerness)
  : "low";
const configuredReasoningEffort: ReasoningEffort = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
].includes(process.env.REALTIME_REASONING_EFFORT ?? "")
  ? (process.env.REALTIME_REASONING_EFFORT as ReasoningEffort)
  : "low";
const maxOutputTokens = Number(process.env.REALTIME_MAX_OUTPUT_TOKENS ?? 2048);
const configuredVoice: RealtimeVoice = realtimeVoices.includes(
  process.env.REALTIME_VOICE as RealtimeVoice,
)
  ? (process.env.REALTIME_VOICE as RealtimeVoice)
  : "marin";

export type RealtimeRuntimeConfig = {
  realtimeModel: string;
  realtimeVoice: RealtimeVoice;
  noiseReduction: NoiseReduction;
  vadEagerness: VadEagerness;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  preset: RealtimePreset | "env";
};

export const config: RealtimeRuntimeConfig & {
  port: number;
  plannerModel: string;
  diagnosticsEnabled: boolean;
  diagnosticsDir: string;
} = {
  port: Number.isFinite(port) ? port : 3001,
  realtimeModel: process.env.REALTIME_MODEL ?? "gpt-realtime-2.1",
  plannerModel: process.env.PLANNER_MODEL ?? "gpt-5.6",
  realtimeVoice: configuredVoice,
  noiseReduction: configuredNoiseReduction,
  vadEagerness: configuredVadEagerness,
  reasoningEffort: configuredReasoningEffort,
  maxOutputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens >= 64 ? maxOutputTokens : 2048,
  preset: "env",
  diagnosticsEnabled: process.env.VOICE_DIAGNOSTICS === "true",
  diagnosticsDir: process.env.VOICE_DIAGNOSTICS_DIR ?? "logs/voice-sessions",
};

function presetConfig(preset: RealtimePreset): RealtimeRuntimeConfig {
  const voice = preset.startsWith("cedar") ? "cedar" : preset.startsWith("sage") ? "sage" : "marin";
  const model = preset.endsWith("1_5") ? "gpt-realtime-1.5" : "gpt-realtime-2.1";
  return {
    realtimeModel: model,
    realtimeVoice: voice,
    noiseReduction: config.noiseReduction,
    vadEagerness: config.vadEagerness,
    reasoningEffort: config.reasoningEffort,
    maxOutputTokens: config.maxOutputTokens,
    preset,
  };
}

export function resolveRealtimeConfig(preset: unknown): RealtimeRuntimeConfig {
  if (config.diagnosticsEnabled && typeof preset === "string" && realtimePresets.includes(preset as RealtimePreset)) {
    return presetConfig(preset as RealtimePreset);
  }
  return config;
}

export function supportsReasoning(model: string): boolean {
  return model.includes("gpt-realtime-2");
}

export function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não está configurada no arquivo .env.");
  }
  return apiKey;
}
