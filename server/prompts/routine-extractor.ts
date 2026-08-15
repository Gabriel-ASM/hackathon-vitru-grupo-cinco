import { MOCK_ASYNCHRONOUS_SUBJECTS } from "../../shared/mockSchedule";
import type { StudentSchedule } from "../../shared/types";
import type { TranscriptEntry } from "../../shared/voice-transcript";

export const routineExtractorPrompt = `Você organiza a rotina de um aluno para um planejador semanal.

Use como evidência somente os itens de user_facts. A conversation_context contém falas da IA e existe apenas para interpretar respostas curtas como “sim”; ela nunca é evidência e não pode criar um fato. A fala mais recente do aluno corrige uma fala anterior quando houver conflito.

Regras:
- Não invente horários, duração, frequência, deslocamentos ou preferências. Faça apenas as inferências operacionais explicitamente permitidas abaixo.
- Se algo estiver ambíguo e puder mudar o planejamento, deixe o campo como null ou vazio e registre uma advertência curta.
- Não transforme uma pergunta da IA em um fato do aluno.
- Preserve o sentido e o nível de certeza da fala original; não faça suposições como “uma hora de deslocamento” significar ida e volta.
- Use horários no formato HH:MM apenas quando o aluno tiver informado um horário claro.
- Coloque compromissos recorrentes em days. Para trabalho, emprego ou estágio com horário recorrente informado mas sem dias explícitos, assuma monday, tuesday, wednesday, thursday e friday. Registre essa inferência em routine.notes como uma suposição operacional curta, sem gerar warning só por isso.
- Se o aluno mencionar explicitamente escala 6x1, plantão, folgas, sábado, domingo ou dias específicos, respeite esses dias; nunca substitua uma escala explicitamente dita por segunda a sexta.
- Um deslocamento claramente ligado ao trabalho pode acompanhar os mesmos dias assumidos para o trabalho. Não aplique essa inferência a academia, família, igreja, hobbies ou outros compromissos pessoais.
- “Não tenho”, “não faço” e equivalentes devem permanecer como ausência, não como uma atividade inventada.
- Se uma atividade entre 00:00 e o horário de dormir estiver imprecisa e não alterar a disponibilidade acadêmica, não gere warning por ela. Preserve-a como tempo pessoal genérico quando houver horário e recorrência suficientes; caso contrário, omita-a e deixe o planejador preservar esse período como atividade pessoal. Se o aluno disser claramente que é academia ou outro compromisso, preserve a categoria informada.
- As aulas fixas de academic_schedule já são fatos estruturados, não fatos da rotina: não as copie para trabalho, compromissos, hobbies ou preferências do aluno.
- Uma disciplina sem horário explícito é carga assíncrona, não compromisso fixo; não transforme seu agrupamento de sexta-feira em disponibilidade ou obrigação pessoal.
- O resumo deve ser curto, em português brasileiro, e mencionar apenas fatos confirmados.
- Warnings devem apontar somente ambiguidades que podem afetar o planejamento, sem pedir novas perguntas ao aluno. Não use warning para detalhes noturnos irrelevantes ou para a inferência padrão de trabalho em dias úteis.

A grade acadêmica abaixo já está estruturada. Não a copie para a rotina e não altere seus horários; use-a apenas para evitar duplicidade e entender o contexto.

Retorne exatamente o objeto estruturado solicitado pelo schema.`;

export function buildRoutineExtractionInput(
  schedule: StudentSchedule,
  transcript: TranscriptEntry[],
): string {
  const userFacts = transcript
    .filter((entry) => entry.role === "user")
    .map(({ text }) => text);

  const asynchronousSubjects =
    schedule.student.name === "Gabriel" &&
    schedule.classes.length === 0 &&
    schedule.asynchronous_hours_week === 10
      ? MOCK_ASYNCHRONOUS_SUBJECTS
      : [];

  return JSON.stringify(
    {
      academic_schedule: schedule,
      asynchronous_subjects: asynchronousSubjects.map(({ code, name, hours_week }) => ({
        code,
        name,
        hours_week,
      })),
      planning_defaults: {
        recurring_work_days_when_omitted: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        apply_workday_default_only_to: ["work", "employment", "internship"],
        six_by_one_requires_explicit_mention: true,
        ambiguous_midnight_activity: "preserve_as_personal_or_omit_without_warning",
      },
      user_facts: userFacts,
      conversation_context: transcript.map(({ role, text }) => ({ role, text })),
    },
    null,
    2,
  );
}
