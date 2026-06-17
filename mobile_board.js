// ── mobile_board.js ────────────────────────────────────────────────────────
// The lightweight 2D board for the phone "pocket objectives device".
// No Three.js: the plancia + border masks are composited on an offscreen
// landscape canvas (the same tintMask / pickmap trick the 3D board uses in
// study_board.js), then blitted rotated 90° onto a portrait on-screen canvas
// so the long axis fills the phone height.
//
//   createMobileBoard({ container, textureUrl, dataBase, bordersBase, onSelect })
//     -> { ready, objectives, select, next, prev, setViewMode, getViewMode,
//          getSelected, redraw }

const OVL_W = 1854, OVL_H = 1300;   // border-mask & pickmap native resolution
const GOLD = [243, 197, 75, 255];

// Backdrop + overlay recipe per simplified mobile mode.
//   map     : draw the printed plancia (else a dark schematic backdrop)
//   overlay : 'spotlight' | 'cleanline' | 'outline' | 'fill' | null
const MODE_CFG = {
    standard: { map: true,  overlay: 'spotlight' },
    clean:    { map: true,  overlay: 'cleanline' },
    outline:  { map: false, overlay: 'outline'   },
    fill:     { map: false, overlay: 'fill'      },
};
export const MOBILE_VIEW_MODES = ['standard', 'clean', 'outline', 'fill'];

export function createMobileBoard({ container, textureUrl = './board_plancia.jpg',
                                    dataBase = './data/', bordersBase = './borders/',
                                    onSelect = () => {} }) {
    const VIEW_MODE_KEY = 'risiko_mobile_view_mode';

    // ── on-screen portrait canvas (fills the container) ──────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // ── offscreen landscape canvases: base composite + scratch for tinting ───
    const board = document.createElement('canvas'); board.width = OVL_W; board.height = OVL_H;
    const boardCtx = board.getContext('2d');
    const ovl = document.createElement('canvas'); ovl.width = OVL_W; ovl.height = OVL_H;
    const ovlCtx = ovl.getContext('2d', { willReadFrequently: true });
    const tmp = document.createElement('canvas'); tmp.width = OVL_W; tmp.height = OVL_H;
    const tmpCtx = tmp.getContext('2d');

    let objectives = [];
    let mapImg = null, pickData = null, pickTerr = [], borderImages = {};
    let bordersReady = false;
    let selectedId = null;
    let viewMode = (() => {
        const s = localStorage.getItem(VIEW_MODE_KEY);
        return MOBILE_VIEW_MODES.includes(s) ? s : 'standard';
    })();

    const loadImg = src => new Promise(r => {
        const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src;
    });

    // Recolour a white mask into `color` on the scratch canvas (from study_board.js).
    function tintMask(img, color) {
        tmpCtx.clearRect(0, 0, OVL_W, OVL_H);
        tmpCtx.globalCompositeOperation = 'source-over'; tmpCtx.drawImage(img, 0, 0, OVL_W, OVL_H);
        tmpCtx.globalCompositeOperation = 'source-in'; tmpCtx.fillStyle = color; tmpCtx.fillRect(0, 0, OVL_W, OVL_H);
        tmpCtx.globalCompositeOperation = 'source-over';
        return tmpCtx.canvas;
    }
    function selectedNames() {
        const o = objectives.find(x => x.id === selectedId);
        return o ? new Set(o.territories) : new Set();
    }
    // Paint pixels onto the overlay by pick-map id; predicate(id,name) -> rgba|null.
    function paintByPick(predicate) {
        const img = ovlCtx.createImageData(OVL_W, OVL_H), d = img.data, n = OVL_W * OVL_H;
        for (let p = 0; p < n; p++) {
            const id = pickData[p * 4];
            const c = predicate(id, id > 0 ? pickTerr[id - 1] : null);
            if (c) { const o = p * 4; d[o] = c[0]; d[o+1] = c[1]; d[o+2] = c[2]; d[o+3] = c[3]; }
        }
        ovlCtx.putImageData(img, 0, 0);
    }

    // Build the landscape composite for the current mode + selection.
    function composite() {
        const cfg = MODE_CFG[viewMode] || MODE_CFG.standard;
        const names = selectedNames();

        // backdrop
        boardCtx.clearRect(0, 0, OVL_W, OVL_H);
        if (cfg.map && mapImg) boardCtx.drawImage(mapImg, 0, 0, OVL_W, OVL_H);
        else { boardCtx.fillStyle = '#05070b'; boardCtx.fillRect(0, 0, OVL_W, OVL_H); }

        if (!bordersReady) { blit(); return; }

        // overlay
        ovlCtx.clearRect(0, 0, OVL_W, OVL_H);
        if (cfg.overlay === 'spotlight') {
            if (names.size) paintByPick((id, name) => name && names.has(name) ? null : [4, 8, 16, 205]);
        } else if (cfg.overlay === 'cleanline') {
            for (const t of names) if (borderImages[t]) ovlCtx.drawImage(tintMask(borderImages[t], '#f3c54b'), 0, 0, OVL_W, OVL_H);
        } else { // 'outline' and 'fill'
            if (cfg.overlay === 'fill' && names.size)
                paintByPick((id, name) => name && names.has(name) ? GOLD : null);
            for (const t in borderImages)
                if (!names.has(t)) ovlCtx.drawImage(tintMask(borderImages[t], '#3a414c'), 0, 0, OVL_W, OVL_H);
            for (const t of names)
                if (borderImages[t]) ovlCtx.drawImage(tintMask(borderImages[t], '#ffffff'), 0, 0, OVL_W, OVL_H);
        }
        boardCtx.drawImage(ovl, 0, 0);
        blit();
    }

    // Blit the landscape board onto the canvas in its NATURAL orientation,
    // CONTAIN-fit (whole board always visible) and centred, inside a padding
    // margin with a thin frame. No rotation: the map keeps the same framing
    // whichever way the phone is held — landscape just shows it bigger, so the
    // user naturally turns the device to see better. The padding keeps it clear
    // of the browser chrome (URL bar) and stops the edges being cut off.
    function blit() {
        const dpr = window.devicePixelRatio || 1;
        const cw = container.clientWidth, ch = container.clientHeight;
        if (!cw || !ch) return;
        if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
            canvas.width = cw * dpr; canvas.height = ch * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        const pad = Math.max(12, Math.round(Math.min(cw, ch) * 0.035));
        const scale = Math.min((cw - pad * 2) / OVL_W, (ch - pad * 2) / OVL_H);   // contain
        const drawW = OVL_W * scale, drawH = OVL_H * scale;
        const ox = Math.round((cw - drawW) / 2), oy = Math.round((ch - drawH) / 2);
        ctx.drawImage(board, ox, oy, drawW, drawH);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(200, 155, 60, 0.45)';
        ctx.strokeRect(ox - 0.75, oy - 0.75, drawW + 1.5, drawH + 1.5);
    }

    // ── public ops ───────────────────────────────────────────────────────────
    function emit() {
        const o = objectives.find(x => x.id === selectedId) || null;
        onSelect(o, viewMode);
    }
    function select(id) {
        if (!objectives.some(o => o.id === id)) return;
        selectedId = id; composite(); emit();
    }
    function step(delta) {
        if (!objectives.length) return;
        const i = objectives.findIndex(o => o.id === selectedId);
        const ni = ((i < 0 ? 0 : i) + delta + objectives.length) % objectives.length;
        select(objectives[ni].id);
    }
    function setViewMode(mode) {
        if (!MOBILE_VIEW_MODES.includes(mode)) return;
        viewMode = mode; localStorage.setItem(VIEW_MODE_KEY, mode); composite(); emit();
    }

    let resizeRAF = 0;
    const refit = () => { cancelAnimationFrame(resizeRAF); resizeRAF = requestAnimationFrame(blit); };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', () => setTimeout(refit, 100));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);

    // ── boot ─────────────────────────────────────────────────────────────────
    const ready = (async () => {
        const [objs, map] = await Promise.all([
            fetch(dataBase + 'objectives.json').then(r => r.json()),
            loadImg(textureUrl),
        ]);
        objectives = objs; mapImg = map;
        try {
            const pm = await fetch(bordersBase + 'pickmap.json').then(r => r.ok ? r.json() : null);
            const pimg = pm && await loadImg(bordersBase + 'pickmap.png');
            if (pm && pimg) {
                pickTerr = pm.territories;
                const c = document.createElement('canvas'); c.width = pm.w; c.height = pm.h;
                const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(pimg, 0, 0);
                pickData = cx.getImageData(0, 0, pm.w, pm.h).data;   // R channel = territory id (0 = ocean)
            }
            const man = await fetch(bordersBase + 'manifest.json').then(r => r.ok ? r.json() : null);
            if (man) await Promise.all(Object.entries(man).map(async ([t, f]) => {
                const im = await loadImg(bordersBase + f); if (im) borderImages[t] = im; }));
            bordersReady = !!pickData;
        } catch { bordersReady = false; }

        if (objectives.length) selectedId = objectives[0].id;
        composite(); emit();
        return api;
    })();

    const api = {
        ready, get objectives() { return objectives; },
        select, next: () => step(1), prev: () => step(-1),
        setViewMode, getViewMode: () => viewMode,
        getSelected: () => objectives.find(o => o.id === selectedId) || null,
        redraw: blit,
    };
    return api;
}
