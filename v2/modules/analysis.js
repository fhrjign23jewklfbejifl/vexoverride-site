import {
  ZONES,
  headScore,
  skillsScore,
  scoreRecord,
  opponentScore,
  midfieldOwner,
} from "./scoring.js";

// Descriptive statistics only. Match records describe alliances, not individual robots.
export function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p,
    low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
}
const average = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function analyze(records, type = records[0]?.type) {
  const rows = [...records].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  if (new Set(rows.map((r) => r.type)).size > 1)
    throw new Error("Analyze one run type at a time.");
  const head = type === "head",
    scores = rows.map(scoreRecord);
  const parts = rows.map((r) =>
    head ? headScore(r.field, r.alliance) : skillsScore(r.field),
  );
  const composition = Object.fromEntries(
    ["pins", "yellow", "midfield", "auton"].map((k) => [
      k,
      average(parts.map((p) => p[k])),
    ]),
  );
  const margins = head
    ? rows.map((r) => ({
        id: r.id,
        label: r.label,
        value: scoreRecord(r) - opponentScore(r),
      }))
    : [];
  const zones = ZONES.map((zone) => ({
    zone,
    mean: average(
      rows.map((r) => {
        const q = r.field.zones[zone];
        if (head)
          return (
            q[r.alliance] * 5 +
            ((zone === "center" ? midfieldOwner(r.field) : q.toggle) ===
            r.alliance
              ? q.yellow * 10
              : 0) +
            (zone === "center" ? r.field.robots[r.alliance] * 8 : 0)
          );
        const color = ["top", "right"].includes(zone) ? "blue" : "red";
        return (
          (zone === "center" ? q.red + q.blue : q[color]) * 5 +
          ((zone === "center" ? r.field.skillsRobot : q.toggle === color)
            ? q.yellow * 10
            : 0) +
          (zone === "center" && r.field.skillsRobot ? 8 : 0)
        );
      }),
    ),
  }));
  const low = scores.length ? Math.min(...scores) : null,
    high = scores.length ? Math.max(...scores) : null;
  const width = scores.length
    ? Math.max(5, Math.ceil((high - low + 1) / 6 / 5) * 5)
    : 5;
  const start = scores.length ? Math.floor(low / 5) * 5 : 0;
  const binCount = scores.length
    ? Math.min(7, Math.floor((high - start) / width) + 1)
    : 0;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    low: start + i * width,
    high: start + (i + 1) * width - 1,
    n: 0,
  }));
  for (const score of scores)
    bins[Math.min(bins.length - 1, Math.floor((score - start) / width))].n++;
  const latest = rows.slice(-5),
    previous = rows.slice(-10, -5);
  const recent =
    rows.length >= 10
      ? {
          latest: quantile(latest.map(scoreRecord), 0.5),
          previous: quantile(previous.map(scoreRecord), 0.5),
        }
      : null;
  if (recent) recent.delta = recent.latest - recent.previous;
  const midfield = rows.filter((r) =>
    head ? r.field.robots[r.alliance] > 0 : r.field.skillsRobot,
  ).length;
  const auton = head
    ? {
        won: rows.filter((r) => r.field.auton === r.alliance).length,
        lost: rows.filter(
          (r) =>
            r.field.auton !== r.alliance &&
            ["red", "blue"].includes(r.field.auton),
        ).length,
        tied: rows.filter((r) => r.field.auton === "tie").length,
        none: rows.filter((r) => r.field.auton === "none").length,
      }
    : null;
  const officialCount = rows.filter((r) => r.official).length;
  const unownedYellow = head
    ? 0
    : rows.filter((r) =>
        ZONES.some(
          (z) =>
            r.field.zones[z].yellow > 0 &&
            (z === "center"
              ? !r.field.skillsRobot
              : r.field.zones[z].toggle !==
                (["top", "right"].includes(z) ? "blue" : "red")),
        ),
      ).length;
  return {
    n: rows.length,
    head,
    rows,
    scores,
    mean: average(scores),
    median: quantile(scores, 0.5),
    q1: quantile(scores, 0.25),
    q3: quantile(scores, 0.75),
    low,
    high,
    composition,
    zones,
    margins,
    bins,
    recent,
    midfield,
    auton,
    officialCount,
    unownedYellow,
  };
}

export function practicePriorities(a) {
  const out = [];
  if (a.n < 5)
    return [
      {
        title: "Build a baseline first",
        evidence: `${a.n} saved ${a.head ? "matches" : "runs"} in this view.`,
        action:
          "Record at least five complete attempts, including failures, before treating a pattern as a practice priority.",
      },
    ];
  if (!a.head && a.unownedYellow >= 2)
    out.push({
      title: "Review yellow-pin ownership",
      evidence: `${a.unownedYellow} of ${a.n} runs ended with yellow halves that did not score because of ownership.`,
      action:
        "Replay those runs and check toggle timing or midfield entry. This flags unscored yellow halves; it does not prove they were safely recoverable.",
    });
  if (a.head && a.auton.lost >= 2)
    out.push({
      title: "Review autonomous with your partner",
      evidence: `Your alliance lost the autonomous bonus in ${a.auton.lost} of ${a.n} saved matches.`,
      action:
        "Compare routines and starting positions with the alliance partner. These records cannot tell which robot caused the result.",
    });
  if (a.q3 - a.q1 >= 20)
    out.push({
      title: "Make the lower-scoring runs explainable",
      evidence: `The middle half of scores spans ${Math.round(a.q1)}–${Math.round(a.q3)} points.`,
      action: a.head
        ? "Review match notes for opponent strength, partner changes, and repeatable failures before changing strategy."
        : "Compare your lower-scoring attempts with your best runs using the same route. Log dropped pins, resets, and time lost.",
    });
  if (!a.head && a.n - a.midfield >= 2)
    out.push({
      title: "Test the midfield finish",
      evidence: `${a.n - a.midfield} of ${a.n} runs finished without the robot in midfield.`,
      action:
        "Compare a planned midfield finish with your current route over repeated runs. Count travel time and lost scoring opportunities, not only the 8-point robot bonus.",
    });
  if (!a.head && a.rows.some((r) => !r.route))
    out.push({
      title: "Label your route versions",
      evidence: `${a.rows.filter((r) => !r.route).length} of ${a.n} runs have no route label.`,
      action:
        "Use a distinct version name when the route changes so improvements can be compared fairly.",
    });
  if (!out.length)
    out.push({
      title: "No clear practice priority in these fields",
      evidence: `${a.n} records checked for score spread, midfield finishes, and ${a.head ? "autonomous losses" : "yellow ownership"}.`,
      action:
        "Use match notes and video to find the next experiment. These totals do not measure cycle speed, driver mistakes, or individual robot contribution.",
    });
  return out.slice(0, 3);
}
