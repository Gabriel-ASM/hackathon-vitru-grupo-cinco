/**
 * ============================================================================
 * CALENDÁRIO AVA — UNIASSELVI
 * Com Painel Sofia Planner (Rotina de Estudos)
 * ============================================================================
 *
 * Este arquivo implementa:
 * A) Calendário AVA (mock do calendário acadêmico existente)
 * B) Painel "🎯 Minha meta de hoje" com tarefa do dia
 * C) Sistema de Pontos gamificado com persistência via localStorage
 * D) Modal de confirmação para resgate de pontos
 * E) Sistema de temas (Uniasselvi / UniCesumar)
 *
 * IIFE para não poluir o escopo global (Requisito 10.3)
 */
;(function () {
  'use strict';

  // ==========================================================================
  // DADOS MOCKADOS (Requisito 3 — estrutura isolada e substituível)
  // ==========================================================================

  /** Eventos acadêmicos mockados (simulando resposta da API de eventos) */
  const baseAcademicEvents = [
    { begin_date: "2026-07-20", end_date: "2026-08-15", description: "Período para responder avaliação III", subject_name: "Qualidade e Testes de Software", begin_hour: "19:00", end_hour: "20:30" },
    { begin_date: "2026-08-03", end_date: "2026-08-03", description: "Primeiro Encontro Presencial", subject_name: "Qualidade e Testes de Software", begin_hour: "19:00", end_hour: "22:00" },
    { begin_date: "2026-08-17", end_date: "2026-08-17", description: "Segundo Encontro Presencial", subject_name: "Qualidade e Testes de Software", begin_hour: "19:00", end_hour: "22:00" }
  ];

  // Mensagens ilustrativas do protótipo, sorteadas ao resgatar uma recompensa.
  const redeemRankingMessages = [
    () => `Você está no top ${randomInteger(5, 15)}% da base.`,
    () => {
      const tasks = randomInteger(1, 3);
      return `Faltam apenas ${tasks} ${tasks === 1 ? 'tarefa' : 'tarefas'} para alcançar o top 100 da sua região.`;
    },
    () => `Você ocupa a posição #${randomInteger(71, 100)} no ranking semanal da base.`,
    () => `Seu aproveitamento subiu ${randomInteger(8, 24)}% nesta semana.`,
    () => {
      const tasks = randomInteger(1, 3);
      const rank = randomInteger(50, 100);
      return `Mais ${tasks} ${tasks === 1 ? 'tarefa' : 'tarefas'} para entrar no top ${rank} da base.`;
    },
    () => `Você já concluiu ${randomInteger(3, 9)} tarefas e está entre os ${randomInteger(10, 20)}% melhores da turma.`,
    () => `Faltam ${randomInteger(10, 50)} pontos para alcançar a próxima faixa: top ${randomInteger(10, 25)}%.`,
    () => `Você avançou ${randomInteger(4, 18)} posições e está no top ${randomInteger(10, 30)}% da região.`
  ];

  function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  /** Formata data YYYY-MM-DD */
  function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Retorna somente uma tarefa derivada do calendário acadêmico importado.
   * O painel não pode usar uma agenda de demonstração paralela, pois ela pode
   * mostrar uma disciplina diferente da que a Sofia acabou de planejar.
   */
  function getAcademicGoalForDate(dateStr) {
    const importedEvents = getEventsForDate(dateStr)
      .filter((event) => event.source === 'sofia');
    if (importedEvents.length === 0) return null;

    const event = importedEvents.find((candidate) => candidate.occurrenceId === selectedEventId) ||
      importedEvents.find((candidate) => candidate.type === 'academic_activity') ||
      importedEvents[0];
    const duration = Math.max(0, timeToMinutes(event.end_hour) - timeToMinutes(event.begin_hour));
    const isTask = event.type === 'academic_activity';

    return {
      event,
      subject: event.subject_name || event.description,
      duration,
      action: isTask
        ? 'Atividade acadêmica importada da agenda da Sofia.'
        : `${eventTypeLabel(event)} importado para este horário.`,
      points: isTask ? 50 : 0,
      isTask,
    };
  }

  function getAcademicTaskStorageKey(goal) {
    return goal && goal.event && goal.event.occurrenceId
      ? `academic:${goal.event.occurrenceId}`
      : selectedDate;
  }

  function normalizeEventText(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function eventMatchesSlot(left, right, dateStr) {
    return left.begin_hour === right.begin_hour &&
      left.end_hour === right.end_hour &&
      normalizeEventText(left.subject_name) === normalizeEventText(right.subject_name) &&
      dateStr >= right.begin_date &&
      dateStr <= right.end_date;
  }

  function eventOccurrenceId(event, dateStr) {
    const baseId = event.id || [
      event.subject_name,
      event.description,
      event.begin_hour,
      event.end_hour,
    ].join('-');
    return `${baseId}-${dateStr}`;
  }

  /** Retorna eventos acadêmicos ativos para uma data */
  function getEventsForDate(dateStr) {
    const candidates = [...baseAcademicEvents, ...importedAcademicEvents]
      .filter((event) => dateStr >= event.begin_date && dateStr <= event.end_date)
      .filter((event) => event.source === 'sofia' || !importedAcademicEvents.some((imported) => eventMatchesSlot(event, imported, dateStr)))
      .sort((left, right) => left.begin_hour.localeCompare(right.begin_hour));

    return candidates.map((event) => ({
      ...event,
      date: dateStr,
      occurrenceId: eventOccurrenceId(event, dateStr),
    }));
  }

  /** Verifica se uma data tem eventos acadêmicos */
  function dateHasEvents(dateStr) {
    return getEventsForDate(dateStr).length > 0;
  }

  const ACADEMIC_CALENDAR_STORAGE_KEY = 'sofiaAcademicCalendar.v2';
  const LEGACY_ACADEMIC_CALENDAR_STORAGE_KEY = 'sofiaAcademicCalendar.v1';

  function parseDateKey(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function dateToKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(dateStr, amount) {
    const date = parseDateKey(dateStr);
    date.setDate(date.getDate() + amount);
    return dateToKey(date);
  }

  function getWeekStart(dateStr) {
    const date = parseDateKey(dateStr);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return dateToKey(date);
  }

  function formatWeekRange(startDate) {
    const start = parseDateKey(startDate);
    const end = parseDateKey(addDays(startDate, 6));
    const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
    const year = end.getFullYear();
    return `${formatter.format(start)} — ${formatter.format(end)} ${year}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  function isValidTime(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function isValidDateKey(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function readAcademicCalendarImport() {
    if (!storageAvailable) return null;

    try {
      const raw = localStorage.getItem(ACADEMIC_CALENDAR_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_ACADEMIC_CALENDAR_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.source !== 'sofia') return null;

      if (parsed.version === 2 && Array.isArray(parsed.items)) {
        return parsed;
      }

      if (parsed.version === 1 && Array.isArray(parsed.classes)) {
        return {
          ...parsed,
          version: 2,
          items: parsed.classes,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function normalizeAcademicCalendarEvents(payload) {
    if (!payload) return [];

    return payload.items
      .filter((item) =>
        item &&
        typeof item.id === 'string' &&
        isValidDateKey(item.date) &&
        isValidTime(item.start) &&
        isValidTime(item.end) &&
        typeof item.title === 'string' &&
        (item.type === 'class' || item.type === 'asynchronous_class' || item.type === 'academic_activity'),
      )
      .map((item) => ({
        id: `sofia-${item.id}`,
        begin_date: item.date,
        end_date: item.date,
        description: item.type === 'class'
          ? 'Aula fixa'
          : item.type === 'asynchronous_class'
            ? 'Aula assíncrona'
            : 'Atividade acadêmica',
        subject_name: item.title,
        begin_hour: item.start,
        end_hour: item.end,
        source: 'sofia',
        type: item.type,
        fixed: item.fixed,
      }));
  }

  function refreshAcademicCalendarImport(focusImportedWeek) {
    const payload = readAcademicCalendarImport();
    importedAcademicEvents = normalizeAcademicCalendarEvents(payload);
    selectedEventId = null;

    if (focusImportedWeek && payload && isValidDateKey(payload.week_start)) {
      weekStart = getWeekStart(payload.week_start);
      selectedDate = payload.week_start;
    }
  }

  /** Formata data no formato "dia-da-semana, DD de mês" (Requisito 2.4) */
  function formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${weekdays[date.getDay()]}, ${day} de ${months[month - 1]}`;
  }

  // ==========================================================================
  // PERSISTÊNCIA — localStorage (Requisito 7)
  // ==========================================================================

  let storageAvailable = true;

  /** Testa se localStorage está disponível (Requisito 10.4) */
  function checkStorageAvailability() {
    try {
      const test = '__sofia_test__';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Lê dados de tarefas do localStorage (Requisito 7.1, 7.4, 7.6) */
  function loadTasks() {
    if (!storageAvailable) return {};
    try {
      const raw = localStorage.getItem('sofia_tasks');
      if (raw === null) return {};
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        localStorage.setItem('sofia_tasks', '{}');
        return {};
      }
      return parsed;
    } catch (e) {
      try { localStorage.setItem('sofia_tasks', '{}'); } catch (err) { storageAvailable = false; }
      return {};
    }
  }

  /** Lê pontuação do localStorage (Requisito 7.2, 7.5, 7.6) */
  function loadPoints() {
    if (!storageAvailable) return 0;
    try {
      const raw = localStorage.getItem('sofia_points');
      if (raw === null) return 0;
      const parsed = Number(raw);
      if (isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        localStorage.setItem('sofia_points', '0');
        return 0;
      }
      return parsed;
    } catch (e) {
      try { localStorage.setItem('sofia_points', '0'); } catch (err) { storageAvailable = false; }
      return 0;
    }
  }

  /** Salva tarefas no localStorage */
  function saveTasks(tasks) {
    if (!storageAvailable) return;
    try {
      localStorage.setItem('sofia_tasks', JSON.stringify(tasks));
    } catch (e) {
      storageAvailable = false;
      showStorageWarning();
    }
  }

  /** Salva pontuação no localStorage (Requisito 5.5 — síncrono antes de renderizar) */
  function savePoints(points) {
    if (!storageAvailable) return;
    try {
      localStorage.setItem('sofia_points', String(points));
    } catch (e) {
      storageAvailable = false;
      showStorageWarning();
    }
  }

  function showStorageWarning() {
    const warning = document.getElementById('sofia-storage-warning');
    if (warning) warning.style.display = 'block';
  }

  // ==========================================================================
  // ESTADO DA APLICAÇÃO
  // ==========================================================================

  let selectedDate = '2026-08-15'; // Demo default
  let weekStart = getWeekStart(selectedDate);
  let importedAcademicEvents = [];
  let selectedEventId = null;
  let completedTasks = loadTasks();
  let totalPoints = loadPoints();
  let modalOpen = false;
  let checkboxDebounceTimer = null;

  // --- Theme state ---
  let currentTheme = 'uniasselvi';

  const themes = {
    uniasselvi: {
      '--theme-primary': '#F59E0B',
      '--theme-primary-hover': '#d97706',
      '--theme-primary-text': '#1a1a2e',
      '--theme-accent': '#E91E63',
      '--theme-accent-hover': '#c2185b',
      '--theme-header-bg': '#F59E0B',
      '--theme-bg-dark': '#1a1a2e',
      '--theme-bg-darker': '#0f0f23',
      '--theme-bg-card': '#1e1e3f',
      '--theme-border': '#2a2a4a',
      '--theme-border-light': '#3a3a5a',
      '--theme-text': '#ffffff',
      '--theme-text-muted': '#aaaaaa',
      '--theme-name': 'UNIASSELVI'
    },
    unicesumar: {
      '--theme-primary': '#1565c0',
      '--theme-primary-hover': '#1976d2',
      '--theme-primary-text': '#ffffff',
      '--theme-accent': '#1565c0',
      '--theme-accent-hover': '#0d47a1',
      '--theme-header-bg': '#1565c0',
      '--theme-bg-dark': '#ffffff',
      '--theme-bg-darker': '#f0f4f8',
      '--theme-bg-card': '#f0f4f8',
      '--theme-border': '#d0dae5',
      '--theme-border-light': '#b8c8d8',
      '--theme-text': '#1a2a3a',
      '--theme-text-muted': '#5a6a7a',
      '--theme-name': 'UNICESUMAR'
    }
  };

  function applyTheme(themeName) {
    currentTheme = themeName;
    const root = document.getElementById('ava-root');
    if (!root) return;
    const theme = themes[themeName];
    Object.keys(theme).forEach(key => {
      if (key.startsWith('--')) {
        root.style.setProperty(key, theme[key]);
      }
    });
    // Update logo text
    const logo = root.querySelector('.ava-header-logo');
    if (logo) logo.textContent = theme['--theme-name'];
    // Update toggle button label
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = themeName === 'uniasselvi' ? 'UC' : 'UA';
      toggleBtn.title = themeName === 'uniasselvi' ? 'Alternar para UniCesumar' : 'Alternar para Uniasselvi';
    }
  }

  function toggleTheme() {
    const next = currentTheme === 'uniasselvi' ? 'unicesumar' : 'uniasselvi';
    applyTheme(next);
  }

  // Inicializar localStorage se necessário (Requisito 5.1)
  storageAvailable = checkStorageAvailability();
  if (storageAvailable) {
    if (localStorage.getItem('sofia_points') === null) {
      localStorage.setItem('sofia_points', '0');
    }
    if (localStorage.getItem('sofia_tasks') === null) {
      localStorage.setItem('sofia_tasks', '{}');
    }
  }

  // ==========================================================================
  // RENDERIZAÇÃO — CSS
  // ==========================================================================

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Reset e base */
      #ava-root * { box-sizing: border-box; }

      #ava-root {
        max-width: 1100px;
        margin: 0 auto;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        color: var(--theme-text, #ffffff);
      }

      /* Header */
      .ava-header {
        background: var(--theme-header-bg, var(--theme-primary));
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 8px 8px 0 0;
      }
      .ava-header-logo {
        font-weight: 800;
        font-size: 18px;
        color: var(--theme-primary-text);
        letter-spacing: 2px;
      }
      .ava-header-user {
        font-size: 14px;
        color: var(--theme-primary-text);
        font-weight: 600;
      }

      /* Subheader / navegação */
      .ava-subheader {
        background: var(--theme-bg-dark);
        padding: 12px 24px;
        border-bottom: 1px solid var(--theme-border);
      }
      .ava-back-link {
        color: var(--theme-primary);
        font-size: 13px;
        cursor: pointer;
        text-decoration: none;
      }
      .ava-back-link:hover { text-decoration: underline; }
      .ava-breadcrumb {
        margin-top: 8px;
        font-size: 14px;
        color: var(--theme-text-muted, #ccc);
      }
      .ava-breadcrumb strong {
        color: var(--theme-text, #fff);
        font-weight: 700;
      }

      /* Container principal */
      .ava-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        background: var(--theme-bg-dark);
        min-height: 600px;
        border-radius: 0 0 8px 8px;
      }

      /* Coluna esquerda — calendário */
      .ava-calendar-col {
        padding: 20px;
        border-right: 1px solid var(--theme-border);
        overflow-x: auto;
      }

      /* Navegação semanal */
      .cal-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .cal-nav-title {
        font-size: 16px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .cal-nav-btn {
        background: none;
        border: 1px solid var(--theme-border-light);
        color: var(--theme-primary);
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .cal-nav-btn:hover { background: var(--theme-border); }
      .cal-nav-btn:focus-visible {
        outline: 2px solid var(--theme-primary);
        outline-offset: 2px;
      }

      /* Grade semanal temporal, de segunda a domingo, 00:00–23:59 */
      .cal-grid {
        min-width: 1050px;
        text-align: left;
      }
      .cal-timeline-scroll {
        --cal-hour-height: 58px;
        max-height: min(76vh, 900px);
        overflow: auto;
        border: 1px solid var(--theme-border);
        border-radius: 10px;
        background: var(--theme-bg-darker);
      }
      .cal-timeline-header,
      .cal-timeline-body {
        display: grid;
        grid-template-columns: 68px repeat(7, minmax(140px, 1fr));
        min-width: 1050px;
      }
      .cal-timeline-header {
        position: sticky;
        top: 0;
        z-index: 5;
        background: var(--theme-bg-card);
        border-bottom: 1px solid var(--theme-border-light);
      }
      .cal-time-gutter {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--theme-text-muted, #aaa);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
        border-right: 1px solid var(--theme-border);
      }
      .cal-day-heading {
        min-height: 62px;
        padding: 8px 6px;
        border: 0;
        border-right: 1px solid var(--theme-border);
        background: transparent;
        color: var(--theme-text, #fff);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        transition: background .15s, color .15s;
      }
      .cal-day-heading:hover,
      .cal-day-heading.selected {
        background: var(--theme-primary);
        color: var(--theme-primary-text);
      }
      .cal-day-heading span {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .cal-day-heading strong { font-size: 20px; line-height: 1; }
      .cal-day-heading small { font-size: 10px; opacity: .72; text-transform: uppercase; }
      .cal-day-heading:focus-visible,
      .cal-event:focus-visible {
        outline: 2px solid var(--theme-primary);
        outline-offset: -2px;
      }
      .cal-timeline-body {
        align-items: stretch;
      }
      .cal-time-axis,
      .cal-day-column {
        height: calc(var(--cal-hour-height) * 24);
        position: relative;
      }
      .cal-time-axis {
        border-right: 1px solid var(--theme-border);
        background: var(--theme-bg-card);
      }
      .cal-time-label {
        position: absolute;
        right: 8px;
        transform: translateY(-50%);
        color: var(--theme-text-muted, #aaa);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }
      .cal-time-label:first-child { transform: translateY(0); }
      .cal-time-end {
        position: absolute;
        right: 8px;
        bottom: 0;
        transform: translateY(50%);
        color: var(--theme-text-muted, #aaa);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }
      .cal-day-column {
        border-right: 1px solid var(--theme-border);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent calc(var(--cal-hour-height) - 1px),
          var(--theme-border) calc(var(--cal-hour-height) - 1px),
          var(--theme-border) var(--cal-hour-height)
        );
      }
      .cal-day-column.today { background-color: color-mix(in srgb, var(--theme-primary) 5%, transparent); }
      .cal-event {
        position: absolute;
        left: 4px;
        right: 4px;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        min-height: 30px;
        overflow: hidden;
        padding: 5px 6px;
        border: 1px solid transparent;
        border-left: 4px solid var(--event-color, var(--theme-primary));
        border-radius: 5px;
        background: color-mix(in srgb, var(--event-color, var(--theme-primary)) 18%, var(--theme-bg-card));
        color: var(--theme-text, #fff);
        text-align: left;
        cursor: pointer;
        transition: transform .15s, filter .15s, box-shadow .15s;
      }
      .cal-event:hover,
      .cal-event.selected {
        z-index: 3;
        filter: brightness(1.15);
        box-shadow: 0 0 0 1px var(--event-color, var(--theme-primary)), 0 5px 14px rgba(0, 0, 0, .22);
        transform: translateY(-1px);
      }
      .cal-event-time { font-size: 10px; font-variant-numeric: tabular-nums; color: var(--theme-text-muted, #ccc); }
      .cal-event-title { font-size: 11px; font-weight: 800; line-height: 1.2; }
      .cal-event-type { font-size: 9px; opacity: .76; text-transform: uppercase; letter-spacing: .04em; }
      .cal-event--class { --event-color: #f59e0b; }
      .cal-event--async { --event-color: #38bdf8; }
      .cal-event--activity { --event-color: #a78bfa; }
      .cal-event--base { --event-color: #22c55e; }

      /* Botão baixar calendário */
      .cal-download-section {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--theme-border);
      }
      .cal-download-label {
        font-size: 12px;
        color: #888;
        margin-bottom: 8px;
      }
      .cal-download-btn {
        display: block;
        width: 100%;
        padding: 10px;
        background: var(--theme-border);
        border: 1px solid var(--theme-border-light);
        color: var(--theme-primary);
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        transition: background 0.15s;
      }
      .cal-download-btn:hover { background: var(--theme-border-light); }
      .cal-download-btn:focus-visible {
        outline: 2px solid var(--theme-primary);
        outline-offset: 2px;
      }

      /* Coluna direita — eventos + sofia panel */
      .ava-content-col {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-self: start;
        position: sticky;
        top: 16px;
        max-height: calc(100vh - 32px);
        overflow-y: auto;
      }

      /* Seção de eventos */
      .events-header {
        font-size: 14px;
        font-weight: 700;
        color: var(--theme-primary);
        margin-bottom: 12px;
      }
      .event-card {
        background: var(--theme-bg-darker);
        border-left: 4px solid var(--theme-primary);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 10px;
      }
      .event-time {
        font-size: 12px;
        color: var(--theme-primary);
        font-weight: 600;
        margin-bottom: 4px;
      }
      .event-desc {
        font-size: 13px;
        color: var(--theme-text, #ddd);
      }
      .event-subject {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
      }
      .no-events {
        color: #666;
        font-size: 13px;
        font-style: italic;
        margin-bottom: 12px;
      }
      .event-detail {
        padding: 16px;
        border: 1px solid var(--theme-border-light);
        border-left: 4px solid var(--theme-primary);
        border-radius: 9px;
        background: var(--theme-bg-card);
        margin-bottom: 16px;
      }
      .event-detail--empty {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: var(--theme-text-muted, #aaa);
      }
      .event-detail--empty strong { color: var(--theme-text, #fff); font-size: 14px; }
      .event-detail--empty small { color: var(--theme-primary); font-size: 11px; }
      .event-detail-kicker {
        display: inline-block;
        color: var(--theme-primary);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .event-detail-title {
        color: var(--theme-text, #fff);
        font-size: 18px;
        line-height: 1.2;
        margin: 0 0 8px;
      }
      .event-detail-description {
        color: var(--theme-text-muted, #ccc);
        font-size: 13px;
        line-height: 1.45;
        margin: 0 0 14px;
      }
      .event-detail-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }
      .event-detail-meta span {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 8px;
        border-radius: 6px;
        background: var(--theme-bg-darker);
        color: var(--theme-text, #fff);
        font-size: 12px;
      }
      .event-detail-meta strong {
        color: var(--theme-text-muted, #aaa);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .event-detail-source {
        color: var(--theme-text-muted, #aaa);
        font-size: 11px;
      }

      /* Sofia Panel — "Minha meta de hoje" */
      .sofia-panel {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--theme-border);
      }
      .sofia-title {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 16px;
        color: var(--theme-text, #fff);
      }
      .sofia-date {
        font-size: 13px;
        color: var(--theme-text-muted, #aaa);
        margin-bottom: 12px;
        text-transform: capitalize;
      }
      .sofia-subject {
        font-size: 15px;
        font-weight: 700;
        color: var(--theme-text, #fff);
        margin-bottom: 6px;
      }
      .sofia-duration {
        font-size: 13px;
        color: var(--theme-primary);
        margin-bottom: 8px;
      }
      .sofia-action {
        font-size: 14px;
        color: var(--theme-text, #ddd);
        margin-bottom: 16px;
      }
      .sofia-rest {
        font-size: 16px;
        color: #86efac;
        padding: 16px 0;
      }
      .sofia-empty,
      .sofia-event-note {
        font-size: 13px;
        line-height: 1.45;
        color: var(--theme-text-muted, #aaa);
        padding: 10px 0 16px;
      }

      /* Checkbox de conclusão */
      .sofia-checkbox-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        cursor: pointer;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--theme-border-light);
        background: var(--theme-bg-darker);
        transition: border-color 0.15s, background 0.15s;
      }
      .sofia-checkbox-wrapper:hover {
        border-color: var(--theme-primary);
        background: var(--theme-bg-card);
      }
      .sofia-checkbox-wrapper:focus-visible {
        outline: 2px solid var(--theme-primary);
        outline-offset: 2px;
      }
      .sofia-checkbox-wrapper.checked {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.08);
      }
      .sofia-checkbox-wrapper.redeemed {
        cursor: not-allowed;
        opacity: 0.7;
        border-color: var(--theme-border-light);
        background: var(--theme-bg-darker);
      }
      .sofia-checkbox-wrapper.redeemed:hover {
        border-color: var(--theme-border-light);
        background: var(--theme-bg-darker);
      }
      .sofia-redeemed-badge {
        font-size: 11px;
        color: #888;
        margin-left: auto;
        font-style: italic;
      }
      .sofia-checkbox-icon {
        width: 22px;
        height: 22px;
        border: 2px solid #555;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .sofia-checkbox-wrapper.checked .sofia-checkbox-icon {
        background: #22c55e;
        border-color: #22c55e;
      }
      .sofia-checkbox-icon::after {
        content: '';
        display: none;
        width: 6px;
        height: 10px;
        border: solid #fff;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        margin-bottom: 2px;
      }
      .sofia-checkbox-wrapper.checked .sofia-checkbox-icon::after {
        display: block;
      }
      .sofia-checkbox-label {
        font-size: 14px;
        color: var(--theme-text-muted, #ccc);
      }
      .sofia-checkbox-wrapper.checked .sofia-checkbox-label {
        color: #22c55e;
        font-weight: 600;
      }

      /* Card de pontuação */
      .sofia-points-card {
        border: 2px dashed var(--theme-accent);
        border-radius: 10px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--theme-bg-card);
        margin-top: auto;
      }
      .sofia-points-display {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sofia-points-star {
        font-size: 22px;
        color: var(--theme-accent);
      }
      .sofia-points-value {
        font-size: 18px;
        font-weight: 800;
        color: var(--theme-text, #fff);
      }
      .sofia-redeem-btn {
        padding: 8px 16px;
        background: var(--theme-accent);
        border: none;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, background 0.15s;
      }
      .sofia-redeem-btn:hover { background: var(--theme-accent-hover); }
      .sofia-redeem-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .sofia-redeem-btn:focus-visible {
        outline: 2px solid var(--theme-primary);
        outline-offset: 2px;
      }

      /* Modal de confirmação */
      .sofia-modal-overlay {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9999;
        align-items: center;
        justify-content: center;
      }
      .sofia-modal-overlay.open {
        display: flex;
      }
      .sofia-modal {
        background: var(--theme-bg-dark);
        border: 1px solid var(--theme-border-light);
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        text-align: center;
      }
      .sofia-modal-title {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--theme-text, #fff);
      }
      .sofia-modal-text {
        font-size: 14px;
        color: var(--theme-text-muted, #aaa);
        margin-bottom: 24px;
      }
      .sofia-modal-points {
        font-size: 28px;
        font-weight: 800;
        color: var(--theme-accent);
        margin-bottom: 24px;
      }
      .sofia-modal-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      .sofia-modal-btn {
        padding: 10px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: background 0.15s;
      }
      .sofia-modal-btn:focus-visible {
        outline: 2px solid var(--theme-primary);
        outline-offset: 2px;
      }
      .sofia-modal-confirm {
        background: var(--theme-accent);
        color: #fff;
      }
      .sofia-modal-confirm:hover { background: var(--theme-accent-hover); }
      .sofia-modal-cancel {
        background: var(--theme-border);
        color: #ccc;
        border: 1px solid var(--theme-border-light);
      }
      .sofia-modal-cancel:hover { background: var(--theme-border-light); }

      /* Storage warning */
      .sofia-storage-warning {
        display: none;
        background: var(--theme-primary);
        color: var(--theme-primary-text);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        margin-top: 8px;
        font-weight: 600;
      }

      /* Responsivo básico */
      @media (max-width: 768px) {
        .ava-main {
          grid-template-columns: 1fr;
        }
        .ava-calendar-col {
          border-right: none;
          border-bottom: 1px solid var(--theme-border);
        }
        .ava-content-col {
          position: static;
          max-height: none;
          overflow: visible;
        }
      }

      /* Fireworks animation */
      .sofia-firework {
        position: fixed;
        pointer-events: none;
        z-index: 10000;
      }
      .sofia-particle {
        position: absolute;
        border-radius: 50%;
        animation: sofia-particle-burst 1.2s ease-out forwards;
      }
      @keyframes sofia-particle-burst {
        0% {
          transform: translate(0, 0) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate(var(--dx), var(--dy)) scale(0.3);
          opacity: 0;
        }
      }

      /* Enhanced firework particles */
      .sofia-particle-trail {
        position: absolute;
        width: 3px;
        height: 12px;
        border-radius: 2px;
        animation: sofia-trail-burst 1.4s ease-out forwards;
      }
      @keyframes sofia-trail-burst {
        0% {
          transform: translate(0, 0) rotate(var(--angle)) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate(var(--dx), var(--dy)) rotate(var(--angle)) scale(0.2);
          opacity: 0;
        }
      }
      .sofia-particle-star {
        position: absolute;
        width: 0; height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 10px solid var(--color);
        animation: sofia-star-burst 1.3s ease-out forwards;
      }
      @keyframes sofia-star-burst {
        0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
        50% { transform: translate(calc(var(--dx) * 0.6), calc(var(--dy) * 0.6)) rotate(180deg) scale(1.2); opacity: 0.8; }
        100% { transform: translate(var(--dx), var(--dy)) rotate(360deg) scale(0); opacity: 0; }
      }
      .sofia-points-card.pulse-glow {
        animation: sofia-card-pulse 0.8s ease-out;
      }
      @keyframes sofia-card-pulse {
        0% { box-shadow: 0 0 0 0 rgba(233, 30, 99, 0.6); }
        50% { box-shadow: 0 0 30px 10px rgba(233, 30, 99, 0.4); }
        100% { box-shadow: 0 0 0 0 rgba(233, 30, 99, 0); }
      }
      .sofia-redeem-success {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--theme-bg-dark, #1a1a2e);
        border: 2px solid #22c55e;
        border-radius: 12px;
        padding: 24px 40px;
        font-size: 16px;
        font-weight: 700;
        color: #22c55e;
        z-index: 10001;
        animation: sofia-success-appear 5s ease-out forwards;
      }
      .sofia-redeem-ranking {
        margin-top: 8px;
        max-width: 360px;
        font-size: 14px;
        line-height: 1.4;
        font-weight: 600;
        color: var(--theme-text, #fff);
      }
      @keyframes sofia-success-appear {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        15% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        25% { transform: translate(-50%, -50%) scale(1); }
        75% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      }

      @media (prefers-reduced-motion: reduce) {
        .sofia-particle, .sofia-particle-trail, .sofia-particle-star { animation: none; opacity: 0; }
        .sofia-redeem-success { animation: none; }
        .sofia-points-card.pulse-glow { animation: none; }
      }

      /* Theme toggle button */
      .theme-toggle-btn {
        position: fixed;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--theme-border-light, #3a3a5a);
        border: 1px solid var(--theme-border, #2a2a4a);
        color: var(--theme-text, #ffffff);
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        z-index: 9998;
        transition: background 0.2s, transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .theme-toggle-btn:hover {
        background: var(--theme-primary, #F59E0B);
        color: var(--theme-primary-text, #1a1a2e);
        transform: translateY(-50%) scale(1.1);
      }
      .theme-toggle-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #F59E0B);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================================================
  // RENDERIZAÇÃO — HTML
  // ==========================================================================

  function renderApp() {
    const root = document.getElementById('ava-root');
    if (!root) return;

    root.innerHTML = `
      <!-- Theme toggle button -->
      <button class="theme-toggle-btn" id="theme-toggle-btn" title="Alternar para UniCesumar" aria-label="Alternar tema entre Uniasselvi e UniCesumar">UC</button>

      <!-- Header Uniasselvi -->
      <header class="ava-header">
        <span class="ava-header-logo">UNIASSELVI</span>
        <span class="ava-header-user">Eduardo</span>
      </header>

      <!-- Subheader -->
      <div class="ava-subheader">
        <a class="ava-back-link" href="#">← VOLTAR</a>
        <div class="ava-breadcrumb">
          <strong>CALENDÁRIO</strong> | Qualidade e Testes de Software (135481)
        </div>
      </div>

      <!-- Container principal: calendário + conteúdo -->
      <div class="ava-main">
        <!-- Coluna esquerda: calendário -->
        <div class="ava-calendar-col">
          <div class="cal-nav">
            <button class="cal-nav-btn" id="cal-prev" aria-label="Semana anterior">‹</button>
            <span class="cal-nav-title" id="cal-month-title"></span>
            <button class="cal-nav-btn" id="cal-next" aria-label="Próxima semana">›</button>
          </div>
          <div class="cal-grid" id="cal-grid" role="grid" aria-label="Calendário"></div>
          <div class="cal-download-section">
            <div class="cal-download-label">Calendário Acadêmico 2026</div>
            <button class="cal-download-btn" aria-label="Baixar calendário acadêmico em PDF">Baixar calendário</button>
          </div>
        </div>

        <!-- Coluna direita: eventos + sofia panel -->
        <div class="ava-content-col">
          <!-- Eventos acadêmicos -->
          <div id="events-section"></div>

          <!-- Painel Sofia -->
          <div class="sofia-panel" id="sofia-panel" aria-label="Minha meta do dia"></div>

          <!-- Card de pontuação -->
          <div class="sofia-points-card" id="sofia-points-card" aria-label="Pontuação acumulada">
            <div class="sofia-points-display">
              <span class="sofia-points-star">★</span>
              <span class="sofia-points-value" id="sofia-points-value">0 PONTOS</span>
            </div>
            <button class="sofia-redeem-btn" id="sofia-redeem-btn" aria-label="Retirar pontos acumulados">Retirar pontos</button>
          </div>

          <!-- Aviso de persistência indisponível -->
          <div class="sofia-storage-warning" id="sofia-storage-warning">
            Persistência indisponível nesta sessão. Seu progresso não será salvo.
          </div>
        </div>
      </div>

      <!-- Modal de confirmação -->
      <div class="sofia-modal-overlay" id="sofia-modal" role="dialog" aria-modal="true" aria-labelledby="sofia-modal-title">
        <div class="sofia-modal">
          <div class="sofia-modal-title" id="sofia-modal-title">Retirar pontos</div>
          <div class="sofia-modal-text">Deseja resgatar todos os seus pontos?</div>
          <div class="sofia-modal-points" id="sofia-modal-points">0</div>
          <div class="sofia-modal-actions">
            <button class="sofia-modal-btn sofia-modal-confirm" id="sofia-modal-confirm">Confirmar</button>
            <button class="sofia-modal-btn sofia-modal-cancel" id="sofia-modal-cancel">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    // Exibe aviso de storage se necessário (Requisito 10.4)
    if (!storageAvailable) {
      showStorageWarning();
    }
  }

  // ==========================================================================
  // CALENDÁRIO — Renderização do grid
  // ========================================================================== 

  function timeToMinutes(value) {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
    return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
  }

  function eventTypeLabel(event) {
    if (event.type === 'class') return 'Aula fixa';
    if (event.type === 'asynchronous_class') return 'Aula assíncrona';
    if (event.type === 'academic_activity') return 'Atividade acadêmica';
    return 'Evento acadêmico';
  }

  function eventTypeClass(event) {
    if (event.type === 'class') return 'cal-event--class';
    if (event.type === 'asynchronous_class') return 'cal-event--async';
    if (event.type === 'academic_activity') return 'cal-event--activity';
    return 'cal-event--base';
  }

  function renderCalendar() {
    const weekdays = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
    const titleEl = document.getElementById('cal-month-title');
    if (titleEl) titleEl.textContent = formatWeekRange(weekStart);

    const grid = document.getElementById('cal-grid');
    if (!grid) return;

    const hourHeight = 58;
    const timeLabels = Array.from({ length: 24 }, (_, hour) =>
      `<span class="cal-time-label" style="top:${hour * hourHeight}px">${String(hour).padStart(2, '0')}:00</span>`,
    ).join('');
    const dayHeaders = [];
    const dayColumns = [];

    for (let index = 0; index < 7; index += 1) {
      const dateStr = addDays(weekStart, index);
      const date = parseDateKey(dateStr);
      const events = getEventsForDate(dateStr);
      const isSelected = dateStr === selectedDate;
      const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
      const today = dateStr === dateToKey(new Date());

      dayHeaders.push(`
        <button class="cal-day-heading${isSelected ? ' selected' : ''}" data-date="${dateStr}" type="button" aria-label="Selecionar ${escapeHtml(weekdays[index])} ${date.getDate()} de ${escapeHtml(monthLabel)}">
          <span>${escapeHtml(weekdays[index])}</span>
          <strong>${date.getDate()}</strong>
          <small>${escapeHtml(monthLabel)}</small>
        </button>`);

      const eventMarkup = events.map((event) => {
        const startMinutes = timeToMinutes(event.begin_hour);
        const endMinutes = Math.max(startMinutes + 30, timeToMinutes(event.end_hour));
        const height = Math.max(30, Math.min(24 * hourHeight - startMinutes / 60 * hourHeight, (endMinutes - startMinutes) / 60 * hourHeight));
        const title = event.subject_name || event.description;
        const isEventSelected = event.occurrenceId === selectedEventId;
        return `
          <button class="cal-event ${eventTypeClass(event)}${isEventSelected ? ' selected' : ''}" type="button"
            data-event-id="${escapeHtml(event.occurrenceId)}" data-date="${dateStr}"
            style="top:${(startMinutes / 60) * hourHeight}px;height:${height}px"
            aria-label="${escapeHtml(`${title}, ${event.begin_hour} a ${event.end_hour}`)}">
            <span class="cal-event-time">${escapeHtml(event.begin_hour)}–${escapeHtml(event.end_hour)}</span>
            <strong class="cal-event-title">${escapeHtml(title)}</strong>
            <small class="cal-event-type">${escapeHtml(eventTypeLabel(event))}</small>
          </button>`;
      }).join('');

      dayColumns.push(`
        <div class="cal-day-column${today ? ' today' : ''}" data-date="${dateStr}" aria-label="${escapeHtml(weekdays[index])} ${date.getDate()}">
          ${eventMarkup}
        </div>`);
    }

    grid.innerHTML = `
      <div class="cal-timeline-scroll">
        <div class="cal-timeline-header">
          <div class="cal-time-gutter">Horário</div>
          ${dayHeaders.join('')}
        </div>
        <div class="cal-timeline-body">
          <div class="cal-time-axis">
            ${timeLabels}
            <span class="cal-time-end">23:59</span>
          </div>
          ${dayColumns.join('')}
        </div>
      </div>`;
  }

  // ==========================================================================
  // EVENTOS ACADÊMICOS — Renderização
  // ==========================================================================

  function renderEvents() {
    const section = document.getElementById('events-section');
    if (!section) return;

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateLabel = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    const selectedEvent = getEventsForDate(selectedDate).find((event) => event.occurrenceId === selectedEventId);

    let html = '<div class="events-header">Detalhes do compromisso</div>';

    if (!selectedEvent) {
      html += `
        <div class="event-detail event-detail--empty">
          <strong>Selecione um compromisso</strong>
          <span>Clique em qualquer bloco da semana para ver seus detalhes aqui.</span>
          <small>Data em foco: ${escapeHtml(dateLabel)}</small>
        </div>`;
    } else {
      const title = selectedEvent.subject_name || selectedEvent.description;
      const source = selectedEvent.source === 'sofia' ? 'Agenda atualizada pela Sofia' : 'Calendário acadêmico';
      const fixedLabel = selectedEvent.fixed === true ? 'Horário fixo' : 'Horário planejado';
      html += `
        <article class="event-detail" aria-label="Detalhes de ${escapeHtml(title)}">
          <span class="event-detail-kicker">${escapeHtml(eventTypeLabel(selectedEvent))}</span>
          <h2 class="event-detail-title">${escapeHtml(title)}</h2>
          <p class="event-detail-description">${escapeHtml(selectedEvent.description)}</p>
          <div class="event-detail-meta">
            <span><strong>Data</strong>${escapeHtml(dateLabel)}</span>
            <span><strong>Horário</strong>${escapeHtml(selectedEvent.begin_hour)}–${escapeHtml(selectedEvent.end_hour)}</span>
          </div>
          <div class="event-detail-source">${escapeHtml(fixedLabel)} · ${escapeHtml(source)}</div>
        </article>`;
    }

    section.innerHTML = html;
  }

  // ==========================================================================
  // SOFIA PANEL — Renderização da meta do dia (Requisitos 2, 4)
  // ==========================================================================

  function renderSofiaPanel() {
    const panel = document.getElementById('sofia-panel');
    if (!panel) return;

    const goal = getAcademicGoalForDate(selectedDate);
    const dateDisplay = formatDateDisplay(selectedDate);

    let html = `<div class="sofia-title">Minha meta do dia</div>`;
    html += `<div class="sofia-date">${dateDisplay}</div>`;

    if (!goal) {
      html += `<div class="sofia-empty">Nenhuma tarefa acadêmica foi importada para esta data.</div>`;
      panel.innerHTML = html;
      return;
    }

    // Exibe o item que veio da agenda importada, sem inventar outra disciplina.
    const timeLabel = goal.duration > 0
      ? `${goal.duration} minutos`
      : 'Horário acadêmico';
    html += `<div class="sofia-subject">${escapeHtml(goal.subject)}</div>`;
    html += `<div class="sofia-duration">${timeLabel} · ${escapeHtml(goal.event.begin_hour)}–${escapeHtml(goal.event.end_hour)}</div>`;
    html += `<div class="sofia-action">${escapeHtml(goal.action)}</div>`;

    if (!goal.isTask) {
      html += `<div class="sofia-event-note">Este item é um compromisso acadêmico, não uma tarefa pontuável.</div>`;
      panel.innerHTML = html;
      return;
    }

    // Checkbox de conclusão (Requisito 4) — with redeemed state support
    const taskState = completedTasks[getAcademicTaskStorageKey(goal)];
    const isRedeemed = taskState === 'redeemed';
    const isChecked = taskState === true || isRedeemed;

    let checkboxClass = 'sofia-checkbox-wrapper';
    if (isChecked) checkboxClass += ' checked';
    if (isRedeemed) checkboxClass += ' redeemed';

    const checkboxLabel = isRedeemed ? 'Atividade concluída' : (isChecked ? 'Atividade concluída' : 'Concluir atividade');
    const ariaChecked = isChecked ? 'true' : 'false';
    const tabIndex = isRedeemed ? '-1' : '0';

    html += `
      <div class="${checkboxClass}" id="sofia-checkbox"
           role="checkbox" aria-checked="${ariaChecked}"
           aria-label="${checkboxLabel}" tabindex="${tabIndex}"
           ${isRedeemed ? 'aria-disabled="true"' : ''}>
        <div class="sofia-checkbox-icon"></div>
        <span class="sofia-checkbox-label">${checkboxLabel}</span>
        ${isRedeemed ? '<span class="sofia-redeemed-badge">Pontos já resgatados</span>' : ''}
      </div>`;

    panel.innerHTML = html;
  }

  // ==========================================================================
  // PONTUAÇÃO — Renderização (Requisito 5, 6)
  // ==========================================================================

  function renderPoints() {
    const valueEl = document.getElementById('sofia-points-value');
    const redeemBtn = document.getElementById('sofia-redeem-btn');
    if (!valueEl || !redeemBtn) return;

    valueEl.textContent = `${totalPoints} PONTOS`;

    // Botão habilitado se pontuação >= 1 (Requisito 6.2)
    redeemBtn.disabled = totalPoints < 1;
  }

  // ==========================================================================
  // LÓGICA DE INTERAÇÃO — Seleção de dia
  // ==========================================================================

  function selectDate(dateStr) {
    selectedDate = dateStr;
    weekStart = getWeekStart(dateStr);
    selectedEventId = null;
    renderCalendar();
    renderEvents();
    renderSofiaPanel();
    renderPoints();
  }

  function selectEvent(eventId, dateStr) {
    selectedDate = dateStr;
    weekStart = getWeekStart(dateStr);
    selectedEventId = eventId;
    renderCalendar();
    renderEvents();
    renderSofiaPanel();
    renderPoints();
  }

  function moveWeek(amount) {
    weekStart = addDays(weekStart, amount * 7);
    selectedDate = weekStart;
    selectedEventId = null;
    renderCalendar();
    renderEvents();
    renderSofiaPanel();
    renderPoints();
  }

  // ==========================================================================
  // LÓGICA DE INTERAÇÃO — Checkbox (Requisito 4)
  // ==========================================================================

  function handleCheckboxToggle() {
    if (modalOpen) return;
    if (checkboxDebounceTimer) return;
    checkboxDebounceTimer = setTimeout(() => { checkboxDebounceTimer = null; }, 300);

    const goal = getAcademicGoalForDate(selectedDate);
    if (!goal || !goal.isTask || goal.points < 1) return;

    const taskState = completedTasks[getAcademicTaskStorageKey(goal)];
    const points = goal.points;

    // If task is redeemed, do nothing — it's locked
    if (taskState === 'redeemed') return;

    const isCurrentlyChecked = taskState === true;

    const taskKey = getAcademicTaskStorageKey(goal);

    if (isCurrentlyChecked) {
      // Desmarcar — subtrair 50 pontos, floor at 0
      totalPoints = Math.max(0, totalPoints - points);
      completedTasks[taskKey] = false;
    } else {
      // Marcar — adicionar 50 pontos
      totalPoints += points;
      completedTasks[taskKey] = true;
    }

    // Persistir de forma síncrona (Requisito 5.5, 7)
    savePoints(totalPoints);
    saveTasks(completedTasks);

    // Re-renderizar
    renderSofiaPanel();
    renderPoints();
  }

  // ==========================================================================
  // LÓGICA DE INTERAÇÃO — Modal (Requisito 6)
  // ==========================================================================

  function openModal() {
    if (modalOpen) return;
    if (totalPoints < 1) return;

    modalOpen = true;
    const overlay = document.getElementById('sofia-modal');
    const pointsEl = document.getElementById('sofia-modal-points');
    if (overlay) overlay.classList.add('open');
    if (pointsEl) pointsEl.textContent = `${totalPoints} pontos`;

    // Mover foco para primeiro botão do modal (Requisito 9.2)
    setTimeout(() => {
      const confirmBtn = document.getElementById('sofia-modal-confirm');
      if (confirmBtn) confirmBtn.focus();
    }, 50);
  }

  function closeModal() {
    modalOpen = false;
    const overlay = document.getElementById('sofia-modal');
    if (overlay) overlay.classList.remove('open');

    // Devolver foco ao elemento que abriu o modal (Requisito 9.3)
    const redeemBtn = document.getElementById('sofia-redeem-btn');
    if (redeemBtn) redeemBtn.focus();
  }

  // ==========================================================================
  // ENHANCED REDEMPTION ANIMATION (Change 1)
  // ==========================================================================

  function launchFireworks() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const colors = ['#E91E63', '#F59E0B', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899'];
    const burstCount = 7;

    for (let b = 0; b < burstCount; b++) {
      setTimeout(() => {
        const container = document.createElement('div');
        container.className = 'sofia-firework';
        const cx = window.innerWidth * (0.2 + Math.random() * 0.6);
        const cy = window.innerHeight * (0.1 + Math.random() * 0.4);
        container.style.left = cx + 'px';
        container.style.top = cy + 'px';
        document.body.appendChild(container);

        const particleCount = 30 + Math.floor(Math.random() * 10);
        for (let i = 0; i < particleCount; i++) {
          const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.4);
          const distance = 70 + Math.random() * 100;
          const dx = Math.cos(angle) * distance;
          const dy = Math.sin(angle) * distance;
          const color = colors[Math.floor(Math.random() * colors.length)];

          // Mix of circles, trails, and stars
          const type = Math.random();
          let particle;
          if (type < 0.5) {
            // Circle particle
            particle = document.createElement('div');
            particle.className = 'sofia-particle';
            const size = 4 + Math.random() * 6;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            particle.style.background = color;
          } else if (type < 0.8) {
            // Trail particle
            particle = document.createElement('div');
            particle.className = 'sofia-particle-trail';
            particle.style.background = color;
            particle.style.setProperty('--angle', (angle * 180 / Math.PI) + 'deg');
          } else {
            // Star particle
            particle = document.createElement('div');
            particle.className = 'sofia-particle-star';
            particle.style.setProperty('--color', color);
          }

          particle.style.setProperty('--dx', dx + 'px');
          particle.style.setProperty('--dy', dy + 'px');
          particle.style.animationDelay = (Math.random() * 0.2) + 's';
          container.appendChild(particle);
        }

        setTimeout(() => { container.remove(); }, 1800);
      }, b * 350);
    }
  }

  function animatePointsCountdown(fromValue) {
    const valueEl = document.getElementById('sofia-points-value');
    if (!valueEl || fromValue <= 0) return;

    const duration = 1500;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(fromValue * (1 - eased));
      valueEl.textContent = `${current} PONTOS`;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function getRandomRedeemRankingMessage() {
    const index = randomInteger(0, redeemRankingMessages.length - 1);
    return redeemRankingMessages[index]();
  }

  function confirmRedeem() {
    const hadPoints = totalPoints;

    totalPoints = 0;
    savePoints(totalPoints);
    closeModal();

    // Mark all currently completed tasks as redeemed
    Object.keys(completedTasks).forEach(date => {
      if (completedTasks[date] === true) {
        completedTasks[date] = 'redeemed';
      }
    });
    saveTasks(completedTasks);

    if (hadPoints > 0) {
      // Animate countdown
      animatePointsCountdown(hadPoints);

      // Pulse glow on card
      const card = document.getElementById('sofia-points-card');
      if (card) {
        card.classList.add('pulse-glow');
        setTimeout(() => card.classList.remove('pulse-glow'), 800);
      }

      // Launch fireworks
      launchFireworks();

      // Success message (auto-removes via CSS animation)
      const msg = document.createElement('div');
      msg.className = 'sofia-redeem-success';
      const successTitle = document.createElement('div');
      successTitle.textContent = 'Pontos retirados com sucesso';
      const rankingMessage = document.createElement('div');
      rankingMessage.className = 'sofia-redeem-ranking';
      rankingMessage.textContent = getRandomRedeemRankingMessage();
      msg.append(successTitle, rankingMessage);
      document.body.appendChild(msg);
      setTimeout(() => { msg.remove(); }, 5200);

      // Update button state after animation
      setTimeout(() => {
        renderPoints();
        renderSofiaPanel();
      }, 1600);
    } else {
      renderPoints();
      renderSofiaPanel();
    }
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  function attachEventListeners() {
    const root = document.getElementById('ava-root');
    if (!root) return;

    // Navegação semanal
    document.getElementById('cal-prev').addEventListener('click', function () {
      moveWeek(-1);
    });

    document.getElementById('cal-next').addEventListener('click', function () {
      moveWeek(1);
    });

    // Clique nos cabeçalhos e compromissos da semana (delegação de eventos)
    document.getElementById('cal-grid').addEventListener('click', function (e) {
      const eventBtn = e.target.closest('.cal-event');
      if (eventBtn) {
        const eventId = eventBtn.getAttribute('data-event-id');
        const eventDate = eventBtn.getAttribute('data-date');
        if (eventId && eventDate) selectEvent(eventId, eventDate);
        return;
      }

      const dayBtn = e.target.closest('.cal-day-heading');
      if (dayBtn) {
        const dateStr = dayBtn.getAttribute('data-date');
        if (dateStr) selectDate(dateStr);
      }
    });

    // Checkbox de conclusão — delegação para lidar com re-renders
    document.getElementById('sofia-panel').addEventListener('click', function (e) {
      const checkbox = e.target.closest('#sofia-checkbox');
      if (checkbox) handleCheckboxToggle();
    });

    // Keyboard: Space/Enter no checkbox (Requisito 9.1)
    document.getElementById('sofia-panel').addEventListener('keydown', function (e) {
      const checkbox = e.target.closest('#sofia-checkbox');
      if (checkbox && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleCheckboxToggle();
      }
    });

    // Botão retirar pontos
    document.getElementById('sofia-redeem-btn').addEventListener('click', function () {
      if (modalOpen) return;
      openModal();
    });

    // Modal — confirmar
    document.getElementById('sofia-modal-confirm').addEventListener('click', confirmRedeem);

    // Modal — cancelar (Requisito 6.6)
    document.getElementById('sofia-modal-cancel').addEventListener('click', closeModal);

    // Modal — clique no overlay fecha
    document.getElementById('sofia-modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });

    // Escape fecha modal (Requisito 9.3)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    });

    // Focus trap dentro do modal (Requisito 9.2)
    document.getElementById('sofia-modal').addEventListener('keydown', function (e) {
      if (!modalOpen || e.key !== 'Tab') return;

      const focusable = this.querySelectorAll('button:not([disabled])');
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Theme toggle button
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    window.addEventListener('storage', function (event) {
      if (event.key !== ACADEMIC_CALENDAR_STORAGE_KEY && event.key !== LEGACY_ACADEMIC_CALENDAR_STORAGE_KEY && event.key !== null) return;
      refreshAcademicCalendarImport(true);
      renderCalendar();
      renderEvents();
      renderSofiaPanel();
    });
  }

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================

  function init() {
    injectStyles();
    refreshAcademicCalendarImport(true);
    renderApp();
    renderCalendar();
    renderEvents();
    renderSofiaPanel();
    renderPoints();
    attachEventListeners();
    applyTheme(currentTheme);
  }

  // Aguarda DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
