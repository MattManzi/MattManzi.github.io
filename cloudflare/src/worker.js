import {configurationIssues,authenticated,newSession,sessionCookie,clearCookie,sameOrigin,safeEqual,rateAllowed} from './auth.js';
import {ignored,cleanEvent,record,makeRange,report,toCSV} from './analytics.js';
import {loginPage} from './login.js';
import {dashboardPage} from './dashboard.js';
import {ensureSchema} from './database.js';

const PRIVATE_HEADERS = {
  'Cache-Control':'no-store', 'Vary':'Cookie',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
function json(body,status=200,extra={}) {
  return new Response(JSON.stringify(body),{status,headers:{...PRIVATE_HEADERS,'Content-Type':'application/json; charset=utf-8',...extra}});
}
function empty(status=204) { return new Response(null,{status,headers:{'Cache-Control':'no-store'}}); }
async function readJSON(request) {
  if (!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json')) throw new Error('invalid_body');
  if (Number(request.headers.get('Content-Length'))>2048) throw new Error('invalid_body');
  const reader=request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  const decoder=new TextDecoder(); let size=0, text='';
  for (;;) {
    const {done,value}=await reader.read();
    if (done) break;
    size+=value.byteLength;
    if (size>2048) { await reader.cancel(); throw new Error('invalid_body'); }
    text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  try { return JSON.parse(text); } catch { throw new Error('invalid_body'); }
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url), path=url.pathname;
    const isPanel=path==='/statistiche'||path==='/statistiche/'||path==='/statistiche.html';
    const isAPI=path.startsWith('/api/analytics/');
    if (!isPanel && !isAPI) return env.ASSETS.fetch(request);
    try {
      const issues=configurationIssues(env),ready=issues.length===0;
      if (ready) await ensureSchema(env.DB);
      if (isPanel) {
        if (!['GET','HEAD'].includes(request.method)) return json({error:'Metodo non consentito.'},405);
        if (!ready || !await authenticated(request,env)) return new Response(request.method==='HEAD'?null:loginPage(ready,issues),{status:ready?200:503,headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8'}});
        return new Response(request.method==='HEAD'?null:dashboardPage,{headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8'}});
      }
      if (!ready) return json({error:'La raccolta delle statistiche non è ancora attiva.'},503);
      if (path==='/api/analytics/collect') {
        if (request.method!=='POST') return json({error:'Metodo non consentito.'},405);
        if (!sameOrigin(request)) return json({error:'Richiesta non consentita.'},403);
        if (ignored(request)||await authenticated(request,env)) return empty();
        const event=cleanEvent(request,await readJSON(request));
        if (!await rateAllowed(request,env,'collect',120,60)) return empty(429);
        await record(env.DB,event);
        return empty();
      }
      if (path==='/api/analytics/login') {
        if (request.method!=='POST') return json({error:'Metodo non consentito.'},405);
        if (!sameOrigin(request)) return json({error:'Richiesta non consentita.'},403);
        if (!await rateAllowed(request,env,'login',8,900)) return json({error:'Troppi tentativi. Riprova tra 15 minuti.'},429);
        const body=await readJSON(request);
        if (typeof body?.password!=='string' || body.password.length>1024 || !await safeEqual(body.password,env.ANALYTICS_ADMIN_PASSWORD)) return json({error:'Password non corretta.'},401);
        return json({ok:true},200,{'Set-Cookie':sessionCookie(await newSession(env.ANALYTICS_ADMIN_PASSWORD))});
      }
      if (!await authenticated(request,env)) return json({error:'Accedi per vedere le statistiche.'},401);
      if (path==='/api/analytics/logout') {
        if (request.method!=='POST') return json({error:'Metodo non consentito.'},405);
        if (!sameOrigin(request)) return json({error:'Richiesta non consentita.'},403);
        return json({ok:true},200,{'Set-Cookie':clearCookie()});
      }
      if (path==='/api/analytics/stats') {
        if (request.method!=='GET') return json({error:'Metodo non consentito.'},405);
        const data=await report(env.DB,makeRange(url.searchParams));
        if (url.searchParams.get('format')==='csv') return new Response(toCSV(data.rows),{headers:{...PRIVATE_HEADERS,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="statistiche-${data.range.start}-${data.range.end}.csv"`}});
        const {rows,...summary}=data;
        return json(summary);
      }
      return json({error:'Pagina non trovata.'},404);
    } catch(error) {
      if (/^invalid_/.test(error.message)) return json({error:'Controlla i dati della richiesta.'},400);
      // Avoid logging URLs, passwords, cookies, IPs or full user agents.
      console.error('analytics_request_failed');
      return json({error:'Le statistiche non sono disponibili in questo momento. Riprova più tardi.'},503);
    }
  }
};
