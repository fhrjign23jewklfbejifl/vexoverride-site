import { blankField, validateField } from "./scoring.js";
export const REAL_KEY = "vexOverrideWorkspace:v2";
export const DEMO_KEY = "vexOverrideDemo:v2";
export function emptyWorkspace() {
  return {
    version: 2,
    team: "",
    teamName: "",
    records: [],
    observations: [],
    events: [],
    activeEvent: "",
    picks: {},
    schedules: [],
  };
}
const text = (v, limit = 2000) => typeof v === "string" && v.length <= limit;
const validTeam = (v) =>
  typeof v === "string" && /^[0-9]{1,6}[A-Z]{0,2}$/.test(v);
const validId = (v) =>
  text(v, 150) &&
  v.length > 0 &&
  !["__proto__", "constructor", "prototype"].includes(v);
const validDate = (v) => text(v, 100) && Number.isFinite(Date.parse(v));
const source = (v) => ["manual", "synced", "demo", "legacy"].includes(v);
export function validateWorkspace(w) {
  if (
    !w ||
    w.version !== 2 ||
    !(w.team === "" || validTeam(w.team)) ||
    !text(w.teamName, 100)
  )
    throw new Error("This is not a valid VexOverride v2 backup.");
  for (const key of ["records", "observations", "events", "schedules"])
    if (
      !Array.isArray(w[key]) ||
      w[key].length > 10000 ||
      w[key].some((v) => !v || !validId(v.id)) ||
      new Set(w[key].map((v) => v.id)).size !== w[key].length
    )
      throw new Error("Invalid or oversized backup.");
  if (
    typeof w.picks !== "object" ||
    !w.picks ||
    Array.isArray(w.picks) ||
    !text(w.activeEvent, 100)
  )
    throw new Error("Invalid event selection.");
  const ids = new Set();
  for (const r of w.records) {
    if (
      !text(r.id, 150) ||
      ids.has(r.id) ||
      !["head", "driver", "autonomous"].includes(r.type) ||
      !validDate(r.createdAt) ||
      !text(r.notes) ||
      !text(r.eventId, 100) ||
      !text(r.label, 100) ||
      !["red", "blue"].includes(r.alliance) ||
      !validTeam(r.team)
    )
      throw new Error("A saved record is invalid or duplicated.");
    ids.add(r.id);
    validateField(r.field);
    if (
      !source(r.source) ||
      (r.route != null && !text(r.route, 100)) ||
      (r.awp != null && !["unknown", "yes", "no"].includes(r.awp))
    )
      throw new Error("Invalid record metadata.");
    if (
      r.stopTime != null &&
      (!Number.isInteger(r.stopTime) || r.stopTime < 0 || r.stopTime > 60)
    )
      throw new Error("Skills stop time must be between 0 and 60.");
    if (
      r.official &&
      (r.type !== "head" ||
        !["red", "blue"].every(
          (c) =>
            Number.isInteger(r.official[c]) &&
            r.official[c] >= 0 &&
            r.official[c] <= 9999,
        ))
    )
      throw new Error("Invalid official scores.");
  }
  for (const e of w.events) {
    for (const key of ['matches', 'rankings']) {
      if (e[key] != null && (!Array.isArray(e[key]) || e[key].length > 25000))
        throw new Error('Invalid official event data.');
    }
    for (const match of e.matches || []) {
      if (!match || !Number.isInteger(match.id) || !Array.isArray(match.alliances) ||
          match.alliances.length > 2 || (match.scored != null && typeof match.scored !== 'boolean'))
        throw new Error('Invalid official match.');
      for (const a of match.alliances) {
        if (!['red','blue'].includes(a.color) || !Array.isArray(a.teams) || a.teams.length > 3 ||
            (a.score != null && (!Number.isFinite(a.score) || a.score < 0)) ||
            a.teams.some(t => !validTeam(t?.team?.name))) throw new Error('Invalid match alliance.');
      }
    }
    for (const ranking of e.rankings || [])
      if (!ranking || !Number.isInteger(ranking.id) || !validTeam(ranking.team?.name))
        throw new Error('Invalid official ranking.');
    if (
      !text(e.id, 100) ||
      !text(e.name, 500) ||
      !text(e.date, 100) ||
      !text(e.location, 300) ||
      !validDate(e.loadedAt) ||
      !source(e.source) ||
      !Array.isArray(e.teams) ||
      e.teams.length > 5000 ||
      new Set(e.teams.map((t) => t?.number)).size !== e.teams.length ||
      !Array.isArray(e.skills) ||
      e.skills.length > 50000
    )
      throw new Error("An event is invalid.");
    for (const t of e.teams)
      if (
        !t ||
        !validTeam(t.number) ||
        !text(t.name, 300) ||
        !text(t.location, 300)
      )
        throw new Error("A team is invalid.");
    for (const row of e.skills)
      if (
        !row ||
        typeof row !== "object" ||
        !text(row.type, 100) ||
        !Number.isFinite(row.score) ||
        row.score < 0 ||
        !row.team ||
        typeof row.team !== "object"
      )
        throw new Error("Invalid event Skills result.");
  }
  if (w.activeEvent && !w.events.some((e) => e.id === w.activeEvent))
    throw new Error("Selected event is missing.");
  for (const o of w.observations)
    if (
      !text(o.id, 150) ||
      !validDate(o.createdAt) ||
      !source(o.source) ||
      !validTeam(o.team) ||
      !text(o.eventId, 100) ||
      !text(o.notes) ||
      !text(o.match, 100) ||
      !["unknown", "success", "fail"].includes(o.auton) ||
      !["unknown", "yes", "no"].includes(o.midfield) ||
      !["unknown", "clean", "issue"].includes(o.reliability) ||
      !["unknown", "strong", "mixed", "weak"].includes(o.defense)
    )
      throw new Error("A scouting observation is invalid.");
  for (const [key, picks] of Object.entries(w.picks)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(key) ||
      !Array.isArray(picks) ||
      picks.length > 5000 ||
      new Set(picks.map((p) => p.team)).size !== picks.length
    )
      throw new Error("Invalid picklist.");
    for (const p of picks)
      if (
        !validTeam(p.team) ||
        !["available", "selected", "declined"].includes(p.status)
      )
        throw new Error("Invalid picklist entry.");
  }
  for (const s of w.schedules)
    if (
      !text(s.id, 150) ||
      !text(s.eventId, 100) ||
      !text(s.label, 100) ||
      !text(s.field, 100) ||
      !text(s.time, 100) ||
      (s.done != null && typeof s.done !== "boolean") ||
      !Array.isArray(s.red) ||
      !Array.isArray(s.blue) ||
      s.red.length !== 2 ||
      s.blue.length !== 2 ||
      ![...s.red, ...s.blue].every(validTeam) ||
      new Set([...s.red, ...s.blue]).size !== 4
    )
      throw new Error("A scheduled match is invalid.");
  return w;
}
export function readWorkspace(storage, demo, makeDemo) {
  const raw = storage.getItem(demo ? DEMO_KEY : REAL_KEY);
  if (raw) return validateWorkspace(JSON.parse(raw));
  return demo ? makeDemo() : emptyWorkspace();
}
export function persistWorkspace(
  storage,
  demo,
  workspace,
  expectedRaw = undefined,
) {
  validateWorkspace(workspace);
  const key = demo ? DEMO_KEY : REAL_KEY;
  if (expectedRaw !== undefined && storage.getItem(key) !== expectedRaw)
    throw new Error(
      "This workspace changed in another tab. Reload before saving; your current form has been kept.",
    );
  const raw = JSON.stringify(workspace);
  storage.setItem(key, raw);
  return raw;
}
export function legacyRecords(raw, defaultTeam) {
  const rows = JSON.parse(raw || "[]");
  if (!Array.isArray(rows)) throw new Error("Legacy history is not a list.");
  const records = [];
  let skipped = 0;
  for (const row of rows) {
    if (
      !row ||
      !validId(row.id) ||
      /^(dev-|judge-sample-)/.test(row.id || "")
    ) {
      skipped++;
      continue;
    }
    try {
      const f = blankField();
      const src = row.mode === "skills" ? row.skills : row.scorer;
      if (!src) throw new Error("Missing field");
      for (const z of Object.keys(f.zones)) {
        if (!src.quadrants?.[z]) throw new Error("Missing zone");
        f.zones[z] = {
          ...f.zones[z],
          ...src.quadrants[z],
          toggle:
            row.mode === "skills"
              ? src.toggles?.[z] || "neutral"
              : src.quadrants[z].toggle || "neutral",
        };
      }
      f.auton = src.auton || "none";
      f.skillsRobot = Boolean(src.centerToggle);
      f.robots = {
        red:
          Number(Boolean(src.robots?.["red-1"])) +
          Number(Boolean(src.robots?.["red-2"])),
        blue:
          Number(Boolean(src.robots?.["blue-1"])) +
          Number(Boolean(src.robots?.["blue-2"])),
      };
      const r = {
        id: "legacy-" + row.id,
        createdAt: row.savedAt,
        team: (row.teamNumber || defaultTeam).toUpperCase(),
        type: row.mode === "skills" ? row.skillsType : "head",
        alliance: row.teamAlliance === "blue" ? "blue" : "red",
        field: f,
        eventId: "",
        label: "Imported practice",
        notes: String(
          row.notes ||
            Object.entries(row.details || {})
              .filter(([, v]) => v)
              .map(([k, v]) => k + ": " + v)
              .join("\n"),
        ),
        source: "legacy",
        stopTime: null,
      };
      validateWorkspace({ ...emptyWorkspace(), records: [r] });
      records.push(r);
    } catch {
      skipped++;
    }
  }
  return { records, skipped };
}
