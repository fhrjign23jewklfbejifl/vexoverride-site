"use strict";

const STORE = "4330p_override_engine_v2";
const POINTS = { alliancePin: 5, yellowPin: 10, midfield: 8, auton: 12, autonTie: 6 };
const state = loadState();
let selectedFilter = "all";
const goalScorer = Array.from({ length: 9 }, () => ({ red: 0, blue: 0, yellow: 0, yellowOwner: "none" }));
let selectedGoalMode = "blue";
const goalUndoStack = [];

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const num = (id) => Math.max(0, Number($(id).value || 0));
const text = (id) => ($(id).value || "").trim();
const avg = (arr, fn) => arr.length ? arr.reduce((s, x) => s + fn(x), 0) / arr.length : NaN;
const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);
const max = (arr, fn) => arr.length ? Math.max(...arr.map(fn)) : NaN;
const min = (arr, fn) => arr.length ? Math.min(...arr.map(fn)) : NaN;
const fmt = (x, d = 1) => Number.isFinite(x) ? Number(x).toFixed(d) : "N/A";
const pct = (x) => Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "N/A";
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const clamp = (value, minValue = 0, maxValue = Infinity) => Math.max(minValue, Math.min(maxValue, value));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE)) || {};
    return {
      matches: Array.isArray(saved.matches) ? saved.matches : [],
      skills: Array.isArray(saved.skills) ? saved.skills : [],
      targets: Array.isArray(saved.targets) ? saved.targets : [],
      scouts: Array.isArray(saved.scouts) ? saved.scouts : []
    };
  } catch {
    return { matches: [], skills: [], targets: [], scouts: [] };
  }
}
function persist() {
  localStorage.setItem(STORE, JSON.stringify(state));
}
function uid() {
  return (crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2200);
}

function scoreSide(side, autonPoints = 0) {
  return side.alliancePins * POINTS.alliancePin +
    side.yellowPins * POINTS.yellowPin +
    side.midfield * POINTS.midfield +
    autonPoints;
}
function autonPoints(winner, side) {
  if (winner === "tie") return POINTS.autonTie;
  if (winner === "none") return 0;
  return winner === side ? POINTS.auton : 0;
}
function side(prefix) {
  return {
    alliancePins: num(`${prefix}AlliancePins`),
    yellowPins: num(`${prefix}YellowPins`),
    midfield: Math.min(2, num(`${prefix}Midfield`)),
    toggles: Math.min(4, num(`${prefix}Toggles`)),
    placedPins: num(`${prefix}PlacedPins`),
    cups: num(`${prefix}Cups`),
    goals: Math.min(9, num(`${prefix}Goals`)),
    highStack: num(`${prefix}HighStack`)
  };
}
function pressure(s) {
  return s.alliancePins + s.yellowPins * 2.2 + s.midfield * 5 + s.toggles * 4 + s.goals * 2 + s.highStack * 1.6 + s.cups * 0.35;
}
function buildMatch() {
  const auton = $("autonBonus").value;
  const you = side("you");
  const opp = side("opp");
  const youScore = scoreSide(you, autonPoints(auton, "you"));
  const oppScore = scoreSide(opp, autonPoints(auton, "opp"));
  const automatic = youScore > oppScore ? "win" : youScore < oppScore ? "loss" : "tie";
  const override = $("resultOverride").value;
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    event: text("matchEvent"),
    matchNumber: text("matchNumber"),
    team: text("matchTeam") || "4330P",
    partner: text("partnerTeam"),
    opponents: text("opponents"),
    alliance: $("matchAlliance").value,
    auton,
    awp: $("awpEarned").value === "yes",
    awpChecklist: {
      pins: $("awpPins").checked,
      goals: $("awpGoals").checked,
      noPerimeter: $("awpNoPerimeter").checked
    },
    you,
    opp,
    goalMap: cloneGoalScorer(),
    goalMapSummary: summarizeGoalScorer(goalScorer),
    youScore,
    oppScore,
    margin: youScore - oppScore,
    result: override === "auto" ? automatic : override,
    notes: text("matchNotes")
  };
}
function cloneGoalScorer() {
  return goalScorer.map(g => {
    const yellow = goalYellow(g);
    const owner = goalYellowOwner(g);
    return {
      red: Number(g.red || 0),
      blue: Number(g.blue || 0),
      yellow,
      yellowOwner: owner,
      yellowRed: owner === "red" ? yellow : 0,
      yellowBlue: owner === "blue" ? yellow : 0
    };
  });
}
function goalYellow(g = {}) {
  return Number(g.yellow || g.yellowRed || g.yellowBlue || 0);
}
function goalYellowOwner(g = {}) {
  const legacyOwner = g.yellowRed ? "red" : g.yellowBlue ? "blue" : "none";
  const owner = g.yellowOwner || legacyOwner;
  return ["red", "blue", "none"].includes(owner) ? owner : "none";
}
function hasGoalScorerData() {
  return goalScorer.some(g => g.red || g.blue || goalYellow(g));
}
function pushGoalUndo() {
  goalUndoStack.push(cloneGoalScorer());
  if (goalUndoStack.length > 20) goalUndoStack.shift();
  renderGoalUndoState();
}
function restoreGoalScorer(snapshot = []) {
  goalScorer.forEach((goal, i) => {
    const source = snapshot[i] || {};
    goal.red = Number(source.red || 0);
    goal.blue = Number(source.blue || 0);
    goal.yellow = Number(source.yellow || source.yellowRed || source.yellowBlue || 0);
    goal.yellowOwner = source.yellowOwner || (source.yellowRed ? "red" : source.yellowBlue ? "blue" : "none");
    goal.yellowRed = 0;
    goal.yellowBlue = 0;
  });
}
function renderGoalUndoState() {
  const button = document.querySelector('[data-action="undo-goal-scorer"]');
  if (button) button.disabled = goalUndoStack.length === 0;
}
function undoGoalScorer() {
  const snapshot = goalUndoStack.pop();
  if (!snapshot) {
    toast("Nothing to undo.");
    renderGoalUndoState();
    return;
  }
  restoreGoalScorer(snapshot);
  syncGoalScorerToTotals();
  renderGoalScorer();
  renderGoalScoreStrip();
  renderMatchPreview();
  renderGoalUndoState();
}
function buildSkill() {
  const side = {
    alliancePins: num("skillAlliancePins"),
    yellowPins: num("skillYellowPins"),
    midfield: Number($("skillMidfield").value),
    toggles: num("skillToggles"),
    placedPins: num("skillPlacedPins"),
    cups: num("skillCups"),
    goals: num("skillGoals"),
    highStack: 0
  };
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    entry: $("skillEntry").value,
    type: $("skillType").value,
    targetName: text("skillTargetName"),
    linkedTarget: $("linkedTarget").value,
    ...side,
    stopTime: num("skillStop"),
    score: scoreSide(side, 0),
    notes: text("skillNotes")
  };
}

function metric(label, value, hint) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></div>`;
}
function previewBox(label, value, hint = "") {
  return `<div class="preview-box"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></div>`;
}
function scoreBadge(label, value, cls = "") {
  return `<span class="score-badge ${cls}"><b>${escapeHtml(value)}</b><small>${escapeHtml(label)}</small></span>`;
}
function renderGoalScorer() {
  const grid = $("goalScorerGrid");
  if (!grid) return;
  grid.innerHTML = goalScorer.map((g, i) => {
    const yellow = goalYellow(g);
    const owner = goalYellowOwner(g);
    const total = Number(g.red || 0) + Number(g.blue || 0) + yellow;
    return `
    <article class="goal-tile field-map-tile ${total ? "used" : ""}" data-goal-tap="${i}" aria-label="Goal ${i + 1}. Tap to add selected object.">
      <div class="goal-tile-head">
        <b>Goal ${i + 1}</b>
        <small>${total ? `${total} objects · ${owner === "none" ? "yellow neutral" : `yellow ${owner}`}` : "empty"}</small>
      </div>
      <button class="goal-quick-add ${escapeHtml(selectedGoalMode)}" type="button" data-goal-tap="${i}">
        <span class="goal-quick-icon ${escapeHtml(selectedGoalMode)}">${escapeHtml(goalModeShort(selectedGoalMode))}</span>
        <span>Add ${escapeHtml(goalModeLabel(selectedGoalMode))}</span>
      </button>
      <div class="goal-object-grid">
        ${goalControl(i, "red", "red", "+", "Red")}
        ${goalControl(i, "blue", "blue", "+", "Blue")}
        ${goalControl(i, "yellow", `yellow ${owner}-owner`, "+", "Yellow")}
      </div>
      <div class="yellow-owner-row" aria-label="Yellow ownership for Goal ${i + 1}">
        ${goalOwnerButton(i, owner, "none", "Neutral")}
        ${goalOwnerButton(i, owner, "red", "Red owns")}
        ${goalOwnerButton(i, owner, "blue", "Blue owns")}
      </div>
    </article>
  `;
  }).join("");
}
function summarizeGoalScorer(map = []) {
  const used = map.filter(g => g.red || g.blue || goalYellow(g));
  return {
    usedGoals: used.length,
    red: sum(map, g => Number(g.red || 0)),
    blue: sum(map, g => Number(g.blue || 0)),
    yellowRed: sum(map, g => goalYellowOwner(g) === "red" ? goalYellow(g) : 0),
    yellowBlue: sum(map, g => goalYellowOwner(g) === "blue" ? goalYellow(g) : 0),
    yellowNeutral: sum(map, g => goalYellowOwner(g) === "none" ? goalYellow(g) : 0)
  };
}
function goalMapAudit(match) {
  const map = Array.isArray(match.goalMap) ? match.goalMap : [];
  if (!map.length) return `<p><b>Goal map:</b> no goal-by-goal scorer snapshot saved for this match.</p>`;
  const summary = match.goalMapSummary || summarizeGoalScorer(map);
  const cells = map.map((g, i) => {
    const yellow = goalYellow(g);
    const owner = goalYellowOwner(g);
    const parts = [
      g.red ? `R ${g.red}` : "",
      g.blue ? `B ${g.blue}` : "",
      yellow ? `Y ${yellow} (${owner})` : ""
    ].filter(Boolean);
    return `<span class="goal-audit-cell ${parts.length ? "used" : ""}"><b>G${i + 1}</b><small>${parts.length ? escapeHtml(parts.join(" / ")) : "empty"}</small></span>`;
  }).join("");
  return `
    <p><b>Goal map:</b> ${summary.usedGoals || 0}/9 goals used - R ${summary.red || 0}, B ${summary.blue || 0}, yellow red ${summary.yellowRed || 0}, yellow blue ${summary.yellowBlue || 0}, yellow neutral ${summary.yellowNeutral || 0}.</p>
    <div class="goal-audit-grid">${cells}</div>
  `;
}
function goalModeLabel(mode) {
  return ({
    red: "red Pin half",
    blue: "blue Pin half",
    yellow: "yellow Pin half"
  })[mode] || "selected object";
}
function goalModeShort(mode) {
  return ({ red: "R", blue: "B", yellow: "Y" })[mode] || "?";
}
function renderGoalScoreStrip() {
  const strip = $("goalScoreStrip");
  if (!strip) return;
  const m = buildMatch();
  const redScore = m.alliance === "red" ? m.youScore : m.oppScore;
  const blueScore = m.alliance === "blue" ? m.youScore : m.oppScore;
  const redLabel = m.alliance === "red" ? "our red" : "opp red";
  const blueLabel = m.alliance === "blue" ? "our blue" : "opp blue";
  const marginLabel = m.margin > 0 ? `+${m.margin}` : String(m.margin);
  strip.innerHTML = `
    <div class="mini-score red-side"><strong>${redScore}</strong><span>${escapeHtml(redLabel)}</span></div>
    <div class="mini-score-center">
      <b>${escapeHtml(marginLabel)}</b>
      <span>${escapeHtml(goalModeLabel(selectedGoalMode))}</span>
    </div>
    <div class="mini-score blue-side"><strong>${blueScore}</strong><span>${escapeHtml(blueLabel)}</span></div>
  `;
}
function goalControl(goalIndex, key, kind, mark, label) {
  const value = goalScorer[goalIndex][key] || 0;
  return `<div class="goal-control ${kind} ${value ? "has-value" : ""}">
    <button class="goal-object-button" type="button" data-goal-index="${goalIndex}" data-goal-key="${key}" data-goal-step="1" aria-label="Add ${escapeHtml(label)} to goal ${goalIndex + 1}">
      <span class="goal-icon ${kind}">${escapeHtml(mark)}</span>
      <b>${value}</b>
      <small>${escapeHtml(label)}</small>
    </button>
    <button class="goal-object-minus" type="button" data-goal-index="${goalIndex}" data-goal-key="${key}" data-goal-step="-1" aria-label="Remove ${escapeHtml(label)} from goal ${goalIndex + 1}" ${value ? "" : "disabled"}>-</button>
  </div>`;
}
function goalOwnerButton(goalIndex, currentOwner, owner, label) {
  const active = currentOwner === owner;
  return `<button class="${escapeHtml(owner)} ${active ? "active" : ""}" type="button" data-goal-owner-index="${goalIndex}" data-goal-owner="${escapeHtml(owner)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)}</button>`;
}
function syncGoalScorerToTotals() {
  const redHalves = sum(goalScorer, g => g.red);
  const blueHalves = sum(goalScorer, g => g.blue);
  const redYellow = sum(goalScorer, g => goalYellowOwner(g) === "red" ? goalYellow(g) : 0);
  const blueYellow = sum(goalScorer, g => goalYellowOwner(g) === "blue" ? goalYellow(g) : 0);
  const alliance = $("matchAlliance").value;
  const youAlliance = alliance === "red" ? redHalves : blueHalves;
  const oppAlliance = alliance === "red" ? blueHalves : redHalves;
  const youYellow = alliance === "red" ? redYellow : blueYellow;
  const oppYellow = alliance === "red" ? blueYellow : redYellow;
  const redGoals = goalScorer.filter(g => g.red || (goalYellowOwner(g) === "red" && goalYellow(g))).length;
  const blueGoals = goalScorer.filter(g => g.blue || (goalYellowOwner(g) === "blue" && goalYellow(g))).length;
  const youGoals = alliance === "red" ? redGoals : blueGoals;
  const oppGoals = alliance === "red" ? blueGoals : redGoals;
  setInputValue("youAlliancePins", youAlliance);
  setInputValue("oppAlliancePins", oppAlliance);
  setInputValue("youYellowPins", youYellow);
  setInputValue("oppYellowPins", oppYellow);
  setInputValue("youGoals", youGoals);
  setInputValue("oppGoals", oppGoals);
  setInputValue("youPlacedPins", youAlliance + youYellow);
  setInputValue("oppPlacedPins", oppAlliance + oppYellow);
}
function setInputValue(id, value) {
  const el = $(id);
  if (!el) return;
  el.value = value;
}
function adjustGoalScorer(goalIndex, key, delta) {
  const goal = goalScorer[goalIndex];
  if (!goal) return;
  const current = Number(goal[key] || 0);
  const next = clamp(current + delta, 0, 12);
  if (next === current) return;
  pushGoalUndo();
  goal[key] = next;
  syncGoalScorerToTotals();
  renderGoalScorer();
  renderGoalScoreStrip();
  renderMatchPreview();
}
function setGoalMode(mode) {
  if (!["red", "blue", "yellow"].includes(mode)) return;
  selectedGoalMode = mode;
  renderGoalScorerMode();
  renderGoalScorer();
  renderGoalScoreStrip();
}
function setGoalYellowOwner(goalIndex, owner) {
  const goal = goalScorer[goalIndex];
  if (!goal || !["none", "red", "blue"].includes(owner)) return;
  if (goalYellowOwner(goal) === owner) return;
  pushGoalUndo();
  goal.yellowOwner = owner;
  goal.yellowRed = 0;
  goal.yellowBlue = 0;
  syncGoalScorerToTotals();
  renderGoalScorer();
  renderGoalScoreStrip();
  renderMatchPreview();
}
function renderGoalScorerMode() {
  const wrap = $("goalScorerMode");
  if (!wrap) return;
  wrap.querySelectorAll("[data-goal-mode]").forEach(btn => {
    const active = btn.dataset.goalMode === selectedGoalMode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
function resetGoalScorer(trackUndo = true) {
  if (trackUndo && hasGoalScorerData()) pushGoalUndo();
  goalScorer.forEach(g => {
    g.red = 0;
    g.blue = 0;
    g.yellow = 0;
    g.yellowOwner = "none";
    g.yellowRed = 0;
    g.yellowBlue = 0;
  });
  syncGoalScorerToTotals();
  renderGoalScorer();
  renderGoalScoreStrip();
  renderMatchPreview();
  renderGoalUndoState();
}
function resetMatchEntryAfterSave() {
  ["matchNumber", "partnerTeam", "opponents", "matchNotes"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  $("autonBonus").value = "you";
  $("awpEarned").value = "no";
  $("resultOverride").value = "auto";
  ["awpPins", "awpGoals", "awpNoPerimeter"].forEach(id => {
    const el = $(id);
    if (el) el.checked = false;
  });
  goalUndoStack.length = 0;
  resetGoalScorer(false);
  ["youMidfield", "oppMidfield", "youToggles", "oppToggles", "youCups", "oppCups", "youHighStack", "oppHighStack"].forEach(id => setInputValue(id, 0));
  renderGoalScoreStrip();
  renderMatchPreview();
}
function record(arr) {
  return `${arr.filter(m => m.result === "win").length}-${arr.filter(m => m.result === "loss").length}-${arr.filter(m => m.result === "tie").length}`;
}
function stdev(arr, fn) {
  if (arr.length < 2) return 0;
  const a = avg(arr, fn);
  return Math.sqrt(avg(arr, x => (fn(x) - a) ** 2));
}
function filterMatches() {
  let data = [...state.matches];
  const f = selectedFilter;
  if (f === "last5") data = data.slice(-5);
  if (f === "last10") data = data.slice(-10);
  if (f === "wins") data = data.filter(m => m.result === "win");
  if (f === "losses") data = data.filter(m => m.result === "loss");
  if (f === "close") data = data.filter(m => Math.abs(m.margin) <= 10);
  if (f === "blowouts") data = data.filter(m => Math.abs(m.margin) >= 20);
  if (f === "autonWon") data = data.filter(m => m.auton === "you" || m.auton === "tie");
  if (f === "awp") data = data.filter(m => m.awp);
  if (f === "red" || f === "blue") data = data.filter(m => m.alliance === f);
  return data;
}

function renderMatchPreview() {
  const m = buildMatch();
  const youAuton = autonPoints(m.auton, "you");
  const oppAuton = autonPoints(m.auton, "opp");
  const redScore = m.alliance === "red" ? m.youScore : m.oppScore;
  const blueScore = m.alliance === "blue" ? m.youScore : m.oppScore;
  const redSide = m.alliance === "red" ? m.you : m.opp;
  const blueSide = m.alliance === "blue" ? m.you : m.opp;
  const redAuton = m.alliance === "red" ? youAuton : oppAuton;
  const blueAuton = m.alliance === "blue" ? youAuton : oppAuton;
  const redLabel = m.alliance === "red" ? "Our alliance" : "Opponent";
  const blueLabel = m.alliance === "blue" ? "Our alliance" : "Opponent";
  $("matchPreview").innerHTML = `
    <div class="vex-score-screen ${m.alliance}">
      <div class="vex-appbar">
        <span class="hamburger" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Override</span>
        <b>V5RC Match</b>
        <button class="trash-mark" type="button" data-action="reset-goal-scorer">CLR</button>
      </div>
      <div class="vex-scoreline">
        <div class="score-number red-score">
          <strong>${redScore}</strong>
          <small>${escapeHtml(redLabel)}</small>
        </div>
        <div class="auton-pair">
          <span class="${redAuton ? "on" : ""}">A</span>
          <small>${m.auton === "tie" ? "split auton" : m.auton === "none" ? "no auton" : "auton bonus"}</small>
          <span class="${blueAuton ? "on" : ""}">A</span>
        </div>
        <div class="score-number blue-score">
          <strong>${blueScore}</strong>
          <small>${escapeHtml(blueLabel)}</small>
        </div>
      </div>
      <div class="vex-field-mini" aria-hidden="true">
        <span class="mini-line a"></span>
        <span class="mini-line b"></span>
        <span class="mini-diamond"></span>
        <span class="mini-goal red"></span>
        <span class="mini-goal yellow"></span>
        <span class="mini-goal blue"></span>
        <span class="mini-toggle one"></span>
        <span class="mini-toggle two"></span>
      </div>
      <div class="score-ledger">
        ${scoreLedgerRow("red", "+", redSide.alliancePins, "Alliance Pin halves", "5 each")}
        ${scoreLedgerRow("yellow", "+", redSide.yellowPins, "Owned yellow halves", "10 each")}
        ${scoreLedgerRow("blue", "M", redSide.midfield, "Robots in Midfield", "8 each")}
        ${scoreLedgerRow("auton", "A", redAuton, "Autonomous bonus", "12 / 6 split", blueAuton)}
        ${scoreLedgerRow("red", "+", blueSide.alliancePins, "Alliance Pin halves", "5 each", null, true)}
        ${scoreLedgerRow("yellow", "+", blueSide.yellowPins, "Owned yellow halves", "10 each", null, true)}
        ${scoreLedgerRow("blue", "M", blueSide.midfield, "Robots in Midfield", "8 each", null, true)}
      </div>
      <div class="vex-summary-strip">
        <span><b>${m.margin > 0 ? `+${m.margin}` : m.margin}</b> margin</span>
        <span><b>${m.result.toUpperCase()}</b> result</span>
        <span><b>${fmt(pressure(m.you))}</b> pressure</span>
      </div>
      <div class="vex-bottom-nav">
        <span>Manual</span>
        <span class="active">Calculator</span>
        <span>Timer</span>
      </div>
    </div>`;
}
function scoreLedgerRow(kind, mark, value, label, hint, altValue = null, blueSide = false) {
  const shown = altValue ?? value;
  return `<div class="score-ledger-row ${blueSide ? "blue-team-row" : "red-team-row"}">
    <span class="score-ledger-icon ${kind}">${escapeHtml(mark)}</span>
    <span><b>${escapeHtml(shown)}</b><small>${escapeHtml(label)} - ${escapeHtml(hint)}</small></span>
  </div>`;
}
function renderDashboard() {
  const data = filterMatches();
  if (!data.length) {
    $("dashboardMetrics").innerHTML = [
      metric("Ready", "0", "No match records yet"),
      metric("Scoring", "5/10/8", "Pins, yellow ownership, Midfield"),
      metric("Auton", "12", "Bonus tracking + AWP"),
      metric("Data", "Local", "Export/import for events")
    ].join("");
    $("scoreTrend").innerHTML = `<div class="empty-state"><b>No match trend yet.</b><span>Enter a match or load demo data to see the analysis engine wake up.</span><button class="primary" data-action="load-demo">Load Demo Data</button></div>`;
    $("coachSummary").innerHTML = `<b>Start here:</b> use Match Lab after practice or competition matches. The dashboard will turn those records into trend, pressure, scorecard, and correlation evidence.`;
    $("scorecard").innerHTML = `<div class="empty-state compact-empty"><b>Scorecard waiting for data</b><span>Auton, scoring, field control, and resistance grades appear after saved matches.</span></div>`;
    $("matchList").innerHTML = `<p class="muted">No matches saved yet.</p>`;
    setupCorrelation(data);
    return;
  }
  const wins = data.filter(m => m.result === "win");
  const losses = data.filter(m => m.result === "loss");
  const close = data.filter(m => Math.abs(m.margin) <= 10);
  const blowouts = data.filter(m => Math.abs(m.margin) >= 20);
  $("dashboardMetrics").innerHTML = [
    metric("Matches", data.length, "Current filter view"),
    metric("Record", record(data), "Win-loss-tie"),
    metric("Win rate", pct(wins.length / data.length), "Result frequency"),
    metric("Average score", fmt(avg(data, m => m.youScore)), "Our final score"),
    metric("Average margin", fmt(avg(data, m => m.margin)), "Positive is good"),
    metric("AWP rate", pct(avg(data, m => m.awp ? 1 : 0)), "Autonomous Win Point"),
    metric("Yellow ownership", fmt(avg(data, m => m.you.yellowPins)), "Avg owned yellow Pin halves"),
    metric("Consistency", fmt(stdev(data, m => m.youScore)), "Lower is steadier")
  ].join("");
  renderTrend(data);
  renderCoachSummary(data, wins, losses, close, blowouts);
  renderScorecard(data);
  renderMatches(data);
  setupCorrelation(data);
}
function renderTrend(data) {
  const recent = data.slice(-12);
  const top = Math.max(1, max(recent, m => Math.max(m.youScore, m.oppScore)));
  $("scoreTrend").innerHTML = recent.map((m, i) => {
    const h = Math.max(8, (m.youScore / top) * 100);
    return `<div class="bar ${m.result}" style="height:${h}%"><span>${m.youScore}</span></div>`;
  }).join("");
}
function renderCoachSummary(data, wins, losses, close, blowouts) {
  const highCut = [...data].map(m => pressure(m.opp)).sort((a,b)=>a-b)[Math.floor(data.length * .66)] ?? 0;
  const high = data.filter(m => pressure(m.opp) >= highCut);
  const low = data.filter(m => pressure(m.opp) < highCut);
  const lever = bestLever(data);
  $("coachSummary").innerHTML = `
    <p><b>Current read:</b> ${record(data)} in this view, averaging <b>${fmt(avg(data,m=>m.youScore))}</b> points and <b>${fmt(avg(data,m=>m.margin))}</b> margin.</p>
    <p><b>High-pressure opponents:</b> ${record(high)} with average margin <b>${fmt(avg(high,m=>m.margin))}</b>. Low-pressure average margin: <b>${fmt(avg(low,m=>m.margin))}</b>.</p>
    <p><b>Likely win lever:</b> ${escapeHtml(lever)}. <b>Close match record:</b> ${record(close)}. <b>Blowout record:</b> ${record(blowouts)}.</p>
  `;
}
function grade(score) {
  if (score >= 90) return ["A","a"];
  if (score >= 78) return ["B","b"];
  if (score >= 65) return ["C","c"];
  if (score >= 50) return ["D","d"];
  return ["F","f"];
}
function gradeRow(label, score, hint) {
  const [g,c] = grade(score);
  return `<div class="grade-row"><b>${escapeHtml(label)}</b><div class="grade ${c}">${g}</div><div><div class="meter"><span style="width:${Math.max(0,Math.min(100,score))}%"></span></div><small class="muted">${escapeHtml(hint)}</small></div></div>`;
}
function renderScorecard(data) {
  const auton = avg(data, m => (m.auton === "you" ? 65 : m.auton === "tie" ? 35 : 0) + (m.awp ? 35 : 0));
  const scoring = Math.min(100, avg(data, m => m.youScore) / 165 * 100);
  const field = Math.min(100, avg(data, m => m.you.toggles * 12 + m.you.midfield * 20 + m.you.goals * 4 + m.you.highStack * 2));
  const resistant = Math.max(0, Math.min(100, 62 + avg(data, m => m.margin) / 2));
  $("scorecard").innerHTML = [
    gradeRow("Auton", auton, "Bonus + AWP reliability"),
    gradeRow("Scoring", scoring, "Average score on a competitive curve"),
    gradeRow("Field control", field, "Toggles, Midfield, goals, stack height"),
    gradeRow("Resistance", resistant, "Margin-based pressure survival")
  ].join("");
}

const variables = [
  ["youAlliancePins", "Our alliance Pin halves", m => m.you.alliancePins],
  ["youYellowPins", "Our yellow Pin halves", m => m.you.yellowPins],
  ["youMidfield", "Our Midfield robots", m => m.you.midfield],
  ["youToggles", "Our Toggles", m => m.you.toggles],
  ["youGoals", "Our goals used", m => m.you.goals],
  ["youHighStack", "Our highest stack", m => m.you.highStack],
  ["youPressure", "Our pressure score", m => pressure(m.you)],
  ["youScore", "Our final score", m => m.youScore],
  ["oppScore", "Opponent final score", m => m.oppScore],
  ["oppPressure", "Opponent pressure score", m => pressure(m.opp)],
  ["autonWon", "Auton won", m => m.auton === "you" ? 1 : 0],
  ["awp", "AWP earned", m => m.awp ? 1 : 0],
  ["margin", "Score differential", m => m.margin],
  ["totalScore", "Total match score", m => m.youScore + m.oppScore],
  ["win", "Win", m => m.result === "win" ? 1 : 0],
  ["resultValue", "Result value", m => m.result === "win" ? 1 : m.result === "tie" ? .5 : 0]
];
function corr(xs, ys) {
  if (xs.length < 2) return NaN;
  const ax = avg(xs, x => x), ay = avg(ys, y => y);
  const num = xs.reduce((s, x, i) => s + (x - ax) * (ys[i] - ay), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - ax) ** 2, 0) * ys.reduce((s, y) => s + (y - ay) ** 2, 0));
  return den ? num / den : NaN;
}
function corrLabel(r) {
  if (!Number.isFinite(r)) return "not enough data or variation";
  const a = Math.abs(r);
  if (a > .8) return r > 0 ? "very strong positive" : "very strong negative";
  if (a > .55) return r > 0 ? "strong positive" : "strong negative";
  if (a > .3) return r > 0 ? "moderate positive" : "moderate negative";
  return "weak / noisy";
}
function setupCorrelation(data) {
  const x = $("corrX"), y = $("corrY");
  const opts = variables.map(v => `<option value="${v[0]}">${v[1]}</option>`).join("");
  if (x.innerHTML !== opts) { x.innerHTML = opts; y.innerHTML = opts; x.value = "youYellowPins"; y.value = "youScore"; }
  const render = () => {
    const vx = variables.find(v => v[0] === x.value), vy = variables.find(v => v[0] === y.value);
    const r = corr(data.map(vx[2]), data.map(vy[2]));
    $("correlationReadout").innerHTML = `<b>${Number.isFinite(r) ? r.toFixed(2) : "N/A"}</b> - ${corrLabel(r)} relationship between <b>${vx[1]}</b> and <b>${vy[1]}</b>. Matches used: <b>${data.length}</b>. Ordered pairings available: <b>${variables.length * (variables.length - 1)}</b>.`;
  };
  x.onchange = render; y.onchange = render; render();
}
function bestLever(data) {
  if (data.length < 3) return "not enough data yet";
  const result = data.map(m => m.result === "win" ? 1 : 0);
  return variables
    .filter(v => !["win", "resultValue"].includes(v[0]))
    .map(v => [v[1], Math.abs(corr(data.map(v[2]), result))])
    .filter(x => Number.isFinite(x[1]))
    .sort((a,b) => b[1] - a[1])[0]?.[0] || "not enough variation yet";
}
function renderMatches(data) {
  $("matchList").innerHTML = data.slice().reverse().map((m) => `
    <article class="item">
      <div class="item-head">
        <div>
          <div class="pills">
            <span class="pill ${m.result}">${m.result.toUpperCase()}</span>
            <span class="pill">${escapeHtml(m.event || "No event")}</span>
            <span class="pill">${escapeHtml(m.matchNumber || "No match #")}</span>
            <span class="pill">${m.alliance}</span>
          </div>
          <h3>${escapeHtml(m.team)} ${m.partner ? `+ ${escapeHtml(m.partner)}` : ""} vs ${escapeHtml(m.opponents || "opponents")}</h3>
        </div>
        <button class="danger" data-delete-match="${m.id}">Delete</button>
      </div>
      <div class="metric-grid skinny">
        ${metric("Our score", m.youScore, `margin ${m.margin >= 0 ? "+" : ""}${m.margin}`)}
        ${metric("Opponent", m.oppScore, `pressure ${fmt(pressure(m.opp))}`)}
      </div>
      <details>
        <summary>Full score audit</summary>
        <p><b>Our scoring:</b> ${m.you.alliancePins} alliance halves, ${m.you.yellowPins} yellow halves, ${m.you.midfield} Midfield robots, ${m.you.toggles} Toggles, ${m.you.goals} goals, high stack ${m.you.highStack}.</p>
        <p><b>Opponent scoring:</b> ${m.opp.alliancePins} alliance halves, ${m.opp.yellowPins} yellow halves, ${m.opp.midfield} Midfield robots, ${m.opp.toggles} Toggles, ${m.opp.goals} goals, high stack ${m.opp.highStack}.</p>
        ${goalMapAudit(m)}
        <p><b>Auton:</b> ${m.auton}; <b>AWP:</b> ${m.awp ? "earned" : "not earned"}; <b>Notes:</b> ${escapeHtml(m.notes || "none")}</p>
      </details>
    </article>`).join("");
}

function renderLatestChange() {
  const latest = state.matches.at(-1);
  if (!latest) {
    $("latestChange").innerHTML = "No saved match yet.";
    return;
  }
  const before = state.matches.slice(0, -1);
  if (!before.length) {
    $("latestChange").innerHTML = `<b>Latest:</b> ${latest.result.toUpperCase()} ${latest.youScore}-${latest.oppScore}. First match saved.`;
    return;
  }
  $("latestChange").innerHTML = `<b>Latest:</b> ${latest.result.toUpperCase()} ${latest.youScore}-${latest.oppScore}. Average score moved from <b>${fmt(avg(before,m=>m.youScore))}</b> to <b>${fmt(avg(state.matches,m=>m.youScore))}</b>.`;
}

function renderSkillsPreview() {
  const s = buildSkill();
  const target = state.targets.find(t => t.id === s.linkedTarget);
  $("skillsPreview").innerHTML = [
    previewBox("Score", s.score, `${s.alliancePins} red/blue halves, ${s.yellowPins} owned yellow halves`),
    previewBox("Entry", s.entry === "target" ? "Target" : "Actual", s.type),
    previewBox("Target gap", target ? `${s.score - target.score >= 0 ? "+" : ""}${s.score - target.score}` : "N/A", target ? target.targetName : "no linked target")
  ].join("");
}
function renderSkills() {
  const actual = state.skills;
  const driver = actual.filter(s => s.type === "driver");
  const auton = actual.filter(s => s.type === "auton");
  $("skillsMetrics").innerHTML = [
    metric("Runs", actual.length, "Actual only"),
    metric("Targets", state.targets.length, "Blueprints"),
    metric("Best driver", max(driver, s => s.score) || "N/A", "Driver Skills"),
    metric("Best auton", max(auton, s => s.score) || "N/A", "Autonomous Skills"),
    metric("Average", fmt(avg(actual, s => s.score)), "Actual runs"),
    metric("Best stop", max(actual, s => s.stopTime) || 0, "Skills Stop Time")
  ].join("");
  renderTargetOptions();
  $("targetList").innerHTML = state.targets.length ? state.targets.map(t => skillItem(t, true)).join("") : `<p class="muted">No target blueprints saved yet.</p>`;
  $("skillsList").innerHTML = actual.length ? actual.slice().reverse().map(s => skillItem(s, false)).join("") : `<p class="muted">No actual skills runs saved yet.</p>`;
}
function skillItem(s, isTarget) {
  const linked = state.targets.find(t => t.id === s.linkedTarget);
  const title = isTarget ? (s.targetName || "Unnamed target") : `${s.type} run`;
  const gap = linked && !isTarget ? ` / vs ${escapeHtml(linked.targetName)} (${s.score - linked.score >= 0 ? "+" : ""}${s.score - linked.score})` : "";
  return `<article class="item">
    <div class="item-head"><div><span class="pill">${isTarget ? "TARGET" : "ACTUAL"}</span> <span class="pill">${s.type}</span><h3>${escapeHtml(title)} - ${s.score}${gap}</h3></div>
    <button class="danger" data-delete-skill="${s.id}" data-kind="${isTarget ? "target" : "actual"}">Delete</button></div>
    <p>Red/blue halves: ${s.alliancePins}; owned yellow: ${s.yellowPins}; Midfield: ${s.midfield ? "yes" : "no"}; Toggles: ${s.toggles}; stop time: ${s.stopTime || 0}.</p>
    <p class="muted">${escapeHtml(s.notes || "")}</p>
  </article>`;
}
function renderTargetOptions() {
  const type = $("skillType").value;
  const options = state.targets.filter(t => t.type === type);
  $("linkedTarget").innerHTML = `<option value="">No linked target</option>` + options.map(t => `<option value="${t.id}">${escapeHtml(t.targetName || "Unnamed")} - ${t.score}</option>`).join("");
  const isTarget = $("skillEntry").value === "target";
  $("linkedTarget").disabled = isTarget;
  $("skillTargetNameWrap").style.display = isTarget ? "grid" : "none";
  $("saveSkillBtn").textContent = isTarget ? "Save Target Blueprint" : "Save Skills Run";
}

function scoutTags(s) {
  const tags = [];
  if (s.rank && s.rank <= 8) tags.push("Top seed");
  if ((s.ap || 0) >= 30) tags.push("High AP");
  if ((s.skills || 0) >= 100) tags.push("Skills threat");
  if ((s.driver || 0) > (s.autonSkills || 0) * 1.5 && s.driver >= 50) tags.push("Driver-heavy");
  if ((s.autonSkills || 0) >= 35) tags.push("Auton capable");
  if ((s.fit || 0) >= 8) tags.push("Good fit");
  return tags.slice(0, 3);
}

function renderScouts() {
  const sorted = [...state.scouts].sort((a,b)=>(b.score || 0)-(a.score || 0));
  const teamList = $("scoutTeams");
  if (teamList) {
    teamList.innerHTML = sorted.map(s => `<option value="${escapeHtml(s.team)}">${escapeHtml(`Rank ${s.rank || "?"} / ${s.record || "record ?"}`)}</option>`).join("");
  }
  renderStandingsPreview();
  $("scoutList").innerHTML = sorted.length ? sorted.map((s, index) => `
    <article class="item">
      <div class="item-head">
        <div>
          <div class="pills">
            <span class="pill">#${index + 1} pick</span>
            <span class="pill">Rank ${s.rank || "?"}</span>
            <span class="pill">${escapeHtml(s.record || "record ?")}</span>
            ${scoutTags(s).map(t => `<span class="pill">${escapeHtml(t)}</span>`).join("")}
          </div>
          <h3>${escapeHtml(s.team)} - pick value ${fmt(s.score,0)}/100</h3>
        </div>
        <button class="danger" data-delete-scout="${s.id}">Delete</button>
      </div>
      <div class="scout-lines">
        <span>WP <b>${s.wp || 0}</b></span>
        <span>AP <b>${s.ap || 0}</b></span>
        <span>SP <b>${s.sp || 0}</b></span>
        <span>Skills <b>${s.skills || 0}</b></span>
        <span>Driver <b>${s.driver || 0}</b></span>
        <span>Auton <b>${s.autonSkills || 0}</b></span>
        <span>Fit <b>${s.fit || 0}/10</b></span>
      </div>
      <p class="muted">${escapeHtml(s.notes || "")}</p>
    </article>`).join("") : `<p class="muted">No scouting cards yet.</p>`;
}

function scoutScore(s) {
  const rankScore = s.rank ? Math.max(0, 24 - Math.min(24, (s.rank - 1) * 1.2)) : 4;
  const wpScore = Math.min(20, (s.wp || 0) * 1.4);
  const apScore = Math.min(18, (s.ap || 0) * .45);
  const spScore = Math.min(12, (s.sp || 0) / 45);
  const skillsScore = Math.min(16, (s.skills || 0) / 9);
  const fitScore = Math.min(10, (s.fit || 0));
  return Math.max(0, Math.min(100, rankScore + wpScore + apScore + spScore + skillsScore + fitScore));
}

function parseStandings(raw) {
  return raw.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^rank[\s,;\t|]+team/i.test(line))
    .filter(line => !/^team[\s,;\t|]+rank/i.test(line))
    .map(line => {
      const parts = line.includes(",") ? line.split(",") : line.split(/\t|\s{2,}|\|/);
      let clean = parts.map(p => p.trim()).filter(Boolean);
      if (clean.length < 4) {
        const simple = line.split(/\s+/).map(p => p.trim()).filter(Boolean);
        if (simple.length >= 4) clean = simple;
      }
      if (clean.length < 2) return null;
      const rankFirst = /^\d+$/.test(clean[0]);
      const rank = Number(rankFirst ? clean[0] : clean[1]) || 0;
      const team = (rankFirst ? clean[1] : clean[0] || "").toUpperCase();
      if (!team || !/[A-Z0-9]/.test(team)) return null;
      return {
        rank,
        team,
        record: clean[2] || "",
        wp: Number(clean[3]) || 0,
        ap: Number(clean[4]) || 0,
        sp: Number(clean[5]) || 0,
        skills: Number(clean[6]) || 0,
        driver: Number(clean[7]) || 0,
        autonSkills: Number(clean[8]) || 0
      };
    })
    .filter(Boolean);
}

function importStandings() {
  const rows = parseStandings($("standingsPaste").value);
  if (!rows.length) {
    toast("No standings rows found.");
    return;
  }
  rows.forEach(row => {
    const existing = findScoutByTeam(row.team);
    const scout = existing || { id: uid(), createdAt: new Date().toISOString(), team: row.team, fit: 5, notes: "" };
    Object.assign(scout, row, { importedAt: new Date().toISOString() });
    scout.score = scoutScore(scout);
    if (!existing) state.scouts.push(scout);
  });
  persist();
  renderAll();
  toast(`${rows.length} standings rows imported.`);
}

function renderStandingsPreview() {
  const box = $("standingsPreview");
  if (!box) return;
  const imported = state.scouts.filter(s => s.importedAt).length;
  const best = [...state.scouts].sort((a,b)=>(b.score || 0)-(a.score || 0)).slice(0, 3);
  box.innerHTML = `
    <div class="standings-stats">
      <span><b>${state.scouts.length}</b><small>scout cards</small></span>
      <span><b>${imported}</b><small>from standings</small></span>
      <span><b>${best[0]?.team ? escapeHtml(best[0].team) : "none"}</b><small>top pick value</small></span>
    </div>
    ${best.length ? `<p class="muted">Current top three: ${best.map(s => escapeHtml(s.team)).join(", ")}</p>` : `<p class="muted">Import standings or save team notes to build a pick list.</p>`}
  `;
}

function findScoutByTeam(team) {
  const normalized = String(team || "").trim().toUpperCase();
  return state.scouts.find(s => String(s.team || "").toUpperCase() === normalized);
}

function fillScoutFormFromTeam(team) {
  const scout = findScoutByTeam(team);
  if (!scout) return;
  setInputValue("scoutRank", scout.rank || 0);
  $("scoutRecord").value = scout.record || "";
  setInputValue("scoutWp", scout.wp || 0);
  setInputValue("scoutAp", scout.ap || 0);
  setInputValue("scoutSp", scout.sp || 0);
  setInputValue("scoutSkills", scout.skills || 0);
  setInputValue("scoutDriver", scout.driver || 0);
  setInputValue("scoutAutonSkills", scout.autonSkills || 0);
  setInputValue("scoutFit", scout.fit || 5);
  $("scoutNotes").value = scout.notes || "";
}

function renderEvidence() {
  const data = state.matches;
  const actual = state.skills;
  $("evidenceSummary").innerHTML = `
    <p><b>Current evidence base:</b> ${data.length} match records, ${actual.length} actual skills runs, ${state.targets.length} target blueprints, and ${state.scouts.length} scout cards.</p>
    <p><b>Performance claim:</b> 4330P is averaging ${fmt(avg(data,m=>m.youScore))} match points with ${pct(avg(data,m=>m.awp?1:0))} AWP reliability and ${fmt(avg(data,m=>m.you.yellowPins))} owned yellow Pin halves per match.</p>
    <p><b>Engineering loop:</b> Use the notes fields to tie mechanism/code/driver changes to before-after changes in scoring, yellow ownership, Toggles, Midfield success, and skills route consistency.</p>
  `;
  const map = [
    ["Historical Match Archive", "Override match records with event, partner, opponents, official scoring breakdown, notes, and deletion/reset controls."],
    ["Score Tracker", "Alliance Pin halves, owned yellow Pin halves, Midfield robots, autonomous bonus, and AWP."],
    ["What Changed?", "Latest-match summary and average-score movement after each saved match."],
    ["Advanced Trends", "Coach summary, scorecard, pressure tracking, recipe/win lever logic, and correlation explorer."],
    ["Skills Targets", "Driver/auton actual runs and target blueprints, including target gap comparison."],
    ["Correlation Analysis", "Override-specific variables: yellow ownership, Toggles, Midfield, pressure, AWP, score, and result."],
    ["Community Value", "Scouting board and pick-list style compatibility rankings for other teams."],
    ["Engineering Log", "Generated process summary for engineering notebook entries, team reflection, and sharing the process with other VEX teams."]
  ];
  $("adaptationMap").innerHTML = map.map(([a,b]) => `<div class="item"><h3>${a}</h3><p>${b}</p></div>`).join("");
}

function renderAll() {
  updateLayoutMode();
  renderGoalScorer();
  renderGoalScorerMode();
  renderGoalScoreStrip();
  renderGoalUndoState();
  renderMatchPreview();
  renderDashboard();
  renderLatestChange();
  renderSkillsPreview();
  renderSkills();
  renderScouts();
  renderEvidence();
}
function updateLayoutMode() {
  const active = document.querySelector(".view.active")?.id || "dashboard";
  document.body.classList.toggle("app-focused", active !== "dashboard");
}

function demoData() {
  if (state.matches.length || state.skills.length || state.targets.length) {
    if (!confirm("Add demo data to your existing data?")) return;
  }
  const samples = [
    [92,64,"you",true,8,3,1,2,2,"fast preload stack, missed one Toggle"],
    [118,104,"tie",false,12,4,1,3,4,"good yellow ownership, partner traffic"],
    [86,96,"opp",false,7,2,1,1,3,"auton drift, lost one stack"],
    [132,101,"you",true,14,5,2,3,5,"best route so far, clean loader cycle"],
    [109,112,"opp",false,11,3,1,2,4,"close loss, late Midfield push failed"]
  ];
  samples.forEach((s,i) => {
    const you = { alliancePins:s[4], yellowPins:s[5], midfield:s[6], toggles:s[7], placedPins:s[4], cups:6+i, goals:4, highStack:s[8] };
    const opp = { alliancePins:Math.floor(s[1]/8), yellowPins:2+i%2, midfield:1, toggles:1+i%3, placedPins:9, cups:5, goals:3, highStack:3 };
    state.matches.push({ id:uid(), createdAt:new Date(Date.now()-1000000*(samples.length-i)).toISOString(), event:"Demo Event", matchNumber:`Q${i+1}`, team:"4330P", partner:`${4000+i}A`, opponents:`${5000+i}B + ${6000+i}C`, alliance:i%2?"red":"blue", auton:s[2], awp:s[3], awpChecklist:{pins:s[3],goals:s[3],noPerimeter:s[3]}, you, opp, youScore:s[0], oppScore:s[1], margin:s[0]-s[1], result:s[0]>s[1]?"win":"loss", notes:s[9] });
  });
  state.targets.push({ id:uid(), createdAt:new Date().toISOString(), entry:"target", type:"driver", targetName:"State driver target", alliancePins:15, yellowPins:5, midfield:1, toggles:3, placedPins:15, cups:8, goals:5, stopTime:18, score:133, notes:"clean route ceiling" });
  state.skills.push({ id:uid(), createdAt:new Date().toISOString(), entry:"actual", type:"driver", linkedTarget:state.targets.at(-1).id, alliancePins:13, yellowPins:4, midfield:1, toggles:3, placedPins:13, cups:7, goals:4, stopTime:12, score:113, notes:"lost one yellow ownership stack" });
  persist(); renderAll(); toast("Demo data loaded.");
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), version:2, ...state }, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "4330p-override-analytics-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
async function copyEvidence() {
  const plain = $("evidenceSummary").innerText;
  await navigator.clipboard.writeText(plain);
  toast("Process summary copied.");
}

document.addEventListener("click", (e) => {
  const goalOwner = e.target.closest("[data-goal-owner-index]");
  if (goalOwner) {
    setGoalYellowOwner(Number(goalOwner.dataset.goalOwnerIndex), goalOwner.dataset.goalOwner);
    return;
  }
  const goalButton = e.target.closest("[data-goal-index]");
  if (goalButton) {
    adjustGoalScorer(Number(goalButton.dataset.goalIndex), goalButton.dataset.goalKey, Number(goalButton.dataset.goalStep));
    return;
  }
  const goalTap = e.target.closest("[data-goal-tap]");
  if (goalTap) {
    adjustGoalScorer(Number(goalTap.dataset.goalTap), selectedGoalMode, 1);
    return;
  }
  const goalMode = e.target.closest("[data-goal-mode]");
  if (goalMode) {
    setGoalMode(goalMode.dataset.goalMode);
    return;
  }
  const stepButton = e.target.closest("[data-step-target]");
  if (stepButton) {
    const input = $(stepButton.dataset.stepTarget);
    if (!input) return;
    const next = Number(input.value || 0) + Number(stepButton.dataset.step || 0);
    const minValue = input.min === "" ? 0 : Number(input.min);
    const maxValue = input.max === "" ? Infinity : Number(input.max);
    input.value = Math.max(minValue, Math.min(maxValue, next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    $$(".tab").forEach(t => t.classList.remove("active"));
    $$(".view").forEach(v => v.classList.remove("active"));
    tab.classList.add("active");
    $(tab.dataset.tab).classList.add("active");
    updateLayoutMode();
    renderAll();
  }
  const jump = e.target.closest("[data-jump]");
  if (jump) document.querySelector(`[data-tab="${jump.dataset.jump}"]`).click();
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "export-json") exportJson();
  if (action === "load-demo") demoData();
  if (action === "copy-evidence") copyEvidence().catch(() => toast("Clipboard blocked; select text manually."));
  if (action === "undo-goal-scorer") undoGoalScorer();
  if (action === "reset-goal-scorer") resetGoalScorer();
  if (action === "import-standings") importStandings();
  if (action === "open-vex-standings") window.open("https://events.vex.com/robot-competitions/vex-robotics-competition/standings/skills", "_blank", "noopener");
  if (action === "clear-matches" && confirm("Erase all match data on this device?")) { state.matches = []; persist(); renderAll(); }
  if (action === "clear-skills" && confirm("Erase all skills targets and actual runs on this device?")) { state.skills = []; state.targets = []; persist(); renderAll(); }
  const dm = e.target.closest("[data-delete-match]");
  if (dm) { state.matches = state.matches.filter(m => m.id !== dm.dataset.deleteMatch); persist(); renderAll(); }
  const ds = e.target.closest("[data-delete-skill]");
  if (ds) {
    if (ds.dataset.kind === "target") state.targets = state.targets.filter(s => s.id !== ds.dataset.deleteSkill);
    else state.skills = state.skills.filter(s => s.id !== ds.dataset.deleteSkill);
    persist(); renderAll();
  }
  const dsc = e.target.closest("[data-delete-scout]");
  if (dsc) { state.scouts = state.scouts.filter(s => s.id !== dsc.dataset.deleteScout); persist(); renderAll(); }
});

document.addEventListener("input", (e) => {
  if (e.target.matches("input, select, textarea")) {
    if (e.target.id === "matchAlliance") syncGoalScorerToTotals();
    if (e.target.id === "scoutTeam") fillScoutFormFromTeam(e.target.value);
    renderGoalScoreStrip();
    renderMatchPreview();
    renderSkillsPreview();
    renderTargetOptions();
  }
});
$("filterMatches").addEventListener("change", (e) => { selectedFilter = e.target.value; renderDashboard(); });
$("matchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.matches.push(buildMatch());
  persist();
  resetMatchEntryAfterSave();
  renderDashboard();
  renderLatestChange();
  renderEvidence();
  toast("Match saved.");
});
$("skillsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const entry = buildSkill();
  if (entry.entry === "target") {
    if (!entry.targetName) entry.targetName = `${entry.type} target ${state.targets.length + 1}`;
    state.targets.push(entry);
  } else {
    state.skills.push(entry);
  }
  persist();
  $("skillNotes").value = "";
  $("skillTargetName").value = "";
  renderAll();
  toast(entry.entry === "target" ? "Target blueprint saved." : "Skills run saved.");
});
$("scoutForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const team = text("scoutTeam").toUpperCase() || `TEAM ${state.scouts.length + 1}`;
  const existing = findScoutByTeam(team);
  const scout = existing || {
    id: uid(),
    createdAt: new Date().toISOString()
  };
  Object.assign(scout, {
    team,
    rank: num("scoutRank") || 0,
    record: text("scoutRecord"),
    wp: num("scoutWp"),
    ap: num("scoutAp"),
    sp: num("scoutSp"),
    skills: num("scoutSkills"),
    driver: num("scoutDriver"),
    autonSkills: num("scoutAutonSkills"),
    fit: num("scoutFit"),
    notes: text("scoutNotes"),
    updatedAt: new Date().toISOString()
  });
  scout.score = scoutScore(scout);
  if (!existing) state.scouts.push(scout);
  persist();
  $("scoutTeam").value = "";
  $("scoutRank").value = "";
  $("scoutRecord").value = "";
  $("scoutNotes").value = "";
  renderAll();
  toast(existing ? "Scout card updated." : "Scout card saved.");
});
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  state.matches = imported.matches || [];
  state.skills = imported.skills || [];
  state.targets = imported.targets || [];
  state.scouts = imported.scouts || [];
  persist();
  renderAll();
  toast("Data imported.");
});

renderAll();
