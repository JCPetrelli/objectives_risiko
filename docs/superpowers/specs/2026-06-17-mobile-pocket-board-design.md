# Mobile Pocket Objectives Board — Design

**Date:** 2026-06-17
**Status:** approved

## Goal

An extremely simplified, phone-first version of the Risiko objectives study tool —
a "pocket objectives device". No 3D, no keyboard shortcuts; pick objectives from a
hamburger menu or swipe through them like cards, on a full-screen top-down 2D board.

## Decisions

1. **Architecture** — new standalone `mobile.html` (no Three.js / importmap). `index.html`
   auto-redirects phones (`screen width ≤ 820px AND touch`) via `location.replace('mobile.html')`.
   Mobile carries a "Full 3D version →" link to `index.html?desktop=1`; that choice is
   remembered in `localStorage` (`risiko_force_desktop`) so it won't bounce back.
2. **Orientation** — the landscape board is rotated 90° and scaled to fill the portrait
   viewport height (cover); top bar + breakdown panel float as translucent glass overlays.
3. **View modes** (menu-driven, no shortcuts): Standard · Clean · Outlines · Filled.
   Dropped the 3D-only Metal and Map-spotlight.
4. **Objective info** — compact, collapsible breakdown panel: `🎯 <name> — 86 pts`,
   whole continents (with points), bridge territories (with points).
5. **Swipe** — left/right on the map = next / previous objective, cyclic 1↔16, with a
   brief slide animation. Hamburger menu is the jump-to.

## Components

- **`mobile_board.js`** — `createMobileBoard({ container, textureUrl, dataBase, bordersBase, onSelect })`.
  Owns only canvas rendering. Loads `objectives.json`, `board_meta.json`, the border masks +
  pickmap. Composites onto an offscreen landscape canvas (1854×1300) reusing `tintMask` +
  `paintByPick` lifted from `study_board.js`, then blits rotated 90° onto the on-screen portrait
  canvas (cover-fit). API: `select(id)`, `next()`, `prev()`, `setViewMode(mode)`, `getViewMode()`,
  `getSelected()`, `objectives`, `ready` (Promise). Fires `onSelect(objective, viewMode)` on change.
- **`mobile.html`** — markup + styling + wiring: hamburger drawer (objective list, view-mode
  selector, EN/IT toggle, 3D link), bottom breakdown panel, top bar, swipe handling on the map
  container calling `next()/prev()`.

### 2D view-mode mapping (faithful to desktop kinds)

| Mobile mode | Backdrop | Overlay |
|---|---|---|
| Standard | plancia | spotlight dim (all but selected dimmed) |
| Clean | plancia | white/gold outline of selected only |
| Outlines | dark | grey outlines everywhere + gold on selected |
| Filled | dark | outlines + gold-filled selected (pickmap) |

## Data shapes (confirmed)

- `objectives.json`: list of `{id, name, total, count, territories[], whole_continents[{continent,value}], bridges[{continent, territories[{name,value}]}]}`.
- Continent labels localized via existing `continent.<EN name>` i18n keys.
- Territory names are Italian (as on the board) in all languages.

## i18n

Reuse `i18n/en.json` + `it.json`; add `mobile.*` keys: menu title, objectives header,
view-mode header + mode labels (reuse `view_mode_*`), swipe hint, "full 3D version" link,
whole-continents / bridges headers (reuse `study.*`).

## Touched files

- new: `mobile.html`, `mobile_board.js`, this spec
- edit: `index.html` (phone redirect + manual link), `i18n/en.json`, `i18n/it.json`, `README.md`

## Out of scope (YAGNI)

No pan/zoom, no 3D, no shortcuts, no offline/PWA caching, no animations beyond the card slide.
