import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dashboardPage} from '../src/dashboard.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function dashboard(fetch) {
  const nodes=new Map([...dashboardPage.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}]));
  nodes.get('period').value='7';
  const context=vm.createContext({Intl,URL,URLSearchParams,AbortController,console,fetch,setTimeout,localStorage:{getItem(){return null;},setItem(){}},location:{replace(){}},document:{getElementById:id=>nodes.get(id)}});
  vm.runInContext(readFileSync(new URL('../public/stats.js',import.meta.url),'utf8'),context);
  return nodes;
}
const report={summary:{pageviews:12,countries:1,mobileShare:100,contactClicks:2},range:{start:'2026-10-06',end:'2026-10-06'},daily:[{day:'2026-10-06',pageviews:12}],countries:[{label:'IT',value:12}],devices:[{label:'mobile',value:12}],browsers:[{label:'Safari',value:12}],sources:[{label:'Instagram',value:12}],contacts:[{label:'email',value:2}],availableCountries:['IT'],updatedAt:'2026-10-06T12:00:00Z'};
test('un errore dopo il cambio filtro non lascia grafici del periodo precedente',async()=>{
  let calls=0, reject;
  const nodes=dashboard(async()=>{
    if(++calls===1)return Response.json(report);
    return new Promise((resolve,failure)=>{reject=failure;});
  });
  await settle();
  assert.equal(nodes.get('kpi-views').textContent,'12');
  assert.match(nodes.get('countries-table').innerHTML,/Italia/);
  nodes.get('country-filter').value='MT';nodes.get('country-filter').listeners.change();
  assert.equal(nodes.get('kpi-views').textContent,'—');
  assert.doesNotMatch(nodes.get('countries-table').innerHTML,/Italia/);
  reject(new TypeError('Failed to fetch'));await settle();
  assert.match(nodes.get('trend-chart').innerHTML,/Dati non disponibili/);
  assert.match(nodes.get('error-banner').textContent,/Connessione non disponibile/);
  assert.equal(nodes.get('export').disabled,true);
});
test('etichette di provenienza e browser non possono inserire HTML nella dashboard',async()=>{
  const nodes=dashboard(async()=>Response.json({...report,sources:[{label:'<img src=x onerror=alert(1)>',value:12}],browsers:[{label:'<script>alert(1)</script>',value:12}]}));
  await settle();
  assert.match(nodes.get('source-list').innerHTML,/&lt;img/);
  assert.doesNotMatch(nodes.get('source-list').innerHTML,/<img/);
  assert.doesNotMatch(nodes.get('browser-list').innerHTML,/<script/);
});

function tracker({visible='visible',excluded=false,dnt=false}={}) {
  const listeners={},events=[];
  const document={visibilityState:visible,referrer:'https://l.instagram.com/private?secret=example',addEventListener(type,fn){listeners[type]=fn;}};
  const context=vm.createContext({URL,URLSearchParams,crypto,document,location:{pathname:'/',search:'?utm_source=instagram'},navigator:{doNotTrack:dnt?'1':'0',userAgent:'Macintosh',maxTouchPoints:0},localStorage:{getItem(){return excluded?'1':null;}},fetch(url,options){events.push(JSON.parse(options.body));return Promise.resolve(new Response(null,{status:204}));}});
  vm.runInContext(readFileSync(new URL('../public/analytics.js',import.meta.url),'utf8'),context);
  return {events,document,listeners};
}
test('una scheda inizialmente nascosta invia un solo accesso quando diventa visibile',()=>{
  const {events,document,listeners}=tracker({visible:'hidden'});
  assert.equal(events.length,0);document.visibilityState='visible';listeners.visibilitychange();listeners.visibilitychange();
  assert.equal(events.length,1);assert.equal(events[0].metric,'pageview');assert.equal(events[0].referrer,'https://l.instagram.com');
});
test('il tracker rispetta la preferenza locale e Do Not Track',()=>{
  assert.equal(tracker({excluded:true}).events.length,0);assert.equal(tracker({dnt:true}).events.length,0);
});
