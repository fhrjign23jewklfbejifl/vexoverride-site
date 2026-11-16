import test from 'node:test';
import assert from 'node:assert/strict';
import {CompetitionCache, VexRequestBudget, readDocument, writeDocument, retrySeconds} from '../workers/competition-live.js';
import {mergeOfficialEvent, matchState, officialSchedule, freshnessLabel} from '../v2/modules/live.js';

class Storage {
  data = new Map();
  async get(k) { return structuredClone(this.data.get(k)); }
  async put(k,v) { this.data.set(k,structuredClone(v)); }
  async delete(k) { this.data.delete(k); }
  async transaction(fn) { return fn(this); }
}
const page = (data, current=1, last=1, total=data.length) => ({data,meta:{current_page:current,last_page:last,total}});
test('Large cached events survive chunking and replace old chunks', async()=>{
  const storage=new Storage(), value={data:'机器人'.repeat(100000)};
  await writeDocument(storage,'matches',value);
  assert.deepEqual(await readDocument(storage,'matches'),value);
  await writeDocument(storage,'matches',{data:[]});
  assert.equal(storage.data.size,2);
});
test('Pagination fetches beyond 250 and rejects duplicate/truncated data',async()=>{
  const cache=new CompetitionCache({storage:new Storage()},{});
  cache.upstream=async(_,p)=>page(Array.from({length:p===1?250:51},(_,i)=>({id:(p-1)*250+i})),p,2,301);
  assert.equal((await cache.pages('/events/1/teams')).length,301);
  cache.upstream=async(_,p)=>page([{id:1}],p,2,2);
  await assert.rejects(cache.pages('/events/1/teams'),/Duplicate/);
});
test('Concurrent viewers of one event share a single refresh',async()=>{
  const cache=new CompetitionCache({storage:new Storage()},{});let calls=0,finish;
  cache.snapshot=()=>{calls++;return new Promise(r=>{finish=r;});};
  const req=new Request('https://internal/events/1');
  const one=cache.fetch(req),two=cache.fetch(req);
  finish({ok:true});await Promise.all([one,two]);assert.equal(calls,1);
});
test('Failed refresh retains successful rows and timestamp; retry pause prevents a stampede',async()=>{
  const cache=new CompetitionCache({storage:new Storage()},{});
  await writeDocument(cache.ctx.storage,'matches',{data:[{id:1}],fetchedAt:'2020-01-01T00:00:00Z'});
  let calls=0;const fail=async()=>{calls++;throw Object.assign(new Error('fail'),{retryAfter:600});};
  const first=await cache.resource('matches',30000,fail),second=await cache.resource('matches',30000,fail);
  assert.equal(calls,1);assert.equal(first.fetchedAt,'2020-01-01T00:00:00Z');assert.deepEqual(second.data,[{id:1}]);assert.equal(first.stale,true);
});
test('Successful empty API result removes cancelled published matches',async()=>{
  const old={id:'1',matches:[{id:7}],skills:[],teams:[]};
  const next=mergeOfficialEvent(old,{schemaVersion:1,eventId:'1',state:'ok',resources:{matches:{data:[],fetchedAt:new Date().toISOString()}}});
  assert.deepEqual(next.matches,[]);assert.equal(old.matches.length,1);
});
test('Refresh preserves local event context and does not accept another event',()=>{
  const old={id:'1',teams:[],skills:[],matches:[{id:7}],custom:'retained'};
  const next=mergeOfficialEvent(old,{schemaVersion:1,eventId:'1',resources:{matches:{error:true,stale:true}}});
  assert.equal(next.custom,'retained');assert.equal(next.matches.length,1);
  assert.throws(()=>mergeOfficialEvent(old,{schemaVersion:1,eventId:'2',resources:{}}));
});
test('Nonzero scores with scored=false remain unconfirmed; zero-zero is not automatically a tie',()=>{
  assert.match(matchState({scored:false,alliances:[{score:50}]}),/unconfirmed/);
  assert.equal(matchState({scored:false,alliances:[{score:0}]}),'Scheduled');
  assert.equal(matchState({scored:true,alliances:[{score:0}]}),'Final');
});
test('Schedule filters any team and orders timestamps across time zones',()=>{
  const event={matches:[{id:1,scheduled:'2026-11-10T10:00:00+09:00',alliances:[{color:'red',teams:[{team:{name:'999A'}}]}]},
    {id:2,scheduled:'2026-11-09T21:00:00-05:00',alliances:[{color:'blue',teams:[{team:{name:'999A'}}]}]}]};
  assert.deepEqual(officialSchedule(event,'999A').map(m=>m.id),[1,2]);
  assert.equal(officialSchedule(event,'111B').length,0);
});
test('Old cached responses cannot display a fresh status after a successful browser request',()=>{
  assert.match(freshnessLabel({liveState:'ok',freshness:{matches:{fetchedAt:'2020-01-01T00:00:00Z'}}}),/Delayed/);
});
test('Global request budget is shared and persists through object recreation',async()=>{
  const storage=new Storage(),env={VEX_EVENTS_TOKEN:'test-only',VEX_REQUESTS_PER_MINUTE:'1'};
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json(page([]));};
  try {
    const first=new VexRequestBudget({storage},env);assert.equal((await first.fetch(new Request('https://internal/events/1'))).status,200);
    const second=new VexRequestBudget({storage},env);assert.equal((await second.fetch(new Request('https://internal/events/2'))).status,429);
    assert.equal(calls,1);
  } finally {globalThis.fetch=original;}
});
test('Authentication failures stop subsequent upstream requests without exposing credentials',async()=>{
  const storage=new Storage(),cache=new VexRequestBudget({storage},{VEX_EVENTS_TOKEN:'test-only'});
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('private response',{status:401});};
  try {
    const first=await cache.fetch(new Request('https://internal/events/1'));assert.equal(first.status,502);
    assert.ok(!(await first.text()).includes('private response'));
    assert.equal((await cache.fetch(new Request('https://internal/events/2'))).status,429);assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
test('Retry-After supports seconds and HTTP dates',()=>{
  assert.equal(retrySeconds('600'),600);assert.equal(retrySeconds('Wed, 01 Jan 2020 00:10:00 GMT',Date.parse('2020-01-01T00:00:00Z')),600);
});
