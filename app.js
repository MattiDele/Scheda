const DAYS = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

const SCREENS = ["plans", "detail", "stats", "settings"];
const STORAGE_KEY = "planner-fragments-v5";

let state = loadState();
let selectedPlanId = state.selectedPlanId;
let selectedDay = state.selectedDay;
let currentScreen = state.currentScreen;
let editingPlanId = null;
let editingExerciseId = null;
let draftSets = [];
let timerIntervalId = null;
let didNotifyTimerEnd = false;

const dom = {
  body: document.body,

  screens: {
    plans: document.getElementById("plansScreen"),
    detail: document.getElementById("detailScreen"),
    stats: document.getElementById("statsScreen"),
    settings: document.getElementById("settingsScreen"),
  },

  navButtons: [...document.querySelectorAll(".nav-btn")],
  themeButtons: [...document.querySelectorAll(".theme-btn[data-theme-value]")],
  timerPresetButtons: [...document.querySelectorAll(".timer-preset-btn")],

  topbarSubtitle: document.getElementById("topbarSubtitle"),
  topbarTimerChip: document.getElementById("topbarTimerChip"),

  heroPlansCount: document.getElementById("heroPlansCount"),
  heroSelectedPlan: document.getElementById("heroSelectedPlan"),
  heroSelectedPlanSub: document.getElementById("heroSelectedPlanSub"),
  heroActiveDays: document.getElementById("heroActiveDays"),
  heroTimerValue: document.getElementById("heroTimerValue"),
  plansGrid: document.getElementById("plansGrid"),

  detailPlanTitle: document.getElementById("detailPlanTitle"),
  detailPlanSubtitle: document.getElementById("detailPlanSubtitle"),
  detailStatsGrid: document.getElementById("detailStatsGrid"),
  selectedDayTitle: document.getElementById("selectedDayTitle"),
  selectedDaySubtitle: document.getElementById("selectedDaySubtitle"),
  daysTabs: document.getElementById("daysTabs"),
  daySectionsPreview: document.getElementById("daySectionsPreview"),
  dayProgressValue: document.getElementById("dayProgressValue"),
  dayProgressText: document.getElementById("dayProgressText"),
  dayProgressBar: document.getElementById("dayProgressBar"),
  exerciseList: document.getElementById("exerciseList"),
  miniTimerChip: document.getElementById("miniTimerChip"),
  toggleAllSetsBtn: document.getElementById("toggleAllSetsBtn"),

  statsScreenSubtitle: document.getElementById("statsScreenSubtitle"),
  statsPrimaryGrid: document.getElementById("statsPrimaryGrid"),
  statsSecondaryColumn: document.getElementById("statsSecondaryColumn"),

  compactToggle: document.getElementById("compactToggle"),

  timerDock: document.getElementById("timerDock"),
  timerDockValue: document.getElementById("timerDockValue"),
  timerDockText: document.getElementById("timerDockText"),

  planModalBackdrop: document.getElementById("planModalBackdrop"),
  planModalTitle: document.getElementById("planModalTitle"),
  planForm: document.getElementById("planForm"),
  planNameInput: document.getElementById("planNameInput"),
  planDaysGrid: document.getElementById("planDaysGrid"),
  planErrorText: document.getElementById("planErrorText"),

  exerciseModalBackdrop: document.getElementById("exerciseModalBackdrop"),
  exerciseModalTitle: document.getElementById("exerciseModalTitle"),
  exerciseForm: document.getElementById("exerciseForm"),
  exerciseNameInput: document.getElementById("exerciseNameInput"),
  exerciseSectionInput: document.getElementById("exerciseSectionInput"),
  exerciseWeightInput: document.getElementById("exerciseWeightInput"),
  exerciseRecoveryInput: document.getElementById("exerciseRecoveryInput"),
  exerciseLinkInput: document.getElementById("exerciseLinkInput"),
  setsEditor: document.getElementById("setsEditor"),
  addSetBtn: document.getElementById("addSetBtn"),
  fillPresetSetsBtn: document.getElementById("fillPresetSetsBtn"),
  exercisePreview: document.getElementById("exercisePreview"),
  exerciseNotesInput: document.getElementById("exerciseNotesInput"),
  sectionSuggestions: document.getElementById("sectionSuggestions"),
};

bindEvents();
renderApp();
startTimerLoop();

function bindEvents() {
  document.getElementById("newPlanTopBtn").addEventListener("click", openCreatePlanModal);
  document.getElementById("plansHeroCreateBtn").addEventListener("click", openCreatePlanModal);

  document.getElementById("newExerciseTopBtn").addEventListener("click", () => {
    if (!getSelectedPlan()) {
      currentScreen = "plans";
      renderApp();
      return;
    }
    currentScreen = "detail";
    renderScreens();
    openCreateExerciseModal();
  });

  document.getElementById("newExerciseBtn").addEventListener("click", openCreateExerciseModal);

  document.getElementById("editPlanBtn").addEventListener("click", () => {
    const plan = getSelectedPlan();
    if (plan) openEditPlanModal(plan.id);
  });

  dom.toggleAllSetsBtn.addEventListener("click", toggleAllSetsForDay);

  dom.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextScreen = button.dataset.screen;
      if (nextScreen === "detail" && !getSelectedPlan()) {
        currentScreen = "plans";
      } else {
        currentScreen = nextScreen;
      }
      renderApp();
    });
  });

  dom.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.theme = button.dataset.themeValue;
      applySettings();
      saveState();
      renderSettingsScreen();
    });
  });

  dom.timerPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.timerSeconds = Number(button.dataset.timerValue);
      if (!timerIsRunning()) {
        state.timer.durationSeconds = state.settings.timerSeconds;
      }
      saveState();
      renderSettingsScreen();
      renderTimer();
    });
  });

  dom.compactToggle.addEventListener("click", () => {
    state.settings.compact = !state.settings.compact;
    applySettings();
    saveState();
    renderSettingsScreen();
  });

  document.getElementById("restartTimerBtn").addEventListener("click", () => {
    startRecoveryTimer(state.settings.timerSeconds);
    renderTimer();
  });

  document.getElementById("resetTimerBtn").addEventListener("click", () => {
    resetTimer();
    renderTimer();
  });

  document.getElementById("closePlanModalBtn").addEventListener("click", closePlanModal);
  document.getElementById("cancelPlanModalBtn").addEventListener("click", closePlanModal);
  dom.planModalBackdrop.addEventListener("click", (event) => {
    if (event.target === dom.planModalBackdrop) closePlanModal();
  });
  dom.planForm.addEventListener("submit", savePlanFromForm);

  document.getElementById("closeExerciseModalBtn").addEventListener("click", closeExerciseModal);
  document.getElementById("cancelExerciseModalBtn").addEventListener("click", closeExerciseModal);
  dom.exerciseModalBackdrop.addEventListener("click", (event) => {
    if (event.target === dom.exerciseModalBackdrop) closeExerciseModal();
  });
  dom.exerciseForm.addEventListener("submit", saveExerciseFromForm);

  dom.addSetBtn.addEventListener("click", () => {
    draftSets.push(createDraftSet(10));
    renderSetsEditor();
    renderExercisePreview();
  });

  dom.fillPresetSetsBtn.addEventListener("click", () => {
    draftSets = [10, 10, 10, 10].map((reps) => createDraftSet(reps));
    renderSetsEditor();
    renderExercisePreview();
  });

  document.addEventListener("visibilitychange", renderTimer);
  window.addEventListener("focus", renderTimer);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initialPlan = createPlan("Scheda base", ["Lunedì", "Mercoledì", "Venerdì"]);
      return {
        plans: [initialPlan],
        selectedPlanId: initialPlan.id,
        selectedDay: initialPlan.activeDays[0],
        currentScreen: "plans",
        timer: createDefaultTimerState(),
        settings: createDefaultSettings(),
      };
    }

    const parsed = JSON.parse(raw);
    const plans = Array.isArray(parsed.plans) && parsed.plans.length
      ? parsed.plans.map(sanitizePlan)
      : [createPlan("Scheda base", ["Lunedì", "Mercoledì", "Venerdì"])];

    const selectedPlanId = plans.some((plan) => plan.id === parsed.selectedPlanId)
      ? parsed.selectedPlanId
      : plans[0].id;

    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0];
    const activeDays = getActiveDays(selectedPlan);
    const selectedDay = activeDays.includes(parsed.selectedDay)
      ? parsed.selectedDay
      : activeDays[0];

    return {
      plans,
      selectedPlanId,
      selectedDay,
      currentScreen: SCREENS.includes(parsed.currentScreen) ? parsed.currentScreen : "plans",
      timer: sanitizeTimerState(parsed.timer),
      settings: sanitizeSettings(parsed.settings),
    };
  } catch {
    const initialPlan = createPlan("Scheda base", ["Lunedì", "Mercoledì", "Venerdì"]);
    return {
      plans: [initialPlan],
      selectedPlanId: initialPlan.id,
      selectedDay: initialPlan.activeDays[0],
      currentScreen: "plans",
      timer: createDefaultTimerState(),
      settings: createDefaultSettings(),
    };
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      plans: state.plans,
      selectedPlanId,
      selectedDay,
      currentScreen,
      timer: state.timer,
      settings: state.settings,
    })
  );
}

function createDefaultSettings() {
  return {
    theme: "midnight",
    compact: false,
    timerSeconds: 150,
  };
}

function sanitizeSettings(settings) {
  return {
    theme: ["midnight", "light", "sunset"].includes(settings?.theme) ? settings.theme : "midnight",
    compact: Boolean(settings?.compact),
    timerSeconds: [120, 150, 180].includes(settings?.timerSeconds) ? settings.timerSeconds : 150,
  };
}

function createDefaultTimerState() {
  return {
    running: false,
    endAt: null,
    durationSeconds: 150,
    lastFinishedAt: null,
  };
}

function sanitizeTimerState(timer) {
  return {
    running: Boolean(timer?.running),
    endAt: Number.isFinite(timer?.endAt) ? timer.endAt : null,
    durationSeconds: Number.isFinite(timer?.durationSeconds) ? timer.durationSeconds : 150,
    lastFinishedAt: Number.isFinite(timer?.lastFinishedAt) ? timer.lastFinishedAt : null,
  };
}

function uid() {
  return crypto.randomUUID();
}

function defaultWeek() {
  return Object.fromEntries(DAYS.map((day) => [day, { exercises: [] }]));
}

function createPlan(name = "Nuova scheda", activeDays = ["Lunedì", "Mercoledì", "Venerdì"]) {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    activeDays,
    week: defaultWeek(),
  };
}

function sanitizePlan(plan) {
  const safeWeek = defaultWeek();

  for (const day of DAYS) {
    const rawExercises = Array.isArray(plan?.week?.[day]?.exercises) ? plan.week[day].exercises : [];
    const exercises = rawExercises.map(sanitizeExercise).sort((a, b) => a.order - b.order);
    safeWeek[day] = { exercises };
  }

  const activeDays = Array.isArray(plan?.activeDays)
    ? plan.activeDays.filter((day) => DAYS.includes(day))
    : [];

  return {
    id: plan?.id || uid(),
    name: String(plan?.name || "Scheda").trim() || "Scheda",
    createdAt: Number.isFinite(plan?.createdAt) ? plan.createdAt : Date.now(),
    activeDays: activeDays.length ? activeDays : ["Lunedì"],
    week: safeWeek,
  };
}

function sanitizeExercise(exercise) {
  const fallbackSets = [createSet(10), createSet(10), createSet(10), createSet(10)];

  const sets = Array.isArray(exercise?.sets) && exercise.sets.length
    ? exercise.sets.map((set) => ({
        id: set?.id || uid(),
        reps: normalizeInteger(set?.reps, 1, 60, 10),
        done: Boolean(set?.done),
      }))
    : fallbackSets;

  return {
    id: exercise?.id || uid(),
    name: String(exercise?.name || "Esercizio").trim() || "Esercizio",
    section: String(exercise?.section || "").trim(),
    weight: normalizeWeight(exercise?.weight),
    recoverySeconds: normalizeOptionalRecovery(exercise?.recoverySeconds),
    link: String(exercise?.link || exercise?.tiktokUrl || "").trim(),
    notes: String(exercise?.notes || "").trim(),
    order: Number.isFinite(exercise?.order) ? exercise.order : 0,
    sets,
  };
}

function createSet(reps = 10) {
  return {
    id: uid(),
    reps: normalizeInteger(reps, 1, 60, 10),
    done: false,
  };
}

function createDraftSet(reps = 10) {
  return {
    id: uid(),
    reps: normalizeInteger(reps, 1, 60, 10),
    done: false,
  };
}

function normalizeOptionalRecovery(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function applySettings() {
  dom.body.dataset.theme = state.settings.theme;
  dom.body.dataset.compact = state.settings.compact ? "true" : "false";
}

function ensureSelection() {
  if (!state.plans.length) {
    const fallbackPlan = createPlan("Scheda base", ["Lunedì", "Mercoledì", "Venerdì"]);
    state.plans = [fallbackPlan];
    selectedPlanId = fallbackPlan.id;
    selectedDay = fallbackPlan.activeDays[0];
  }

  if (!state.plans.some((plan) => plan.id === selectedPlanId)) {
    selectedPlanId = state.plans[0].id;
  }

  const selectedPlan = getSelectedPlan();
  const activeDays = getActiveDays(selectedPlan);

  if (!activeDays.includes(selectedDay)) {
    selectedDay = activeDays[0];
  }

  if (!SCREENS.includes(currentScreen)) {
    currentScreen = "plans";
  }
}

function getSelectedPlan() {
  return state.plans.find((plan) => plan.id === selectedPlanId) || state.plans[0] || null;
}

function getActiveDays(plan) {
  if (!plan) return ["Lunedì"];
  return Array.isArray(plan.activeDays) && plan.activeDays.length
    ? plan.activeDays.filter((day) => DAYS.includes(day))
    : ["Lunedì"];
}

function getSelectedDayExercises(plan = getSelectedPlan()) {
  return [...(plan?.week?.[selectedDay]?.exercises || [])].sort((a, b) => a.order - b.order);
}

function renderApp() {
  ensureSelection();
  applySettings();
  saveState();
  renderScreens();
  renderTopbar();
  renderPlansScreen();
  renderDetailScreen();
  renderStatsScreen();
  renderSettingsScreen();
  renderTimer();
}

function renderScreens() {
  Object.entries(dom.screens).forEach(([key, screen]) => {
    screen.classList.toggle("hidden", key !== currentScreen);
  });

  dom.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === currentScreen);
  });
}

function renderTopbar() {
  const plan = getSelectedPlan();
  dom.topbarSubtitle.textContent = plan
    ? `${plan.name} · ${getActiveDays(plan).length} giorni attivi`
    : "Crea una scheda per iniziare.";
}

function renderPlansScreen() {
  const plan = getSelectedPlan();
  dom.heroPlansCount.textContent = String(state.plans.length);
  dom.heroSelectedPlan.textContent = plan ? plan.name : "—";
  dom.heroSelectedPlanSub.textContent = plan
    ? `${countConfiguredDays(plan)} giorni già compilati`
    : "Apri una scheda per iniziare";
  dom.heroActiveDays.textContent = plan ? String(getActiveDays(plan).length) : "0";

  if (!state.plans.length) {
    dom.plansGrid.innerHTML = emptyStateMarkup(
      "Nessuna scheda ancora",
      "Crea la prima scheda e poi entra dentro per organizzare giorni, sezioni ed esercizi."
    );
    return;
  }

  dom.plansGrid.innerHTML = state.plans.map((planItem) => {
    const metrics = getPlanMetrics(planItem);
    const isActive = planItem.id === selectedPlanId;

    return `
      <article class="plan-card ${isActive ? "active" : ""}">
        <div class="plan-top">
          <div>
            <h4 class="plan-title">${escapeHtml(planItem.name)}</h4>
            <p class="metric-sub">Creata ${formatRelativeDays(planItem.createdAt)}</p>
          </div>
          <span class="fragment-chip">${getActiveDays(planItem).length} giorni</span>
        </div>

        <div class="plan-tags">
          <span class="tag">${metrics.totalExercises} esercizi</span>
          <span class="tag">${metrics.completedSets}/${metrics.totalSets} serie</span>
          <span class="tag">${countConfiguredDays(planItem)} giorni compilati</span>
        </div>

        <div class="plan-days">
          ${getActiveDays(planItem).map((day) => `<span class="day-mini">${escapeHtml(shortDay(day))}</span>`).join("")}
        </div>

        <div class="card-actions">
          <button class="btn btn-primary" data-action="open-plan" data-plan-id="${planItem.id}">Apri</button>
          <button class="btn btn-soft" data-action="edit-plan" data-plan-id="${planItem.id}">Modifica</button>
          <button class="exercise-action danger" data-action="delete-plan" data-plan-id="${planItem.id}">Elimina</button>
        </div>
      </article>
    `;
  }).join("");

  dom.plansGrid.querySelectorAll("[data-action='open-plan']").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPlanId = button.dataset.planId;
      selectedDay = getActiveDays(getSelectedPlan())[0];
      currentScreen = "detail";
      renderApp();
    });
  });

  dom.plansGrid.querySelectorAll("[data-action='edit-plan']").forEach((button) => {
    button.addEventListener("click", () => openEditPlanModal(button.dataset.planId));
  });

  dom.plansGrid.querySelectorAll("[data-action='delete-plan']").forEach((button) => {
    button.addEventListener("click", () => deletePlan(button.dataset.planId));
  });
}

function renderDetailScreen() {
  const plan = getSelectedPlan();
  if (!plan) return;

  const planMetrics = getPlanMetrics(plan);
  const dayMetrics = getDayMetrics(plan, selectedDay);
  const activeDays = getActiveDays(plan);

  dom.detailPlanTitle.textContent = plan.name;
  dom.detailPlanSubtitle.textContent = `${activeDays.length} giorni attivi · usata da ${daysSince(plan.createdAt)} giorni`;

  dom.detailStatsGrid.innerHTML = [
    renderMetricCard("Giorni allenati", String(activeDays.length), activeDays.map(shortDay).join(" · ")),
    renderMetricCard("Da quanto tempo", `${daysSince(plan.createdAt)} giorni`, "Dalla creazione della scheda"),
    renderMetricCard("Esercizi totali", String(planMetrics.totalExercises), `${countConfiguredDays(plan)} giorni compilati`),
    renderMetricCard("Serie completate", `${planMetrics.completedSets}/${planMetrics.totalSets}`, "Avanzamento totale"),
  ].join("");

  dom.selectedDayTitle.textContent = selectedDay;
  dom.selectedDaySubtitle.textContent = `${plan.name} · ${dayMetrics.totalExercises} esercizi nel giorno`;

  renderDaysTabs(plan);
  renderDaySectionsPreview(plan);
  renderDayProgress(dayMetrics);
  renderExerciseList(plan);
  refreshToggleAllLabel(plan);
}

function renderDaysTabs(plan) {
  dom.daysTabs.innerHTML = "";

  getActiveDays(plan).forEach((day) => {
    const button = document.createElement("button");
    button.className = `day-tab ${day === selectedDay ? "active" : ""}`;
    button.textContent = day;
    button.addEventListener("click", () => {
      selectedDay = day;
      renderApp();
    });
    dom.daysTabs.appendChild(button);
  });
}

function renderDaySectionsPreview(plan) {
  const sections = getSectionsForDay(plan, selectedDay);
  dom.daySectionsPreview.innerHTML = sections.length
    ? sections.map((section) => `<span class="fragment-chip">${escapeHtml(section)}</span>`).join("")
    : `<span class="fragment-chip">Senza sezioni</span>`;
}

function renderDayProgress(dayMetrics) {
  const progress = percent(dayMetrics.completedSets, dayMetrics.totalSets);
  dom.dayProgressValue.textContent = `${progress}%`;
  dom.dayProgressText.textContent = `${dayMetrics.completedSets} serie completate su ${dayMetrics.totalSets}`;
  dom.dayProgressBar.style.width = `${progress}%`;
}

function renderExerciseList(plan) {
  const exercises = getSelectedDayExercises(plan);

  if (!exercises.length) {
    dom.exerciseList.innerHTML = emptyStateMarkup(
      "Nessun esercizio in questo giorno",
      "Aggiungi esercizi, assegna una sezione e scegli l'ordine con i pulsanti su e giù."
    );
    return;
  }

  const groups = groupExercisesBySection(exercises);

  dom.exerciseList.innerHTML = groups.map((group, index) => {
    const sectionTitle = group.section || "Senza sezione";
    const dividerStyle = index === 0
      ? "margin-top:0; padding-top:0; border-top:none;"
      : "margin-top:16px; padding-top:18px; border-top:1px solid var(--line);";

    const header = `
      <div style="${dividerStyle}">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
          <div class="eyebrow">${escapeHtml(sectionTitle)}</div>
          <span class="metric-sub">${group.exercises.length} esercizi</span>
        </div>
      </div>
    `;

    const cards = group.exercises.map((exercise) => renderExerciseCard(exercise, exercises.length)).join("");
    return `${header}${cards}`;
  }).join("");

  attachExerciseListEvents();
}

function renderExerciseCard(exercise, totalExercises) {
  const isComplete = isExerciseComplete(exercise);
  const hasLink = Boolean(exercise.link);
  const recoveryText = exercise.recoverySeconds
    ? formatTime(exercise.recoverySeconds)
    : `Globale ${formatTime(state.settings.timerSeconds)}`;
  const repsText = exercise.sets.map((set) => set.reps).join(" / ");

  return `
    <article class="exercise-card ${isComplete ? "done" : ""}" data-exercise-id="${exercise.id}">
      <div class="exercise-head">
        <div class="exercise-main">
          <div class="exercise-title-row">
            <h4 class="exercise-title">${escapeHtml(exercise.name)}</h4>
            <span class="exercise-pill">${exercise.sets.length} serie</span>
            <span class="exercise-pill">${escapeHtml(repsText)} reps</span>
            <span class="exercise-pill">${exercise.weight ? `${escapeHtml(exercise.weight)} kg` : "Peso libero"}</span>
            <span class="exercise-pill">Rec. ${escapeHtml(recoveryText)}</span>
          </div>

          <div class="exercise-sets">
            ${exercise.sets.map((set, index) => `
              <label class="set-chip">
                <input
                  type="checkbox"
                  class="set-toggle"
                  data-exercise-id="${exercise.id}"
                  data-set-id="${set.id}"
                  ${set.done ? "checked" : ""}
                />
                <span>S${index + 1} · ${set.reps} reps</span>
              </label>
            `).join("")}
          </div>

          ${exercise.notes ? `<div class="exercise-notes">${escapeHtml(exercise.notes)}</div>` : ""}
        </div>

        <div class="exercise-actions">
          <button class="exercise-action" data-action="move-up" data-exercise-id="${exercise.id}" ${totalExercises <= 1 ? "disabled" : ""}>↑</button>
          <button class="exercise-action" data-action="move-down" data-exercise-id="${exercise.id}" ${totalExercises <= 1 ? "disabled" : ""}>↓</button>
          <a class="exercise-action ${hasLink ? "" : "disabled"}" href="${hasLink ? escapeAttribute(exercise.link) : "#"}" target="_blank" rel="noreferrer">Video</a>
          <button class="exercise-action" data-action="duplicate-exercise" data-exercise-id="${exercise.id}">Duplica</button>
          <button class="exercise-action" data-action="edit-exercise" data-exercise-id="${exercise.id}">Modifica</button>
          <button class="exercise-action danger" data-action="delete-exercise" data-exercise-id="${exercise.id}">Elimina</button>
        </div>
      </div>
    </article>
  `;
}

function attachExerciseListEvents() {
  dom.exerciseList.querySelectorAll(".set-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      toggleSet(checkbox.dataset.exerciseId, checkbox.dataset.setId, checkbox.checked);
    });
  });

  dom.exerciseList.querySelectorAll("[data-action='edit-exercise']").forEach((button) => {
    button.addEventListener("click", () => openEditExerciseModal(button.dataset.exerciseId));
  });

  dom.exerciseList.querySelectorAll("[data-action='duplicate-exercise']").forEach((button) => {
    button.addEventListener("click", () => duplicateExercise(button.dataset.exerciseId));
  });

  dom.exerciseList.querySelectorAll("[data-action='delete-exercise']").forEach((button) => {
    button.addEventListener("click", () => deleteExercise(button.dataset.exerciseId));
  });

  dom.exerciseList.querySelectorAll("[data-action='move-up']").forEach((button) => {
    button.addEventListener("click", () => moveExercise(button.dataset.exerciseId, -1));
  });

  dom.exerciseList.querySelectorAll("[data-action='move-down']").forEach((button) => {
    button.addEventListener("click", () => moveExercise(button.dataset.exerciseId, 1));
  });
}

function renderStatsScreen() {
  const plan = getSelectedPlan();
  if (!plan) return;

  const metrics = getPlanMetrics(plan);
  const activeDays = getActiveDays(plan);
  const sections = getAllSections(plan);

  dom.statsScreenSubtitle.textContent =
    `${plan.name} · ${activeDays.length} giorni attivi · creata ${formatRelativeDays(plan.createdAt)}`;

  dom.statsPrimaryGrid.innerHTML = [
    renderMetricCard("Giorni allenati", String(activeDays.length), activeDays.map(shortDay).join(" · ")),
    renderMetricCard("Da quanto tempo", `${daysSince(plan.createdAt)} giorni`, "Dalla creazione della scheda"),
    renderMetricCard("Giorni compilati", String(countConfiguredDays(plan)), "Giorni che hanno almeno un esercizio"),
    renderMetricCard("Sezioni usate", String(sections.length), sections.length ? sections.join(" · ") : "Ancora nessuna sezione"),
  ].join("");

  dom.statsSecondaryColumn.innerHTML = `
    <article class="side-card">
      <h3>Serie totali</h3>
      <strong class="metric-value">${metrics.totalSets}</strong>
      <p class="metric-sub">Somma di tutte le serie presenti nella scheda.</p>
    </article>

    <article class="side-card">
      <h3>Serie completate</h3>
      <strong class="metric-value">${metrics.completedSets}</strong>
      <p class="metric-sub">Segnate come concluse.</p>
    </article>

    <article class="side-card">
      <h3>Panoramica giorni</h3>
      <div class="plan-days" style="margin-top:14px;">
        ${activeDays.map((day) => {
          const exercises = plan.week[day]?.exercises || [];
          return `<span class="day-mini">${escapeHtml(shortDay(day))}: ${exercises.length}</span>`;
        }).join("")}
      </div>
    </article>
  `;
}

function renderSettingsScreen() {
  dom.themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.themeValue === state.settings.theme);
  });

  dom.timerPresetButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.timerValue) === state.settings.timerSeconds);
  });

  dom.compactToggle.classList.toggle("active", state.settings.compact);
}

function renderMetricCard(label, value, sub) {
  return `
    <article class="metric-card">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
      <span class="metric-sub">${escapeHtml(sub)}</span>
    </article>
  `;
}

function emptyStateMarkup(title, text) {
  return `
    <div class="empty-state">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function openCreatePlanModal() {
  editingPlanId = null;
  dom.planModalTitle.textContent = "Nuova scheda";
  document.getElementById("savePlanBtn").textContent = "Salva scheda";
  dom.planNameInput.value = "";
  fillPlanDays(["Lunedì", "Mercoledì", "Venerdì"]);
  dom.planErrorText.classList.add("hidden");
  dom.planModalBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => dom.planNameInput.focus());
}

function openEditPlanModal(planId) {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) return;

  editingPlanId = planId;
  dom.planModalTitle.textContent = "Modifica scheda";
  document.getElementById("savePlanBtn").textContent = "Aggiorna scheda";
  dom.planNameInput.value = plan.name;
  fillPlanDays(getActiveDays(plan));
  dom.planErrorText.classList.add("hidden");
  dom.planModalBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => dom.planNameInput.focus());
}

function fillPlanDays(activeDays) {
  dom.planDaysGrid.innerHTML = DAYS.map((day) => `
    <label class="day-check">
      <input type="checkbox" value="${day}" ${activeDays.includes(day) ? "checked" : ""} />
      <span>${day}</span>
    </label>
  `).join("");
}

function closePlanModal() {
  editingPlanId = null;
  dom.planModalBackdrop.classList.add("hidden");
}

function savePlanFromForm(event) {
  event.preventDefault();

  const name = dom.planNameInput.value.trim();
  const activeDays = [...dom.planDaysGrid.querySelectorAll("input:checked")].map((input) => input.value);

  if (!name) {
    dom.planNameInput.focus();
    return;
  }

  if (!activeDays.length) {
    dom.planErrorText.classList.remove("hidden");
    return;
  }

  dom.planErrorText.classList.add("hidden");

  if (editingPlanId) {
    state.plans = state.plans.map((plan) => {
      if (plan.id !== editingPlanId) return plan;
      return { ...plan, name, activeDays };
    });

    if (selectedPlanId === editingPlanId && !activeDays.includes(selectedDay)) {
      selectedDay = activeDays[0];
    }
  } else {
    const newPlan = createPlan(name, activeDays);
    state.plans = [newPlan, ...state.plans];
    selectedPlanId = newPlan.id;
    selectedDay = activeDays[0];
    currentScreen = "detail";
  }

  closePlanModal();
  renderApp();
}

function deletePlan(planId) {
  if (state.plans.length === 1) {
    alert("Deve restare almeno una scheda.");
    return;
  }

  state.plans = state.plans.filter((plan) => plan.id !== planId);

  if (selectedPlanId === planId) {
    selectedPlanId = state.plans[0].id;
    selectedDay = getActiveDays(state.plans[0])[0];
    currentScreen = "plans";
  }

  renderApp();
}

function openCreateExerciseModal() {
  const plan = getSelectedPlan();
  if (!plan) return;

  editingExerciseId = null;
  dom.exerciseModalTitle.textContent = `Nuovo esercizio per ${selectedDay}`;
  document.getElementById("saveExerciseBtn").textContent = "Salva esercizio";

  dom.exerciseForm.reset();
  dom.exerciseRecoveryInput.value = "";
  draftSets = [10, 10, 10, 10].map((reps) => createDraftSet(reps));

  renderSectionSuggestions(plan);
  renderSetsEditor();
  renderExercisePreview();

  dom.exerciseModalBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => dom.exerciseNameInput.focus());
}

function openEditExerciseModal(exerciseId) {
  const exercise = getSelectedDayExercises().find((item) => item.id === exerciseId);
  if (!exercise) return;

  editingExerciseId = exerciseId;
  dom.exerciseModalTitle.textContent = "Modifica esercizio";
  document.getElementById("saveExerciseBtn").textContent = "Aggiorna esercizio";

  dom.exerciseNameInput.value = exercise.name;
  dom.exerciseSectionInput.value = exercise.section;
  dom.exerciseWeightInput.value = exercise.weight;
  dom.exerciseRecoveryInput.value = exercise.recoverySeconds ? String(exercise.recoverySeconds) : "";
  dom.exerciseLinkInput.value = exercise.link;
  dom.exerciseNotesInput.value = exercise.notes;

  draftSets = exercise.sets.map((set) => ({
    id: set.id,
    reps: set.reps,
    done: set.done,
  }));

  renderSectionSuggestions(getSelectedPlan());
  renderSetsEditor();
  renderExercisePreview();

  dom.exerciseModalBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => dom.exerciseNameInput.focus());
}

function closeExerciseModal() {
  editingExerciseId = null;
  draftSets = [];
  dom.exerciseModalBackdrop.classList.add("hidden");
}

function renderSectionSuggestions(plan) {
  const sections = getAllSections(plan);
  dom.sectionSuggestions.innerHTML = sections
    .map((section) => `<option value="${escapeAttribute(section)}"></option>`)
    .join("");
}

function renderSetsEditor() {
  dom.setsEditor.innerHTML = draftSets.map((set, index) => `
    <div class="set-row">
      <div class="set-row-label">Serie ${index + 1}</div>
      <input
        class="input set-reps-input"
        type="number"
        min="1"
        max="60"
        step="1"
        value="${set.reps}"
        data-set-id="${set.id}"
        inputmode="numeric"
      />
      <button
        type="button"
        class="remove-set-btn"
        data-set-id="${set.id}"
        ${draftSets.length === 1 ? "disabled" : ""}
      >
        Elimina
      </button>
    </div>
  `).join("");

  dom.setsEditor.querySelectorAll(".set-reps-input").forEach((input) => {
    input.addEventListener("input", () => {
      draftSets = draftSets.map((set) =>
        set.id === input.dataset.setId
          ? { ...set, reps: normalizeInteger(input.value, 1, 60, set.reps) }
          : set
      );
      renderExercisePreview();
    });
  });

  dom.setsEditor.querySelectorAll(".remove-set-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (draftSets.length === 1) return;
      draftSets = draftSets.filter((set) => set.id !== button.dataset.setId);
      renderSetsEditor();
      renderExercisePreview();
    });
  });
}

function renderExercisePreview() {
  const text = draftSets.map((set) => set.reps).join(" / ");
  dom.exercisePreview.textContent = text ? `${text} reps` : "Nessuna serie";
}

function saveExerciseFromForm(event) {
  event.preventDefault();

  const name = dom.exerciseNameInput.value.trim();
  if (!name) {
    dom.exerciseNameInput.focus();
    return;
  }

  const sets = draftSets.map((set) => ({
    id: editingExerciseId ? set.id : uid(),
    reps: normalizeInteger(set.reps, 1, 60, 10),
    done: Boolean(set.done),
  }));

  const payload = {
    name,
    section: dom.exerciseSectionInput.value.trim(),
    weight: normalizeWeight(dom.exerciseWeightInput.value),
    recoverySeconds: normalizeOptionalRecovery(dom.exerciseRecoveryInput.value),
    link: dom.exerciseLinkInput.value.trim(),
    notes: dom.exerciseNotesInput.value.trim(),
    sets,
  };

  mutateSelectedPlan((plan) => {
    const exercises = getDayExercisesMutable(plan, selectedDay);

    if (editingExerciseId) {
      const existing = exercises.find((exercise) => exercise.id === editingExerciseId);
      const preservedDone = existing?.sets?.map((set) => set.done) || [];
      const nextSets = payload.sets.map((set, index) => ({
        ...set,
        done: preservedDone[index] || false,
      }));

      plan.week[selectedDay].exercises = exercises.map((exercise) =>
        exercise.id === editingExerciseId
          ? { ...exercise, ...payload, sets: nextSets }
          : exercise
      );
    } else {
      const nextOrder = getNextExerciseOrder(exercises);
      const newExercise = {
        id: uid(),
        order: nextOrder,
        ...payload,
        sets: payload.sets.map((set) => ({
          ...set,
          id: uid(),
          done: false,
        })),
      };

      plan.week[selectedDay].exercises = [...exercises, newExercise];
    }

    normalizeExerciseOrders(plan, selectedDay);
    return plan;
  });

  closeExerciseModal();
}

function moveExercise(exerciseId, direction) {
  mutateSelectedPlan((plan) => {
    const exercises = getDayExercisesMutable(plan, selectedDay).sort((a, b) => a.order - b.order);
    const currentIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= exercises.length) {
      return plan;
    }

    [exercises[currentIndex], exercises[targetIndex]] = [exercises[targetIndex], exercises[currentIndex]];
    plan.week[selectedDay].exercises = exercises.map((exercise, index) => ({
      ...exercise,
      order: index + 1,
    }));

    return plan;
  });
}

function duplicateExercise(exerciseId) {
  mutateSelectedPlan((plan) => {
    const exercises = getDayExercisesMutable(plan, selectedDay).sort((a, b) => a.order - b.order);
    const source = exercises.find((exercise) => exercise.id === exerciseId);
    if (!source) return plan;

    const copy = {
      ...source,
      id: uid(),
      name: `${source.name} Copy`,
      order: getNextExerciseOrder(exercises),
      sets: source.sets.map((set) => ({
        id: uid(),
        reps: set.reps,
        done: false,
      })),
    };

    plan.week[selectedDay].exercises = [...exercises, copy];
    normalizeExerciseOrders(plan, selectedDay);
    return plan;
  });
}

function deleteExercise(exerciseId) {
  mutateSelectedPlan((plan) => {
    plan.week[selectedDay].exercises = getDayExercisesMutable(plan, selectedDay)
      .filter((exercise) => exercise.id !== exerciseId)
      .sort((a, b) => a.order - b.order)
      .map((exercise, index) => ({
        ...exercise,
        order: index + 1,
      }));

    return plan;
  });
}

function toggleSet(exerciseId, setId, checked) {
  let recoveryToStart = state.settings.timerSeconds;

  mutateSelectedPlan((plan) => {
    const exercises = getDayExercisesMutable(plan, selectedDay);

    plan.week[selectedDay].exercises = exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;

      recoveryToStart = exercise.recoverySeconds || state.settings.timerSeconds;

      return {
        ...exercise,
        sets: exercise.sets.map((set) =>
          set.id === setId ? { ...set, done: checked } : set
        ),
      };
    });

    return plan;
  });

  if (checked) {
    startRecoveryTimer(recoveryToStart);
    renderTimer();
  }
}

function toggleAllSetsForDay() {
  const plan = getSelectedPlan();
  const exercises = getSelectedDayExercises(plan);
  if (!exercises.length) return;

  const allDone = exercises.every(isExerciseComplete);

  mutateSelectedPlan((nextPlan) => {
    nextPlan.week[selectedDay].exercises = getDayExercisesMutable(nextPlan, selectedDay).map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        done: !allDone,
      })),
    }));
    return nextPlan;
  });

  if (!allDone) {
    startRecoveryTimer(state.settings.timerSeconds);
    renderTimer();
  }
}

function refreshToggleAllLabel(plan) {
  const exercises = getSelectedDayExercises(plan);
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const allDone = totalSets > 0 && exercises.every(isExerciseComplete);

  dom.toggleAllSetsBtn.disabled = totalSets === 0;
  dom.toggleAllSetsBtn.style.opacity = totalSets === 0 ? "0.5" : "1";
  dom.toggleAllSetsBtn.textContent = allDone ? "Deseleziona tutto" : "Seleziona tutto";
}

function getDayExercisesMutable(plan, day) {
  return Array.isArray(plan.week?.[day]?.exercises) ? [...plan.week[day].exercises] : [];
}

function getNextExerciseOrder(exercises) {
  if (!exercises.length) return 1;
  return Math.max(...exercises.map((exercise) => exercise.order || 0)) + 1;
}

function normalizeExerciseOrders(plan, day) {
  plan.week[day].exercises = getDayExercisesMutable(plan, day)
    .sort((a, b) => a.order - b.order)
    .map((exercise, index) => ({
      ...exercise,
      order: index + 1,
    }));
}

function mutateSelectedPlan(mutator) {
  state.plans = state.plans.map((plan) => {
    if (plan.id !== selectedPlanId) return plan;
    return mutator(clone(plan));
  });
  renderApp();
}

function getPlanMetrics(plan) {
  let totalExercises = 0;
  let completedExercises = 0;
  let totalSets = 0;
  let completedSets = 0;

  for (const day of DAYS) {
    const exercises = [...(plan.week[day]?.exercises || [])];
    totalExercises += exercises.length;

    for (const exercise of exercises) {
      totalSets += exercise.sets.length;
      completedSets += exercise.sets.filter((set) => set.done).length;
      if (isExerciseComplete(exercise)) completedExercises += 1;
    }
  }

  return {
    totalExercises,
    completedExercises,
    totalSets,
    completedSets,
  };
}

function getDayMetrics(plan, day) {
  const exercises = [...(plan.week[day]?.exercises || [])];
  const totalExercises = exercises.length;
  const completedExercises = exercises.filter(isExerciseComplete).length;
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.done).length,
    0
  );

  return {
    totalExercises,
    completedExercises,
    totalSets,
    completedSets,
  };
}

function countConfiguredDays(plan) {
  return DAYS.filter((day) => (plan.week[day]?.exercises || []).length > 0).length;
}

function getSectionsForDay(plan, day) {
  const ordered = [];
  const seen = new Set();

  getExercisesForPlanDay(plan, day).forEach((exercise) => {
    if (!exercise.section) return;
    if (!seen.has(exercise.section)) {
      seen.add(exercise.section);
      ordered.push(exercise.section);
    }
  });

  return ordered;
}

function getExercisesForPlanDay(plan, day) {
  return [...(plan.week[day]?.exercises || [])].sort((a, b) => a.order - b.order);
}

function getAllSections(plan) {
  const seen = new Set();

  for (const day of DAYS) {
    for (const exercise of plan.week[day]?.exercises || []) {
      if (exercise.section) seen.add(exercise.section);
    }
  }

  return [...seen];
}

function groupExercisesBySection(exercises) {
  const map = new Map();
  const order = [];

  exercises.forEach((exercise) => {
    const key = exercise.section || "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(exercise);
  });

  return order.map((section) => ({
    section,
    exercises: map.get(section),
  }));
}

function isExerciseComplete(exercise) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.done);
}

function daysSince(timestamp) {
  return Math.max(1, Math.floor((Date.now() - timestamp) / 86400000) + 1);
}

function formatRelativeDays(timestamp) {
  const days = daysSince(timestamp);
  return days === 1 ? "oggi" : `${days} giorni fa`;
}

function startRecoveryTimer(seconds) {
  state.timer.running = true;
  state.timer.durationSeconds = seconds;
  state.timer.endAt = Date.now() + seconds * 1000;
  state.timer.lastFinishedAt = null;
  didNotifyTimerEnd = false;
  saveState();
}

function resetTimer() {
  state.timer.running = false;
  state.timer.endAt = null;
  state.timer.durationSeconds = state.settings.timerSeconds;
  state.timer.lastFinishedAt = null;
  didNotifyTimerEnd = false;
  saveState();
}

function timerIsRunning() {
  return Boolean(state.timer.running && getRemainingTimerSeconds() > 0);
}

function getRemainingTimerSeconds() {
  if (!state.timer.running || !state.timer.endAt) return 0;
  return Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000));
}

function startTimerLoop() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(renderTimer, 500);
}

function renderTimer() {
  const remaining = getRemainingTimerSeconds();

  if (remaining <= 0 && state.timer.running) {
    state.timer.running = false;
    state.timer.endAt = null;
    state.timer.lastFinishedAt = Date.now();
    saveState();

    if (!didNotifyTimerEnd) {
      didNotifyTimerEnd = true;
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    }
  }

  const displaySeconds = remaining > 0 ? remaining : state.settings.timerSeconds;
  const formatted = formatTime(displaySeconds);

  dom.heroTimerValue.textContent = formatted;
  dom.timerDockValue.textContent = formatted;
  dom.topbarTimerChip.textContent = `⏱ ${formatted}`;
  dom.miniTimerChip.textContent = `⏱ ${formatted}`;

  if (remaining > 0) {
    dom.timerDock.classList.remove("hidden");
    dom.topbarTimerChip.classList.remove("hidden");
    dom.miniTimerChip.classList.remove("hidden");
    dom.timerDockText.textContent = "Continua a scorrere correttamente anche se l'app va in background.";
    return;
  }

  if (state.timer.lastFinishedAt) {
    dom.timerDock.classList.remove("hidden");
    dom.topbarTimerChip.classList.add("hidden");
    dom.miniTimerChip.classList.add("hidden");
    dom.timerDockText.textContent = "Recupero finito. Puoi ripartire.";
    return;
  }

  dom.timerDock.classList.add("hidden");
  dom.topbarTimerChip.classList.add("hidden");
  dom.miniTimerChip.classList.add("hidden");
}

function normalizeInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(Math.round(parsed), min, max);
}

function normalizeWeight(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  const clamped = clamp(parsed, 0, 999);
  const rounded = Math.round(clamped * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function percent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function shortDay(day) {
  return day.slice(0, 3);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

console.assert(formatTime(150) === "02:30", "formatTime timer");
console.assert(normalizeInteger("4", 1, 20, 4) === 4, "normalizeInteger basic");
console.assert([9, 8, 7].map((reps) => createDraftSet(reps)).length === 3, "draft sets");