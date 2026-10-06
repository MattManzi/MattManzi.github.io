import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.js';
import {record,report,makeRange,cleanEvent,dayInRome,deviceType,browserType,sourceType,toCSV} from '../src/analytics.js';
import {newSession,sessionCookie,authenticated,rateAllowed} from '../src/auth.js';

const origin='https://mattiamanzi.mattiamanzi.workers.dev';
const desktop='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const mobile='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
// Test fixture only; this is not a production password.
const password='fixture-only-password-for-tests';
const now=Date.parse('2026-10-06T12:00:00Z');
function database() {
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_analytics.sql',import.meta.url),'utf8'));
  const db={
    prepare(query){let values=[];return {bind(...v){values=v;return this;},async all(){return {results:sql.prepare(query).all(...values)};},execute(){return {results:sql.prepare(query).all(...values)};}};},
    async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}
  };
  return {db,sql,env:{DB:db,ANALYTICS_ADMIN_PASSWORD:password,ASSETS:{async fetch(request){return new Response(new URL(request.url).pathname==='/statistiche.html'?'<h1>Dashboard privata</h1>':'Portfolio',{headers:{'Content-Type':'text/html'}});}}}};
}
function request(path,options={}) {
  const {country='IT',ua=desktop,body,method=body?'POST':'GET',headers={}}=options;
  const req=new Request(origin+path,{method,headers:{'User-Agent':ua,'CF-Connecting-IP':'192.0.2.1',...(method==='POST'?{'Origin':origin,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  Object.defineProperty(req,'cf',{value:{country}});return req;
}
const event=(metric='pageview',extra={})=>({id:crypto.randomUUID(),path:'/',metric,...extra});
async function add(db,body,options={}){await record(db,cleanEvent(request('/api/analytics/collect',options),body,now));}
async function login(env){const response=await worker.fetch(request('/api/analytics/login',{body:{password}}),env);assert.equal(response.status,200);return response.headers.get('Set-Cookie').split(';')[0];}

test('conteggi aggregati, duplicati e filtri usano SQLite reale',async()=>{
  const {db}=database();const first=event();
  await add(db,first,{ua:mobile});await add(db,first,{ua:mobile});
  await add(db,event('pageview',{source:'instagram'}),{country:'MT'});
  await add(db,event('email'),{ua:mobile});
  const full=await report(db,makeRange(new URLSearchParams('days=7'),now));
  assert.equal(full.summary.pageviews,2);assert.equal(full.summary.contactClicks,1);assert.equal(full.summary.countries,2);assert.equal(full.summary.mobileShare,50);
  assert.equal(full.daily.length,7);assert.equal(full.daily.at(-1).pageviews,2);
  const filtered=await report(db,makeRange(new URLSearchParams('days=7&country=IT&device=mobile'),now));
  assert.equal(filtered.summary.pageviews,1);assert.equal(filtered.summary.contactClicks,1);assert.deepEqual(filtered.availableCountries.sort(),['IT','MT']);
});
test('lo stesso ID non può cambiare evento né aggiungere conteggi',async()=>{
  const {db}=database();const first=event();await add(db,first);await add(db,{...first,metric:'phone'});
  const result=await report(db,makeRange(new URLSearchParams(),now));assert.equal(result.summary.pageviews,1);assert.equal(result.summary.contactClicks,0);
});
test('accesso anonimo non legge statistiche e HTML riservato',async()=>{
  const {env}=database();
  assert.equal((await worker.fetch(request('/api/analytics/stats'),env)).status,401);
  for(const path of ['/statistiche','/statistiche/','/statistiche.html']){
    const response=await worker.fetch(request(path),env);assert.equal(response.status,200);const html=await response.text();assert.match(html,/login-form/);assert.doesNotMatch(html,/Dashboard privata/);assert.match(response.headers.get('Cache-Control'),/no-store/);
  }
});
test('login, cookie tecnico, lettura autorizzata e uscita',async()=>{
  const {env}=database();
  const bad=await worker.fetch(request('/api/analytics/login',{body:{password:'wrong'}}),env);assert.equal(bad.status,401);assert.equal(bad.headers.get('Set-Cookie'),null);
  const success=await worker.fetch(request('/api/analytics/login',{body:{password}}),env);assert.equal(success.status,200);const header=success.headers.get('Set-Cookie');
  assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);assert.doesNotMatch(header,new RegExp(password));
  const cookie=header.split(';')[0];
  const stats=await worker.fetch(request('/api/analytics/stats',{headers:{Cookie:cookie}}),env);assert.equal(stats.status,200);assert.equal((await stats.json()).summary.pageviews,0);
  const panel=await worker.fetch(request('/statistiche',{headers:{Cookie:cookie}}),env);assert.match(await panel.text(),/id="kpi-views"/);assert.match(panel.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  const logout=await worker.fetch(request('/api/analytics/logout',{method:'POST',headers:{Cookie:cookie}}),env);assert.equal(logout.status,200);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
});
test('sessioni manomesse, scadute o con password cambiata vengono respinte',async()=>{
  const {env}=database();const token=await newSession(password,now);
  assert.equal(await authenticated(request('/statistiche',{headers:{Cookie:sessionCookie(token)}}),env,now),true);
  assert.equal(await authenticated(request('/statistiche',{headers:{Cookie:sessionCookie(token+'x')}}),env,now),false);
  assert.equal(await authenticated(request('/statistiche',{headers:{Cookie:sessionCookie(token)}}),env,now+9*3600000),false);
  assert.equal(await authenticated(request('/statistiche',{headers:{Cookie:sessionCookie(token)}}),{...env,ANALYTICS_ADMIN_PASSWORD:'another-fixture-only-password'},now),false);
});
test('origini esterne e richieste troppo grandi non scrivono dati',async()=>{
  const {env,sql}=database();
  assert.equal((await worker.fetch(request('/api/analytics/collect',{body:event(),headers:{Origin:'https://other.example'}}),env)).status,403);
  assert.equal((await worker.fetch(request('/api/analytics/collect',{body:event(),headers:{'Sec-Fetch-Site':'cross-site'}}),env)).status,403);
  assert.equal((await worker.fetch(request('/api/analytics/collect',{body:event('pageview',{source:'x'.repeat(3000)})}),env)).status,400);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM analytics_counts').get().n,0);
});
test('bot, DNT, GPC e accessi dell’amministratore sono esclusi',async()=>{
  const {env,sql}=database();const cookie=await login(env);
  for(const options of [{ua:'Googlebot'},{headers:{DNT:'1'}},{headers:{'Sec-GPC':'1'}},{headers:{Cookie:cookie}}])assert.equal((await worker.fetch(request('/api/analytics/collect',{body:event(),...options}),env)).status,204);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM analytics_counts').get().n,0);
});
test('raccolta valida, CSV autorizzato e query non valide',async()=>{
  const {env,sql}=database();
  const response=await worker.fetch(request('/api/analytics/collect',{body:event('pageview',{source:'instagram'}),ua:mobile}),env);assert.equal(response.status,204);
  const row=sql.prepare('SELECT * FROM analytics_counts').get();assert.equal(row.count,1);assert.equal(row.device,'mobile');assert.equal(row.country,'IT');assert.equal(row.source,'Instagram');assert.ok(!('ip' in row));
  const cookie=await login(env);
  for(const query of ['days=180','days=0','country=IT%27%20OR%201%3D1','device=invalid'])assert.equal((await worker.fetch(request('/api/analytics/stats?'+query,{headers:{Cookie:cookie}}),env)).status,400);
  const csv=await worker.fetch(request('/api/analytics/stats?format=csv',{headers:{Cookie:cookie}}),env);assert.equal(csv.status,200);assert.match(csv.headers.get('Content-Type'),/text\/csv/);assert.match(await csv.text(),/Instagram/);
});
test('limite di tentativi login e marcatore IP non reversibile',async()=>{
  const {env,sql}=database();for(let i=0;i<8;i++)assert.equal((await worker.fetch(request('/api/analytics/login',{body:{password:'wrong'}}),env)).status,401);
  assert.equal((await worker.fetch(request('/api/analytics/login',{body:{password}}),env)).status,429);
  const rows=sql.prepare('SELECT key FROM analytics_rate_limits').all();assert.ok(rows.every(r=>!r.key.includes('192.0.2.1')));
  assert.equal(await rateAllowed(request('/api/analytics/login'),env,'login',8,900,Date.now()+1800000),true);
});
test('dati non configurati non vengono simulati con zeri',async()=>{
  const {env}=database();delete env.DB;
  assert.equal((await worker.fetch(request('/api/analytics/stats'),env)).status,503);
  assert.match(await (await worker.fetch(request('/statistiche'),env)).text(),/non è ancora attivo/);
  assert.equal(await (await worker.fetch(request('/'),env)).text(),'Portfolio');
});
test('date italiane, dispositivi, browser e provenienze',()=>{
  assert.equal(dayInRome(Date.parse('2026-10-05T22:30:00Z')),'2026-10-06');
  assert.equal(makeRange(new URLSearchParams('days=7'),Date.parse('2026-10-25T03:00:00Z')).start,'2026-10-19');
  assert.equal(deviceType('Mozilla/5.0 (iPad) Safari'),'tablet');assert.equal(deviceType('Mozilla/5.0 (Macintosh) Safari','tablet'),'tablet');assert.equal(deviceType(mobile),'mobile');assert.equal(deviceType(desktop),'desktop');
  assert.equal(browserType(desktop+' Edg/130.0'),'Edge');assert.equal(browserType(mobile+' Instagram'),'Instagram');
  assert.equal(sourceType({referrer:'https://l.instagram.com/?private=secret'},origin),'Instagram');assert.equal(sourceType({referrer:origin+'/?private=secret'},origin),'Diretto / interno');
  assert.equal(sourceType({source:'ig'},origin),'Instagram');assert.equal(sourceType({source:'private-value'},origin),'Altra campagna');
});
test('CSV neutralizza formule e conserva i campi con virgolette',()=>{
  const output=toCSV([{day:'2026-10-06',path:'/',country:'IT',device:'desktop',browser:'Chrome',source:'=HYPERLINK("x")',metric:'pageview',count:1}]);
  assert.ok(output.includes("'="));assert.ok(output.includes('""x""'));
});
