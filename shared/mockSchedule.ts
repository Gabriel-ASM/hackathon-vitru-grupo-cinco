import type { StudentSchedule } from "./types";

// Fonte: Aulas.json, módulo/semestre 1 (2023/1). A sexta-feira/noturno é só
// o agrupamento de oferta; como não há horário explícito, essas disciplinas
// não devem ser convertidas em aulas fixas.
export const MOCK_ASYNCHRONOUS_SUBJECTS = [
  {
    code: "198471",
    name: "Perspectivas Profissionais",
    begin_date: "17/02/2023",
    end_date: "24/03/2023",
    hours_week: 2,
  },
  {
    code: "INF14",
    name: "Arquitetura de Computadores",
    begin_date: "31/03/2023",
    end_date: "05/05/2023",
    hours_week: 2,
  },
  {
    code: "ADS05",
    name: "Lógica e Técnicas de Programação",
    begin_date: "12/05/2023",
    end_date: "26/05/2023",
    hours_week: 2,
  },
  {
    code: "GTI08",
    name: "Segurança em Tecnologia da Informação",
    begin_date: "02/06/2023",
    end_date: "16/06/2023",
    hours_week: 2,
  },
  {
    code: "159470",
    name: "Experiência Profissional: Carreira e Sucesso",
    begin_date: "23/06/2023",
    end_date: "14/07/2023",
    hours_week: 2,
  },
] as const;

export const MOCK_SCHEDULE: StudentSchedule = {
  student: {
    name: "Gabriel",
  },
  // Suposição de teste: 2h semanais por matéria, totalizando 10h assíncronas.
  classes: [],
  asynchronous_hours_week: 10,
};
