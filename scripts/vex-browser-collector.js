// Run this in Chrome DevTools Console while you are on https://events.vex.com/.
// It fetches data from the trusted browser session and downloads one JSON bundle.

(async () => {
  const targetSeasonId = 204;
  const defaultRange = "60000-70000";
  const allPresets = new Set(["all", "season204", "2026-2027", "2026", "override"]);
  const input = prompt(
    [
      "Enter VEX event IDs/ranges, or type all.",
      "Examples: 65030,64306 or 64000-65100",
      `all scans ${defaultRange} and only keeps season ${targetSeasonId}.`
    ].join("\n"),
    "all"
  );
  if (!input) {
    console.warn("VEX collector canceled.");
    return;
  }

  const baseDelayMs = 9000;
  const detailDelayMs = 3500;
  const maxRetries = 3;
  const minRateLimitWaitMs = 10 * 60 * 1000;
  const checkpointPauseEvery = 25;
  const checkpointPauseMs = 2 * 60 * 1000;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const jitter = ms => Math.round(ms + Math.random() * Math.min(ms * 0.35, 1200));

  function retryAfterMs(response, fallbackMs) {
    const header = response.headers.get("retry-after");
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const dateMs = Date.parse(header || "");
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
    return fallbackMs;
  }

  function parseIds(text) {
    const ids = new Set();
    const normalized = text.trim().toLowerCase();
    const tokens = allPresets.has(normalized)
      ? [defaultRange]
      : text.split(/[\s,]+/).map(part => part.trim()).filter(Boolean);
    for (const token of tokens) {
      const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        const low = Math.min(start, end);
        const high = Math.max(start, end);
        for (let id = low; id <= high; id += 1) ids.add(id);
        continue;
      }
      if (/^\d+$/.test(token)) ids.add(Number(token));
    }
    return ids;
  }

  const ids = parseIds(input);
  if (!ids.size) {
    console.warn("No valid event IDs or ranges were entered.");
    return;
  }

  if (ids.size > 2000) {
    const ok = confirm(
      `This will check ${ids.size} event IDs and may take a while.\n\n` +
      "It only downloads teams/skills/awards for events that match season 204.\n\n" +
      "Continue?"
    );
    if (!ok) {
      console.warn("Large VEX collector scan canceled.");
      return;
    }
  }

  async function getJson(path, label = path) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch(path, {
        credentials: "include",
        headers: { accept: "application/json, text/plain, */*" }
      });
      if (response.status === 429) {
        const fallbackMs = minRateLimitWaitMs * Math.max(1, attempt + 1);
        const waitMs = jitter(retryAfterMs(response, fallbackMs));
        console.warn(
          `Rate limited on ${label}. Waiting ${Math.round(waitMs / 60000)} minute(s) before retry ${attempt + 1}/${maxRetries}.`
        );
        await sleep(waitMs);
        continue;
      }
      if (response.status === 401 || response.status === 403) throw new Error(`Unauthorized (${response.status})`);
      if (response.status === 404) throw new Error("Not found (404)");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
    throw new Error("HTTP 429 after retries; stop the scan and wait before trying again");
  }

  async function getPaged(path, label) {
    const first = await getJson(path, `${label} page 1`);
    const data = Array.isArray(first.data) ? [...first.data] : [];
    const lastPage = Number(first.meta?.last_page || 1);
    const url = new URL(path, location.origin);
    for (let page = 2; page <= lastPage; page += 1) {
      url.searchParams.set("page", String(page));
      await sleep(jitter(detailDelayMs));
      const next = await getJson(`${url.pathname}?${url.searchParams}`, `${label} page ${page}`);
      data.push(...(Array.isArray(next.data) ? next.data : []));
    }
    return { ...first, data, meta: { ...first.meta, merged_pages: lastPage } };
  }

  function seasonIdOf(event) {
    const data = event?.data || event || {};
    return Number(data.season_id || data.seasonId || data.season?.id || data.season?.season_id);
  }

  const bundle = {
    generatedAt: new Date().toISOString(),
    source: location.origin,
    targetSeasonId,
    events: [],
    skipped: []
  };

  const orderedIds = [...ids].sort((a, b) => a - b);

  console.clear();
  console.log(`VEX collector starting: ${orderedIds.length} event id(s). Season filter: ${targetSeasonId}.`);
  console.log("Tip: keep this tab open until the bundle downloads. Current progress is also stored on window.vexCollectorBundle.");
  console.log("This version runs slowly, pauses during large scans, and backs off when VEX returns 429 Too Many Requests.");
  if (orderedIds.length > 2000) {
    console.log("Large range note: 60000-70000 can take many hours. That is intentional so Cloudflare does not ban the browser.");
  }

  for (const [index, eventId] of orderedIds.entries()) {
    try {
      console.log(`[${index + 1}/${orderedIds.length}] Checking event ${eventId}...`);
      const event = await getJson(`/api/v2/events/${eventId}`, `event ${eventId}`);
      const seasonId = seasonIdOf(event);
      if (seasonId !== targetSeasonId) {
        bundle.skipped.push({ eventId, reason: `season ${seasonId || "unknown"}` });
        console.log(`Skipped ${eventId}: season ${seasonId || "unknown"}`);
        continue;
      }

      await sleep(jitter(detailDelayMs));
      const teams = await getPaged(`/api/v2/events/${eventId}/teams?per_page=250&page=1`, `event ${eventId} teams`);
      await sleep(jitter(detailDelayMs));
      const skills = await getPaged(`/api/v2/events/${eventId}/skills?per_page=250&page=1`, `event ${eventId} skills`);
      await sleep(jitter(detailDelayMs));
      const awards = await getPaged(`/api/v2/events/${eventId}/awards?per_page=999`, `event ${eventId} awards`);

      bundle.events.push({
        eventId,
        event,
        teams,
        skills,
        awards,
        meta: {
          source: "browser-side events.vex.com collector",
          collectedAt: new Date().toISOString()
        }
      });
      console.log(`Saved ${eventId}: ${teams.data?.length || 0} teams, ${skills.data?.length || 0} skills rows.`);
    } catch (error) {
      bundle.skipped.push({ eventId, reason: error.message });
      console.warn(`Skipped ${eventId}: ${error.message}`);
    }
    window.vexCollectorBundle = bundle;
    if ((index + 1) % 100 === 0) {
      console.log(`Progress: checked ${index + 1}/${orderedIds.length}; saved ${bundle.events.length}; skipped ${bundle.skipped.length}.`);
    }
    if (orderedIds.length > 2000 && (index + 1) % checkpointPauseEvery === 0) {
      console.log(`Cooling down for ${Math.round(checkpointPauseMs / 60000)} minute(s) after ${index + 1} checks.`);
      await sleep(jitter(checkpointPauseMs));
    }
    await sleep(jitter(baseDelayMs));
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `vex-event-bundle-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  console.log(`Done. Downloaded bundle with ${bundle.events.length} event(s), ${bundle.skipped.length} skipped.`);
  console.log("Import it with: npm.cmd run vex:import-bundle -- \"C:\\\\Users\\\\29SSchwartz\\\\Downloads\\\\vex-event-bundle-...json\"");
})();
