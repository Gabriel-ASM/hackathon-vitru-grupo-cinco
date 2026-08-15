import { useState } from "react";
import { filterScheduleItems, type CalendarViewMode } from "../../../shared/calendar";
import type { WeeklySchedule } from "../../../shared/types";

const dayLabels: Record<WeeklySchedule["days"][number]["day_of_week"], string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

function eventClass(type: string): string {
  if (type === "class" || type === "asynchronous_class") return "event-card event-card--class";
  if (type === "study") return "event-card event-card--study";
  if (type === "sleep") return "event-card event-card--sleep";
  return "event-card event-card--personal";
}

function eventLabel(type: string, fixed: boolean): string {
  if (type === "class") return "Aula fixa";
  if (type === "asynchronous_class") return "Aula assíncrona";
  if (type === "study") return "Estudo";
  if (type === "sleep") return "Sono";
  return fixed ? "Fixo" : "Rotina";
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function CalendarView({ schedule }: { schedule: WeeklySchedule }) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("complete");
  const [includeStudy, setIncludeStudy] = useState(false);
  const academicView = viewMode === "academic";

  return (
    <section
      className="calendar-section"
      aria-label={academicView ? "Calendário acadêmico semanal" : "Agenda semanal completa"}
    >
      <div className="calendar-heading">
        <div>
          <p className="eyebrow">{academicView ? "Aulas e carga acadêmica" : "Sua semana completa"}</p>
          <h1>
            {academicView ? "Calendário acadêmico" : "Agenda completa"} · {formatDate(schedule.week_start)} a {formatDate(schedule.week_end)}
          </h1>
        </div>
        <div className="summary-grid" aria-label="Resumo da semana">
          <span><strong>{schedule.summary.class_hours}h</strong> de aula</span>
          <span><strong>{schedule.summary.asynchronous_class_hours}h</strong> assíncronas</span>
          {(!academicView || includeStudy) && (
            <span><strong>{schedule.summary.planned_extra_study_hours}h</strong> de estudo</span>
          )}
        </div>
      </div>

      <div className="calendar-toolbar">
        <div className="calendar-tabs" aria-label="Visão do calendário">
          <button
            className={`calendar-tab ${viewMode === "complete" ? "calendar-tab--active" : ""}`}
            type="button"
            aria-pressed={viewMode === "complete"}
            onClick={() => setViewMode("complete")}
          >
            Rotina completa
          </button>
          <button
            className={`calendar-tab ${viewMode === "academic" ? "calendar-tab--active" : ""}`}
            type="button"
            aria-pressed={viewMode === "academic"}
            onClick={() => setViewMode("academic")}
          >
            Aulas
          </button>
        </div>
        {academicView && (
          <label className="calendar-study-toggle">
            <input
              type="checkbox"
              checked={includeStudy}
              onChange={(event) => setIncludeStudy(event.target.checked)}
            />
            <span>Mostrar estudo planejado</span>
          </label>
        )}
      </div>

      <p className="calendar-mode-description">
        {academicView
          ? includeStudy
            ? "Aulas fixas, aulas assíncronas e blocos de estudo."
            : "Somente aulas fixas e blocos de aulas assíncronas."
          : "Aulas, estudo, trabalho, deslocamentos, compromissos e descanso no mesmo lugar."}
      </p>

      {schedule.warnings.length > 0 && (
        <div className="warning-box">
          <strong>Atenção</strong>
          {academicView && <p>Os alertas abaixo consideram a rotina completa.</p>}
          {schedule.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      <div className="calendar-scroll">
        <div className="calendar-grid">
          {schedule.days.map((day) => (
            <article className="day-column" key={day.day_of_week}>
              <header className="day-header">
                <strong>{dayLabels[day.day_of_week]}</strong>
                <span>{formatDate(day.date)}</span>
              </header>
              <div className="day-items">
                {filterScheduleItems(day.items, viewMode, includeStudy).length === 0 ? (
                  <p className="empty-day">{academicView ? "Sem aulas" : "Livre"}</p>
                ) : (
                  filterScheduleItems(day.items, viewMode, includeStudy).map((item) => (
                    <div className={eventClass(item.type)} key={item.id}>
                      <span className="event-time">{item.start}–{item.end}</span>
                      <strong>{item.title}</strong>
                      <small>{eventLabel(item.type, item.fixed)}</small>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
