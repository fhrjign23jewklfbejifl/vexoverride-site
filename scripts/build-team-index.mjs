// Build one small lookup file from the existing public event snapshots.
// No credentials or new network requests are involved.
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const index = JSON.parse(
  await readFile(new URL("data/events/index.json", root), "utf8"),
);
const teams = new Map();
for (const event of [...index.events].sort((a, b) =>
  (a.updatedAt || "").localeCompare(b.updatedAt || ""),
)) {
  const snapshot = JSON.parse(
    await readFile(
      new URL(`data/events/${event.eventId}/teams.json`, root),
      "utf8",
    ),
  );
  for (const t of snapshot.data || [])
    if (t.number && t.team_name)
      teams.set(t.number, {
        number: t.number,
        name: t.team_name,
        city: t.location?.city || "",
        region: t.location?.region || "",
      });
}
const result = {
  updatedAt: index.updatedAt,
  teams: [...teams.values()].sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true }),
  ),
};
const content = JSON.stringify(result) + "\n",
  target = new URL("v2/team-index.json", root);
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== content)
    throw new Error(
      "Team lookup is stale. Run npm run build:teams after updating event snapshots.",
    );
} else {
  await writeFile(target, content);
  console.log(`Indexed ${result.teams.length} teams from existing snapshots.`);
}
