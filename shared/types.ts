export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayOfWeek = (typeof DAY_KEYS)[number];

export const EVENT_TYPES = [
  "class",
  "asynchronous_class",
  "academic_activity",
  "study",
  "work",
  "commute",
  "exercise",
  "hobby",
  "personal",
  "sleep",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type AcademicClass = {
  id?: string;
  course_code?: string;
  offering_id?: string;
  name: string;
  day: DayOfWeek;
  start: string;
  end: string;
  type: string;
};

export type AcademicOffering = {
  id: string;
  course_code: string;
  name: string;
  day: DayOfWeek;
  start: string;
  end: string;
  type: string;
  modality: string;
  explicit_schedule: boolean;
  is_current: boolean;
  temporary: boolean;
};

export type TemporaryClassChange = {
  course_code: string;
  offering_id: string;
  day: DayOfWeek;
  start: string;
  end: string;
  temporary: true;
};

export type StudentSchedule = {
  student: {
    name: string;
  };
  classes: AcademicClass[];
  /** Mantido por compatibilidade com o contrato anterior. */
  asynchronous_hours_week: number;
  /** Horas de atividades autônomas da disciplina selecionada, sem horário de aula fixo. */
  academic_activity_hours_week?: number;
  available_offerings?: AcademicOffering[];
  temporary_class_changes?: TemporaryClassChange[];
};

export type ScheduleItem = {
  id: string;
  type: EventType;
  title: string;
  start: string;
  end: string;
  fixed: boolean;
  source: "academic_schedule" | "student_routine" | "ai_planning";
};

export type WeeklySchedule = {
  week_start: string;
  week_end: string;
  days: Array<{
    date: string;
    day_of_week: DayOfWeek;
    items: ScheduleItem[];
  }>;
  summary: {
    class_hours: number;
    asynchronous_class_hours: number;
    academic_activity_hours: number;
    recommended_extra_study_hours: number;
    planned_extra_study_hours: number;
    planned_free_hours: number;
  };
  warnings: string[];
};
