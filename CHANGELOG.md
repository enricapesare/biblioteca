# Changelog

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/), versioni secondo [SemVer](https://semver.org/lang/it/).

## [Non rilasciato]

## [1.2.0] - 2026-11-07
### Aggiunto
- Collane e periodici: riconoscimento dei codici a barre 977… (ISSN), campi Collana, Numero e ISSN, ordinamento per collana.
- Alla scansione di una collana già presente vengono riportati i dati dell'ultima uscita; avviso se l'uscita è già inserita.

## [1.1.0] - 2026-11-07
### Aggiunto
- Campo per una chiave API di Google Books nel menu, per evitare il blocco 429 delle richieste anonime.
### Modificato
- Meno richieste per ogni ricerca ISBN, un nuovo tentativo automatico in caso di 429 e messaggi di errore più chiari.

## [1.0.1] - 2026-11-07
### Corretto
- Ricerca dettagli per ISBN: ricerca più tollerante su Google Books (anche come testo libero), ricerca aggiuntiva su Open Library e messaggio che spiega se il servizio non risponde o se l'ISBN non esiste.

## [1.0.0] - 2026-11-07
### Aggiunto
- Biblioteca personale con stato di lettura, voto, posizione, generi e note.
- Scansione del codice a barre (ISBN) con recupero dei dettagli da Google Books e Open Library.
- Ricerca per titolo/autore, inserimento manuale, rilevamento dei duplicati.
- Lista "Da acquistare" con priorità, prezzo e luogo di acquisto.
- Backup e ripristino JSON, esportazione CSV, statistiche.
- Installazione come app (PWA) con uso offline.
