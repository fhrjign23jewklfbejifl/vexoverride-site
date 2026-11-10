export const DATA_ROOT = new URL("../../data/events/", import.meta.url);
async function read(path) {
  const response = await fetch(new URL(path, DATA_ROOT));
  if (!response.ok)
    throw new Error(
      "Event data could not be loaded. Saved events remain available offline.",
    );
  return response.json();
}
export async function eventIndex() {
  const result = await read("index.json");
  if (!Array.isArray(result.events))
    throw new Error("The event index is invalid.");
  return {
    updatedAt: result.updatedAt,
    events: result.events.map((e) => ({
      id: String(e.eventId),
      name: e.name || "Unnamed event",
      date: e.start || "",
      location: [e.city, e.region, e.country].filter(Boolean).join(", "),
      teams: e.teamCount || 0,
      sourceUpdatedAt: e.updatedAt || result.updatedAt,
    })),
  };
}
export async function loadEvent(id) {
  if (!/^\d+$/.test(id)) throw new Error("Invalid event ID.");
  const [metadata, teams, skills] = await Promise.all([
    read(id + "/event.json"),
    read(id + "/teams.json"),
    read(id + "/skills.json"),
  ]);
  const e = metadata.data || metadata;
  return {
    id,
    name: e.name || "Event " + id,
    date: e.start || e.start_date || "",
    location: [e.location?.city, e.location?.region, e.location?.country]
      .filter(Boolean)
      .join(", "),
    teams: (teams.data || []).map((t) => ({
      number: String(t.number || t.team || t.teamNumber || "").toUpperCase(),
      name: t.team_name || t.teamName || t.name || "",
      location: [t.location?.city, t.location?.region]
        .filter(Boolean)
        .join(", "),
      id: t.id,
    })),
    skills: skills.data || [],
    source: "synced",
    loadedAt: new Date().toISOString(),
  };
}
export function eventSkills(event, team) {
  const result = { driver: null, autonomous: null };
  for (const row of event?.skills || []) {
    const number = String(
      row.team?.number || row.team?.team || row.teamNumber || "",
    ).toUpperCase();
    const t = event.teams.find((t) => t.number === team);
    if (number !== team && !(row.team?.id && row.team.id === t?.id)) continue;
    const kind = /program|auton/i.test(row.type || "")
      ? "autonomous"
      : /driver/i.test(row.type || "")
        ? "driver"
        : null;
    if (
      kind &&
      typeof row.score === "number" &&
      Number.isFinite(row.score) &&
      row.score >= 0
    )
      result[kind] = Math.max(result[kind] ?? 0, Number(row.score));
  }
  result.partial = (result.driver == null) !== (result.autonomous == null);
  result.total =
    result.driver == null && result.autonomous == null
      ? null
      : (result.driver || 0) + (result.autonomous || 0);
  return result;
}
export function observationStats(rows) {
  const known = (key, positive) => {
    const values = rows.filter((o) => o[key] && o[key] !== "unknown");
    return {
      yes: values.filter((o) => o[key] === positive).length,
      n: values.length,
    };
  };
  return {
    n: rows.length,
    auton: known("auton", "success"),
    midfield: known("midfield", "yes"),
    reliability: known("reliability", "clean"),
  };
}
