import assert from "node:assert/strict";
import test from "node:test";
import { filterScheduleItems } from "../shared/calendar";
import { addDays } from "../shared/date";
import { applyTemporaryClassChanges, validateWeeklySchedule } from "../shared/schemas/schedule";
import { DAY_KEYS, type ScheduleItem, type StudentSchedule, type WeeklySchedule } from "../shared/types";

const weekStart = "2026-08-17";

const academicSchedule: StudentSchedule = {
  student: { name: "Gabriel" },
  classes: [
    {
      name: "Cálculo",
      day: "monday",
      start: "08:00",
      end: "10:00",
      type: "presencial",
    },
  ],
  asynchronous_hours_week: 0,
  academic_activity_hours_week: 0,
  available_offerings: [],
  temporary_class_changes: [],
};

function sleepItem(day: string): ScheduleItem {
  return {
    id: `sleep-${day}`,
    type: "sleep",
    title: "Sono",
    start: "23:30",
    end: "08:00",
    fixed: true,
    source: "student_routine",
  };
}

function baseSchedule(): WeeklySchedule {
  const days: WeeklySchedule["days"] = DAY_KEYS.map((day, index) => ({
    date: addDays(weekStart, index),
    day_of_week: day,
    items: [sleepItem(day)],
  }));

  days[0]?.items.push({
    id: "class-calculo",
    type: "class",
    title: "Cálculo",
    start: "08:00",
    end: "10:00",
    fixed: true,
    source: "academic_schedule",
  });

  return {
    week_start: weekStart,
    week_end: addDays(weekStart, 6),
    days,
    summary: {
      class_hours: 2,
      asynchronous_class_hours: 0,
      academic_activity_hours: 0,
      recommended_extra_study_hours: 1,
      planned_extra_study_hours: 0,
      planned_free_hours: 100,
    },
    warnings: [],
  };
}

test("aceita sono que termina na manhã do dia seguinte", () => {
  assert.doesNotThrow(() => validateWeeklySchedule(baseSchedule(), academicSchedule));
});

test("continua rejeitando eventos comuns que atravessam a meia-noite", () => {
  const schedule = baseSchedule();
  schedule.days[0]?.items.push({
    id: "commute-invalid",
    type: "commute",
    title: "Deslocamento",
    start: "23:00",
    end: "01:00",
    fixed: true,
    source: "student_routine",
  });

  assert.throws(
    () => validateWeeklySchedule(schedule, academicSchedule),
    /Horário inválido no item "Deslocamento"/,
  );
});

test("preserva compromisso pessoal confirmado que termina à meia-noite", () => {
  const schedule = baseSchedule();
  schedule.days[4]!.items = [];
  schedule.days[4]?.items.push({
    id: "family-movie",
    type: "hobby",
    title: "Filme com a família",
    start: "23:00",
    end: "00:00",
    fixed: true,
    source: "student_routine",
  });

  assert.doesNotThrow(() => validateWeeklySchedule(schedule, academicSchedule));
});

test("detecta conflito entre o sono de um dia e um item da manhã seguinte", () => {
  const schedule = baseSchedule();
  schedule.days[1]?.items.push({
    id: "study-early",
    type: "study",
    title: "Estudo cedo",
    start: "07:00",
    end: "09:00",
    fixed: false,
    source: "ai_planning",
  });

  assert.throws(
    () => validateWeeklySchedule(schedule, academicSchedule),
    /sobreposição/,
  );
});

test("deriva a visão de aulas sem alterar a agenda completa", () => {
  const items: ScheduleItem[] = [
    {
      id: "class-1",
      type: "class",
      title: "Cálculo",
      start: "08:00",
      end: "10:00",
      fixed: true,
      source: "academic_schedule",
    },
    {
      id: "async-1",
      type: "asynchronous_class",
      title: "Leitura",
      start: "10:00",
      end: "11:00",
      fixed: false,
      source: "academic_schedule",
    },
    {
      id: "study-1",
      type: "study",
      title: "Revisão",
      start: "11:00",
      end: "12:00",
      fixed: false,
      source: "ai_planning",
    },
    {
      id: "work-1",
      type: "work",
      title: "Trabalho",
      start: "13:00",
      end: "17:00",
      fixed: true,
      source: "student_routine",
    },
  ];

  assert.deepEqual(
    filterScheduleItems(items, "academic").map((item) => item.id),
    ["class-1", "async-1"],
  );
  assert.deepEqual(
    filterScheduleItems(items, "academic", true).map((item) => item.id),
    ["class-1", "async-1", "study-1"],
  );
  assert.deepEqual(filterScheduleItems(items, "complete"), items);
});

test("exige oito horas autônomas da disciplina selecionada sem tratá-las como aula", () => {
  const schedule = baseSchedule();
  const activities = ["monday", "tuesday", "wednesday", "thursday"].map((day, index) => ({
    id: `academic-activity-${index}`,
    type: "academic_activity" as const,
    title: "Cálculo — atividade autônoma",
    start: "10:00",
    end: "12:00",
    fixed: false,
    source: "ai_planning" as const,
  }));
  activities.forEach((activity, index) => {
    schedule.days[index]?.items.push(activity);
  });
  schedule.summary.academic_activity_hours = 8;

  const academicInput: StudentSchedule = {
    ...academicSchedule,
    academic_activity_hours_week: 8,
  };
  assert.doesNotThrow(() => validateWeeklySchedule(schedule, academicInput));

  schedule.days[0]?.items.pop();
  assert.throws(() => validateWeeklySchedule(schedule, academicInput), /atividades acadêmicas/);
});

test("rejeita atividade acadêmica que aponta para outra disciplina", () => {
  const schedule = baseSchedule();
  schedule.days[0]?.items.push({
    id: "academic-activity-other",
    type: "academic_activity",
    title: "Arquitetura de Computadores — revisão",
    start: "10:00",
    end: "18:00",
    fixed: false,
    source: "ai_planning",
  });
  schedule.summary.academic_activity_hours = 8;

  assert.throws(
    () => validateWeeklySchedule(schedule, { ...academicSchedule, academic_activity_hours_week: 8 }),
    /não identifica a disciplina selecionada/,
  );
});

test("uma troca temporária substitui somente a aula da disciplina confirmada", () => {
  const schedule: StudentSchedule = {
    ...academicSchedule,
    classes: [{
      ...academicSchedule.classes[0]!,
      id: "current-offering",
      course_code: "CALC",
    }],
    temporary_class_changes: [{
      course_code: "CALC",
      offering_id: "temporary-offering",
      day: "tuesday",
      start: "19:00",
      end: "20:30",
      temporary: true,
    }],
  };
  const resolved = applyTemporaryClassChanges(schedule);
  assert.equal(resolved.classes[0]?.day, "tuesday");
  assert.equal(resolved.classes[0]?.id, "temporary-offering");
  assert.equal(resolved.classes[0]?.course_code, "CALC");
});
