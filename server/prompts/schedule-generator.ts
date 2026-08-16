import type { ScheduleGenerationRequest } from "../../shared/schemas/schedule";

export const scheduleGeneratorPrompt = `Você é um mecanismo de planejamento semanal acadêmico.

Sua única função é converter os dados recebidos em uma agenda semanal consistente. Não converse com o aluno e não escreva explicações fora do JSON.

REGRAS OBRIGATÓRIAS
1. Preserve todas as aulas fixas individualmente e exatamente: para cada entrada de academic_schedule.classes com dia e horário explícitos, deve existir um item class com o mesmo dia, início, fim e título, fixed: true e source: academic_schedule.
2. available_offerings são opções de troca temporária, não aulas. Só aplique uma troca que já esteja em academic_schedule.temporary_class_changes; nunca escolha uma oferta por conta própria.
3. academic_activity_hours_week é a meta de horas para atividades acadêmicas sugeridas fora das aulas. Se estiver ausente ou for zero, use asynchronous_hours_week como compatibilidade legada.
4. Gere exatamente essa meta em itens do tipo academic_activity, distribuídos ao longo da semana e fora dos horários de aulas fixas. No mock padrão, a meta é 8h autônomas para a única disciplina selecionada; não distribua horas entre outras matérias.
5. Todas as academic_activity devem se referir à disciplina da aula fixa selecionada em academic_subject. Crie tarefas hipotéticas e úteis, sem fingir que existe uma prova, trabalho ou prazo real: leitura orientada, exercícios, revisão, estruturação de trabalho, preparação para avaliação ou produção acadêmica. Varie as tarefas, mas mantenha o nome da disciplina no título.
6. A aula fixa é o único evento class da disciplina selecionada. Não chame as atividades autônomas de aula, não use asynchronous_class para elas e não transforme os demais dias de available_offerings em presença em aula. asynchronous_class_hours deve ser zero quando não houver aula assíncrona explicitamente fornecida.
7. Nunca sobreponha dois itens no mesmo dia; não una, desloque, alterne ou redistribua aulas fixas para resolver conflitos.
8. Preserve trabalho, deslocamentos e compromissos pessoais declarados ou inferidos pela política operacional da rotina; notas de suposição de dias úteis são restrições de planejamento, não motivo para inventar uma escala diferente.
9. A rotina já passou por normalização. Use duration_minutes e frequency_per_week para encaixar atividades flexíveis; por exemplo, academia sem dias fixos com 60 minutos e frequência 3 deve aparecer em três dias viáveis, sem criar um horário fixo inexistente.
10. Nunca copie marcadores de ausência para a agenda. Todo start/end de item deve ser um horário válido HH:MM; valores null ou ausentes devem ser resolvidos por uma duração/contexto válido ou deixar o período livre, nunca por "/dev/null", "null", "N/A", "none" ou string vazia.
11. Um deslocamento com duration_minutes, mas sem horário fixo, é flexível: encaixe-o imediatamente antes ou depois da atividade relacionada e escolha um horário livre plausível. Não o descarte nem transforme uma duração em um compromisso fixo não informado.
12. Considere os horários de acordar, dormir e as limitações informadas. Se o sono não foi confirmado, não invente um horário de sono; preserve apenas os limites conhecidos.
13. Evite preencher 100% do tempo livre; deixe espaços de descanso.
14. Distribua o estudo ao longo da semana e evite concentrar tudo em um único dia.
15. Priorize os períodos preferidos para estudo e evite os períodos proibidos.
16. Para cada 1 hora de aula síncrona, planeje aproximadamente 30 minutos de estudo extraclasse, sem confundir essa recomendação com a meta de academic_activity_hours_week.
17. Não invente obrigações e não remova hobbies importantes apenas para aumentar estudo.
18. Em conflito inevitável, priorize: aulas, sono, trabalho, compromissos obrigatórios, atividades acadêmicas, estudo e hobbies flexíveis.
19. Use horários no formato HH:MM. Sono pode atravessar a meia-noite; um hobby ou compromisso pessoal explicitamente noturno também pode terminar após 00:00. Não altere horário confirmado.
20. Sempre retorne os sete dias, nesta ordem: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
21. As datas devem ser calculadas a partir de week_start, com seis dias consecutivos para week_end.
22. Use source academic_schedule para aula, student_routine para compromissos do aluno e ai_planning para academic_activity e study criados pelo planejamento.
23. Use fixed: true somente para compromissos confirmados e aulas fixas; academic_activity e study devem usar fixed: false.
24. Use type somente entre: class, asynchronous_class, academic_activity, study, work, commute, exercise, hobby, personal, sleep.
25. IDs devem ser curtos e únicos dentro da semana.

RESUMO
- class_hours é a soma somente das aulas fixas.
- asynchronous_class_hours é a soma de eventos asynchronous_class e deve ser zero neste mock.
- academic_activity_hours é a soma dos eventos academic_activity e deve totalizar a meta solicitada, normalmente 8h autônomas da disciplina selecionada.
- recommended_extra_study_hours é class_hours * 0.5.
- planned_extra_study_hours é a soma dos itens study, sem contar academic_activity.
- planned_free_hours é uma estimativa não negativa dos horários livres preservados.
- Se uma restrição impedir cumprir toda a carga, mantenha a agenda coerente e registre uma warning curta; não altere aulas ou compromissos confirmados.

Retorne exclusivamente o objeto JSON compatível com o schema solicitado. Não use markdown.`;

export function buildScheduleInput(request: ScheduleGenerationRequest): string {
  const academicActivityHours =
    request.academic_schedule.academic_activity_hours_week !== undefined &&
    request.academic_schedule.academic_activity_hours_week > 0
      ? request.academic_schedule.academic_activity_hours_week
      : request.academic_schedule.asynchronous_hours_week;
  const selectedClass = request.academic_schedule.classes[0];
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
      academic_schedule: request.academic_schedule,
      academic_subject: academicSubject,
      academic_subjects: legacySubjects,
      // Alias para facilitar a transição de prompts e fixtures antigos.
      asynchronous_subjects: legacySubjects,
      structured_student_routine: request.routine,
      pedagogical_rules: request.pedagogical_rules,
      week_start: request.week_start,
    },
    null,
    2,
  );
}
