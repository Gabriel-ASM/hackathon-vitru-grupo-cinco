export const institutionKeys = ["uniasselvi", "unicesumar"] as const;

export type Institution = (typeof institutionKeys)[number];

export const voiceProfilePresets = [
  "marin_2_1",
  "cedar_2_1",
] as const;

export type VoiceProfilePreset = (typeof voiceProfilePresets)[number];

export type AssistantVoiceProfile = {
  institution: Institution;
  label: "UNIASSELVI" | "UniCesumar";
  assistantName: "Sofia" | "Edu";
  article: "a" | "o";
  voice: "marin" | "cedar";
  model: "gpt-realtime-2.1";
  preset: VoiceProfilePreset;
};

export const assistantVoiceProfiles: Record<Institution, AssistantVoiceProfile> = {
  uniasselvi: {
    institution: "uniasselvi",
    label: "UNIASSELVI",
    assistantName: "Sofia",
    article: "a",
    voice: "marin",
    model: "gpt-realtime-2.1",
    preset: "marin_2_1",
  },
  unicesumar: {
    institution: "unicesumar",
    label: "UniCesumar",
    assistantName: "Edu",
    article: "o",
    voice: "cedar",
    model: "gpt-realtime-2.1",
    preset: "cedar_2_1",
  },
};

export function isInstitution(value: unknown): value is Institution {
  return typeof value === "string" && institutionKeys.includes(value as Institution);
}

export function getAssistantVoiceProfile(value: unknown): AssistantVoiceProfile {
  return assistantVoiceProfiles[isInstitution(value) ? value : "uniasselvi"];
}
