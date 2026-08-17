"use strict";

const POINTS = {
  auton: 12,
  autonTie: 6,
  alliancePin: 5,
  yellowPin: 10,
  midfieldRobot: 8
};

const MATCH_STORE_KEY = "vexOverrideMatches:v1";
const PROFILE_STORE_KEY = "vexOverrideProfile:v1";
const COMPETITION_STORE_KEY = "vexOverrideCompetitionData:v1";
const PROXY_URL_STORE_KEY = "vexOverrideDataProxyUrl:v1";
const HISTORY_INITIAL_LIMIT = 3;
const DEFAULT_VEX_PROXY_URL = "https://vexoverride-data-proxy.nnovate--26.workers.dev";
const quadrants = ["top", "right", "bottom", "left", "center"];
const colors = ["yellow", "red", "blue"];
const toggleStates = ["neutral", "blue", "red"];

const state = {
  auton: "none",
  robots: {
    "red-1": false,
    "red-2": false,
    "blue-1": false,
    "blue-2": false
  },
  quadrants: Object.fromEntries(quadrants.map(name => [
    name,
    { toggle: "neutral", yellow: 0, red: 0, blue: 0 }
  ]))
};

const skillsQuadrants = ["top", "right", "bottom", "left", "center"];
const skillsState = {
  centerToggle: false,
  toggles: {
    top: "neutral",
    right: "neutral",
    bottom: "neutral",
    left: "neutral"
  },
  quadrants: Object.fromEntries(skillsQuadrants.map(name => [
    name,
    { yellow: 0, red: 0, blue: 0 }
  ]))
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const isDevMode = new URLSearchParams(window.location.search).get("dev") === "1" || window.location.hash === "#dev";
let profile = loadProfile();
let activeMode = "head";
let teamAlliance = "none";
let skillsRunType = "none";
let showAllHistory = false;
let showAllSkillsHistory = false;
let expandedMatchId = null;
let expandedSkillsRunId = null;
let editingMatchId = null;
let pendingDeleteMatchId = null;
let competitionSearchResults = [];
let importedCompetition = loadCompetitionData();
let lastModalFocus = null;
let toastTimer = null;
const initialProxyParam = new URLSearchParams(window.location.search).get("proxy");
if (initialProxyParam) {
  localStorage.setItem(PROXY_URL_STORE_KEY, initialProxyParam.trim().replace(/\/$/, ""));
}

function vexProxyUrl() {
  return (window.VEX_OVERRIDE_PROXY_URL || localStorage.getItem(PROXY_URL_STORE_KEY) || DEFAULT_VEX_PROXY_URL).trim().replace(/\/$/, "");
}

function buildCounters() {
  quadrants.forEach((quadrant) => {
    const wrap = $(`[data-quadrant="${quadrant}"]`);
    wrap.innerHTML = colors.map(color => `
      <div class="counter ${color}" data-counter="${quadrant}:${color}">
        <button type="button" data-step="${quadrant}:${color}:-1" aria-label="Decrease ${color} pins in ${quadrant} quadrant">-</button>
        <output aria-label="${color} pins in ${quadrant} quadrant">0</output>
        <button type="button" data-step="${quadrant}:${color}:1" aria-label="Increase ${color} pins in ${quadrant} quadrant">+</button>
      </div>
    `).join("");
  });
}

function setAuton(next) {
  if (state.auton === next) {
    state.auton = "none";
  } else if ((state.auton === "red" && next === "blue") || (state.auton === "blue" && next === "red")) {
    state.auton = "tie";
  } else if (state.auton === "tie") {
    state.auton = next;
  } else {
    state.auton = next;
  }
  render();
}

function cycleToggle(quadrant) {
  if (quadrant === "center") return;
  const current = state.quadrants[quadrant].toggle;
  const index = toggleStates.indexOf(current);
  state.quadrants[quadrant].toggle = toggleStates[(index + 1) % toggleStates.length];
  render();
}

function stepCounter(quadrant, color, amount) {
  const current = state.quadrants[quadrant][color];
  state.quadrants[quadrant][color] = Math.max(0, current + amount);
  render();
}

function toggleRobot(robotId) {
  state.robots[robotId] = !state.robots[robotId];
  render();
}

function stepSkillsCounter(quadrant, color, amount) {
  if (!skillsState.quadrants[quadrant] || !Object.hasOwn(skillsState.quadrants[quadrant], color)) return;
  const current = skillsState.quadrants[quadrant][color];
  skillsState.quadrants[quadrant][color] = Math.max(0, current + amount);
  renderSkills();
}

function toggleSkillsCenter() {
  skillsState.centerToggle = !skillsState.centerToggle;
  renderSkills();
}

function cycleSkillsToggle(quadrant) {
  if (!Object.hasOwn(skillsState.toggles, quadrant)) return;
  const index = toggleStates.indexOf(skillsState.toggles[quadrant]);
  skillsState.toggles[quadrant] = toggleStates[(index + 1) % toggleStates.length];
  renderSkills();
}

function scoreSkills() {
  const q = skillsState.quadrants;
  let score = 0;

  score += (q.left.red + q.bottom.red + q.center.red) * POINTS.alliancePin;
  score += (q.top.blue + q.right.blue + q.center.blue) * POINTS.alliancePin;

  if (skillsState.toggles.left === "red") score += q.left.yellow * POINTS.yellowPin;
  if (skillsState.toggles.bottom === "red") score += q.bottom.yellow * POINTS.yellowPin;
  if (skillsState.toggles.top === "blue") score += q.top.yellow * POINTS.yellowPin;
  if (skillsState.toggles.right === "blue") score += q.right.yellow * POINTS.yellowPin;

  if (skillsState.centerToggle) {
    score += POINTS.midfieldRobot;
    score += q.center.yellow * POINTS.yellowPin;
  }

  return score;
}

function setSkillsRunType(type) {
  skillsRunType = skillsRunType === type ? "none" : type;
  renderSkills();
}

function scoreAlliance(alliance) {
  let score = 0;
  const centerOwner = midfieldOwner();

  if (state.auton === alliance) score += POINTS.auton;
  if (state.auton === "tie") score += POINTS.autonTie;

  quadrants.forEach((quadrant) => {
    const q = state.quadrants[quadrant];
    score += q[alliance] * POINTS.alliancePin;
    const owner = quadrant === "center" ? centerOwner : q.toggle;
    if (owner === alliance) score += q.yellow * POINTS.yellowPin;
  });

  Object.entries(state.robots).forEach(([robotId, active]) => {
    if (active && robotId.startsWith(alliance)) score += POINTS.midfieldRobot;
  });

  return score;
}

function midfieldOwner() {
  const red = Number(state.robots["red-1"]) + Number(state.robots["red-2"]);
  const blue = Number(state.robots["blue-1"]) + Number(state.robots["blue-2"]);
  if (red > blue) return "red";
  if (blue > red) return "blue";
  return "neutral";
}

function autonText() {
  if (state.auton === "red") return "Red autonomous bonus: +12 red.";
  if (state.auton === "blue") return "Blue autonomous bonus: +12 blue.";
  if (state.auton === "tie") return "Autonomous tied: +6 red, +6 blue.";
  return "No autonomous bonus selected.";
}

function savedMatches() {
  try {
    const matches = JSON.parse(localStorage.getItem(MATCH_STORE_KEY));
    return Array.isArray(matches) ? matches : [];
  } catch {
    return [];
  }
}

function writeSavedMatches(matches) {
  localStorage.setItem(MATCH_STORE_KEY, JSON.stringify(matches));
}

function loadCompetitionData() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPETITION_STORE_KEY));
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function writeCompetitionData(competition) {
  localStorage.setItem(COMPETITION_STORE_KEY, JSON.stringify(competition));
  importedCompetition = competition;
}

function matchRecordSummary(matches) {
  return matches.reduce((record, match) => {
    if (match.result === "win") record.wins += 1;
    if (match.result === "loss") record.losses += 1;
    if (match.result === "tie") record.ties += 1;
    return record;
  }, { wins: 0, losses: 0, ties: 0 });
}

function isHeadMatch(match) {
  return match?.mode !== "skills";
}

function isSkillsRun(match) {
  return match?.mode === "skills";
}

function renderBanner() {
  const team = $("[data-banner-team]");
  const count = $("[data-banner-matches]");
  const record = $("[data-banner-record]");
  if (!team || !count || !record) return;

  const matches = savedMatches().filter(isHeadMatch);
  const summary = matchRecordSummary(matches);
  team.textContent = profile?.teamNumber || "4330P";
  count.textContent = String(matches.length);
  record.textContent = `${summary.wins}-${summary.losses}-${summary.ties}`;
}

function competitionLocation(event) {
  return [event.city, event.region, event.country].filter(Boolean).join(", ");
}

function competitionDateLabel(event) {
  const value = event.date || event.start;
  if (!value) return "Date not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function setCompetitionStatus(message, tone = "") {
  const status = $("[data-competition-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

async function vexProxyFetch(path) {
  const baseUrl = vexProxyUrl();
  if (!baseUrl) {
    throw new Error("Competition data needs the private proxy before it can load live VEX results.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Accept": "application/json" }
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.error || "Competition data could not load. Try again later.");
  }
  return payload;
}

function renderCompetitionSource() {
  const source = $("[data-competition-source]");
  if (!source) return;
  source.textContent = vexProxyUrl() ? "Live proxy connected" : "Proxy not connected";
  source.dataset.connected = String(Boolean(vexProxyUrl()));
}

function renderCompetitionResults(events = []) {
  const results = $("[data-competition-results]");
  if (!results) return;
  results.hidden = false;
  if (!events.length) {
    results.innerHTML = `<p class="competition-empty">No matching competitions found.</p>`;
    return;
  }

  results.innerHTML = events.map(event => `
    <article class="competition-result">
      <div>
        <span>${escapeHtml(event.code || "Event")}</span>
        <h3>${escapeHtml(event.name || "Unnamed event")}</h3>
        <p>${escapeHtml(competitionDateLabel(event))}${competitionLocation(event) ? ` • ${escapeHtml(competitionLocation(event))}` : ""}</p>
      </div>
      <button class="modal-button secondary" type="button" data-import-event="${escapeHtml(event.id)}">Import</button>
    </article>
  `).join("");
}

function renderImportedCompetition() {
  renderCompetitionSource();
  const panel = $("[data-competition-current]");
  if (!panel) return;

  if (!importedCompetition) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  $("[data-competition-name]").textContent = importedCompetition.name || "Imported competition";
  $("[data-competition-meta]").textContent = [
    importedCompetition.eventCode,
    importedCompetition.date,
    importedCompetition.location
  ].filter(Boolean).join(" • ");
  const teams = Array.isArray(importedCompetition.teams) ? importedCompetition.teams : [];
  $("[data-competition-team-count]").textContent = `${teams.length} team${teams.length === 1 ? "" : "s"}`;
  $("[data-competition-progress]").textContent = importedCompetition.loadedAt
    ? `Loaded ${new Date(importedCompetition.loadedAt).toLocaleString()}.`
    : "";
  const visibleTeams = teams.slice(0, 36);
  $("[data-competition-team-list]").innerHTML = visibleTeams.map(team => `
    <span class="competition-team">
      <strong>${escapeHtml(team.teamNumber || team.number || "Team")}</strong>
      <small>${escapeHtml(team.teamName || team.name || team.organization || "Official history cached")}</small>
    </span>
  `).join("") + (teams.length > visibleTeams.length
    ? `<p class="competition-extra">+${teams.length - visibleTeams.length} more teams cached for analysis.</p>`
    : "");
}

async function searchCompetitions(query) {
  setCompetitionStatus("Searching official VEX events...", "loading");
  const payload = await vexProxyFetch(`/api/events/search?q=${encodeURIComponent(query)}`);
  competitionSearchResults = Array.isArray(payload.events) ? payload.events : [];
  renderCompetitionResults(competitionSearchResults);
  setCompetitionStatus(competitionSearchResults.length
    ? `Found ${competitionSearchResults.length} matching competition${competitionSearchResults.length === 1 ? "" : "s"}.`
    : "No matching competitions found.",
    competitionSearchResults.length ? "ready" : "warn"
  );
}

async function mapWithConcurrency(items, limit, mapper, onProgress) {
  const results = new Array(items.length);
  let index = 0;
  let completed = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch {
        results[currentIndex] = { ...items[currentIndex], officialMatches: [], officialSkills: [], officialRankings: [] };
      }
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function importCompetition(eventId) {
  setCompetitionStatus("Loading selected competition...", "loading");
  const [eventPayload, teamsPayload] = await Promise.all([
    vexProxyFetch(`/api/events/${encodeURIComponent(eventId)}`),
    vexProxyFetch(`/api/events/${encodeURIComponent(eventId)}/teams`)
  ]);
  const event = eventPayload.event || {};
  const teams = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];

  setCompetitionStatus(`Loaded event. Caching official history for ${teams.length} teams...`, "loading");
  const teamsWithHistory = await mapWithConcurrency(teams, 4, async (team) => {
    const history = await vexProxyFetch(`/api/teams/${encodeURIComponent(team.id)}/history`);
    return {
      ...team,
      officialMatches: history.matches || [],
      officialSkills: history.skills || [],
      officialRankings: history.rankings || []
    };
  }, (done, total) => {
    setCompetitionStatus(`Loaded ${done} of ${total} teams.`, "loading");
  });

  writeCompetitionData({
    eventId: event.id || eventId,
    eventCode: event.code || "",
    name: event.name || "Imported competition",
    date: competitionDateLabel(event),
    location: competitionLocation(event),
    loadedAt: new Date().toISOString(),
    teams: teamsWithHistory
  });
  renderImportedCompetition();
  setCompetitionStatus("Competition data loaded and saved on this device.", "ready");
  showToast("Competition data imported.");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORE_KEY));
    if (saved && typeof saved.teamNumber === "string" && saved.teamNumber.trim()) {
      return {
        teamNumber: saved.teamNumber.trim(),
        createdAt: saved.createdAt || new Date().toISOString()
      };
    }
  } catch {
    return null;
  }
  return null;
}

function saveProfile(teamNumber) {
  const nextProfile = {
    teamNumber: teamNumber.trim(),
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(nextProfile));
  profile = nextProfile;
  return nextProfile;
}

function cloneScorerState() {
  return {
    auton: state.auton,
    robots: { ...state.robots },
    quadrants: Object.fromEntries(quadrants.map(quadrant => [
      quadrant,
      { ...state.quadrants[quadrant] }
    ]))
  };
}

function cloneSkillsState() {
  return {
    centerToggle: skillsState.centerToggle,
    toggles: { ...skillsState.toggles },
    quadrants: Object.fromEntries(skillsQuadrants.map(quadrant => [
      quadrant,
      { ...skillsState.quadrants[quadrant] }
    ]))
  };
}

function blankDetails() {
  return {
    partnerTeam: "",
    partnerNotes: "",
    opponentOne: "",
    opponentOneNotes: "",
    opponentTwo: "",
    opponentTwoNotes: ""
  };
}

function formDetails() {
  const form = $("[data-save-form]");
  if (!form) return blankDetails();
  const data = new FormData(form);
  return Object.fromEntries(Object.keys(blankDetails()).map(key => [
    key,
    String(data.get(key) || "").trim()
  ]));
}

function matchResult(ourScore, opponentScore) {
  if (ourScore > opponentScore) return "win";
  if (ourScore < opponentScore) return "loss";
  return "tie";
}

function createMatchRecord(details) {
  const savedAt = new Date();
  const redScore = scoreAlliance("red");
  const blueScore = scoreAlliance("blue");
  const ourScore = teamAlliance === "red" ? redScore : blueScore;
  const opponentScore = teamAlliance === "red" ? blueScore : redScore;
  return {
    id: crypto?.randomUUID?.() || `match-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
    savedAt: savedAt.toISOString(),
    savedDate: savedAt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    teamNumber: profile?.teamNumber || "",
    teamAlliance,
    redScore,
    blueScore,
    ourScore,
    opponentScore,
    result: matchResult(ourScore, opponentScore),
    scorer: cloneScorerState(),
    details: { ...blankDetails(), ...details }
  };
}

function createSkillsRunRecord(notes = "") {
  const savedAt = new Date();
  return {
    id: crypto?.randomUUID?.() || `skills-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
    mode: "skills",
    savedAt: savedAt.toISOString(),
    savedDate: savedAt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    teamNumber: profile?.teamNumber || "",
    skillsType: skillsRunType,
    score: scoreSkills(),
    skills: cloneSkillsState(),
    notes: String(notes || "").trim()
  };
}

function showToast(message) {
  const toast = $("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function openSaveModal() {
  if (teamAlliance !== "red" && teamAlliance !== "blue") {
    showToast("Choose your alliance color before saving.");
    return;
  }

  const modal = $("[data-save-modal]");
  const form = $("[data-save-form]");
  if (!modal || !form) return;
  lastModalFocus = document.activeElement;
  form.reset();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.partnerTeam?.focus();
}

function closeSaveModal() {
  const modal = $("[data-save-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastModalFocus && typeof lastModalFocus.focus === "function") {
    lastModalFocus.focus();
  }
}

function openSkillsSaveModal() {
  if (skillsRunType !== "driver" && skillsRunType !== "autonomous") {
    showToast("Choose Driver or Autonomous before saving.");
    return;
  }

  const modal = $("[data-skills-save-modal]");
  const form = $("[data-skills-save-form]");
  if (!modal || !form) return;
  lastModalFocus = document.activeElement;
  form.reset();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.notes?.focus();
}

function closeSkillsSaveModal() {
  const modal = $("[data-skills-save-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastModalFocus && typeof lastModalFocus.focus === "function") {
    lastModalFocus.focus();
  }
}

function saveCurrentMatch(details) {
  if (teamAlliance !== "red" && teamAlliance !== "blue") {
    showToast("Choose your alliance color before saving.");
    return;
  }

  const record = createMatchRecord(details);
  const matches = savedMatches();
  matches.push(record);

  try {
    writeSavedMatches(matches);
  } catch {
    showToast("Match could not be saved on this device.");
    return;
  }

  closeSaveModal();
  resetScorer();
  renderHistory();
  showToast("Match saved on this device.");
}

function saveCurrentSkillsRun(notes = "") {
  if (skillsRunType !== "driver" && skillsRunType !== "autonomous") {
    showToast("Choose Driver or Autonomous before saving.");
    return;
  }

  const record = createSkillsRunRecord(notes);
  const matches = savedMatches();
  matches.push(record);

  try {
    writeSavedMatches(matches);
  } catch {
    showToast("Skills run could not be saved on this device.");
    return;
  }

  closeSkillsSaveModal();
  resetSkillsScorer();
  renderSkillsHistory();
  showToast("Skills run saved on this device.");
}

function setTeamAlliance(alliance) {
  teamAlliance = teamAlliance === alliance ? "none" : alliance;
  render();
}

function openSetupModal() {
  const modal = $("[data-setup-modal]");
  const form = $("[data-setup-form]");
  if (!modal || !form) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.teamNumber?.focus();
}

function closeSetupModal() {
  const modal = $("[data-setup-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function initializeProfileGate() {
  if (!profile) {
    openSetupModal();
  }
}

function setMode(mode) {
  activeMode = mode === "head" ? "head" : "skills";
  renderMode();
}

function renderMode() {
  $$("[data-mode-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeChoice === activeMode));
  });

  $$("[data-mode-section]").forEach((section) => {
    section.hidden = section.dataset.modeSection !== activeMode;
  });
}

function renderSkills() {
  $$("[data-skills-counter]").forEach((output) => {
    const [quadrant, color] = output.dataset.skillsCounter.split(":");
    output.textContent = skillsState.quadrants[quadrant]?.[color] ?? 0;
  });

  $$("[data-skills-center-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(skillsState.centerToggle));
  });

  $$("[data-skills-toggle]").forEach((button) => {
    const quadrant = button.dataset.skillsToggle;
    const value = skillsState.toggles[quadrant] || "neutral";
    button.className = `toggle toggle-${quadrant} ${value} skills-side-toggle`;
    button.setAttribute("aria-label", `Skills ${quadrant} toggle ${value}`);
  });

  $$("[data-skills-score]").forEach((score) => {
    score.textContent = scoreSkills();
  });

  $$("[data-skills-type]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.skillsType === skillsRunType));
  });
}

function render() {
  $("#redTotal").textContent = scoreAlliance("red");
  $("#blueTotal").textContent = scoreAlliance("blue");
  $$("[data-auton]").forEach((button) => {
    const color = button.dataset.auton;
    const active = state.auton === color || state.auton === "tie";
    button.setAttribute("aria-pressed", String(active));
  });

  $$("[data-toggle]").forEach((button) => {
    const quadrant = button.dataset.toggle;
    const value = state.quadrants[quadrant].toggle;
    button.className = `toggle toggle-${quadrant} ${value}`;
    button.setAttribute("aria-label", `${quadrant} toggle ${value}`);
  });

  $$("[data-counter]").forEach((counter) => {
    const [quadrant, color] = counter.dataset.counter.split(":");
    counter.querySelector("output").textContent = state.quadrants[quadrant][color];
  });

  $$("[data-robot]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.robots[button.dataset.robot]));
  });

  $$("[data-team-alliance]").forEach((button) => {
    const active = button.dataset.teamAlliance === teamAlliance;
    button.setAttribute("aria-pressed", String(active));
  });

  $(".midfield-diamond").dataset.owner = midfieldOwner();
}

function sortedSavedMatches() {
  return savedMatches().sort((a, b) => {
    const bTime = new Date(b.savedAt || 0).getTime();
    const aTime = new Date(a.savedAt || 0).getTime();
    return bTime - aTime;
  });
}

function sortedHeadMatches() {
  return sortedSavedMatches().filter(isHeadMatch);
}

function sortedSkillsRuns() {
  return sortedSavedMatches().filter(isSkillsRun);
}

function formatMatchDate(match) {
  if (match.savedDate) return match.savedDate;
  const date = new Date(match.savedAt || Date.now());
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMatchTime(match) {
  if (!match.savedAt) return "Saved match";
  return new Date(match.savedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function matchResultLabel(match) {
  if (["win", "loss", "tie"].includes(match.result)) return match.result;
  return "saved";
}

function scoreForSummary(match) {
  if (Number.isFinite(match.ourScore) && Number.isFinite(match.opponentScore)) {
    return { left: match.ourScore, right: match.opponentScore };
  }
  return { left: match.redScore ?? 0, right: match.blueScore ?? 0 };
}

function detailValue(value) {
  const text = String(value || "").trim();
  return text || "Not entered";
}

function hasDetail(...values) {
  return values.some(value => String(value || "").trim());
}

function optionalDetailBox(label, primary, notes) {
  if (!hasDetail(primary, notes)) return "";
  return `
    <div class="detail-box wide">
      <span>${escapeHtml(label)}</span>
      ${String(primary || "").trim() ? `<p>${escapeHtml(primary)}</p>` : ""}
      ${String(notes || "").trim() ? `<p>${escapeHtml(notes)}</p>` : ""}
    </div>
  `;
}

function historyCounter(color, value = 0) {
  return `
    <div class="history-counter ${color}">
      <i>-</i><strong>${Number(value || 0)}</strong><i>+</i>
    </div>
  `;
}

function historyStack(name, scorer) {
  const q = scorer?.quadrants?.[name] || { yellow: 0, red: 0, blue: 0 };
  return `
    <div class="history-stack ${name}">
      ${historyCounter("yellow", q.yellow)}
      ${historyCounter("red", q.red)}
      ${historyCounter("blue", q.blue)}
    </div>
  `;
}

function historyStackWithColors(name, scorer, stackColors, extraClass = "") {
  const q = scorer?.quadrants?.[name] || { yellow: 0, red: 0, blue: 0 };
  return `
    <div class="history-stack ${extraClass} ${name}">
      ${stackColors.map(color => historyCounter(color, q[color])).join("")}
    </div>
  `;
}

function historyRobotClass(id, active) {
  const color = id.startsWith("red") ? "red" : "blue";
  const position = ({
    "red-1": "r1",
    "red-2": "r2",
    "blue-1": "b1",
    "blue-2": "b2"
  })[id];
  return `history-robot ${color} ${position} ${active ? "active" : ""}`;
}

function renderHistoryField(match) {
  const scorer = match.scorer || {};
  const q = scorer.quadrants || {};
  const robots = scorer.robots || {};
  return `
    <div class="history-field" aria-label="Saved field snapshot">
      <div class="history-field-board">
        <div class="history-diamond"></div>
        <span class="history-toggle top ${q.top?.toggle || "neutral"}"></span>
        <span class="history-toggle right ${q.right?.toggle || "neutral"}"></span>
        <span class="history-toggle bottom ${q.bottom?.toggle || "neutral"}"></span>
        <span class="history-toggle left ${q.left?.toggle || "neutral"}"></span>
        ${["top", "right", "bottom", "left", "center"].map(name => historyStack(name, scorer)).join("")}
        ${Object.keys({ "red-1": 1, "red-2": 1, "blue-1": 1, "blue-2": 1 }).map(id => (
          `<span class="${historyRobotClass(id, Boolean(robots[id]))}"></span>`
        )).join("")}
      </div>
    </div>
  `;
}

function renderSkillsHistoryField(run) {
  const skills = run.skills || {};
  const q = skills.quadrants || {};
  const toggles = skills.toggles || {};
  return `
    <div class="history-field" aria-label="Saved Skills field snapshot">
      <div class="history-field-board skills-history-field-board">
        <span class="skills-history-zone blue top"></span>
        <span class="skills-history-zone blue right"></span>
        <span class="skills-history-zone red bottom"></span>
        <span class="skills-history-zone red left"></span>
        <div class="history-diamond"></div>
        <span class="history-toggle top ${toggles.top || "neutral"}"></span>
        <span class="history-toggle right ${toggles.right || "neutral"}"></span>
        <span class="history-toggle bottom ${toggles.bottom || "neutral"}"></span>
        <span class="history-toggle left ${toggles.left || "neutral"}"></span>
        <span class="skills-history-center-toggle ${skills.centerToggle ? "active" : ""}"></span>
        ${historyStackWithColors("top", { quadrants: q }, ["yellow", "blue"], "skills-snapshot-stack")}
        ${historyStackWithColors("right", { quadrants: q }, ["yellow", "blue"], "skills-snapshot-stack")}
        ${historyStackWithColors("bottom", { quadrants: q }, ["yellow", "red"], "skills-snapshot-stack")}
        ${historyStackWithColors("left", { quadrants: q }, ["yellow", "red"], "skills-snapshot-stack")}
        ${historyStackWithColors("center", { quadrants: q }, ["yellow", "red", "blue"], "skills-snapshot-stack")}
      </div>
    </div>
  `;
}

function renderMatchDetails(match) {
  const details = match.details || {};
  const alliance = match.teamAlliance ? match.teamAlliance.toUpperCase() : "Not saved";
  return `
    <div class="detail-grid">
      <div class="detail-box">
        <span>Team</span>
        <strong>${escapeHtml(match.teamNumber || "Not saved")}</strong>
      </div>
      <div class="detail-box">
        <span>Alliance</span>
        <strong>${escapeHtml(alliance)}</strong>
      </div>
      <div class="detail-box">
        <span>Our score</span>
        <strong>${escapeHtml(match.ourScore ?? match.redScore ?? 0)}</strong>
      </div>
      <div class="detail-box">
        <span>Opponent score</span>
        <strong>${escapeHtml(match.opponentScore ?? match.blueScore ?? 0)}</strong>
      </div>
      ${optionalDetailBox("Partner", details.partnerTeam, details.partnerNotes)}
      ${optionalDetailBox("Opponent 1", details.opponentOne, details.opponentOneNotes)}
      ${optionalDetailBox("Opponent 2", details.opponentTwo, details.opponentTwoNotes)}
      ${isDevMode ? `
        <div class="detail-box wide">
          <span>Dev tools</span>
          <div class="history-dev-actions">
            <button class="dev-button" type="button" data-dev-edit-match="${escapeHtml(match.id)}">Edit JSON</button>
            <button class="dev-button danger" type="button" data-dev-delete-match="${escapeHtml(match.id)}">Delete Match</button>
          </div>
        </div>
      ` : ""}
    </div>
    ${renderHistoryField(match)}
  `;
}

function renderHistoryCard(match) {
  const result = matchResultLabel(match);
  const score = scoreForSummary(match);
  const open = expandedMatchId === match.id;
  const confirmingDelete = pendingDeleteMatchId === match.id;
  return `
    <article class="history-card ${open ? "open" : ""}">
      <div class="history-summary">
        <button class="history-main" type="button" data-history-toggle="${escapeHtml(match.id)}" aria-expanded="${open}">
          <span class="history-date">
            ${escapeHtml(formatMatchDate(match))}
            <small>${escapeHtml(formatMatchTime(match))}</small>
          </span>
          <span class="history-score">
            <strong>${escapeHtml(score.left)}</strong><span>-</span><strong>${escapeHtml(score.right)}</strong>
          </span>
          <span class="result-pill ${escapeHtml(result)}">${escapeHtml(result)}</span>
        </button>
        <button class="history-delete ${confirmingDelete ? "confirming" : ""}" type="button" data-delete-match="${escapeHtml(match.id)}">
          ${confirmingDelete ? "Confirm Delete" : "Delete Match"}
        </button>
      </div>
      <div class="history-detail">
        ${open ? renderMatchDetails(match) : ""}
      </div>
    </article>
  `;
}

function skillsTypeLabel(type) {
  if (type === "driver") return "Driver";
  if (type === "autonomous") return "Autonomous";
  return "Skills";
}

function renderSkillsRunDetails(run) {
  const notes = String(run.notes || "").trim();
  return `
    <div class="detail-grid">
      <div class="detail-box compact">
        <span>Team</span>
        <strong>${escapeHtml(run.teamNumber || "Not saved")}</strong>
      </div>
      <div class="detail-box compact">
        <span>Run type</span>
        <strong>${escapeHtml(skillsTypeLabel(run.skillsType))}</strong>
      </div>
      <div class="detail-box compact">
        <span>Score</span>
        <strong>${escapeHtml(run.score ?? 0)}</strong>
      </div>
      ${notes ? `
        <div class="detail-box wide">
          <span>Notes</span>
          <p>${escapeHtml(notes)}</p>
        </div>
      ` : ""}
    </div>
    ${renderSkillsHistoryField(run)}
  `;
}

function renderSkillsRunCard(run) {
  const open = expandedSkillsRunId === run.id;
  return `
    <article class="history-card skills-run-card ${open ? "open" : ""}">
      <button class="history-summary skills-history-summary" type="button" data-skills-history-toggle="${escapeHtml(run.id)}" aria-expanded="${open}">
        <span class="history-date">
          ${escapeHtml(formatMatchDate(run))}
          <small>${escapeHtml(formatMatchTime(run))}</small>
        </span>
        <span class="skills-run-type">${escapeHtml(skillsTypeLabel(run.skillsType))}</span>
        <span class="history-score skills-run-score">
          <strong>${escapeHtml(run.score ?? 0)}</strong>
        </span>
      </button>
      <div class="history-detail">
        ${open ? renderSkillsRunDetails(run) : ""}
      </div>
    </article>
  `;
}

function renderHistory() {
  const list = $("[data-history-list]");
  const more = $("[data-history-more]");
  renderBanner();
  if (!list || !more) return;

  const devPanel = $("[data-dev-panel]");
  if (devPanel) devPanel.hidden = !isDevMode;

  const matches = sortedHeadMatches();
  if (!matches.length) {
    list.innerHTML = `<p class="history-empty">Saved matches will appear here after you score and save one.</p>`;
    more.hidden = true;
    return;
  }

  const visible = showAllHistory ? matches : matches.slice(0, HISTORY_INITIAL_LIMIT);
  list.innerHTML = visible.map(renderHistoryCard).join("");
  more.hidden = matches.length <= HISTORY_INITIAL_LIMIT;
  more.textContent = showAllHistory ? "Show Less" : "Show More";
}

function renderSkillsHistory() {
  const list = $("[data-skills-history-list]");
  const more = $("[data-skills-history-more]");
  if (!list || !more) return;

  const runs = sortedSkillsRuns();
  if (!runs.length) {
    list.innerHTML = `<p class="history-empty">Saved Skills runs will appear here after you score and save one.</p>`;
    more.hidden = true;
    return;
  }

  const visible = showAllSkillsHistory ? runs : runs.slice(0, HISTORY_INITIAL_LIMIT);
  list.innerHTML = visible.map(renderSkillsRunCard).join("");
  more.hidden = runs.length <= HISTORY_INITIAL_LIMIT;
  more.textContent = showAllSkillsHistory ? "Show Less" : "Show More";
}

function deleteMatch(id) {
  const nextMatches = savedMatches().filter(match => match.id !== id);
  writeSavedMatches(nextMatches);
  if (expandedMatchId === id) expandedMatchId = null;
  if (expandedSkillsRunId === id) expandedSkillsRunId = null;
  if (pendingDeleteMatchId === id) pendingDeleteMatchId = null;
  renderHistory();
  renderSkillsHistory();
  showToast("Match deleted.");
}

function requestDeleteMatch(id) {
  if (pendingDeleteMatchId === id) {
    deleteMatch(id);
    return;
  }
  pendingDeleteMatchId = id;
  renderHistory();
  showToast("Press Confirm Delete to remove this match.");
}

function clearMatches() {
  writeSavedMatches([]);
  expandedMatchId = null;
  expandedSkillsRunId = null;
  showAllHistory = false;
  showAllSkillsHistory = false;
  renderHistory();
  renderSkillsHistory();
  showToast("Saved matches cleared.");
}

function wipeAllData() {
  localStorage.removeItem(MATCH_STORE_KEY);
  localStorage.removeItem(PROFILE_STORE_KEY);
  localStorage.removeItem(COMPETITION_STORE_KEY);
  profile = null;
  importedCompetition = null;
  expandedMatchId = null;
  expandedSkillsRunId = null;
  showAllHistory = false;
  showAllSkillsHistory = false;
  renderHistory();
  renderSkillsHistory();
  renderImportedCompetition();
  openSetupModal();
  showToast("Local app data wiped.");
}

function openDevEditor(id) {
  const match = savedMatches().find(item => item.id === id);
  const modal = $("[data-dev-edit-modal]");
  const form = $("[data-dev-edit-form]");
  if (!match || !modal || !form) return;
  editingMatchId = id;
  form.elements.matchJson.value = JSON.stringify(match, null, 2);
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.matchJson.focus();
}

function closeDevEditor() {
  const modal = $("[data-dev-edit-modal]");
  if (!modal) return;
  modal.hidden = true;
  editingMatchId = null;
  document.body.classList.remove("modal-open");
}

function saveDevEdit() {
  const form = $("[data-dev-edit-form]");
  if (!form || !editingMatchId) return;
  let edited;
  try {
    edited = JSON.parse(form.elements.matchJson.value);
  } catch {
    showToast("Invalid JSON. Match was not changed.");
    return;
  }

  if (!edited || typeof edited !== "object" || !edited.id) {
    showToast("Edited match needs an id.");
    return;
  }

  const matches = savedMatches();
  const index = matches.findIndex(match => match.id === editingMatchId);
  if (index === -1) return;
  matches[index] = edited;
  writeSavedMatches(matches);
  expandedMatchId = edited.id;
  expandedSkillsRunId = edited.id;
  closeDevEditor();
  renderHistory();
  renderSkillsHistory();
  showToast("Match updated.");
}

function resetScorer() {
  state.auton = "none";
  Object.keys(state.robots).forEach(robot => {
    state.robots[robot] = false;
  });
  quadrants.forEach(quadrant => {
    state.quadrants[quadrant] = { toggle: "neutral", yellow: 0, red: 0, blue: 0 };
  });
  teamAlliance = "none";
  render();
}

function resetSkillsScorer() {
  skillsState.centerToggle = false;
  Object.keys(skillsState.toggles).forEach(quadrant => {
    skillsState.toggles[quadrant] = "neutral";
  });
  skillsQuadrants.forEach(quadrant => {
    skillsState.quadrants[quadrant] = { yellow: 0, red: 0, blue: 0 };
  });
  skillsRunType = "none";
  renderSkills();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-save-open]")) openSaveModal();
  if (event.target.closest("[data-save-close]")) closeSaveModal();
  if (event.target.closest("[data-save-skip]")) saveCurrentMatch(blankDetails());
  if (event.target === $("[data-save-modal]")) closeSaveModal();
  if (event.target.closest("[data-skills-save-open]")) openSkillsSaveModal();
  if (event.target.closest("[data-skills-save-close]")) closeSkillsSaveModal();
  if (event.target.closest("[data-skills-save-skip]")) saveCurrentSkillsRun("");
  if (event.target === $("[data-skills-save-modal]")) closeSkillsSaveModal();

  const modeChoice = event.target.closest("[data-mode-choice]");
  if (modeChoice) setMode(modeChoice.dataset.modeChoice);

  const skillsType = event.target.closest("[data-skills-type]");
  if (skillsType) {
    setSkillsRunType(skillsType.dataset.skillsType);
    return;
  }

  const skillsStep = event.target.closest("[data-skills-step]");
  if (skillsStep) {
    const [quadrant, color, amount] = skillsStep.dataset.skillsStep.split(":");
    stepSkillsCounter(quadrant, color, Number(amount));
    return;
  }

  if (event.target.closest("[data-skills-center-toggle]")) {
    toggleSkillsCenter();
    return;
  }

  const skillsToggle = event.target.closest("[data-skills-toggle]");
  if (skillsToggle) {
    cycleSkillsToggle(skillsToggle.dataset.skillsToggle);
    return;
  }

  if (event.target.closest("[data-history-more]")) {
    showAllHistory = !showAllHistory;
    renderHistory();
  }

  if (event.target.closest("[data-skills-history-more]")) {
    showAllSkillsHistory = !showAllSkillsHistory;
    renderSkillsHistory();
  }

  if (isDevMode && event.target.closest("[data-dev-clear-matches]")) clearMatches();
  if (isDevMode && event.target.closest("[data-dev-clear-all]")) wipeAllData();

  const devDelete = event.target.closest("[data-dev-delete-match]");
  if (isDevMode && devDelete) deleteMatch(devDelete.dataset.devDeleteMatch);

  const deleteButton = event.target.closest("[data-delete-match]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    requestDeleteMatch(deleteButton.dataset.deleteMatch);
    return;
  }

  const devEdit = event.target.closest("[data-dev-edit-match]");
  if (isDevMode && devEdit) openDevEditor(devEdit.dataset.devEditMatch);

  if (event.target.closest("[data-dev-edit-close]")) closeDevEditor();
  if (event.target === $("[data-dev-edit-modal]")) closeDevEditor();

  const historyToggle = event.target.closest("[data-history-toggle]");
  if (historyToggle) {
    const id = historyToggle.dataset.historyToggle;
    expandedMatchId = expandedMatchId === id ? null : id;
    renderHistory();
  }

  const skillsHistoryToggle = event.target.closest("[data-skills-history-toggle]");
  if (skillsHistoryToggle) {
    const id = skillsHistoryToggle.dataset.skillsHistoryToggle;
    expandedSkillsRunId = expandedSkillsRunId === id ? null : id;
    renderSkillsHistory();
  }

  const importButton = event.target.closest("[data-import-event]");
  if (importButton) {
    importButton.disabled = true;
    importCompetition(importButton.dataset.importEvent).catch((error) => {
      importButton.disabled = false;
      setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
      showToast("Competition data could not load. Try again later.");
    });
    return;
  }

  const auton = event.target.closest("[data-auton]");
  if (auton) setAuton(auton.dataset.auton);

  const toggle = event.target.closest("[data-toggle]");
  if (toggle) cycleToggle(toggle.dataset.toggle);

  const step = event.target.closest("[data-step]");
  if (step) {
    const [quadrant, color, amount] = step.dataset.step.split(":");
    stepCounter(quadrant, color, Number(amount));
  }

  const robot = event.target.closest("[data-robot]");
  if (robot) toggleRobot(robot.dataset.robot);

  const alliance = event.target.closest("[data-team-alliance]");
  if (alliance) setTeamAlliance(alliance.dataset.teamAlliance);

  if (event.target.closest("[data-reset]")) resetScorer();
});

$("[data-save-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentMatch(formDetails());
});

$("[data-skills-save-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const notes = String(new FormData(event.currentTarget).get("notes") || "").trim();
  saveCurrentSkillsRun(notes);
});

$("[data-setup-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = String(new FormData(event.currentTarget).get("teamNumber") || "").trim();
  if (!value) {
    showToast("Enter your team number first.");
    return;
  }
  saveProfile(value);
  renderBanner();
  closeSetupModal();
  showToast(`Team ${value} saved on this device.`);
});

$("[data-dev-edit-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isDevMode) saveDevEdit();
});

$("[data-competition-search-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("competitionSearch") || "").trim();
  if (query.length < 2) {
    setCompetitionStatus("Type at least 2 characters to search competitions.", "warn");
    return;
  }
  searchCompetitions(query).catch((error) => {
    setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
    showToast("Competition data could not load. Try again later.");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("[data-save-modal]")?.hidden) {
    closeSaveModal();
  }
  if (event.key === "Escape" && !$("[data-skills-save-modal]")?.hidden) {
    closeSkillsSaveModal();
  }
  if (event.key === "Escape" && !$("[data-dev-edit-modal]")?.hidden) {
    closeDevEditor();
  }
});

buildCounters();
renderMode();
render();
renderSkills();
renderHistory();
renderSkillsHistory();
renderImportedCompetition();
initializeProfileGate();
