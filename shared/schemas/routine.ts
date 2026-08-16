import { z } from "zod";
import { DAY_KEYS } from "../types";

export const temporaryClassChangeSchema = z.object({
  course_code: z.string().min(1),
  offering_id: z.string().min(1),
  day: z.enum(DAY_KEYS),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  temporary: z.literal(true),
});

const nullableString = z.string().nullable();
const daySchema = z.enum(DAY_KEYS);

export const routineEntrySchema = z.object({
  description: z.string(),
  days: z.array(daySchema),
  start: nullableString,
  end: nullableString,
  notes: nullableString,
  // Metadados opcionais permitem representar compromissos flexíveis sem
  // transformar uma estimativa em um horário inventado.
  duration_minutes: z.number().int().positive().nullable().optional(),
  frequency_per_week: z.number().int().positive().nullable().optional(),
  fixed: z.boolean().nullable().optional(),
});

// Structured Outputs exige que todas as propriedades existam. A versão
// abaixo é usada apenas no contrato da resposta do extrator; a versão
// pública acima continua tolerante para requests legados e para a UI.
const structuredRoutineEntrySchema = routineEntrySchema.extend({
  duration_minutes: z.number().int().positive().nullable(),
  frequency_per_week: z.number().int().positive().nullable(),
  fixed: z.boolean().nullable(),
});

export const studyPreferencesSchema = z.object({
  preferred_periods: z.array(z.string()),
  session_length_minutes: z.number().int().nullable(),
  avoid_periods: z.array(z.string()),
  style: nullableString,
});

export const studentRoutineSchema = z.object({
  wake_time: nullableString,
  sleep_time: nullableString,
  work: z.array(routineEntrySchema),
  commutes: z.array(routineEntrySchema),
  fixed_commitments: z.array(routineEntrySchema),
  hobbies: z.array(routineEntrySchema),
  exercise: z.array(routineEntrySchema),
  study_preferences: studyPreferencesSchema,
  weekend_preferences: z.array(z.string()),
  constraints: z.array(z.string()),
  notes: z.array(z.string()),
  availability: z.array(routineEntrySchema),
  perceived_load: nullableString,
});

// Mantido como utilitário legado para consumidores que ainda importam o schema;
// o fluxo Realtime atual não chama nem expõe patches de rotina.
export const routinePatchSchema = studentRoutineSchema.partial().extend({
  study_preferences: studyPreferencesSchema.partial().optional(),
});

export type RoutineEntry = z.infer<typeof routineEntrySchema>;
export type StudentRoutine = z.infer<typeof studentRoutineSchema>;
export type StudentRoutinePatch = z.infer<typeof routinePatchSchema>;

const academicDecisionsSchema = z.object({
  temporary_class_changes: z.array(temporaryClassChangeSchema),
});

export const routineExtractionResultSchema = z.object({
  routine: studentRoutineSchema,
  summary: z.string().trim().min(1).max(800),
  warnings: z.array(z.string().trim().min(1).max(300)).max(12),
  academic_decisions: academicDecisionsSchema.default({ temporary_class_changes: [] }),
});

export const routineExtractionStructuredResultSchema = routineExtractionResultSchema.extend({
  academic_decisions: academicDecisionsSchema,
  routine: studentRoutineSchema.extend({
    work: z.array(structuredRoutineEntrySchema),
    commutes: z.array(structuredRoutineEntrySchema),
    fixed_commitments: z.array(structuredRoutineEntrySchema),
    hobbies: z.array(structuredRoutineEntrySchema),
    exercise: z.array(structuredRoutineEntrySchema),
    availability: z.array(structuredRoutineEntrySchema),
  }),
});

export type RoutineExtractionResult = z.infer<typeof routineExtractionResultSchema>;
export type AcademicDecisions = z.infer<typeof routineExtractionResultSchema>["academic_decisions"];

export function createEmptyRoutine(): StudentRoutine {
  return {
    wake_time: null,
    sleep_time: null,
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
    notes: [],
    availability: [],
    perceived_load: null,
  };
}

export function mergeRoutinePatch(
  current: StudentRoutine,
  patch: StudentRoutinePatch,
): StudentRoutine {
  const next: StudentRoutine = { ...current };

  if (patch.wake_time !== undefined) next.wake_time = patch.wake_time;
  if (patch.sleep_time !== undefined) next.sleep_time = patch.sleep_time;
  if (patch.work !== undefined) next.work = patch.work;
  if (patch.commutes !== undefined) next.commutes = patch.commutes;
  if (patch.fixed_commitments !== undefined) next.fixed_commitments = patch.fixed_commitments;
  if (patch.hobbies !== undefined) next.hobbies = patch.hobbies;
  if (patch.exercise !== undefined) next.exercise = patch.exercise;
  if (patch.weekend_preferences !== undefined) next.weekend_preferences = patch.weekend_preferences;
  if (patch.constraints !== undefined) next.constraints = patch.constraints;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.availability !== undefined) next.availability = patch.availability;
  if (patch.perceived_load !== undefined) next.perceived_load = patch.perceived_load;
  if (patch.study_preferences !== undefined) {
    next.study_preferences = {
      ...current.study_preferences,
      ...patch.study_preferences,
    };
  }

  return studentRoutineSchema.parse(next);
}
