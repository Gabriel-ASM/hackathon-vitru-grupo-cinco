import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_SCHEDULE } from "../shared/mockSchedule";
import {
  buildRoutineClarificationContext,
  clarificationAddedUserFacts,
  shouldClarifyRoutine,
} from "../shared/routine-clarification";
import { createEmptyRoutine, routineExtractionResultSchema } from "../shared/schemas/routine";
import { brazilianPortugueseFarewellInstructions } from "../shared/voice-style";
import {
  buildRoutineExtractionInput,
  routineExtractorPrompt,
} from "../server/prompts/routine-extractor";
import { buildVoiceAgentInstructions, voiceAgentPrompt } from "../server/prompts/voice-agent";
import { realtimeTools } from "../server/realtime-tools";
import { parseReferenceText } from "../shared/voice-transcript";

test("a referência textual simples vira evidência do aluno", () => {
  const transcript = parseReferenceText("Durmo às 23h e trabalho de manhã.\nFaço exercício três vezes por semana.");

  assert.equal(transcript.length, 1);
  assert.equal(transcript[0]?.role, "user");
  assert.match(transcript[0]?.text ?? "", /Durmo às 23h/);
  assert.match(transcript[0]?.text ?? "", /exercício três vezes/);
});

test("a referência com prefixos preserva contexto da IA sem misturar evidências", () => {
  const transcript = parseReferenceText([
    "IA: Qual é seu horário de trabalho?",
    "Aluno: Trabalho das 8h às 17h.",
    "O trajeto leva 40 minutos.",
    "IA: Você estuda à noite?",
    "Aluno: Sim, depois das 19h.",
  ].join("\n"));

  assert.deepEqual(transcript.map(({ role, text }) => ({ role, text })), [
    { role: "assistant", text: "Qual é seu horário de trabalho?" },
    { role: "user", text: "Trabalho das 8h às 17h.\nO trajeto leva 40 minutos." },
    { role: "assistant", text: "Você estuda à noite?" },
    { role: "user", text: "Sim, depois das 19h." },
  ]);
});

test("o extrator mantém a transcrição separada por papel", () => {
  const input = buildRoutineExtractionInput(MOCK_SCHEDULE, [
    { role: "assistant", text: "Você dorme às 22h?", timestamp: "2026-01-01T00:00:00.000Z" },
    { role: "user", text: "Na verdade durmo às 23h.", timestamp: "2026-01-01T00:00:01.000Z" },
  ]);
  const payload = JSON.parse(input) as {
    user_facts: string[];
    conversation_context: Array<{ role: string; text: string }>;
  };

  assert.deepEqual(payload.user_facts, ["Na verdade durmo às 23h."]);
  assert.deepEqual(payload.conversation_context, [
    { role: "assistant", text: "Você dorme às 22h?" },
    { role: "user", text: "Na verdade durmo às 23h." },
  ]);
  assert.match(routineExtractorPrompt, /somente os itens de user_facts/i);
  assert.match(routineExtractorPrompt, /mais recente do aluno corrige/i);
  assert.match(routineExtractorPrompt, /não invente horários/i);
  assert.match(routineExtractorPrompt, /monday, tuesday, wednesday, thursday e friday/i);
  assert.match(routineExtractorPrompt, /escala 6x1/i);
  assert.match(routineExtractorPrompt, /00:00 e o horário de dormir/i);

  const planningDefaults = JSON.parse(input) as {
    planning_defaults: {
      six_by_one_requires_explicit_mention: boolean;
      ambiguous_midnight_activity: string;
    };
  };
  assert.equal(planningDefaults.planning_defaults.six_by_one_requires_explicit_mention, true);
  assert.equal(
    planningDefaults.planning_defaults.ambiguous_midnight_activity,
    "preserve_as_personal_or_omit_without_warning",
  );

  const academicPayload = JSON.parse(input) as {
    academic_subject?: { name: string; autonomous_hours_week: number } | null;
    academic_subjects?: Array<{ name: string; hours_week: number }>;
  };
  assert.equal(academicPayload.academic_subject?.name, "Qualidade e Testes de Software");
  assert.equal(academicPayload.academic_subject?.autonomous_hours_week, 8);
  assert.deepEqual(academicPayload.academic_subjects, [
    { code: "135481", name: "Qualidade e Testes de Software", hours_week: 8 },
  ]);
});

test("abre no máximo uma rodada somente para bloqueios reais", () => {
  const warnings = [
    "A duração da academia não foi informada.",
    "O horário do jantar não tem término exato.",
    "O início da igreja não foi informado.",
    "Existe conflito entre a reunião obrigatória e a aula.",
  ];
  const routine = createEmptyRoutine();
  assert.equal(shouldClarifyRoutine(warnings, "voice", 0, routine), true);
  assert.equal(shouldClarifyRoutine(warnings, "voice", 1, routine), false);
  assert.equal(shouldClarifyRoutine(warnings, "reference", 0), false);

  const context = buildRoutineClarificationContext(warnings, routine, ["Trabalho das oito às cinco."]);
  assert.match(context, /current_routine_draft/);
  assert.match(context, /blocking_warnings/);
  assert.match(context, /Trabalho das oito às cinco/);
  assert.match(context, /não refaça a entrevista/i);
});

test("não abre rodada para detalhes aproximáveis", () => {
  const routine = createEmptyRoutine();
  routine.exercise = [{
    description: "Academia",
    days: [],
    start: null,
    end: null,
    notes: "Suposição operacional: atividade flexível de 60 minutos, 3 vezes por semana.",
    duration_minutes: 60,
    frequency_per_week: 3,
    fixed: false,
  }];
  assert.equal(
    shouldClarifyRoutine(
      ["A duração de cada sessão de academia não foi informada."],
      "voice",
      0,
      routine,
    ),
    false,
  );
});

test("reutiliza o rascunho quando a rodada não acrescenta fala do aluno", () => {
  assert.equal(clarificationAddedUserFacts(8, 8), false);
  assert.equal(clarificationAddedUserFacts(8, 9), true);
  assert.equal(clarificationAddedUserFacts(null, 0), true);
});

test("prioriza uma confirmação de sono mesmo antes de quatro warnings", () => {
  assert.equal(
    shouldClarifyRoutine(
      ["O horário de dormir ainda não foi confirmado."],
      "voice",
      0,
      {
        wake_time: "06:00",
        sleep_time: null,
        work: [],
        commutes: [],
        fixed_commitments: [],
        hobbies: [],
        exercise: [],
        study_preferences: {
          preferred_periods: [],
          session_length_minutes: null,
          avoid_periods: [],
          style: null,
        },
        weekend_preferences: [],
        constraints: [],
        notes: [],
        availability: [],
        perceived_load: null,
      },
    ),
    true,
  );
});

test("o schema de extração exige rotina completa e advertências", () => {
  const emptyRoutine = {
    wake_time: null,
    sleep_time: null,
    work: [],
    commutes: [],
    fixed_commitments: [],
    hobbies: [],
    exercise: [],
    study_preferences: {
      preferred_periods: [],
      session_length_minutes: null,
      avoid_periods: [],
      style: null,
    },
    weekend_preferences: [],
    constraints: [],
    notes: [],
    availability: [],
    perceived_load: null,
  };
  const result = routineExtractionResultSchema.parse({
    routine: emptyRoutine,
    summary: "Ainda não há restrições adicionais confirmadas.",
    warnings: ["O deslocamento não teve duração clara."],
  });

  assert.equal(result.routine.sleep_time, null);
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(result.academic_decisions.temporary_class_changes, []);
});

test("a conversa em tempo real recebe espera silenciosa e sinal de conclusão", () => {
  assert.deepEqual(realtimeTools.map((tool) => tool.name), ["wait_for_user", "complete_onboarding"]);
  assert.deepEqual(realtimeTools[0].parameters.properties, {});
  assert.match(voiceAgentPrompt, /Você é a Sofia/);
  assert.match(voiceAgentPrompt, /# Idioma/);
  assert.match(voiceAgentPrompt, /# Sotaque e prosódia/);
  assert.match(voiceAgentPrompt, /ritmo silábico.*português brasileiro/i);
  assert.match(voiceAgentPrompt, /Não aplique cadência.*inglês/i);
  assert.match(voiceAgentPrompt, /Pronúncia lexical e números/i);
  assert.match(voiceAgentPrompt, /trinta minutos/i);
  assert.match(voiceAgentPrompt, /Sono e despertar são campos independentes/i);
  assert.match(voiceAgentPrompt, /available_offerings/);
  assert.match(voiceAgentPrompt, /somente uma intenção principal de coleta por turno/i);
  assert.match(voiceAgentPrompt, /21h30 não significa meia-noite/i);
  assert.match(voiceAgentPrompt, /wait_for_user/);
  assert.match(voiceAgentPrompt, /Nunca diga que vai pensar/i);
  assert.match(voiceAgentPrompt, /não use frases de preenchimento/i);
  assert.doesNotMatch(voiceAgentPrompt, /update_student_routine/);
  assert.match(voiceAgentPrompt, /A resposta pode mudar um horário/i);
  assert.match(brazilianPortugueseFarewellInstructions, /sotaque brasileiro neutro/i);
  assert.match(brazilianPortugueseFarewellInstructions, /prosódia brasileira natural/i);
});

test("a rodada de esclarecimento chega ao prompt sem reabrir a entrevista inteira", () => {
  const instructions = buildVoiceAgentInstructions(MOCK_SCHEDULE, '{"warnings":["dias do trabalho"]}');

  assert.match(instructions, /MODO CONTINUAÇÃO/i);
  assert.match(instructions, /dias do trabalho/);
  assert.match(instructions, /não se apresente/i);
  assert.doesNotMatch(instructions, /Como costuma ser uma semana normal/);
});
