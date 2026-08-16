/* ============================================================
   Sofia Flow — Chat da Sofia
   HTML5 + CSS3 + JavaScript Vanilla (sem dependências, sem backend)

   A camada de IA será conectada depois: todo o texto da Sofia passa
   por receiveMessage(), que é o único ponto a ser substituído.
   ============================================================ */

import { RealtimeVoiceSession } from "../../../../client/src/voice/realtimeVoiceSession";
import { MOCK_SCHEDULE } from "../../../../shared/mockSchedule";
import {
  ACADEMIC_CALENDAR_STORAGE_KEY,
  buildAcademicCalendarImport,
} from "../../../../shared/calendar";
import { routineExtractionResultSchema } from "../../../../shared/schemas/routine";
import { applyTemporaryClassChanges, validateWeeklySchedule } from "../../../../shared/schemas/schedule";
import {
  buildRoutineClarificationContext,
  clarificationAddedUserFacts,
  shouldClarifyRoutine,
} from "../../../../shared/routine-clarification";
import { getAssistantVoiceProfile } from "../../../../shared/voice-profile";

(function () {
  "use strict";

  /* ---------------- Configuração ---------------- */

  const STORAGE_KEYS = {
    theme: "sofiaTheme",
    planner: "sofiaPlannerState"
  };

  /* Cada marca tem sua própria assistente: nome, artigo e avatar (via CSS) */
  const THEMES = {

    uniasselvi: {
      label: "UNIASSELVI", brand: "UNIASSELVI", metaColor: "#111111",
      assistant: "Sofia", article: "a", institution: "uniasselvi"
    },
    unicesumar: {
      label: "UniCesumar", brand: "UNICESUMAR", metaColor: "#0876B9",
      assistant: "Edu", article: "o", institution: "unicesumar"
    }
  };

  const TYPING_DELAY = 900;
  const REWARD_POINTS = 50;

  function welcomeText() {
    return (
      `Oi! Eu sou ${assistantArticle()} ${assistantName()} 😊\n\n` +
      "Estou aqui para te ajudar com sua rotina de estudos, tirar dúvidas ou reorganizar seu tempo quando precisar.\n\n" +
      "Pode digitar ou tocar no microfone pra falar comigo. 🎙️"
    );
  }

  const QUICK_REPLIES = [
    { id: "plano", label: "📚 Plano de estudos" },
    { id: "duvidas", label: "❓ Dúvidas acadêmicas" },
    { id: "rotina", label: "🔄 Ajustar rotina" }
  ];

  const STUDY_PLAN = {
    course: "Qualidade e Testes de Software",
    slots: [
      { id: "ter", day: "Terça", when: "20:30 — 20 minutos", task: "Revisar conteúdo" },
      { id: "qui", day: "Quinta", when: "20:30 — 20 minutos", task: "Realizar atividade" }
    ]
  };

  /* Respostas demonstrativas por palavra-chave.
     TODO: conectar ao backend da Sofia (substituir por resposta do modelo). */
  const DEMO_REPLIES = [
    {
      keys: ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "hey"],
      text: "Oi! Que bom te ver por aqui 😊\nPosso te ajudar a montar seu plano de estudos em poucos minutos. Quer começar?"
    },
    {
      keys: ["como estudar", "nao sei estudar", "não sei estudar", "metodo", "método"],
      text: "Não importa quanto tempo você tem.\nVamos descobrir o que é possível fazer com ele. 💙\n\nComeçar com blocos de 20 minutos já gera resultado — o segredo é a constância, não a duração."
    },
    {
      keys: ["pouco tempo", "sem tempo", "tempo curto", "corrido", "ocupado"],
      text: "Entendo, e isso é mais comum do que parece.\n\nCom 15 a 20 minutos por dia já conseguimos montar uma rotina real. Vamos encontrar um horário que funcione para você."
    },
    {
      keys: ["nao consigo estudar hoje", "não consigo estudar hoje", "nao consegui", "não consegui", "cansado", "cansada"],
      text: "Tudo bem. 💙 Imprevistos acontecem.\n\nQuer que eu reorganize seu plano para você não acumular atividades?"
    },
    {
      keys: ["meu plano", "plano", "cronograma", "calendario", "calendário"],
      text: "Claro! Aqui está o seu plano de estudos 👇"
    },
    {
      keys: ["ajuda", "help", "o que voce faz", "o que você faz", "duvida", "dúvida"],
      text: "Posso te ajudar com três coisas:\n\n📚 Montar seu plano de estudos\n❓ Tirar dúvidas dos seus conteúdos\n🔄 Ajustar sua rotina quando o dia apertar\n\nPor onde você quer começar?"
    },
    {
      keys: ["obrigado", "obrigada", "valeu", "brigado"],
      text: "Eu que agradeço! 😊 Estou por aqui sempre que precisar."
    },
    {
      keys: ["prova", "trabalho", "atividade", "nota"],
      text: "Vamos organizar isso juntos! 📝\nMe conta a data de entrega e eu encaixo blocos de estudo nos dias que você tem livres."
    }
  ];

  function fallbackReply() {
    return (
      `Entendi! 😊\nEsta interface já está preparada para receber a resposta real d${assistantArticle()} ${assistantName()}.\n\n` +
      "Enquanto isso, posso montar seu plano de estudos, tirar dúvidas ou ajustar sua rotina."
    );
  }

  /* ---------------- Estado ---------------- */

  const state = {
    theme: "uniasselvi",
    messages: [],
    planShown: false,
    completedTasks: [],
    rewardPoints: 0,
    rewardShown: false,
    studyPlanChipTimer: null,
    isTyping: false,
    recording: {
      active: false,
      seconds: 0,
      timerId: null,
      stream: null,
      recorder: null,
      chunks: [],
      blob: null,
      url: null
    },
    preview: { audio: null, playing: false, tickId: null, fakeSeconds: 0 },
    voice: {
      session: null,
      activity: "idle",
      activeProfile: null,
      transcript: [],
      assistantDraft: "",
      clarificationContext: null,
      clarificationRounds: 0,
      clarificationBaselineUserCount: null,
      extractionInFlight: false,
      planningInFlight: false,
      weeklySchedule: null,
      routine: null,
      academicDecisions: { temporary_class_changes: [] },
      draftRow: null
    }
  };

  /* ---------------- Referências do DOM ---------------- */

  const el = {
    root: document.documentElement,
    metaThemeColor: document.getElementById("metaThemeColor"),
    shell: document.getElementById("chatShell"),
    thread: document.getElementById("thread"),
    headerTitle: document.querySelector(".header-title"),
    headerStatus: document.querySelector(".chat-header .header-status"),
    drawerName: document.querySelector(".drawer-name"),
    closedText: document.getElementById("closedText"),

    composer: document.getElementById("composer"),
    input: document.getElementById("composerInput"),
    sendBtn: document.getElementById("sendBtn"),
    attachBtn: document.getElementById("attachBtn"),
    fileInput: document.getElementById("fileInput"),
    micBtn: document.getElementById("micBtn"),
    micLabel: document.querySelector("#micBtn .talk-label"),

    recorder: document.getElementById("recorder"),
    recTimer: document.getElementById("recTimer"),
    cancelRecBtn: document.getElementById("cancelRecBtn"),
    stopRecBtn: document.getElementById("stopRecBtn"),

    audioPreview: document.getElementById("audioPreview"),
    previewPlayBtn: document.getElementById("previewPlayBtn"),
    previewWave: document.getElementById("previewWave"),
    previewTime: document.getElementById("previewTime"),
    discardAudioBtn: document.getElementById("discardAudioBtn"),
    sendAudioBtn: document.getElementById("sendAudioBtn"),

    brandBtn: document.getElementById("brandBtn"),
    brandMenu: document.getElementById("brandMenu"),
    optionsBtn: document.getElementById("optionsBtn"),
    optionsMenu: document.getElementById("optionsMenu"),

    menuBtn: document.getElementById("menuBtn"),
    drawer: document.getElementById("drawer"),
    drawerBackdrop: document.getElementById("drawerBackdrop"),
    drawerCloseBtn: document.getElementById("drawerCloseBtn"),
    drawerBrand: document.getElementById("drawerBrand"),
    drawerPoints: document.getElementById("drawerPoints"),

    closeBtn: document.getElementById("closeBtn"),
    closedScreen: document.getElementById("closedScreen"),
    reopenBtn: document.getElementById("reopenBtn"),

    toast: document.getElementById("toast")
  };

  /* ============================================================
     Utilidades
     ============================================================ */

  function nowTime() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function assistantName() {
    return THEMES[state.theme].assistant;
  }

  function assistantArticle() {
    return THEMES[state.theme].article;
  }

  function currentVoiceProfile() {
    return getAssistantVoiceProfile(THEMES[state.theme].institution);
  }

  function voiceIsActive() {
    return ["connecting", "listening", "thinking", "speaking"].includes(state.voice.activity);
  }

  function voiceStatusLabel(activity) {
    const name = state.voice.activeProfile?.assistantName || assistantName();
    const labels = {
      idle: `Falar com ${name}`,
      connecting: "Conectando voz...",
      listening: "Estou ouvindo...",
      thinking: `${name} está pensando...`,
      speaking: `${name} está falando...`,
      disconnected: "Voz desconectada",
      error: "Tentar voz novamente"
    };
    return labels[activity] || labels.idle;
  }

  function setVoiceActivity(activity, errorMessage) {
    state.voice.activity = activity;
    const listenBtn = document.getElementById("listenBtn");
    const running = ["connecting", "listening", "thinking", "speaking"].includes(activity);

    if (listenBtn) {
      listenBtn.dataset.voiceState = activity;
      listenBtn.classList.toggle("is-speaking", activity === "speaking");
      listenBtn.classList.toggle("is-listening", activity === "listening");
      listenBtn.classList.toggle("is-connecting", activity === "connecting" || activity === "thinking");
      const label = running ? "Parar" : voiceStatusLabel(activity);
      listenBtn.setAttribute("aria-label", label);
      const labelEl = listenBtn.querySelector(".listen-label");
      if (labelEl) labelEl.textContent = ` ${label}`;
    }

    if (el.micBtn) {
      el.micBtn.classList.toggle("mic-active", running);
      el.micBtn.setAttribute("aria-label", running ? "Encerrar conversa de voz" : voiceStatusLabel(activity));
      if (el.micLabel) el.micLabel.textContent = running ? "Parar" : "Falar";
    }

    if (el.headerStatus) {
      const statusText = running ? voiceStatusLabel(activity) : "Online";
      el.headerStatus.innerHTML = `<i class="dot-online" aria-hidden="true"></i>${statusText}`;
    }

    if (errorMessage && activity === "error") showToast(errorMessage);
  }

  function removeAssistantDraft() {
    if (state.voice.draftRow) state.voice.draftRow.remove();
    state.voice.draftRow = null;
    state.voice.assistantDraft = "";
  }

  function renderAssistantDraft(text) {
    state.voice.assistantDraft = text;
    if (!text) {
      removeAssistantDraft();
      return;
    }

    if (!state.voice.draftRow) {
      const row = document.createElement("div");
      row.className = "row row--in voice-draft";
      row.innerHTML = '<div class="bubble bubble--in"><span data-draft-text></span></div>';
      state.voice.draftRow = row;
      el.thread.appendChild(row);
    }
    const draftText = state.voice.draftRow.querySelector("[data-draft-text]");
    if (draftText) draftText.textContent = text;
    scrollToBottom();
  }

  function appendVoiceTranscript(entry) {
    state.voice.transcript.push(entry);
    if (entry.role === "assistant") removeAssistantDraft();
    addMessage({
      sender: entry.role === "assistant" ? "assistant" : "user",
      text: entry.text
    });
  }

  function userTranscriptCount() {
    return state.voice.transcript.filter((entry) => entry.role === "user").length;
  }

  function stopVoiceSession() {
    state.voice.session?.stop();
    state.voice.session = null;
    removeAssistantDraft();
    setVoiceActivity("idle");
  }

  async function startVoiceSession(clarificationContext) {
    if (voiceIsActive()) return state.voice.session;

    const profile = currentVoiceProfile();
    state.voice.activeProfile = profile;
    const session = new RealtimeVoiceSession({
      schedule: MOCK_SCHEDULE,
      institution: profile.institution,
      onTranscript: appendVoiceTranscript,
      onAssistantDraft: renderAssistantDraft,
      onStateChange: (activity) => {
        setVoiceActivity(activity, session.lastError);
      },
      onTechnicalEvent: (event) => {
        if (event && typeof event === "object" && event.type === "error") {
          showToast(event.error?.message || "A sessão de voz retornou um erro.");
        }
      },
      onCompleted: handleVoiceCompleted
    });
    state.voice.session = session;
    setVoiceActivity("connecting");

    try {
      await session.start({
        clarificationContext: clarificationContext || undefined,
        presentationAlreadyShown: !clarificationContext,
      });
      return session;
    } catch (error) {
      state.voice.session = null;
      setVoiceActivity("error", error instanceof Error ? error.message : "Não consegui iniciar a voz.");
      return null;
    }
  }

  function upcomingMonday() {
    const date = new Date();
    const day = date.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    date.setDate(date.getDate() + daysUntilMonday);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayOfMonth}`;
  }

  async function extractVoiceRoutine() {
    if (state.voice.extractionInFlight) return;
    state.voice.extractionInFlight = true;
    stopVoiceSession();
    addMessage({ sender: "assistant", text: "Vou organizar o que você contou para montar uma semana possível." });

    try {
      const httpResponse = await fetch("/api/routine/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_schedule: MOCK_SCHEDULE,
          transcript: [...state.voice.transcript]
        })
      });
      const data = await httpResponse.json().catch(() => ({}));
      if (!httpResponse.ok) throw new Error(data.details || data.error || "Não consegui organizar a rotina.");

      const parsed = routineExtractionResultSchema.parse(data);
      state.voice.routine = parsed.routine;
      state.voice.academicDecisions = parsed.academic_decisions;

      if (shouldClarifyRoutine(parsed.warnings, "voice", state.voice.clarificationRounds, parsed.routine)) {
        state.voice.clarificationRounds += 1;
        state.voice.clarificationBaselineUserCount = userTranscriptCount();
        state.voice.clarificationContext = buildRoutineClarificationContext(
          parsed.warnings,
          parsed.routine,
          state.voice.transcript.filter((entry) => entry.role === "user").map((entry) => entry.text)
        );
        addMessage({ sender: "assistant", text: "Ficou só um detalhe importante para eu confirmar antes de fechar a semana." });
        await startVoiceSession(state.voice.clarificationContext);
      } else {
        state.voice.clarificationContext = null;
        await generateVoiceSchedule();
      }
    } catch (error) {
      addMessage({
        sender: "assistant",
        text: `Não consegui organizar a rotina agora. ${error instanceof Error ? error.message : "Tente falar novamente."}`
      });
      setVoiceActivity("error");
    } finally {
      state.voice.extractionInFlight = false;
    }
  }

  async function generateVoiceSchedule() {
    if (state.voice.planningInFlight || !state.voice.routine) return;
    state.voice.planningInFlight = true;
    addMessage({ sender: "assistant", text: "Agora vou distribuir os blocos respeitando seus horários." });
    const planningAcademicSchedule = applyTemporaryClassChanges({
      ...MOCK_SCHEDULE,
      temporary_class_changes: state.voice.academicDecisions.temporary_class_changes
    });
    const requestBody = {
      academic_schedule: planningAcademicSchedule,
      routine: state.voice.routine,
      pedagogical_rules: {
        extra_study_minutes_per_class_hour: 30,
        description: "Reservar aproximadamente 30 minutos de estudo extraclasse para cada hora de aula."
      },
      week_start: upcomingMonday()
    };

    try {
      const httpResponse = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const data = await httpResponse.json().catch(() => ({}));
      if (!httpResponse.ok || !data.schedule) throw new Error(data.details || data.error || "Não consegui montar sua semana.");
      state.voice.weeklySchedule = validateWeeklySchedule(data.schedule, planningAcademicSchedule);
      addMessage({ sender: "assistant", text: "Pronto. Sua semana está organizada com os blocos que cabem na sua rotina." });
      showStudyPlan({ weeklySchedule: state.voice.weeklySchedule });
    } catch (error) {
      addMessage({ sender: "assistant", text: `A agenda não ficou disponível agora. ${error instanceof Error ? error.message : "Tente novamente."}` });
    } finally {
      state.voice.planningInFlight = false;
    }
  }

  function handleVoiceCompleted() {
    const baseline = state.voice.clarificationBaselineUserCount;
    if (baseline !== null && !clarificationAddedUserFacts(baseline, userTranscriptCount())) {
      state.voice.clarificationBaselineUserCount = null;
      state.voice.clarificationContext = null;
      stopVoiceSession();
      void generateVoiceSchedule();
      return;
    }
    void extractVoiceRoutine();
  }

  function formatClock(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(Math.floor(totalSeconds % 60)).padStart(2, "0");
    return `${m}:${s}`;
  }

  function normalize(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function uid() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      el.thread.scrollTop = el.thread.scrollHeight;
    });
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add("is-visible"));
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      el.toast.classList.remove("is-visible");
      setTimeout(() => { el.toast.hidden = true; }, 240);
    }, 2600);
  }

  function svgIcon(paths, extraAttrs) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" ${extraAttrs || ""}>${paths}</svg>`;
  }

  function buildWave(container, bars) {
    container.innerHTML = "";
    for (let i = 0; i < bars; i++) {
      const bar = document.createElement("i");
      const height = 6 + Math.abs(Math.sin(i * 1.35)) * 16;
      bar.style.height = height.toFixed(1) + "px";
      bar.style.animationDelay = (i * 0.045).toFixed(2) + "s";
      container.appendChild(bar);
    }
  }
  
  function toggleAiSpeaking() {
    if (voiceIsActive()) {
      stopVoiceSession();
      return;
    }
    void startVoiceSession(state.voice.clarificationContext);
  }

  /* ============================================================
     Persistência
     ============================================================ */

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch (err) {
      /* modo privado / storage bloqueado: segue sem persistir */
    }
  }

  function loadTheme() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEYS.theme);
    } catch (err) {
      stored = null;
    }
    changeTheme(THEMES[stored] ? stored : "uniasselvi");
  }

  function savePlannerState() {
    const payload = {
      course: STUDY_PLAN.course,
      planApproved: state.planShown,
      completedTasks: state.completedTasks,
      rewardPoints: state.rewardPoints
    };
    try {
      localStorage.setItem(STORAGE_KEYS.planner, JSON.stringify(payload));
    } catch (err) {
      /* ignora */
    }
  }

  function saveAcademicCalendarImport(schedule) {
    if (!schedule) return null;

    const payload = buildAcademicCalendarImport(schedule);
    if (payload.items.length === 0) return null;

    try {
      localStorage.setItem(ACADEMIC_CALENDAR_STORAGE_KEY, JSON.stringify(payload));
      return payload;
    } catch (err) {
      return null;
    }
  }

  function loadPlannerState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEYS.planner);
    } catch (err) {
      raw = null;
    }
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      state.rewardPoints = Number(data.rewardPoints) || 0;
    } catch (err) {
      /* dado inválido: começa do zero */
    }
    updatePointsBadge();
  }

  function updatePointsBadge() {
    el.drawerPoints.textContent = String(state.rewardPoints);
  }

  /* ============================================================
     Temas / identidade visual
     ============================================================ */

  function changeTheme(theme) {
    if (!THEMES[theme]) return;
    state.theme = theme;
    state.voice.activeProfile = currentVoiceProfile();
    el.root.setAttribute("data-theme", theme);
    el.metaThemeColor.setAttribute("content", THEMES[theme].metaColor);
    el.drawerBrand.textContent = THEMES[theme].brand;

    document.querySelectorAll(".brand-option").forEach((option) => {
      option.setAttribute("aria-checked", String(option.dataset.themeValue === theme));
    });

    applyAssistantIdentity();
    saveTheme(theme);
  }

  /* Nome da assistente em toda a interface. O avatar troca sozinho no CSS,
     que reage ao data-theme aplicado acima. */
  function applyAssistantIdentity() {
    const name = assistantName();
    const article = assistantArticle();
    const of = "d" + article; // "da Sofia" / "do Edu"

    el.headerTitle.textContent = `Converse com ${article} ${name}`;
    el.drawerName.textContent = name.toUpperCase();
    el.closedText.textContent = `Abra novamente para continuar com ${article} ${name}.`;
    el.reopenBtn.textContent = `Abrir ${name}`;

    document.title = `Converse com ${article} ${name}`;
    el.shell.setAttribute("aria-label", `Chat ${of} ${name}`);
    el.drawer.setAttribute("aria-label", `Menu ${of} ${name}`);
  }

  /* ============================================================
     Mensagens
     ============================================================ */

  function renderMessage(message) {
    const row = document.createElement("div");
    const assistantMessage = message.sender === "assistant" || message.sender === "sofia";
    row.className = "row " + (assistantMessage ? "row--in" : "row--out");
    row.dataset.id = message.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (assistantMessage ? "bubble--in" : "bubble--out") + (message.extraClass ? " " + message.extraClass : "");

    if (message.type === "audio") {
      bubble.appendChild(buildAudioBubble(message));
    } else {
      const textNode = document.createElement("span");
      textNode.textContent = message.text;
      bubble.appendChild(textNode);
    }

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = message.timestamp;
    bubble.appendChild(time);

    row.appendChild(bubble);
    el.thread.appendChild(row);
    scrollToBottom();
    return row;
  }

  function addMessage(message) {
    const full = Object.assign(
      { id: uid(), sender: "assistant", type: "text", timestamp: nowTime() },
      message
    );
    state.messages.push(full);
    return renderMessage(full);
  }

  function showTyping() {
    if (state.isTyping) return;
    state.isTyping = true;

    const row = document.createElement("div");
    row.className = "row row--in";
    row.id = "typingRow";
    row.innerHTML =
      `<div class="typing"><span>${assistantName()} está digitando</span>` +
      '<span class="typing-dots"><i></i><i></i><i></i></span></div>';
    el.thread.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    state.isTyping = false;
    const row = document.getElementById("typingRow");
    if (row) row.remove();
  }

  /**
   * Único ponto de entrada das respostas da Sofia.
   * TODO: conectar ao backend da Sofia — trocar o setTimeout por
   * fetch("/api/sofia", { ... }) e renderizar a resposta recebida.
   */
  function receiveMessage(text, options) {
    const config = options || {};
    showTyping();
    return new Promise((resolve) => {
      setTimeout(() => {
        hideTyping();
        if (text) addMessage({ sender: "assistant", text: text });
        if (typeof config.after === "function") config.after();
        resolve();
      }, config.delay || TYPING_DELAY);
    });
  }

  function sendMessage(rawText) {
    const text = (rawText === undefined ? el.input.value : rawText).trim();
    if (!text) return;

    hideQuickReplies();
    addMessage({ sender: "user", text: text });
    el.input.value = "";
    el.input.focus();

    if (voiceIsActive() && state.voice.session) {
      state.voice.transcript.push({ role: "user", text: text, timestamp: new Date().toISOString() });
      if (!state.voice.session.sendText(text)) {
        showToast("A voz ainda está conectando. Tente enviar novamente em instantes.");
      }
      return;
    }

    respondTo(text);
  }

  function respondTo(userText) {
    const normalized = normalize(userText);
    const match = DEMO_REPLIES.find((item) =>
      item.keys.some((key) => normalized.includes(normalize(key)))
    );

    if (match && match.keys.includes("meu plano")) {
      receiveMessage(match.text, { after: showStudyPlan });
      return;
    }

    if (match && match.keys.includes("nao consigo estudar hoje")) {
      receiveMessage(match.text, { after: showReplanOptions });
      return;
    }

    receiveMessage(match ? match.text : fallbackReply(), { after: suggestMainQuickReplies });
  }

  function suggestMainQuickReplies() {
    hideQuickReplies();
    showQuickReplies(QUICK_REPLIES, handleQuickReply);
  }

  /* ============================================================
     Quick replies
     ============================================================ */

  function showQuickReplies(items, onPick) {
    const wrap = document.createElement("div");
    wrap.className = "quick-replies";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Sugestões de resposta");

    items.forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = item.label;
      chip.addEventListener("click", () => {
        chip.classList.add("is-selected");
        wrap.classList.add("is-locked");
        // Mostra o destaque da escolha antes de trocar os chips pela resposta
        setTimeout(() => {
          hideQuickReplies(wrap);
          onPick(item, chip);
        }, 240);
      });
      wrap.appendChild(chip);
    });

    el.thread.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function hideQuickReplies(wrap) {
    const target = wrap || el.thread.querySelector(".quick-replies");
    if (target) target.remove();
  }

  function handleQuickReply(item) {
    addMessage({ sender: "user", text: item.label });

    if (voiceIsActive() && state.voice.session) {
      state.voice.transcript.push({ role: "user", text: item.label, timestamp: new Date().toISOString() });
      state.voice.session.sendText(item.label);
      return;
    }

    if (item.id === "plano" || item.id === "rotina") {
      void startVoiceSession();
      return;
    }

    if (item.id === "plano") {
      receiveMessage(
        "Claro! 😊 Vou te ajudar a montar uma rotina de estudos que realmente caiba no seu dia.",
        { after: showStudyPlan }
      );
      return;
    }

    if (item.id === "duvidas") {
      receiveMessage(
        `Pode mandar sua dúvida! 😊\nEsta interface já está preparada para receber a resposta real d${assistantArticle()} ${assistantName()}.`
      );
      return;
    }

    if (item.id === "rotina") {
      receiveMessage(
        "Vamos organizar seu tempo? 🗓️\nPodemos dividir seus estudos em blocos pequenos e possíveis.",
        { after: showReplanOptions }
      );
    }
  }

  function showReplanOptions() {
    showQuickReplies(
      [
        { id: "recalcular", label: "🔁 Recalcular meu plano" },
        { id: "amanha", label: "Deixar para amanhã" }
      ],
      (item) => {
        addMessage({ sender: "user", text: item.label });
        if (item.id === "recalcular") {
          receiveMessage("Prontinho! Reorganizei seus blocos para você não acumular atividades. 💙", {
            after: () => showStudyPlan({ recalculated: true })
          });
        } else {
          receiveMessage("Combinado. Amanhã eu te lembro, sem cobrança. 💙");
        }
      }
    );
  }

  /* ============================================================
     Card de plano de estudos
     ============================================================ */

  function planSlotsFromSchedule(schedule) {
    if (!schedule) return [];
    const dayLabels = {
      monday: "Segunda",
      tuesday: "Terça",
      wednesday: "Quarta",
      thursday: "Quinta",
      friday: "Sexta",
      saturday: "Sábado",
      sunday: "Domingo"
    };
    return schedule.days.flatMap((day) => day.items
      .filter((item) => item.type === "study" || item.type === "academic_activity")
      .map((item) => ({
        id: item.id,
        day: dayLabels[day.day_of_week] || day.day_of_week,
        when: `${item.start} — ${item.end}`,
        task: item.title
      })));
  }

  function showStudyPlan(options) {
    const config = options || {};
    const recalculated = Boolean(config.recalculated);
    const weeklySchedule = config.weeklySchedule || state.voice.weeklySchedule;

    state.planShown = true;
    state.completedTasks = [];
    state.rewardShown = false;
    savePlannerState();

    const slots = weeklySchedule && planSlotsFromSchedule(weeklySchedule).length > 0
      ? planSlotsFromSchedule(weeklySchedule)
      : recalculated
      ? [
          { id: "qua", day: "Quarta", when: "21:00 — 20 minutos", task: "Revisar conteúdo" },
          { id: "sab", day: "Sábado", when: "10:00 — 20 minutos", task: "Realizar atividade" }
        ]
      : STUDY_PLAN.slots;
    const courseTitle = weeklySchedule
      ? (MOCK_SCHEDULE.classes[0]?.name || STUDY_PLAN.course)
      : STUDY_PLAN.course;
    const planSubtitle = weeklySchedule
      ? `${weeklySchedule.summary.planned_extra_study_hours}h de estudo distribuídas na sua semana`
      : recalculated
        ? "Plano recalculado — sem acúmulo de atividades"
        : "Blocos curtos, no horário que funciona para você";

    const card = document.createElement("article");
    card.className = "card";
    card.setAttribute("aria-label", "Seu plano de estudos");

    const slotsHtml = slots
      .map(
        (slot) => `
        <div class="slot">
          <p class="slot-day">${slot.day}</p>
          <p class="slot-when">${slot.when}</p>
          <button type="button" class="task" data-task="${slot.id}" aria-pressed="false">
            <span class="task-box" aria-hidden="true">${svgIcon('<path d="m5 13 4 4L19 7"/>')}</span>
            <span class="task-label">${slot.task}</span>
          </button>
        </div>`
      )
      .join("");

    card.innerHTML = `
      <p class="card-kicker">🎯 Seu plano de estudos</p>
      <h2 class="card-title">${courseTitle}</h2>
      <p class="card-sub">${planSubtitle}</p>
      ${slotsHtml}
      <div class="progress-wrap">
        <p class="progress-label"><span data-progress-text>0 de ${slots.length}</span> tarefas concluídas.</p>
        <div class="progress-track" role="progressbar" aria-label="Progresso das tarefas" aria-valuemin="0" aria-valuemax="${slots.length}" aria-valuenow="0">
          <div class="progress-fill" data-progress-fill></div>
        </div>
      </div>
      <div class="card-actions">
        <button type="button" class="btn btn--accent" data-plan-action="calendar">
          ${svgIcon('<path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>')}
          <span data-plan-action-label>Atualizar calendário</span>
        </button>
        
      </div>
    `;

    const row = document.createElement("div");
    row.className = "row row--full";
    row.appendChild(card);
    el.thread.appendChild(row);

    card.querySelectorAll(".task").forEach((taskBtn) => {
      taskBtn.addEventListener("click", () => toggleTask(taskBtn, card, slots.length));
    });

    card.querySelectorAll("[data-plan-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.planAction === "calendar") {
          if (!weeklySchedule) {
            showToast("Gere sua semana completa antes de adicionar aulas ao calendário.");
            return;
          }

          const payload = saveAcademicCalendarImport(weeklySchedule);
          if (!payload) {
            showToast("Não consegui salvar as aulas no calendário desta sessão.");
            return;
          }

          const actionLabel = btn.querySelector("[data-plan-action-label]");
          if (actionLabel) {
            actionLabel.textContent = "Calendário atualizado";
            window.setTimeout(() => {
              if (actionLabel.isConnected) actionLabel.textContent = "Atualizar calendário";
            }, 1800);
          }
          btn.setAttribute("aria-pressed", "true");
          window.setTimeout(() => {
            if (btn.isConnected) btn.setAttribute("aria-pressed", "false");
          }, 1800);
          scrollToBottom();
          showToast(`${payload.items.length} compromisso(s) acadêmico(s) atualizado(s) no seu calendário ✅`);
        } else {
          showToast("Resumo do plano pronto para enviar 📲");
        }
      });
    });

    scrollToBottom();
    if (!weeklySchedule) {
      state.studyPlanChipTimer = setTimeout(() => {
        state.studyPlanChipTimer = null;
        showCannotStudyChip();
      }, 500);
    }
  }

  function showCannotStudyChip() {
    showQuickReplies([{ id: "nao-consegui", label: "Não consegui estudar hoje" }], (item) => {
      addMessage({ sender: "user", text: item.label });
      receiveMessage(
        "Tudo bem. 💙 Imprevistos acontecem.\n\nQuer que eu reorganize seu plano para você não acumular atividades?",
        { after: showReplanOptions }
      );
    });
  }

  function toggleTask(taskBtn, card, totalTasks) {
    const id = taskBtn.dataset.task;
    if (state.completedTasks.includes(id)) return;

    state.completedTasks.push(id);
    taskBtn.classList.add("is-done");
    taskBtn.setAttribute("aria-pressed", "true");

    updateProgress(card, totalTasks);
    savePlannerState();
    hideQuickReplies();
    if (state.studyPlanChipTimer) {
      clearTimeout(state.studyPlanChipTimer);
      state.studyPlanChipTimer = null;
    }

    if (state.completedTasks.length < totalTasks) return;

    if (!state.rewardShown) {
      state.rewardShown = true;
      setTimeout(() => showReward({ scroll: false }), 520);
    }
  }

  function updateProgress(card, totalTasks) {
    const done = state.completedTasks.length;
    const text = card.querySelector("[data-progress-text]");
    const fill = card.querySelector("[data-progress-fill]");
    const track = card.querySelector(".progress-track");

    if (text) text.textContent = `${done} de ${totalTasks}`;
    if (fill) fill.style.width = (done / totalTasks) * 100 + "%";
    if (track) track.setAttribute("aria-valuenow", String(done));
  }

  function showReward(options) {
    const config = options || {};
    state.rewardPoints += REWARD_POINTS;
    savePlannerState();
    updatePointsBadge();

    const row = document.createElement("div");
    row.className = "row row--full";
    row.innerHTML = `
      <section class="reward" aria-label="Recompensa desbloqueada">
        <div class="reward-emoji">🎉</div>
        <h2 class="reward-title">Parabéns!</h2>
        <p class="reward-text">Você concluiu seu bloco de estudos.</p>
        <span class="reward-badge">+${REWARD_POINTS} pontos</span>
        <p class="reward-foot">no programa de recompensas.</p>
      </section>
    `;
    el.thread.appendChild(row);
    if (config.scroll !== false) scrollToBottom();
  }

  /* ============================================================
     Áudio
     ============================================================ */

  function buildAudioBubble(message) {
    const wrap = document.createElement("span");
    wrap.className = "audio-bubble";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "play-btn";
    playBtn.setAttribute("aria-label", "Reproduzir áudio");
    playBtn.innerHTML =
      svgIcon('<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>', 'class="ic-play"') +
      svgIcon('<path d="M9 5.5v13M15 5.5v13"/>', 'class="ic-pause" hidden');

    const wave = document.createElement("span");
    wave.className = "wave";
    buildWave(wave, 22);

    const time = document.createElement("span");
    time.className = "audio-time";
    time.textContent = formatClock(message.duration || 0);

    let audio = null;
    if (message.audioUrl) {
      audio = new Audio(message.audioUrl);
    }
    let simTimer = null;

    function setPlayingUI(isPlaying) {
      playBtn.querySelector(".ic-play").hidden = isPlaying;
      playBtn.querySelector(".ic-pause").hidden = !isPlaying;
      wave.classList.toggle("is-playing", isPlaying);
      playBtn.setAttribute("aria-label", isPlaying ? "Pausar áudio" : "Reproduzir áudio");
    }

    function stopSimulation() {
      clearInterval(simTimer);
      simTimer = null;
      setPlayingUI(false);
      time.textContent = formatClock(message.duration || 0);
    }

    playBtn.addEventListener("click", () => {
      if (audio) {
        if (audio.paused) {
          audio.play().catch(() => {
            showToast("Não foi possível reproduzir o áudio neste navegador");
          });
          setPlayingUI(true);
        } else {
          audio.pause();
          setPlayingUI(false);
        }
        return;
      }

      // Sem blob real (permissão negada): reprodução demonstrativa.
      if (simTimer) {
        stopSimulation();
        return;
      }
      let elapsed = 0;
      setPlayingUI(true);
      simTimer = setInterval(() => {
        elapsed += 1;
        time.textContent = formatClock(elapsed);
        if (elapsed >= (message.duration || 8)) stopSimulation();
      }, 1000);
    });

    if (audio) {
      audio.addEventListener("timeupdate", () => {
        time.textContent = formatClock(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        setPlayingUI(false);
        time.textContent = formatClock(message.duration || 0);
      });
    }

    wrap.append(playBtn, wave, time);
    return wrap;
  }

  function setComposerState(view) {
    el.composer.hidden = view !== "composer";
    el.recorder.hidden = view !== "recorder";
    el.audioPreview.hidden = view !== "preview";
  }

  async function startRecording() {
    const rec = state.recording;
    rec.seconds = 0;
    rec.chunks = [];
    rec.blob = null;
    el.recTimer.textContent = "00:00";

    const canRecord =
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window.MediaRecorder === "function";

    if (canRecord) {
      try {
        rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec.recorder = new MediaRecorder(rec.stream);
        rec.recorder.addEventListener("dataavailable", (event) => {
          if (event.data && event.data.size > 0) rec.chunks.push(event.data);
        });
        rec.recorder.start();
      } catch (err) {
        showToast("Microfone indisponível — usando modo demonstração");
      }
    } else {
      showToast("Gravação não suportada — usando modo demonstração");
    }

    rec.active = true;
    setComposerState("recorder");
    el.micBtn.classList.add("mic-active");

    rec.timerId = setInterval(() => {
      rec.seconds += 1;
      el.recTimer.textContent = formatClock(rec.seconds);
    }, 1000);

    el.stopRecBtn.focus();
  }

  function releaseStream() {
    const rec = state.recording;
    if (rec.stream) {
      rec.stream.getTracks().forEach((track) => track.stop());
      rec.stream = null;
    }
    rec.recorder = null;
  }

  function stopRecording(options) {
    const config = options || {};
    const rec = state.recording;
    if (!rec.active) return;

    clearInterval(rec.timerId);
    rec.timerId = null;
    rec.active = false;
    el.micBtn.classList.remove("mic-active");

    const finish = () => {
      releaseStream();
      if (config.cancel) {
        discardAudio();
        return;
      }
      openAudioPreview();
    };

    if (rec.recorder && rec.recorder.state !== "inactive") {
      rec.recorder.addEventListener("stop", () => {
        if (!config.cancel && rec.chunks.length) {
          rec.blob = new Blob(rec.chunks, { type: rec.recorder.mimeType || "audio/webm" });
          rec.url = URL.createObjectURL(rec.blob);
        }
        finish();
      });
      rec.recorder.stop();
      return;
    }

    finish();
  }

  function openAudioPreview() {
    const rec = state.recording;
    const duration = Math.max(rec.seconds, 1);

    buildWave(el.previewWave, 26);
    el.previewTime.textContent = formatClock(duration);
    setComposerState("preview");

    state.preview.audio = rec.url ? new Audio(rec.url) : null;
    state.preview.playing = false;
    resetPreviewPlayUI();

    if (state.preview.audio) {
      state.preview.audio.addEventListener("timeupdate", () => {
        el.previewTime.textContent = formatClock(state.preview.audio.currentTime);
      });
      state.preview.audio.addEventListener("ended", () => {
        state.preview.playing = false;
        resetPreviewPlayUI();
        el.previewTime.textContent = formatClock(duration);
      });
    }

    el.sendAudioBtn.focus();
  }

  function resetPreviewPlayUI() {
    el.previewPlayBtn.querySelector(".ic-play").hidden = state.preview.playing;
    el.previewPlayBtn.querySelector(".ic-pause").hidden = !state.preview.playing;
    el.previewWave.classList.toggle("is-playing", state.preview.playing);
  }

  function togglePreviewPlay() {
    const duration = Math.max(state.recording.seconds, 1);

    if (state.preview.audio) {
      if (state.preview.audio.paused) {
        state.preview.audio.play().catch(() => showToast("Prévia indisponível neste navegador"));
        state.preview.playing = true;
      } else {
        state.preview.audio.pause();
        state.preview.playing = false;
      }
      resetPreviewPlayUI();
      return;
    }

    // Prévia demonstrativa quando não há áudio real.
    if (state.preview.tickId) {
      clearInterval(state.preview.tickId);
      state.preview.tickId = null;
      state.preview.playing = false;
      state.preview.fakeSeconds = 0;
      el.previewTime.textContent = formatClock(duration);
      resetPreviewPlayUI();
      return;
    }

    state.preview.playing = true;
    state.preview.fakeSeconds = 0;
    resetPreviewPlayUI();
    state.preview.tickId = setInterval(() => {
      state.preview.fakeSeconds += 1;
      el.previewTime.textContent = formatClock(state.preview.fakeSeconds);
      if (state.preview.fakeSeconds >= duration) {
        clearInterval(state.preview.tickId);
        state.preview.tickId = null;
        state.preview.playing = false;
        el.previewTime.textContent = formatClock(duration);
        resetPreviewPlayUI();
      }
    }, 1000);
  }

  function stopPreviewPlayback() {
    if (state.preview.audio) {
      state.preview.audio.pause();
      state.preview.audio = null;
    }
    if (state.preview.tickId) {
      clearInterval(state.preview.tickId);
      state.preview.tickId = null;
    }
    state.preview.playing = false;
  }

  function discardAudio() {
    stopPreviewPlayback();
    const rec = state.recording;
    if (rec.url) {
      URL.revokeObjectURL(rec.url);
      rec.url = null;
    }
    rec.blob = null;
    rec.chunks = [];
    rec.seconds = 0;
    setComposerState("composer");
    el.input.focus();
  }

  function sendAudio() {
    stopPreviewPlayback();
    const rec = state.recording;
    const duration = Math.max(rec.seconds, 1);
    const audioUrl = rec.url;

    addMessage({
      sender: "user",
      type: "audio",
      text: `🎙️ Áudio enviado • ${formatClock(duration)}`,
      duration: duration,
      audioUrl: audioUrl
    });

    rec.url = null;
    rec.chunks = [];
    setComposerState("composer");

    // TODO: conectar ao backend da Sofia (enviar o blob para transcrição)
    receiveMessage(
      "Recebi seu áudio! 🎧\nJá consigo entender o que você precisa — quando a transcrição estiver ligada, respondo exatamente sobre o que você falou."
    );
  }

  /* ============================================================
     Drawer, popovers e chat fechado
     ============================================================ */

  function setDrawer(open) {
    el.drawer.hidden = !open;
    el.drawerBackdrop.hidden = !open;
    el.menuBtn.setAttribute("aria-expanded", String(open));
    if (open) el.drawerCloseBtn.focus();
    else el.menuBtn.focus();
  }

  function closeAllPopovers() {
    [
      [el.brandMenu, el.brandBtn],
      [el.optionsMenu, el.optionsBtn]
    ].forEach(([menu, button]) => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    });
  }

  function togglePopover(menu, button) {
    const willOpen = menu.hidden;
    closeAllPopovers();
    menu.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  }

  function startConversation() {
    if (state.voice.session) stopVoiceSession();
    el.thread.innerHTML = "";
    state.messages = [];
    state.planShown = false;
    state.completedTasks = [];
    state.rewardShown = false;
    state.voice.transcript = [];
    state.voice.activeProfile = currentVoiceProfile();
    state.voice.clarificationContext = null;
    state.voice.clarificationRounds = 0;
    state.voice.clarificationBaselineUserCount = null;
    state.voice.extractionInFlight = false;
    state.voice.planningInFlight = false;
    state.voice.weeklySchedule = null;
    state.voice.routine = null;
    state.voice.academicDecisions = { temporary_class_changes: [] };

    addMessage({ sender: "assistant", text: welcomeText(), extraClass: "bubble--rounded" });
    const voiceRow = document.createElement("div");
      voiceRow.className = "row row--in";
       const listenLabel = `Falar com ${assistantArticle()} ${assistantName()}`;
voiceRow.innerHTML = `<button type="button" class="listen-btn" id="listenBtn" aria-label="${listenLabel}">
  <span class="listen-orb" aria-hidden="true">
    <span class="orb-dot"></span>
    <span class="orb-dot"></span>
    <span class="orb-dot"></span>
  </span>
  <span class="listen-label"> ${listenLabel}</span>
</button>`;
          el.thread.appendChild(voiceRow);
            document.getElementById("listenBtn").addEventListener("click", toggleAiSpeaking);
     setVoiceActivity("idle");
     setTimeout(() => showQuickReplies(QUICK_REPLIES, handleQuickReply), 380);
  }

  /* ============================================================
     Eventos
     ============================================================ */

  function bindEvents() {
    el.composer.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage();
    });

    el.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    el.attachBtn.addEventListener("click", () => el.fileInput.click());
    el.fileInput.addEventListener("change", () => {
      const file = el.fileInput.files && el.fileInput.files[0];
      if (!file) return;
      addMessage({ sender: "user", text: `📎 ${file.name}` });
      el.fileInput.value = "";
      // TODO: conectar ao backend da Sofia (upload do material)
      receiveMessage("Recebi seu arquivo! 📎\nEm breve vou conseguir analisar o conteúdo e sugerir um plano com base nele.");
    });

    el.micBtn.addEventListener("click", toggleAiSpeaking);
    el.stopRecBtn.addEventListener("click", () => stopRecording());
    el.cancelRecBtn.addEventListener("click", () => stopRecording({ cancel: true }));

    el.previewPlayBtn.addEventListener("click", togglePreviewPlay);
    el.discardAudioBtn.addEventListener("click", discardAudio);
    el.sendAudioBtn.addEventListener("click", sendAudio);

    el.brandBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePopover(el.brandMenu, el.brandBtn);
    });
    el.optionsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePopover(el.optionsMenu, el.optionsBtn);
    });

    document.querySelectorAll(".brand-option").forEach((option) => {
      option.addEventListener("click", () => {
        if (voiceIsActive()) {
          closeAllPopovers();
          showToast("Finalize a conversa de voz antes de trocar de instituição.");
          return;
        }
        changeTheme(option.dataset.themeValue);
        closeAllPopovers();
        showToast(`Identidade visual: ${THEMES[state.theme].label}`);

        // Conversa ainda não começou: refaz a saudação com o novo nome
        if (!state.messages.some((message) => message.sender === "user")) {
          startConversation();
        }
      });
    });

    el.optionsMenu.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      closeAllPopovers();

      if (action.dataset.action === "restart") {
        startConversation();
        showToast("Conversa reiniciada");
      } else if (action.dataset.action === "plan") {
        if (state.voice.weeklySchedule) showStudyPlan({ weeklySchedule: state.voice.weeklySchedule });
        else void startVoiceSession();
      } else if (action.dataset.action === "reset-points") {
        state.rewardPoints = 0;
        savePlannerState();
        updatePointsBadge();
        showToast("Pontos zerados");
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".brand-picker")) closeAllPopovers();
    });

    el.menuBtn.addEventListener("click", () => setDrawer(true));
    el.drawerCloseBtn.addEventListener("click", () => setDrawer(false));
    el.drawerBackdrop.addEventListener("click", () => setDrawer(false));

    document.querySelectorAll("[data-shortcut]").forEach((shortcut) => {
      shortcut.addEventListener("click", () => {
        setDrawer(false);
        hideQuickReplies();
        const id = shortcut.dataset.shortcut;
        const item = QUICK_REPLIES.find((qr) => qr.id === id);
        if (item) handleQuickReply(item);
      });
    });

    el.closeBtn.addEventListener("click", () => {
      if (state.voice.session) stopVoiceSession();
      closeAllPopovers();
      setDrawer(false);
      el.closedScreen.hidden = false;
      el.shell.setAttribute("aria-hidden", "true");
      el.reopenBtn.focus();
    });

    el.reopenBtn.addEventListener("click", () => {
      el.closedScreen.hidden = true;
      el.shell.removeAttribute("aria-hidden");
      el.input.focus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!el.brandMenu.hidden || !el.optionsMenu.hidden) closeAllPopovers();
      else if (!el.drawer.hidden) setDrawer(false);
      else if (state.recording.active) stopRecording({ cancel: true });
    });
  }

  /* ============================================================
     Init
     ============================================================ */

  function init() {
    loadTheme();
    loadPlannerState();
    bindEvents();
    setComposerState("composer");
    startConversation();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
