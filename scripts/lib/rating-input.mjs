import {createHash} from 'node:crypto';
// Keep every field used to verify a result. A fingerprint preserves conflict
// detection even when two duplicate records differ only in discarded metadata.
export function compactRatingInput(input){
 return {...input,teams:input.teams.map(({number,name,id,country,grade,eventRegionName,eventRegionId})=>({number,name,id,country,grade,eventRegionName,eventRegionId})),events:input.events.map(e=>({...e,rankings:(e.rankings||[]).map(({division,team,wins,losses,ties,ap,sp,total_points,high_score})=>({division:division?{id:division.id}:undefined,team:team?{number:team.number,name:team.name,team:team.team}:undefined,wins,losses,ties,ap,sp,total_points,high_score})),awards:e.awards?.map(a=>({title:a.title,teamWinners:a.teamWinners?.map(w=>({team:w.team?{number:w.team.number,name:w.team.name,team:w.team.team}:w}))}))??null,matches:(e.matches||[]).map(m=>({
  id:m.id,division:m.division?{id:m.division.id}:undefined,round:m.round,instance:m.instance,matchnum:m.matchnum,
  scored:m.scored,started:m.started,scheduled:m.scheduled,
  alliances:(m.alliances||[]).map(a=>({color:a.color,score:a.score,teams:(a.teams||[]).map(t=>({sitting:t.sitting,extra:t.extra,dq:t.dq,disqualified:t.disqualified,team:t.team?{number:t.team.number,name:t.team.name,team:t.team.team}:undefined}))})),
  sourceFingerprint:createHash('sha256').update(JSON.stringify(m)).digest('hex'),
 }))}))};
}
