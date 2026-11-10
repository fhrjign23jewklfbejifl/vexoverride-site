import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  blankField,
  headScore,
  skillsScore,
  scoreRecord,
  opponentScore,
  summary,
  opportunities,
  validateField,
} from "../v2/modules/scoring.js";
import {
  emptyWorkspace,
  readWorkspace,
  persistWorkspace,
  validateWorkspace,
  legacyRecords,
  REAL_KEY,
  DEMO_KEY,
} from "../v2/modules/store.js";
import { makeDemo } from "../v2/modules/demo.js";
import {
  eventSkills,
  observationStats,
  loadEvent,
  eventIndex,
} from "../v2/modules/data.js";

// Expected values below are worked examples from Override manual v2.1 SC1/SC5/SC6/RSC3.
test("Head-to-head counts colored halves independently of toggles", () => {
  const f = blankField();
  f.zones.top = { red: 2, blue: 3, yellow: 4, toggle: "red" };
  f.zones.left = { red: 1, blue: 0, yellow: 2, toggle: "blue" };
  f.zones.center = { red: 1, blue: 1, yellow: 3, toggle: "blue" };
  f.robots = { red: 2, blue: 1 };
  f.auton = "red";
  assert.deepEqual(headScore(f, "red"), {
    pins: 20,
    yellow: 70,
    midfield: 16,
    auton: 12,
    total: 118,
  });
  assert.deepEqual(headScore(f, "blue"), {
    pins: 20,
    yellow: 20,
    midfield: 8,
    auton: 0,
    total: 48,
  });
});
test("Tied midfield has no yellow owner, but each robot still scores", () => {
  const f = blankField();
  f.zones.center.yellow = 4;
  f.robots = { red: 1, blue: 1 };
  f.auton = "tie";
  assert.equal(headScore(f, "red").total, 14);
  assert.equal(headScore(f, "blue").total, 14);
  f.robots.red = 2;
  assert.equal(headScore(f, "red").total, 62);
  f.robots.red = 0;
  assert.equal(headScore(f, "blue").total, 54);
});
test("Skills excludes wrong-color halves and wrong-color toggles", () => {
  const f = blankField();
  f.zones.top = { red: 3, blue: 2, yellow: 4, toggle: "red" };
  f.zones.right = { red: 1, blue: 1, yellow: 2, toggle: "blue" };
  f.zones.bottom = { red: 2, blue: 3, yellow: 1, toggle: "red" };
  f.zones.left = { red: 1, blue: 1, yellow: 2, toggle: "neutral" };
  f.zones.center = { red: 1, blue: 1, yellow: 3, toggle: "neutral" };
  f.skillsRobot = true;
  f.auton = "red";
  f.robots.red = 2;
  assert.deepEqual(skillsScore(f), {
    pins: 40,
    yellow: 60,
    midfield: 8,
    auton: 0,
    total: 108,
  });
  f.skillsRobot = false;
  assert.equal(skillsScore(f).total, 70);
});
test("Toggle what-if reports margin changes, not individual missed points", () => {
  const f = blankField();
  f.zones.top.yellow = 3;
  f.zones.top.toggle = "blue";
  f.zones.right.yellow = 2;
  const before = JSON.stringify(f);
  assert.deepEqual(opportunities(f, "red"), [
    { zone: "top", delta: 60, halves: 3 },
    { zone: "right", delta: 20, halves: 2 },
  ]);
  assert.equal(JSON.stringify(f), before);
});
test("Invalid field counts and states cannot enter saved data", () => {
  for (const value of [-1, 1.5, NaN, Infinity, 127, "3"]) {
    const f = blankField();
    f.zones.top.red = value;
    assert.throws(() => validateField(f));
  }
  const f = blankField();
  f.robots.blue = 3;
  assert.throws(() => headScore(f, "blue"));
});
test("Explicit posted scores override outcomes without destroying field calculation", () => {
  const r = {
    type: "head",
    alliance: "blue",
    field: blankField(),
    official: { red: 42, blue: 0 },
  };
  assert.equal(scoreRecord(r), 0);
  assert.equal(opponentScore(r), 42);
  assert.equal(headScore(r.field, "red").total, 0);
});
test("Empty, single and even-sample summaries preserve zero and median", () => {
  assert.equal(summary([]).median, null);
  const rows = [0, 5, 20, 75].map((score) => ({
    type: "head",
    alliance: "red",
    field: blankField(),
    official: { red: score, blue: 0 },
  }));
  assert.deepEqual(summary(rows), {
    n: 4,
    mean: 25,
    median: 12.5,
    best: 75,
    low: 0,
  });
  assert.equal(summary(rows.slice(0, 1)).median, 0);
});
const memory = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
};
test("A stale tab cannot overwrite newer saved work", () => {
  const storage = memory(),
    initial = emptyWorkspace();
  const original = persistWorkspace(storage, false, initial);
  const newer = { ...initial, team: "123A" };
  const latest = persistWorkspace(storage, false, newer, original);
  assert.throws(() =>
    persistWorkspace(storage, false, { ...initial, team: "456B" }, original),
  );
  assert.equal(storage.getItem(REAL_KEY), latest);
});
test("Demo automatically populates and never changes real or legacy records", () => {
  const storage = memory(),
    real = emptyWorkspace();
  real.team = "123A";
  real.teamName = "Actual team";
  persistWorkspace(storage, false, real);
  storage.setItem("vexOverrideMatches:v1", "legacy bytes");
  const sample = readWorkspace(storage, true, makeDemo);
  assert.equal(sample.records.length, 42);
  persistWorkspace(storage, true, sample);
  assert.equal(readWorkspace(storage, false, makeDemo).team, "123A");
  assert.equal(storage.getItem("vexOverrideMatches:v1"), "legacy bytes");
  assert.notEqual(storage.getItem(REAL_KEY), storage.getItem(DEMO_KEY));
  validateWorkspace(JSON.parse(storage.getItem(DEMO_KEY)));
});
test("Corrupted or malicious restores are rejected before replacing current storage", () => {
  const storage = memory();
  persistWorkspace(storage, false, emptyWorkspace());
  const before = storage.getItem(REAL_KEY);
  for (const change of [
    (w) => (w.events[0].skills = {}),
    (w) => (w.records[0].route = {}),
    (w) => (w.activeEvent = "absent"),
    (w) => w.events.push(w.events[0]),
    (w) => (w.schedules[0].blue = w.schedules[0].red),
    (w) => (w.picks = JSON.parse('{"__proto__":[]}')),
    (w) => (w.events[0].id = "__proto__"),
  ]) {
    const w = makeDemo();
    change(w);
    assert.throws(() => persistWorkspace(storage, false, w));
    assert.equal(storage.getItem(REAL_KEY), before);
  }
  storage.setItem(REAL_KEY, "{broken");
  assert.throws(() => readWorkspace(storage, false, makeDemo));
  assert.equal(storage.getItem(REAL_KEY), "{broken");
});
test("Fresh workspace does not assign another team identity", () =>
  assert.equal(emptyWorkspace().team, ""));
test("Legacy import preserves both modes and skips generated/invalid records", () => {
  const f = blankField();
  f.zones.bottom.red = 2;
  f.zones.center.yellow = 3;
  const rows = [
    {
      id: "real-match",
      teamNumber: "123a",
      savedAt: "2026-11-01T12:00:00Z",
      teamAlliance: "blue",
      scorer: { auton: "tie", robots: { "blue-1": true }, quadrants: f.zones },
      details: { partnerTeam: "456B" },
    },
    {
      id: "real-skills",
      mode: "skills",
      skillsType: "autonomous",
      teamNumber: "123A",
      savedAt: "2026-11-01T12:00:00Z",
      skills: { quadrants: f.zones, toggles: {}, centerToggle: true },
      notes: "Route test",
    },
    { id: "dev-1" },
    { id: "judge-sample-1" },
    null,
  ];
  const raw = JSON.stringify(rows),
    result = legacyRecords(raw, "123A");
  assert.equal(result.records.length, 2);
  assert.equal(result.skipped, 3);
  assert.equal(scoreRecord(result.records[0]), 44);
  assert.equal(scoreRecord(result.records[1]), 48);
  assert.equal(result.records[0].team, "123A");
  assert.equal(result.records[0].notes, "partnerTeam: 456B");
  assert.equal(JSON.stringify(rows), raw);
});
test("Missing Skills scores remain unknown; zero and partial results are distinct", () => {
  const e = { teams: [{ number: "123A", id: 9 }], skills: [] };
  assert.equal(eventSkills(e, "123A").total, null);
  e.skills.push({ team: { id: 9 }, type: "driver", score: 0 });
  assert.deepEqual(eventSkills(e, "123A"), {
    driver: 0,
    autonomous: null,
    partial: true,
    total: 0,
  });
  e.skills.push(
    { team: { number: "123A" }, type: "programming", score: 32 },
    { team: { id: 9 }, type: "driver", score: 10 },
  );
  assert.deepEqual(eventSkills(e, "123A"), {
    driver: 10,
    autonomous: 32,
    partial: false,
    total: 42,
  });
  assert.equal(eventSkills(e, "999Z").total, null);
});
test("Unobserved autonomous attempts are excluded from success denominator", () => {
  const s = observationStats([
    { auton: "success" },
    { auton: "fail" },
    { auton: "unknown" },
    {},
  ]);
  assert.deepEqual(s.auton, { yes: 1, n: 2 });
  assert.deepEqual(s.midfield, { yes: 0, n: 0 });
  assert.equal(s.n, 4);
});
test("Real repository snapshots load with the same adapter used by the browser", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    try {
      return {
        ok: true,
        json: async () => JSON.parse(await readFile(url, "utf8")),
      };
    } catch {
      return { ok: false };
    }
  };
  try {
    const index = await eventIndex();
    assert.ok(index.events.length > 400);
    const e = await loadEvent("65030");
    assert.ok(e.teams.some(t => t.number === "4330P"));
    assert.ok(e.skills.some(row => Number.isFinite(row.score)));
    assert.ok(e.matches.length > 0);
    assert.ok(e.rankings.some(row => row.team?.name === "4330P"));
    validateWorkspace({ ...emptyWorkspace(), events: [e], activeEvent: e.id });
    await assert.rejects(loadEvent("../index"));
  } finally {
    globalThis.fetch = original;
  }
});
test("All stored event snapshots meet the import contract", async () => {
  const dir = new URL("../data/events/", import.meta.url),
    dirs = await readdir(dir, { withFileTypes: true });
  for (const entry of dirs.filter((d) => d.isDirectory())) {
    const [event, teams, skills] = await Promise.all(
      ["event", "teams", "skills"].map((name) =>
        readFile(new URL(entry.name + "/" + name + ".json", dir), "utf8").then(
          JSON.parse,
        ),
      ),
    );
    const e = event.data || event;
    const snapshot = {
      id: entry.name,
      name: e.name,
      date: e.start || "",
      location: "",
      loadedAt: new Date().toISOString(),
      source: "synced",
      teams: teams.data.map((t) => ({
        number: t.number,
        name: t.team_name || "",
        location: "",
      })),
      skills: skills.data,
    };
    validateWorkspace({
      ...emptyWorkspace(),
      events: [snapshot],
      activeEvent: snapshot.id,
    });
  }
});

const { analyze, practicePriorities, quantile } = await import(
  "../v2/modules/analysis.js"
);
test("Analysis respects the saved alliance and official score overrides", () => {
  const field = blankField();
  field.zones.top.red = 10;
  field.zones.top.blue = 1;
  field.auton = "red";
  const row = {
    id: "a",
    type: "head",
    alliance: "blue",
    field,
    createdAt: "2026-10-01",
    official: { red: 30, blue: 40 },
  };
  const a = analyze([row]);
  assert.equal(a.margins[0].value, 10);
  assert.equal(a.median, 40);
  assert.equal(a.composition.pins, 5);
  assert.equal(a.composition.auton, 0);
  assert.equal(a.auton.lost, 1);
  assert.equal(a.officialCount, 1);
});
test("Distributions count every attempt, including zero, and recent comparisons use chronological windows", () => {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const field = blankField();
    field.zones.top.blue = i;
    return {
      id: String(i),
      type: "driver",
      field,
      createdAt: new Date(2026, 0, i + 1).toISOString(),
    };
  });
  const a = analyze([...rows].reverse());
  assert.equal(
    a.bins.reduce((n, b) => n + b.n, 0),
    12,
  );
  assert.equal(a.low, 0);
  assert.equal(a.high, 55);
  assert.deepEqual(a.recent, { previous: 20, latest: 45, delta: 25 });
  assert.equal(a.q1, 13.75);
  assert.equal(a.q3, 41.25);
  assert.equal(quantile([], 0.5), null);
  assert.equal(analyze(rows.slice(0, 9)).recent, null);
  assert.throws(() => analyze([rows[0], { ...rows[1], type: "head" }]));
});
test("Zone contributions sum to field total minus autonomous bonus and respect Skills colors", () => {
  for (const type of ["head", "driver", "autonomous"]) {
    const rows = makeDemo().records.filter((r) => r.type === type);
    const a = analyze(rows),
      fields = rows.map((r) =>
        type === "head" ? headScore(r.field, r.alliance) : skillsScore(r.field),
      );
    const expected =
      fields.reduce((sum, r) => sum + r.total - r.auton, 0) / fields.length;
    assert.ok(
      Math.abs(a.zones.reduce((sum, z) => sum + z.mean, 0) - expected) < 1e-10,
    );
    assert.ok(
      Math.abs(
        Object.values(a.composition).reduce((sum, n) => sum + n, 0) -
          fields.reduce((sum, r) => sum + r.total, 0) / fields.length,
      ) < 1e-10,
    );
  }
  const field = blankField();
  field.zones.top.red = 30;
  field.zones.top.yellow = 2;
  field.zones.top.toggle = "red";
  const a = analyze([{ type: "driver", field, createdAt: "2026-10-01" }]);
  assert.equal(a.zones[0].mean, 0);
  assert.equal(a.unownedYellow, 1);
});
test("Practice suggestions withhold performance claims for small samples and separate none from auton losses", () => {
  assert.match(practicePriorities(analyze([]))[0].title, /baseline/);
  const field = blankField();
  const rows = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    type: "head",
    field,
    alliance: "red",
    createdAt: new Date(2026, 0, i + 1).toISOString(),
  }));
  const a = analyze(rows);
  assert.equal(a.auton.none, 5);
  assert.equal(a.auton.lost, 0);
  assert.match(practicePriorities(a)[0].title, /No clear practice priority/);
});
