const form=document.querySelector('#login-form');
form?.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button'),error=document.querySelector('#login-error');
  button.disabled=true;error.textContent='';
  try{
    const response=await fetch('/api/analytics/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({password:form.elements.password.value})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Accesso non riuscito.');
    form.elements.password.value='';
    try{if(localStorage.getItem('mm-stats-exclude-self')===null)localStorage.setItem('mm-stats-exclude-self','1');}catch{}
    location.replace('/statistiche');
  }catch(e){error.textContent=e.message==='Failed to fetch'?'Connessione non disponibile. Riprova.':e.message;button.disabled=false;}
});
