import type { StudentRoutine } from "./schemas/routine";
import { getBlockingRoutineWarnings, classifyRoutineWarning } from "./routine-warning-policy";

export { getBlockingRoutineWarnings } from "./routine-warning-policy";

/** A segunda rodada é deliberadamente limitada para não transformar onboarding em loop. */
/** Mantido para compatibilidade com consumidores antigos; não decide mais sozinho a rodada. */
export const ROUTINE_CLARIFICATION_WARNING_THRESHOLD = 3;
export const MAX_ROUTINE_CLARIFICATION_ROUNDS = 1;

export function clarificationAddedUserFacts(
  baselineUserCount: number | null,
  currentUserCount: number,
): boolean {
  return baselineUserCount === null || currentUserCount > baselineUserCount;
}

export function shouldClarifyRoutine(
  warnings: string[],
  source: "voice" | "reference",
  completedRounds: number,
  routine?: StudentRoutine,
): boolean {
  const blockingWarnings = routine ? getBlockingRoutineWarnings(warnings, routine) : [];
  return (
    source === "voice" &&
    blockingWarnings.length > 0 &&
    completedRounds < MAX_ROUTINE_CLARIFICATION_ROUNDS
  );
}

export function buildRoutineClarificationContext(
  warnings: string[],
  routine: StudentRoutine,
  userFacts: string[] = [],
): string {
  const blockingWarnings = getBlockingRoutineWarnings(warnings, routine);
  const softWarnings = warnings.filter((warning) => classifyRoutineWarning(warning, routine).severity === "soft");
  const assumptions = [
    ...routine.notes,
    ...[routine.work, routine.commutes, routine.fixed_commitments, routine.hobbies, routine.exercise, routine.availability]
      .flat()
      .map((entry) => entry.notes ?? ""),
  ].filter((note) => /Suposição operacional:/i.test(note));

  return JSON.stringify(
    {
      purpose:
        "Continuação curta após a primeira extração. Resolva somente bloqueios reais antes de montar a agenda; não refaça a entrevista.",
      blocking_warnings: blockingWarnings,
      ignored_soft_warnings: softWarnings,
      applied_assumptions: [...new Set(assumptions)],
      current_routine_draft: routine,
      recent_user_facts: userFacts.slice(-12),
      rules: [
        "Não se apresente novamente, não pergunte como é uma semana normal e não recite o rascunho inteiro.",
        "Faça uma pergunta principal por turno, começando pelo bloqueio de maior impacto.",
        "Não transforme warnings suaves em novas perguntas; use as suposições já aplicadas.",
        "Se o aluno confirmar uma suposição razoável ou disser que pode seguir, aceite e avance.",
        "Quando os pontos estiverem resolvidos, chame complete_onboarding.",
      ],
    },
    null,
    2,
  );
}
