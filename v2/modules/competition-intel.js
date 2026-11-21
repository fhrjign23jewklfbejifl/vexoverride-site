// Official competition regions are independent of geographic state/province.
export function competitionRegion(event = {}) {
  const r = event.event_region || event.eventRegion;
  return {id: event.eventRegionId ?? event.event_region_id ?? r?.id ?? null,
    name: event.eventRegionName || event.event_region_name || (typeof r === 'string' ? r : r?.name) || ''};
}
export function registeredEvents(events, team) {
  return events.filter(e => (e.registeredTeams || (Array.isArray(e.teams) ? e.teams.map(t => t.number) : [])).includes(team));
}
export function filterEvents(events, {query = '', region = '', team = '', mine = false} = {}) {
  const q = query.trim().toLowerCase();
  return events.filter(e => (!region || (region === 'unknown' ? !e.eventRegionName : e.eventRegionName === region)) &&
    (!mine || registeredEvents([e], team).length) &&
    [e.name, e.location, e.code, e.eventRegionName, e.id].join(' ').toLowerCase().includes(q));
}

export function applyTeamRegistrations(catalog,number,events,checkedAt='') {
 const newer=e=>checkedAt&&Date.parse(e.rosterUpdatedAt||'')>Date.parse(checkedAt);
 const rows=catalog.map(e=>({...e,registeredTeams:(e.registeredTeams||(Array.isArray(e.teams)?e.teams.map(t=>t.number):[])).filter(t=>t!==number||newer(e))})),byId=new Map(rows.map(e=>[e.id,e]));
 for(const raw of events) {
  if(!Number.isInteger(raw.id)||typeof raw.start!=='string')continue;
  const id=String(raw.id),existing=byId.get(id),region=competitionRegion(raw);
  if(existing&&newer(existing))continue;
  const row={...existing,id,name:raw.name,code:raw.sku||'',date:raw.start,end:raw.end||raw.start,location:[raw.location?.city,raw.location?.region].filter(Boolean).join(', '),eventRegionName:region.name||existing?.eventRegionName||'',registeredTeams:[...new Set([...(existing?.registeredTeams||[]),number])]};
  if(existing)Object.assign(existing,row);else{rows.push(row);byId.set(id,row);}
 }
 return rows;
}
