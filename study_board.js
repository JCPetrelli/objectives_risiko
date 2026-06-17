import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GOLD = 0xf3c54b;
const SCALE = 70;
const LAYOUT_W = 900, LAYOUT_H = 631;
const BOARD_W = LAYOUT_W / SCALE + 1.2, BOARD_H = LAYOUT_H / SCALE + 1.2;
const PAD_RADIUS = 0.27, BOARD_TOP = 0.17;

/**
 * Mount an interactive "study the 16 objectives" board inside `container`.
 *
 * Static build: all data comes from flat JSON + image files served alongside
 * the page (no Flask backend). Paths are RELATIVE so the site works under a
 * GitHub Pages project URL (https://user.github.io/repo/).
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container  element the board fully owns
 * @param {string} opts.textureUrl      path to board_plancia.jpg
 * @param {string} [opts.dataBase]      dir with board_meta.json + objectives.json (default './data/')
 * @param {string} [opts.bordersBase]   dir with the border masks + pickmap (default './borders/')
 * @param {number} [opts.panelTopPx]    top offset of the side panel (default 12)
 * @returns {{destroy:Function, recenter:Function, topDown:Function}}
 */
export function createStudyBoard({ container, textureUrl, dataBase = './data/',
                                   bordersBase = './borders/', panelTopPx = 12 }) {
    const T = (k, params) => (window.t ? window.t(k, params) : k);

    // ---- build the module's own DOM inside the container ----------------
    // The container just needs to be a positioning context for the absolute canvas.
    // Check the *computed* position: the container may be positioned via a CSS class
    // (e.g. `absolute inset-0`), whose dimensions we must not clobber — only a static
    // container needs an inline `relative`, otherwise it collapses to height 0.
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const boardDiv = document.createElement('div');
    boardDiv.className = 'absolute inset-0';
    container.appendChild(boardDiv);

    const panel = document.createElement('div');
    panel.className = 'absolute right-3 bottom-3 z-20 w-72 flex flex-col gap-2';
    panel.style.top = panelTopPx + 'px';
    panel.innerHTML = `
        <div class="glass-effect rounded-xl p-2 shrink-0">
            <div class="text-xs font-bold mb-1.5 px-1">${T('study.list_title')}</div>
            <div data-objlist class="grid grid-cols-4 gap-1"></div>
        </div>
        <div data-objdetail class="glass-effect rounded-xl p-3 overflow-y-auto flex-1 text-xs">
            <div class="text-gray-400 text-center mt-6">${T('study.pick')}</div>
        </div>`;
    container.appendChild(panel);
    const listEl = panel.querySelector('[data-objlist]');
    const detailEl = panel.querySelector('[data-objdetail]');

    const tooltip = document.createElement('div');
    tooltip.className = 'absolute z-30 pointer-events-none hidden glass-effect rounded-lg px-2 py-1 text-xs';
    container.appendChild(tooltip);

    // ---- objective name marquee (flows slowly clockwise around the board) ---
    // A four-strip frame just outside the play area: top scrolls right, right
    // edge down, bottom left, left edge up — so the selected objective's name
    // circulates clockwise. Placement (the rotated `.obj-edge`) is decoupled
    // from motion (the `.obj-scroller` translateX loop) so the two never fight.
    const marqueeStyle = document.createElement('style');
    marqueeStyle.textContent = `
        .obj-marquee { position: fixed; inset: 0; z-index: 10; pointer-events: none; }
        .obj-marquee.hidden { display: none; }
        .obj-edge { position: fixed; overflow: hidden; height: 3.4rem;
                    display: flex; align-items: center; }
        .obj-edge-top    { top: 0;  left: 0;  width: 100vw; }
        .obj-edge-bottom { bottom: 0; left: 0; width: 100vw; }
        .obj-edge-left   { top: 0; left: 0;  width: 100vh;
                           transform-origin: top left;  transform: translateY(100vh) rotate(-90deg); }
        .obj-edge-right  { top: 0; right: 0; width: 100vh;
                           transform-origin: top right; transform: translateY(100vh) rotate(90deg); }
        .obj-scroller { white-space: nowrap; will-change: transform; font-weight: 900;
                        font-size: 2.1rem; letter-spacing: 0.12em;
                        font-family: Inter, system-ui, sans-serif;
                        color: rgba(243,197,75,0.85);
                        text-shadow: 0 0 14px rgba(243,197,75,0.45), 0 2px 5px rgba(0,0,0,0.65);
                        animation: objm-scroll 90s linear infinite; }
        .obj-scroller.rev { animation-direction: reverse; }
        @keyframes objm-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`;
    document.head.appendChild(marqueeStyle);

    const marquee = document.createElement('div');
    marquee.className = 'obj-marquee hidden';
    marquee.innerHTML = ['top', 'right', 'bottom', 'left'].map(side =>
        `<div class="obj-edge obj-edge-${side}"><div class="obj-scroller" data-side="${side}"></div></div>`).join('');
    container.appendChild(marquee);

    const escapeHtml = s => s.replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function showMarquee(name) {
        //   = en-space around the ✦ separator; two identical halves make the
        // translateX(-50%) loop seamless regardless of how long the strip is.
        const half = (escapeHtml(name) + ' ✦ ').repeat(40);
        marquee.querySelectorAll('.obj-scroller').forEach(s => {
            s.innerHTML = `<span>${half}</span><span>${half}</span>`;
            s.classList.toggle('rev', s.dataset.side !== 'bottom');  // only bottom flows natively left
        });
        marquee.classList.remove('hidden');
    }

    // ---- view-mode toast (mirrors the in-game M-key toast) --------------
    const viewToast = document.createElement('div');
    viewToast.className = 'absolute left-1/2 -translate-x-1/2 z-30 opacity-0 ' +
        'transition-opacity duration-300 pointer-events-none';
    viewToast.style.top = (panelTopPx + 12) + 'px';
    viewToast.innerHTML = `<div class="glass-effect rounded-full px-4 py-1.5 border border-white/15
        text-xs font-bold tracking-wide text-gaming-accent flex items-center gap-2">
        <kbd class="px-1 py-0.5 bg-black/40 rounded text-[10px] font-mono border border-white/20">M</kbd>
        <span data-vlabel></span></div>`;
    container.appendChild(viewToast);
    const viewToastLabel = viewToast.querySelector('[data-vlabel]');
    let viewToastTimer = null;
    function showViewModeToast() {
        viewToastLabel.textContent = T('view_mode_' + viewMode);
        viewToast.classList.remove('opacity-0');
        clearTimeout(viewToastTimer);
        viewToastTimer = setTimeout(() => viewToast.classList.add('opacity-0'), 1200);
    }

    // ---- scene / camera / renderer --------------------------------------
    const W = () => container.clientWidth || 1, H = () => container.clientHeight || 1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1c);
    scene.fog = new THREE.Fog(0x0a0f1c, 18, 40);

    const camera = new THREE.PerspectiveCamera(46, W() / H(), 0.1, 100);
    camera.position.set(0, 10.5, 9.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W(), H());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    boardDiv.appendChild(renderer.domElement);

    const onResize = () => {
        camera.aspect = W() / H(); camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
    };
    addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.target.set(0, 0.6, 0);
    controls.maxPolarAngle = 1.38; controls.minDistance = 3.5; controls.maxDistance = 20;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: null };

    const CAMERA_HOME = { pos: camera.position.clone(), target: controls.target.clone() };
    const TOP_DOWN_POS = new THREE.Vector3(0, 13, 0.0001), TOP_DOWN_TARGET = new THREE.Vector3(0, 0, 0);
    let camTween = null;
    function flyTo(toPos, toTarget, dur = 0.7) {
        camTween = { t0: null, dur, fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
                     toPos: toPos.clone(), toTarget: toTarget.clone() };
    }
    const recenter = () => flyTo(CAMERA_HOME.pos, CAMERA_HOME.target);
    const topDown = () => flyTo(TOP_DOWN_POS, TOP_DOWN_TARGET, 0.55);

    // ---- keyboard camera -------------------------------------------------
    const heldKeys = new Set();
    const MOVE_KEYS = new Set(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright']);
    const UP_AXIS = new THREE.Vector3(0, 1, 0);
    const PAN_SPEED = 7, ROT_SPEED = 1.6;
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    let lastResetTap = -1;
    const onKeyDown = e => {
        if (isTyping(e.target)) return;
        if (e.key === 'r' || e.key === 'R' || e.key === 'Home') {
            e.preventDefault();
            const now = performance.now();
            if (now - lastResetTap < 350) topDown(); else recenter();
            lastResetTap = now; return;
        }
        const k = e.key.toLowerCase();
        if (k === 'm') { e.preventDefault(); cycleViewMode(); return; }
        if (MOVE_KEYS.has(k)) { heldKeys.add(k); e.preventDefault(); }
    };
    const onKeyUp = e => heldKeys.delete(e.key.toLowerCase());
    const onBlur = () => heldKeys.clear();
    addEventListener('keydown', onKeyDown);
    addEventListener('keyup', onKeyUp);
    addEventListener('blur', onBlur);
    function updateKeyboardCamera(dt) {
        if (!heldKeys.size) return;
        const has = (...ks) => ks.some(k => heldKeys.has(k));
        const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0;
        if (fwd.lengthSq() > 1e-6) {
            fwd.normalize();
            const right = new THREE.Vector3().crossVectors(fwd, UP_AXIS).normalize();
            const move = new THREE.Vector3();
            if (has('w','arrowup')) move.add(fwd);
            if (has('s','arrowdown')) move.sub(fwd);
            if (has('d','arrowright')) move.add(right);
            if (has('a','arrowleft')) move.sub(right);
            if (move.lengthSq()) {
                move.normalize().multiplyScalar(PAN_SPEED * dt);
                const nt = controls.target.clone().add(move);
                nt.x = clampN(nt.x, -9, 9); nt.z = clampN(nt.z, -7, 7);
                const delta = nt.clone().sub(controls.target);
                camera.position.add(delta); controls.target.copy(nt); camTween = null;
            }
        }
        let rot = 0;
        if (has('q')) rot += ROT_SPEED * dt;
        if (has('e')) rot -= ROT_SPEED * dt;
        if (rot) {
            const offset = camera.position.clone().sub(controls.target).applyAxisAngle(UP_AXIS, rot);
            camera.position.copy(controls.target).add(offset); camTween = null;
        }
    }

    // ---- lights / table / board -----------------------------------------
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.6);
    keyLight.position.set(6, 12, 4); keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5); rim.position.set(-8, 6, -6); scene.add(rim);

    function roundedRectShape(w, h, r) {
        const s = new THREE.Shape();
        s.moveTo(-w/2 + r, -h/2);
        s.lineTo(w/2 - r, -h/2); s.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
        s.lineTo(w/2, h/2 - r); s.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
        s.lineTo(-w/2 + r, h/2); s.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
        s.lineTo(-w/2, -h/2 + r); s.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
        return s;
    }
    const boardGeo = new THREE.ExtrudeGeometry(roundedRectShape(BOARD_W, BOARD_H, 0.35),
        { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    boardGeo.rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: 0x14304e, roughness: 0.6, metalness: 0.05 }));
    board.receiveShadow = true; scene.add(board);

    function toWorld(px, py) { return { x: (px - LAYOUT_W/2) / SCALE, z: (py - LAYOUT_H/2) / SCALE }; }

    let mapTexture = null, mapMesh = null;
    function addBoardMap() {
        const mw = LAYOUT_W / SCALE, mh = LAYOUT_H / SCALE;
        const geo = new THREE.ShapeGeometry(roundedRectShape(mw, mh, 0.3), 24);
        const uv = geo.attributes.uv, pos = geo.attributes.position;
        for (let i = 0; i < uv.count; i++)
            uv.setXY(i, (pos.getX(i) + mw/2) / mw, (pos.getY(i) + mh/2) / mh);
        geo.rotateX(-Math.PI / 2);
        mapTexture = new THREE.TextureLoader().load(textureUrl);
        mapTexture.colorSpace = THREE.SRGBColorSpace; mapTexture.anisotropy = 8;
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: mapTexture, roughness: 0.85 }));
        mesh.position.y = BOARD_TOP + 0.002; mesh.receiveShadow = true;
        scene.add(mesh); mapMesh = mesh;
    }

    // ---- territory markers + labels -------------------------------------
    const pads = {}, rings = {}, labels = {};
    const ringGeo = new THREE.TorusGeometry(PAD_RADIUS + 0.02, 0.022, 10, 32); ringGeo.rotateX(Math.PI / 2);
    const padGeo = new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS, 0.05, 28);
    const pickMeshes = [];
    const seaLines = [];   // dashed adjacency routes — hidden in the outline/spotlight modes
    let objEdges = null, pulseRings = [];

    function makeLabel(name, value) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 96;
        const g = canvas.getContext('2d');
        g.textAlign = 'center';
        g.font = 'bold 22px Inter, sans-serif';
        g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineJoin = 'round';
        g.strokeText(name, 128, 38); g.fillStyle = '#fff'; g.fillText(name, 128, 38);
        g.font = 'bold 26px Inter, sans-serif';
        g.strokeText(String(value), 128, 74); g.fillStyle = '#f3c54b'; g.fillText(String(value), 128, 74);
        const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 4;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        sprite.scale.set(1.1, 0.41, 1);
        return sprite;
    }

    function buildBoard(meta) {
        addBoardMap();
        addOverlay();
        const lineMat = new THREE.LineDashedMaterial({ color: 0x2e4a3a, dashSize: 0.13, gapSize: 0.09, transparent: true, opacity: 0.6 });
        const drawn = new Set();
        for (const [t, neighbors] of Object.entries(meta.connections)) {
            const p1 = meta.positions[t]; if (!p1) continue;
            for (const other of neighbors) {
                const key = [t, other].sort().join('|');
                if (drawn.has(key) || !meta.positions[other]) continue;
                drawn.add(key);
                const a = toWorld(p1.x, p1.y), b = toWorld(meta.positions[other].x, meta.positions[other].y);
                const segs = [];
                if ((t === 'Alaska' && other === 'Kamchatka') || (t === 'Kamchatka' && other === 'Alaska')) {
                    const ak = t === 'Alaska' ? a : b, ka = t === 'Alaska' ? b : a;
                    segs.push([new THREE.Vector3(-BOARD_W/2, BOARD_TOP + 0.012, ak.z), new THREE.Vector3(ak.x, BOARD_TOP + 0.012, ak.z)]);
                    segs.push([new THREE.Vector3(ka.x, BOARD_TOP + 0.012, ka.z), new THREE.Vector3(BOARD_W/2, BOARD_TOP + 0.012, ka.z)]);
                } else {
                    segs.push([new THREE.Vector3(a.x, BOARD_TOP + 0.012, a.z), new THREE.Vector3(b.x, BOARD_TOP + 0.012, b.z)]);
                }
                for (const [v1, v2] of segs) {
                    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v1, v2]), lineMat);
                    line.computeLineDistances(); scene.add(line); seaLines.push(line);
                }
            }
        }
        objEdges = new THREE.LineSegments(new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9 }));
        scene.add(objEdges);

        for (const [t, pos] of Object.entries(meta.positions)) {
            const { x, z } = toWorld(pos.x, pos.y);
            const base = new THREE.Color(meta.continent_colors[meta.continents[t]] || '#888888');
            const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: base, roughness: 0.5 }));
            pad.position.set(x, BOARD_TOP + 0.05, z); pad.castShadow = true;
            pad.userData.territory = t;
            pad.userData.base = base;
            scene.add(pad); pads[t] = pad; pickMeshes.push(pad);

            const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.8 }));
            ring.position.set(x, BOARD_TOP + 0.07, z); ring.visible = false;
            scene.add(ring); rings[t] = ring;

            const label = makeLabel(t, meta.territory_values[t] || 1);
            label.position.set(x, BOARD_TOP + 0.32, z);
            scene.add(label); labels[t] = label;
        }
    }

    // ---- overlay plane: per-territory outlines & fills ------------------
    // A second transparent plane at the map's UVs, painted from the in-game
    // assets (borders/*.png white outline masks + pickmap.png id-per-pixel).
    // Drives the spotlight / outline / filled-outline modes below.
    const OVL_W = 1854, OVL_H = 1300;   // border-mask & pickmap native resolution
    let overlayMesh = null, overlayTex = null, overlayCtx = null, ovlTmpCtx = null;
    let pickData = null, pickTerr = [], borderImages = {}, bordersReady = false;

    function addOverlay() {
        const mw = LAYOUT_W / SCALE, mh = LAYOUT_H / SCALE;
        const geo = new THREE.ShapeGeometry(roundedRectShape(mw, mh, 0.3), 24);
        const uv = geo.attributes.uv, pos = geo.attributes.position;
        for (let i = 0; i < uv.count; i++)
            uv.setXY(i, (pos.getX(i) + mw/2) / mw, (pos.getY(i) + mh/2) / mh);
        geo.rotateX(-Math.PI / 2);
        const canvas = document.createElement('canvas'); canvas.width = OVL_W; canvas.height = OVL_H;
        overlayCtx = canvas.getContext('2d');
        const tmp = document.createElement('canvas'); tmp.width = OVL_W; tmp.height = OVL_H;
        ovlTmpCtx = tmp.getContext('2d');
        overlayTex = new THREE.CanvasTexture(canvas);
        overlayTex.colorSpace = THREE.SRGBColorSpace; overlayTex.anisotropy = 8;
        overlayMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            map: overlayTex, transparent: true, depthWrite: false }));
        overlayMesh.position.y = BOARD_TOP + 0.006; overlayMesh.visible = false; overlayMesh.renderOrder = 2;
        scene.add(overlayMesh);
    }

    async function loadOverlayAssets() {
        const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
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
        applyViewMode();   // repaint now that the assets (may) exist
    }

    // Recolour a white mask into `color` on the scratch canvas and return it.
    function tintMask(img, color) {
        ovlTmpCtx.clearRect(0, 0, OVL_W, OVL_H);
        ovlTmpCtx.globalCompositeOperation = 'source-over'; ovlTmpCtx.drawImage(img, 0, 0, OVL_W, OVL_H);
        ovlTmpCtx.globalCompositeOperation = 'source-in'; ovlTmpCtx.fillStyle = color; ovlTmpCtx.fillRect(0, 0, OVL_W, OVL_H);
        ovlTmpCtx.globalCompositeOperation = 'source-over';
        return ovlTmpCtx.canvas;
    }
    function selectedNames() {
        const o = objectives.find(x => x.id === selectedId);
        return o ? new Set(o.territories) : new Set();
    }
    // Paint pixels onto the overlay by pick-map id; `predicate(id,name)` -> rgba|null.
    function paintByPick(predicate) {
        const img = overlayCtx.createImageData(OVL_W, OVL_H), d = img.data, n = OVL_W * OVL_H;
        for (let p = 0; p < n; p++) {
            const id = pickData[p * 4];
            const c = predicate(id, id > 0 ? pickTerr[id - 1] : null);
            if (c) { const o = p * 4; d[o] = c[0]; d[o+1] = c[1]; d[o+2] = c[2]; d[o+3] = c[3]; }
        }
        overlayCtx.putImageData(img, 0, 0);
    }
    function paintOverlay(kind) {
        if (!kind || !bordersReady) { if (overlayMesh) overlayMesh.visible = false; return; }
        const names = selectedNames();
        overlayCtx.clearRect(0, 0, OVL_W, OVL_H);
        if (kind === 'spotlight') {
            if (!names.size) { overlayMesh.visible = false; return; }   // nothing picked -> plain map
            paintByPick((id, name) => name && names.has(name) ? null : [4, 8, 16, 205]);  // dim all but the objective
        } else {                                                        // 'outline' and 'fill'
            if (kind === 'fill' && names.size)
                paintByPick((id, name) => name && names.has(name) ? [243, 197, 75, 255] : null);  // full-opacity bright gold
            for (const t in borderImages)                               // dark-grey outlines for every territory
                if (!names.has(t)) overlayCtx.drawImage(tintMask(borderImages[t], '#3a414c'), 0, 0, OVL_W, OVL_H);
            for (const t of names)                                      // white outlines for the objective, on top
                if (borderImages[t]) overlayCtx.drawImage(tintMask(borderImages[t], '#ffffff'), 0, 0, OVL_W, OVL_H);
        }
        overlayTex.needsUpdate = true;
        overlayMesh.visible = true;
    }

    // ---- board view mode (M key) — extends the live game's three modes --
    // default : printed map + continent-coloured pads + value labels
    // clean   : bare printed map, labels hidden
    // metal   : black surface, pads glow in their continent colour
    // spotlight    : printed map, only the objective's territories lit (rest dimmed)
    // outline      : grey outlines of every territory, white for the objective's
    // fill         : like outline, plus the objective's territories washed gold
    // The study board keeps its own preference (separate from the game) and
    // opens in 'spotlight' by default.
    const VIEW_MODES = ['default', 'clean', 'metal', 'spotlight', 'outline', 'fill'];
    const VIEW_MODE_KEY = 'risiko_study_view_mode';
    // map | base colour | pads | labels | sea routes | gold adjacency edges | pad glow | overlay kind
    const MODE_CFG = {
        default:   { map: true,  base: 0x14304e, pads: true,  labels: true,  sea: true,  edges: true,  overlay: null },
        clean:     { map: true,  base: 0x14304e, pads: true,  labels: false, sea: true,  edges: true,  overlay: null },
        metal:     { map: false, base: 0x05070b, pads: true,  labels: false, sea: true,  edges: true,  overlay: null },
        spotlight: { map: true,  base: 0x14304e, pads: false, labels: false, sea: false, edges: false, overlay: 'spotlight' },
        outline:   { map: false, base: 0x05070b, pads: false, labels: false, sea: false, edges: false, overlay: 'outline' },
        fill:      { map: false, base: 0x05070b, pads: false, labels: false, sea: false, edges: false, overlay: 'fill' },
    };
    let viewMode = (() => {
        const s = localStorage.getItem(VIEW_MODE_KEY);
        return VIEW_MODES.includes(s) ? s : 'spotlight';
    })();
    function applyViewMode() {
        const cfg = MODE_CFG[viewMode] || MODE_CFG.default;
        if (mapMesh) mapMesh.visible = cfg.map;
        board.material.color.setHex(cfg.base);
        for (const t in pads) pads[t].visible = cfg.pads;
        for (const t in labels) labels[t].visible = cfg.labels;
        for (const l of seaLines) l.visible = cfg.sea;
        if (objEdges) objEdges.visible = cfg.edges;
        applySelection();   // repaint pads (glow vs flat) + rebuild gold edges
        if (!cfg.pads) for (const t in rings) rings[t].visible = false;   // no floating rings without pads
        paintOverlay(cfg.overlay);
    }
    function cycleViewMode() {
        viewMode = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
        localStorage.setItem(VIEW_MODE_KEY, viewMode);
        showViewModeToast();
        applyViewMode();
    }

    // ---- selection / highlight ------------------------------------------
    let meta = null, objectives = [], selectedId = null;
    function applySelection() {
        const obj = objectives.find(o => o.id === selectedId);
        const inObj = obj ? new Set(obj.territories) : null;
        for (const t of Object.keys(pads)) {
            const pad = pads[t], ring = rings[t], label = labels[t];
            const base = pad.userData.base;
            if (!inObj) {
                pad.material.color.copy(base);
                if (viewMode === 'metal') { pad.material.emissive.copy(base); pad.material.emissiveIntensity = 0.55; }
                else { pad.material.emissive.setHex(0x000000); pad.material.emissiveIntensity = 1; }
                pad.scale.setScalar(1); ring.visible = false; label.material.opacity = 1;
            } else if (inObj.has(t)) {
                pad.material.color.setHex(GOLD); pad.material.emissive.setHex(GOLD);
                pad.material.emissiveIntensity = 0.6; pad.scale.setScalar(1.25);
                ring.visible = true; label.material.opacity = 1;
            } else {
                const hsl = {}; base.getHSL(hsl);
                pad.material.color.setHSL(hsl.h, 0.1, hsl.l * 0.35);
                pad.material.emissive.setHex(0x000000); pad.material.emissiveIntensity = 1;
                pad.scale.setScalar(0.8); ring.visible = false; label.material.opacity = 0.25;
            }
        }
        pulseRings = inObj ? [...inObj].map(t => rings[t]).filter(Boolean) : [];
        const pts = [];
        if (inObj) {
            const seen = new Set();
            for (const t of inObj) {
                for (const n of (meta.connections[t] || [])) {
                    if (!inObj.has(n)) continue;
                    const key = [t, n].sort().join('|');
                    if (seen.has(key)) continue; seen.add(key);
                    const a = toWorld(meta.positions[t].x, meta.positions[t].y);
                    const b = toWorld(meta.positions[n].x, meta.positions[n].y);
                    pts.push(new THREE.Vector3(a.x, BOARD_TOP + 0.06, a.z),
                             new THREE.Vector3(b.x, BOARD_TOP + 0.06, b.z));
                }
            }
        }
        objEdges.geometry.dispose();
        objEdges.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }

    // ---- objective list + detail ----------------------------------------
    function renderList() {
        listEl.innerHTML = objectives.map(o => `
            <button data-id="${o.id}" title="${T('objective.name.' + o.id)}"
                    class="py-1.5 rounded-lg bg-gaming-dark/60 hover:bg-gaming-accent/30 text-xs font-bold">${o.id}</button>`).join('');
        listEl.querySelectorAll('button').forEach(b =>
            b.addEventListener('click', () => selectObjective(Number(b.dataset.id))));
    }
    function selectObjective(id) {
        selectedId = id;
        listEl.querySelectorAll('button').forEach(b =>
            b.classList.toggle('active', Number(b.dataset.id) === id));
        renderDetail();
        applyViewMode();   // repaints pads, gold edges AND the outline/fill/spotlight overlay
        showMarquee(T('objective.name.' + id));
    }
    function renderDetail() {
        const o = objectives.find(x => x.id === selectedId);
        if (!o) return;
        // continent carries the English key from objective_breakdown(); localize it
        // here. Territory names stay Italian (they are Italian across the codebase).
        const whole = o.whole_continents.map(c =>
            `<div class="flex justify-between"><span>🌍 ${T('continent.' + c.continent)} <span class="text-gray-400">(${T('study.whole_tag')})</span></span><span class="text-gaming-accent font-bold">${c.value}</span></div>`).join('');
        const bridges = o.bridges.map(g => `
            <div class="mt-1.5">
                <div class="text-[10px] uppercase tracking-wide text-gray-400">${T('continent.' + g.continent)}</div>
                ${g.territories.map(tt => `<div class="flex justify-between pl-2"><span>${tt.name}</span><span class="text-gray-300">${tt.value}</span></div>`).join('')}
            </div>`).join('');
        detailEl.innerHTML = `
            <div class="flex items-baseline justify-between mb-2">
                <div class="font-bold text-purple-300">${T('objective.name', { id: o.id })} <span class="text-gaming-accent">— ${T('objective.name.' + o.id)}</span></div>
                <div><span class="text-base font-bold text-gaming-accent">${o.total}</span>
                     <span class="text-[10px] text-gray-400">${T('objective.pts')} · ${o.count} ${T('study.territories')}</span></div>
            </div>
            ${whole ? `<div class="mb-1 font-semibold text-[11px] text-gray-300">${T('study.whole')}</div>${whole}` : ''}
            ${bridges ? `<div class="mt-2 mb-1 font-semibold text-[11px] text-gray-300">${T('study.bridges')}</div>${bridges}` : ''}`;
    }

    // ---- hover tooltip ---------------------------------------------------
    const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
    const onMouseMove = e => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hit = raycaster.intersectObjects(pickMeshes)[0];
        if (hit) {
            const t = hit.object.userData.territory;
            tooltip.innerHTML = `<b>${t}</b> · ${meta.territory_values[t] || 1} ${T('objective.pts')}`;
            tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
            tooltip.style.top = (e.clientY - rect.top + 12) + 'px';
            tooltip.classList.remove('hidden');
        } else {
            tooltip.classList.add('hidden');
        }
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // ---- render loop -----------------------------------------------------
    const clock = new THREE.Clock(); let lastT = 0, rafId = null, disposed = false;
    function animate() {
        if (disposed) return;
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(), dt = Math.min(0.05, t - lastT); lastT = t;
        if (camTween) {
            if (camTween.t0 === null) camTween.t0 = t;
            const k = Math.min(1, (t - camTween.t0) / camTween.dur), ease = 1 - Math.pow(1 - k, 3);
            camera.position.lerpVectors(camTween.fromPos, camTween.toPos, ease);
            controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, ease);
            if (k >= 1) camTween = null;
        }
        if (pulseRings.length) {
            const pulse = 0.6 + Math.sin(t * 4) * 0.3;
            for (const ring of pulseRings) ring.material.emissiveIntensity = pulse;
        }
        updateKeyboardCamera(dt);
        controls.update();
        renderer.render(scene, camera);
    }

    // ---- boot ------------------------------------------------------------
    (async function boot() {
        try {
            meta = await fetch(dataBase + 'board_meta.json').then(r => r.json());
            objectives = await fetch(dataBase + 'objectives.json').then(r => r.json());
            if (disposed) return;
            buildBoard(meta);
            renderList();
            applyViewMode();   // applies the saved view mode + repaints the pads
            loadOverlayAssets();   // async; repaints overlay modes once masks/pickmap arrive
            animate();
        } catch (err) {
            console.error('study board failed to load', err);
            detailEl.innerHTML = `<div class="text-red-400 text-center mt-6">${T('study.load_failed')}</div>`;
        }
    })();

    // ---- teardown --------------------------------------------------------
    function destroy() {
        if (disposed) return;
        disposed = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
        removeEventListener('resize', onResize);
        resizeObserver.disconnect();
        removeEventListener('keydown', onKeyDown);
        removeEventListener('keyup', onKeyUp);
        removeEventListener('blur', onBlur);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        controls.dispose();
        scene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach(x => { x.map && x.map.dispose(); x.dispose(); });
            else if (m) { m.map && m.map.dispose(); m.dispose(); }
        });
        if (mapTexture) mapTexture.dispose();
        renderer.dispose();
        boardDiv.remove(); panel.remove(); tooltip.remove();
        marquee.remove(); marqueeStyle.remove(); viewToast.remove();
    }

    return { destroy, recenter, topDown };
}
