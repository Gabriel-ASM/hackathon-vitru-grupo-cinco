import type { StudentRoutine } from "./schemas/routine";

/** A segunda rodada é deliberadamente limitada para não transformar onboarding em loop. */
export const ROUTINE_CLARIFICATION_WARNING_THRESHOLD = 3;
export const MAX_ROUTINE_CLARIFICATION_ROUNDS = 1;

export function shouldClarifyRoutine(
  warnings: string[],
  source: "voice" | "reference",
  completedRounds: number,
): boolean {
  return (
    source === "voice" &&
    warnings.length > ROUTINE_CLARIFICATION_WARNING_THRESHOLD &&
    completedRounds < MAX_ROUTINE_CLARIFICATION_ROUNDS
  );
}

export function buildRoutineClarificationContext(
  warnings: string[],
  routine: StudentRoutine,
): string {
  return JSON.stringify(
    {
      purpose:
        "Rodada curta de esclarecimento após a primeira extração. Resolva somente os pontos abaixo antes de montar a agenda.",
      warnings,
      current_routine_draft: routine,
      rules: [
        "Não refaça a entrevista inteira e não pergunte novamente fatos já claros.",
        "Faça uma pergunta principal por turno, priorizando o ponto que mais pode mudar os horários.",
        "Se o aluno confirmar uma suposição razoável, aceite-a e avance.",
        "Quando os pontos estiverem resolvidos, chame complete_onboarding.",
      ],
    },
    null,
    2,
  );
}
