import type { ScheduleItem } from "./types";

export type CalendarViewMode = "complete" | "academic";

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
      (includeStudy && item.type === "study"),
  );
}
