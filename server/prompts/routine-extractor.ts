import type { StudentSchedule } from "../../shared/types";
import type { TranscriptEntry } from "../../shared/voice-transcript";

export const routineExtractorPrompt = `Você organiza a rotina de um aluno para um planejador semanal.

Use como evidência somente os itens de user_facts. A conversation_context contém falas da IA e existe apenas para interpretar respostas curtas como “sim”; ela nunca é evidência e não pode criar um fato. A fala mais recente do aluno corrige uma fala anterior quando houver conflito.

Regras:
- Não invente horários, duração, frequência, deslocamentos ou preferências. Faça apenas as inferências operacionais explicitamente permitidas abaixo.
- O JSON é uma interface de dados, não um rascunho: para qualquer horário desconhecido use o literal JSON null. Nunca escreva "/dev/null", "null", "N/A", "none", string vazia ou outro marcador no lugar de null.
- Se algo estiver ambíguo e puder mudar o planejamento, deixe o campo como null ou vazio e registre uma advertência curta.
- Não transforme uma pergunta da IA em um fato do aluno.
- Preserve o sentido e o nível de certeza da fala original; não faça suposições como “uma hora de deslocamento” significar ida e volta.
- Dê precedência ao significado do compromisso: “vou para o trabalho às oito e volto às cinco” descreve o expediente das 08:00 às 17:00, não um deslocamento de nove horas. Só crie commute quando o aluno falar de trajeto, caminho, ida/volta ou duração de transporte.
- Se o aluno disser “depois do trabalho”, “quando consigo” ou “horário flexível” para academia, isso já confirma uma atividade flexível; não exija dias exatos nem duração para poder planejar.
- Para uma reunião ou compromisso comum com início explícito e término ausente, use 60 minutos como estimativa operacional, registre a suposição em notes e não gere warning, salvo se a duração puder mudar um conflito obrigatório.
- Não crie trabalho, estudo ou compromisso em sábado/domingo a partir de uma pergunta, ruído ou trecho incompleto. Só inclua um dia de fim de semana quando o aluno o afirmar como parte da rotina.
- Use horários no formato HH:MM quando o aluno tiver informado um horário claro ou uma aproximação suficientemente útil para planejar. Uma faixa falada com clareza também é informação válida: em “durmo entre onze e onze e meia”, use sleep_time "23:00" como referência conservadora e registre a faixa aproximada em notes; não peça que o aluno repita nem gere warning só porque não há um minuto exato.
- Trate horário de dormir e horário de acordar como fatos independentes. “Acordo às seis” não preenche sleep_time; “durmo à meia-noite” não preenche wake_time. Frases ambíguas, como “meia-noite eu acordo”, não autorizam escolher nenhum dos dois campos.
- Para faixas de sono ou vigília que estejam compreensíveis, escolha um único HH:MM representativo no campo estruturado e preserve os limites no texto de notes. Só deixe o campo null quando nenhum horário utilizável tiver sido entendido.
- Coloque compromissos recorrentes em days. Para trabalho, emprego ou estágio com horário recorrente informado mas sem dias explícitos, assuma monday, tuesday, wednesday, thursday e friday. Registre essa inferência em routine.notes como uma suposição operacional curta, sem gerar warning só por isso.
- Se o aluno mencionar explicitamente escala 6x1, plantão, folgas, sábado, domingo ou dias específicos, respeite esses dias; nunca substitua uma escala explicitamente dita por segunda a sexta.
- Um deslocamento claramente ligado ao trabalho pode acompanhar os mesmos dias assumidos para o trabalho. Não aplique essa inferência a academia, família, igreja, hobbies ou outros compromissos pessoais.
- “Não tenho”, “não faço” e equivalentes devem permanecer como ausência, não como uma atividade inventada.
- Se uma atividade entre 00:00 e o horário de dormir estiver imprecisa e não alterar a disponibilidade acadêmica, não gere warning por ela. Preserve-a como tempo pessoal genérico quando houver horário e recorrência suficientes; caso contrário, omita-a e deixe o planejador preservar esse período como atividade pessoal. Se o aluno disser claramente que é academia ou outro compromisso, preserve a categoria informada.
- As aulas fixas de academic_schedule já são fatos estruturados, não fatos da rotina: não as copie para trabalho, compromissos, hobbies ou preferências do aluno.
- Cada item de academic_schedule.classes é a aula atual da matrícula e deve permanecer exatamente nesse horário. available_offerings são alternativas, não aulas atuais.
- Se o aluno confirmar explicitamente uma troca temporária de turma, registre-a em academic_decisions.temporary_class_changes com course_code, offering_id, day, start, end e temporary=true. Sem confirmação explícita, retorne uma lista vazia.
- A semana de planejamento usa uma única disciplina selecionada em academic_subject: a aula fixa é o encontro real e toda leitura, exercício, revisão ou produção autônoma deve se referir a ela. Uma oferta em outro dia é apenas alternativa temporária, não uma segunda disciplina nem presença em aula.
- O resumo deve ser curto, em português brasileiro, e mencionar apenas fatos confirmados.
- Warnings devem apontar somente bloqueios que podem mudar uma decisão essencial do planejamento, sem pedir novas perguntas ao aluno por detalhes aproximáveis. Inclua warning para sono ausente, conflito real, contradição ou compromisso obrigatório impossível de posicionar; não use warning para uma faixa de sono compreensível, duração padrão de academia/reunião, detalhe de fim de semana não confirmado ou a inferência padrão de trabalho em dias úteis.
- Para compromissos comuns cuja categoria e contexto estejam claros, aplique somente estes defaults operacionais conservadores: jantar/tempo com a família sem fim informado pode durar 60 minutos; igreja no domingo descrita como "de manhã" e terminando às 13:00 pode começar às 08:00; academia flexível descrita como "pelo menos três vezes por semana" pode ter duration_minutes 60 e frequency_per_week 3. Registre cada default em routine.notes e não o trate como fato confirmado pelo aluno.
- Para academia, esporte e hobbies sem dia ou horário fixos, mantenha days vazio, start/end null e use duration_minutes/frequency_per_week quando a frequência ou a duração tiver sido informada ou for um dos defaults acima. Isso significa flexibilidade, não erro de extração.

A grade acadêmica abaixo já está estruturada. Não a copie para a rotina e não altere seus horários; use-a apenas para evitar duplicidade e entender o contexto.

Retorne exatamente o objeto estruturado solicitado pelo schema, incluindo academic_decisions.temporary_class_changes.`;

export function buildRoutineExtractionInput(
  schedule: StudentSchedule,
  transcript: TranscriptEntry[],
): string {
  const userFacts = transcript
    .filter((entry) => entry.role === "user")
    .map(({ text }) => text);

  const academicActivityHours =
    schedule.academic_activity_hours_week !== undefined && schedule.academic_activity_hours_week > 0
      ? schedule.academic_activity_hours_week
      : schedule.asynchronous_hours_week;
  const selectedClass = schedule.classes[0];
  const academicSubject = selectedClass && academicActivityHours > 0
    ? {
        code: selectedClass.course_code ?? selectedClass.id ?? "selected-class",
        name: selectedClass.name,
        class_hours_week: 2,
        autonomous_hours_week: academicActivityHours,
      }
    : null;

  const legacySubjects = academicSubject
    ? [{
        code: academicSubject.code,
        name: academicSubject.name,
        hours_week: academicSubject.autonomous_hours_week,
      }]
    : [];

  return JSON.stringify(
    {
      academic_schedule: schedule,
      academic_subject: academicSubject,
      academic_subjects: legacySubjects,
      available_offerings: schedule.available_offerings ?? [],
      planning_defaults: {
        recurring_work_days_when_omitted: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        apply_workday_default_only_to: ["work", "employment", "internship"],
        six_by_one_requires_explicit_mention: true,
        ambiguous_midnight_activity: "preserve_as_personal_or_omit_without_warning",
        sleep_and_wake_are_independent: true,
      },
      user_facts: userFacts,
      conversation_context: transcript.map(({ role, text }) => ({ role, text })),
    },
    null,
    2,
  );
}
