import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data", "events");
const CONFIG_PATH = path.join(ROOT, "data", "vex-updater-config.json");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

const args = process.argv.slice(2);

function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasArg(name) {
  return args.includes(name);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getClipboardText() {
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function parseClipboardJson() {
  const raw = getClipboardText();
  const firstBrace = raw.search(/[\[{]/);
  if (firstBrace < 0) throw new Error("Clipboard does not contain JSON.");
  return JSON.parse(raw.slice(firstBrace));
}

function eventData(event) {
  return event?.data || event || {};
}

function seasonSignal(event) {
  const data = eventData(event);
  const season = data.season || {};
  return {
    id: data.season_id || data.seasonId || season.id || season.season_id || null,
    name: data.season_name || data.seasonName || season.name || ""
  };
}

function assertSeason(event, config) {
  const targetId = Number(config.targetSeasonId || 204);
  const targetName = String(config.targetSeasonName || "2026-2027");
  const signal = seasonSignal(event);
  const id = Number(signal.id);
  if (Number.isFinite(id) && id !== targetId) {
    throw new Error(`Wrong season id ${id}; expected ${targetId}.`);
  }
  if (!Number.isFinite(id) && signal.name && !String(signal.name).includes(targetName)) {
    throw new Error(`Wrong season ${signal.name}; expected ${targetName}.`);
  }
}

function summary(eventId, event, teams, skills, awards) {
  const data = eventData(event);
  const location = data.location || {};
  return {
    eventId,
    sku: data.sku || data.code || "",
    name: data.name || "",
    start: data.start || data.start_date || "",
    end: data.end || data.end_date || "",
    city: location.city || data.city || "",
    region: location.region || data.region || "",
    country: location.country || data.country || "",
    teamCount: teams?.data?.length || 0,
    skillCount: skills?.data?.length || 0,
    awardCount: awards?.data?.length || 0,
    updatedAt: new Date().toISOString(),
    paths: {
      event: `data/events/${eventId}/event.json`,
      teams: `data/events/${eventId}/teams.json`,
      skills: `data/events/${eventId}/skills.json`,
      awards: `data/events/${eventId}/awards.json`,
      meta: `data/events/${eventId}/meta.json`
    }
  };
}

async function rebuildIndex() {
  const entries = [];
  const eventDirs = await fs.readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
  for (const dir of eventDirs) {
    if (!dir.isDirectory() || !/^\d+$/.test(dir.name)) continue;
    const eventId = Number(dir.name);
    const folder = path.join(DATA_DIR, dir.name);
    const event = await readJson(path.join(folder, "event.json"), null);
    if (!event) continue;
    const teams = await readJson(path.join(folder, "teams.json"), {});
    const skills = await readJson(path.join(folder, "skills.json"), {});
    const awards = await readJson(path.join(folder, "awards.json"), {});
    entries.push(summary(eventId, event, teams, skills, awards));
  }

  await writeJson(INDEX_PATH, {
    updatedAt: new Date().toISOString(),
    seasonId: 204,
    programId: 1,
    events: entries.sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")) || a.eventId - b.eventId)
  });
}

async function saveEventBundle(bundle) {
  const config = await readJson(CONFIG_PATH, {});
  const records = Array.isArray(bundle.events) ? bundle.events : [];
  let saved = 0;

  for (const record of records) {
    const eventId = Number(record.eventId || eventData(record.event).id);
    if (!Number.isFinite(eventId) || !record.event) continue;
    assertSeason(record.event, config);

    const folder = path.join(DATA_DIR, String(eventId));
    await writeJson(path.join(folder, "event.json"), record.event);
    if (record.teams) await writeJson(path.join(folder, "teams.json"), record.teams);
    if (record.skills) await writeJson(path.join(folder, "skills.json"), record.skills);
    if (record.awards) await writeJson(path.join(folder, "awards.json"), record.awards);
    await writeJson(path.join(folder, "meta.json"), {
      eventId,
      updatedAt: new Date().toISOString(),
      source: record.meta?.source || "browser-side events.vex.com collector",
      status: "ok"
    });
    saved += 1;
  }

  await rebuildIndex();
  console.log(`Imported ${saved} event bundle record(s) and rebuilt data/events/index.json.`);
}

async function main() {
  if (hasArg("--bundle")) {
    const bundlePath = argValue("--bundle");
    const bundle = bundlePath
      ? JSON.parse(await fs.readFile(path.resolve(bundlePath), "utf8"))
      : parseClipboardJson();
    await saveEventBundle(bundle);
    return;
  }

  const eventId = Number(argValue("--event"));
  const kind = argValue("--kind");
  if (!Number.isFinite(eventId) || !["event", "teams", "skills", "awards"].includes(kind)) {
    throw new Error("Usage: npm.cmd run vex:save-clipboard -- --event 65030 --kind event|teams|skills|awards");
  }

  const config = await readJson(CONFIG_PATH, {});
  const json = parseClipboardJson();
  if (kind === "event") assertSeason(json, config);

  const folder = path.join(DATA_DIR, String(eventId));
  await writeJson(path.join(folder, `${kind}.json`), json);
  await writeJson(path.join(folder, "meta.json"), {
    eventId,
    updatedAt: new Date().toISOString(),
    source: "manual clipboard import from events.vex.com",
    status: "ok"
  });
  await rebuildIndex();
  console.log(`Saved ${kind}.json for event ${eventId} and rebuilt data/events/index.json.`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
