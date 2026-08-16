import {
  routineExtractionResultSchema,
  studentRoutineSchema,
  type RoutineEntry,
  type RoutineExtractionResult,
  type StudentRoutine,
} from "../shared/schemas/routine";
import { isOperationallyHandledWarning } from "../shared/routine-warning-policy";

const NULL_SENTINEL = /^(?:\/dev\/null|null|n\/a|na|none|undefined)$/i;
const CLOCK_TOKEN = /(\d{1,2}):(\d{2})/g;
const DEFAULT_COMMITMENT_DURATION_MINUTES = 60;
const DEFAULT_WORK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return value == null ? null : String(value);
  const trimmed = value.trim();
  return !trimmed || NULL_SENTINEL.test(trimmed) ? null : trimmed;
}

function nullableTime(value: unknown): string | null {
  const text = nullableText(value);
  if (!text) return null;

  const exact = /^\d{1,2}:\d{2}$/.exec(text);
  const range = /^(?:entre\s+)?(\d{1,2}:\d{2})\s*(?:-|–|—|a|às|até|e)\s*(\d{1,2}:\d{2})$/i.exec(text);
  const candidate = exact?.[0] ?? range?.[1];
  if (candidate) {
    const [rawHours, rawMinutes] = candidate.split(":");
    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    return hours <= 23 && minutes <= 59
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
      : null;
  }

  // Alguns modelos devolvem uma observação curta junto do horário (por
  // exemplo, “23:00 (aproximado)”). Aceite uma única hora utilizável, mas
  // nunca escolha entre duas horas sem um marcador claro de faixa.
  const tokens = [...text.matchAll(CLOCK_TOKEN)].map((match) => `${match[1]}:${match[2]}`);
  if (tokens.length === 1) return nullableTime(tokens[0]);
  return null;
}

function formatTime(totalMinutes: number): string | null {
  if (totalMinutes < 0 || totalMinutes >= 24 * 60) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function shiftTime(time: string | null, amountMinutes: number): string | null {
  if (!time) return null;
  return formatTime(Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + amountMinutes);
}

function durationFromNotes(notes: string | null): number | null {
  if (!notes) return null;
  const match = /(\d+)\s*(?:min|mins|minutos)/i.exec(notes);
  const duration = match ? Number(match[1]) : NaN;
  return Number.isInteger(duration) && duration > 0 ? duration : null;
}

function appendNote(notes: string | null, note: string): string {
  return [notes, note].filter((value): value is string => Boolean(value?.trim())).join(" ");
}

function hasAtLeastThreePerWeek(text: string): boolean {
  return /(?:pelo menos|no m[ií]nimo|mínimo)\s+(?:tr[eê]s|3)|(?:tr[eê]s|3)\s*(?:dias|vezes)/i.test(text);
}

function isCommonMeeting(text: string): boolean {
  return /reuni[aã]o|meeting|compromisso|encontro/i.test(text);
}

function timeSpanMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  const span = endMinutes >= startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes;
  return span > 0 ? span : null;
}

function normalizeEntry(
  rawEntry: RoutineEntry,
  category: keyof Pick<StudentRoutine, "work" | "commutes" | "fixed_commitments" | "hobbies" | "exercise" | "availability">,
  context: { workEntry: RoutineEntry | undefined; constraints: string[] },
): RoutineEntry {
  const description = nullableText(rawEntry.description) ?? "Atividade";
  let days = rawEntry.days.filter((day) => typeof day === "string");
  let start = nullableTime(rawEntry.start);
  let end = nullableTime(rawEntry.end);
  let notes = nullableText(rawEntry.notes);
  let durationMinutes = rawEntry.duration_minutes ?? durationFromNotes(notes);
  let frequencyPerWeek = rawEntry.frequency_per_week ?? null;
  let fixed = rawEntry.fixed ?? (category === "work" || category === "commutes" || category === "fixed_commitments");
  const lowerDescription = description.toLocaleLowerCase("pt-BR");
  const lowerNotes = (notes ?? "").toLocaleLowerCase("pt-BR");
  const evidence = `${lowerDescription} ${lowerNotes} ${context.constraints.join(" ").toLocaleLowerCase("pt-BR")}`;

  if (category === "fixed_commitments" && /fam[ií]lia|jantar/.test(evidence) && start && !end) {
    end = shiftTime(start, DEFAULT_COMMITMENT_DURATION_MINUTES);
    durationMinutes = durationMinutes ?? DEFAULT_COMMITMENT_DURATION_MINUTES;
    if (end) {
      notes = appendNote(notes, `Suposição operacional: duração padrão de ${DEFAULT_COMMITMENT_DURATION_MINUTES} minutos para o jantar/tempo com a família.`);
    }
  }

  if (category === "fixed_commitments" && isCommonMeeting(evidence) && start && !end) {
    durationMinutes = durationMinutes ?? DEFAULT_COMMITMENT_DURATION_MINUTES;
    end = shiftTime(start, durationMinutes);
    if (end && durationMinutes === DEFAULT_COMMITMENT_DURATION_MINUTES) {
      notes = appendNote(notes, `Suposição operacional: duração padrão de ${DEFAULT_COMMITMENT_DURATION_MINUTES} minutos para reunião/compromisso.`);
    }
  }

  if (
    /igreja/.test(lowerDescription) &&
    days.includes("sunday") &&
    !start &&
    end === "13:00" &&
    /manh[aã]/i.test(evidence)
  ) {
    start = "08:00";
    fixed = true;
    notes = appendNote(notes, "Suposição operacional: compromisso de domingo de manhã considerado das 08:00 às 13:00.");
  }

  if (category === "work" && start && end && days.length === 0) {
    days = [...DEFAULT_WORK_DAYS];
    notes = appendNote(notes, "Suposição operacional: trabalho recorrente sem dias explícitos considerado de segunda a sexta.");
  }

  if (category === "exercise" && /academia|exerc[ií]cio|treino/.test(lowerDescription)) {
    if (!frequencyPerWeek && hasAtLeastThreePerWeek(evidence)) frequencyPerWeek = 3;
    if (!durationMinutes && frequencyPerWeek) durationMinutes = 60;
    if (frequencyPerWeek && durationMinutes && !start && !end) {
      fixed = false;
      notes = appendNote(notes, `Suposição operacional: atividade flexível de ${durationMinutes} minutos, ${frequencyPerWeek} vezes por semana.`);
    }
  }

  const commuteDuration = durationMinutes ?? durationFromNotes(notes);
  if (category === "commutes" && commuteDuration && context.workEntry) {
    const workStart = nullableTime(context.workEntry.start);
    const workEnd = nullableTime(context.workEntry.end);
    if (!start && /casa.*trabalho|casa.*emprego|casa.*est[aá]gio/.test(lowerDescription) && workStart) {
      start = shiftTime(workStart, -commuteDuration);
      end = workStart;
      days = days.length > 0 ? days : [...context.workEntry.days];
    } else if (!start && /trabalho.*casa|emprego.*casa|est[aá]gio.*casa/.test(lowerDescription) && workEnd) {
      start = workEnd;
      end = shiftTime(workEnd, commuteDuration);
      days = days.length > 0 ? days : [...context.workEntry.days];
    }
  }

  // Um deslocamento sem horário confirmado continua sendo uma restrição
  // flexível; o planejador deve encaixá-lo junto da atividade relacionada.
  if (category === "commutes" && (!start || !end)) fixed = false;

  return {
    description,
    days,
    start,
    end,
    notes,
    ...(durationMinutes ? { duration_minutes: durationMinutes } : { duration_minutes: null }),
    ...(frequencyPerWeek ? { frequency_per_week: frequencyPerWeek } : { frequency_per_week: null }),
    fixed,
  };
}

export function normalizeStudentRoutine(rawRoutine: StudentRoutine): StudentRoutine {
  const workEntry = rawRoutine.work.find((entry) => nullableTime(entry.start) && nullableTime(entry.end));
  const context = { workEntry, constraints: rawRoutine.constraints };
  const categories = ["work", "commutes", "fixed_commitments", "hobbies", "exercise", "availability"] as const;

  const normalized = {
    ...rawRoutine,
    wake_time: nullableTime(rawRoutine.wake_time),
    sleep_time: nullableTime(rawRoutine.sleep_time),
    study_preferences: {
      ...rawRoutine.study_preferences,
      preferred_periods: rawRoutine.study_preferences.preferred_periods.map(nullableText).filter((value): value is string => Boolean(value)),
      avoid_periods: rawRoutine.study_preferences.avoid_periods.map(nullableText).filter((value): value is string => Boolean(value)),
      style: nullableText(rawRoutine.study_preferences.style),
    },
    weekend_preferences: rawRoutine.weekend_preferences.map(nullableText).filter((value): value is string => Boolean(value)),
    constraints: rawRoutine.constraints.map(nullableText).filter((value): value is string => Boolean(value)),
    notes: rawRoutine.notes.map(nullableText).filter((value): value is string => Boolean(value)),
    perceived_load: nullableText(rawRoutine.perceived_load),
  } as StudentRoutine;

  for (const category of categories) {
    normalized[category] = rawRoutine[category].map((entry) => normalizeEntry(entry, category, context));
  }

  const hasCompleteWork = normalized.work.some((entry) => entry.start !== null && entry.end !== null);
  if (!hasCompleteWork) {
    const longWorkRouteIndex = normalized.commutes.findIndex((entry) => {
      const route = entry.description.toLocaleLowerCase("pt-BR");
      return /trabalho|emprego|est[aá]gio/.test(route) &&
        entry.duration_minutes == null &&
        (timeSpanMinutes(entry.start, entry.end) ?? 0) >= 4 * 60;
    });
    const longWorkRoute = longWorkRouteIndex >= 0 ? normalized.commutes[longWorkRouteIndex] : undefined;
    if (longWorkRoute?.start && longWorkRoute.end) {
      const incompleteWork = normalized.work.filter((entry) =>
        entry.start === null &&
        entry.end === null &&
        /trabalho|emprego|est[aá]gio/i.test(entry.description),
      );
      normalized.work = [
        ...normalized.work.filter((entry) => !incompleteWork.includes(entry)),
        {
          description: "Trabalho",
          days: longWorkRoute.days.length > 0 ? [...longWorkRoute.days] : [...DEFAULT_WORK_DAYS],
          start: longWorkRoute.start,
          end: longWorkRoute.end,
          notes: appendNote(longWorkRoute.notes, "Suposição operacional: horários longos associados ao trajeto foram interpretados como expediente, não como deslocamento."),
          duration_minutes: null,
          frequency_per_week: null,
          fixed: true,
        },
      ];
      normalized.commutes = normalized.commutes.filter((_, index) => index !== longWorkRouteIndex);
    }
  }

  const assumptions = categories
    .flatMap((category) => normalized[category])
    .map((entry) => entry.notes)
    .filter((notes): notes is string => Boolean(notes?.includes("Suposição operacional:")));
  normalized.notes = [...new Set([...normalized.notes, ...assumptions])];

  return studentRoutineSchema.parse(normalized);
}

export function normalizeRoutineExtractionResult(raw: RoutineExtractionResult): RoutineExtractionResult {
  const parsed = routineExtractionResultSchema.parse(raw);
  const routine = normalizeStudentRoutine(parsed.routine);
  const warnings = [...parsed.warnings];
  if (routine.sleep_time === null || routine.wake_time === null) {
    warnings.push(
      routine.sleep_time === null && routine.wake_time === null
        ? "Os horários de dormir e acordar ainda não foram confirmados."
        : routine.sleep_time === null
          ? "O horário de dormir ainda não foi confirmado."
          : "O horário de acordar ainda não foi confirmado.",
    );
  }

  return {
    routine,
    summary: parsed.summary,
    academic_decisions: parsed.academic_decisions,
    warnings: [...new Set(warnings.filter((warning) => !isOperationallyHandledWarning(warning, routine)))],
  };
}
