import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "https://events.vex.com/api/v2";
const LOGIN_URL = "https://events.vex.com/auth/login";
const LOCAL_DIR = path.join(ROOT, ".local");
const SESSION_DIR = path.join(LOCAL_DIR, "vex-browser-session");
const LOG_DIR = path.join(LOCAL_DIR, "logs");
const HEADERS_PATH = path.join(LOCAL_DIR, "vex-request-headers.json");
const DATA_DIR = path.join(ROOT, "data", "events");
const CONFIG_PATH = path.join(ROOT, "data", "vex-updater-config.json");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

const args = new Set(process.argv.slice(2));

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  return fs.mkdir(LOG_DIR, { recursive: true })
    .then(() => fs.appendFile(path.join(LOG_DIR, "vex-updater.log"), `${line}\n`))
    .catch(() => {});
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function eventIdsFromConfig(config) {
  const ids = new Set((config.knownEventIds || []).map(Number).filter(Number.isFinite));
  for (const range of config.eventIdRanges || []) {
    const start = Number(range.start);
    const end = Number(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    for (let id = low; id <= high; id += 1) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b).slice(0, config.maxEventsPerRun || 250);
}

function seasonSignalsFromEvent(event) {
  const data = event?.data || event || {};
  const season = data.season || data.season_info || {};
  return {
    id: data.season_id || data.seasonId || season.id || season.season_id || null,
    name: data.season_name || data.seasonName || season.name || season.label || season.title || ""
  };
}

function eventMatchesTargetSeason(event, config) {
  const targetId = Number(config.targetSeasonId || 204);
  const targetName = String(config.targetSeasonName || "2026-2027");
  const signal = seasonSignalsFromEvent(event);
  const signalId = Number(signal.id);
  const signalName = String(signal.name || "");

  if (Number.isFinite(signalId) && signalId === targetId) return true;
  if (Number.isFinite(signalId) && signalId !== targetId) return false;
  if (signalName.includes(targetName)) return true;
  return false;
}

async function launchContext(config, forceHeaded = false) {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  return chromium.launchPersistentContext(SESSION_DIR, {
    channel: "chrome",
    headless: forceHeaded ? false : Boolean(config.headless),
    viewport: { width: 1280, height: 900 }
  });
}

async function loadHeaderClient(config) {
  const local = await readJson(HEADERS_PATH, null);
  if (!local) return null;

  const headers = { ...(local.headers || local) };
  if (local.cookie && !headers.cookie) headers.cookie = local.cookie;
  if (local.userAgent && !headers["user-agent"]) headers["user-agent"] = local.userAgent;
  if (!headers.accept) headers.accept = "application/json, text/plain, */*";
  if (!headers.referer) headers.referer = "https://events.vex.com/";

  return {
    usingLocalHeaders: true,
    async json(url, timeoutMs) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs || config.requestTimeoutMs || 30000);
      try {
        const response = await fetch(url, {
          headers,
          signal: controller.signal
        });
        const text = await response.text();
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Unauthorized (${response.status})`);
        }
        if (response.status === 404) {
          throw new Error("Not found (404)");
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`Response was not JSON: ${text.slice(0, 80)}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    },
    async close() {}
  };
}

function printHeadersHelp() {
  console.log(`
VEX updater local-header fallback

Use this only if the automated login browser gets stuck on the robot check.

1. Open VEX Events in your normal Chrome browser and sign in normally.
2. Open DevTools -> Network.
3. Open a working API URL, such as:
   https://events.vex.com/api/v2/events/65030
4. Click that request and copy the Request Headers values for:
   - cookie
   - user-agent
5. Create this local-only ignored file:
   .local/vex-request-headers.json
6. Put this shape in it:

{
  "cookie": "PASTE_COOKIE_HEADER_HERE",
  "user-agent": "PASTE_USER_AGENT_HERE"
}

Do not paste this file into chat. Do not commit it. The repo .gitignore excludes .local/.
After that, run:
  npm.cmd run vex:update:headed
`);
}

async function loginMode() {
  const config = await readJson(CONFIG_PATH, {});
  const context = await launchContext({ ...config, headless: false }, true);
  const page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: config.requestTimeoutMs || 30000 });
  await log("Login browser opened. Sign into VEX Events, then return here.");
  const rl = readline.createInterface({ input, output });
  await rl.question("Press Enter after the VEX Events login is complete...");
  rl.close();
  await context.close();
  await log("Saved local browser session.");
}

async function pageJson(page, url, timeoutMs) {
  if (page?.json) return page.json(url, timeoutMs);

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const status = response?.status() || 0;
  const body = (await page.locator("body").innerText({ timeout: 8000 })).trim();
  if (status === 401 || status === 403) {
    throw new Error(`Unauthorized (${status})`);
  }
  if (status === 404) {
    throw new Error("Not found (404)");
  }
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Response was not JSON: ${body.slice(0, 80)}`);
  }
}

async function fetchPaged(page, firstUrl, timeoutMs, delayMs) {
  const first = await pageJson(page, firstUrl, timeoutMs);
  const firstData = Array.isArray(first.data) ? first.data : [];
  const lastPage = Number(first.meta?.last_page || 1);
  if (!firstData.length || lastPage <= 1) return first;

  const merged = { ...first, data: [...firstData] };
  const url = new URL(firstUrl);
  for (let pageNum = 2; pageNum <= lastPage; pageNum += 1) {
    url.searchParams.set("page", String(pageNum));
    await sleep(delayMs);
    const next = await pageJson(page, url.toString(), timeoutMs);
    merged.data.push(...(Array.isArray(next.data) ? next.data : []));
  }
  merged.meta = { ...first.meta, current_page: 1, merged_pages: lastPage };
  return merged;
}

function eventSummary(eventId, event, teams, skills, awards, meta) {
  const data = event?.data || event || {};
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
    updatedAt: meta.updatedAt,
    paths: {
      event: `data/events/${eventId}/event.json`,
      teams: `data/events/${eventId}/teams.json`,
      skills: `data/events/${eventId}/skills.json`,
      awards: `data/events/${eventId}/awards.json`,
      meta: `data/events/${eventId}/meta.json`
    }
  };
}

async function fetchEvent(context, config, eventId, shared) {
  const page = context.newPage ? await context.newPage() : context;
  const timeoutMs = config.requestTimeoutMs || 30000;
  const delayMs = config.delayMs || 900;
  const folder = path.join(DATA_DIR, String(eventId));
  const meta = {
    eventId,
    updatedAt: new Date().toISOString(),
    source: "events.vex.com",
    status: "ok",
    endpoints: {}
  };

  try {
    const urls = {
      event: `${API_BASE}/events/${eventId}`,
      teams: `${API_BASE}/events/${eventId}/teams?per_page=250&page=1`,
      skills: `${API_BASE}/events/${eventId}/skills?per_page=250&page=1`,
      awards: `${API_BASE}/events/${eventId}/awards?per_page=999`
    };

    const event = await pageJson(page, urls.event, timeoutMs);
    meta.endpoints.event = urls.event;
    if (!eventMatchesTargetSeason(event, config)) {
      const signal = seasonSignalsFromEvent(event);
      throw new Error(`Wrong season (${signal.name || signal.id || "unknown"}), expected ${config.targetSeasonName || "2026-2027"}`);
    }
    await sleep(delayMs);
    const teams = await fetchPaged(page, urls.teams, timeoutMs, delayMs);
    meta.endpoints.teams = urls.teams;
    await sleep(delayMs);
    const skills = await fetchPaged(page, urls.skills, timeoutMs, delayMs);
    meta.endpoints.skills = urls.skills;
    await sleep(delayMs);
    const awards = await fetchPaged(page, urls.awards, timeoutMs, delayMs);
    meta.endpoints.awards = urls.awards;

    await writeJson(path.join(folder, "event.json"), event);
    await writeJson(path.join(folder, "teams.json"), teams);
    await writeJson(path.join(folder, "skills.json"), skills);
    await writeJson(path.join(folder, "awards.json"), awards);
    await writeJson(path.join(folder, "program.json"), shared.program);
    await writeJson(path.join(folder, "season.json"), shared.season);
    await writeJson(path.join(folder, "meta.json"), meta);
    if (page.close) await page.close();
    await log(`Fetched event ${eventId}: ${teams?.data?.length || 0} teams, ${skills?.data?.length || 0} skills rows.`);
    return eventSummary(eventId, event, teams, skills, awards, meta);
  } catch (error) {
    meta.status = "skipped";
    meta.error = error.message;
    await writeJson(path.join(folder, "meta.json"), meta);
    if (page.close) await page.close();
    await log(`Skipped event ${eventId}: ${error.message}`);
    return null;
  }
}

async function fetchShared(context, config) {
  const page = context.newPage ? await context.newPage() : context;
  const timeoutMs = config.requestTimeoutMs || 30000;
  const programUrl = `${API_BASE}/programs/1`;
  const seasonUrl = `${API_BASE}/seasons/204`;
  const program = await pageJson(page, programUrl, timeoutMs).catch(error => ({ error: error.message, source: programUrl }));
  const season = await pageJson(page, seasonUrl, timeoutMs).catch(error => ({ error: error.message, source: seasonUrl }));
  if (page.close) await page.close();
  return { program, season };
}

function git(argsForGit, options = {}) {
  return execFileSync("git", argsForGit, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.stdio || "pipe"
  });
}

function hasDataChanges() {
  try {
    git(["diff", "--quiet", "--", "data/events"]);
    git(["diff", "--cached", "--quiet", "--", "data/events"]);
    return false;
  } catch {
    return true;
  }
}

async function publishIfNeeded(config) {
  git(["add", "data/events"], { stdio: "inherit" });
  if (!hasDataChanges()) {
    await log("No event data changes to publish.");
    return;
  }
  git(["commit", "-m", config.commitMessage || "Update VEX event data"], { stdio: "inherit" });
  if (config.autoCommitPush && !args.has("--no-push")) {
    git(["push", "origin", "main"], { stdio: "inherit" });
    await log("Pushed event data to GitHub.");
  } else {
    await log("Committed event data locally; push skipped.");
  }
}

async function updateMode() {
  const config = await readJson(CONFIG_PATH, {});
  const ids = eventIdsFromConfig(config);
  if (!ids.length) {
    await log("No event IDs configured.");
    return;
  }

  const headerClient = await loadHeaderClient(config);
  const context = headerClient || await launchContext(config, args.has("--headed"));
  if (headerClient) await log(`Using local request headers from ${path.relative(ROOT, HEADERS_PATH)}.`);
  const shared = await fetchShared(context, config);
  const events = [];

  for (const eventId of ids) {
    const summary = await fetchEvent(context, config, eventId, shared);
    if (summary) events.push(summary);
    await sleep(config.delayMs || 900);
  }

  await context.close();
  const previous = await readJson(INDEX_PATH, {});
  const previousById = new Map((previous.events || []).map(event => [String(event.eventId), event]));
  for (const event of events) previousById.set(String(event.eventId), event);
  const index = {
    updatedAt: new Date().toISOString(),
    seasonId: 204,
    programId: 1,
    events: [...previousById.values()].sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")) || a.eventId - b.eventId)
  };
  await writeJson(INDEX_PATH, index);
  await publishIfNeeded(config);
}

if (args.has("--headers-help")) {
  printHeadersHelp();
} else if (args.has("--login")) {
  await loginMode();
} else {
  await updateMode();
}
