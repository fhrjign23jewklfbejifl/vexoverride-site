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

function sampleQuadrants(seed) {
  return {
    top: { toggle: seed.topToggle, yellow: seed.topY, red: seed.topR, blue: seed.topB },
    right: { toggle: seed.rightToggle, yellow: seed.rightY, red: seed.rightR, blue: seed.rightB },
    bottom: { toggle: seed.bottomToggle, yellow: seed.bottomY, red: seed.bottomR, blue: seed.bottomB },
    left: { toggle: seed.leftToggle, yellow: seed.leftY, red: seed.leftR, blue: seed.leftB },
    center: { toggle: "neutral", yellow: seed.centerY, red: seed.centerR, blue: seed.centerB }
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
  const headSeeds = [
    { daysAgo: 0, teamAlliance: "blue", auton: "blue", redRobots: 1, blueRobots: 2, topToggle: "blue", rightToggle: "blue", bottomToggle: "red", leftToggle: "red", topY: 2, topR: 0, topB: 4, rightY: 1, rightR: 1, rightB: 3, bottomY: 1, bottomR: 2, bottomB: 0, leftY: 2, leftR: 3, leftB: 0, centerY: 1, centerR: 0, centerB: 2, partner: "355V", opponentOne: "169A", opponentTwo: "227R" },
    { daysAgo: 1, teamAlliance: "red", auton: "red", redRobots: 2, blueRobots: 1, topToggle: "blue", rightToggle: "neutral", bottomToggle: "red", leftToggle: "red", topY: 0, topR: 1, topB: 2, rightY: 1, rightR: 0, rightB: 2, bottomY: 3, bottomR: 4, bottomB: 0, leftY: 2, leftR: 2, leftB: 1, centerY: 1, centerR: 1, centerB: 0, partner: "2055A", opponentOne: "10B", opponentTwo: "32C" },
    { daysAgo: 3, teamAlliance: "blue", auton: "red", redRobots: 2, blueRobots: 1, topToggle: "red", rightToggle: "blue", bottomToggle: "red", leftToggle: "neutral", topY: 1, topR: 2, topB: 1, rightY: 2, rightR: 0, rightB: 2, bottomY: 2, bottomR: 3, bottomB: 1, leftY: 1, leftR: 4, leftB: 0, centerY: 0, centerR: 1, centerB: 1, partner: "96Z", opponentOne: "355T", opponentTwo: "471B" },
    { daysAgo: 5, teamAlliance: "red", auton: "tie", redRobots: 1, blueRobots: 1, topToggle: "blue", rightToggle: "blue", bottomToggle: "red", leftToggle: "blue", topY: 2, topR: 0, topB: 3, rightY: 2, rightR: 1, rightB: 3, bottomY: 1, bottomR: 2, bottomB: 1, leftY: 0, leftR: 2, leftB: 1, centerY: 2, centerR: 1, centerB: 1, partner: "169C", opponentOne: "663A", opponentTwo: "1028A" },
    { daysAgo: 8, teamAlliance: "blue", auton: "blue", redRobots: 0, blueRobots: 2, topToggle: "blue", rightToggle: "blue", bottomToggle: "neutral", leftToggle: "red", topY: 3, topR: 0, topB: 5, rightY: 2, rightR: 0, rightB: 4, bottomY: 0, bottomR: 1, bottomB: 0, leftY: 1, leftR: 1, leftB: 0, centerY: 1, centerR: 0, centerB: 2, partner: "169R", opponentOne: "88S", opponentTwo: "886S" },
    { daysAgo: 13, teamAlliance: "red", auton: "blue", redRobots: 1, blueRobots: 2, topToggle: "blue", rightToggle: "red", bottomToggle: "red", leftToggle: "red", topY: 1, topR: 0, topB: 2, rightY: 0, rightR: 2, rightB: 1, bottomY: 2, bottomR: 3, bottomB: 0, leftY: 1, leftR: 2, leftB: 0, centerY: 0, centerR: 1, centerB: 2, partner: "2137A", opponentOne: "355Z", opponentTwo: "1064G" },
    { daysAgo: 21, teamAlliance: "blue", auton: "none", redRobots: 1, blueRobots: 1, topToggle: "neutral", rightToggle: "blue", bottomToggle: "red", leftToggle: "red", topY: 1, topR: 1, topB: 2, rightY: 1, rightR: 0, rightB: 1, bottomY: 3, bottomR: 2, bottomB: 0, leftY: 2, leftR: 3, leftB: 0, centerY: 1, centerR: 1, centerB: 1, partner: "1000A", opponentOne: "1468A", opponentTwo: "1584V" },
    { daysAgo: 34, teamAlliance: "red", auton: "red", redRobots: 2, blueRobots: 0, topToggle: "red", rightToggle: "blue", bottomToggle: "red", leftToggle: "red", topY: 0, topR: 2, topB: 2, rightY: 1, rightR: 0, rightB: 2, bottomY: 2, bottomR: 4, bottomB: 0, leftY: 2, leftR: 3, leftB: 0, centerY: 1, centerR: 2, centerB: 0, partner: "10K", opponentOne: "1069A", opponentTwo: "1698V" }
  ];

  const skillsSeeds = [
    { daysAgo: 0, skillsType: "driver", centerToggle: true, topToggle: "blue", rightToggle: "blue", bottomToggle: "red", leftToggle: "red", topY: 2, topB: 4, rightY: 1, rightB: 3, bottomY: 2, bottomR: 3, leftY: 1, leftR: 2, centerY: 2, centerR: 1, centerB: 1, notes: "Clean route, good midfield finish." },
    { daysAgo: 2, skillsType: "autonomous", centerToggle: true, topToggle: "blue", rightToggle: "neutral", bottomToggle: "red", leftToggle: "red", topY: 1, topB: 2, rightY: 2, rightB: 1, bottomY: 1, bottomR: 2, leftY: 2, leftR: 2, centerY: 1, centerR: 1, centerB: 0, notes: "Auton route got the center robot bonus." },
    { daysAgo: 4, skillsType: "driver", centerToggle: false, topToggle: "blue", rightToggle: "blue", bottomToggle: "neutral", leftToggle: "red", topY: 1, topB: 3, rightY: 2, rightB: 4, bottomY: 1, bottomR: 2, leftY: 0, leftR: 2, centerY: 2, centerR: 1, centerB: 1, notes: "Missed midfield ownership at end." },
    { daysAgo: 9, skillsType: "autonomous", centerToggle: false, topToggle: "neutral", rightToggle: "blue", bottomToggle: "red", leftToggle: "neutral", topY: 1, topB: 2, rightY: 1, rightB: 2, bottomY: 1, bottomR: 1, leftY: 1, leftR: 1, centerY: 0, centerR: 1, centerB: 0, notes: "Early auton baseline." },
    { daysAgo: 16, skillsType: "driver", centerToggle: true, topToggle: "blue", rightToggle: "blue", bottomToggle: "red", leftToggle: "red", topY: 3, topB: 4, rightY: 2, rightB: 3, bottomY: 2, bottomR: 4, leftY: 2, leftR: 3, centerY: 1, centerR: 1, centerB: 2, notes: "Best driver run so far." },
    { daysAgo: 31, skillsType: "autonomous", centerToggle: true, topToggle: "blue", rightToggle: "blue", bottomToggle: "red", leftToggle: "red", topY: 0, topB: 1, rightY: 1, rightB: 1, bottomY: 1, bottomR: 1, leftY: 1, leftR: 1, centerY: 1, centerR: 0, centerB: 1, notes: "Older auton sample outside 30 days." }
  ];

  const nextMatches = [
    ...savedMatches(),
    ...headSeeds.map(createSampleHeadRecord),
    ...skillsSeeds.map(createSampleSkillsRecord)
  ];
  writeSavedMatches(nextMatches);
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  showToast("Sample dev data added.");
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
  return `${stats.recentCount} recent, ${sign}${formatAnalysisNumber(delta)} vs range avg`;
}

function renderAnalysisRange() {
  $$("[data-analysis-range]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.analysisRange === analysisRange));
  });

  const custom = $("[data-analysis-custom]");
  if (custom) custom.hidden = analysisRange !== "custom";
}

function sparklineSvg(records, scoreGetter) {
  const points = records
    .slice()
    .sort((a, b) => recordTimestamp(a) - recordTimestamp(b))
    .map(record => numericValue(scoreGetter(record)))
    .filter(value => Number.isFinite(value));

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
    <svg class="analysis-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Score trend">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
      <polyline points="${coordinates}" />
      ${dots}
    </svg>
  `;
}

function trendList(records, scoreGetter) {
  const rows = records
    .slice()
    .sort((a, b) => recordTimestamp(b) - recordTimestamp(a))
    .slice(0, 5)
    .map((record) => `
      <li>
        <span>${formatMatchDate(record)}</span>
        <strong>${formatAnalysisNumber(numericValue(scoreGetter(record)))}</strong>
      </li>
    `)
    .join("");

  return rows ? `<ul class="analysis-trend-list">${rows}</ul>` : "";
}

function renderTrend(records, scoreGetter) {
  return `
    <div class="analysis-trend-head">
      <span>Trend</span>
      <small>Newest 5 listed below</small>
    </div>
    ${sparklineSvg(records, scoreGetter)}
    ${trendList(records, scoreGetter)}
  `;
}

function renderHeadAnalysis(allMatches, matches) {
  const summary = $("[data-analysis-head-summary]");
  const count = $("[data-analysis-head-count]");
  const statsWrap = $("[data-analysis-head-stats]");
  const trendWrap = $("[data-analysis-head-trend]");
  if (!summary || !count || !statsWrap || !trendWrap) return;

  count.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;
  if (!allMatches.length) {
    summary.textContent = "Save matches or Skills runs to unlock analysis.";
    statsWrap.innerHTML = `<p class="analysis-empty">Save head-on-head matches to unlock this panel.</p>`;
    trendWrap.innerHTML = "";
    return;
  }

  if (!matches.length) {
    summary.textContent = "No saved data in this range.";
    statsWrap.innerHTML = `<p class="analysis-empty">No saved data in this range.</p>`;
    trendWrap.innerHTML = "";
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
}

function renderSkillsAnalysis(allRuns, runs) {
  const summary = $("[data-analysis-skills-summary]");
  const count = $("[data-analysis-skills-count]");
  const statsWrap = $("[data-analysis-skills-stats]");
  const splitWrap = $("[data-analysis-skills-split]");
  const trendWrap = $("[data-analysis-skills-trend]");
  if (!summary || !count || !statsWrap || !splitWrap || !trendWrap) return;

  count.textContent = `${runs.length} ${runs.length === 1 ? "run" : "runs"}`;
  if (!allRuns.length) {
    summary.textContent = "Save matches or Skills runs to unlock analysis.";
    statsWrap.innerHTML = `<p class="analysis-empty">Save Skills runs to unlock this panel.</p>`;
    splitWrap.innerHTML = "";
    trendWrap.innerHTML = "";
    return;
  }

  if (!runs.length) {
    summary.textContent = "No saved data in this range.";
    statsWrap.innerHTML = `<p class="analysis-empty">No saved data in this range.</p>`;
    splitWrap.innerHTML = "";
    trendWrap.innerHTML = "";
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
}

function renderAnalysis() {
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

$("[data-analysis-start]")?.addEventListener("change", renderAnalysis);
$("[data-analysis-end]")?.addEventListener("change", renderAnalysis);

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
