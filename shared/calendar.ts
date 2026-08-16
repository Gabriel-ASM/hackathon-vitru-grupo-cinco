import type { DayOfWeek, ScheduleItem, WeeklySchedule } from "./types";

export type CalendarViewMode = "complete" | "academic";

export const ACADEMIC_CALENDAR_STORAGE_KEY = "sofiaAcademicCalendar.v2";
export const LEGACY_ACADEMIC_CALENDAR_STORAGE_KEY = "sofiaAcademicCalendar.v1";

export type AcademicCalendarItem = {
  id: string;
  date: string;
  day_of_week: DayOfWeek;
  title: string;
  type: "class" | "asynchronous_class" | "academic_activity";
  start: string;
  end: string;
  fixed: boolean;
  source: ScheduleItem["source"];
};

export type AcademicCalendarImport = {
  version: 2;
  source: "sofia";
  updated_at: string;
  week_start: string;
  week_end: string;
  items: AcademicCalendarItem[];
};

function isAcademicCalendarItem(
  item: ScheduleItem,
): item is ScheduleItem & {
  type: "class" | "asynchronous_class" | "academic_activity";
} {
  return (
    item.type === "class" ||
    item.type === "asynchronous_class" ||
    item.type === "academic_activity"
  );
}

/**
 * Reduz a agenda semanal validada ao contrato consumido pelo Calendário AVA.
 * Blocos de estudo e itens da rotina pessoal continuam pertencendo à agenda
 * da Sofia, mas não são convertidos em compromissos acadêmicos.
 */
export function buildAcademicCalendarImport(
  schedule: WeeklySchedule,
  updatedAt = new Date().toISOString(),
): AcademicCalendarImport {
  const items = schedule.days.flatMap((day) =>
    day.items
      .filter(isAcademicCalendarItem)
      .map((item) => ({
        id: item.id,
        date: day.date,
        day_of_week: day.day_of_week,
        title: item.title,
        type: item.type,
        start: item.start,
        end: item.end,
        fixed: item.fixed,
        source: item.source,
      })),
  );

  return {
    version: 2,
    source: "sofia",
    updated_at: updatedAt,
    week_start: schedule.week_start,
    week_end: schedule.week_end,
    items,
  };
}

/**
 * Produz uma projeção visual do mesmo planejamento. O modo acadêmico não
 * recalcula a agenda: apenas oculta compromissos pessoais e, por padrão,
 * blocos de estudo que não são aulas.
 */
export function filterScheduleItems(
  items: ScheduleItem[],
  mode: CalendarViewMode,
  includeStudy = false,
): ScheduleItem[] {
  if (mode === "complete") return items;

  return items.filter(
    (item) =>
      item.type === "class" ||
      item.type === "asynchronous_class" ||
      item.type === "academic_activity" ||
      (includeStudy && item.type === "study"),
  );
}
