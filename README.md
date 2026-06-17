# 🎯 Risiko — Study the 16 Objectives

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
</content>
</invoke>
