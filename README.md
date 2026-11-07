# La mia biblioteca

App web installabile (PWA) per catalogare i libri scansionando l'ISBN e gestire la lista dei libri da acquistare.
I dati restano nel browser del telefono (`localStorage`).

## Flusso di lavoro

| Ramo / tag | Ruolo |
|---|---|
| `main` | Versione pubblicata. Ogni push su `main` viene pubblicato su GitHub Pages. |
| `feature/<nome>` | Un ramo per ogni nuovo requisito, creato da `main`. |
| `vX.Y.Z` | Tag di ogni rilascio, utile per tornare indietro. |

1. `git switch -c feature/nome-requisito` (da `main` aggiornato)
2. Sviluppa e prova in locale (`python3 -m http.server 8000`, poi apri `http://localhost:8000`; la fotocamera funziona su `localhost`).
3. Aggiorna `CHANGELOG.md` sotto `[Non rilasciato]`.
4. Apri una Pull Request verso `main`, controlla, unisci.
5. Rilascio: `git switch main && git pull`, sposta le voci del changelog sotto la nuova versione, poi `scripts/release.sh 1.1.0` e `git push origin main --tags`.

Versioni: PATCH per correzioni (1.0.1), MINOR per nuove funzioni compatibili (1.1.0), MAJOR solo se qualcosa smette di funzionare come prima (2.0.0).

## Regole di compatibilità con i dati già salvati

- La chiave `biblioteca.v1` in `localStorage` non cambia mai.
- Non rinominare né eliminare campi dei libri. Aggiungi solo campi nuovi, con un valore predefinito.
- Se la struttura dei dati cambia: aumenta `SCHEMA` in `app.js` e aggiungi la funzione in `MIGRATIONS` (esempio già nel codice). Prima di migrare l'app salva una copia di sicurezza dei dati nel browser.
- I backup JSON contengono `schema` e vengono migrati in importazione. Un backup più recente dell'app viene rifiutato con un messaggio.
- Prima di ogni rilascio prova: aprire l'app con dati della versione precedente (importa un backup vecchio) e controllare che i libri compaiano.

## Pubblicazione su GitHub Pages (una tantum)

1. Crea un repository su github.com (es. `biblioteca`), vuoto, senza README.
2. Nel progetto: `git remote add origin https://github.com/<utente>/biblioteca.git` poi `git push -u origin main --tags`.
3. Su GitHub: Settings → Pages → Source: **GitHub Actions**.
4. Dopo circa un minuto l'app è su `https://<utente>.github.io/biblioteca/`.

## Chiave API Google Books (consigliata)

Le ricerche anonime su Google Books vengono limitate (errore 429). Con una chiave gratuita il problema sparisce.

1. Vai su console.cloud.google.com, crea un progetto (es. "biblioteca").
2. Menu API e servizi → Libreria → cerca "Books API" → Abilita.
3. API e servizi → Credenziali → Crea credenziali → Chiave API.
4. Modifica la chiave: in "Restrizioni delle applicazioni" scegli "Siti web" e aggiungi `https://TUONOME.github.io/*`; in "Restrizioni API" scegli solo Books API.
5. Nell'app apri il menu in alto a destra e incolla la chiave nel campo dedicato.

La chiave resta salvata sul telefono, non nel codice né nei backup.
