import assert from "node:assert/strict";
import test from "node:test";
import { buildVoiceAgentInstructions } from "../server/prompts/voice-agent";
import { MOCK_SCHEDULE } from "../shared/mockSchedule";
import { getAssistantVoiceProfile } from "../shared/voice-profile";

test("mapeia UniCesumar para Edu com Cedar e modelo Realtime 2.1", () => {
  const profile = getAssistantVoiceProfile("unicesumar");

  assert.equal(profile.assistantName, "Edu");
  assert.equal(profile.voice, "cedar");
  assert.equal(profile.preset, "cedar_2_1");
  assert.equal(profile.model, "gpt-realtime-2.1");
});

test("o prompt usa a identidade correta em cada instituição", () => {
  const eduPrompt = buildVoiceAgentInstructions(
    MOCK_SCHEDULE,
    getAssistantVoiceProfile("unicesumar"),
  );
  const sofiaPrompt = buildVoiceAgentInstructions(
    MOCK_SCHEDULE,
    getAssistantVoiceProfile("uniasselvi"),
  );

  assert.match(eduPrompt, /Edu/);
  assert.doesNotMatch(eduPrompt, /Sofia/);
  assert.match(sofiaPrompt, /Sofia/);
  assert.doesNotMatch(sofiaPrompt, /Edu/);
});

test("a abertura pode ser reduzida quando a interface já apresentou a assistente", () => {
  const prompt = buildVoiceAgentInstructions(
    MOCK_SCHEDULE,
    getAssistantVoiceProfile("unicesumar"),
    undefined,
    true,
  );

  assert.match(prompt, /interface ja apresentou sua identidade/i);
  assert.match(prompt, /Identidade ativa/);
});
