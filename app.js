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
const SEASON_SKILLS_STORE_KEY = "vexOverrideSeasonSkills:v1";
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
let analysisRange = "all";
let analysisMode = "head";
let headCorrelationX = "alliancePins";
let headCorrelationY = "ourScore";
let skillsCorrelationX = "redBluePins";
let skillsCorrelationY = "score";
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
let syncedEvents = [];
let syncedEventsLoaded = false;
let syncedEventsError = null;
let syncedTeamIndexPromise = null;
let syncedTeamIndex = null;
let competitionQuickFilter = "all";
let competitionRegionOptions = [];
let selectedCompetitionRegion = "";
let highlightedRegionIndex = -1;
let pendingProfileMatch = null;
let teamSkillsResults = [];
let expandedTeamSkillId = null;
let expandedCompetitionTeam = null;
let seasonSkillsIndex = null;
let seasonSkillsPromise = null;
let lastModalFocus = null;
let toastTimer = null;
const REGION_MATCH_KEY = "__matching_regions__";
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
  team.textContent = profile?.teamName ? `${profile.teamNumber} ${profile.teamName}` : (profile?.teamNumber || "4330P");
  count.textContent = String(matches.length);
  record.textContent = `${summary.wins}-${summary.losses}-${summary.ties}`;
}

function competitionLocation(event) {
  return [event.city, event.region, event.country].filter(Boolean).join(", ");
}

function officialEventRegionName(event) {
  return event?.eventRegionName || event?.meta?.eventRegion?.name || "";
}

function officialEventRegionId(event) {
  return event?.eventRegionId || event?.meta?.eventRegion?.id || "";
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

function eventLocationFromData(event) {
  const data = event?.data || event || {};
  const location = data.location || {};
  return [location.city || data.city, location.region || data.region, location.country || data.country].filter(Boolean).join(", ");
}

function localEventId(event) {
  return String(event.eventId || event.id || "");
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©★]/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function searchTokens(value) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function searchTextMatches(haystack, query) {
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (normalizedHaystack.includes(normalizedQuery) || compactSearchText(haystack).includes(compactSearchText(query))) return true;
  const tokens = searchTokens(query);
  return tokens.length > 0 && tokens.every(token => normalizedHaystack.includes(token));
}

function regionAliases(label) {
  const normalized = normalizeSearchText(label);
  const aliases = new Set([label]);
  const regionMatch = normalized.match(/^([a-z ]+?) region ([0-9]+)$/);
  if (regionMatch) {
    aliases.add(`${regionMatch[1]} ${regionMatch[2]}`);
    aliases.add(`${regionMatch[1]} r${regionMatch[2]}`);
  }
  if (normalized === "florida south") {
    aliases.add("South Florida");
    aliases.add("Florida South");
    aliases.add("FL South");
    aliases.add("SFL");
  }
  if (normalized === "florida north central") {
    aliases.add("North Florida");
    aliases.add("Central Florida");
    aliases.add("Florida North");
    aliases.add("Florida Central");
    aliases.add("Florida North Central");
    aliases.add("North/Central Florida");
    aliases.add("North Central Florida");
    aliases.add("FL North Central");
    aliases.add("FNC");
  }
  if (normalized === "korea republic of") {
    aliases.add("South Korea");
    aliases.add("Korea");
  }
  if (normalized === "new york south") {
    aliases.add("South New York");
    aliases.add("Southern New York");
  }
  if (normalized === "new york north") aliases.add("North New York");
  return [...aliases];
}

function regionSearchText(label) {
  return regionAliases(label).join(" ");
}

function eventRegionKey(event) {
  const officialId = officialEventRegionId(event);
  if (officialId) return `official|${officialId}`;
  const officialName = officialEventRegionName(event);
  if (officialName) return `official-name|${normalizeSearchText(officialName)}`;
  return [event.region, event.country].filter(Boolean).join("|");
}

function eventRegionLabel(event) {
  const officialName = officialEventRegionName(event);
  if (officialName) return officialName;
  return [event.region, event.country].filter(Boolean).join(", ") || "Region not listed";
}

function eventDateTime(event) {
  const time = new Date(event.start || event.date || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isUpcomingEvent(event) {
  const time = eventDateTime(event);
  if (!time) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time >= today.getTime();
}

function eventTeamIndexText(event) {
  if (!syncedTeamIndex) return "";
  return syncedTeamIndex.eventText.get(localEventId(event)) || "";
}

function localEventMatches(event, query, region = "") {
  if (region && eventRegionKey(event) !== region) return false;
  if (!query) return true;
  const haystack = [
    event.eventId,
    event.id,
    event.sku,
    event.code,
    event.name,
    event.start,
    event.end,
    event.city,
    event.region,
    officialEventRegionName(event),
    event.country,
    eventTeamIndexText(event)
  ].filter(Boolean).join(" ");
  return searchTextMatches(`${haystack} ${regionSearchText(officialEventRegionName(event))}`, query);
}

function eventMatchesQuickFilter(event) {
  if (competitionQuickFilter === "mine") return myCompetitionEvents().some(item => localEventId(item) === localEventId(event));
  if (competitionQuickFilter === "florida") return normalizeSearchText(event.region) === "florida" || normalizeSearchText(officialEventRegionName(event)).includes("florida");
  if (competitionQuickFilter === "usa") return normalizeSearchText(event.country) === "united states";
  if (competitionQuickFilter === "upcoming") return isUpcomingEvent(event);
  if (competitionQuickFilter === "past") return eventDateTime(event) > 0 && !isUpcomingEvent(event);
  return true;
}

function eventSearchRank(event, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return eventDateTime(event);
  const compactQuery = compactSearchText(query);
  const id = normalizeSearchText(localEventId(event));
  const sku = normalizeSearchText(event.sku || event.code || "");
  const teams = eventTeamIndexText(event);
  const city = normalizeSearchText(event.city);
  const region = normalizeSearchText(event.region);
  const officialRegion = normalizeSearchText(officialEventRegionName(event));
  const country = normalizeSearchText(event.country);
  const name = normalizeSearchText(event.name);
  let score = 0;
  if (id === normalizedQuery || sku === normalizedQuery || compactSearchText(event.sku || event.code || "") === compactQuery) score += 100000;
  if (teams.split(" ").includes(normalizedQuery) || compactSearchText(teams).includes(compactQuery)) score += 80000;
  if (city.includes(normalizedQuery)) score += 40000;
  if (searchTextMatches(regionSearchText(officialEventRegionName(event)), query)) score += 35000;
  if (region.includes(normalizedQuery)) score += 30000;
  if (country.includes(normalizedQuery)) score += 20000;
  if (name.includes(normalizedQuery)) score += 10000;
  score -= eventDateTime(event) / 10000000000000;
  return -score;
}

function sortedSyncedEvents(events = [], query = "") {
  return [...events].sort((a, b) => {
    if (query) return eventSearchRank(a, query) - eventSearchRank(b, query);
    const aTime = new Date(a.start || a.date || 0).getTime();
    const bTime = new Date(b.start || b.date || 0).getTime();
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return aTime - bTime;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function competitionFilterValues() {
  const form = $("[data-competition-search-form]");
  if (!form) return { query: "", region: "", regionQuery: "" };
  const formData = new FormData(form);
  const typedRegion = currentRegionInputValue();
  return {
    query: String(formData.get("competitionSearch") || "").trim(),
    region: selectedCompetitionRegion,
    regionQuery: selectedCompetitionRegion ? "" : typedRegion
  };
}

function filteredSyncedEvents() {
  const { query, region, regionQuery } = competitionFilterValues();
  return sortedSyncedEvents(syncedEvents.filter(event =>
    eventMatchesQuickFilter(event) &&
    localEventMatches(event, query, region) &&
    eventMatchesRegionQuery(event, regionQuery)
  ), query);
}

function regionMatchRank(option, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const compactQuery = compactSearchText(query);
  const tokens = searchTokens(query);
  let best = Infinity;

  regionAliases(option.label).forEach((value) => {
    const normalized = normalizeSearchText(value);
    const compact = compactSearchText(value);
    const words = normalized.split(" ").filter(Boolean);
    if (normalized === normalizedQuery || compact === compactQuery) best = Math.min(best, 0);
    else if (normalized.startsWith(normalizedQuery) || compact.startsWith(compactQuery)) best = Math.min(best, 1);
    else if (tokens.length && tokens.every(token => words.some(word => word.startsWith(token)))) best = Math.min(best, 2);
    else if (normalized.includes(normalizedQuery) || compact.includes(compactQuery)) best = Math.min(best, 3);
    else if (tokens.length && tokens.every(token => normalized.includes(token))) best = Math.min(best, 4);
  });

  return best;
}

function regionOptionMatches(option, query) {
  return Number.isFinite(regionMatchRank(option, query));
}

function currentRegionInputValue() {
  return String($("[data-competition-region-input]")?.value || "").trim();
}

function matchingRegionOptions(query = currentRegionInputValue()) {
  if (!query) return competitionRegionOptions;
  return competitionRegionOptions
    .map(option => ({ option, rank: regionMatchRank(option, query) }))
    .filter(item => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label))
    .map(item => item.option);
}

function eventMatchesRegionQuery(event, query = "") {
  const value = String(query || "").trim();
  if (!value) return true;
  const matches = matchingRegionOptions(value);
  if (!matches.length) return false;
  return matches.some(option => option.key === eventRegionKey(event));
}

function visibleRegionRows(query = currentRegionInputValue()) {
  const matches = matchingRegionOptions(query);
  if (query) {
    if (matches.length > 1) {
      const count = syncedEvents.filter(event => eventMatchesRegionQuery(event, query)).length;
      return [
        {
          key: REGION_MATCH_KEY,
          label: `All matching regions for "${query}"`,
          meta: `${matches.length} synced regions • ${count} events`
        },
        ...matches
      ];
    }
    return matches;
  }
  return [
    { key: "", label: "All synced regions", meta: "Show every imported event" },
    ...matches
  ];
}

function renderRegionOptions(open = false) {
  const input = $("[data-competition-region-input]");
  const hidden = $("[data-competition-region]");
  const list = $("[data-competition-region-options]");
  if (!input || !hidden || !list) return;

  hidden.value = selectedCompetitionRegion;
  const query = currentRegionInputValue();
  const rows = visibleRegionRows(query);
  highlightedRegionIndex = Math.min(Math.max(highlightedRegionIndex, 0), Math.max(rows.length - 1, 0));
  input.setAttribute("aria-expanded", String(open));
  list.hidden = !open;
  if (!open) return;

  if (!rows.length) {
    list.innerHTML = `
      <div class="region-option region-option-empty" role="option" aria-disabled="true">
        <strong>No synced region matches "${escapeHtml(query)}"</strong>
        <small>Only imported season-204 regions appear here.</small>
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map((option, index) => `
    <button
      class="region-option ${index === highlightedRegionIndex ? "active" : ""}"
      type="button"
      role="option"
      data-region-option="${escapeHtml(option.key)}"
      aria-selected="${String(option.key === selectedCompetitionRegion)}"
    >
      <strong>${escapeHtml(option.label)}</strong>
      ${option.meta ? `<small>${escapeHtml(option.meta)}</small>` : ""}
    </button>
  `).join("");
}

function selectCompetitionRegion(key, label = "") {
  if (key === REGION_MATCH_KEY) {
    selectedCompetitionRegion = "";
    const hidden = $("[data-competition-region]");
    if (hidden) hidden.value = "";
    highlightedRegionIndex = -1;
    renderRegionOptions(false);
    return;
  }
  selectedCompetitionRegion = key || "";
  const input = $("[data-competition-region-input]");
  const hidden = $("[data-competition-region]");
  if (input) input.value = selectedCompetitionRegion ? label : "";
  if (hidden) hidden.value = selectedCompetitionRegion;
  highlightedRegionIndex = -1;
  renderRegionOptions(false);
}

function commitRegionInput() {
  const input = $("[data-competition-region-input]");
  if (!input) return;
  const value = String(input.value || "").trim();
  if (!value) {
    selectCompetitionRegion("", "");
    return;
  }
  const matches = visibleRegionRows(value);
  const option = matches[highlightedRegionIndex] || matches[0];
  if (option) selectCompetitionRegion(option.key, option.label);
}

function renderCompetitionPickers(events = syncedEvents) {
  const input = $("[data-competition-region-input]");
  if (!input) return;

  const selectedRegion = selectedCompetitionRegion;
  const regions = Array.from(new Map(sortedSyncedEvents(events)
    .map(event => [eventRegionKey(event), eventRegionLabel(event)])
    .filter(([key]) => key)
  ).entries());

  competitionRegionOptions = regions.map(([key, label]) => {
    const count = syncedEvents.filter(event => eventRegionKey(event) === key).length;
    return {
      key,
      label,
      meta: `${count} synced event${count === 1 ? "" : "s"}`
    };
  });

  const selected = competitionRegionOptions.find(option => option.key === selectedRegion);
  if (selected) {
    selectCompetitionRegion(selected.key, selected.label);
  } else if (selectedRegion) {
    selectCompetitionRegion("", "");
  }
  renderRegionOptions(false);
}

function setCompetitionStatus(message, tone = "") {
  const status = $("[data-competition-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setTeamSkillsStatus(message, tone = "") {
  const status = $("[data-team-skills-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

async function vexProxyFetch(path) {
  const baseUrl = vexProxyUrl();
  if (!baseUrl) {
    throw new Error("Live VEX data needs the proxy before it can load official results.");
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
  const teamSource = $("[data-team-skills-source]");
  if (source) {
    if (syncedEventsLoaded && syncedEvents.length) {
      source.textContent = "Synced local data";
      source.dataset.connected = "true";
    } else {
      source.textContent = "No synced data";
      source.dataset.connected = "false";
    }
  }
  if (teamSource) {
    teamSource.textContent = vexProxyUrl() ? "Live proxy connected" : "Proxy not connected";
    teamSource.dataset.connected = String(Boolean(vexProxyUrl()));
  }
}

function officialSkillsId(row) {
  return String(row.team?.id || row.team?.teamRegId || row.team?.teamNumber || `rank-${row.rank || "unknown"}`);
}

function teamNumberKey(value) {
  return String(value || "").trim().toUpperCase();
}

function officialDateLabel(value) {
  if (!value) return "Date not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function teamSkillsLocation(row) {
  return [row.team?.city, row.team?.region, row.team?.country].filter(Boolean).join(", ");
}

function renderTeamSkillsResults(rows = []) {
  const results = $("[data-team-skills-results]");
  if (!results) return;
  results.hidden = false;
  if (!rows.length) {
    results.innerHTML = `<p class="competition-empty">No matching teams found in the public Skills standings.</p>`;
    return;
  }

  results.innerHTML = rows.map((row) => {
    const id = officialSkillsId(row);
    const open = expandedTeamSkillId === id;
    const team = row.team || {};
    const scores = row.scores || {};
    const event = row.event || {};
    const total = seasonSkillTotal(row);
    return `
      <article class="team-skill-card ${open ? "open" : ""}">
        <button class="team-skill-summary" type="button" data-team-skill-toggle="${escapeHtml(id)}" aria-expanded="${open}">
          <span class="team-skill-identity">
            <strong>${escapeHtml(team.teamNumber || "Team")}</strong>
            <small>${escapeHtml(team.teamName || team.organization || "Official Skills result")}</small>
          </span>
          <span class="team-skill-chip">Rank #${escapeHtml(row.rank ?? "-")}</span>
          <span class="team-skill-score">${escapeHtml(total)}</span>
        </button>
        <div class="team-skill-detail">
          ${open ? `
            <div class="team-skill-stats">
              <span><small>Driver</small><strong>${escapeHtml(scores.maxDriver ?? scores.driver ?? 0)}</strong></span>
              <span><small>Autonomous</small><strong>${escapeHtml(scores.maxProgramming ?? scores.programming ?? 0)}</strong></span>
              <span><small>Event</small><strong>${escapeHtml(event.sku || "Not listed")}</strong></span>
              <span><small>Date</small><strong>${escapeHtml(officialDateLabel(event.startDate))}</strong></span>
            </div>
            <p>${escapeHtml([
              team.organization,
              teamSkillsLocation(row),
              team.eventRegion
            ].filter(Boolean).join(" • ") || "No extra team details listed.")}</p>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function loadCachedSeasonSkills() {
  try {
    const cached = JSON.parse(localStorage.getItem(SEASON_SKILLS_STORE_KEY));
    if (cached && Array.isArray(cached.skills)) return cached.skills;
  } catch {
    return null;
  }
  return null;
}

function buildSeasonSkillsIndex(rows = []) {
  const byTeam = new Map();
  rows.forEach((row) => {
    const key = teamNumberKey(row.team?.teamNumber);
    if (!key) return;
    if (!byTeam.has(key) || seasonSkillTotal(row) > seasonSkillTotal(byTeam.get(key))) {
      byTeam.set(key, row);
    }
  });
  return { rows, byTeam };
}

function seasonSkillTotal(row) {
  const scores = row?.scores || {};
  const driver = Number(scores.maxDriver ?? scores.driver ?? 0);
  const programming = Number(scores.maxProgramming ?? scores.programming ?? 0);
  const combined = driver + programming;
  return combined || Number(scores.score || 0);
}

async function ensureSeasonSkillsIndex() {
  if (seasonSkillsIndex) return seasonSkillsIndex;
  if (seasonSkillsPromise) return seasonSkillsPromise;

  seasonSkillsPromise = (async () => {
    const cached = loadCachedSeasonSkills();
    if (cached) {
      seasonSkillsIndex = buildSeasonSkillsIndex(cached);
      return seasonSkillsIndex;
    }
    const payload = await vexProxyFetch("/api/skills/standings");
    const rows = Array.isArray(payload.skills) ? payload.skills : [];
    try {
      localStorage.setItem(SEASON_SKILLS_STORE_KEY, JSON.stringify({
        cachedAt: new Date().toISOString(),
        skills: rows
      }));
    } catch {
      // The standings can be large; keep the in-memory index even if browser storage is full.
    }
    seasonSkillsIndex = buildSeasonSkillsIndex(rows);
    return seasonSkillsIndex;
  })();

  return seasonSkillsPromise;
}

function skillsRowMatches(row, query) {
  const team = row.team || {};
  const event = row.event || {};
  const haystack = [
    team.teamNumber,
    team.teamName,
    team.organization,
    team.city,
    team.region,
    team.country,
    team.eventRegion,
    regionSearchText(team.eventRegion),
    event.sku
  ].filter(Boolean).join(" ");
  return searchTextMatches(haystack, query);
}

async function searchTeamSkills(query) {
  setTeamSkillsStatus("Searching public VEX Skills standings...", "loading");
  const index = await ensureSeasonSkillsIndex();
  teamSkillsResults = index.rows.filter(row => skillsRowMatches(row, query)).slice(0, 50);
  expandedTeamSkillId = null;
  renderTeamSkillsResults(teamSkillsResults);
  setTeamSkillsStatus(teamSkillsResults.length
    ? `Found ${teamSkillsResults.length} matching team${teamSkillsResults.length === 1 ? "" : "s"}.`
    : "No matching teams found.",
    teamSkillsResults.length ? "ready" : "warn"
  );
}

async function ensureSyncedTeamIndex() {
  await ensureSyncedEventsLoaded();
  if (syncedTeamIndex) return syncedTeamIndex;
  if (syncedTeamIndexPromise) return syncedTeamIndexPromise;

  syncedTeamIndexPromise = (async () => {
    const byTeam = new Map();
    const eventText = new Map();
    const eventsById = new Map(syncedEvents.map(event => [localEventId(event), event]));

    await mapWithConcurrency(syncedEvents, 12, async (event) => {
      const id = localEventId(event);
      const teamsPath = event.paths?.teams || `data/events/${id}/teams.json`;
      const payload = await readLocalJson(teamsPath).catch(() => ({ data: [] }));
      const teams = Array.isArray(payload.data) ? payload.data.map(normalizeLocalTeam) : [];
      const terms = [];
      teams.forEach((team) => {
        const number = String(team.teamNumber || "").trim();
        if (!number) return;
        const key = number.toUpperCase();
        const entry = { event: eventsById.get(id) || event, team };
        if (!byTeam.has(key)) byTeam.set(key, []);
        byTeam.get(key).push(entry);
        terms.push(number, team.teamName, team.organization, team.robotName);
      });
      eventText.set(id, normalizeSearchText(terms.filter(Boolean).join(" ")));
    });

    syncedTeamIndex = { byTeam, eventText };
    return syncedTeamIndex;
  })();

  return syncedTeamIndexPromise;
}

function myCompetitionEntries() {
  const teamNumber = String(profile?.teamNumber || "").trim().toUpperCase();
  if (!teamNumber || !syncedTeamIndex) return [];
  return syncedTeamIndex.byTeam.get(teamNumber) || [];
}

function myCompetitionEvents() {
  const seen = new Set();
  return myCompetitionEntries()
    .map(entry => entry.event)
    .filter((event) => {
      const id = localEventId(event);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function renderMyCompetitions() {
  const wrap = $("[data-my-competitions]");
  if (!wrap) return;
  wrap.hidden = false;

  const teamLabel = profile?.teamName
    ? `${profile.teamNumber} ${profile.teamName}`
    : (profile?.teamNumber || "your team");
  const events = sortedSyncedEvents(myCompetitionEvents());
  if (!profile?.teamNumber) {
    wrap.innerHTML = `
      <div class="my-competitions-head">
        <span class="brand-kicker">My competitions</span>
        <strong>Enter a team number during setup to auto-detect your events.</strong>
      </div>
    `;
    return;
  }

  if (!events.length) {
    wrap.innerHTML = `
      <div class="my-competitions-head">
        <span class="brand-kicker">My competitions</span>
        <strong>No synced competitions found for ${escapeHtml(teamLabel)}.</strong>
        <p>Try searching all synced events below.</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="my-competitions-head">
      <span class="brand-kicker">My competitions</span>
      <strong>${escapeHtml(events.length)} synced event${events.length === 1 ? "" : "s"} found for ${escapeHtml(teamLabel)}</strong>
    </div>
    <div class="my-competition-list">
      ${events.map(event => eventCardMarkup(event, "mine")).join("")}
    </div>
  `;
}

function eventCardMarkup(event, variant = "") {
  const id = localEventId(event);
  const officialRegion = officialEventRegionName(event);
  return `
    <article class="competition-result ${variant ? `competition-result-${variant}` : ""}">
      <div>
        <span>${escapeHtml(event.sku || event.code || `Event ${id}`)} • Event ${escapeHtml(id)}</span>
        <h3>${escapeHtml(event.name || "Unnamed event")}</h3>
        <p>${escapeHtml(competitionDateLabel(event))}${competitionLocation(event) ? ` • ${escapeHtml(competitionLocation(event))}` : ""}</p>
        ${officialRegion ? `<p class="competition-official-region">${escapeHtml(officialRegion)}</p>` : ""}
        <div class="competition-counts" aria-label="Synced data counts">
          <strong>${escapeHtml(event.teamCount ?? 0)} teams</strong>
          <strong>${escapeHtml(event.skillCount ?? 0)} skills</strong>
          <strong>${escapeHtml(event.awardCount ?? 0)} awards</strong>
        </div>
      </div>
      <button class="modal-button secondary" type="button" data-import-event="${escapeHtml(id)}">View / Import</button>
    </article>
  `;
}

function renderCompetitionFilters() {
  $$("[data-competition-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.competitionFilter === competitionQuickFilter));
  });
}

function renderCompetitionResults(events = []) {
  const results = $("[data-competition-results]");
  if (!results) return;
  results.hidden = false;
  if (!events.length) {
    results.innerHTML = `<p class="competition-empty">No matching competitions found.</p>`;
    return;
  }

  results.innerHTML = events.map(event => eventCardMarkup(event)).join("");
}

function eventSkillRowsForTeam(team) {
  const skills = Array.isArray(importedCompetition?.skills) ? importedCompetition.skills : [];
  const number = teamNumberKey(team.teamNumber || team.number);
  const id = String(team.id || "");
  return skills.filter((row) => {
    const rowNumber = teamNumberKey(row.team?.name || row.team?.teamNumber || row.team?.team);
    const rowId = String(row.team?.id || row.teamId || "");
    return (number && rowNumber === number) || (id && rowId === id);
  });
}

function seasonSkillForTeam(team) {
  const key = teamNumberKey(team.teamNumber || team.number);
  return key && seasonSkillsIndex?.byTeam ? seasonSkillsIndex.byTeam.get(key) : null;
}

function teamLocationLine(team) {
  return [team.location, team.city, team.region, team.country].filter(Boolean).join(" • ");
}

function competitionTeamMarkup(team) {
  const number = team.teamNumber || team.number || "Team";
  const id = teamNumberKey(number);
  const open = expandedCompetitionTeam === id;
  const seasonSkill = seasonSkillForTeam(team);
  const eventSkills = eventSkillRowsForTeam(team);
  const total = seasonSkill ? seasonSkillTotal(seasonSkill) : null;
  const scores = seasonSkill?.scores || {};
  return `
    <article class="competition-team-row ${open ? "open" : ""}">
      <button class="competition-team-summary" type="button" data-competition-team-toggle="${escapeHtml(id)}" aria-expanded="${open}">
        <span class="team-main">
          <strong>${escapeHtml(number)}</strong>
          <small>${escapeHtml(team.teamName || team.name || team.organization || "Team details")}</small>
        </span>
      </button>
      <div class="competition-team-detail">
        ${open ? `
          <div class="team-skill-stats">
            <span><small>Season Skills</small><strong>${escapeHtml(total ?? "Not loaded")}</strong></span>
            <span><small>Driver</small><strong>${escapeHtml(scores.maxDriver ?? scores.driver ?? 0)}</strong></span>
            <span><small>Autonomous</small><strong>${escapeHtml(scores.maxProgramming ?? scores.programming ?? 0)}</strong></span>
            <span><small>Event Skills</small><strong>${escapeHtml(eventSkills.length)}</strong></span>
          </div>
          <p>${escapeHtml([
            team.robotName ? `Robot: ${team.robotName}` : "",
            team.organization,
            teamLocationLine(team)
          ].filter(Boolean).join(" • ") || "No additional team details listed.")}</p>
          ${eventSkills.length ? `
            <div class="event-skill-list">
              ${eventSkills.map(row => `
                <span>
                  <small>${escapeHtml(row.type || "skills")}${row.rank ? ` • Rank #${escapeHtml(row.rank)}` : ""}</small>
                  <strong>${escapeHtml(row.score ?? 0)}</strong>
                  ${row.attempts ? `<small>${escapeHtml(row.attempts)} attempts</small>` : ""}
                </span>
              `).join("")}
            </div>
          ` : ""}
        ` : ""}
      </div>
    </article>
  `;
}

function awardWinnerLabel(winner, teamByNumber = new Map()) {
  const team = winner?.team || winner;
  const number = team?.name || team?.number || team?.teamNumber || "";
  if (!number) return "";
  const registeredTeam = teamByNumber.get(teamNumberKey(number));
  const label = registeredTeam?.teamName || registeredTeam?.name || registeredTeam?.organization || "";
  return label && teamNumberKey(label) !== teamNumberKey(number) ? `${number} - ${label}` : number;
}

function competitionAwardsMarkup(awards = [], teams = []) {
  if (!awards.length) return `<p class="competition-empty">No awards posted yet.</p>`;
  const teamByNumber = new Map(teams.map(team => [teamNumberKey(team.teamNumber || team.number), team]).filter(([number]) => number));
  return awards.map(award => `
    <article class="competition-award-row">
      <div>
        <strong>${escapeHtml(award.title || "Award")}</strong>
        <small>${escapeHtml([
          award.classification,
          award.designation
        ].filter(Boolean).join(" • "))}</small>
      </div>
      <p>${escapeHtml((award.teamWinners || []).map(winner => awardWinnerLabel(winner, teamByNumber)).filter(Boolean).join(", ") || "Winner not listed")}</p>
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
    importedCompetition.eventRegionName,
    importedCompetition.location
  ].filter(Boolean).join(" • ");
  const teams = Array.isArray(importedCompetition.teams) ? importedCompetition.teams : [];
  const awards = Array.isArray(importedCompetition.awards) ? importedCompetition.awards : [];
  const teamCount = importedCompetition.teamCount ?? teams.length;
  const skillCount = importedCompetition.skillCount ?? 0;
  const awardCount = importedCompetition.awardCount ?? 0;
  $("[data-competition-team-count]").textContent = `${teamCount} team${teamCount === 1 ? "" : "s"}`;
  $("[data-competition-progress]").textContent = importedCompetition.loadedAt
    ? `Loaded ${new Date(importedCompetition.loadedAt).toLocaleString()}. ${skillCount} skills rows • ${awardCount} awards.`
    : "";
  const teamList = $("[data-competition-team-list]");
  if (teamList) {
    teamList.innerHTML = `
      <div class="competition-section-title">
        <strong>Teams</strong>
        <span>Click a team for season Skills and event details.</span>
      </div>
      ${teams.length ? teams.map(competitionTeamMarkup).join("") : `<p class="competition-empty">No registered teams are listed yet.</p>`}
    `;
  }
  const awardsList = $("[data-competition-awards-list]");
  if (awardsList) {
    awardsList.innerHTML = `
      <div class="competition-section-title">
        <strong>Awards</strong>
        <span>${awardCount} award${awardCount === 1 ? "" : "s"} synced for this event.</span>
      </div>
      ${competitionAwardsMarkup(awards, teams)}
    `;
  }
  if (!seasonSkillsIndex && !seasonSkillsPromise) {
    ensureSeasonSkillsIndex().then(() => renderImportedCompetition()).catch(() => {
      seasonSkillsIndex = buildSeasonSkillsIndex([]);
      renderImportedCompetition();
    });
  }
}

async function searchCompetitions(query) {
  await ensureSyncedEventsLoaded();
  if (!syncedEvents.length) {
    competitionSearchResults = [];
    renderCompetitionResults(competitionSearchResults);
    renderCompetitionPickers();
    renderMyCompetitions();
    setCompetitionStatus(syncedEventsError || "No synced competitions found yet. Run the VEX collector and import a bundle.", "warn");
    return;
  }
  setCompetitionStatus("Searching synced competitions...", "loading");
  await ensureSyncedTeamIndex();
  const { region, regionQuery } = competitionFilterValues();
  const searchInput = $("[data-competition-search-form] input[name='competitionSearch']");
  if (searchInput && searchInput.value.trim() !== query) searchInput.value = query;
  const matchingRegions = regionQuery ? matchingRegionOptions(regionQuery) : [];
  competitionSearchResults = sortedSyncedEvents(syncedEvents.filter(event =>
    eventMatchesQuickFilter(event) &&
    localEventMatches(event, query, region) &&
    eventMatchesRegionQuery(event, regionQuery)
  ), query);
  renderCompetitionPickers();
  renderCompetitionFilters();
  renderMyCompetitions();
  renderCompetitionResults(competitionSearchResults);
  let statusMessage = competitionSearchResults.length
    ? `Found ${competitionSearchResults.length} synced competition${competitionSearchResults.length === 1 ? "" : "s"}.`
    : "No matching competitions found.";
  if (regionQuery) {
    statusMessage = matchingRegions.length
      ? `Found ${competitionSearchResults.length} synced competition${competitionSearchResults.length === 1 ? "" : "s"} across ${matchingRegions.length} matching region${matchingRegions.length === 1 ? "" : "s"}.`
      : `No synced regions match "${regionQuery}".`;
  }
  setCompetitionStatus(statusMessage, competitionSearchResults.length ? "ready" : "warn");
}

async function ensureSyncedEventsLoaded() {
  if (syncedEventsLoaded || syncedEventsError) return;
  try {
    const response = await fetch("data/events/index.json", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("No synced competitions found yet. Run the VEX collector and import a bundle.");
    const payload = await response.json();
    syncedEvents = Array.isArray(payload.events) ? payload.events : [];
    syncedEventsLoaded = true;
    renderCompetitionSource();
    if (syncedEvents.length) {
      const updated = payload.updatedAt ? ` Last updated ${new Date(payload.updatedAt).toLocaleString()}.` : "";
      setCompetitionStatus(`${syncedEvents.length} synced competition${syncedEvents.length === 1 ? "" : "s"} loaded.${updated}`, "ready");
      renderCompetitionPickers();
      renderCompetitionFilters();
      renderCompetitionResults(sortedSyncedEvents(syncedEvents).slice(0, 12));
      ensureSyncedTeamIndex().then(() => {
        renderMyCompetitions();
        if (competitionQuickFilter === "mine") searchCompetitions(competitionFilterValues().query);
      }).catch(() => renderMyCompetitions());
    } else {
      renderCompetitionPickers();
      renderMyCompetitions();
      setCompetitionStatus("No synced competitions found yet. Run the VEX collector and import a bundle.", "warn");
    }
  } catch (error) {
    syncedEvents = [];
    syncedEventsError = error.message || "No synced competitions found yet. Run the VEX collector and import a bundle.";
    renderCompetitionSource();
    renderCompetitionPickers();
    renderMyCompetitions();
    setCompetitionStatus(syncedEventsError, "warn");
  }
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
  await ensureSyncedEventsLoaded();
  if (syncedEvents.length) {
    await importLocalCompetition(eventId);
    return;
  }
  await importCompetitionFromProxy(eventId);
}

async function readLocalJson(path) {
  const response = await fetch(path, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("Synced competition data could not load. Try importing the VEX bundle again.");
  return response.json();
}

function normalizeLocalTeam(team) {
  const location = team.location || {};
  return {
    id: team.id,
    teamNumber: team.number || team.teamNumber || "",
    teamName: team.team_name || team.teamName || team.name || "",
    robotName: team.robot_name || team.robotName || "",
    organization: team.organization || "",
    location: [location.city, location.region, location.country].filter(Boolean).join(", "),
    grade: team.grade || "",
    registered: team.registered ?? null
  };
}

async function importLocalCompetition(eventId) {
  const event = syncedEvents.find(item => localEventId(item) === String(eventId));
  if (!event) throw new Error("That synced competition was not found. Search again after importing a fresh bundle.");

  setCompetitionStatus("Loading synced competition files...", "loading");
  const [eventPayload, teamsPayload, skillsPayload, awardsPayload, metaPayload] = await Promise.all([
    readLocalJson(event.paths?.event || `data/events/${eventId}/event.json`),
    readLocalJson(event.paths?.teams || `data/events/${eventId}/teams.json`),
    readLocalJson(event.paths?.skills || `data/events/${eventId}/skills.json`),
    readLocalJson(event.paths?.awards || `data/events/${eventId}/awards.json`),
    readLocalJson(event.paths?.meta || `data/events/${eventId}/meta.json`).catch(() => ({}))
  ]);

  const teams = Array.isArray(teamsPayload.data) ? teamsPayload.data.map(normalizeLocalTeam) : [];
  const skills = Array.isArray(skillsPayload.data) ? skillsPayload.data : [];
  const awards = Array.isArray(awardsPayload.data) ? awardsPayload.data : [];
  const eventData = eventPayload?.data || {};

  writeCompetitionData({
    eventId: event.eventId || eventData.id || eventId,
    eventCode: event.sku || eventData.sku || eventData.code || "",
    name: event.name || eventData.name || "Imported competition",
    date: competitionDateLabel(event),
    location: competitionLocation(event) || eventLocationFromData(eventPayload),
    eventRegionId: officialEventRegionId(event) || metaPayload?.eventRegion?.id || null,
    eventRegionName: officialEventRegionName(event) || metaPayload?.eventRegion?.name || "",
    loadedAt: new Date().toISOString(),
    teamCount: teams.length,
    skillCount: skills.length,
    awardCount: awards.length,
    teams,
    skills,
    awards,
    meta: metaPayload
  });
  renderImportedCompetition();
  setCompetitionStatus(`Imported ${teams.length} teams, ${skills.length} skills rows, and ${awards.length} awards from synced data.`, "ready");
  showToast("Competition data imported.");
}

async function importCompetitionFromProxy(eventId) {
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
    eventRegionId: event.eventRegionId || null,
    eventRegionName: event.eventRegionName || "",
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

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORE_KEY));
    if (saved && typeof saved.teamNumber === "string" && saved.teamNumber.trim()) {
      return {
        teamNumber: saved.teamNumber.trim(),
        teamName: typeof saved.teamName === "string" ? saved.teamName.trim() : "",
        teamSource: typeof saved.teamSource === "string" ? saved.teamSource : "",
        createdAt: saved.createdAt || new Date().toISOString()
      };
    }
  } catch {
    return null;
  }
  return null;
}

function saveProfile(teamNumber, teamName = "", teamSource = "") {
  const nextProfile = {
    teamNumber: teamNumber.trim(),
    teamName: teamName.trim(),
    teamSource,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(nextProfile));
  profile = nextProfile;
  return nextProfile;
}

async function findTeamInSyncedEvents(teamNumber) {
  await ensureSyncedTeamIndex();
  const entries = syncedTeamIndex?.byTeam.get(teamNumber.trim().toUpperCase()) || [];
  const namedEntry = entries.find(entry => entry.team?.teamName);
  if (!namedEntry) return null;
  return {
    teamNumber: namedEntry.team.teamNumber,
    teamName: namedEntry.team.teamName,
    teamSource: "synced-events"
  };
}

async function findTeamInSkills(teamNumber) {
  if (!vexProxyUrl()) return null;
  try {
    const payload = await vexProxyFetch(`/api/skills/search?q=${encodeURIComponent(teamNumber.trim())}`);
    const rows = Array.isArray(payload.skills) ? payload.skills : [];
    const match = rows.find(row => String(row.team?.teamNumber || "").toUpperCase() === teamNumber.trim().toUpperCase());
    if (!match?.team?.teamName) return null;
    return {
      teamNumber: match.team.teamNumber,
      teamName: match.team.teamName,
      teamSource: "skills"
    };
  } catch {
    return null;
  }
}

async function findTeamIdentity(teamNumber) {
  const localMatch = await findTeamInSyncedEvents(teamNumber).catch(() => null);
  if (localMatch) return localMatch;
  return findTeamInSkills(teamNumber).catch(() => null);
}

function renderSetupConfirmation(match) {
  const confirm = $("[data-setup-confirm]");
  const name = $("[data-setup-confirm-name]");
  const submit = $("[data-setup-submit]");
  if (!confirm || !name) return;
  pendingProfileMatch = match;
  name.textContent = `Are you ${match.teamNumber} ${match.teamName}?`;
  confirm.hidden = false;
  if (submit) submit.textContent = "Check Another Team";
}

function clearSetupConfirmation() {
  const confirm = $("[data-setup-confirm]");
  const submit = $("[data-setup-submit]");
  pendingProfileMatch = null;
  if (confirm) confirm.hidden = true;
  if (submit) submit.textContent = "Check Team";
}

function finishProfileSetup(nextProfile) {
  renderBanner();
  renderMyCompetitions();
  renderCompetitionResults(filteredSyncedEvents().slice(0, 12));
  closeSetupModal();
  showToast(nextProfile.teamName
    ? `${nextProfile.teamNumber} ${nextProfile.teamName} saved on this device.`
    : `Team ${nextProfile.teamNumber} saved on this device.`
  );
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

function midpointOwnerFromRobots(robots = {}) {
  const red = Number(Boolean(robots["red-1"])) + Number(Boolean(robots["red-2"]));
  const blue = Number(Boolean(robots["blue-1"])) + Number(Boolean(robots["blue-2"]));
  if (red > blue) return "red";
  if (blue > red) return "blue";
  return "neutral";
}

function scoreScorerSnapshot(scorer, alliance) {
  let score = 0;
  const centerOwner = midpointOwnerFromRobots(scorer.robots);

  if (scorer.auton === alliance) score += POINTS.auton;
  if (scorer.auton === "tie") score += POINTS.autonTie;

  quadrants.forEach((quadrant) => {
    const q = scorer.quadrants?.[quadrant] || { toggle: "neutral", yellow: 0, red: 0, blue: 0 };
    score += Number(q[alliance] || 0) * POINTS.alliancePin;
    const owner = quadrant === "center" ? centerOwner : q.toggle;
    if (owner === alliance) score += Number(q.yellow || 0) * POINTS.yellowPin;
  });

  Object.entries(scorer.robots || {}).forEach(([robotId, active]) => {
    if (active && robotId.startsWith(alliance)) score += POINTS.midfieldRobot;
  });

  return score;
}

function scoreSkillsSnapshot(snapshot) {
  const q = snapshot.quadrants;
  let score = 0;

  score += (q.left.red + q.bottom.red + q.center.red) * POINTS.alliancePin;
  score += (q.top.blue + q.right.blue + q.center.blue) * POINTS.alliancePin;

  if (snapshot.toggles.left === "red") score += q.left.yellow * POINTS.yellowPin;
  if (snapshot.toggles.bottom === "red") score += q.bottom.yellow * POINTS.yellowPin;
  if (snapshot.toggles.top === "blue") score += q.top.yellow * POINTS.yellowPin;
  if (snapshot.toggles.right === "blue") score += q.right.yellow * POINTS.yellowPin;

  if (snapshot.centerToggle) {
    score += POINTS.midfieldRobot;
    score += q.center.yellow * POINTS.yellowPin;
  }

  return score;
}

function sampleSavedDate(date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(16 + (days % 5), (days * 7) % 60, 0, 0);
  return date;
}

function seededRandom(seed) {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
}

function sampleQuadrants(seed) {
  return {
    top: { toggle: seed.topToggle, yellow: seed.topY, red: seed.topR, blue: seed.topB },
    right: { toggle: seed.rightToggle, yellow: seed.rightY, red: seed.rightR, blue: seed.rightB },
    bottom: { toggle: seed.bottomToggle, yellow: seed.bottomY, red: seed.bottomR, blue: seed.bottomB },
    left: { toggle: seed.leftToggle, yellow: seed.leftY, red: seed.leftR, blue: seed.leftB },
    center: { toggle: "neutral", yellow: seed.centerY, red: seed.centerR, blue: seed.centerB }
  };
}

function sampleHeadSeed(index, total) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const daysAgoValue = Math.round((1 - progress) * 104);
  const teamAlliance = index % 2 === 0 ? "blue" : "red";
  const roughMatch = index % 11 === 2 || index % 13 === 5;
  const closeLoss = index % 7 === 3 || index % 17 === 8;
  const upsetWin = index % 19 === 11;
  const strong = Math.min(1, Math.max(0, progress + (upsetWin ? .18 : 0) - (roughMatch ? .24 : 0)));
  const ourColor = teamAlliance;
  const opponentColor = teamAlliance === "red" ? "blue" : "red";
  const noise = seededRandom(index + 31);
  const ourBase = 1 + Math.floor(strong * 5) + (noise > .78 ? 1 : 0);
  const oppBase = Math.max(1, 5 - Math.floor(strong * 3)) + (closeLoss ? 3 : 0) + (roughMatch ? 1 : 0);
  const ourRobots = strong > .36 ? (index % 8 === 0 ? 1 : 2) : (index % 4 === 0 ? 1 : 0);
  const oppRobots = closeLoss || roughMatch ? 2 : (strong > .74 ? 0 : 1);
  const owned = ourColor;
  const notOwned = opponentColor;
  const seed = {
    daysAgo: daysAgoValue,
    teamAlliance,
    auton: strong > .68 ? ourColor : (roughMatch || closeLoss ? opponentColor : (index % 6 === 0 ? "tie" : "none")),
    redRobots: teamAlliance === "red" ? ourRobots : oppRobots,
    blueRobots: teamAlliance === "blue" ? ourRobots : oppRobots,
    topToggle: teamAlliance === "blue" ? owned : notOwned,
    rightToggle: teamAlliance === "blue" ? owned : (closeLoss ? notOwned : "neutral"),
    bottomToggle: teamAlliance === "red" ? owned : notOwned,
    leftToggle: teamAlliance === "red" ? owned : (closeLoss ? notOwned : "neutral"),
    topY: teamAlliance === "blue" ? Math.floor(strong * 4) : Math.floor(seededRandom(index + 1) * 2),
    topR: teamAlliance === "red" ? ourBase : Math.max(0, oppBase - 1),
    topB: teamAlliance === "blue" ? ourBase + Math.floor(strong * 2) : oppBase,
    rightY: teamAlliance === "blue" ? 1 + Math.floor(strong * 3) : Math.floor(seededRandom(index + 2) * 2),
    rightR: teamAlliance === "red" ? Math.max(0, ourBase - 1) : oppBase,
    rightB: teamAlliance === "blue" ? ourBase : Math.max(0, oppBase - 1),
    bottomY: teamAlliance === "red" ? 1 + Math.floor(strong * 3) : Math.floor(seededRandom(index + 3) * 2),
    bottomR: teamAlliance === "red" ? ourBase + Math.floor(strong * 2) : oppBase,
    bottomB: teamAlliance === "blue" ? Math.max(0, ourBase - 1) : Math.max(0, oppBase - 1),
    leftY: teamAlliance === "red" ? Math.floor(strong * 4) : Math.floor(seededRandom(index + 4) * 2),
    leftR: teamAlliance === "red" ? ourBase : Math.max(0, oppBase - 1),
    leftB: teamAlliance === "blue" ? Math.max(0, ourBase - 1) : oppBase,
    centerY: Math.floor(strong * 3),
    centerR: teamAlliance === "red" ? Math.floor(strong * 3) : Math.max(0, Math.floor((1 - strong) * 2)),
    centerB: teamAlliance === "blue" ? Math.floor(strong * 3) : Math.max(0, Math.floor((1 - strong) * 2)),
    partner: ["355V", "2055A", "169C", "1000A", "10K"][index % 5],
    opponentOne: ["169A", "32C", "96Z", "663A", "1468A"][index % 5],
    opponentTwo: ["227R", "10B", "471B", "886S", "1069A"][index % 5]
  };
  return seed;
}

function sampleSkillsSeed(index, total, skillsType) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const daysAgoValue = Math.round((1 - progress) * 96 + (skillsType === "autonomous" ? 1 : 0));
  const earlyMiss = index % 8 === 1 || index % 13 === 6;
  const lateClean = index > total * .68 && index % 5 !== 2;
  const route = Math.min(1, Math.max(0, progress + (lateClean ? .12 : 0) - (earlyMiss ? .25 : 0)));
  return {
    daysAgo: daysAgoValue,
    skillsType,
    centerToggle: route > .28,
    topToggle: route > .38 ? "blue" : "neutral",
    rightToggle: route > .58 ? "blue" : (route > .25 ? "neutral" : "red"),
    bottomToggle: route > .34 ? "red" : "neutral",
    leftToggle: route > .5 ? "red" : (route > .2 ? "neutral" : "blue"),
    topY: Math.floor(route * 3),
    topB: Math.floor(route * (skillsType === "driver" ? 5 : 3)),
    rightY: Math.floor(route * 3),
    rightB: Math.floor(route * (skillsType === "driver" ? 4 : 3)),
    bottomY: Math.floor(route * 3),
    bottomR: Math.floor(route * (skillsType === "driver" ? 5 : 3)),
    leftY: Math.floor(route * 3),
    leftR: Math.floor(route * (skillsType === "driver" ? 4 : 2)),
    centerY: Math.floor(route * 2),
    centerR: Math.floor(route * (skillsType === "driver" ? 2 : 1)),
    centerB: Math.floor(route * (skillsType === "driver" ? 2 : 1)),
    notes: route > .72
      ? `${skillsType === "driver" ? "Driver" : "Autonomous"} route is getting cleaner.`
      : `${skillsType === "driver" ? "Driver" : "Autonomous"} sample while tuning route.`
  };
}

function createSampleHeadRecord(seed) {
  const savedAt = daysAgo(seed.daysAgo);
  const scorer = {
    auton: seed.auton,
    robots: {
      "red-1": seed.redRobots >= 1,
      "red-2": seed.redRobots >= 2,
      "blue-1": seed.blueRobots >= 1,
      "blue-2": seed.blueRobots >= 2
    },
    quadrants: sampleQuadrants(seed)
  };
  const redScore = scoreScorerSnapshot(scorer, "red");
  const blueScore = scoreScorerSnapshot(scorer, "blue");
  const ourScore = seed.teamAlliance === "red" ? redScore : blueScore;
  const opponentScore = seed.teamAlliance === "red" ? blueScore : redScore;

  return {
    id: `dev-head-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
    savedAt: savedAt.toISOString(),
    savedDate: sampleSavedDate(savedAt),
    teamNumber: profile?.teamNumber || "4330P",
    teamAlliance: seed.teamAlliance,
    redScore,
    blueScore,
    ourScore,
    opponentScore,
    result: matchResult(ourScore, opponentScore),
    scorer,
    details: {
      ...blankDetails(),
      partnerTeam: seed.partner || "",
      opponentOne: seed.opponentOne || "",
      opponentTwo: seed.opponentTwo || ""
    }
  };
}

function createSampleSkillsRecord(seed) {
  const savedAt = daysAgo(seed.daysAgo);
  const skills = {
    centerToggle: seed.centerToggle,
    toggles: {
      top: seed.topToggle,
      right: seed.rightToggle,
      bottom: seed.bottomToggle,
      left: seed.leftToggle
    },
    quadrants: {
      top: { yellow: seed.topY, red: 0, blue: seed.topB },
      right: { yellow: seed.rightY, red: 0, blue: seed.rightB },
      bottom: { yellow: seed.bottomY, red: seed.bottomR, blue: 0 },
      left: { yellow: seed.leftY, red: seed.leftR, blue: 0 },
      center: { yellow: seed.centerY, red: seed.centerR, blue: seed.centerB }
    }
  };

  return {
    id: `dev-skills-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
    mode: "skills",
    savedAt: savedAt.toISOString(),
    savedDate: sampleSavedDate(savedAt),
    teamNumber: profile?.teamNumber || "4330P",
    skillsType: seed.skillsType,
    score: scoreSkillsSnapshot(skills),
    skills,
    notes: seed.notes || ""
  };
}

function seedSampleData() {
  const headSeeds = Array.from({ length: 48 }, (_, index) => sampleHeadSeed(index, 48));
  const skillsSeeds = [
    ...Array.from({ length: 24 }, (_, index) => sampleSkillsSeed(index, 24, "driver")),
    ...Array.from({ length: 20 }, (_, index) => sampleSkillsSeed(index, 20, "autonomous"))
  ];

  const nextMatches = [
    ...savedMatches().filter(record => !String(record.id || "").startsWith("dev-")),
    ...headSeeds.map(createSampleHeadRecord),
    ...skillsSeeds.map(createSampleSkillsRecord)
  ];
  writeSavedMatches(nextMatches);
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  showToast("Sample dev data rebuilt.");
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
  renderAnalysis();
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
  renderAnalysis();
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
  activeMode = ["head", "skills", "scouting", "analysis"].includes(mode) ? mode : "head";
  renderMode();
}

function renderMode() {
  $$("[data-mode-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeChoice === activeMode));
  });

  $$("[data-mode-section]").forEach((section) => {
    const isActive = section.dataset.modeSection === activeMode;
    section.hidden = !isActive;
    section.classList.toggle("is-active-mode-section", isActive);
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

function recordTimestamp(record) {
  const timestamp = new Date(record?.savedAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localDayStart(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateInputStart(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dateInputEnd(value) {
  const start = dateInputStart(value);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

function analysisRangeBounds() {
  const today = localDayStart();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (analysisRange === "today") {
    return { start: today, end: tomorrow };
  }

  if (analysisRange === "7" || analysisRange === "30") {
    const days = Number(analysisRange);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    return { start, end: tomorrow };
  }

  if (analysisRange === "custom") {
    return {
      start: dateInputStart($("[data-analysis-start]")?.value || ""),
      end: dateInputEnd($("[data-analysis-end]")?.value || "")
    };
  }

  return { start: null, end: null };
}

function filterAnalysisRecords(records) {
  const { start, end } = analysisRangeBounds();
  const startTime = start ? start.getTime() : null;
  const endTime = end ? end.getTime() : null;

  return records.filter((record) => {
    const timestamp = recordTimestamp(record);
    if (!timestamp) return false;
    if (startTime !== null && timestamp < startTime) return false;
    if (endTime !== null && timestamp >= endTime) return false;
    return true;
  });
}

function average(values) {
  const numbers = values.filter(value => Number.isFinite(value));
  if (!numbers.length) return null;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function median(values) {
  const numbers = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  if (numbers.length % 2) return numbers[middle];
  return (numbers[middle - 1] + numbers[middle]) / 2;
}

function formatAnalysisNumber(value, suffix = "") {
  if (!Number.isFinite(value)) return "--";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${suffix}`;
}

function analysisScoreStats(records, scoreGetter) {
  const scoredRecords = records
    .map(record => ({ record, score: numericValue(scoreGetter(record)) }))
    .filter(item => Number.isFinite(item.score));
  const values = scoredRecords.map(item => item.score);
  const recentValues = scoredRecords
    .slice()
    .sort((a, b) => recordTimestamp(b.record) - recordTimestamp(a.record))
    .slice(0, 5)
    .map(item => item.score);

  return {
    count: values.length,
    mean: average(values),
    best: values.length ? Math.max(...values) : null,
    worst: values.length ? Math.min(...values) : null,
    median: median(values),
    recentMean: average(recentValues),
    recentCount: recentValues.length
  };
}

function percentile(values, amount) {
  const numbers = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const index = (numbers.length - 1) * amount;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return numbers[lower];
  return numbers[lower] + (numbers[upper] - numbers[lower]) * (index - lower);
}

function analysisStat(label, value, detail = "") {
  return `
    <div class="analysis-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      ${detail ? `<small>${detail}</small>` : ""}
    </div>
  `;
}

function recentFormDetail(stats) {
  if (!Number.isFinite(stats.recentMean) || !Number.isFinite(stats.mean)) return "";
  const delta = stats.recentMean - stats.mean;
  const sign = delta > 0 ? "+" : "";
  return `last ${stats.recentCount}, ${sign}${formatAnalysisNumber(delta)} vs range avg`;
}

function analysisInsightCard(title, body, stat = "") {
  return `
    <div class="analysis-insight-card">
      <span>${escapeHtml(title)}</span>
      ${stat ? `<strong>${escapeHtml(stat)}</strong>` : ""}
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function analysisMiniRow(label, value, detail = "") {
  return `
    <div class="analysis-mini-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function renderAnalysisMode() {
  $$("[data-analysis-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.analysisMode === analysisMode));
  });

  $$("[data-analysis-section]").forEach((section) => {
    const isActive = section.dataset.analysisSection === analysisMode;
    section.hidden = !isActive;
    section.classList.toggle("is-active-analysis-section", isActive);
  });
}

function renderAnalysisRange() {
  $$("[data-analysis-range]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.analysisRange === analysisRange));
  });

  const custom = $("[data-analysis-custom]");
  if (custom) custom.hidden = analysisRange !== "custom";
}

function ourAlliancePins(match) {
  const alliance = match.teamAlliance;
  if (alliance !== "red" && alliance !== "blue") return null;
  const scorer = match.scorer || {};
  return quadrants.reduce((total, quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    return total + numericValue(q[alliance]);
  }, 0);
}

function opponentAlliance(match) {
  if (match.teamAlliance === "red") return "blue";
  if (match.teamAlliance === "blue") return "red";
  return null;
}

function quadrantData(record, quadrant) {
  return record?.scorer?.quadrants?.[quadrant] || {};
}

function quadrantPins(record, quadrant) {
  const q = quadrantData(record, quadrant);
  return colors.reduce((total, color) => total + numericValue(q[color]), 0);
}

function alliancePinsInQuadrant(match, quadrant, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  return numericValue(quadrantData(match, quadrant)[alliance]);
}

function yellowPinsInQuadrant(match, quadrant) {
  return numericValue(quadrantData(match, quadrant).yellow);
}

function ownedYellowPinsInQuadrant(match, quadrant, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  const q = quadrantData(match, quadrant);
  const owner = quadrant === "center" ? midpointOwnerFromRobots(match.scorer?.robots || {}) : q.toggle;
  return owner === alliance ? numericValue(q.yellow) : 0;
}

function yellowPins(match) {
  return quadrants.reduce((total, quadrant) => total + yellowPinsInQuadrant(match, quadrant), 0);
}

function totalRedBluePins(match) {
  return quadrants.reduce((total, quadrant) => {
    const q = quadrantData(match, quadrant);
    return total + numericValue(q.red) + numericValue(q.blue);
  }, 0);
}

function totalPins(match) {
  return quadrants.reduce((total, quadrant) => total + quadrantPins(match, quadrant), 0);
}

function opponentAlliancePins(match) {
  const alliance = opponentAlliance(match);
  if (!alliance) return null;
  const scorer = match.scorer || {};
  return quadrants.reduce((total, quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    return total + numericValue(q[alliance]);
  }, 0);
}

function opponentOwnedYellowPins(match) {
  return ownedYellowPins(match, opponentAlliance(match));
}

function ownedYellowPins(match, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  const scorer = match.scorer || {};
  const centerOwner = midpointOwnerFromRobots(scorer.robots || {});
  return quadrants.reduce((total, quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    const owner = quadrant === "center" ? centerOwner : q.toggle;
    return owner === alliance ? total + numericValue(q.yellow) : total;
  }, 0);
}

function outerToggleOwnedCount(match, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  return ["top", "right", "bottom", "left"].reduce((total, quadrant) => {
    return total + (match.scorer?.quadrants?.[quadrant]?.toggle === alliance ? 1 : 0);
  }, 0);
}

function centerControlledByUs(match) {
  return midpointOwnerFromRobots(match.scorer?.robots || {}) === match.teamAlliance ? 1 : 0;
}

function ourMidfieldRobots(match) {
  const alliance = match.teamAlliance;
  if (alliance !== "red" && alliance !== "blue") return null;
  return Object.entries(match.scorer?.robots || {}).reduce((total, [robotId, active]) => {
    return active && robotId.startsWith(alliance) ? total + 1 : total;
  }, 0);
}

function opponentMidfieldRobots(match) {
  const alliance = opponentAlliance(match);
  if (!alliance) return null;
  return Object.entries(match.scorer?.robots || {}).reduce((total, [robotId, active]) => {
    return active && robotId.startsWith(alliance) ? total + 1 : total;
  }, 0);
}

function autonPoints(match) {
  const auton = match.scorer?.auton || match.auton;
  const alliance = match.teamAlliance;
  if (auton === "tie") return POINTS.autonTie;
  if (auton === alliance) return POINTS.auton;
  return 0;
}

function autonWon(match) {
  return (match.scorer?.auton || match.auton) === match.teamAlliance ? 1 : 0;
}

function autonLost(match) {
  return (match.scorer?.auton || match.auton) === opponentAlliance(match) ? 1 : 0;
}

function autonTied(match) {
  return (match.scorer?.auton || match.auton) === "tie" ? 1 : 0;
}

function skillsRedBluePins(run) {
  const q = run.skills?.quadrants || {};
  return skillsQuadrants.reduce((total, quadrant) => {
    return total + numericValue(q[quadrant]?.red) + numericValue(q[quadrant]?.blue);
  }, 0);
}

function skillsColorPins(run, color) {
  const q = run.skills?.quadrants || {};
  return skillsQuadrants.reduce((total, quadrant) => total + numericValue(q[quadrant]?.[color]), 0);
}

function skillsPinsInQuadrant(run, quadrant) {
  const q = run.skills?.quadrants?.[quadrant] || {};
  return colors.reduce((total, color) => total + numericValue(q[color]), 0);
}

function skillsYellowPins(run) {
  const q = run.skills?.quadrants || {};
  return skillsQuadrants.reduce((total, quadrant) => total + numericValue(q[quadrant]?.yellow), 0);
}

function skillsScoredYellowPins(run) {
  const q = run.skills?.quadrants || {};
  const toggles = run.skills?.toggles || {};
  let total = 0;
  if (toggles.left === "red") total += numericValue(q.left?.yellow);
  if (toggles.bottom === "red") total += numericValue(q.bottom?.yellow);
  if (toggles.top === "blue") total += numericValue(q.top?.yellow);
  if (toggles.right === "blue") total += numericValue(q.right?.yellow);
  if (run.skills?.centerToggle) total += numericValue(q.center?.yellow);
  return total;
}

function skillsTotalPins(run) {
  return skillsQuadrants.reduce((total, quadrant) => total + skillsPinsInQuadrant(run, quadrant), 0);
}

function skillsCorrectYellowOwnership(run) {
  const toggles = run.skills?.toggles || {};
  let total = 0;
  if (toggles.left === "red") total += 1;
  if (toggles.bottom === "red") total += 1;
  if (toggles.top === "blue") total += 1;
  if (toggles.right === "blue") total += 1;
  if (run.skills?.centerToggle) total += 1;
  return total;
}

function skillsMissedYellowPins(run) {
  return skillsYellowPins(run) - skillsScoredYellowPins(run);
}

const headCorrelationOptions = [
  {
    group: "Score",
    options: [
      { key: "ourScore", label: "Our score", get: match => numericValue(match.ourScore) },
      { key: "opponentScore", label: "Opponent score", get: match => numericValue(match.opponentScore) },
      { key: "margin", label: "Score margin", get: match => numericValue(match.ourScore) - numericValue(match.opponentScore) },
      { key: "totalMatchScore", label: "Total match score", get: match => numericValue(match.redScore) + numericValue(match.blueScore) },
      { key: "win", label: "Win result", get: match => match.result === "win" ? 1 : match.result === "loss" ? 0 : .5 }
    ]
  },
  {
    group: "Pins",
    options: [
      { key: "alliancePins", label: "Our red/blue pins", get: ourAlliancePins },
      { key: "opponentPins", label: "Opponent red/blue pins", get: opponentAlliancePins },
      { key: "totalRedBluePins", label: "Total red + blue pins", get: totalRedBluePins },
      { key: "totalPins", label: "Total pins placed", get: totalPins },
      { key: "ownedYellow", label: "Our owned yellow pins", get: match => ownedYellowPins(match) },
      { key: "opponentOwnedYellow", label: "Opponent owned yellow pins", get: opponentOwnedYellowPins },
      { key: "yellowPins", label: "Yellow pins placed", get: yellowPins }
    ]
  },
  {
    group: "Zones",
    options: [
      ...["top", "right", "bottom", "left", "center"].flatMap(quadrant => [
        { key: `${quadrant}TotalPins`, label: `${capitalize(quadrant)} zone total pins`, get: match => quadrantPins(match, quadrant) },
        { key: `${quadrant}OurPins`, label: `Our pins in ${quadrant}`, get: match => alliancePinsInQuadrant(match, quadrant) },
        { key: `${quadrant}OpponentPins`, label: `Opponent pins in ${quadrant}`, get: match => alliancePinsInQuadrant(match, quadrant, opponentAlliance(match)) },
        { key: `${quadrant}OwnedYellow`, label: `Owned yellow pins in ${quadrant}`, get: match => ownedYellowPinsInQuadrant(match, quadrant) }
      ])
    ]
  },
  {
    group: "Control",
    options: [
      { key: "ourOuterToggles", label: "Our outer toggles owned", get: match => outerToggleOwnedCount(match) },
      { key: "opponentOuterToggles", label: "Opponent outer toggles owned", get: match => outerToggleOwnedCount(match, opponentAlliance(match)) },
      { key: "centerControl", label: "Center controlled by us", get: centerControlledByUs },
      { key: "midfieldRobots", label: "Our midfield robots", get: ourMidfieldRobots },
      { key: "opponentMidfieldRobots", label: "Opponent midfield robots", get: opponentMidfieldRobots }
    ]
  },
  {
    group: "Autonomous",
    options: [
      { key: "autonPoints", label: "Auton points", get: autonPoints },
      { key: "autonWon", label: "Won auton", get: autonWon },
      { key: "autonLost", label: "Lost auton", get: autonLost },
      { key: "autonTied", label: "Tied auton", get: autonTied }
    ]
  }
];

const skillsCorrelationOptions = [
  {
    group: "Score",
    options: [
      { key: "score", label: "Skills score", get: run => numericValue(run.score) },
      { key: "driverRun", label: "Driver run", get: run => run.skillsType === "driver" ? 1 : 0 },
      { key: "autonRun", label: "Autonomous run", get: run => run.skillsType === "autonomous" ? 1 : 0 }
    ]
  },
  {
    group: "Pins",
    options: [
      { key: "redBluePins", label: "Total red + blue pins", get: skillsRedBluePins },
      { key: "redPins", label: "Red pins scored", get: run => skillsColorPins(run, "red") },
      { key: "bluePins", label: "Blue pins scored", get: run => skillsColorPins(run, "blue") },
      { key: "yellowPins", label: "Yellow pins placed", get: skillsYellowPins },
      { key: "scoredYellow", label: "Yellow pins scored", get: skillsScoredYellowPins },
      { key: "totalPins", label: "Total pins placed", get: skillsTotalPins }
    ]
  },
  {
    group: "Zones",
    options: skillsQuadrants.map(quadrant => ({
      key: `${quadrant}Pins`,
      label: `${capitalize(quadrant)} zone pins`,
      get: run => skillsPinsInQuadrant(run, quadrant)
    }))
  },
  {
    group: "Control",
    options: [
      { key: "midfield", label: "Center toggle active", get: run => run.skills?.centerToggle ? 1 : 0 },
      { key: "correctYellowOwnership", label: "Correct yellow ownership count", get: skillsCorrectYellowOwnership },
      { key: "missedYellowPins", label: "Missed yellow pins", get: skillsMissedYellowPins }
    ]
  }
];

function flatCorrelationOptions(groups) {
  return groups.flatMap(group => group.options);
}

function correlationOptionsHtml(groups, selected) {
  return groups.map(group => `
    <optgroup label="${escapeHtml(group.group)}">
      ${group.options.map(option => `
        <option value="${escapeHtml(option.key)}" ${option.key === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>
      `).join("")}
    </optgroup>
  `).join("");
}

function pearsonCorrelation(pairs) {
  if (pairs.length < 3) return null;
  const xs = pairs.map(pair => pair.x);
  const ys = pairs.map(pair => pair.y);
  const meanX = average(xs);
  const meanY = average(ys);
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  pairs.forEach(({ x, y }) => {
    const dx = x - meanX;
    const dy = y - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  });
  const denominator = Math.sqrt(denomX * denomY);
  if (!denominator) return null;
  return numerator / denominator;
}

function correlationLabel(value) {
  if (!Number.isFinite(value)) return "Not enough variation yet";
  const strength = Math.abs(value);
  const direction = value > 0 ? "positive" : value < 0 ? "negative" : "flat";
  if (strength >= .75) return `Strong ${direction}`;
  if (strength >= .45) return `Moderate ${direction}`;
  if (strength >= .22) return `Weak ${direction}`;
  return "Little relationship";
}

function correlationValue(records, optionX, optionY) {
  const pairs = records
    .map(record => ({ x: numericValue(optionX.get(record)), y: numericValue(optionY.get(record)) }))
    .filter(pair => Number.isFinite(pair.x) && Number.isFinite(pair.y));
  return { r: pearsonCorrelation(pairs), count: pairs.length };
}

function renderCorrelation(records, options, selectedX, selectedY, mode) {
  const flatOptions = flatCorrelationOptions(options);
  const optionX = flatOptions.find(option => option.key === selectedX) || flatOptions[0];
  const optionY = flatOptions.find(option => option.key === selectedY) || flatOptions[1] || flatOptions[0];
  const { r, count } = correlationValue(records, optionX, optionY);
  const prettyR = Number.isFinite(r) ? r.toFixed(2) : "--";

  return `
    <div class="analysis-trend-head">
      <span>Correlation builder</span>
      <small>Uses this date range</small>
    </div>
    <div class="analysis-correlation-controls">
      <label>
        <span>Compare</span>
        <select data-correlation-axis="${mode}:x">${correlationOptionsHtml(options, optionX.key)}</select>
      </label>
      <label>
        <span>Against</span>
        <select data-correlation-axis="${mode}:y">${correlationOptionsHtml(options, optionY.key)}</select>
      </label>
    </div>
    <div class="analysis-correlation-result">
      <strong>${correlationLabel(r)}</strong>
      <span>r = ${prettyR} from ${count} saved ${mode === "head" ? "matches" : "runs"}</span>
      <small>Positive means the two numbers rise together. Negative means one tends to rise when the other falls.</small>
    </div>
  `;
}

function scoreGetterValues(records, getter) {
  return records
    .map(record => numericValue(getter(record)))
    .filter(value => Number.isFinite(value));
}

function resultAverage(records, getter) {
  return average(scoreGetterValues(records, getter));
}

function averageObject(items, key) {
  return average(items.map(item => numericValue(item[key])).filter(value => Number.isFinite(value)));
}

function renderWinFactors(matches) {
  const winOption = flatCorrelationOptions(headCorrelationOptions).find(option => option.key === "win");
  const candidates = flatCorrelationOptions(headCorrelationOptions)
    .filter(option => !["win", "ourScore", "opponentScore"].includes(option.key))
    .map(option => ({ option, ...correlationValue(matches, option, winOption) }))
    .filter(item => item.count >= 6 && Number.isFinite(item.r))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 4);

  if (!candidates.length) {
    return analysisInsightCard("Win factors", "Save more varied matches to identify what is most tied to winning.", "Learning");
  }

  return `
    <div class="analysis-insight-card analysis-insight-wide">
      <span>Win factors</span>
      <strong>Top ${candidates.length}</strong>
      <p>The strongest simple relationships with winning in this range.</p>
      <div class="analysis-mini-list">
        ${candidates.map(item => analysisMiniRow(item.option.label, item.r.toFixed(2), correlationLabel(item.r))).join("")}
      </div>
    </div>
  `;
}

function missedHeadPoints(match) {
  const alliance = match.teamAlliance;
  const opponent = opponentAlliance(match);
  const scorer = match.scorer || {};
  const centerOwner = midpointOwnerFromRobots(scorer.robots || {});
  let unownedYellow = 0;
  ["top", "right", "bottom", "left"].forEach((quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    if (q.toggle !== alliance) unownedYellow += numericValue(q.yellow) * POINTS.yellowPin;
  });
  const centerYellow = scorer.quadrants?.center?.yellow || 0;
  if (centerOwner !== alliance) unownedYellow += numericValue(centerYellow) * POINTS.yellowPin;

  const auton = scorer.auton || match.auton;
  const autonGap = auton === alliance ? 0 : auton === "tie" ? POINTS.autonTie : POINTS.auton;
  const missingRobots = Math.max(0, 2 - numericValue(ourMidfieldRobots(match))) * POINTS.midfieldRobot;
  const missingCenter = centerOwner === alliance ? 0 : POINTS.midfieldRobot;

  return {
    unownedYellow,
    autonGap,
    missingRobots,
    missingCenter,
    total: unownedYellow + autonGap + missingRobots + missingCenter,
    opponent
  };
}

function renderHeadMissedPoints(matches) {
  const missed = matches.map(missedHeadPoints);
  const total = averageObject(missed, "total");
  return analysisInsightCard(
    "Missed points",
    "Estimated points left from unowned yellows, lost or tied auton, and missing midfield robots/control.",
    `${formatAnalysisNumber(total)} avg`
  );
}

function renderAutonReliability(matches) {
  const wins = matches.filter(autonWon);
  const losses = matches.filter(autonLost);
  const ties = matches.filter(autonTied);
  const margin = group => formatAnalysisNumber(resultAverage(group, match => numericValue(match.ourScore) - numericValue(match.opponentScore)));
  return `
    <div class="analysis-insight-card analysis-insight-wide">
      <span>Auton reliability</span>
      <strong>${formatAnalysisNumber((wins.length / matches.length) * 100, "%")} won</strong>
      <p>Auton outcome compared with final margin.</p>
      <div class="analysis-mini-list">
        ${analysisMiniRow("Won auton", `${wins.length}`, `avg margin ${margin(wins)}`)}
        ${analysisMiniRow("Tied auton", `${ties.length}`, `avg margin ${margin(ties)}`)}
        ${analysisMiniRow("Lost auton", `${losses.length}`, `avg margin ${margin(losses)}`)}
      </div>
    </div>
  `;
}

function renderCenterImpact(matches) {
  const controlled = matches.filter(match => centerControlledByUs(match));
  const notControlled = matches.filter(match => !centerControlledByUs(match));
  const controlledMargin = resultAverage(controlled, match => numericValue(match.ourScore) - numericValue(match.opponentScore));
  const notMargin = resultAverage(notControlled, match => numericValue(match.ourScore) - numericValue(match.opponentScore));
  const swing = Number.isFinite(controlledMargin) && Number.isFinite(notMargin) ? controlledMargin - notMargin : null;
  return analysisInsightCard(
    "Center control impact",
    `Avg margin with center: ${formatAnalysisNumber(controlledMargin)}. Without center: ${formatAnalysisNumber(notMargin)}.`,
    `${formatAnalysisNumber(swing)} swing`
  );
}

function renderYellowEfficiency(matches) {
  const placed = matches.reduce((total, match) => total + yellowPins(match), 0);
  const scored = matches.reduce((total, match) => total + numericValue(ownedYellowPins(match)), 0);
  const rate = placed ? (scored / placed) * 100 : null;
  return analysisInsightCard(
    "Toggle/yellows efficiency",
    `${scored} of ${placed} yellow pins counted for your alliance in this range.`,
    formatAnalysisNumber(rate, "%")
  );
}

function renderFloorCeiling(records, getter, title) {
  const values = scoreGetterValues(records, getter);
  return analysisInsightCard(
    title,
    "A realistic low/high range using saved-score percentiles, less jumpy than raw worst and best.",
    `${formatAnalysisNumber(percentile(values, .2))} - ${formatAnalysisNumber(percentile(values, .8))}`
  );
}

function previousRangeRecords(records) {
  const bounds = analysisRangeBounds();
  const sorted = records.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  if (!bounds) {
    const midpoint = Math.floor(sorted.length / 2);
    return { current: sorted.slice(midpoint), previous: sorted.slice(0, midpoint) };
  }
  const span = bounds.end - bounds.start;
  const previousStart = bounds.start - span;
  const previousEnd = bounds.start;
  return {
    current: sorted.filter(record => {
      const time = recordTimestamp(record);
      return time >= bounds.start && time <= bounds.end;
    }),
    previous: sorted.filter(record => {
      const time = recordTimestamp(record);
      return time >= previousStart && time < previousEnd;
    })
  };
}

function renderProgressCard(records, getter, title) {
  const { current, previous } = previousRangeRecords(records);
  const currentAvg = resultAverage(current, getter);
  const previousAvg = resultAverage(previous, getter);
  const delta = Number.isFinite(currentAvg) && Number.isFinite(previousAvg) ? currentAvg - previousAvg : null;
  const sign = delta > 0 ? "+" : "";
  return analysisInsightCard(
    title,
    previous.length ? `Previous comparable range averaged ${formatAnalysisNumber(previousAvg)}.` : "Need earlier saved data for a previous-range comparison.",
    Number.isFinite(delta) ? `${sign}${formatAnalysisNumber(delta)}` : "--"
  );
}

function renderBestMatchBlueprint(matches) {
  const best = matches
    .slice()
    .sort((a, b) => numericValue(b.ourScore) - numericValue(a.ourScore))
    .slice(0, 3);
  if (!best.length) return "";
  const avgAlliancePins = resultAverage(best, ourAlliancePins);
  const avgYellows = resultAverage(best, match => ownedYellowPins(match));
  const centerCount = best.filter(centerControlledByUs).length;
  const autonCount = best.filter(autonWon).length;
  return analysisInsightCard(
    "Best match blueprint",
    `Your best 3 averaged ${formatAnalysisNumber(avgAlliancePins)} red/blue pins and ${formatAnalysisNumber(avgYellows)} owned yellows. Center was controlled ${centerCount}/3 times; auton won ${autonCount}/3.`,
    `${formatAnalysisNumber(resultAverage(best, match => match.ourScore))} avg`
  );
}

function renderHeadInsights(matches, allMatches) {
  if (!matches.length) return "";
  return [
    renderWinFactors(matches),
    renderHeadMissedPoints(matches),
    renderAutonReliability(matches),
    renderCenterImpact(matches),
    renderYellowEfficiency(matches),
    renderFloorCeiling(matches, match => match.ourScore, "Floor / ceiling"),
    renderProgressCard(allMatches, match => match.ourScore, "Weekly progress"),
    renderBestMatchBlueprint(matches)
  ].join("");
}

function renderSkillsMissedPoints(runs) {
  const missed = runs.reduce((total, run) => total + skillsMissedYellowPins(run), 0);
  const placed = runs.reduce((total, run) => total + skillsYellowPins(run), 0);
  const rate = placed ? ((placed - missed) / placed) * 100 : null;
  return analysisInsightCard(
    "Yellow conversion",
    `${placed - missed} of ${placed} yellow pins scored under the Skills ownership rules.`,
    formatAnalysisNumber(rate, "%")
  );
}

function renderSkillsRouteProgress(runs) {
  const sorted = runs.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  const driver = sorted.filter(run => run.skillsType === "driver");
  const auton = sorted.filter(run => run.skillsType === "autonomous");
  const splitDelta = group => {
    if (group.length < 4) return null;
    const midpoint = Math.floor(group.length / 2);
    return resultAverage(group.slice(midpoint), run => run.score) - resultAverage(group.slice(0, midpoint), run => run.score);
  };
  const driverDelta = splitDelta(driver);
  const autonDelta = splitDelta(auton);
  return `
    <div class="analysis-insight-card analysis-insight-wide">
      <span>Skills route progress</span>
      <strong>${runs.length} runs</strong>
      <p>Compares newer runs against older runs separately for Driver and Autonomous.</p>
      <div class="analysis-mini-list">
        ${analysisMiniRow("Driver trend", Number.isFinite(driverDelta) ? `${driverDelta > 0 ? "+" : ""}${formatAnalysisNumber(driverDelta)}` : "--", `${driver.length} runs`)}
        ${analysisMiniRow("Autonomous trend", Number.isFinite(autonDelta) ? `${autonDelta > 0 ? "+" : ""}${formatAnalysisNumber(autonDelta)}` : "--", `${auton.length} runs`)}
      </div>
    </div>
  `;
}

function renderSkillsInsights(runs, allRuns) {
  if (!runs.length) return "";
  return [
    renderSkillsMissedPoints(runs),
    renderFloorCeiling(runs, run => run.score, "Floor / ceiling"),
    renderProgressCard(allRuns, run => run.score, "Weekly progress"),
    renderSkillsRouteProgress(runs)
  ].join("");
}

function sparklineSvg(records, scoreGetter) {
  const entries = records
    .slice()
    .sort((a, b) => recordTimestamp(a) - recordTimestamp(b))
    .map(record => ({ record, score: numericValue(scoreGetter(record)) }))
    .filter(item => Number.isFinite(item.score));
  const points = entries.map(item => item.score);

  if (points.length < 2) {
    return `<p class="analysis-empty-mini">Need at least 2 records for a trend.</p>`;
  }

  const width = 360;
  const height = 92;
  const pad = 12;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  const step = points.length === 1 ? 0 : (width - pad * 2) / (points.length - 1);
  const coordinates = points.map((score, index) => {
    const x = pad + index * step;
    const y = height - pad - ((score - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const dots = points.map((score, index) => {
    const x = pad + index * step;
    const y = height - pad - ((score - min) / range) * (height - pad * 2);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" />`;
  }).join("");

  return `
    <div class="analysis-chart-wrap">
      <div class="analysis-chart-labels">
        <span>Low ${formatAnalysisNumber(min)}</span>
        <span>High ${formatAnalysisNumber(max)}</span>
      </div>
      <svg class="analysis-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Score trend">
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
        <polyline points="${coordinates}" />
        ${dots}
      </svg>
      <div class="analysis-chart-labels">
        <span>Oldest ${formatAnalysisNumber(points[0])}</span>
        <span>Newest ${formatAnalysisNumber(points[points.length - 1])}</span>
      </div>
    </div>
  `;
}

function renderTrend(records, scoreGetter) {
  return `
    <div class="analysis-trend-head">
      <span>Score trend</span>
      <small>Dots are saved records from oldest to newest.</small>
    </div>
    ${sparklineSvg(records, scoreGetter)}
  `;
}

function renderHeadAnalysis(allMatches, matches) {
  const summary = $("[data-analysis-head-summary]");
  const count = $("[data-analysis-head-count]");
  const statsWrap = $("[data-analysis-head-stats]");
  const trendWrap = $("[data-analysis-head-trend]");
  const correlationWrap = $("[data-analysis-head-correlation]");
  const insightsWrap = $("[data-analysis-head-insights]");
  if (!summary || !count || !statsWrap || !trendWrap || !correlationWrap || !insightsWrap) return;

  count.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;
  if (!allMatches.length) {
    summary.textContent = "Save matches to unlock head-on-head analysis.";
    statsWrap.innerHTML = `<p class="analysis-empty">Save head-on-head matches to unlock this panel.</p>`;
    trendWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    return;
  }

  if (!matches.length) {
    summary.textContent = "No saved data in this range.";
    statsWrap.innerHTML = `<p class="analysis-empty">No saved data in this range.</p>`;
    trendWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    return;
  }

  const stats = analysisScoreStats(matches, match => match.ourScore);
  const wins = matches.filter(match => match.result === "win").length;
  const losses = matches.filter(match => match.result === "loss").length;
  const ties = matches.filter(match => match.result === "tie").length;
  const winRate = matches.length ? (wins / matches.length) * 100 : null;

  summary.textContent = `Averaging ${formatAnalysisNumber(stats.mean)} points across this range.`;
  statsWrap.innerHTML = [
    analysisStat("Mean score", formatAnalysisNumber(stats.mean)),
    analysisStat("Win rate", formatAnalysisNumber(winRate, "%"), `${wins}W ${losses}L ${ties}T`),
    analysisStat("Best", formatAnalysisNumber(stats.best)),
    analysisStat("Median", formatAnalysisNumber(stats.median)),
    analysisStat("Worst", formatAnalysisNumber(stats.worst)),
    analysisStat("Recent form", formatAnalysisNumber(stats.recentMean), recentFormDetail(stats))
  ].join("");
  trendWrap.innerHTML = renderTrend(matches, match => match.ourScore);
  correlationWrap.innerHTML = renderCorrelation(matches, headCorrelationOptions, headCorrelationX, headCorrelationY, "head");
  insightsWrap.innerHTML = `
    <p class="analysis-helper">Recent form compares your most recent 5 saved records in this range against your average for the selected range.</p>
    ${renderHeadInsights(matches, allMatches)}
  `;
}

function renderSkillsAnalysis(allRuns, runs) {
  const summary = $("[data-analysis-skills-summary]");
  const count = $("[data-analysis-skills-count]");
  const statsWrap = $("[data-analysis-skills-stats]");
  const splitWrap = $("[data-analysis-skills-split]");
  const trendWrap = $("[data-analysis-skills-trend]");
  const correlationWrap = $("[data-analysis-skills-correlation]");
  const insightsWrap = $("[data-analysis-skills-insights]");
  if (!summary || !count || !statsWrap || !splitWrap || !trendWrap || !correlationWrap || !insightsWrap) return;

  count.textContent = `${runs.length} ${runs.length === 1 ? "run" : "runs"}`;
  if (!allRuns.length) {
    summary.textContent = "Save Skills runs to unlock Skills analysis.";
    statsWrap.innerHTML = `<p class="analysis-empty">Save Skills runs to unlock this panel.</p>`;
    splitWrap.innerHTML = "";
    trendWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    return;
  }

  if (!runs.length) {
    summary.textContent = "No saved data in this range.";
    statsWrap.innerHTML = `<p class="analysis-empty">No saved data in this range.</p>`;
    splitWrap.innerHTML = "";
    trendWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    return;
  }

  const stats = analysisScoreStats(runs, run => run.score);
  const driverScores = runs
    .filter(run => run.skillsType === "driver")
    .map(run => numericValue(run.score))
    .filter(value => Number.isFinite(value));
  const autonScores = runs
    .filter(run => run.skillsType === "autonomous")
    .map(run => numericValue(run.score))
    .filter(value => Number.isFinite(value));
  const bestDriver = driverScores.length ? Math.max(...driverScores) : null;
  const bestAuton = autonScores.length ? Math.max(...autonScores) : null;
  const theoretical = Number.isFinite(bestDriver) || Number.isFinite(bestAuton)
    ? (bestDriver || 0) + (bestAuton || 0)
    : null;

  summary.textContent = `Averaging ${formatAnalysisNumber(stats.mean)} points across this range.`;
  statsWrap.innerHTML = [
    analysisStat("Mean score", formatAnalysisNumber(stats.mean)),
    analysisStat("Best", formatAnalysisNumber(stats.best)),
    analysisStat("Median", formatAnalysisNumber(stats.median)),
    analysisStat("Worst", formatAnalysisNumber(stats.worst)),
    analysisStat("Recent form", formatAnalysisNumber(stats.recentMean), recentFormDetail(stats))
  ].join("");
  splitWrap.innerHTML = `
    <div class="analysis-trend-head">
      <span>Skills split</span>
      <small>Driver plus Autonomous</small>
    </div>
    <div class="analysis-stats analysis-stats-tight">
      ${analysisStat("Driver avg", formatAnalysisNumber(average(driverScores)))}
      ${analysisStat("Auton avg", formatAnalysisNumber(average(autonScores)))}
      ${analysisStat("Best Driver", formatAnalysisNumber(bestDriver))}
      ${analysisStat("Best Auton", formatAnalysisNumber(bestAuton))}
      ${analysisStat("Best combined", formatAnalysisNumber(theoretical))}
    </div>
  `;
  trendWrap.innerHTML = renderTrend(runs, run => run.score);
  correlationWrap.innerHTML = renderCorrelation(runs, skillsCorrelationOptions, skillsCorrelationX, skillsCorrelationY, "skills");
  insightsWrap.innerHTML = `
    <p class="analysis-helper">Recent form compares your most recent 5 saved records in this range against your average for the selected range.</p>
    ${renderSkillsInsights(runs, allRuns)}
  `;
}

function renderAnalysis() {
  renderAnalysisMode();
  renderAnalysisRange();
  const headMatches = sortedHeadMatches();
  const skillsRuns = sortedSkillsRuns();
  renderHeadAnalysis(headMatches, filterAnalysisRecords(headMatches));
  renderSkillsAnalysis(skillsRuns, filterAnalysisRecords(skillsRuns));
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
  renderAnalysis();
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
  renderAnalysis();
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
  renderAnalysis();
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
  renderAnalysis();
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
  if (modeChoice) {
    setMode(modeChoice.dataset.modeChoice);
    return;
  }

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
  if (isDevMode && event.target.closest("[data-dev-seed-matches]")) seedSampleData();

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

  const regionOption = event.target.closest("[data-region-option]");
  if (regionOption) {
    selectCompetitionRegion(regionOption.dataset.regionOption, regionOption.querySelector("strong")?.textContent || "");
    searchCompetitions(competitionFilterValues().query).catch((error) => {
      setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
    });
    return;
  }

  if (!event.target.closest("[data-region-combobox]")) {
    renderRegionOptions(false);
  }

  const competitionTeamToggle = event.target.closest("[data-competition-team-toggle]");
  if (competitionTeamToggle) {
    const id = competitionTeamToggle.dataset.competitionTeamToggle;
    expandedCompetitionTeam = expandedCompetitionTeam === id ? null : id;
    renderImportedCompetition();
    return;
  }

  const teamSkillToggle = event.target.closest("[data-team-skill-toggle]");
  if (teamSkillToggle) {
    const id = teamSkillToggle.dataset.teamSkillToggle;
    expandedTeamSkillId = expandedTeamSkillId === id ? null : id;
    renderTeamSkillsResults(teamSkillsResults);
    return;
  }

  const importButton = event.target.closest("[data-import-event]");
  if (importButton) {
    importButton.disabled = true;
    importCompetition(importButton.dataset.importEvent).then(() => {
      importButton.disabled = false;
    }).catch((error) => {
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

$("[data-setup-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = String(new FormData(event.currentTarget).get("teamNumber") || "").trim();
  if (!value) {
    showToast("Enter your team number first.");
    return;
  }
  clearSetupConfirmation();
  const submit = $("[data-setup-submit]");
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking...";
  }
  const match = await findTeamIdentity(value);
  if (submit) submit.disabled = false;
  if (match?.teamName) {
    renderSetupConfirmation(match);
    return;
  }
  finishProfileSetup(saveProfile(value));
});

$("[data-setup-form] input[name='teamNumber']")?.addEventListener("input", clearSetupConfirmation);

$("[data-setup-confirm-yes]")?.addEventListener("click", () => {
  if (!pendingProfileMatch) return;
  finishProfileSetup(saveProfile(
    pendingProfileMatch.teamNumber,
    pendingProfileMatch.teamName,
    pendingProfileMatch.teamSource
  ));
});

$("[data-setup-confirm-no]")?.addEventListener("click", () => {
  clearSetupConfirmation();
  const input = $("[data-setup-form] input[name='teamNumber']");
  input?.focus();
  input?.select();
});

$("[data-dev-edit-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isDevMode) saveDevEdit();
});

$("[data-competition-search-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("competitionSearch") || "").trim();
  searchCompetitions(query).catch((error) => {
    setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
    showToast("Competition data could not load. Try again later.");
  });
});

$("[data-competition-region-input]")?.addEventListener("input", () => {
  selectedCompetitionRegion = "";
  const hidden = $("[data-competition-region]");
  if (hidden) hidden.value = "";
  highlightedRegionIndex = 0;
  renderRegionOptions(true);
});

$("[data-competition-region-input]")?.addEventListener("focus", () => {
  renderRegionOptions(true);
});

$("[data-competition-region-input]")?.addEventListener("keydown", (event) => {
  const rows = visibleRegionRows();
  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightedRegionIndex = Math.min(highlightedRegionIndex + 1, Math.max(rows.length - 1, 0));
    renderRegionOptions(true);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightedRegionIndex = Math.max(highlightedRegionIndex - 1, 0);
    renderRegionOptions(true);
  } else if (event.key === "Enter") {
    event.preventDefault();
    commitRegionInput();
    searchCompetitions(competitionFilterValues().query).catch((error) => {
      setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
    });
  } else if (event.key === "Escape") {
    renderRegionOptions(false);
  }
});

$("[data-competition-search-form] input[name='competitionSearch']")?.addEventListener("input", (event) => {
  const value = String(event.currentTarget.value || "").trim();
  searchCompetitions(value).catch((error) => {
    setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
  });
});

$$("[data-competition-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    competitionQuickFilter = button.dataset.competitionFilter || "all";
    renderCompetitionFilters();
    searchCompetitions(competitionFilterValues().query).catch((error) => {
      setCompetitionStatus(error.message || "Competition data could not load. Try again later.", "warn");
    });
  });
});

$$("[data-analysis-range]").forEach((button) => {
  button.addEventListener("click", () => {
    analysisRange = button.dataset.analysisRange || "all";
    renderAnalysis();
  });
});

$$("[data-analysis-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    analysisMode = button.dataset.analysisMode === "skills" ? "skills" : "head";
    renderAnalysis();
  });
});

$("[data-analysis-start]")?.addEventListener("change", renderAnalysis);
$("[data-analysis-end]")?.addEventListener("change", renderAnalysis);

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-correlation-axis]");
  if (!select) return;
  const [mode, axis] = select.dataset.correlationAxis.split(":");
  if (mode === "head" && axis === "x") headCorrelationX = select.value;
  if (mode === "head" && axis === "y") headCorrelationY = select.value;
  if (mode === "skills" && axis === "x") skillsCorrelationX = select.value;
  if (mode === "skills" && axis === "y") skillsCorrelationY = select.value;
  renderAnalysis();
});

$("[data-team-skills-search-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("teamSkillsSearch") || "").trim();
  if (query.length < 2) {
    setTeamSkillsStatus("Type at least 2 characters to search teams.", "warn");
    return;
  }
  searchTeamSkills(query).catch((error) => {
    setTeamSkillsStatus(error.message || "Team Skills data could not load. Try again later.", "warn");
    showToast("Team Skills data could not load. Try again later.");
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
renderAnalysis();
renderImportedCompetition();
ensureSyncedEventsLoaded();
initializeProfileGate();
