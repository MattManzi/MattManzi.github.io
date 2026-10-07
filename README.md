# Mattia Manzi — Portfolio e statistiche

Portfolio in italiano con Canestrini Wine, Malta Parties e BossBabe, palette antracite e titoli serif. La versione Cloudflare comprende una dashboard privata per visualizzazioni, Paesi, dispositivi, provenienze e clic sui contatti.

## Pubblicazione dal repository su Cloudflare

Le impostazioni del Worker `mattiamanzi` possono restare:

- Directory radice: `/`
- Comando di compilazione: nessuno
- Comando di distribuzione: `npx wrangler deploy`

Il file `wrangler.json` alla radice indirizza la pubblicazione a `cloudflare/src/worker.js` e carica come risorse pubbliche soltanto `cloudflare/public/`. Il `package.json` fissa Wrangler alla versione 4.147.0. Il resto dei file del repository non è pubblicato come risorsa del Worker.

Wrangler crea o collega il database D1 `mattia-site-analytics`, esposto al Worker come `DB`. Lo schema iniziale viene preparato automaticamente alla prima richiesta alle statistiche, con comandi `CREATE IF NOT EXISTS` che conservano i conteggi già presenti.

Per attivare il pannello apri il Worker su Cloudflare e vai in **Impostazioni → Variabili e segreti → Aggiungi**. Scegli il tipo **Segreto**, il nome esatto `ANALYTICS_ADMIN_PASSWORD` e una password di almeno 16 caratteri. Salva e distribuisci la modifica. Non inserire la password nel codice o in chat.

Dopo la pubblicazione riuscita:

- Portfolio: https://mattiamanzi.mattiamanzi.workers.dev/
- Statistiche: https://mattiamanzi.mattiamanzi.workers.dev/statistiche

Il link con prefisso `5382ffad-` identifica la vecchia anteprima di versione. Usa l’indirizzo stabile per le nuove visite. La dashboard misura caricamenti di pagina, non persone uniche; il Paese è stimato. La raccolta inizia soltanto dopo l’attivazione.

## Verifica e sviluppo

```bash
npm ci
npm test
```

Per pubblicare dal terminale, autenticati con `npx wrangler login`, poi usa `npm run deploy`. Le istruzioni complete del progetto e del pacchetto autonomo sono in [cloudflare/README.md](cloudflare/README.md).

I file statici nella radice restano utilizzabili su GitHub Pages. La dashboard con backend viene invece pubblicata dal progetto `cloudflare/` sul Worker Cloudflare.

## Contatti

- Contatto principale: [WhatsApp](https://wa.me/393920025363), +39 392 002 5363. I pulsanti del sito aprono una conversazione con un messaggio iniziale pertinente.
- Email alternativa: mattia.manzi97@gmail.com, disponibile nella sezione contatti e nel pulsante Copia email.
- GitHub: https://github.com/MattManzi
