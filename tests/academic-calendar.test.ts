import assert from "node:assert/strict";
import test from "node:test";
import { buildAcademicCalendarImport } from "../shared/calendar";
import { addDays } from "../shared/date";
import { DAY_KEYS, type WeeklySchedule } from "../shared/types";

const weekStart = "2026-08-17";

function scheduleWithAcademicItems(): WeeklySchedule {
  return {
    week_start: weekStart,
    week_end: addDays(weekStart, 6),
    days: DAY_KEYS.map((day, index) => ({
      date: addDays(weekStart, index),
      day_of_week: day,
      items: index === 2
        ? [
            {
              id: "class-quality",
              type: "class",
              title: "Qualidade e Testes de Software",
              start: "19:00",
              end: "20:30",
              fixed: true,
              source: "academic_schedule",
            },
            {
              id: "async-quality",
              type: "asynchronous_class",
              title: "Atividade assíncrona",
              start: "20:30",
              end: "21:00",
              fixed: false,
              source: "academic_schedule",
            },
            {
              id: "study-quality",
              type: "study",
              title: "Revisão da disciplina",
              start: "21:00",
              end: "22:00",
              fixed: false,
              source: "ai_planning",
            },
            {
              id: "activity-quality",
              type: "academic_activity",
              title: "Atividade acadêmica de Qualidade",
              start: "22:00",
              end: "22:30",
              fixed: false,
              source: "ai_planning",
            },
            {
              id: "personal-dinner",
              type: "personal",
              title: "Jantar com amigos",
              start: "23:00",
              end: "23:30",
              fixed: false,
              source: "student_routine",
            },
          ]
        : [],
    })),
    summary: {
      class_hours: 1.5,
      asynchronous_class_hours: 0.5,
      academic_activity_hours: 0.5,
      recommended_extra_study_hours: 0,
      planned_extra_study_hours: 1,
      planned_free_hours: 100,
    },
    warnings: [],
  };
}

test("gera importação acadêmica com aulas e atividades, excluindo a rotina pessoal", () => {
  const imported = buildAcademicCalendarImport(
    scheduleWithAcademicItems(),
    "2026-08-16T12:00:00.000Z",
  );

  assert.deepEqual(imported, {
    version: 2,
    source: "sofia",
    updated_at: "2026-08-16T12:00:00.000Z",
    week_start: "2026-08-17",
    week_end: "2026-08-23",
    items: [
      {
        id: "class-quality",
        date: "2026-08-19",
        day_of_week: "wednesday",
        title: "Qualidade e Testes de Software",
        type: "class",
        start: "19:00",
        end: "20:30",
        fixed: true,
        source: "academic_schedule",
      },
      {
        id: "async-quality",
        date: "2026-08-19",
        day_of_week: "wednesday",
        title: "Atividade assíncrona",
        type: "asynchronous_class",
        start: "20:30",
        end: "21:00",
        fixed: false,
        source: "academic_schedule",
      },
      {
        id: "activity-quality",
        date: "2026-08-19",
        day_of_week: "wednesday",
        title: "Atividade acadêmica de Qualidade",
        type: "academic_activity",
        start: "22:00",
        end: "22:30",
        fixed: false,
        source: "ai_planning",
      },
    ],
  });
});
