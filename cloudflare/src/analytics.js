export const DEVICES = ['desktop','mobile','tablet','unknown'];
export const METRICS = ['pageview','whatsapp','email','phone'];
const ZONE = 'Europe/Rome';
const DAY_MS = 86400000;
export function dayInRome(now=Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const get=k=>parts.find(p=>p.type===k).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function shiftDay(day, delta) {
  return new Date(Date.parse(day+'T12:00:00Z')+delta*DAY_MS).toISOString().slice(0,10);
}
export function deviceType(ua, hint) {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (hint==='tablet' && /Macintosh/i.test(ua))) return 'tablet';
  if (/Mobile|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'mobile';
  if (/Windows|Macintosh|Linux|X11|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}
export function browserType(ua) {
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/Edg(?:e|A|iOS)?\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Firefox\/|FxiOS\//i.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Altro';
}
export function sourceType(body, origin) {
  const campaign = String(body.source||'').toLowerCase();
  if (/^(ig|instagram)$/.test(campaign)) return 'Instagram';
  if (/^(fb|facebook)$/.test(campaign)) return 'Facebook';
  if (/^(wa|whatsapp)$/.test(campaign)) return 'WhatsApp';
  if (/^(google|googleads)$/.test(campaign)) return 'Google';
  if (/^(newsletter|email)$/.test(campaign)) return 'Newsletter';
  if (/^(tiktok)$/.test(campaign)) return 'TikTok';
  if (campaign) return 'Altra campagna';
  try {
    const ref = new URL(body.referrer||'');
    if (!['http:','https:'].includes(ref.protocol) || ref.origin===origin) return 'Diretto / interno';
    const host = ref.hostname.toLowerCase();
    if (/(^|\.)instagram\.com$/.test(host)) return 'Instagram';
    if (/(^|\.)(facebook\.com|fb\.com)$/.test(host)) return 'Facebook';
    if (/(^|\.)(google\.[a-z.]+|googleusercontent\.com)$/.test(host)) return 'Google';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'TikTok';
    if (/(^|\.)chatgpt\.com$/.test(host)) return 'ChatGPT';
    return host.length<=100 ? host : 'Altro sito';
  } catch { return 'Diretto / interno'; }
}
export function ignored(request) {
  const ua = request.headers.get('User-Agent') || '';
  return request.headers.get('DNT')==='1' || request.headers.get('Sec-GPC')==='1' || /bot|crawler|spider|headless|preview|facebookexternalhit|curl|wget|python|lighthouse/i.test(ua);
}
export function cleanEvent(request, body, now=Date.now()) {
  if (!body || typeof body!=='object' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.id||'')) throw new Error('invalid_event');
  if (!METRICS.includes(body.metric) || !['/','/index.html'].includes(body.path)) throw new Error('invalid_event');
  const country = String(request.cf?.country||'XX').toUpperCase();
  const ua = request.headers.get('User-Agent')||'';
  return {id:body.id,day:dayInRome(now),path:'/',country:/^[A-Z]{2}$/.test(country)?country:'XX',device:deviceType(ua,body.deviceHint),browser:browserType(ua),source:sourceType(body,new URL(request.url).origin),metric:body.metric,now};
}
export async function record(db, event) {
  const values = [event.day,event.path,event.country,event.device,event.browser,event.source,event.metric];
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO analytics_dedup(event_id,claimed,created_at) VALUES (?,0,?)').bind(event.id,event.now),
    db.prepare(`INSERT INTO analytics_counts(day,path,country,device,browser,source,metric,count)
      SELECT ?,?,?,?,?,?,?,1 WHERE EXISTS (SELECT 1 FROM analytics_dedup WHERE event_id=? AND claimed=0)
      ON CONFLICT(day,path,country,device,browser,source,metric) DO UPDATE SET count=count+1`).bind(...values,event.id),
    db.prepare('UPDATE analytics_dedup SET claimed=1 WHERE event_id=?').bind(event.id),
    db.prepare('DELETE FROM analytics_dedup WHERE created_at < ?').bind(event.now-2*DAY_MS)
  ]);
}
export function makeRange(search, now=Date.now()) {
  const days = Number(search.get('days')||'7');
  if (![1,7,30,90].includes(days)) throw new Error('invalid_range');
  const end = dayInRome(now), start = shiftDay(end,1-days);
  const country = search.get('country')||'', device = search.get('device')||'';
  if (country && !/^[A-Z]{2}$/.test(country)) throw new Error('invalid_country');
  if (device && !DEVICES.includes(device)) throw new Error('invalid_device');
  return {days,start,end,country,device,timezone:ZONE};
}
function group(rows,key,predicate=r=>r.metric==='pageview') {
  const sums = new Map();
  for (const row of rows) if (predicate(row)) sums.set(row[key],(sums.get(row[key])||0)+Number(row.count));
  return [...sums].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
}
export async function report(db, range) {
  const all = await db.prepare('SELECT day,path,country,device,browser,source,metric,count FROM analytics_counts WHERE day>=? AND day<=? ORDER BY day ASC').bind(range.start,range.end).all();
  const allRows = all.results||[];
  const rows = allRows.filter(r=>(!range.country||r.country===range.country)&&(!range.device||r.device===range.device));
  const views=rows.filter(r=>r.metric==='pageview'), clicks=rows.filter(r=>r.metric!=='pageview');
  const total = a=>a.reduce((n,r)=>n+Number(r.count),0);
  const pageviews=total(views), contactClicks=total(clicks);
  const daily=[];
  for (let i=0;i<range.days;i++) {
    const day=shiftDay(range.start,i);
    daily.push({day,pageviews:total(views.filter(r=>r.day===day)),contactClicks:total(clicks.filter(r=>r.day===day))});
  }
  const countries=group(rows,'country');
  return {range,updatedAt:new Date().toISOString(),summary:{pageviews,contactClicks,countries:countries.filter(c=>c.label!=='XX').length,mobileShare:pageviews?Math.round(100*total(views.filter(r=>r.device==='mobile'))/pageviews):0},daily,countries,devices:group(rows,'device'),browsers:group(rows,'browser'),sources:group(rows,'source'),pages:group(rows,'path'),contacts:group(rows,'metric',r=>r.metric!=='pageview'),availableCountries:group(allRows,'country').map(r=>r.label),rows};
}
export function toCSV(rows) {
  const safe=value=>{
    let text=String(value??'');
    if (/^[=+@\-\t\r]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  const header=['Giorno','Pagina','Paese','Dispositivo','Browser','Provenienza','Evento','Conteggio'];
  return '\ufeff'+[header,...rows.map(r=>[r.day,r.path,r.country,r.device,r.browser,r.source,r.metric,r.count])].map(row=>row.map(safe).join(';')).join('\r\n');
}
