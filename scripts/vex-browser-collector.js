// Run this in Chrome DevTools Console while you are on https://events.vex.com/.
// It fetches data from the trusted browser session and downloads one JSON bundle.

(async () => {
  const input = prompt(
    "Enter VEX event IDs and/or ranges. Examples: 65030,64306 or 64000-65100",
    "65030,64306"
  );
  if (!input) {
    console.warn("VEX collector canceled.");
    return;
  }

  const targetSeasonId = 204;
  const delayMs = 700;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function parseIds(text) {
    const ids = new Set();
    for (const token of text.split(/[\s,]+/).map(part => part.trim()).filter(Boolean)) {
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

  async function getJson(path) {
    const response = await fetch(path, {
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*" }
    });
    if (response.status === 401 || response.status === 403) throw new Error(`Unauthorized (${response.status})`);
    if (response.status === 404) throw new Error("Not found (404)");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function getPaged(path) {
    const first = await getJson(path);
    const data = Array.isArray(first.data) ? [...first.data] : [];
    const lastPage = Number(first.meta?.last_page || 1);
    const url = new URL(path, location.origin);
    for (let page = 2; page <= lastPage; page += 1) {
      url.searchParams.set("page", String(page));
      await sleep(delayMs);
      const next = await getJson(`${url.pathname}?${url.searchParams}`);
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

  for (const [index, eventId] of orderedIds.entries()) {
    try {
      console.log(`[${index + 1}/${orderedIds.length}] Checking event ${eventId}...`);
      const event = await getJson(`/api/v2/events/${eventId}`);
      const seasonId = seasonIdOf(event);
      if (seasonId !== targetSeasonId) {
        bundle.skipped.push({ eventId, reason: `season ${seasonId || "unknown"}` });
        console.log(`Skipped ${eventId}: season ${seasonId || "unknown"}`);
        continue;
      }

      await sleep(delayMs);
      const teams = await getPaged(`/api/v2/events/${eventId}/teams?per_page=250&page=1`);
      await sleep(delayMs);
      const skills = await getPaged(`/api/v2/events/${eventId}/skills?per_page=250&page=1`);
      await sleep(delayMs);
      const awards = await getPaged(`/api/v2/events/${eventId}/awards?per_page=999`);

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
    await sleep(delayMs);
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
