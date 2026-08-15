import { z } from "zod";
import { addDays, hoursBetween, minutesFromTime } from "../date";
import {
  DAY_KEYS,
  EVENT_TYPES,
  type ScheduleItem,
  type StudentSchedule,
  type WeeklySchedule,
} from "../types";
import { studentRoutineSchema } from "./routine";

export const dayOfWeekSchema = z.enum(DAY_KEYS);
export const eventTypeSchema = z.enum(EVENT_TYPES);
export const eventSourceSchema = z.enum([
  "academic_schedule",
  "student_routine",
  "ai_planning",
]);

export const scheduleItemSchema = z.object({
  id: z.string(),
  type: eventTypeSchema,
  title: z.string(),
  start: z.string(),
  end: z.string(),
  fixed: z.boolean(),
  source: eventSourceSchema,
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
    recommended_extra_study_hours: z.number(),
    planned_extra_study_hours: z.number(),
    planned_free_hours: z.number(),
  }),
  warnings: z.array(z.string()),
});

export const studentScheduleSchema = z.object({
  student: z.object({ name: z.string().min(1) }),
  classes: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      day: dayOfWeekSchema,
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      type: z.string().min(1),
    }),
  ),
  asynchronous_hours_week: z.number().nonnegative(),
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
  const schedule = weeklyScheduleSchema.parse(value);
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
      const overnightSleep = item.type === "sleep" && end < start;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        (end <= start && !overnightSleep)
      ) {
        errors.push(`Horário inválido no item "${item.title}".`);
        continue;
      }

      const dayStart = index * 24 * 60;
      timelineItems.push({
        start: dayStart + start,
        end: overnightSleep ? dayStart + 24 * 60 + end : dayStart + end,
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
