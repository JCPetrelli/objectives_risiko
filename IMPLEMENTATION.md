# Implementation notes — porting the "Objectives Study" board to a static site

This document explains **what the feature is**, **where it came from**, **every
change made to turn it static**, and **how to regenerate the data** if the source
game changes. It is written so that someone who has never seen the original Flask
game can maintain this repo standalone.

---

## 1. What this is

In the source project (a Flask + Flask-SocketIO multiplayer *Risiko* game), the
main lobby links to a standalone **"Study objectives"** page at `/objectives`. It
renders the Risiko board as a 3D tabletop and lets you browse the **16 official
tournament objectives**: selecting one highlights its territories and shows a
point breakdown (whole continents + "bridge" territories, summing to **86**).

It is purely a **reference/learning view** — there is no game state, no login-
specific data, nothing is written back. That is exactly why it ports cleanly to a
static site: **the only backend it touches are two read-only JSON endpoints**, and
both serve constant data.

---

## 2. Source anatomy (in the original Flask repo)

| Concern | Source file | Role |
|---|---|---|
| Page shell | `templates/study.html` | Top bar, Three.js import map, mounts the board |
| The experience | `static/study_board.js` (618 lines) | **Everything**: scene, pads, labels, view modes, marquee, camera, tooltips, objective list/detail |
| Styling + i18n runtime | `templates/base.html` | Tailwind CDN config, `glass-effect`, fonts, `window.t()` / `window.I18N` |
| Board data endpoint | `routes/api_routes.py` → `/api/board_meta` | positions, adjacency, continents, colours, values |
| Objectives endpoint | `routes/api_routes.py` → `/api/objectives` | the 16 objectives broken down |
| Objective data | `objectives.py` (`objective_breakdown()`) | builds each objective from whole continents + bridges |
| Board geometry | `board_layout.py` (`TERRITORY_POSITIONS`, `CONTINENT_COLORS`) | x,y on a 900×631 plane |
| Adjacency / continents | `rules.py` (`TERRITORIES`, `TERRITORY_CONNECTIONS`, `CONTINENT_BONUSES`) | |
| Per-territory scores | `territory_values.py` (`ITALIAN_TERRITORY_VALUES`) | each = territory's border count |
| Map texture | `static/board_plancia.jpg` | painted map laid on the 3D board |
| Overlay assets | `static/borders/*.png`, `manifest.json`, `pickmap.json/png` | per-territory silhouettes that drive the spotlight/outline/fill modes |

### The two endpoints (the only "API")

```python
# /api/board_meta  -> board_meta.json
{
  "positions":        { "Alaska": {"x": .., "y": ..}, ... },   # 42 entries
  "connections":      { "Alaska": ["Kamchatka", ...], ... },   # adjacency
  "continents":       { "Alaska": "North America", ... },      # territory -> continent key
  "continent_colors": { "North America": "#FF8C42", ... },     # 6 entries
  "continent_bonuses":{ "North America": 5, ... },
  "territory_values": { "Alaska": 4, ... }                     # victory points
}

# /api/objectives  -> objectives.json   (list of 16)
{
  "id": 1, "name": "Il Letto", "total": 86, "count": 23,
  "territories": ["Alaska", ...],                              # full territory list
  "whole_continents": [ {"continent": "North America", "value": 21}, ... ],
  "bridges":          [ {"continent": "Asia", "territories": [ {"name":"Medio Oriente","value":4}, ... ]} ]
}
```

`continent` values are **English keys** (`North America`, `Asia`, …) that the
client localizes via `t('continent.<key>')`. **Territory names stay Italian** —
they are Italian dictionary keys throughout the source game, never translated.

---

## 3. What changed to make it static

The port is deliberately minimal — the 3D code is identical. Three things moved.

### 3.1 Endpoints → flat JSON files

The two `fetch()` calls and the overlay-asset fetches were re-pointed from
backend routes to relative files. `study_board.js` gained two options
(`dataBase`, `bordersBase`, both relative by default) and **lost the `prefix`
option** (the Flask `APP_PREFIX` Tailscale-Funnel hack, irrelevant here).

| Original (Flask) | Static |
|---|---|
| `fetch(prefix + '/api/board_meta')` | `fetch(dataBase + 'board_meta.json')` |
| `fetch(prefix + '/api/objectives')` | `fetch(dataBase + 'objectives.json')` |
| `fetch(prefix + '/static/borders/pickmap.json')` | `fetch(bordersBase + 'pickmap.json')` |
| `loadImg(prefix + '/static/borders/pickmap.png')` | `loadImg(bordersBase + 'pickmap.png')` |
| `fetch(prefix + '/static/borders/manifest.json')` | `fetch(bordersBase + 'manifest.json')` |
| `loadImg(prefix + '/static/borders/' + f)` | `loadImg(bordersBase + f)` |

**Why relative paths matter:** GitHub Pages *project* sites serve from
`https://user.github.io/<repo>/`. Root-absolute paths like `/data/...` would
resolve to `user.github.io/data/...` (404). Every path in this repo is `./`-
relative so it works under the sub-path with zero config. `.nojekyll` is included
so GitHub's Jekyll build step leaves the files untouched.

### 3.2 Flask page + base.html → one self-contained `index.html`

`study.html` extended `base.html` via Jinja. There is no Jinja here, so
`index.html` **inlines** the parts of `base.html` the board needs:

- The **Tailwind theme** (the `gaming-*` colour tokens, gradients) — verbatim.
- The CSS the board's classes rely on: `glass-effect`, fonts (`Cinzel` /
  `Alegreya Sans` / `JetBrains Mono`), the film-grain overlay, scrollbars, plus
  the page's own `.nav-key` and `[data-objlist] button.active` rules.
- The Three.js **import map** (CDN `three@0.160.0`).

### 3.3 Session language → client-side localStorage

The game stored the locale in the Flask **session** and reloaded after
`POST /api/set_language`. Statically there is no session, so:

- Both dictionaries (`i18n/en.json`, `i18n/it.json`) ship as files.
- `index.html` defines the **same global API the board expects** — `window.t()`,
  `window.I18N`, `window.LOCALE` — exactly as `base.html` did, but the dictionary
  is `fetch()`-ed for the chosen locale instead of injected by Jinja.
- Locale is read from `localStorage['risiko_study_locale']` (first visit falls
  back to the browser language, then `en`).
- `switchLanguage(locale)` writes localStorage and **reloads** — same strategy as
  the original. Reloading (rather than live re-rendering) is intentional: the
  board builds its DOM through `t()` at construction, so a reload is the simplest
  way to rebuild it cleanly in the new language with zero extra code.
- Static text uses `data-i18n="key"` attributes filled by a small `applyI18n()`
  pass; the language buttons are rendered into `[data-langswitch]` slots.

### 3.4 New: public landing wrapper

The game dropped you straight onto the board (you arrived from the lobby). For a
public audience, `index.html` adds a **hero landing**: title, lead paragraph,
three control hints, an "Open the board" button, and the language switch over the
`board_bg.jpg` tabletop backdrop.

- The Three.js board is **lazily initialized on first "enter"** — Three.js / the
  texture / the border masks don't load until the visitor opens the board, so the
  landing paints instantly.
- Navigation is hash-based: entering sets `#board` (deep-linkable — `…/#board`
  opens the board directly); the board's top-bar "Home" button returns to the
  hero. The original's "← Lobby" button became "← Home".
- Landing strings live under the `landing.*` and `ui.home` keys, added to both
  dictionaries (they don't exist in the source game).

**Nothing else in `study_board.js` changed** — the scene, the six M-key view
modes, the marquee, the keyboard camera, tooltips, and the objective list/detail
are byte-for-byte the original logic.

---

## 4. File-by-file map of this repo

```
index.html         self-contained page (styling + i18n runtime + landing + board mount)
study_board.js     the 3D experience; only the 6 fetch paths + the signature differ from source
data/
  board_meta.json  snapshot of /api/board_meta
  objectives.json  snapshot of /api/objectives
i18n/
  en.json          trimmed to the keys this page uses + landing.* strings
  it.json          same, Italian
borders/           45 PNG masks + manifest.json + pickmap.json + pickmap.png (copied as-is)
board_plancia.jpg  map texture (copied as-is)
board_bg.jpg       landing backdrop (copied as-is)
.nojekyll          disable Jekyll on GitHub Pages
```

---

## 5. Regenerating the static data

If the source game's territories/objectives/values change, re-export the two JSON
files and the trimmed dictionaries by running this **inside the source Flask
repo** (it imports the game's own modules):

```python
import json
from board_layout import TERRITORY_POSITIONS, CONTINENT_COLORS
from rules import TERRITORIES, TERRITORY_CONNECTIONS, CONTINENT_BONUSES
from territory_values import ITALIAN_TERRITORY_VALUES
from objectives import objective_breakdown

OUT = "/path/to/objectives_risiko"

continent_of = {t: c for c, l in TERRITORIES.items() for t in l}
meta = {
    'positions': {t: {'x': p[0], 'y': p[1]} for t, p in TERRITORY_POSITIONS.items()},
    'connections': TERRITORY_CONNECTIONS,
    'continents': continent_of,
    'continent_colors': CONTINENT_COLORS,
    'continent_bonuses': CONTINENT_BONUSES,
    'territory_values': ITALIAN_TERRITORY_VALUES,
}
json.dump(meta, open(f"{OUT}/data/board_meta.json", "w"), ensure_ascii=False, indent=0)
json.dump(objective_breakdown(), open(f"{OUT}/data/objectives.json", "w"), ensure_ascii=False, indent=0)

# trimmed bilingual dictionaries (keys the study page uses)
PREFIXES = ('study.', 'controls.', 'continent.', 'objective.name', 'view_mode_')
EXTRA = {'objective.pts', 'ui.lobby'}
def trim(path):
    d = json.load(open(path))
    return {k: v for k, v in d.items() if k.startswith(PREFIXES) or k in EXTRA}
# NOTE: re-add the landing.* and ui.home strings afterwards (see i18n/*.json) —
# they are added by this repo, not present in the game's translations.
json.dump(trim("translations/en.json"), open(f"{OUT}/i18n/en.json", "w"), ensure_ascii=False, indent=2)
json.dump(trim("translations/it.json"), open(f"{OUT}/i18n/it.json", "w"), ensure_ascii=False, indent=2)
```

To also refresh the binaries: copy `static/board_plancia.jpg`, `static/board_bg.jpg`,
and the whole `static/borders/` folder into this repo.

### The "86" invariant
Every objective's territory values sum to exactly **86** (the official balancing
invariant the source enforces in tests). If you regenerate and a `total`/sum drifts
from 86, the source data — not this repo — is wrong.

---

## 6. Testing checklist

Serve locally (`python3 -m http.server 8000`) and confirm:

- [ ] Landing hero paints immediately; EN/IT toggle swaps all text and persists across reload.
- [ ] "Open the board" reveals the 3D board; the texture and pads appear.
- [ ] Clicking an objective in the side panel highlights its territories, shows the
      breakdown, and starts the name marquee around the edges.
- [ ] **M** cycles all six views; **spotlight/outline/fill** need the `borders/`
      assets — if those 404, only those three modes degrade (the rest still work).
- [ ] Camera: drag-orbit, scroll-zoom, WASD/arrows pan, Q/E rotate, **R** reset,
      **R R** top-down.
- [ ] Deep link `…/index.html#board` opens straight onto the board.
- [ ] DevTools Network tab shows **only relative requests** — no `/api/…`, no leading-slash paths.

---

## 7. Dependencies

- **Three.js 0.160.0** + OrbitControls — loaded from `cdn.jsdelivr.net` via the
  ES-module import map. (Vendor locally if you need offline / CDN-independent hosting.)
- **Tailwind CSS** — `cdn.tailwindcss.com` (runtime JIT; fine for a static site).
- **Google Fonts** (Cinzel / Alegreya Sans / JetBrains Mono) + **Font Awesome**.

No build step, no package manager, no server runtime.
