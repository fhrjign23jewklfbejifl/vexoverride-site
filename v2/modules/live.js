// Public competition records never overwrite private notes, picks, or practice records.
export function mergeOfficialEvent(previous, payload) {
  if (payload?.schemaVersion !== 1 || String(payload.eventId) !== previous.id || !payload.resources)
    throw new Error('The live service returned a different event.');
  const r = payload.resources, next = structuredClone(previous);
  const meta = r.event?.data;
  if (meta) {
    if (String(meta.id) !== previous.id) throw new Error('Event identity mismatch.');
    next.name = meta.name;
    next.date = meta.start || '';
    next.location = [meta.location?.city, meta.location?.region, meta.location?.country].filter(Boolean).join(', ');
  }
  if (Array.isArray(r.teams?.data)) next.teams = r.teams.data.map(t => ({id: t.id,
    number: String(t.number || '').toUpperCase(), name: t.team_name || '',
    location: [t.location?.city, t.location?.region, t.location?.country].filter(Boolean).join(', ')}));
  for (const key of ['matches', 'rankings', 'skills']) {
    if (Array.isArray(r[key]?.data)) next[key] = r[key].data;
  }
  next.freshness = {...next.freshness};
  for (const [key, value] of Object.entries(r)) next.freshness[key] = {
    fetchedAt: value.fetchedAt || previous.freshness?.[key]?.fetchedAt || null,
    stale: !!value.stale, error: !!value.error,
  };
  next.liveState = payload.state;
  next.liveActive = payload.active;
  next.liveCheckedAt = payload.checkedAt;
  next.source = 'synced';
  return next;
}

export function matchState(match) {
  if (match.scored === true) return 'Final';
  // VEX can report nonzero scores with scored=false. Preserve ambiguity, not a fictitious win/loss.
  if (match.alliances?.some(a => Number.isFinite(a.score) && a.score > 0)) return 'Score reported · completion unconfirmed';
  if (match.started) return 'Started · result unconfirmed';
  return 'Scheduled';
}

export function matchTeams(match, color) {
  return (match.alliances?.find(a => a.color === color)?.teams || [])
    .filter(t => !t.sitting).map(t => t.team?.name || '').filter(Boolean);
}

export function officialSchedule(event, team = '') {
  return [...(event.matches || [])].filter(m => !team || ['red', 'blue'].some(c => matchTeams(m, c).includes(team)))
    .sort((a, b) => (Date.parse(a.scheduled) || Infinity) - (Date.parse(b.scheduled) || Infinity) || a.id - b.id);
}

export function freshnessLabel(event, now = Date.now(), resource = 'matches') {
  const value = event.freshness?.[resource];
  const time = Date.parse(value?.fetchedAt || event.sourceUpdatedAt || '');
  const age = Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 1000)) : null;
  const ageText = age == null ? 'Update time unknown' : age < 60 ? `Checked ${age}s ago` : age < 3600 ? `Checked ${Math.floor(age / 60)}m ago` : `Checked ${Math.floor(age / 3600)}h ago`;
  const stale = value?.stale || value?.error || (age != null && age > (event.liveActive === false ? 960 : 120));
  return `${event.liveState ? stale ? 'Delayed' : 'Auto-refresh' : 'Saved snapshot'} · ${ageText}`;
}

let configPromise;
export function liveConfig() {
  return configPromise ||= fetch(new URL('../live-config.json', import.meta.url), {cache: 'no-store'})
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .catch(() => ({baseUrl: '', pollMs: 30000}));
}
export async function refreshOfficial(event, {signal} = {}) {
  const config = await liveConfig();
  if (!config.baseUrl) throw new Error('Live service is not connected. Showing saved competition data.');
  const base = new URL(config.baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Invalid live service configuration.');
  const response = await fetch(new URL(`/api/events/${encodeURIComponent(event.id)}/live`, base),
    {cache: 'no-store', signal: signal || AbortSignal.timeout(55000)});
  if (!response.ok) throw new Error('Live refresh unavailable. Your saved data is unchanged.');
  const payload = await response.json();
  if (payload.state === 'unavailable') throw new Error('VEX event data is temporarily unavailable.');
  return mergeOfficialEvent(event, payload);
}
