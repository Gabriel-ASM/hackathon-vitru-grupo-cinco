import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyRoutine } from "../shared/schemas/routine";
import { normalizeRoutineExtractionResult } from "../server/routine-normalization";

test("normaliza sentinelas e aplica defaults operacionais conservadores", () => {
  const result = normalizeRoutineExtractionResult({
    routine: {
      wake_time: "06:00",
      sleep_time: "00:00",
      work: [{
        description: "Trabalho",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        start: "08:00",
        end: "18:00",
        notes: "Horários aproximados",
      }],
      commutes: [{
        description: "Deslocamento de casa para o trabalho",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        start: "/dev/null",
        end: "/dev/null",
        notes: "Duração aproximada de 30 minutos",
      }],
      fixed_commitments: [
        {
          description: "Jantar com família",
          days: ["monday", "tuesday", "wednesday", "thursday"],
          start: "21:00",
          end: "/dev/null",
          notes: "Ocorre aproximadamente no horário do jantar",
        },
        {
          description: "Igreja",
          days: ["sunday"],
          start: "/dev/null",
          end: "13:00",
          notes: "Compromisso no domingo de manhã",
        },
      ],
      hobbies: [],
      exercise: [{
        description: "Academia",
        days: [],
        start: "/dev/null",
        end: "/dev/null",
        notes: "Objetivo de pelo menos três dias por semana",
      }],
      study_preferences: {
        preferred_periods: [],
        session_length_minutes: null,
        avoid_periods: [],
        style: "/dev/null",
      },
      weekend_preferences: [],
      constraints: ["Manter a academia em pelo menos três dias da semana."],
      notes: [],
      availability: [],
      perceived_load: "/dev/null",
    },
    summary: "Trabalho durante os dias úteis e compromissos pessoais à noite.",
    warnings: [
      "A duração da academia e seus dias específicos não foram informados.",
      "O horário de término do tempo com a família de segunda a quinta não foi informado.",
      "O horário de início da igreja no domingo não foi informado.",
    ],
    academic_decisions: {
      temporary_class_changes: [],
    },
  });

  const commute = result.routine.commutes[0];
  const dinner = result.routine.fixed_commitments[0];
  const church = result.routine.fixed_commitments[1];
  const exercise = result.routine.exercise[0];

  assert.equal(commute?.start, "07:30");
  assert.equal(commute?.end, "08:00");
  assert.equal(dinner?.end, "22:00");
  assert.equal(church?.start, "08:00");
  assert.equal(exercise?.duration_minutes, 60);
  assert.equal(exercise?.frequency_per_week, 3);
  assert.equal(result.routine.study_preferences.style, null);
  assert.deepEqual(result.warnings, []);
  assert.equal(JSON.stringify(result).includes("/dev/null"), false);
});

test("aceita faixa de sono compreensível sem reabrir a conversa", () => {
  const result = normalizeRoutineExtractionResult({
    routine: {
      wake_time: "06:30",
      sleep_time: "23:00–23:30",
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
      notes: ["O aluno indicou uma faixa aproximada para dormir."],
      availability: [],
      perceived_load: null,
    },
    summary: "Sono e vigília informados com aproximação.",
    warnings: [
      "O horário de dormir foi informado como uma faixa aproximada entre 23:00 e 23:30.",
      "O horário de dormir ainda não foi confirmado.",
    ],
    academic_decisions: { temporary_class_changes: [] },
  });

  assert.equal(result.routine.sleep_time, "23:00");
  assert.equal(result.routine.wake_time, "06:30");
  assert.deepEqual(result.warnings, []);
});

test("interpreta horários longos de trajeto como expediente quando o trabalho veio vazio", () => {
  const routine = createEmptyRoutine();
  routine.wake_time = "06:00";
  routine.sleep_time = "23:00";
  routine.commutes = [{
    description: "Deslocamento de casa para o trabalho",
    days: [],
    start: "08:00",
    end: "17:00",
    notes: null,
    duration_minutes: null,
    frequency_per_week: null,
    fixed: true,
  }];

  const result = normalizeRoutineExtractionResult({
    routine,
    summary: "Expediente informado em horário comercial.",
    warnings: ["O expediente foi registrado como deslocamento."],
    academic_decisions: { temporary_class_changes: [] },
  });

  assert.equal(result.routine.work[0]?.start, "08:00");
  assert.equal(result.routine.work[0]?.end, "17:00");
  assert.deepEqual(result.routine.work[0]?.days, ["monday", "tuesday", "wednesday", "thursday", "friday"]);
  assert.equal(result.routine.commutes.length, 0);
  assert.deepEqual(result.warnings, []);
});

test("assume uma hora para reunião sem término e não cria alerta operacional", () => {
  const routine = createEmptyRoutine();
  routine.wake_time = "06:00";
  routine.sleep_time = "23:00";
  routine.fixed_commitments = [{
    description: "Reunião importante do trabalho",
    days: ["wednesday"],
    start: "19:00",
    end: null,
    notes: null,
    duration_minutes: null,
    frequency_per_week: null,
    fixed: true,
  }];

  const result = normalizeRoutineExtractionResult({
    routine,
    summary: "Reunião fixa na quarta-feira.",
    warnings: ["O término da reunião de quarta-feira não foi informado."],
    academic_decisions: { temporary_class_changes: [] },
  });

  assert.equal(result.routine.fixed_commitments[0]?.end, "20:00");
  assert.match(result.routine.fixed_commitments[0]?.notes ?? "", /60 minutos/);
  assert.deepEqual(result.warnings, []);
});

test("não trata sábado como bloqueio quando não há trabalho de fim de semana confirmado", () => {
  const routine = createEmptyRoutine();
  routine.wake_time = "06:00";
  routine.sleep_time = "23:00";
  const result = normalizeRoutineExtractionResult({
    routine,
    summary: "Trabalho recorrente durante a semana.",
    warnings: ["O horário de início do trabalho aos sábados não foi informado."],
    academic_decisions: { temporary_class_changes: [] },
  });

  assert.deepEqual(result.warnings, []);
});
