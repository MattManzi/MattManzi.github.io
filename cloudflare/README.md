# Mattia Manzi — Portfolio con statistiche su Cloudflare

Questa versione aggiunge una dashboard privata al portfolio esistente su:

https://5382ffad-mattiamanzi.mattiamanzi.workers.dev/

Il link fornito ha il formato di un’anteprima di versione Cloudflare: il prefisso `5382ffad-` identifica una singola versione e non si aggiorna con le pubblicazioni successive. Dal suo formato, il Worker risulta essere `mattiamanzi` e l’indirizzo stabile previsto è https://mattiamanzi.mattiamanzi.workers.dev/. **Verifica il nome in Workers & Pages prima di pubblicare**; se è diverso, correggi `name` in `wrangler.json`. Dopo la pubblicazione usa il nuovo indirizzo stabile per condividere il sito: le visite sul vecchio link di anteprima non eseguiranno il nuovo tracker.

## Cosa vedrai

- Visualizzazioni giornaliere, con filtri oggi / 7 / 30 / 90 giorni.
- Paese di provenienza, smartphone / computer / tablet e browser.
- Provenienze da Instagram, Google, WhatsApp e altri siti o campagne.
- Clic su WhatsApp, email e telefono.
- Filtri per Paese e dispositivo, esportazione CSV e possibilità di escludere il tuo browser.

I numeri sono **caricamenti di pagina, non persone uniche**. Ogni ricaricamento può aggiungere una visualizzazione. I clic sui contatti non certificano che il visitatore abbia inviato un messaggio. Il Paese è una stima ricavata dalla rete del visitatore e può essere alterato da VPN o proxy. Non è possibile recuperare visite precedenti all’attivazione di questo codice.

## Attivazione sul tuo account

Serve Node.js 22.13 o successivo. Estrai il pacchetto e apri un terminale nella sua cartella, poi esegui:

```bash
npm install
npm run setup
```

La procedura apre l’accesso Cloudflare nel tuo browser, crea un database D1 in giurisdizione UE, applica lo schema, chiede una password riservata al pannello e pubblica sul Worker `mattiamanzi`. Usa l’account Cloudflare che gestisce l’indirizzo sopra. **Scegli una password di almeno 16 caratteri e non inserirla nel codice, nel repository o in chat.**

Il progetto non contiene credenziali Cloudflare o password. La creazione del database aggiorna `wrangler.json` con il suo ID reale. Se possiedi già un database con lo stesso nome, collegalo alla variabile `DB` nel file di configurazione prima di continuare.

Il pacchetto comprende il portfolio attuale e le sue immagini. Un semplice caricamento dei soli file statici non attiva il backend: va pubblicato anche il Worker con il binding `DB` e il secret `ANALYTICS_ADMIN_PASSWORD`. Il nome Worker è già quello del tuo sito e la pubblicazione ne sostituisce la versione corrente.

Dopo la pubblicazione apri:

https://mattiamanzi.mattiamanzi.workers.dev/statistiche

Inserisci la password scelta. Visita il portfolio da un altro browser non escluso per verificare il primo accesso, poi premi **Aggiorna** nel pannello. I numeri devono comparire. La pagina delle statistiche non è collegata dal menu pubblico.

## Comandi manuali equivalenti

```bash
npx wrangler login
npx wrangler d1 create mattia-site-analytics --binding DB --update-config --jurisdiction eu
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put ANALYTICS_ADMIN_PASSWORD
npx wrangler deploy
```

La creazione del database è richiesta solo la prima volta. Per gli aggiornamenti successivi usa `npm run deploy`. Le migrazioni successive vanno applicate prima di pubblicare.

## Misurazione e accesso

- Il tracker invia dati allo stesso sito, solo quando la pagina è visibile. Gli eventi non impostano cookie e non usano un identificativo persistente del visitatore.
- I dati delle visite sono aggregati per giorno, Paese, tipo di dispositivo, browser, provenienza ed evento. URL con query string, IP completi e user agent completi non sono salvati nelle statistiche.
- Le preferenze browser Do Not Track e Global Privacy Control vengono rispettate. I bot riconoscibili tramite user agent vengono esclusi; la distinzione non è infallibile.
- L’accesso alla dashboard usa un cookie tecnico di sessione HttpOnly/Secure/SameSite, con durata di 8 ore. API, dashboard e file HTML alternativo richiedono autorizzazione server-side. La password resta in un secret Cloudflare.
- Gli accessi con una sessione amministrativa attiva sono esclusi. L’opzione “Escludi questo browser” conserva solo una preferenza locale; non traccia il visitatore.
- Per evitare doppi invii, un ID casuale per singolo evento viene conservato per massimo due giorni e non identifica una persona. La limitazione dei tentativi conserva un HMAC temporaneo dell’indirizzo di rete; il marcatore cambia a ogni finestra e non è esportato nelle statistiche.
- Chiunque carichi il sito potrebbe bloccare JavaScript o le richieste di misurazione. Le statistiche rappresentano gli accessi misurabili, non tutti gli accessi possibili.
- Le provenienze dei social non sono sempre disponibili. Un link come `/?utm_source=instagram` aiuta a classificarle; sono salvate categorie e host, non URL completi o contenuti dei messaggi.

## Verifica tecnica

```bash
npm test
```

I test usano SQLite reale e un adattatore D1 locale, senza credenziali o connessioni al tuo account. Coprono conteggi, duplicati, filtri, password e sessione, API protette, tentativi di login, origine delle richieste, preferenze privacy ed esportazione CSV. La verifica sulla produzione richiede la pubblicazione nel tuo account.

## Struttura

- `public/`: portfolio, tracker, script e risorse statiche.
- `src/dashboard.js`: HTML della dashboard, servito solo dopo il login.
- `src/worker.js`: instradamento e API protette.
- `src/auth.js`: sessioni, password e limitazione dei tentativi.
- `src/analytics.js`: raccolta e aggregazione.
- `migrations/`: schema del database.
- `scripts/setup.mjs`: prima attivazione.
- `tests/`: test locali.

Documentazione ufficiale di riferimento:

- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/workers/runtime-apis/request/
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
