import {
  ZONES,
  COLORS,
  blankField,
  headScore,
  skillsScore,
  scoreRecord,
  opponentScore,
  summary,
  opportunities,
  midfieldOwner,
} from "./modules/scoring.js";
import {
  emptyWorkspace,
  readWorkspace,
  persistWorkspace,
  validateWorkspace,
  legacyRecords,
  REAL_KEY,
  DEMO_KEY,
} from "./modules/store.js";
import { analyze, practicePriorities } from "./modules/analysis.js";
import { makeDemo } from "./modules/demo.js";
import {
  eventIndex,
  loadEvent,
  eventSkills,
  observationStats,
} from "./modules/data.js";

import { refreshOfficial, officialSchedule, matchTeams, matchState, freshnessLabel } from "./modules/live.js";

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const params = new URLSearchParams(location.search),
  demo = params.get("dev") === "1";
const uid = () => crypto.randomUUID();
const fmt = (v) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v);
const date = (v) => {
  const d = new Date(v);
  return Number.isFinite(+d)
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Date unavailable";
};
const resultName = (r) =>
  scoreRecord(r) > opponentScore(r)
    ? "Win"
    : scoreRecord(r) < opponentScore(r)
      ? "Loss"
      : "Tie";
const typeName = (t) =>
  ({
    head: "Head-to-head",
    driver: "Driver Skills",
    autonomous: "Autonomous Skills",
  })[t] || t;
const icon = (name) => {
  const paths = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    score: "M5 4h14v16H5z M8 8h8 M8 12h3 M14 12h2 M8 16h3 M14 16h2",
    event: "M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16",
    scout:
      "M2 17l3-9h4l2 9 M13 17l2-9h4l3 9 M2 17a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M14 17a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M10 13h4",
    analysis: "M4 3v17h17 M8 15l4-6 4 3 5-8",
    picks: "M9 5h12 M9 12h12 M9 19h12 M3 4l1 1 2-2 M3 11l1 1 2-2 M3 18l1 1 2-2",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    plus: "M12 5v14 M5 12h14",
    download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4",
    settings: "M4 7h16 M4 17h16 M9 4v6 M15 14v6",
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.arrow}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
const button = (text, action, extra = "", kind = "") =>
  `<button class="button ${kind}" data-action="${action}" ${extra}>${text}</button>`;
const badge = (text, color = "") =>
  `<span class="badge ${color}">${esc(text)}</span>`;
const metric = (label, value, detail = "") =>
  `<div class="stat"><small>${esc(label)}</small><strong>${esc(value)}</strong><div class="hint">${esc(detail)}</div></div>`;
const empty = (title, body, action = "") =>
  `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;
const title = (eyebrow, heading, description, actions = "") =>
  `<header class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(heading)}</h1><p>${esc(description)}</p></div><div class="actions">${actions}</div></header>`;
let store,
  startupError = "",
  index = null,
  indexError = "",
  eventQuery = "",
  scoutQuery = "",
  scoutSort = "number",
  selectedCompare = [],
  analysisType = "head",
  analysisDays = "all",
  analysisEvent = "all",
  eventTab = "schedule",
  scheduleScope = "mine",
  liveBusy = false,
  liveNeedsRender = false,
  liveError = "",
  scoreType = "head",
  zone = "top",
  storedRaw = null;
try {
  storedRaw = localStorage.getItem(demo ? DEMO_KEY : REAL_KEY);
  store = readWorkspace(localStorage, demo, makeDemo);
} catch (e) {
  startupError =
    "Saved data could not be opened. It has not been overwritten. Export the original data from Settings before restoring a backup. " +
    e.message;
  store = emptyWorkspace();
}
const drafts = {
    head: blankField(),
    driver: blankField(),
    autonomous: blankField(),
  },
  undos = { head: [], driver: [], autonomous: [] };
try {
  const saved = JSON.parse(sessionStorage.getItem("vex-v2-drafts-" + demo));
  if (saved)
    for (const t of Object.keys(drafts)) {
      if (saved[t]) {
        headScore(saved[t], "red");
        drafts[t] = saved[t];
      }
    }
} catch {}
let alliance = "red",
  toastTimer,
  busy = false;
try {
  const savedAlliance = sessionStorage.getItem("vex-v2-alliance-" + demo);
  if (["red", "blue"].includes(savedAlliance)) alliance = savedAlliance;
} catch {}
function setAlliance(value) {
  alliance = value;
  try {
    sessionStorage.setItem("vex-v2-alliance-" + demo, value);
  } catch {}
}
const currentEvent = () => store.events.find((e) => e.id === store.activeEvent);
const records = () =>
  store.records
    .filter((r) => r.team === store.team)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const page = () =>
  ["overview", "score", "event", "scout", "analysis", "picks"].includes(
    location.hash.slice(1),
  )
    ? location.hash.slice(1)
    : "overview";
const picks = () => store.picks[store.activeEvent] || [];
const observations = (team) =>
  store.observations.filter(
    (o) => o.eventId === store.activeEvent && (!team || o.team === team),
  );
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4300);
}
function commit(next) {
  if (startupError)
    throw new Error("Recover your stored data before saving new records.");
  storedRaw = persistWorkspace(localStorage, demo, next, storedRaw);
  store = next;
}
function mutate(fn) {
  const next = structuredClone(store);
  fn(next);
  commit(next);
}
function refresh() {
  render();
}
function navigate(next) {
  if (page() === next) render();
  else location.hash = next;
}
function showDialog(heading, content) {
  $("#dialog").innerHTML =
    `<div class="dialog-head"><h2 id="dialog-title">${esc(heading)}</h2><button data-action="close" aria-label="Close dialog">×</button></div>${content}`;
  if (!$("#dialog").open) $("#dialog").showModal();
}
function closeDialog() {
  $("#dialog").close();
}
function selectedOptions(values, selected) {
  return values
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
}
function sourceLabel(e) {
  return e?.source === "demo"
    ? "Synthetic event"
    : e?.source === "manual"
      ? "Manually entered event"
      : "Synced VEX snapshot";
}
function eventSelector() {
  return `<label>Event<select id="event-select">${selectedOptions([["", "Select an event"], ...store.events.map((e) => [e.id, e.name])], store.activeEvent)}</select></label>`;
}
function teamLabel(n) {
  const t = currentEvent()?.teams.find((t) => t.number === n);
  return `${esc(n)}${t ? `<small>${esc(t.name)}</small>` : ""}`;
}
function matchCard(s) {
  return `<div class="next-match"><div class="match-title"><div><small>${esc(s.field || "Field not set")}</small><strong style="display:block">${esc(s.label)}</strong></div>${badge(s.time || "Time not set")}</div><div class="alliances"><div class="alliance red">${s.red.map((n) => `<span class="${n === store.team ? "mine" : ""}">${esc(n)}</span>`).join(" + ")}</div><span class="vs">vs</span><div class="alliance blue">${s.blue.map((n) => `<span class="${n === store.team ? "mine" : ""}">${esc(n)}</span>`).join(" + ")}</div></div><small>${demo ? "Synthetic schedule" : "Manually entered schedule"} · verify field and time at the event.</small></div>`;
}
function chart(rows) {
  if (rows.length < 2)
    return empty(
      "A trend needs two records",
      "Save complete attempts, including the ones that do not go as planned.",
    );
  const chronological = [...rows].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const all = chronological.slice(-40);
  const scores = all.map(scoreRecord),
    max = Math.max(20, ...scores) * 1.15;
  const x = (i) => 45 + (i * 600) / Math.max(1, all.length - 1),
    y = (v) => 180 - (v / max) * 150;
  const points = scores.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 680 220" role="group" aria-label="${esc(typeName(all[0].type))} scores over ${all.length} saved records, from ${scores[0]} to ${scores.at(-1)} points"><path class="area" d="M45 180 L${points.replaceAll(" ", " L")} L645 180Z"/>${[0, 0.5, 1].map((p) => `<line class="gridline" x1="45" y1="${y(max * p)}" x2="655" y2="${y(max * p)}"/><text x="3" y="${y(max * p) + 4}">${Math.round(max * p)}</text>`).join("")}<polyline class="line" points="${points}"/>${scores.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="5" data-action="record" data-id="${esc(all[i].id)}" role="button" tabindex="0" aria-label="Open ${esc(all[i].label)}, ${v} points"><title>${esc(date(all[i].createdAt))}: ${v} points · ${esc(all[i].label)}</title></circle>`).join("")}<text x="45" y="207">${esc(date(all[0].createdAt))}</text><text x="645" y="207" text-anchor="end">${esc(date(all.at(-1).createdAt))}</text></svg><div class="chart-caption"><span>Exact results · ${all.length} most recent records</span></div>`;
}
function recentRows(rows, limit = 5) {
  return rows
    .slice(0, limit)
    .map(
      (r) =>
        `<div class="record-row"><button data-action="record" data-id="${esc(r.id)}"><strong>${esc(r.label || typeName(r.type))}</strong><small>${esc(typeName(r.type))} · ${esc(date(r.createdAt))}${r.type === "head" ? ` · ${r.alliance === "red" ? "Red" : "Blue"} · ${resultName(r)}` : ""}${r.route ? " · " + esc(r.route) : ""}</small></button>${r.source === "demo" ? badge("Sample") : badge(r.eventId ? "Event" : "Practice")}<span class="record-score">${fmt(scoreRecord(r))}${r.type === "head" ? ` <small>– ${fmt(opponentScore(r))}</small>` : ""}</span></div>`,
    )
    .join("");
}
function overview() {
  const all = records(),
    head = all.filter((r) => r.type === "head"),
    driver = summary(all.filter((r) => r.type === "driver")),
    auton = summary(all.filter((r) => r.type === "autonomous"));
  const event = currentEvent();
  const official = event?.source === "synced";
  const nextPublished = official ? officialSchedule(event, store.team).find(m => !m.started && m.scored !== true && !m.alliances?.some(a => a.score > 0)) : null;
  const upcoming = store.schedules.filter(
    (s) =>
      s.eventId === store.activeEvent &&
      [...s.red, ...s.blue].includes(store.team) &&
      !s.done,
  )[0];
  return (
    title(
      "TEAM WORKSPACE",
      "Team overview",
      "Practice records, event preparation, and scouting in one place.",
      `<a class="button primary" href="#score">${icon("plus")} Score a run</a>`,
    ) +
    `<div class="stats">${metric("Saved records", all.length, "On this device")}${metric("Head-to-head", head.length ? `${head.filter((r) => scoreRecord(r) > opponentScore(r)).length}W / ${head.filter((r) => scoreRecord(r) < opponentScore(r)).length}L` : "—", "Alliance results · ties excluded here")}${metric("Best Driver Skills", fmt(driver.best), driver.n + " saved attempts")}${metric("Best Autonomous Skills", fmt(auton.best), auton.n + " saved attempts")}</div><div class="grid main-side"><section class="card"><div class="card-head"><div><h2>Practice trajectory</h2><p>Driver Skills · separate from autonomous runs</p></div><a href="#analysis" class="link-button">View analysis →</a></div>${chart(all.filter((r) => r.type === "driver"))}</section><section class="card"><div class="card-head"><h2>Your next match</h2>${badge(event ? "Event workspace" : "No event")}</div>${official ? `${competitionStatus(event)}${nextPublished ? officialMatchCard(nextPublished) : empty("No upcoming match retrieved", "Check the competition schedule for published matches and results.", `<a class="button" href="#event">Open competition</a>`)}` : upcoming ? matchCard(upcoming) : empty("Plan your next event", "Select an event to connect scouting, schedules and picks.", `<a class="button" href="#event">Open competition</a>`)}</section></div><div class="grid two section-gap"><section class="card"><div class="card-head"><h2>Recent records</h2><a class="link-button" href="#analysis">View all →</a></div>${all.length ? recentRows(all) : empty("Your first record starts here", "Score a match or a Skills run to create your practice baseline.", `<a class="button primary" href="#score">Start scoring</a>`)}</section><section class="card"><div class="card-head"><h2>Event preparation</h2><a href="#picks" class="link-button">Open picklist →</a></div>${event ? `<p style="font-weight:600;margin-bottom:10px">${esc(event.name)}</p><div class="metric-line"><span>Teams in this event</span><strong>${event.teams.length}</strong></div><div class="metric-line"><span>Your scouting observations</span><strong>${observations().length}</strong></div><div class="metric-line"><span>Teams on your picklist</span><strong>${picks().length}</strong></div><p class="inline-note section-gap">${esc(sourceLabel(event))}. Saved locally. Prepare and print your picklist before alliance selection.</p>` : empty("Choose your competition", "Event-specific notes and picks stay together.", `<a class="button" href="#event">Browse events</a>`)}</section></div>`
  );
}
function typeSwitch(selected, action) {
  return `<div class="segmented">${["head", "driver", "autonomous"].map((t) => `<button class="${selected === t ? "active accent" : ""}" data-action="${action}" data-type="${t}" aria-pressed="${selected === t}">${t === "head" ? "Head-to-head" : t === "driver" ? "Driver Skills" : "Autonomous"}</button>`).join("")}</div>`;
}
function fieldMap(f) {
  return `<div class="field-wrap" role="group" aria-label="Field regions and toggles"><svg class="field-map" viewBox="0 0 400 400" aria-hidden="true"><rect x="9" y="9" width="382" height="382" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="3"/><path d="M10 10L390 390 M390 10L10 390" stroke="var(--border)" stroke-width="2"/><path d="M200 133L267 200L200 267L133 200Z" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.5"/></svg>${ZONES.map((z) => `<button class="zone-button ${z} ${z === zone ? "active" : ""}" data-action="zone" data-zone="${z}" aria-label="Select ${z === "center" ? "midfield" : z} zone" aria-pressed="${z === zone}"><span class="zone-label"><span class="zone-name">${z === "center" ? "Midfield" : z}</span><strong><b class="red-text">${f.zones[z].red}</b> / <b class="blue-text">${f.zones[z].blue}</b> / <b class="yellow-text">${f.zones[z].yellow}</b></strong></span></button>`).join("")}${ZONES.filter(
    (z) => z !== "center",
  )
    .map(
      (z) =>
        `<button class="field-toggle ${z}" data-action="field-toggle" data-zone="${z}" style="--toggle-color:var(--${f.zones[z].toggle === "neutral" ? "yellow" : f.zones[z].toggle})" aria-label="${z} toggle: ${f.zones[z].toggle}. Cycle neutral, red, blue." title="${z}: ${f.zones[z].toggle} · click to cycle"></button>`,
    )
    .join(
      "",
    )}</div><div class="field-key"><span><i style="background:var(--red)"></i>Red halves</span><span><i style="background:var(--blue)"></i>Blue halves</span><span><i style="background:var(--yellow)"></i>Yellow halves</span></div>`;
}
function allianceControl() {
  return `<div class="your-alliance"><small>Your alliance</small><div class="segmented">${["red", "blue"].map((c) => `<button data-action="alliance" data-value="${c}" class="${c}-text ${alliance === c ? "active" : ""}" aria-pressed="${alliance === c}">${c === "red" ? "Red" : "Blue"}</button>`).join("")}</div></div>`;
}
function scorePage() {
  const f = drafts[scoreType],
    head = scoreType === "head",
    r = headScore(f, "red"),
    b = headScore(f, "blue"),
    s = skillsScore(f);
  return (
    title(
      "PRACTICE / SCORING",
      "Score the field.",
      "Select any region. Tap a field toggle to change its ownership.",
      typeSwitch(scoreType, "score-type"),
    ) +
    `<section class="card score-header"><div class="score-total">${head ? `<div><small class="red-text">Red alliance</small><strong class="red-text">${r.total}</strong></div><span class="muted">:</span><div><small class="blue-text">Blue alliance</small><strong class="blue-text">${b.total}</strong></div>` : `<div><small>${esc(typeName(scoreType))}</small><strong class="accent-text">${s.total}</strong></div><small>points</small>`}</div>${head ? allianceControl() : ""}<div class="actions">${button("Undo", "undo", undos[scoreType].length ? "" : "disabled", "ghost")}${button("Reset", "reset", "", "ghost")}${button("Save " + (head ? "match" : "run"), "save-dialog", "", "primary")}</div></section><div class="score-layout"><section class="card field-card"><div class="card-head"><div><h2>Field overview</h2><p>Click anywhere inside a region</p></div>${badge("Manual v2.1")}</div>${fieldMap(f)}<p class="inline-note section-gap">${head ? "Zone totals combine the goals in that quadrant. AWP needs a separate autonomous-period check." : "Top/right are blue quadrants. Bottom/left are red quadrants. Wrong-color halves do not add Skills points."}</p></section><section class="card zone-editor"><div class="zone-tabs">${ZONES.map((z) => button(z === "center" ? "Midfield" : z[0].toUpperCase() + z.slice(1), "zone", `data-zone="${z}" aria-pressed="${zone === z}"`, "small " + (zone === z ? "primary" : "ghost"))).join("")}</div><div class="card-head"><div><div class="eyebrow">SELECTED ZONE</div><h2>${zone === "center" ? "Midfield" : zone[0].toUpperCase() + zone.slice(1) + " quadrant"}</h2></div>${badge(zone === "center" ? (head ? midfieldOwner(f) : f.skillsRobot ? "Owned" : "Unowned") + " ownership" : f.zones[zone].toggle + " toggle")}</div>${COLORS.map(
      (c) => {
        const noScore =
          !head &&
          zone !== "center" &&
          c !== "yellow" &&
          c !== (["top", "right"].includes(zone) ? "blue" : "red");
        return `<div class="counter-row"><div class="counter-label ${c}-text">${c[0].toUpperCase() + c.slice(1)} halves<small>${noScore ? "Do not score in this Skills zone" : c === "yellow" ? "10 points when owned" : "5 points per scored half"}</small></div><div class="counter"><button data-action="count" data-color="${c}" data-delta="-1" aria-label="Decrease ${c} halves" ${f.zones[zone][c] === 0 ? "disabled" : ""}>−</button><input type="number" min="0" max="126" step="1" value="${f.zones[zone][c]}" data-count="${c}" aria-label="${c} pin halves in ${zone}" inputmode="numeric"><button data-action="count" data-color="${c}" data-delta="1" aria-label="Increase ${c} halves" ${f.zones[zone][c] >= 126 ? "disabled" : ""}>+</button></div></div>`;
      },
    ).join(
      "",
    )}<div class="control-group"><h3>${zone === "center" ? "Midfield robots" : "Quadrant toggle"}</h3>${zone === "center" ? (head ? ["red", "blue"].map((c) => `<div class="counter-row"><span class="${c}-text">${c[0].toUpperCase() + c.slice(1)} robots</span><div class="segmented">${[0, 1, 2].map((n) => `<button data-action="robots" data-color="${c}" data-value="${n}" class="${f.robots[c] === n ? "active" : ""}" aria-label="${n} ${c} midfield robots" aria-pressed="${f.robots[c] === n}">${n}</button>`).join("")}</div></div>`).join("") : `<div class="toggle-controls">${[false, true].map((v) => `<button data-action="skills-robot" data-value="${v}" aria-pressed="${f.skillsRobot === v}" class="${f.skillsRobot === v ? "selected" : ""}">${v ? "Robot in midfield" : "No robot"}</button>`).join("")}</div>`) : `<div class="toggle-controls">${["red", "neutral", "blue"].map((c) => `<button data-action="toggle" data-value="${c}" class="${c} ${f.zones[zone].toggle === c ? "selected" : ""}" aria-pressed="${f.zones[zone].toggle === c}">${c === "neutral" ? "Neutral" : c[0].toUpperCase() + c.slice(1)}</button>`).join("")}</div><small>Robot contact or an unseated toggle means neutral.</small>`}</div>${
      head
        ? `<div class="control-group"><h3>Autonomous bonus</h3><div class="toggle-controls">${[
            ["red", "Red"],
            ["blue", "Blue"],
            ["tie", "Tie"],
            ["none", "None"],
          ]
            .map(
              ([v, l]) =>
                `<button data-action="auton" data-value="${v}" aria-pressed="${f.auton === v}" class="${v} ${f.auton === v ? "selected" : ""}">${l}</button>`,
            )
            .join("")}</div></div>`
        : ""
    }</section></div><details class="card section-gap score-details"><summary>Score breakdown <small>Calculated from this field</small></summary><div class="grid two section-gap" id="score-breakdown">${head ? breakdown(r, "Red alliance", "red") + breakdown(b, "Blue alliance", "blue") : breakdown(s, typeName(scoreType), "accent") + `<p class="inline-note">Autonomous and Driver Skills use the same scoring rules. There is no autonomous bonus in Skills. Save each attempt under its actual run type.</p>`}</div></details>`
  );
}
function breakdown(parts, label, color) {
  return `<div><h3 class="${color}-text">${esc(label)} · ${parts.total} pts</h3><div class="breakdown">${[
    ["pins", "var(--muted)"],
    ["yellow", "var(--yellow)"],
    ["midfield", "var(--accent)"],
    ["auton", "var(--blue)"],
  ]
    .map(([k, c]) =>
      parts[k]
        ? `<span style="flex:${parts[k]};background:${c}" title="${k}: ${parts[k]}"></span>`
        : "",
    )
    .join("")}</div>${[
    ["pins", "Red/blue halves"],
    ["yellow", "Owned yellow halves"],
    ["midfield", "Midfield robots"],
    ["auton", "Autonomous bonus"],
  ]
    .map(
      ([k, l]) =>
        `<div class="metric-line"><span>${l}</span><strong>${parts[k]}</strong></div>`,
    )
    .join("")}</div>`;
}
function competitionStatus(e) {
  const resource = page() === "scout" ? "skills" : eventTab === "rankings" && page() === "event" ? "rankings" : "matches";
  return e.source === "synced" ? `<p class="inline-note" data-live-status="${resource}" role="status">${esc(freshnessLabel(e, Date.now(), resource))}${liveError ? " · " + esc(liveError) : ""}</p>` : "";
}
function officialMatchCard(m) {
  const e = currentEvent();
  const time = m.scheduled ? new Date(m.scheduled).toLocaleString(undefined, {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"}) : "Time not published";
  return `<article class="card official-match"><div class="card-head"><div><h3>${esc(m.name || "Match " + m.matchnum)}</h3><small>${esc(m.division?.name)} · ${esc(m.field || "Field pending")} · ${esc(time)}</small></div>${badge(matchState(m))}</div><div class="alliances official-alliances">${["red", "blue"].map(c => `<div class="alliance ${c}"><strong>${fmt(m.alliances?.find(a=>a.color===c)?.score)}</strong><div>${matchTeams(m,c).map(n => `<button class="team-link" data-action="team" data-team="${esc(n)}">${esc(n)}${n === store.team ? " · You" : ""}</button>`).join(" + ")}</div></div>`).join("")}</div></article>`;
}
function eventPage() {
  const e = currentEvent();
  const header = title("COMPETITION", "Competition workspace", "Schedules, results and scouting for your event.", button("Find an event", "events-dialog", "", "primary"));
  if (!e) return header + empty("Choose your competition", "Search the worldwide event catalog.", button("Browse events", "events-dialog", "", "primary"));
  const imported = officialSchedule(e, scheduleScope === "mine" ? store.team : "");
  let body;
  if (eventTab === "teams") body = `<section class="card">${teamTable(e.teams)}</section>`;
  else if (eventTab === "rankings") body = `<section class="card"><h2>Official rankings</h2><div class="table-wrap"><table><thead><tr><th>Division</th><th>Rank</th><th>Team</th><th>W–L–T</th><th>WP</th></tr></thead><tbody>${[...(e.rankings || [])].sort((a,b)=>(a.division?.id || 0)-(b.division?.id || 0) || a.rank-b.rank).map(r=>`<tr><td>${esc(r.division?.name)}</td><td>${fmt(r.rank)}</td><td><button class="team-link" data-action="team" data-team="${esc(r.team?.name)}">${esc(r.team?.name)}</button></td><td>${fmt(r.wins)}–${fmt(r.losses)}–${fmt(r.ties)}</td><td>${fmt(r.wp)}</td></tr>`).join("")}</tbody></table></div>${e.rankings?.length ? "" : empty("Rankings unavailable", "Rankings will appear when published and retrieved.")}</section>`;
  else if (e.matches?.length) body = `<section><div class="filters"><label>Matches<select id="schedule-scope">${selectedOptions([["mine","My team"],["all","All teams"]],scheduleScope)}</select></label><small>Times shown in ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</small></div><div class="grid two">${imported.map(officialMatchCard).join("") || empty("No matches for this team", "Choose All teams to view the complete event schedule.")}</div></section>`;
  else {
    const manual = store.schedules.filter(s=>s.eventId === e.id);
    body = `<section class="card"><div class="card-head"><h2>Match schedule</h2>${button("Add private match", "schedule-dialog", "", "small")}</div>${manual.length ? `<div class="grid two">${manual.map(s=>`<article class="card">${matchCard(s)}<div class="actions">${button(s.done ? "Mark upcoming" : "Mark complete","schedule-done",`data-id="${esc(s.id)}"`,"small")}${button("Score this match","score-schedule",`data-id="${esc(s.id)}"`,"small")}${button("Remove","schedule-remove",`data-id="${esc(s.id)}"`,"small ghost")}</div></article>`).join("")}</div>` : empty("Schedule unavailable", "No published schedule has been retrieved yet.")}</section>`;
  }
  return header + `<section class="card"><div class="card-head"><div><h2>${esc(e.name)}</h2><p>${esc(date(e.date))} · ${esc(e.location)}</p></div>${badge(sourceLabel(e))}</div><div class="filters">${eventSelector()}<div class="actions">${e.source === "synced" ? button(liveBusy ? "Refreshing…" : "Refresh now", "refresh-event", liveBusy ? "disabled" : "") : ""}${button("Scout teams","go-scout")}</div></div>${competitionStatus(e)}</section><div class="subnav section-gap">${[["schedule","Schedule & results"],["teams","Event teams"],["rankings","Rankings"]].map(([v,l])=>`<button data-action="event-tab" data-tab="${v}" class="${eventTab === v ? "active" : ""}">${l}</button>`).join("")}</div>${body}`;
}
async function refreshCompetition(manual = false) {
  const event = currentEvent();
  if (demo || liveBusy || !event || event.source !== "synced" || !navigator.onLine || document.hidden) return;
  if (!manual && !["event", "scout", "picks", "overview"].includes(page())) return;
  liveBusy = true;
  let changed = liveNeedsRender;
  try {
    const updated = await refreshOfficial(event);
    if (store.activeEvent !== event.id) return;
    changed ||= ["name", "date", "location", "teams", "matches", "rankings", "skills"].some(key => JSON.stringify(event[key]) !== JSON.stringify(updated[key]));
    mutate(w => { const index = w.events.findIndex(e=>e.id===event.id); if (index>=0) w.events[index] = updated; });
    liveError = updated.liveState === "partial" ? "Some updates are delayed" : "";
  } catch(error) { liveError = error.message; }
  finally {
    liveBusy = false;
    const editing = $("#dialog").open || document.activeElement?.matches("input,textarea,select,[contenteditable=true]");
    liveNeedsRender = changed;
    if (changed && !editing && ["event","scout","picks","overview"].includes(page())) { render(); liveNeedsRender = false; }
    else if ($("[data-live-status]")) $("[data-live-status]").textContent = freshnessLabel(currentEvent() || event, Date.now(), $("[data-live-status]").dataset.liveStatus) + (liveError ? " · " + liveError : "");
  }
}
function teamTable(teams) {
  const e = currentEvent();
  return `<div class="table-wrap"><table class="team-table"><thead><tr><th>Team</th><th class="num">Event skills</th><th class="num">Observed auton</th><th class="num">Notes</th><th class="num">Pick / compare</th></tr></thead><tbody>${teams
    .map((t) => {
      const stats = observationStats(observations(t.number)),
        skills = eventSkills(e, t.number),
        picked = picks().some((p) => p.team === t.number);
      return `<tr><td><button class="team-link team-name" data-action="team" data-team="${esc(t.number)}"><strong>${esc(t.number)} ${t.number === store.team ? badge("You", "accent") : ""}</strong><small>${esc(t.name)}</small></button></td><td class="num" data-label="Event Skills">${fmt(skills.total)}${skills.partial ? "<small>Partial</small>" : ""}</td><td class="num" data-label="Observed auton">${stats.auton.n ? `${stats.auton.yes}/${stats.auton.n}` : "—"}</td><td class="num" data-label="Observations">${stats.n}</td><td><div class="row-actions">${t.number !== store.team ? button(picked ? "On list" : "+ Pick", "pick-toggle", `data-team="${esc(t.number)}"`, "small " + (picked ? "" : "ghost")) : ""}<label class="check" title="Compare ${esc(t.number)}"><input type="checkbox" data-compare="${esc(t.number)}" aria-label="Compare ${esc(t.number)}" ${selectedCompare.includes(t.number) ? "checked" : ""}></label></div></td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function scouting() {
  const e = currentEvent();
  let teams =
    e?.teams.filter((t) =>
      (t.number + " " + t.name)
        .toLowerCase()
        .includes(scoutQuery.toLowerCase()),
    ) || [];
  teams.sort((a, b) =>
    scoutSort === "skills"
      ? (eventSkills(e, b.number).total ?? -1) -
        (eventSkills(e, a.number).total ?? -1)
      : scoutSort === "notes"
        ? observations(b.number).length - observations(a.number).length
        : a.number.localeCompare(b.number, undefined, { numeric: true }),
  );
  return (
    title(
      "SCOUTING",
      "Scouting",
      "Record observations, compare teams, and prepare your picks.",
      button(
        `Compare (${selectedCompare.length}/2)`,
        "compare",
        selectedCompare.length === 2 ? "" : "disabled",
        "primary",
      ),
    ) +
    (!e
      ? empty(
          "Select an event to scout",
          "Observations belong to one event, so different seasons and tournaments do not get mixed together.",
          button("Find an event", "events-dialog", "", "primary"),
        )
      : `<section class="card"><div class="filters"><label>Search teams<input id="scout-query" placeholder="Team number or name" value="${esc(scoutQuery)}"></label><label style="flex:.5">Sort by<select id="scout-sort">${selectedOptions(
          [
            ["number", "Team number"],
            ["skills", "Event Skills score"],
            ["notes", "Observation count"],
          ],
          scoutSort,
        )}</select></label>${button("Add team", "add-team", "", "ghost")}</div><div class="card-head"><div><h2>${esc(e.name)}</h2><p>${teams.length} teams · autonomous fractions are observed task success, not alliance wins</p></div>${badge(sourceLabel(e))}</div>${competitionStatus(e)}${teams.length ? teamTable(teams) : empty("No teams found", "Try another team number or add a team manually.")}</section><p class="inline-note section-gap">Skills results are from this event snapshot only. A missing score does not mean a team scored zero. Observations are entered by your team and are not official match statistics.</p>`)
  );
}
function pickPage() {
  const e = currentEvent();
  return (
    title(
      "ALLIANCE PREPARATION",
      "Alliance picklist",
      "Rank candidates using your observations and event results.",
      button(icon("download") + " Print picks", "print", "", "primary"),
    ) +
    (!e
      ? empty(
          "Pick an event first",
          "Your picklist is specific to the teams attending.",
          button("Find an event", "events-dialog", "", "primary"),
        )
      : `<section class="card"><div class="card-head"><div><h2>${esc(e.name)}</h2><p>${picks().length} candidates · use the arrows to set your priority</p></div><a href="#scout" class="link-button">Add from scouting →</a></div><p class="inline-note">Prepare before alliance selection. Open this page online before your event to cache the app, or print this list. Mark selected or declined teams as unavailable; the app will keep your original order.</p><div class="print-title">${esc(store.team)} · ${esc(date(new Date()))} · ${demo ? "DEMONSTRATION DATA" : "Local scouting notes"}</div>${
          picks().length
            ? picks()
                .map((p, i) => {
                  const t = e.teams.find((t) => t.number === p.team),
                    stats = observationStats(observations(p.team));
                  return `<div class="pick-row ${p.status !== "available" ? "unavailable" : ""}"><span class="pick-number">${String(i + 1).padStart(2, "0")}</span><div class="team-name"><button class="team-link" data-action="team" data-team="${esc(p.team)}"><strong>${esc(p.team)}</strong><small>${esc(t?.name || "Team")}</small></button><small>${stats.n} observations · Auton ${stats.auton.n ? stats.auton.yes + "/" + stats.auton.n : "unknown"} · ${esc(p.status)}</small></div><select data-pick-status="${esc(p.team)}" aria-label="${esc(p.team)} availability">${selectedOptions(
                    [
                      ["available", "Available"],
                      ["selected", "Selected"],
                      ["declined", "Declined"],
                    ],
                    p.status,
                  )}</select><div class="row-actions">${button("↑", "pick-move", `data-team="${esc(p.team)}" data-delta="-1" aria-label="Move ${esc(p.team)} up" ${i === 0 ? "disabled" : ""}`, "small")}${button("↓", "pick-move", `data-team="${esc(p.team)}" data-delta="1" aria-label="Move ${esc(p.team)} down" ${i === picks().length - 1 ? "disabled" : ""}`, "small")}${button("Remove", "pick-toggle", `data-team="${esc(p.team)}"`, "small ghost")}</div></div>`;
                })
                .join("")
            : empty(
                "Build a considered shortlist",
                "Open a team profile, record what you observed, then add that team to your picks.",
                `<a class="button primary" href="#scout">Scout teams</a>`,
              )
        }</section>`)
  );
}
function distributionChart(a) {
  if (!a.n)
    return empty(
      "No scores to distribute",
      "Save a run to see how often each score range occurs.",
    );
  const max = Math.max(...a.bins.map((b) => b.n));
  return `<div class="distribution" role="img" aria-label="Score distribution: ${a.bins.map((b) => `${b.low} to ${b.high} points, ${b.n} records`).join("; ")}">${a.bins.map((b) => `<div class="histogram-column"><strong>${b.n}</strong><div class="histogram-track"><span style="height:${(b.n / max) * 100}%"></span></div><small>${b.low}–${b.high}</small></div>`).join("")}</div><p class="chart-caption">Score ranges · count of saved records, including zero scores</p>`;
}
function compositionChart(a) {
  const labels = {
    pins: "Red/blue halves",
    yellow: "Owned yellow halves",
    midfield: "Midfield robots",
    auton: "Autonomous bonus",
  };
  const colors = {
    pins: "muted",
    yellow: "yellow",
    midfield: "accent",
    auton: "blue",
  };
  if (!a.n)
    return empty(
      "No scoring breakdown yet",
      "Each saved field will contribute to this chart.",
    );
  const total = Object.values(a.composition).reduce((x, y) => x + y, 0);
  return `<div class="composition-total"><strong>${fmt(total)}</strong><small>average field points</small></div><div class="composition-bar" role="img" aria-label="Average points: ${Object.entries(
    a.composition,
  )
    .map(([k, v]) => `${labels[k]} ${fmt(v)}`)
    .join(", ")}">${Object.entries(a.composition)
    .filter(([, v]) => v > 0)
    .map(
      ([k, v]) =>
        `<span style="width:${(v / (total || 1)) * 100}%;background:var(--${colors[k]})" title="${labels[k]}: ${fmt(v)} average points"></span>`,
    )
    .join("")}</div>${Object.entries(a.composition)
    .filter(([k]) => a.head || k !== "auton")
    .map(
      ([k, v]) =>
        `<div class="metric-line"><span><i class="legend-swatch" style="background:var(--${colors[k]})"></i>${labels[k]}</span><strong>${fmt(v)}</strong></div>`,
    )
    .join(
      "",
    )}<p class="inline-note section-gap">${a.head ? "Alliance field totals; individual robot contribution is not recorded." : "Only legally scoring colors and owned yellow halves count."}${a.officialCount ? ` ${a.officialCount} records use official scores for results; this chart retains the field calculation.` : ""}</p>`;
}
function zoneChart(a) {
  if (!a.n)
    return empty(
      "No field records yet",
      "Zone contributions appear after you save a field.",
    );
  const max = Math.max(1, ...a.zones.map((z) => z.mean));
  return `<div class="zone-bars">${a.zones.map(({ zone, mean }) => `<div><span>${zone === "center" ? "Midfield" : zone[0].toUpperCase() + zone.slice(1)}</span><div class="zone-track"><i style="width:${(mean / max) * 100}%"></i></div><strong>${fmt(mean)}</strong></div>`).join("")}</div><p class="chart-caption">Average field points by zone. Midfield includes robots; autonomous bonus is separate.</p>`;
}
function marginChart(a) {
  if (!a.n)
    return empty(
      "No match margins yet",
      "Select your alliance when scoring to track the correct result.",
    );
  const rows = a.margins.slice(-16),
    max = Math.max(10, ...rows.map((r) => Math.abs(r.value)));
  return `<div class="margin-chart" aria-label="Your alliance's margin in its last ${rows.length} matches">${rows.map((r) => `<button data-action="record" data-id="${esc(r.id)}" class="margin-column" title="${esc(r.label)}: ${r.value > 0 ? "+" : ""}${r.value} points" aria-label="Open ${esc(r.label)}, ${r.value > 0 ? "won by" : r.value < 0 ? "lost by" : "tied"} ${Math.abs(r.value)} points"><span class="margin-top">${r.value >= 0 ? `<i style="height:${Math.max(2, (r.value / max) * 100)}%" class="positive"></i>` : ""}</span><span class="margin-bottom">${r.value < 0 ? `<i style="height:${(-r.value / max) * 100}%" class="negative"></i>` : ""}</span><small>${r.value > 0 ? "+" : ""}${r.value}</small></button>`).join("")}</div><p class="chart-caption">Most recent ${rows.length} matches, oldest → newest. Above zero = win. Select a bar to open its record.</p>`;
}
function analysisPage() {
  const rows = records().filter(
    (r) =>
      r.type === analysisType &&
      (analysisDays === "all" ||
        Date.now() - new Date(r.createdAt) <=
          Number(analysisDays) * 86400000) &&
      (analysisEvent === "all" ||
        r.eventId === (analysisEvent === "practice" ? "" : analysisEvent)),
  );
  const a = analyze(rows, analysisType),
    head = analysisType === "head";
  const wins = a.margins.filter((r) => r.value > 0).length,
    losses = a.margins.filter((r) => r.value < 0).length;
  const routes = [...new Set(rows.map((r) => r.route || "Unlabeled"))];
  return (
    title(
      "ANALYSIS",
      "Know what to practice next.",
      "Results, repeatability, and field patterns from your saved records.",
      typeSwitch(analysisType, "analysis-type"),
    ) +
    `<div class="filters analysis-filters"><div class="segmented">${[
      ["all", "All time"],
      ["7", "7 days"],
      ["30", "30 days"],
    ]
      .map(
        ([v, l]) =>
          `<button data-action="analysis-days" data-value="${v}" aria-pressed="${analysisDays === v}" class="${analysisDays === v ? "active" : ""}">${l}</button>`,
      )
      .join(
        "",
      )}</div><label>Record context<select id="analysis-event">${selectedOptions([["all", "All contexts"], ["practice", "Practice only"], ...store.events.map((e) => [e.id, e.name])], analysisEvent)}</select></label>${badge(rows.length + " records")}</div>
  <div class="stats">${metric(head ? "Median alliance score" : "Median score", fmt(a.median), "Typical saved result")}${metric("Middle 50%", a.n ? `${fmt(a.q1)}–${fmt(a.q3)}` : "—", "25th–75th percentile · points")}${metric("Recent change", a.recent ? `${a.recent.delta > 0 ? "+" : ""}${fmt(a.recent.delta)}` : "—", a.recent ? "Last 5 median vs previous 5" : "Needs 10 records in this view")}${metric(head ? "Win / loss / tie" : "Best / lowest", head ? (a.n ? `${wins} / ${losses} / ${a.n - wins - losses}` : "—") : a.n ? `${fmt(a.high)} / ${fmt(a.low)}` : "—", head ? "Based on your selected alliance" : "All attempts in this view")}</div>
  <div class="grid main-side"><section class="card"><div class="card-head"><div><h2>${head ? "Alliance results" : typeName(analysisType)} over time</h2><p>Select a point to inspect that record</p></div>${badge(a.n + " recorded")}</div>${chart(rows)}${a.recent ? `<div class="trend-detail"><span>Previous 5 median <strong>${fmt(a.recent.previous)}</strong></span><span>Latest 5 median <strong>${fmt(a.recent.latest)}</strong></span></div><p class="chart-caption">Describes these attempts; route, partner, and opponent changes may affect the comparison.</p>` : ""}</section><section class="card"><div class="card-head"><h2>Where points come from</h2></div>${compositionChart(a)}</section></div>
  <div class="grid two section-gap"><section class="card"><div class="card-head"><div><h2>Score consistency</h2><p>One high score is different from a repeatable score</p></div></div>${distributionChart(a)}</section><section class="card"><div class="card-head"><div><h2>${head ? "Match margins" : "Scoring by field region"}</h2><p>${head ? "Your alliance minus its opponent" : "Find where your route is scoring"}</p></div></div>${head ? marginChart(a) : zoneChart(a)}</section></div>
  <section class="card section-gap"><div class="card-head"><div><h2>Practice priorities</h2><p>Rule-based prompts from this view · no predicted wins or robot ratings</p></div>${badge(a.n < 5 ? "Small sample" : "Review with video")}</div><div class="priority-grid">${practicePriorities(
    a,
  )
    .map(
      (p, i) =>
        `<article class="priority"><span class="priority-number">0${i + 1}</span><h3>${esc(p.title)}</h3><p class="priority-evidence">${esc(p.evidence)}</p><p>${esc(p.action)}</p></article>`,
    )
    .join("")}</div></section>
  ${
    head
      ? `<div class="grid two section-gap"><section class="card"><div class="card-head"><h2>Autonomous bonus outcomes</h2></div>${[
          ["Won", a.auton?.won || 0, "accent"],
          ["Lost", a.auton?.lost || 0, "red"],
          ["Tied", a.auton?.tied || 0, "blue"],
          ["None selected", a.auton?.none || 0, "muted"],
        ]
          .map(
            ([l, n, c]) =>
              `<div class="outcome-row"><span>${l}</span><div><i style="width:${a.n ? (n / a.n) * 100 : 0}%;background:var(--${c})"></i></div><strong>${n}</strong></div>`,
          )
          .join(
            "",
          )}<p class="inline-note section-gap">None is excluded from wins, losses and ties. No autonomous-period robot actions are inferred from the final field.</p></section><section class="card"><div class="card-head"><h2>Scoring by field region</h2></div>${zoneChart(a)}</section></div>`
      : `<section class="card section-gap"><div class="card-head"><div><h2>Compare your route versions</h2><p>Keep failed runs and label each version when saving.</p></div></div><div class="table-wrap"><table><thead><tr><th>Route / version</th><th class="num">Runs</th><th class="num">Median</th><th class="num">Middle 50%</th><th class="num">Best</th></tr></thead><tbody>${routes
          .map((route) => {
            const s = analyze(
              rows.filter((r) => (r.route || "Unlabeled") === route),
            );
            return `<tr><td>${esc(route)}</td><td class="num">${s.n}</td><td class="num">${fmt(s.median)}</td><td class="num">${fmt(s.q1)}–${fmt(s.q3)}</td><td class="num">${fmt(s.high)}</td></tr>`;
          })
          .join(
            "",
          )}</tbody></table></div>${!a.n ? empty("No routes in this range", "Save attempts with a route label to compare your changes.") : ""}</section>`
  }
  <section class="card section-gap"><div class="card-head"><h2>Saved ${head ? "matches" : "runs"}</h2><small>${rows.length > 100 ? "Showing the latest 100 · export includes all records" : "Open a record for its field breakdown"}</small></div>${rows.length ? recentRows(rows, 100) : empty("No records in this range", "Change the date or context filter, or save your first attempt.", `<a class="button primary" href="#score">Score a run</a>`)}</section>`
  );
}
function render() {
  const focused = document.activeElement;
  const focusKey = focused?.closest("#app")
    ? {
        tag: focused.tagName,
        attrs: [...focused.attributes]
          .filter(
            (a) =>
              a.name.startsWith("data-") ||
              a.name === "id" ||
              a.name === "href",
          )
          .map((a) => [a.name, a.value]),
      }
    : null;
  const current = page();
  document.body.dataset.page = current;
  $("#app").innerHTML =
    `<div class="layout"><aside class="sidebar"><a class="brand" href="#overview"><img src="icon.svg" alt=""><div>VexOverride<small>TEAM WORKSPACE</small></div></a><button class="team-switch" data-action="settings" aria-label="Team and data settings"><span><strong>${esc(store.team || "Choose team")}</strong><small>${esc(store.teamName)}</small></span><span class="muted">⌄</span></button><nav class="nav" aria-label="Main navigation">${[
      ["overview", "Overview"],
      ["score", "Score"],
      ["event", "Competition"],
      ["scout", "Scouting"],
      ["analysis", "Analysis"],
      ["picks", "Picklist"],
    ]
      .map(
        ([p, label]) =>
          `<a class="${p === current ? "active" : ""}" href="#${p}" ${p === current ? 'aria-current="page"' : ""}>${icon(p)}<span>${label}</span></a>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><div class="connection ${navigator.onLine ? "" : "offline"}"><i class="dot"></i>${navigator.onLine ? "Online · saved locally" : "Offline · saved locally"}</div>${button(icon("settings") + " Team & data", "settings", "", "ghost")}<small>V5RC · Override 2026–27<br>Independent team tool</small></div></aside><div class="content"><div class="topline"><span><strong>${esc(store.team || "Choose team")}</strong> <span class="hide-mobile">/ V5RC / Override</span></span><span>${navigator.onLine ? "Local workspace" : "Offline workspace"} · ${demo ? "Demo" : "This device only"}</span></div>${demo ? `<div class="demo-banner"><span><strong>Demo workspace</strong> · Sample results and observations. Separate from your real data.</span><a href="./${location.hash}">Exit demo →</a></div>` : ""}<main id="main" tabindex="-1">${startupError ? `<div class="inline-note warn section-gap">${esc(startupError)} ${button("Recovery settings", "settings")}</div>` : ""}${{ overview, score: scorePage, event: eventPage, scout: scouting, analysis: analysisPage, picks: pickPage }[current]()}</main></div></div>`;
  if (focusKey?.attrs.length) {
    const selector =
      focusKey.tag +
      focusKey.attrs
        .map(([k, v]) => "[" + k + '="' + CSS.escape(v) + '"]')
        .join("");
    $(selector)?.focus({ preventScroll: true });
  }
}
function stashDraft() {
  try {
    sessionStorage.setItem("vex-v2-drafts-" + demo, JSON.stringify(drafts));
  } catch {}
}
function editField(fn) {
  undos[scoreType].push(structuredClone(drafts[scoreType]));
  if (undos[scoreType].length > 60) undos[scoreType].shift();
  fn(drafts[scoreType]);
  stashDraft();
  render();
}
function saveDialog(schedule = null) {
  if (!store.team) {
    settingsDialog();
    toast("Choose your team before saving a record.");
    return;
  }
  const head = scoreType === "head";
  showDialog(
    head ? "Save this match" : "Save this Skills run",
    `<form data-form="save"><p class="dialog-intro">${demo ? "Saved in your isolated demo workspace." : "Saved on this device. Export a backup from Team & data."}</p><div class="form-grid"><label>Record label<input name="label" value="${esc(schedule?.label || "")}" placeholder="Practice 12 or Q18" maxlength="100" required></label><label>Event<select name="event">${selectedOptions([["", "Practice · no event"], ...store.events.map((e) => [e.id, e.name])], schedule?.eventId || "")}</select></label>${
      head
        ? `<label>Your alliance<select name="alliance">${selectedOptions(
            [
              ["red", "Red alliance"],
              ["blue", "Blue alliance"],
            ],
            alliance,
          )}</select></label><label>Autonomous Win Point<select name="awp"><option value="unknown">Not recorded</option><option value="yes">Earned by our alliance</option><option value="no">Not earned</option></select></label><details class="wide"><summary>Official score differs from field calculation</summary><p class="dialog-intro">Use the posted result for penalties or disqualifications. Both scores are required; the original field stays available.</p><div class="form-grid"><label>Official red<input name="officialRed" type="number" min="0" max="9999" step="1"></label><label>Official blue<input name="officialBlue" type="number" min="0" max="9999" step="1"></label></div></details>`
        : `<label>Route / version<input name="route" placeholder="Route A · v3" maxlength="100"></label><label>Skills Stop Time (optional)<input name="stopTime" type="number" min="0" max="60" step="1" placeholder="Seconds remaining"></label>`
    }<label class="wide">Notes<textarea name="notes" maxlength="2000" placeholder="What changed? What failed? What should you check next?"></textarea></label></div><div class="dialog-actions">${button("Cancel", "close", "", "ghost")}<button class="button primary" type="submit">Save record</button></div><p class="form-error error" role="alert"></p></form>`,
  );
}
function recordDialog(id) {
  const r = store.records.find((r) => r.id === id);
  if (!r) return;
  const head = r.type === "head",
    parts = head ? headScore(r.field, r.alliance) : skillsScore(r.field);
  const ops = head ? opportunities(r.field, r.alliance) : [];
  showDialog(
    r.label || typeName(r.type),
    `<div class="actions">${badge(typeName(r.type))}${head ? badge((r.alliance === "red" ? "Red" : "Blue") + " alliance · " + resultName(r), r.alliance) : ""}${badge(r.source === "demo" ? "Sample record" : r.source === "legacy" ? "Imported from v1" : "Recorded by you")}</div><p class="detail-score">${fmt(scoreRecord(r))}${head ? ` <small>– ${fmt(opponentScore(r))}</small>` : ""}</p><p class="dialog-intro">${esc(date(r.createdAt))} · ${esc(r.team)}${r.route ? " · " + esc(r.route) : ""}${r.stopTime != null ? " · " + r.stopTime + " seconds remaining" : ""}</p>${r.official ? `<p class="inline-note warn">The displayed result uses entered official scores. The breakdown below describes the original field calculation.</p>` : ""}${breakdown(parts, head ? "Your alliance field calculation" : "Skills breakdown", "accent")}${head ? `<p class="inline-note section-gap">AWP: ${esc(r.awp || "not recorded")}. Autonomous bonus: ${esc(r.field.auton)}.</p><h3 class="section-gap">Toggle what-if</h3><p class="dialog-intro">Changes only one final toggle, holding the rest of the field constant. This is arithmetic, not a claim these points were yours or achievable.</p>${ops.length ? ops.map((o) => `<div class="metric-line"><span>Set ${esc(o.zone)} to ${esc(r.alliance)}</span><strong>+${o.delta} margin</strong></div>`).join("") : `<p class="muted">No outer-toggle change would improve your margin in this field.</p>`}` : ""}${r.notes ? `<p class="inline-note section-gap" style="white-space:pre-wrap">${esc(r.notes)}</p>` : ""}<div class="dialog-actions">${button("Delete record", "delete-record", `data-id="${esc(r.id)}"`, "danger ghost")}${button("Close", "close")}</div>`,
  );
}
function teamDialog(number) {
  const t = currentEvent()?.teams.find((t) => t.number === number);
  if (!t) return;
  const obs = observations(number),
    stats = observationStats(obs),
    skills = eventSkills(currentEvent(), number);
  showDialog(
    `${number} · ${t.name}`,
    `<p class="dialog-intro">${esc(t.location || "Location unavailable")} · ${esc(currentEvent().name)}</p><div class="grid two"><div>${[
      ["Event Driver Skills", fmt(skills.driver)],
      ["Event Autonomous Skills", fmt(skills.autonomous)],
      [
        "Observed auton completion",
        stats.auton.n ? stats.auton.yes + "/" + stats.auton.n : "Unknown",
      ],
      [
        "Observed midfield finishes",
        stats.midfield.n
          ? stats.midfield.yes + "/" + stats.midfield.n
          : "Unknown",
      ],
    ]
      .map(
        ([l, v]) =>
          `<div class="metric-line"><span>${l}</span><strong>${v}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="inline-note">Scouting observations describe this robot. Official Skills scores come from the saved event snapshot. Neither is a predicted match result.</div></div><div class="actions section-gap">${button("Add observation", "observation-dialog", `data-team="${esc(number)}"`, "primary")}${number !== store.team ? button(picks().some((p) => p.team === number) ? "Remove from picks" : "Add to picks", "pick-toggle", `data-team="${esc(number)}" data-reopen="true"`) : ""}</div><h3 class="section-gap">Observations (${obs.length})</h3>${
      obs.length
        ? [...obs]
            .reverse()
            .map(
              (o) =>
                `<div class="note"><div class="actions">${badge(o.match || "Pit observation")}${badge("Auton: " + o.auton)}${badge("Midfield: " + o.midfield)}${badge("Reliability: " + o.reliability)}${badge("Defense: " + o.defense)}</div><p>${esc(o.notes || "No written notes.")}</p><small>${esc(date(o.createdAt))}</small><button class="delete-inline" data-action="delete-observation" data-id="${esc(o.id)}" data-team="${esc(number)}"> · Delete</button></div>`,
            )
            .join("")
        : `<p class="dialog-intro section-gap">No observations yet. Record what you see before deciding where this team belongs on your list.</p>`
    }`,
  );
}
function observationDialog(team) {
  showDialog(
    "Scout " + team,
    `<form data-form="observation" data-team="${esc(team)}"><p class="dialog-intro">Record this robot’s actions, not its alliance’s result. Leave unobserved items unknown.</p><div class="form-grid"><label>Match / context<input name="match" placeholder="Q12, pit interview, practice" maxlength="100"></label><label>Autonomous task completion<select name="auton">${selectedOptions(
      [
        ["unknown", "Not observed"],
        ["success", "Completed intended task"],
        ["fail", "Did not complete task"],
      ],
      "unknown",
    )}</select></label><label>Finished in midfield<select name="midfield">${selectedOptions(
      [
        ["unknown", "Not observed"],
        ["yes", "Yes"],
        ["no", "No"],
      ],
      "unknown",
    )}</select></label><label>Reliability<select name="reliability">${selectedOptions(
      [
        ["unknown", "Not observed"],
        ["clean", "No issue observed"],
        ["issue", "Breakdown / issue observed"],
      ],
      "unknown",
    )}</select></label><label>Defense observed<select name="defense">${selectedOptions(
      [
        ["unknown", "Not observed"],
        ["strong", "Effective"],
        ["mixed", "Mixed"],
        ["weak", "Ineffective"],
      ],
      "unknown",
    )}</select></label><label class="wide">Notes<textarea name="notes" maxlength="2000" placeholder="Specific actions, limitations, autonomous lanes, or questions for the team."></textarea></label></div><div class="dialog-actions">${button("Cancel", "close", "", "ghost")}<button class="button primary" type="submit">Save observation</button></div><p class="form-error error" role="alert"></p></form>`,
  );
}
function compareDialog() {
  showDialog(
    "Compare two teams",
    `<p class="dialog-intro">Event results and your observations. Different sample sizes are shown explicitly.</p><div class="compare-grid">${selectedCompare
      .map((n) => {
        const t = currentEvent()?.teams.find((t) => t.number === n),
          s = observationStats(observations(n)),
          skill = eventSkills(currentEvent(), n);
        return `<section class="card"><div class="eyebrow">${esc(t?.name || "Team")}</div><h3>${esc(n)}</h3>${[
          [
            "Event Skills",
            fmt(skill.total) + (skill.partial ? " (partial)" : ""),
          ],
          ["Observations", s.n],
          [
            "Auton completion",
            s.auton.n ? `${s.auton.yes} of ${s.auton.n}` : "Unknown",
          ],
          [
            "Midfield finish",
            s.midfield.n ? `${s.midfield.yes} of ${s.midfield.n}` : "Unknown",
          ],
          [
            "No issue observed",
            s.reliability.n
              ? `${s.reliability.yes} of ${s.reliability.n}`
              : "Unknown",
          ],
        ]
          .map(
            ([l, v]) =>
              `<div class="metric-line"><span>${l}</span><strong>${v}</strong></div>`,
          )
          .join(
            "",
          )}<div class="section-gap">${button("Open profile", "team", `data-team="${esc(n)}"`, "small")}</div></section>`;
      })
      .join(
        "",
      )}</div><p class="inline-note section-gap">A small set of observations is not a reliable estimate of future success. Your robot’s needs and autonomous compatibility should guide your order.</p>`,
  );
}
async function eventsDialog() {
  showDialog(
    "Find a competition",
    `<label>Search name or location<input id="event-query" value="${esc(eventQuery)}" placeholder="Event name, city, country or event code"></label><div class="actions section-gap">${button("Create manual event", "manual-event", "", "ghost")}</div><div id="event-results" class="section-gap"><p class="muted">Loading the event index…</p></div>`,
  );
  if (!index && !indexError) {
    try {
      index = await eventIndex();
    } catch (e) {
      indexError = e.message;
    }
  }
  renderEventResults();
}
function renderEventResults() {
  if (!$("#event-results")) return;
  if (!index) {
    $("#event-results").innerHTML = empty(
      "Event index unavailable",
      indexError || "Loading…",
      button("Retry", "retry-index"),
    );
    return;
  }
  const q = eventQuery.toLowerCase().trim();
  let rows = index.events.filter((e) =>
    (e.name + " " + e.location + " " + e.id + " " + (e.code || "")).toLowerCase().includes(q),
  );
  rows.sort(
    (a, b) =>
      Math.abs(new Date(a.date) - Date.now()) -
      Math.abs(new Date(b.date) - Date.now()),
  );
  $("#event-results").innerHTML =
    `<p class="dialog-intro">${rows.length} matches · snapshot ${esc(date(index.updatedAt))}. Showing up to 20 nearest to today.</p>${
      rows
        .slice(0, 20)
        .map(
          (e) =>
            `<div class="event-card"><div><h3>${esc(e.name)}</h3><p>${esc(date(e.date))} · ${esc(e.location)}</p><small>${e.teams ?? "—"} saved teams · event ${esc(e.id)}</small></div>${button("Load", "load-event", `data-id="${esc(e.id)}" ${busy ? "disabled" : ""}`, "small")}</div>`,
        )
        .join("") ||
      empty(
        "No matching events",
        "Try a broader location or create a manual event.",
      )
    }`;
}
function manualEventDialog() {
  showDialog(
    "Create a manual event",
    `<form data-form="manual-event"><div class="form-grid"><label class="wide">Event name<input name="name" maxlength="500" required></label><label>Date<input type="date" name="date" required></label><label>Location<input name="location" maxlength="300"></label><label class="wide">Teams (one per line)<textarea name="teams" placeholder="4330P, RoboPigeons\n123A, Team name" required></textarea></label></div><p class="dialog-intro section-gap">Format: team number, name. All data is labeled manually entered.</p><div class="dialog-actions">${button("Cancel", "close")}<button class="button primary" type="submit">Create event</button></div><p class="form-error error" role="alert"></p></form>`,
  );
}
function addTeamDialog() {
  showDialog(
    "Add a team to this event",
    `<form data-form="add-team"><div class="form-grid"><label>Team number<input name="number" maxlength="8" required pattern="[0-9]{1,6}[A-Za-z]{0,2}"></label><label>Team name<input name="name" maxlength="300" required></label></div><div class="dialog-actions">${button("Cancel", "close")}<button class="button primary" type="submit">Add team</button></div><p class="form-error error" role="alert"></p></form>`,
  );
}
function scheduleDialog() {
  if (!currentEvent()) return eventsDialog();
  showDialog(
    "Add a scheduled match",
    `<form data-form="schedule"><p class="dialog-intro">Enter the posted schedule. No schedule is being fetched automatically.</p><div class="form-grid"><label>Match label<input name="label" placeholder="Q12" maxlength="100" required></label><label>Field<input name="field" placeholder="Field 1" maxlength="100"></label><label>Time<input name="time" type="time"></label><label>Red team 1<input name="red1" pattern="[0-9]{1,6}[A-Za-z]{0,2}" required></label><label>Red team 2<input name="red2" pattern="[0-9]{1,6}[A-Za-z]{0,2}" required></label><label>Blue team 1<input name="blue1" pattern="[0-9]{1,6}[A-Za-z]{0,2}" required></label><label>Blue team 2<input name="blue2" pattern="[0-9]{1,6}[A-Za-z]{0,2}" required></label></div><div class="dialog-actions">${button("Cancel", "close")}<button class="button primary" type="submit">Save match</button></div><p class="form-error error" role="alert"></p></form>`,
  );
}
let teamDirectoryPromise;
async function matchTeamNumber() {
  const input = $("#setup-team");
  if (!input) return;
  const number = input.value.trim().toUpperCase(),
    name = $('input[name="teamName"]');
  name.value = "";
  const hint = $("#team-lookup");
  hint.textContent = "Looking in the saved team directory…";
  try {
    teamDirectoryPromise ||= fetch("./team-index.json")
      .then((r) => {
        if (!r.ok) throw new Error("unavailable");
        return r.json();
      })
      .catch((e) => {
        teamDirectoryPromise = null;
        throw e;
      });
    const directory = await teamDirectoryPromise;
    if (!input.isConnected || input.value.trim().toUpperCase() !== number)
      return;
    const team = directory.teams.find((t) => t.number === number);
    if (team) {
      if (!name.value) name.value = team.name;
      hint.textContent = `Matched ${team.number} · ${[team.city, team.region].filter(Boolean).join(", ")}. Snapshot ${date(directory.updatedAt)}. Confirm before saving.`;
    } else
      hint.textContent =
        "No exact match in this snapshot. Enter your team name manually.";
  } catch {
    if (hint.isConnected)
      hint.textContent =
        "Team directory unavailable. Enter your team name manually.";
  }
}
function settingsDialog() {
  showDialog(
    "Team & data",
    `<form data-form="settings"><p class="dialog-intro">${demo ? "Demo data stays separate from your real workspace." : "This workspace is saved in this browser, not a cloud account. Export regular backups."}</p><div class="form-grid"><label>Team number<input id="setup-team" name="team" value="${esc(store.team)}" maxlength="8" pattern="[0-9]{1,6}[A-Za-z]{0,2}" required></label><label>Team name<input name="teamName" value="${esc(store.teamName)}" maxlength="100"></label></div><p id="team-lookup" class="hint section-gap">Team numbers are matched against the saved VEX snapshot. You can enter a name manually.</p><div class="dialog-actions"><button type="submit" class="button primary">Save team</button></div><p class="form-error error" role="alert"></p></form><hr style="border:0;border-top:1px solid var(--border);margin:22px 0"><h3>Backups and migration</h3><div class="actions section-gap">${button("Export backup", "export")}${button("Restore backup", "import")}${button("Import v1 records", "legacy")}${startupError ? button("Export unreadable data", "export-raw", "", "danger") : ""}</div><input type="file" id="backup-file" accept="application/json,.json" class="hidden"><p class="dialog-intro section-gap">Restore validates the entire file and replaces this workspace after confirmation. V1 import copies valid real records; it skips generated sample records and leaves v1 untouched.</p><div class="inline-note">${navigator.onLine ? "Online" : "Offline"} · ${store.records.length} total records · ${store.observations.length} observations.<br><span id="offline-status">Checking offline shell…</span></div><div class="actions section-gap">${demo ? `<a class="button" href="./">Exit demo</a>` : `<a class="button" href="?dev=1">Open populated demo</a>`}<a class="button ghost" href="../">Original app</a></div>`,
  );
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .getRegistration(new URL("./", location.href))
      .then((r) => {
        const el = $("#offline-status");
        if (el)
          el.textContent = r?.active
            ? "Offline shell installed. Selected event data is saved on this device."
            : "Offline shell not ready. Keep this page open online until installed.";
      });
  else
    $("#offline-status").textContent =
      "This browser does not support offline app caching.";
}
function confirmDialog(heading, message, action, extra = "") {
  showDialog(
    heading,
    `<p class="dialog-intro">${esc(message)}</p><div class="dialog-actions">${button("Cancel", "close")}${button("Confirm", action, extra, "primary")}</div>`,
  );
}
function download(content, name) {
  const blob = new Blob([content], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let pendingBackup = null,
  pendingSchedule = null;
async function action(el) {
  const a = el.dataset.action,
    d = el.dataset;
  if (a === "close") return closeDialog();
  if (a === "settings") return settingsDialog();
  if (a === "zone") {
    zone = d.zone;
    render();
    return;
  }
  if (a === "score-type") {
    scoreType = d.type;
    if (scoreType !== "head") pendingSchedule = null;
    render();
    return;
  }
  if (a === "count")
    return editField(
      (f) =>
        (f.zones[zone][d.color] = Math.min(
          126,
          Math.max(0, f.zones[zone][d.color] + Number(d.delta)),
        )),
    );
  if (a === "alliance") {
    setAlliance(d.value);
    render();
    return;
  }
  if (a === "field-toggle")
    return editField((f) => {
      const order = ["neutral", "red", "blue"];
      f.zones[d.zone].toggle =
        order[(order.indexOf(f.zones[d.zone].toggle) + 1) % order.length];
    });
  if (a === "toggle") return editField((f) => (f.zones[zone].toggle = d.value));
  if (a === "robots")
    return editField((f) => (f.robots[d.color] = Number(d.value)));
  if (a === "skills-robot")
    return editField((f) => (f.skillsRobot = d.value === "true"));
  if (a === "auton") return editField((f) => (f.auton = d.value));
  if (a === "undo") {
    if (undos[scoreType].length) {
      drafts[scoreType] = undos[scoreType].pop();
      stashDraft();
      render();
    }
    return;
  }
  if (a === "reset")
    return confirmDialog(
      "Reset this field?",
      "Saved records will remain. You can undo this reset.",
      "reset-confirm",
    );
  if (a === "reset-confirm") {
    editField((f) => Object.assign(f, blankField()));
    closeDialog();
    return;
  }
  if (a === "save-dialog") return saveDialog(pendingSchedule);
  if (a === "record") return recordDialog(d.id);
  if (a === "analysis-type") {
    analysisType = d.type;
    render();
    return;
  }
  if (a === "analysis-days") {
    analysisDays = d.value;
    render();
    return;
  }
  if (a === "refresh-event") return refreshCompetition(true);
  if (a === "events-dialog") return eventsDialog();
  if (a === "retry-index") {
    indexError = "";
    return eventsDialog();
  }
  if (a === "manual-event") return manualEventDialog();
  if (a === "add-team") return addTeamDialog();
  if (a === "load-event") {
    if (busy) return;
    busy = true;
    el.disabled = true;
    el.textContent = "Loading…";
    try {
      let event;
      liveError = "";
      try { event = await loadEvent(d.id); }
      catch {
        const row = index?.events.find(e=>e.id===d.id);
        event = await refreshOfficial({id:d.id, name:row?.name || "Competition", date:row?.date || "", location:row?.location || "", teams:[], skills:[], loadedAt:new Date().toISOString(), source:"synced"});
      }
      mutate((w) => {
        w.events = w.events.filter((e) => e.id !== event.id);
        w.events.push(event);
        w.activeEvent = event.id;
      });
      selectedCompare = [];
      closeDialog();
      navigate("event");
      toast("Event saved on this device.");
      void refreshCompetition();
    } finally {
      busy = false;
      if (el.isConnected) {
        el.disabled = false;
        el.textContent = "Load";
      }
    }
    return;
  }
  if (a === "event-tab") {
    eventTab = d.tab;
    render();
    return;
  }
  if (a === "go-scout") return navigate("scout");
  if (a === "team") return teamDialog(d.team);
  if (a === "observation-dialog") return observationDialog(d.team);
  if (a === "compare") return compareDialog();
  if (a === "pick-toggle") {
    mutate((w) => {
      const list = w.picks[w.activeEvent] || [];
      w.picks[w.activeEvent] = list.some((p) => p.team === d.team)
        ? list.filter((p) => p.team !== d.team)
        : [...list, { team: d.team, status: "available" }];
    });
    render();
    if (d.reopen) teamDialog(d.team);
    toast("Picklist updated.");
    return;
  }
  if (a === "pick-move") {
    mutate((w) => {
      const list = w.picks[w.activeEvent],
        i = list.findIndex((p) => p.team === d.team),
        j = i + Number(d.delta);
      if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    });
    render();
    return;
  }
  if (a === "schedule-dialog") return scheduleDialog();
  if (a === "schedule-done") {
    mutate((w) => {
      const s = w.schedules.find((s) => s.id === d.id);
      s.done = !s.done;
    });
    render();
    return;
  }
  if (a === "schedule-remove")
    return confirmDialog(
      "Remove scheduled match?",
      "This removes this manually entered schedule item.",
      "schedule-remove-confirm",
      `data-id="${esc(d.id)}"`,
    );
  if (a === "schedule-remove-confirm") {
    mutate((w) => (w.schedules = w.schedules.filter((s) => s.id !== d.id)));
    closeDialog();
    render();
    return;
  }
  if (a === "score-schedule") {
    const scheduled = store.schedules.find((s) => s.id === d.id);
    if (![...scheduled.red, ...scheduled.blue].includes(store.team)) {
      toast(
        "This match does not include your team. Record other teams in Scouting.",
      );
      return;
    }
    pendingSchedule = scheduled;
    scoreType = "head";
    setAlliance(pendingSchedule.blue.includes(store.team) ? "blue" : "red");
    navigate("score");
    toast(
      "Scoring " +
        pendingSchedule.label +
        ". Its event will be selected when you save.",
    );
    return;
  }
  if (a === "delete-record")
    return confirmDialog(
      "Delete this record?",
      "This cannot be undone in the app. Export a backup first if you need to retain it.",
      "delete-record-confirm",
      `data-id="${esc(d.id)}"`,
    );
  if (a === "delete-record-confirm") {
    mutate((w) => (w.records = w.records.filter((r) => r.id !== d.id)));
    closeDialog();
    render();
    toast("Record deleted.");
    return;
  }
  if (a === "delete-observation")
    return confirmDialog(
      "Delete this observation?",
      "This removes the selected note and its recorded observations.",
      "delete-observation-confirm",
      `data-id="${esc(d.id)}" data-team="${esc(d.team)}"`,
    );
  if (a === "delete-observation-confirm") {
    mutate(
      (w) => (w.observations = w.observations.filter((o) => o.id !== d.id)),
    );
    render();
    teamDialog(d.team);
    return;
  }
  if (a === "print") {
    window.print();
    return;
  }
  if (a === "export") {
    download(
      JSON.stringify(store, null, 2),
      `vexoverride-${demo ? "demo-" : ""}${store.team}-${new Date().toISOString().slice(0, 10)}.json`,
    );
    toast("Backup exported.");
    return;
  }
  if (a === "export-raw") {
    download(
      localStorage.getItem(demo ? DEMO_KEY : REAL_KEY) || "",
      "vexoverride-recovery.json",
    );
    return;
  }
  if (a === "import") return $("#backup-file").click();
  if (a === "restore-confirm") {
    const prev = startupError;
    startupError = "";
    try {
      commit(pendingBackup);
    } catch (e) {
      startupError = prev;
      throw e;
    }
    pendingBackup = null;
    selectedCompare = [];
    closeDialog();
    render();
    toast("Backup restored.");
    return;
  }
  if (a === "legacy") {
    const result = legacyRecords(
      localStorage.getItem("vexOverrideMatches:v1"),
      store.team,
    );
    let added = 0;
    mutate((w) => {
      for (const r of result.records)
        if (!w.records.some((e) => e.id === r.id)) {
          w.records.push(r);
          added++;
        }
    });
    render();
    settingsDialog();
    toast(
      `${added} records imported; ${result.skipped} sample or invalid records skipped. V1 was not changed.`,
    );
    return;
  }
}
document.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("svg [data-action]")
  ) {
    e.preventDefault();
    action(e.target).catch((err) => toast(err.message));
  }
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  e.preventDefault();
  action(el).catch((err) => toast(err.message));
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  try {
    if (el.dataset.count) {
      const n = Number(el.value);
      if (el.value === "" || !Number.isInteger(n) || n < 0 || n > 126) {
        el.value = drafts[scoreType].zones[zone][el.dataset.count];
        toast("Enter a whole number from 0 to 126.");
      }
    }
    if (el.id === "analysis-event") {
      analysisEvent = el.value;
      render();
    }
    if (el.id === "event-select") {
      mutate((w) => (w.activeEvent = el.value));
      liveError = "";
      void refreshCompetition();
      selectedCompare = [];
      render();
    }
    if (el.id === "scout-sort") {
      scoutSort = el.value;
      render();
    }
    if (el.dataset.compare) {
      if (el.checked) {
        if (selectedCompare.length >= 2) {
          el.checked = false;
          toast("Select two teams at a time.");
          return;
        }
        selectedCompare.push(el.dataset.compare);
      } else
        selectedCompare = selectedCompare.filter(
          (n) => n !== el.dataset.compare,
        );
      render();
    }
    if (el.dataset.pickStatus) {
      mutate(
        (w) =>
          (w.picks[w.activeEvent].find(
            (p) => p.team === el.dataset.pickStatus,
          ).status = el.value),
      );
      render();
    }
    if (el.id === "backup-file" && el.files[0]) {
      if (el.files[0].size > 12_000_000)
        throw new Error("Backup is too large (12 MB maximum).");
      pendingBackup = validateWorkspace(JSON.parse(await el.files[0].text()));
      confirmDialog(
        "Replace this workspace?",
        `Restore ${pendingBackup.records.length} records and ${pendingBackup.observations.length} observations for ${pendingBackup.team}? This replaces the ${demo ? "demo" : "real"} v2 workspace only. Export the current workspace first if needed.`,
        "restore-confirm",
      );
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "setup-team") matchTeamNumber();
  if (el.dataset.count) {
    const n = Number(el.value),
      f = drafts[scoreType],
      color = el.dataset.count;
    if (
      el.value !== "" &&
      Number.isInteger(n) &&
      n >= 0 &&
      n <= 126 &&
      f.zones[zone][color] !== n
    ) {
      undos[scoreType].push(structuredClone(f));
      if (undos[scoreType].length > 60) undos[scoreType].shift();
      f.zones[zone][color] = n;
      stashDraft();
      const head = scoreType === "head",
        r = headScore(f, "red"),
        b = headScore(f, "blue"),
        s = skillsScore(f);
      if (head) {
        $(".score-total strong.red-text").textContent = r.total;
        $(".score-total strong.blue-text").textContent = b.total;
      } else $(".score-total strong").textContent = s.total;
      $(`.zone-button.${zone} strong`).innerHTML = COLORS.map(
        (c) => `<b class="${c}-text">${f.zones[zone][c]}</b>`,
      ).join(" / ");
      $("#score-breakdown").innerHTML = head
        ? breakdown(r, "Red alliance", "red") +
          breakdown(b, "Blue alliance", "blue")
        : breakdown(s, typeName(scoreType), "accent");
      $('[data-action="undo"]').disabled = false;
      $(
        `[data-action="count"][data-color="${color}"][data-delta="-1"]`,
      ).disabled = n === 0;
      $(
        `[data-action="count"][data-color="${color}"][data-delta="1"]`,
      ).disabled = n === 126;
    }
  }

  if (e.target.id === "event-query") {
    eventQuery = e.target.value;
    renderEventResults();
  }
  if (e.target.id === "scout-query") {
    const pos = e.target.selectionStart;
    scoutQuery = e.target.value;
    render();
    $("#scout-query").focus();
    $("#scout-query").setSelectionRange(pos, pos);
  }
});
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!form.dataset.form) return;
  e.preventDefault();
  try {
    const f = new FormData(form),
      get = (n) => String(f.get(n) || "").trim();
    if (form.dataset.form === "save") {
      const red = get("officialRed"),
        blue = get("officialBlue");
      if ((red === "") !== (blue === ""))
        throw new Error(
          "Enter both official alliance scores, or leave both blank.",
        );
      const r = {
        id: uid(),
        createdAt: new Date().toISOString(),
        team: store.team,
        type: scoreType,
        alliance: get("alliance") || alliance,
        field: structuredClone(drafts[scoreType]),
        eventId: get("event"),
        label: get("label"),
        notes: get("notes"),
        route: get("route"),
        awp: get("awp") || "unknown",
        stopTime: get("stopTime") === "" ? null : Number(get("stopTime")),
        source: demo ? "demo" : "manual",
        official: red !== "" ? { red: Number(red), blue: Number(blue) } : null,
      };
      mutate((w) => {
        w.records.push(r);
        if (pendingSchedule) {
          const scheduled = w.schedules.find(
            (s) => s.id === pendingSchedule.id,
          );
          if (scheduled) scheduled.done = true;
        }
      });
      if (scoreType === "head") setAlliance(r.alliance);
      pendingSchedule = null;
      closeDialog();
      render();
      toast("Record saved. Field kept for review; reset for your next run.");
    }
    if (form.dataset.form === "observation") {
      if (
        !get("notes") &&
        ["auton", "midfield", "reliability", "defense"].every(
          (k) => get(k) === "unknown",
        )
      )
        throw new Error("Record at least one observation or note.");
      mutate((w) =>
        w.observations.push({
          id: uid(),
          createdAt: new Date().toISOString(),
          eventId: w.activeEvent,
          team: form.dataset.team,
          match: get("match"),
          auton: get("auton"),
          midfield: get("midfield"),
          reliability: get("reliability"),
          defense: get("defense"),
          notes: get("notes"),
          source: demo ? "demo" : "manual",
        }),
      );
      render();
      teamDialog(form.dataset.team);
      toast("Observation saved.");
    }
    if (form.dataset.form === "settings") {
      mutate((w) => {
        w.team = get("team").toUpperCase();
        w.teamName = get("teamName");
      });
      closeDialog();
      render();
      toast("Team updated. History is filtered to this team.");
    }
    if (form.dataset.form === "manual-event") {
      const teams = get("teams")
        .split("\n")
        .filter((l) => l.trim())
        .map((line) => {
          const [number, ...rest] = line.split(",");
          return {
            number: number.trim().toUpperCase(),
            name: rest.join(",").trim() || number.trim(),
            location: "",
          };
        });
      if (new Set(teams.map((t) => t.number)).size !== teams.length)
        throw new Error("Each team number should appear once.");
      const event = {
        id: "manual-" + uid(),
        name: get("name"),
        date: get("date") + "T12:00:00",
        location: get("location"),
        teams,
        skills: [],
        source: "manual",
        loadedAt: new Date().toISOString(),
      };
      mutate((w) => {
        w.events.push(event);
        w.activeEvent = event.id;
      });
      closeDialog();
      selectedCompare = [];
      navigate("event");
      toast("Manual event created.");
    }
    if (form.dataset.form === "add-team") {
      const number = get("number").toUpperCase();
      if (currentEvent().teams.some((t) => t.number === number))
        throw new Error("That team is already in this event.");
      mutate((w) =>
        w.events
          .find((e) => e.id === w.activeEvent)
          .teams.push({
            number,
            name: get("name"),
            location: "Manually added",
          }),
      );
      closeDialog();
      render();
      toast("Team added.");
    }
    if (form.dataset.form === "schedule") {
      const red = [get("red1"), get("red2")].map((n) => n.toUpperCase()),
        blue = [get("blue1"), get("blue2")].map((n) => n.toUpperCase());
      if (new Set([...red, ...blue]).size !== 4)
        throw new Error("A head-to-head match needs four distinct teams.");
      mutate((w) =>
        w.schedules.push({
          id: uid(),
          eventId: w.activeEvent,
          label: get("label"),
          field: get("field"),
          time: get("time"),
          red,
          blue,
        }),
      );
      closeDialog();
      render();
      toast("Scheduled match saved.");
    }
  } catch (err) {
    const error = form.querySelector(".form-error");
    if (error) error.textContent = err.message;
    else toast(err.message);
  }
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
});
window.addEventListener("storage", (event) => {
  if (event.key !== (demo ? DEMO_KEY : REAL_KEY)) return;
  if ($("#dialog").open) {
    toast(
      "Another tab changed this workspace. Finish copying your notes, then reload before saving.",
    );
    return;
  }
  try {
    store = readWorkspace(localStorage, demo, makeDemo);
    storedRaw = event.newValue;
    selectedCompare = [];
    render();
    toast("Workspace updated from another tab.");
  } catch {
    toast(
      "Another tab wrote unreadable data. Export a backup before reloading.",
    );
  }
});
window.addEventListener("online", () => { refresh(); void refreshCompetition(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) void refreshCompetition(); });
window.addEventListener("hashchange", () => { void refreshCompetition(); });
setInterval(() => { void refreshCompetition(); }, 30000);
window.addEventListener("offline", refresh);
render();
if (!store.team && !startupError) settingsDialog();
if (!startupError) {
  try {
    storedRaw = persistWorkspace(localStorage, demo, store, storedRaw);
  } catch (e) {
    toast("Storage is unavailable. Export before leaving this page.");
  }
}
void refreshCompetition();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
