import {compactRatingInput} from './lib/rating-input.mjs';
import { readFile, writeFile } from "node:fs/promises";
const read = async (p) =>
  JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const directory = await read("v2/team-index.json");
const feeds = await Promise.all(
  ["high-school", "middle-school"].map((g) =>
    read(`data/season-204/skills-${g}.json`).catch(() => null),
  ),
);
const skills = feeds
  .filter(Boolean)
  .flatMap((f) =>
    f.data.map((r) => ({
      number: r.team.team,
      eventSku: r.event.sku,
      combined: r.scores.score,
      driver: r.scores.maxDriver,
      autonomous: r.scores.maxProgramming,
      date: r.event.startDate,
      sourceUpdatedAt: f.fetchedAt,
    })),
  );
const events = [];
const index = await read("data/events/index.json");
for (const row of index.events) {
  const id = String(row.eventId);
  const parts = await Promise.all(
    ["event", "teams", "matches", "rankings", "awards", "meta", "skills"].map((f) =>
      read(`data/events/${id}/${f}.json`).catch(() => null),
    ),
  );
  const [event, teams, matches, rankings, awards, meta, eventSkills] = parts;
  const e = event?.data || event;
  if(e) {
    const grouped=new Map();
    for(const row of eventSkills?.data || []) {
      const number=row.team?.name || row.team?.number;
      if(!number || !['driver','programming'].includes(row.type) || typeof row.score!=='number')continue;
      if(!grouped.has(number))grouped.set(number,{number,eventSku:e.sku || id,date:e.end || e.start,sourceUpdatedAt:meta?.updatedAt});
      const item=grouped.get(number),key=row.type==='driver'?'driver':'autonomous';
      item[key]=Math.max(item[key] ?? 0,row.score);
    }
    skills.push(...grouped.values());
    events.push({
      id,
      name: e.name,
      date: e.start,
      end: e.end,
      teams: (teams?.data || []).map((t) => ({ id: t.id, number: t.number })),
      matches: matches?.data || [],
      rankings: rankings?.data || [],
      awards: awards?.data ?? null,
      awardsFinalized: e.awards_finalized === true,
      sourceUpdatedAt: meta?.updatedAt,
    });
  }
}
const cutoff =
  process.env.PIGEON_CUTOFF ||
  [index.updatedAt, ...feeds.filter(Boolean).map((f) => f.fetchedAt)]
    .sort()
    .at(-1);
const input = {
  teams: directory.teams,
  events,
  skills,
  cutoff,
  scope: "Retrieved worldwide V5RC teams; incomplete event coverage",
};
input.inputs = {
  directoryUpdatedAt: directory.updatedAt,
  feeds: feeds
    .filter(Boolean)
    .map((f) => ({
      grade: f.gradeLevel,
      teams: f.teamCount,
      hash: f.contentHash,
      fetchedAt: f.fetchedAt,
    })),
  eventSnapshots: events.length,
  catalogEvents: directory.catalogCount,
};
await writeFile(new URL('../data/rating-input.json',import.meta.url),JSON.stringify(compactRatingInput(input))+'\n');
console.log(JSON.stringify({teams:input.teams.length,events:input.events.length,cutoff:input.cutoff}));
