const $=id=>document.getElementById(id);
const integer=new Intl.NumberFormat('it-IT');
const regions=new Intl.DisplayNames(['it'],{type:'region'});
const deviceNames={desktop:'Computer',mobile:'Smartphone',tablet:'Tablet',unknown:'Non rilevato'};
const deviceColors={desktop:'#f5f5f5',mobile:'#aaa',tablet:'#666',unknown:'#404040'};
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):0;
const fmt=value=>integer.format(count(value));
const percent=(value,total)=>total?Math.round(100*count(value)/total):0;
const countryName=code=>{if(code==='XX')return 'Non rilevato';try{return regions.of(code)||code;}catch{return code;}};
const flag=code=>/^[A-Z]{2}$/.test(code)&&code!=='XX'?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'◌';
const dateLabel=day=>new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',timeZone:'Europe/Rome'}).format(new Date(day+'T12:00:00Z'));
let lastReport=null,controller=null,sequence=0;

function query() {
  const params=new URLSearchParams({days:$('period').value});
  if($('country-filter').value)params.set('country',$('country-filter').value);
  if($('device-filter').value)params.set('device',$('device-filter').value);
  return params;
}
function renderTrend(daily,total) {
  if(!total){$('trend-chart').innerHTML='<p class="empty">Nessuna visualizzazione per il periodo e i filtri selezionati.</p>';return;}
  const w=800,h=190,left=34,right=10,top=15,bottom=20;
  const max=Math.max(1,...daily.map(r=>count(r.pageviews)));
  const plotW=w-left-right,plotH=h-top-bottom;
  const points=daily.map((r,i)=>({x:daily.length===1?left+plotW/2:left+i*plotW/(daily.length-1),y:top+plotH*(1-count(r.pageviews)/max),value:count(r.pageviews),day:r.day}));
  const path=points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area=points.length>1?`${path} L${points.at(-1).x},${h-bottom} L${points[0].x},${h-bottom} Z`:'';
  const grid=[0,.5,1].map(f=>{const y=top+plotH*(1-f);return `<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" stroke="#3b3b3b" stroke-dasharray="3 5"/><text x="${left-10}" y="${y+4}" text-anchor="end" fill="#949494" font-family="Arial" font-size="10">${fmt(max*f)}</text>`;}).join('');
  const dots=points.length<=30?points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#eee"><title>${escapeHTML(dateLabel(p.day))}: ${fmt(p.value)} visualizzazioni</title></circle>`).join(''):'';
  $('trend-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Andamento delle visualizzazioni giornaliere"><title>Visualizzazioni nel periodo selezionato</title>${grid}${area?`<path d="${area}" fill="#ffffff08"/>`:''}<path d="${path}" fill="none" stroke="#eee" stroke-width="2" stroke-linejoin="round"/>${dots}</svg><div class="chart-axis"><span>${escapeHTML(dateLabel(daily[0].day))}</span><span>${escapeHTML(dateLabel(daily.at(-1).day))}</span></div>`;
}
function renderDevices(items,total) {
  const values=new Map(items.map(r=>[r.label,count(r.value)]));
  if(!total){$('device-chart').innerHTML='<p class="empty">Nessun dispositivo rilevato<br>nel periodo selezionato.</p>';$('device-legend').innerHTML='';return;}
  const radius=64,circumference=2*Math.PI*radius;
  let offset=0;
  const segments=Object.keys(deviceNames).map(key=>{
    const length=circumference*(values.get(key)||0)/total;
    if(!length)return '';
    const segment=`<circle cx="90" cy="90" r="${radius}" fill="none" stroke="${deviceColors[key]}" stroke-width="15" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"/>`;
    offset+=length;return segment;
  }).join('');
  $('device-chart').innerHTML=`<svg viewBox="0 0 180 180" role="img" aria-label="Visualizzazioni per tipo di dispositivo"><title>Dispositivi utilizzati per visitare il sito</title><circle cx="90" cy="90" r="64" fill="none" stroke="#333" stroke-width="15"/>${segments}<text x="90" y="87" text-anchor="middle" fill="#eee" font-family="Arial" font-size="26">${fmt(total)}</text><text x="90" y="108" text-anchor="middle" fill="#999" font-family="Arial" font-size="8">VISUALIZZAZIONI</text></svg>`;
  $('device-legend').innerHTML=Object.keys(deviceNames).map(key=>`<div class="device-item"><span><i aria-hidden="true"></i>${deviceNames[key]}</span><b>${percent(values.get(key)||0,total)}%</b></div>`).join('');
}
function render(data) {
  const total=count(data.summary.pageviews);
  $('kpi-views').textContent=fmt(total);
  $('kpi-countries').textContent=fmt(data.summary.countries);
  $('kpi-mobile').textContent=count(data.summary.mobileShare)+'%';
  $('kpi-contacts').textContent=fmt(data.summary.contactClicks);
  $('range-label').textContent=dateLabel(data.range.start)+' — '+dateLabel(data.range.end);
  renderTrend(data.daily,total);
  $('countries-table').innerHTML=data.countries.length?data.countries.map(r=>`<tr><td><span class="country-flag" aria-hidden="true">${flag(r.label)}</span>${escapeHTML(countryName(r.label))}</td><td>${fmt(r.value)}</td><td>${percent(r.value,total)}%</td></tr>`).join(''):'<tr><td colspan="3" class="empty">Nessun Paese da mostrare per questo periodo.</td></tr>';
  renderDevices(data.devices,total);
  $('browser-list').innerHTML=data.browsers.length?data.browsers.map(r=>`<div class="rank-row"><span>${escapeHTML(r.label)}</span><span>${fmt(r.value)} · ${percent(r.value,total)}%</span></div>`).join(''):'<p class="empty">Nessun browser rilevato.</p>';
  const sources=data.sources.slice(0,20);
  const remaining=data.sources.slice(20).reduce((sum,r)=>sum+count(r.value),0);
  if(remaining)sources.push({label:'Altre provenienze',value:remaining});
  $('source-list').innerHTML=sources.length?sources.map(r=>`<div class="source-row"><span>${escapeHTML(r.label)}</span><svg class="source-bar" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="5" fill="#363636"/><rect width="${total?100*count(r.value)/total:0}" height="5" fill="#bdbdbd"/></svg><span>${fmt(r.value)} · ${percent(r.value,total)}%</span></div>`).join(''):'<p class="empty">Le provenienze saranno visibili dopo le prime visite.</p>';
  const contacts=new Map(data.contacts.map(r=>[r.label,count(r.value)]));
  $('contact-list').innerHTML=[['whatsapp','WhatsApp'],['email','Email'],['phone','Telefono']].map(([key,label])=>`<article><span>${label} ↗</span><strong>${fmt(contacts.get(key)||0)}</strong><small>Clic</small></article>`).join('');
  const selected=$('country-filter').value;
  $('country-filter').innerHTML='<option value="">Tutti i Paesi</option>'+data.availableCountries.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(countryName(c))}</option>`).join('');
  $('country-filter').value=selected;
  $('reset-filters').hidden=!selected&&!$('device-filter').value;
  const time=new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'}).format(new Date(data.updatedAt));
  $('live-status').textContent='Raccolta attiva · aggiornato alle '+time;
  $('export').disabled=false;
}
function clearPanels(message) {
  for(const key of ['views','countries','mobile','contacts'])$('kpi-'+key).textContent='—';
  $('range-label').textContent='—';
  const placeholder='<p class="empty">'+escapeHTML(message)+'</p>';
  for(const id of ['trend-chart','device-chart','browser-list','source-list','contact-list'])$(id).innerHTML=placeholder;
  $('countries-table').innerHTML='<tr><td colspan="3" class="empty">'+escapeHTML(message)+'</td></tr>';
  $('device-legend').innerHTML='';
}
function showError(message) {
  $('error-banner').textContent=message;$('error-banner').hidden=false;
  $('live-status').textContent='Dati non aggiornati';$('export').disabled=true;
  if(!lastReport)clearPanels('Dati non disponibili. Premi Aggiorna per riprovare.');
}
async function load() {
  const current=++sequence;
  controller?.abort();controller=new AbortController();
  $('refresh').disabled=true;$('error-banner').hidden=true;$('live-status').textContent='Aggiornamento dei dati…';$('export').disabled=true;
  if(!lastReport)clearPanels('Caricamento…');
  try {
    const response=await fetch('/api/analytics/stats?'+query(),{credentials:'same-origin',signal:controller.signal,cache:'no-store'});
    if(response.status===401){location.replace('/statistiche');return;}
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Impossibile caricare i dati.');
    if(current!==sequence)return;
    lastReport=data;render(data);
  }catch(error){if(error.name!=='AbortError'&&current===sequence)showError(error.message==='Failed to fetch'?'Connessione non disponibile. Riprova.':error.message);}
  finally{if(current===sequence)$('refresh').disabled=false;}
}
for(const id of ['period','country-filter','device-filter'])$(id).addEventListener('change',()=>{lastReport=null;load();});
$('refresh').addEventListener('click',load);
$('reset-filters').addEventListener('click',()=>{$('country-filter').value='';$('device-filter').value='';lastReport=null;load();});
$('export').addEventListener('click',async()=>{
  const reportToExport=lastReport;
  if(!reportToExport)return;
  const exportSequence=sequence;
  const params=query();params.set('format','csv');
  $('export').disabled=true;
  try{
    const response=await fetch('/api/analytics/stats?'+params,{credentials:'same-origin',cache:'no-store'});
    if(response.status===401){location.replace('/statistiche');return;}
    if(!response.ok)throw new Error('Esportazione non riuscita. Riprova.');
    const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
    link.href=url;link.download=`statistiche-${reportToExport.range.start}-${reportToExport.range.end}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){if(exportSequence===sequence)showError(e.message);}finally{if(lastReport&&exportSequence===sequence)$('export').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
  try{const response=await fetch('/api/analytics/logout',{method:'POST',credentials:'same-origin'});if(!response.ok&&response.status!==401)throw new Error('Uscita non riuscita. Riprova.');location.replace('/statistiche');}catch(e){showError(e.message);}
});
try{$('exclude-self').checked=localStorage.getItem('mm-stats-exclude-self')==='1';}catch{$('exclude-self').disabled=true;$('exclusion-note').textContent='La preferenza non può essere salvata in questo browser. Gli accessi autenticati sono sempre esclusi.';}
$('exclude-self').addEventListener('change',()=>{
  try{localStorage.setItem('mm-stats-exclude-self',$('exclude-self').checked?'1':'0');$('exclusion-note').textContent=$('exclude-self').checked?'Questo browser resterà escluso anche dopo l’uscita dal pannello.':'Dopo l’uscita dal pannello, le visite di questo browser verranno conteggiate.';}catch{$('exclusion-note').textContent='Impossibile salvare la preferenza. Gli accessi autenticati sono sempre esclusi.';}
});
load();
