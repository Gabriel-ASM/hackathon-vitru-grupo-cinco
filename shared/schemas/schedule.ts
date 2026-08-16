import { z } from "zod";
import { addDays, hoursBetween, minutesFromTime } from "../date";
import {
  DAY_KEYS,
  EVENT_TYPES,
  type ScheduleItem,
  type StudentSchedule,
  type WeeklySchedule,
} from "../types";
import { studentRoutineSchema, temporaryClassChangeSchema } from "./routine";

export { temporaryClassChangeSchema } from "./routine";

export const dayOfWeekSchema = z.enum(DAY_KEYS);
export const eventTypeSchema = z.enum(EVENT_TYPES);
export const eventSourceSchema = z.enum([
  "academic_schedule",
  "student_routine",
  "ai_planning",
]);

export const timeStringSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const academicOfferingSchema = z.object({
  id: z.string().min(1),
  course_code: z.string().min(1),
  name: z.string().min(1),
  day: dayOfWeekSchema,
  start: timeStringSchema,
  end: timeStringSchema,
  type: z.string().min(1),
  modality: z.string().min(1),
  explicit_schedule: z.boolean(),
  is_current: z.boolean(),
  temporary: z.boolean(),
});

export const scheduleItemSchema = z.object({
  id: z.string(),
  type: eventTypeSchema,
  title: z.string(),
  start: z.string(),
  end: z.string(),
  fixed: z.boolean(),
  source: eventSourceSchema,
});

const strictScheduleItemSchema = scheduleItemSchema.extend({
  start: timeStringSchema,
  end: timeStringSchema,
});

export const scheduleDaySchema = z.object({
  date: z.string(),
  day_of_week: dayOfWeekSchema,
  items: z.array(scheduleItemSchema),
});

export const weeklyScheduleSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  days: z.array(scheduleDaySchema),
  summary: z.object({
    class_hours: z.number(),
    asynchronous_class_hours: z.number(),
    academic_activity_hours: z.number(),
    recommended_extra_study_hours: z.number(),
    planned_extra_study_hours: z.number(),
    planned_free_hours: z.number(),
  }),
  warnings: z.array(z.string()),
});

const strictScheduleDaySchema = scheduleDaySchema.extend({
  items: z.array(strictScheduleItemSchema),
});

export const strictWeeklyScheduleSchema = weeklyScheduleSchema.extend({
  days: z.array(strictScheduleDaySchema),
});

export const studentScheduleSchema = z.object({
  student: z.object({ name: z.string().min(1) }),
  classes: z.array(
    z.object({
      id: z.string().optional(),
      course_code: z.string().min(1).optional(),
      offering_id: z.string().min(1).optional(),
      name: z.string().min(1),
      day: dayOfWeekSchema,
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      type: z.string().min(1),
    }),
  ),
  asynchronous_hours_week: z.number().nonnegative(),
  academic_activity_hours_week: z.number().nonnegative().optional(),
  available_offerings: z.array(academicOfferingSchema).optional().default([]),
  temporary_class_changes: z.array(temporaryClassChangeSchema).optional().default([]),
});

export const scheduleGenerationRequestSchema = z.object({
  academic_schedule: studentScheduleSchema,
  routine: studentRoutineSchema,
  pedagogical_rules: z.object({
    extra_study_minutes_per_class_hour: z.number().positive(),
    description: z.string(),
  }),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ScheduleGenerationRequest = z.infer<typeof scheduleGenerationRequestSchema>;
export type WeeklyScheduleOutput = z.infer<typeof weeklyScheduleSchema>;

export function applyTemporaryClassChanges(schedule: StudentSchedule): StudentSchedule {
  const changes = schedule.temporary_class_changes ?? [];
  if (changes.length === 0) return schedule;

  return {
    ...schedule,
    classes: schedule.classes.map((academicClass) => {
      const courseCode = academicClass.course_code ?? academicClass.id;
      const change = changes.find((candidate) => candidate.course_code === courseCode);
      if (!change) return academicClass;

      return {
        ...academicClass,
        id: change.offering_id,
        offering_id: change.offering_id,
        day: change.day,
        start: change.start,
        end: change.end,
      };
    }),
  };
}

type TimelineItem = {
  start: number;
  end: number;
  dayOfWeek: (typeof DAY_KEYS)[number];
  item: ScheduleItem;
};

export function validateWeeklySchedule(
  value: unknown,
  academicSchedule?: StudentSchedule,
): WeeklySchedule {
  const schedule = strictWeeklyScheduleSchema.parse(value);
  const errors: string[] = [];
  const timelineItems: TimelineItem[] = [];

  if (schedule.days.length !== DAY_KEYS.length) {
    errors.push("O calendário precisa conter exatamente sete dias.");
  }

  for (let index = 0; index < DAY_KEYS.length; index += 1) {
    const day = schedule.days[index];
    if (!day) {
      errors.push(`Dia ausente no índice ${index}.`);
      continue;
    }

    if (day.day_of_week !== DAY_KEYS[index]) {
      errors.push(`Os dias precisam estar na ordem de segunda a domingo.`);
    }

    const expectedDate = addDays(schedule.week_start, index);
    if (day.date !== expectedDate) {
      errors.push(`A data de ${day.day_of_week} deveria ser ${expectedDate}.`);
    }

    for (const item of day.items) {
      const start = minutesFromTime(item.start);
      const end = minutesFromTime(item.end);
      const overnightItem = ["sleep", "hobby", "personal"].includes(item.type) && end < start;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        (end <= start && !overnightItem)
      ) {
        errors.push(`Horário inválido no item "${item.title}".`);
        continue;
      }

      const dayStart = index * 24 * 60;
      timelineItems.push({
        start: dayStart + start,
        end: overnightItem ? dayStart + 24 * 60 + end : dayStart + end,
        dayOfWeek: day.day_of_week,
        item,
      });
    }
  }

  timelineItems.sort((left, right) => left.start - right.start);
  for (let itemIndex = 1; itemIndex < timelineItems.length; itemIndex += 1) {
    const previous = timelineItems[itemIndex - 1];
    const current = timelineItems[itemIndex];
    if (previous && current && current.start < previous.end) {
      errors.push(
        `Há sobreposição entre ${previous.dayOfWeek}: "${previous.item.title}" e ${current.dayOfWeek}: "${current.item.title}".`,
      );
    }
  }

  if (schedule.week_end !== addDays(schedule.week_start, 6)) {
    errors.push("week_end não corresponde aos sete dias iniciados em week_start.");
  }

  if (academicSchedule) {
    for (const academicClass of academicSchedule.classes) {
      const day = schedule.days.find((candidate) => candidate.day_of_week === academicClass.day);
      const matchingClass = day?.items.find(
        (item) =>
          item.type === "class" &&
          item.title.trim().toLocaleLowerCase() === academicClass.name.trim().toLocaleLowerCase() &&
          item.start === academicClass.start &&
          item.end === academicClass.end,
      );

      if (!matchingClass || !matchingClass.fixed || matchingClass.source !== "academic_schedule") {
        errors.push(`A aula fixa "${academicClass.name}" não foi preservada exatamente.`);
      }
    }
  }

  const plannedAcademicActivityHours = schedule.days
    .flatMap((day) => day.items)
    .filter((item) => item.type === "academic_activity")
    .reduce((total, item) => total + hoursBetween(item.start, item.end), 0);
  const explicitAcademicActivityHours = academicSchedule?.academic_activity_hours_week;
  const expectedAcademicActivityHours =
    explicitAcademicActivityHours !== undefined && explicitAcademicActivityHours > 0
      ? explicitAcademicActivityHours
      : academicSchedule?.asynchronous_hours_week ?? 0;
  if (expectedAcademicActivityHours > 0 && Math.abs(plannedAcademicActivityHours - expectedAcademicActivityHours) > 0.01) {
    errors.push(
      `A carga de atividades acadêmicas deveria totalizar ${expectedAcademicActivityHours}h, mas totalizou ${plannedAcademicActivityHours}h.`,
    );
  }
  if (Math.abs(schedule.summary.academic_activity_hours - plannedAcademicActivityHours) > 0.01) {
    errors.push("O resumo não corresponde à carga de atividades acadêmicas da agenda.");
  }
  const selectedAcademicClass = academicSchedule?.classes[0];
  if (selectedAcademicClass && plannedAcademicActivityHours > 0) {
    const subjectTokens = [selectedAcademicClass.course_code, ...selectedAcademicClass.name.split(/\s+/)]
      .filter((token): token is string => Boolean(token))
      .map((token) => token.toLocaleLowerCase().replace(/[^a-záéíóúàâêôãõç0-9]/gi, ""))
      .filter((token) => token.length >= 4);
    if (subjectTokens.length > 0) {
      const unrelatedActivity = schedule.days
        .flatMap((day) => day.items)
        .filter((item) => item.type === "academic_activity")
        .find((item) => {
          const title = item.title.toLocaleLowerCase();
          return !subjectTokens.some((token) => title.includes(token));
        });
      if (unrelatedActivity) {
        errors.push(
          `A atividade acadêmica "${unrelatedActivity.title}" não identifica a disciplina selecionada "${selectedAcademicClass.name}".`,
        );
      }
    }
  }
  const plannedClassHours = schedule.days
    .flatMap((day) => day.items)
    .filter((item) => item.type === "class")
    .reduce((total, item) => total + hoursBetween(item.start, item.end), 0);
  if (Math.abs(schedule.summary.class_hours - plannedClassHours) > 0.01) {
    errors.push("O resumo não corresponde à carga de aulas fixas da agenda.");
  }
  const plannedAsyncHours = schedule.days
    .flatMap((day) => day.items)
    .filter((item) => item.type === "asynchronous_class")
    .reduce((total, item) => total + hoursBetween(item.start, item.end), 0);
  if (Math.abs(schedule.summary.asynchronous_class_hours - plannedAsyncHours) > 0.01) {
    errors.push("O resumo não corresponde à carga de aulas assíncronas da agenda.");
  }

  const numericSummary = Object.entries(schedule.summary).filter(
    ([, value]) => typeof value !== "number" || value < 0,
  );
  if (numericSummary.length > 0) {
    errors.push("O resumo contém valores numéricos inválidos.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return schedule;
}

export function calculateClassHours(schedule: StudentSchedule): number {
  return schedule.classes.reduce(
    (total, academicClass) => total + hoursBetween(academicClass.start, academicClass.end),
    0,
  );
}
