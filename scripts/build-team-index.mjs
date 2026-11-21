// Rebuilt with each data refresh; no per-user full-season crawl.
import { readFile, writeFile } from 'node:fs/promises';
import { competitionRegion } from '../v2/modules/competition-intel.js';
const root = new URL('../', import.meta.url);
const read = async p => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const index = await read('data/events/index.json');
const catalog = await read('data/events/catalog.json').catch(()=>({data:[]}));
const feeds = await Promise.all(['high-school','middle-school'].map(g=>read(`data/season-204/skills-${g}.json`).catch(()=>({data:[]}))));
const skills={data:feeds.flatMap(f=>f.data)};
const teams=new Map(), events=new Map(), regions=new Map();
for(const e of catalog.data) {const r=competitionRegion(e); events.set(String(e.id),{id:String(e.id),eventRegionName:r.name,eventRegionId:r.id,registeredTeams:[]});}
for(const e of [...index.events].sort((a,b)=>(a.updatedAt||'').localeCompare(b.updatedAt||''))) {
  const snapshot=await read(`data/events/${e.eventId}/teams.json`);
  const region=competitionRegion(e),numbers=[];
  for(const t of snapshot.data||[]) if(t.number && t.team_name) {
    numbers.push(t.number);
    const previous=teams.get(t.number);
    teams.set(t.number,{number:t.number,name:t.team_name,id:t.id,city:t.location?.city||'',
      region:t.location?.region||'',country:t.location?.country||'',grade:t.grade||'',
      eventRegionName:previous?.eventRegionName||'',eventRegionId:previous?.eventRegionId??null,
      events:[...(previous?.events||[]),String(e.eventId)]});
  }
  events.set(String(e.eventId),{id:String(e.eventId),eventRegionName:region.name,eventRegionId:region.id,
    registeredTeams:numbers,rosterUpdatedAt:e.updatedAt||null});
  if(region.name) regions.set(region.name,region.id);
}
for(const row of skills.data) {
  const t=row.team,previous=teams.get(t.team);
  teams.set(t.team,{...previous,number:t.team,name:t.teamName,id:t.id,city:t.city||'',region:t.region||'',
    country:t.country||'',grade:t.gradeLevel||'',eventRegionName:t.eventRegion||'',eventRegionId:t.eventRegionId??null,
    events:previous?.events||[]});
  if(t.eventRegion) regions.set(t.eventRegion,t.eventRegionId);
}
const result={updatedAt:index.updatedAt,coverage:'retrieved-event-rosters',
  catalogCount:catalog.data.length,rosterCount:index.events.length,
  regions:[...regions].map(([name,id])=>({name,id})).sort((a,b)=>a.name.localeCompare(b.name)),
  events:[...events.values()].map(e=>({...e,eventRegionName:e.eventRegionName||'',eventRegionId:e.eventRegionId??null})),
  teams:[...teams.values()].sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true}))};
const content=JSON.stringify(result)+'\n', target=new URL('v2/team-index.json',root);
if(process.argv.includes('--check')) {
 if(await readFile(target,'utf8')!==content) throw new Error('Team lookup is stale. Run npm run build:teams.');
} else {await writeFile(target,content);console.log(`Indexed ${result.teams.length} teams; ${result.rosterCount}/${result.catalogCount} event rosters; ${result.regions.length} competition regions.`);}
