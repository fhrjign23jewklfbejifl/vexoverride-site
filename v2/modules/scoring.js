// Scoring extracted from the original app and checked against Override v2.1.
// Counts mean visible, legally placed pin HALVES. Placement remains a referee/user judgment.
export const ZONES = ["top", "right", "bottom", "left", "center"];
export const COLORS = ["red", "blue", "yellow"];
export const POINTS = Object.freeze({
  pin: 5,
  yellow: 10,
  robot: 8,
  auton: 12,
  tie: 6,
});
export function blankField() {
  return {
    zones: Object.fromEntries(
      ZONES.map((z) => [z, { red: 0, blue: 0, yellow: 0, toggle: "neutral" }]),
    ),
    robots: { red: 0, blue: 0 },
    skillsRobot: false,
    auton: "none",
  };
}
export function validateField(field) {
  if (!field || !field.zones || !field.robots)
    throw new Error("The field record is incomplete.");
  for (const z of ZONES) {
    const q = field.zones[z];
    if (!q || !["red", "blue", "neutral"].includes(q.toggle))
      throw new Error("Invalid toggle state.");
    for (const c of COLORS)
      if (!Number.isInteger(q[c]) || q[c] < 0 || q[c] > 126)
        throw new Error("Pin-half counts must be whole numbers from 0 to 126.");
  }
  for (const c of ["red", "blue"])
    if (
      !Number.isInteger(field.robots[c]) ||
      field.robots[c] < 0 ||
      field.robots[c] > 2
    )
      throw new Error("An alliance has at most two midfield robots.");
  if (
    !["red", "blue", "tie", "none"].includes(field.auton) ||
    typeof field.skillsRobot !== "boolean"
  )
    throw new Error("Invalid field state.");
  return true;
}
export function midfieldOwner(field) {
  return field.robots.red === field.robots.blue
    ? "neutral"
    : field.robots.red > field.robots.blue
      ? "red"
      : "blue";
}
export function headScore(field, alliance) {
  validateField(field);
  if (!["red", "blue"].includes(alliance))
    throw new Error("Select an alliance.");
  const parts = {
    pins: 0,
    yellow: 0,
    midfield: field.robots[alliance] * 8,
    auton: field.auton === alliance ? 12 : field.auton === "tie" ? 6 : 0,
  };
  for (const z of ZONES) {
    parts.pins += field.zones[z][alliance] * 5;
    const owner = z === "center" ? midfieldOwner(field) : field.zones[z].toggle;
    if (owner === alliance) parts.yellow += field.zones[z].yellow * 10;
  }
  return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}
export function skillsScore(field) {
  validateField(field);
  const parts = {
    pins: 0,
    yellow: 0,
    midfield: field.skillsRobot ? 8 : 0,
    auton: 0,
  };
  for (const z of ZONES) {
    const q = field.zones[z];
    if (["left", "bottom", "center"].includes(z)) parts.pins += q.red * 5;
    if (["top", "right", "center"].includes(z)) parts.pins += q.blue * 5;
    const owns =
      z === "center"
        ? field.skillsRobot
        : q.toggle === (["top", "right"].includes(z) ? "blue" : "red");
    if (owns) parts.yellow += q.yellow * 10;
  }
  return { ...parts, total: parts.pins + parts.yellow + parts.midfield };
}
export function scoreRecord(r) {
  if (r.type !== "head") return skillsScore(r.field).total;
  return r.official?.[r.alliance] ?? headScore(r.field, r.alliance).total;
}
export function opponentScore(r) {
  const other = r.alliance === "red" ? "blue" : "red";
  return r.official?.[other] ?? headScore(r.field, other).total;
}
export function summary(records) {
  const values = records.map(scoreRecord).sort((a, b) => a - b);
  if (!values.length)
    return { n: 0, mean: null, median: null, best: null, low: null };
  const m = Math.floor(values.length / 2);
  return {
    n: values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2,
    best: values.at(-1),
    low: values[0],
  };
}
export function opportunities(field, alliance) {
  const current =
    headScore(field, alliance).total -
    headScore(field, alliance === "red" ? "blue" : "red").total;
  return ZONES.filter((z) => z !== "center")
    .map((zone) => {
      const next = structuredClone(field);
      next.zones[zone].toggle = alliance;
      const margin =
        headScore(next, alliance).total -
        headScore(next, alliance === "red" ? "blue" : "red").total;
      return {
        zone,
        delta: margin - current,
        halves: field.zones[zone].yellow,
      };
    })
    .filter((o) => o.delta > 0)
    .sort((a, b) => b.delta - a.delta);
}
