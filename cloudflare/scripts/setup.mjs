import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const command=process.platform==='win32'?'npx.cmd':'npx';
function wrangler(args) {
  const result=spawnSync(command,['wrangler',...args],{stdio:'inherit',shell:process.platform==='win32'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
const config=JSON.parse(readFileSync('wrangler.json','utf8'));
console.log('Attivazione statistiche sul Worker '+config.name+'.');
console.log('La password del pannello verrà chiesta in modo interattivo; non viene salvata nel progetto.');
wrangler(['login']);
if(!config.d1_databases?.some(item=>item.binding==='DB'&&item.database_id)) {
  wrangler(['d1','create','mattia-site-analytics','--binding','DB','--update-config','--jurisdiction','eu']);
}
wrangler(['d1','migrations','apply','DB','--remote']);
console.log('Scegli una password riservata al pannello, con almeno 16 caratteri.');
wrangler(['secret','put','ANALYTICS_ADMIN_PASSWORD']);
wrangler(['deploy']);
console.log('Pubblicazione completata. Apri:');
console.log('https://'+config.name+'.mattiamanzi.workers.dev/statistiche');
