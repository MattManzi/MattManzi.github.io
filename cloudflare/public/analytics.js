(() => {
  if (!['/','/index.html'].includes(location.pathname)) return;
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;
  try { if (localStorage.getItem('mm-stats-exclude-self') === '1') return; } catch {}
  const source=(new URLSearchParams(location.search).get('utm_source')||'').slice(0,100);
  const referrer=document.referrer?(() => {try{return new URL(document.referrer).origin;}catch{return '';}})():'';
  const deviceHint=/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1?'tablet':'';
  function send(metric) {
    const id=crypto.randomUUID?.();
    if (!id) return;
    const body=JSON.stringify({id,path:location.pathname,metric,source,referrer,deviceHint});
    fetch('/api/analytics/collect',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body,keepalive:true}).catch(()=>{});
  }
  let sent=false;
  function view() { if (!sent && document.visibilityState==='visible') {sent=true;send('pageview');} }
  view();
  document.addEventListener('visibilitychange',view);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if (!link) return;
    const href=link.getAttribute('href');
    if (href.startsWith('mailto:')) send('email');
    else if (href.startsWith('tel:')) send('phone');
    else {try{if (new URL(link.href).hostname==='wa.me') send('whatsapp');}catch{}}
  });
})();
