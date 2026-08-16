import aulas from "../Aulas.json";
import type { AcademicClass, AcademicOffering, DayOfWeek, StudentSchedule } from "./types";

type AulaRecord = {
  code?: unknown;
  description?: unknown;
  semester?: unknown;
  class?: unknown;
  desc_week_day?: unknown;
  agroupment_period?: unknown;
  has_schedule?: unknown;
  meet_type?: unknown;
};

const aulaRecords = aulas as AulaRecord[];

const dayByNumber: Record<string, DayOfWeek> = {
  "1": "sunday",
  "2": "monday",
  "3": "tuesday",
  "4": "wednesday",
  "5": "thursday",
  "6": "friday",
  "7": "saturday",
};

function parseDay(value: unknown): DayOfWeek | null {
  if (typeof value !== "string") return null;
  const number = /^\s*([1-7])\s*-/.exec(value)?.[1];
  return number ? dayByNumber[number] ?? null : null;
}

function parseTime(value: string): string | null {
  const match = /^(\d{1,2})h(?:(\d{2}))?$/.exec(value.trim().toLocaleLowerCase("pt-BR"));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "00");
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parsePeriod(value: unknown): { start: string; end: string } | null {
  if (typeof value !== "string") return null;
  const parts = value.split(/\s+as\s+/i);
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0] ?? "");
  const end = parseTime(parts[1] ?? "");
  return start && end ? { start, end } : null;
}

const currentAula = aulaRecords.find((record) => {
  const hasExplicitSchedule = ["P", "TRUE", "1"].includes(String(record.has_schedule ?? "").toUpperCase());
  return hasExplicitSchedule && parseDay(record.desc_week_day) && parsePeriod(record.agroupment_period);
});

const fallbackAula: AulaRecord = {
  code: "135481",
  description: "Qualidade e Testes de Software",
  class: "FLD6859329",
  desc_week_day: "4 - Quarta",
  agroupment_period: "19h as 20h30",
  has_schedule: "P",
  meet_type: "Virtual",
};

const selectedAula = currentAula ?? fallbackAula;
const selectedDay = parseDay(selectedAula.desc_week_day) ?? "wednesday";
const selectedPeriod = parsePeriod(selectedAula.agroupment_period) ?? { start: "19:00", end: "20:30" };
const selectedCourseCode = String(selectedAula.code ?? "135481");
const selectedName = String(selectedAula.description ?? "Qualidade e Testes de Software");
const selectedOfferingId = String(selectedAula.class ?? `${selectedCourseCode}-current`);
const selectedType = String(selectedAula.meet_type ?? "Virtual");

export const MOCK_CURRENT_CLASS: AcademicClass = {
  id: selectedOfferingId,
  offering_id: selectedOfferingId,
  course_code: selectedCourseCode,
  name: selectedName,
  day: selectedDay,
  start: selectedPeriod.start,
  end: selectedPeriod.end,
  type: selectedType,
};

const weekdays: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

// Aulas.json registra a turma atual e o horário-base. O produto informa que
// essa disciplina possui ofertas diárias; as opções abaixo são alternativas
// temporárias e nunca entram na agenda sem confirmação do aluno.
export const MOCK_AVAILABLE_OFFERINGS: AcademicOffering[] = weekdays.map((day) => ({
  id: day === selectedDay ? selectedOfferingId : `${selectedOfferingId}-temporary-${day}`,
  course_code: selectedCourseCode,
  name: selectedName,
  day,
  start: selectedPeriod.start,
  end: selectedPeriod.end,
  type: selectedType,
  modality: selectedType,
  explicit_schedule: true,
  is_current: day === selectedDay,
  temporary: day !== selectedDay,
}));

/**
 * A semana de demonstração trabalha com uma única disciplina selecionada.
 * A aula continua vindo exatamente de Aulas.json; os oito blocos abaixo são
 * trabalho autônomo hipotético sobre essa mesma disciplina, nunca aulas de
 * outras matérias do catálogo.
 */
export const MOCK_ACADEMIC_SUBJECT = {
  code: selectedCourseCode,
  name: selectedName,
  class_hours_week: 2,
  autonomous_hours_week: 8,
};

// Formato legado para consumidores antigos. A lista agora contém somente a
// disciplina selecionada, e hours_week representa horas autônomas.
export const MOCK_ACADEMIC_SUBJECTS = [{
  code: MOCK_ACADEMIC_SUBJECT.code,
  name: MOCK_ACADEMIC_SUBJECT.name,
  hours_week: MOCK_ACADEMIC_SUBJECT.autonomous_hours_week,
}];

export const MOCK_ASYNCHRONOUS_SUBJECTS = MOCK_ACADEMIC_SUBJECTS;

export const MOCK_SCHEDULE: StudentSchedule = {
  student: {
    name: "Gabriel",
  },
  classes: [MOCK_CURRENT_CLASS],
  // A carga autônoma é separada da aula: uma aula semanal e oito horas de
  // leitura, exercícios, revisão ou produção relacionadas à mesma disciplina.
  asynchronous_hours_week: 8,
  academic_activity_hours_week: 8,
  available_offerings: MOCK_AVAILABLE_OFFERINGS,
  temporary_class_changes: [],
};
