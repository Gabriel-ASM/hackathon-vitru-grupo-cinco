import type { StudentRoutine } from "./schemas/routine";

export type RoutineWarningSeverity = "soft" | "blocking";

export type RoutineWarningClassification = {
  code: string;
  severity: RoutineWarningSeverity;
};

function lower(value: string): string {
  return value.toLocaleLowerCase("pt-BR");
}

function allNotes(routine: StudentRoutine): string {
  return [
    ...routine.notes,
    ...[
      routine.work,
      routine.commutes,
      routine.fixed_commitments,
      routine.hobbies,
      routine.exercise,
      routine.availability,
    ]
      .flat()
      .map((entry) => entry.notes ?? ""),
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

function hasFlexibleAcademyAssumption(routine: StudentRoutine): boolean {
  return /atividade flexível/.test(allNotes(routine)) &&
    routine.exercise.some((entry) => /academia|exerc[ií]cio|treino/i.test(entry.description));
}

function hasFamilyAssumption(routine: StudentRoutine): boolean {
  return /jantar\/tempo com a família/.test(allNotes(routine));
}

function hasChurchAssumption(routine: StudentRoutine): boolean {
  return /compromisso de domingo/.test(allNotes(routine));
}

function hasEstimatedCommitment(routine: StudentRoutine): boolean {
  return routine.fixed_commitments.some((entry) =>
    entry.start !== null &&
    entry.end !== null &&
    /suposição operacional: duração padrão de 60 minutos/.test((entry.notes ?? "").toLocaleLowerCase("pt-BR")),
  );
}

export function isOperationallyHandledWarning(
  warning: string,
  routine: StudentRoutine,
): boolean {
  const text = lower(warning);

  if (
    /(dormir|sono)/.test(text) &&
    routine.sleep_time !== null &&
    /(aproximad|faixa|por volta|não foi confirmado|nao foi confirmado)/.test(text)
  ) {
    return true;
  }
  if (
    /(acordar|vigília|vigilia)/.test(text) &&
    routine.wake_time !== null &&
    /(aproximad|faixa|por volta|não foi confirmado|nao foi confirmado)/.test(text)
  ) {
    return true;
  }
  if (/(duração|duracao).*academia|academia.*(duração|duracao)/.test(text) && hasFlexibleAcademyAssumption(routine)) {
    return true;
  }
  if (/(término|termino).*tempo com a família|família.*(término|termino)/.test(text) && hasFamilyAssumption(routine)) {
    return true;
  }
  if (/(início|inicio).*igreja|igreja.*(início|inicio)/.test(text) && hasChurchAssumption(routine)) {
    return true;
  }
  if (
    /((duração|duracao|término|termino|fim).*(reunião|reuniao|compromisso|encontro)|(reunião|reuniao|compromisso|encontro).*(duração|duracao|término|termino|fim))/.test(text) &&
    hasEstimatedCommitment(routine)
  ) {
    return true;
  }
  if (
    /(sábado|sabado|domingo)/.test(text) &&
    /(início|inicio|término|termino|horário|horario)/.test(text) &&
    !routine.work.some((entry) =>
      entry.days.some((day) => day === "saturday" || day === "sunday") &&
      entry.start !== null &&
      entry.end !== null,
    )
  ) {
    return true;
  }
  if (/(expediente|horário do trabalho|horario do trabalho).*(deslocamento|ida|retorno)/.test(text)) {
    return routine.work.some((entry) => entry.start !== null && entry.end !== null);
  }
  if (/(deslocamento|trajeto|transporte|caminho)/.test(text) && routine.commutes.some((entry) => entry.duration_minutes !== null && entry.duration_minutes !== undefined)) {
    return true;
  }
  return false;
}

export function classifyRoutineWarning(
  warning: string,
  routine: StudentRoutine,
): RoutineWarningClassification {
  const text = lower(warning);
  if (isOperationallyHandledWarning(warning, routine)) {
    return { code: "handled_assumption", severity: "soft" };
  }

  if (/(conflito|sobrepos|incompat|contradi|não cabe|nao cabe)/.test(text)) {
    return { code: "schedule_conflict", severity: "blocking" };
  }
  if (/(sábado|sabado|domingo)/.test(text) && /(início|inicio|término|termino|horário|horario)/.test(text)) {
    return { code: "unconfirmed_weekend_detail", severity: "soft" };
  }
  if (/(sono|dormir|acordar|despert)/.test(text) &&
      (routine.sleep_time === null || routine.wake_time === null)) {
    return { code: "sleep_missing", severity: "blocking" };
  }
  if (/(aula|trabalho|estágio|estagio|reunião|reuniao|compromisso obrigatório|compromisso obrigatorio)/.test(text) &&
      /(contrad|ambíg|ambig|não foi informado|nao foi informado|não está claro|nao esta claro)/.test(text)) {
    return { code: "essential_fact_unclear", severity: "blocking" };
  }
  return { code: "operational_detail", severity: "soft" };
}

export function getBlockingRoutineWarnings(
  warnings: string[],
  routine: StudentRoutine,
): string[] {
  return warnings.filter((warning) => classifyRoutineWarning(warning, routine).severity === "blocking");
}
