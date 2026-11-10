// One shared cache per event worldwide; a separate object enforces a global API budget.
const API = 'https://events.vex.com/api/v2';
const route = /^\/events\/[1-9]\d{0,8}(?:\/(?:teams|skills)|\/divisions\/[1-9]\d{0,5}\/(?:matches|rankings))?$/;
const output = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const stamp = () => new Date().toISOString();

export function retrySeconds(value, now = Date.now()) {
  const seconds = Number(value);
  if (value && Number.isFinite(seconds)) return Math.max(1, seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - now) / 1000)) : 60;
}

export async function readDocument(storage, key) {
  const count = await storage.get(key + ':count');
  if (count == null) return null;
  let value = '';
  for (let i = 0; i < count; i++) value += await storage.get(key + ':' + i);
  return JSON.parse(value);
}
export async function writeDocument(storage, key, value) {
  const text = JSON.stringify(value), count = Math.ceil(text.length / 16000);
  await storage.transaction(async tx => {
    const previous = await tx.get(key + ':count') || 0;
    for (let i = 0; i < count; i++) await tx.put(key + ':' + i, text.slice(i * 16000, (i + 1) * 16000));
    for (let i = count; i < previous; i++) await tx.delete(key + ':' + i);
    await tx.put(key + ':count', count);
  });
}

export class VexRequestBudget {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.tail = Promise.resolve(); }
  async fetch(request) {
    // Reserve budget serially, even when separate events request data simultaneously.
    const turn = this.tail.then(() => this.execute(request));
    this.tail = turn.catch(() => {});
    return turn;
  }
  async execute(request) {
    const url = new URL(request.url), page = Number(url.searchParams.get('page') || 1);
    if (!route.test(url.pathname) || !Number.isInteger(page) || page < 1 || page > 100)
      return output({error: 'Invalid upstream route'}, 400);
    if (!this.env.VEX_EVENTS_TOKEN) return output({error: 'Live service needs its API credential'}, 503);
    const now = Date.now(), minute = Math.floor(now / 60000);
    let budget = await this.ctx.storage.get('budget') || {minute, used: 0, blockedUntil: 0};
    if (budget.minute !== minute) budget = {...budget, minute, used: 0};
    const maximum = Math.max(1, Math.min(600, Number(this.env.VEX_REQUESTS_PER_MINUTE) || 30));
    if (budget.blockedUntil > now || budget.used >= maximum)
      return output({error: 'Upstream refresh paused', retryAfter: Math.max(1, Math.ceil((Math.max(budget.blockedUntil, (minute + 1) * 60000) - now) / 1000))}, 429);
    budget.used++;
    await this.ctx.storage.put('budget', budget);
    let response;
    try {
      response = await fetch(API + url.pathname + `?page=${page}&per_page=250`, {
        headers: {Accept: 'application/json', Authorization: `Bearer ${this.env.VEX_EVENTS_TOKEN}`},
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
    } catch { return output({error: 'VEX could not be reached', retryAfter: 30}, 502); }
    if (!response.ok) {
      const retryAfter = response.status === 429 ? retrySeconds(response.headers.get('Retry-After')) : [401, 403].includes(response.status) ? 300 : 30;
      if ([401, 403, 429].includes(response.status)) {
        budget.blockedUntil = Date.now() + retryAfter * 1000;
        await this.ctx.storage.put('budget', budget);
      }
      await response.body?.cancel();
      return output({error: 'VEX refresh unavailable', upstreamStatus: response.status, retryAfter}, response.status === 429 ? 429 : 502);
    }
    // Never expose headers, bearer tokens, or upstream error bodies.
    return new Response(response.body, {headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
  }
}

export class CompetitionCache {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.pending = null; }
  async fetch(request) {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!/^[1-9]\d{0,8}$/.test(id)) return output({error: 'Invalid event'}, 400);
    if (!this.pending) this.pending = this.snapshot(id).finally(() => { this.pending = null; });
    return output(await this.pending);
  }
  async upstream(path, page = 1) {
    const stub = this.env.VEX_BUDGET.get(this.env.VEX_BUDGET.idFromName('vex-global'));
    const response = await stub.fetch(new Request(`https://internal${path}?page=${page}`));
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Refresh unavailable'), {retryAfter: data.retryAfter || 30});
    return data;
  }
  async pages(path) {
    const rows = [], seen = new Set();
    let total, last;
    for (let page = 1; page <= 100; page++) {
      const payload = await this.upstream(path, page), meta = payload.meta;
      if (!Array.isArray(payload.data) || !meta || meta.current_page !== page || !Number.isInteger(meta.last_page) || meta.last_page < page || meta.last_page > 100 || !Number.isInteger(meta.total))
        throw new Error('Invalid pagination');
      if (page === 1) { total = meta.total; last = meta.last_page; }
      if (total !== meta.total || last !== meta.last_page) throw new Error('Collection changed during refresh');
      for (const row of payload.data) {
        if (!Number.isInteger(row.id) || seen.has(row.id)) throw new Error('Duplicate or invalid API row');
        rows.push(row); seen.add(row.id);
      }
      if (page === last) {
        if (rows.length !== total) throw new Error('Incomplete API data');
        return rows;
      }
      if (!payload.data.length) throw new Error('Incomplete API page');
    }
    throw new Error('Event exceeds pagination limit');
  }
  async resource(key, ttl, load) {
    let entry = await readDocument(this.ctx.storage, key);
    if (entry && (Date.now() - Date.parse(entry.fetchedAt) < ttl || entry.retryAt > Date.now()))
      return {...entry, stale: Date.now() - Date.parse(entry.fetchedAt) >= ttl};
    try {
      const data = await load();
      entry = {data, fetchedAt: stamp(), error: null, retryAt: 0};
    } catch (error) {
      entry = {...entry, error: 'Refresh failed; retaining last successful data', retryAt: Date.now() + (error.retryAfter || 30) * 1000};
    }
    await writeDocument(this.ctx.storage, key, entry);
    return {...entry, stale: !entry.fetchedAt || Date.now() - Date.parse(entry.fetchedAt) >= ttl};
  }
  async snapshot(id) {
    const event = await this.resource('event', 900000, async () => {
      const e = await this.upstream(`/events/${id}`);
      if (String(e.id) !== id || e.season?.id !== 204 || e.program?.id !== 1 || !Array.isArray(e.divisions)) throw new Error('Unsupported event');
      return {id: e.id, name: e.name, sku: e.sku, start: e.start, end: e.end,
        location: {city: e.location?.city, region: e.location?.region, country: e.location?.country},
        divisions: e.divisions.map(d => ({id: d.id, name: d.name}))};
    });
    if (!event.data) return {schemaVersion: 1, eventId: id, resources: {event}, state: 'unavailable', checkedAt: stamp()};
    const e = event.data;
    // UTC timestamps retain the event's offset. No Florida/US time-zone assumption.
    const now = Date.now(), start = Date.parse(e.start), end = Date.parse(e.end);
    const active = !Number.isFinite(start) || !Number.isFinite(end) || (now >= start - 86400000 && now <= end + 86400000);
    const dynamicTtl = active ? 30000 : 900000;
    const resources = {event};
    resources.teams = await this.resource('teams', active ? 300000 : 900000, async () =>
      (await this.pages(`/events/${id}/teams`)).map(t => ({id: t.id, number: t.number, team_name: t.team_name,
        location: {city: t.location?.city, region: t.location?.region, country: t.location?.country}})));
    // Put schedules first: they're more urgent than Skills while budget is limited.
    for (const kind of ['matches', 'rankings']) {
      resources[kind] = await this.resource(kind, dynamicTtl, async () => {
        const rows = [];
        for (const division of e.divisions) {
          if (!Number.isInteger(division.id) || division.id < 1) throw new Error('Invalid division');
          const page = await this.pages(`/events/${id}/divisions/${division.id}/${kind}`);
          if (page.some(r => String(r.event?.id) !== id || r.division?.id !== division.id)) throw new Error('Wrong event/division');
          rows.push(...page);
        }
        return rows;
      });
    }
    resources.skills = await this.resource('skills', active ? 60000 : 900000, () => this.pages(`/events/${id}/skills`));
    return {schemaVersion: 1, eventId: id, checkedAt: stamp(), active,
      state: Object.values(resources).some(r => r.stale || r.error) ? 'partial' : 'ok', resources};
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || 'https://vexoverride.com,https://www.vexoverride.com').split(',');
    if (origin && !allowed.includes(origin)) return output({error: 'Origin not allowed'}, 403);
    const headers = {'Access-Control-Allow-Origin': origin || allowed[0], 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store'};
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    const match = new URL(request.url).pathname.match(/^\/api\/events\/([1-9]\d{0,8})\/live$/);
    if (request.method !== 'GET' || !match) return new Response(JSON.stringify({error: 'Unknown route'}), {status: 404, headers});
    try {
      const stub = env.COMPETITIONS.get(env.COMPETITIONS.idFromName('season-204-event-' + match[1]));
      const result = await stub.fetch(new Request('https://internal/events/' + match[1]));
      return new Response(result.body, {status: result.status, headers: {...headers, 'Content-Type': 'application/json'}});
    } catch { return new Response(JSON.stringify({error: 'Live refresh unavailable'}), {status: 503, headers}); }
  },
};
