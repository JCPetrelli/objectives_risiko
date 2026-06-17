# 🎯 Risiko — Study the 16 Objectives

> 🇮🇹 **Versione italiana più in basso** — [vai all'italiano](#-risiko--studia-i-16-obiettivi).

An interactive 3D board for learning every official **Italian Risiko** tournament
objective ("obiettivi da torneo") — the whole continents, the bridge territories,
and the per-territory points that make each objective add up to **86**.

It's a **fully static** site: no server, no build step, no dependencies to install.
Open it in a browser and it just runs.

> Territory names are in **Italian**, exactly as printed on the official game board.

## ✨ Features

- **3D tabletop** rendered with Three.js (loaded from a CDN — no bundler).
- **16 tournament objectives** — click one to light up its territories on the
  board; the side panel breaks it down into whole continents + bridge territories
  with point values.
- **Six board views** (press **M**): Standard · Clean · Metal · Map spotlight ·
  Outlines · Filled outlines.
- **Free-look camera**: drag to orbit, scroll to zoom, **WASD/arrows** to pan,
  **Q/E** to rotate, **R** to reset (double-tap **R** for a top-down 2D view).
- **Bilingual EN / IT**, remembered across visits.
- A clockwise **objective-name marquee** framing the board.
- **Pocket mode for phones** (`mobile.html`) — a stripped-down, Three.js-free 2D
  board that fills the screen: pick objectives from a hamburger menu or **swipe**
  through them like cards, switch board views from the menu. Phones are redirected
  here automatically (with a link back to the full 3D version).

## 🖥 Run it locally

Because the page loads data with `fetch()` and uses ES modules, serve it over a
tiny web server rather than opening the file directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## 🚀 Host it for free on GitHub Pages

1. Fork or push this repository.
2. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**,
   then choose your branch and `/ (root)`.
3. The site goes live at `https://<username>.github.io/<repo>/`.

All asset paths are **relative**, so it works under a `/<repo>/` sub-path with no
configuration. The included `.nojekyll` file stops GitHub's Jekyll step from
interfering.

## 🗂 Project layout

```
.
├── index.html          # self-contained page: styling + i18n runtime + landing + board mount
├── study_board.js      # the whole 3D experience (Three.js); fetches the JSON below
├── mobile.html         # phone "pocket" version: full-screen 2D board, hamburger + swipe
├── mobile_board.js     # the lightweight 2D renderer (no Three.js) behind mobile.html
├── data/
│   ├── board_meta.json # 42 territories: positions, adjacency, continents, colours, values
│   └── objectives.json # the 16 objectives, each split into whole continents + bridges
├── i18n/
│   ├── en.json         # English strings
│   └── it.json         # Italian strings
├── borders/            # per-territory PNG outline masks + pickmap (drive the overlay modes)
├── board_plancia.jpg   # the painted map texture laid on the 3D board
├── board_bg.jpg        # atmospheric backdrop for the landing hero
└── IMPLEMENTATION.md   # technical notes on how the board and data are built
```

## 📜 Credits & licence

A fan-made study tool based on the official Risiko tournament objectives.
Risiko is a trademark of its respective owner; this project is non-commercial,
unaffiliated, and made for educational purposes.

---

# 🎯 Risiko — Studia i 16 Obiettivi

Una plancia 3D interattiva per imparare tutti gli **obiettivi da torneo** ufficiali
del **Risiko** italiano — i continenti interi, i territori-ponte e i punti per
territorio che fanno arrivare ogni obiettivo a **86**.

È un sito **completamente statico**: nessun server, nessuna fase di build, nessuna
dipendenza da installare. Lo apri nel browser e funziona e basta.

> I nomi dei territori sono in **italiano**, esattamente come stampati sulla plancia
> ufficiale del gioco.

## ✨ Funzionalità

- **Tavolo 3D** renderizzato con Three.js (caricato da CDN — niente bundler).
- **16 obiettivi da torneo** — clicca su uno per illuminare i suoi territori sulla
  plancia; il pannello laterale lo scompone in continenti interi + territori-ponte
  con i relativi punteggi.
- **Sei viste della plancia** (premi **M**): Standard · Pulita · Metallo · Mappa in
  evidenza · Contorni · Contorni pieni.
- **Camera libera**: trascina per orbitare, scorri per lo zoom, **WASD/frecce** per
  spostarti, **Q/E** per ruotare, **R** per resettare (doppio **R** per una vista 2D
  dall'alto).
- **Bilingue EN / IT**, memorizzato tra una visita e l'altra.
- Una **scritta scorrevole** in senso orario con i nomi degli obiettivi attorno alla
  plancia.
- **Modalità tascabile per telefono** (`mobile.html`) — una plancia 2D semplificata,
  senza Three.js, che riempie lo schermo: scegli gli obiettivi da un menu a panino o
  **scorri** tra loro come carte, cambia vista dal menu. I telefoni vengono reindirizzati
  qui automaticamente (con un link per tornare alla versione 3D completa).

## 🖥 Eseguirlo in locale

Poiché la pagina carica i dati con `fetch()` e usa moduli ES, servila tramite un
piccolo web server invece di aprire il file direttamente:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000/
```

## 🚀 Pubblicalo gratis su GitHub Pages

1. Fai il fork o il push di questo repository.
2. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**,
   poi scegli il tuo branch e `/ (root)`.
3. Il sito sarà online su `https://<username>.github.io/<repo>/`.

Tutti i percorsi delle risorse sono **relativi**, quindi funziona anche sotto il
sotto-percorso `/<repo>/` senza alcuna configurazione. Il file `.nojekyll` incluso
impedisce a GitHub di interferire con la fase Jekyll.

## 🗂 Struttura del progetto

```
.
├── index.html          # pagina autonoma: stile + runtime i18n + landing + montaggio plancia
├── study_board.js      # tutta l'esperienza 3D (Three.js); carica i JSON qui sotto
├── mobile.html         # versione "tascabile" per telefono: plancia 2D a schermo, menu + swipe
├── mobile_board.js     # il renderer 2D leggero (senza Three.js) dietro mobile.html
├── data/
│   ├── board_meta.json # 42 territori: posizioni, adiacenze, continenti, colori, valori
│   └── objectives.json # i 16 obiettivi, ciascuno diviso in continenti interi + ponti
├── i18n/
│   ├── en.json         # stringhe in inglese
│   └── it.json         # stringhe in italiano
├── borders/            # maschere PNG dei contorni per territorio + pickmap (per le viste)
├── board_plancia.jpg   # la texture della mappa dipinta applicata alla plancia 3D
├── board_bg.jpg        # sfondo atmosferico per la hero della landing
└── IMPLEMENTATION.md   # note tecniche su come sono costruiti la plancia e i dati
```

## 📜 Crediti & licenza

Strumento di studio amatoriale basato sugli obiettivi da torneo ufficiali del Risiko.
Risiko è un marchio registrato dei rispettivi proprietari; questo progetto è non
commerciale, non ufficiale e realizzato a scopo educativo.
