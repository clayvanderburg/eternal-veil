// Molecular Dance: glowing ball-and-stick molecules and Bohr atoms tumbling in
// perspective. Water, methane, benzene, a buckyball, a DNA helix, a salt
// crystal and shell-model atoms form out of nothing, vibrate, spin, and burst
// apart in a flash of light while the next ones form elsewhere, so the screen
// is always full of action. Every atom wears a soft electron-cloud (s, p and d
// lobes); electrons race around tilted shells; bonds carry travelling pulses.
// Bass strikes make electrons leap outward and the atoms swell; treble makes
// the electrons sparkle. Drawn with sprites on the shared 2D canvas.
const MolecularDance = (() => {
    const TAU = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const finite = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    // Artistic tunables. Molecular Lab edits these live; the preset uses these
    // defaults. Several are multiplied with the matching app setting
    // (speed, baseSize, density, stretch, wobble).
    const DEFAULT_TUNING = {
        count: 3,           // molecules on screen (× density / 1600)
        moleculeSize: 0.78,   // overall molecule size (× baseSize / 2.4)
        lifeSeconds: 12,       // average life of a molecule before it bursts apart
        formSeconds: 1.05,     // time for a molecule to assemble
        dissolveSeconds: 0.8, // time to burst apart
        tumble: 1.9,          // how fast molecules spin
        drift: 1,           // how fast molecules travel across the screen
        vibration: 1.01,       // bond stretching and breathing
        bondWidth: 1.45,       // stick thickness
        atomGlow: 3,       // halo brightness around atoms
        cloudLevel: 1.28,      // soft electron-cloud lobes (× stretch)
        orbitLevel: 1,      // share of atoms wearing electron shells (0 = none)
        electronSpeed: 1,   // electron laps
        trailLength: 1,     // electron streaks
        atomShare: 0.3,       // share of Bohr atoms (vs molecules)
        depth: 1.17,           // perspective and depth fade
        motes: 3,           // background quantum dust
        colorFlow: 0.1,       // palette cycles per second through the elements
        burstLevel: 1,      // flash rings when molecules form and burst
        bassPulse: 0.2,       // bass → atoms swell and bonds flash
        bassJump: 0.15,        // bass → electrons leap to wider shells
        beatSpin: 0.15,        // bass → molecules lurch into a spin
        trebleSparkle: 0.15,   // treble → electron sparkle
        quality: 1          // cap on detail; the frame guard can lower it further
    };
    const tuning = { ...DEFAULT_TUNING };

    // ---------- elements and molecules ----------
    // r: ball radius in bond lengths; slot: palette position; orb: electron-cloud
    // lobe shape (s = round, p = dumbbell, d = four-leaf); e: orbiting electrons.
    const ELEMENTS = {
        H: { r: 0.30, slot: 0, orb: "s", e: 1 },
        C: { r: 0.46, slot: 2, orb: "p", e: 2 },
        N: { r: 0.48, slot: 4, orb: "p", e: 2 },
        O: { r: 0.52, slot: 1, orb: "p", e: 2 },
        P: { r: 0.50, slot: 3, orb: "p", e: 1 },
        Na: { r: 0.60, slot: 3, orb: "d", e: 1 },
        Cl: { r: 0.64, slot: 5, orb: "d", e: 2 },
        proton: { r: 0.7, slot: 1, orb: "s", e: 0 },
        neutron: { r: 0.7, slot: 4, orb: "s", e: 0 }
    };
    const BALL = 0.62;   // ball radius = element.r × BALL bond lengths

    function ringOfAtoms(count, radius, element, phase = 0, y = 0) {
        const atoms = [];
        for (let k = 0; k < count; k++) {
            const a = phase + k * TAU / count;
            atoms.push([element, radius * Math.cos(a), y, radius * Math.sin(a)]);
        }
        return atoms;
    }

    function buckyball() {
        const phi = (1 + Math.sqrt(5)) / 2;
        const seeds = [[0, 1, 3 * phi], [1, 2 + phi, 2 * phi], [phi, 2, 2 * phi + 1]];
        const pts = [];
        for (const [a, b, c] of seeds) {
            for (const [x, y, z] of [[a, b, c], [b, c, a], [c, a, b]]) {
                for (const sx of x === 0 ? [1] : [1, -1]) for (const sy of y === 0 ? [1] : [1, -1]) for (const sz of z === 0 ? [1] : [1, -1]) {
                    pts.push([x * sx / 2, y * sy / 2, z * sz / 2]);
                }
            }
        }
        const bonds = [];
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
            if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]) < 1.05) bonds.push([i, j, 1]);
        }
        return { atoms: pts.map(p => ["C", p[0], p[1], p[2]]), bonds };
    }

    function saltCrystal() {
        const atoms = [], index = new Map();
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
            index.set(`${i},${j},${k}`, atoms.length);
            atoms.push([(i + j + k) % 2 === 0 ? "Na" : "Cl", i * 1.15, j * 1.15, k * 1.15]);
        }
        const bonds = [];
        for (const [key, a] of index) {
            const [i, j, k] = key.split(",").map(Number);
            for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
                const b = index.get(`${i + di},${j + dj},${k + dk}`);
                if (b !== undefined) bonds.push([a, b, 1]);
            }
        }
        return { atoms, bonds };
    }

    // Coronene-style flake: seven fused benzene rings, hydrogens on the rim.
    function flake() {
        const centers = [[0, 0]];
        for (let k = 0; k < 6; k++) centers.push([Math.sqrt(3) * Math.cos(k * Math.PI / 3), Math.sqrt(3) * Math.sin(k * Math.PI / 3)]);
        const carbons = [], key = p => `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)}`, seen = new Map();
        for (const [cx, cy] of centers) for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + k * Math.PI / 3, p = [cx + Math.cos(a), cy + Math.sin(a)];
            if (!seen.has(key(p))) { seen.set(key(p), carbons.length); carbons.push(p); }
        }
        const atoms = carbons.map(p => ["C", p[0], 0, p[1]]), bonds = [], neighbours = carbons.map(() => []);
        for (let i = 0; i < carbons.length; i++) for (let j = i + 1; j < carbons.length; j++) {
            if (Math.hypot(carbons[i][0] - carbons[j][0], carbons[i][1] - carbons[j][1]) < 1.05) {
                bonds.push([i, j, 1]); neighbours[i].push(j); neighbours[j].push(i);
            }
        }
        carbons.forEach((p, i) => {
            if (neighbours[i].length !== 2) return;
            const mx = (carbons[neighbours[i][0]][0] + carbons[neighbours[i][1]][0]) / 2, my = (carbons[neighbours[i][0]][1] + carbons[neighbours[i][1]][1]) / 2;
            const len = Math.hypot(p[0] - mx, p[1] - my) || 1;
            atoms.push(["H", p[0] + (p[0] - mx) / len * 0.95, 0, p[1] + (p[1] - my) / len * 0.95]);
            bonds.push([i, atoms.length - 1, 1]);
        });
        const rings = centers.map(c => ({ c: [c[0], 0, c[1]], r: 0.62, n: [0, 1, 0] }));
        return { atoms, bonds, rings };
    }

    function helix() {
        const atoms = [], bonds = [], pairs = 10;
        for (let k = 0; k < pairs; k++) {
            const y = (k - (pairs - 1) / 2) * 0.62, a = k * 0.62;
            const base = atoms.length;
            atoms.push(["P", Math.cos(a), y, Math.sin(a)], ["N", 0.38 * Math.cos(a), y, 0.38 * Math.sin(a)],
                ["O", -0.38 * Math.cos(a), y, -0.38 * Math.sin(a)], ["P", -Math.cos(a), y, -Math.sin(a)]);
            bonds.push([base, base + 1, 1], [base + 1, base + 2, k % 2 ? 3 : 2], [base + 2, base + 3, 1]);
            if (k > 0) bonds.push([base - 4, base, 1], [base - 1, base + 3, 1]);
        }
        return { atoms, bonds, twist: 0.5 };
    }

    function bohrAtom(nucleons, shells) {
        const atoms = [];
        for (let k = 0; k < nucleons; k++) {
            // Golden-angle sphere packing keeps the nucleus a tight, even cluster.
            const y = nucleons === 1 ? 0 : 1 - 2 * (k + 0.5) / nucleons, r = Math.sqrt(1 - y * y), a = k * 2.399963;
            atoms.push([k % 2 ? "neutron" : "proton", 0.13 * r * Math.cos(a), 0.13 * y, 0.13 * r * Math.sin(a)]);
        }
        return { atoms, bonds: [], shells, bohr: true };
    }

    // size: world radius of the molecule at moleculeSize 1. weight: how often it is chosen.
    const TEMPLATES = [
        { key: "water", name: "Water", size: 0.44, weight: 1.2, build: () => ({ atoms: [["O", 0, 0, 0], ["H", 0.79, 0.61, 0], ["H", -0.79, 0.61, 0]], bonds: [[0, 1, 1], [0, 2, 1]] }) },
        { key: "carbonDioxide", name: "Carbon dioxide", size: 0.52, weight: 1, build: () => ({ atoms: [["O", -1.2, 0, 0], ["C", 0, 0, 0], ["O", 1.2, 0, 0]], bonds: [[0, 1, 2], [1, 2, 2]] }) },
        { key: "methane", name: "Methane", size: 0.46, weight: 1.2, build: () => {
            const k = 1 / Math.sqrt(3);
            return { atoms: [["C", 0, 0, 0], ["H", k, k, k], ["H", k, -k, -k], ["H", -k, k, -k], ["H", -k, -k, k]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] };
        } },
        { key: "ammonia", name: "Ammonia", size: 0.44, weight: 1, build: () => ({ atoms: [["N", 0, 0.33, 0], ["H", 0.944, 0, 0], ["H", -0.472, 0, 0.818], ["H", -0.472, 0, -0.818]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] }) },
        { key: "acetylene", name: "Acetylene", size: 0.58, weight: 0.8, build: () => ({ atoms: [["H", -1.7, 0, 0], ["C", -0.6, 0, 0], ["C", 0.6, 0, 0], ["H", 1.7, 0, 0]], bonds: [[0, 1, 1], [1, 2, 3], [2, 3, 1]] }) },
        { key: "ethene", name: "Ethene", size: 0.52, weight: 1, build: () => ({ atoms: [["C", -0.67, 0, 0], ["C", 0.67, 0, 0], ["H", -1.24, 0.93, 0], ["H", -1.24, -0.93, 0], ["H", 1.24, 0.93, 0], ["H", 1.24, -0.93, 0]],
            bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]] }) },
        { key: "benzene", name: "Benzene", size: 0.6, weight: 1.4, build: () => {
            const atoms = [...ringOfAtoms(6, 1, "C"), ...ringOfAtoms(6, 1.85, "H")], bonds = [];
            for (let k = 0; k < 6; k++) bonds.push([k, (k + 1) % 6, k % 2 ? 1 : 2], [k, 6 + k, 1]);
            return { atoms, bonds, rings: [{ c: [0, 0, 0], r: 0.6, n: [0, 1, 0] }] };
        } },
        { key: "flake", name: "Graphene flake", size: 0.7, weight: 0.7, solo: true, build: flake },
        { key: "buckyball", name: "Buckyball", size: 0.7, weight: 0.8, solo: true, atomScale: 0.62, build: buckyball },
        { key: "salt", name: "Salt crystal", size: 0.62, weight: 0.8, solo: true, atomScale: 0.72, build: saltCrystal },
        { key: "dna", name: "DNA helix", size: 0.8, weight: 0.8, solo: true, atomScale: 0.62, build: helix },
        { key: "helium", name: "Helium atom", atom: true, size: 0.44, weight: 1, build: () => bohrAtom(4, [2]) },
        { key: "carbonAtom", name: "Carbon atom", atom: true, size: 0.52, weight: 1.2, build: () => bohrAtom(8, [2, 4]) },
        { key: "neon", name: "Neon atom", atom: true, size: 0.56, weight: 1, build: () => bohrAtom(10, [2, 8]) },
        { key: "sodium", name: "Sodium atom", atom: true, size: 0.6, weight: 0.9, build: () => bohrAtom(11, [2, 8, 1]) }
    ];
    for (const tpl of TEMPLATES) {
        const built = tpl.build();
        let extent = 0;
        for (const [name, x, y, z] of built.atoms) extent = Math.max(extent, Math.hypot(x, y, z) + ELEMENTS[name].r * BALL * (tpl.atomScale || 1));
        if (built.bohr) extent = 0.95;   // outer shell sits at the edge
        const k = 1 / extent;
        tpl.atomScale = tpl.atomScale || 1;
        tpl.atoms = built.atoms.map(([name, x, y, z]) => ({ name, el: ELEMENTS[name], x: x * k, y: y * k, z: z * k,
            rad: built.bohr ? 0.085 : ELEMENTS[name].r * BALL * tpl.atomScale * k }));
        tpl.bonds = built.bonds;
        tpl.rings = (built.rings || []).map(r => ({ c: r.c.map(v => v * k), r: r.r * k, n: r.n }));
        tpl.twist = built.twist || 0;
        tpl.shells = built.shells || null;
        tpl.electronShare = tpl.atoms.length > 30 ? 0.18 : tpl.atoms.length > 12 ? 0.4 : 1;
        tpl.colorSpread = tpl.colorSpread ?? (new Set(built.atoms.map(a => a[0])).size === 1 ? 1.6 : 0.5);
        tpl.bondLength = built.bonds.length ? Math.hypot(...[0, 1, 2].map(i => built.atoms[built.bonds[0][0]][1 + i] - built.atoms[built.bonds[0][1]][1 + i])) * k : 0;
    }

    // ---------- helpers ----------
    // Small deterministic generator keeps tests repeatable.
    const state = {
        clusters: [], nextId: 1, seed: 7, clock: 0, lastSeconds: null, colorPhase: 0, restSize: null, swellTime: 0,
        pulse: 0, treble: 0, jump: 0, lurch: 0, beat: false, lastPulse: 0, lastTemplate: -1,
        budget: 1, frameAverage: 16.7, lastFrameAt: null, width: 0, height: 0, extentX: 1, extentY: 1,
        motes: [], blobs: [], forced: null, layer: null, frame: 0, drawn: { atoms: 0, bonds: 0, electrons: 0 }
    };
    function random() {
        state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
        return state.seed / 4294967296;
    }
    const range = (min, max) => min + random() * (max - min);

    // Palettes arrive as "#rgb", "#rrggbb", "rgb(...)" or "hsl(...)" (Flow's
    // generated palettes use hsl). Returns [r, g, b] in 0–255, or null.
    function parseColor(value) {
        const text = String(value || "").trim().toLowerCase();
        let m = /^#?([0-9a-f]{6})$/.exec(text);
        if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
        m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
        if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
        m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
        if (m) return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
        m = /^hsla?\(\s*([-\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(text);
        if (m) {
            const h = ((+m[1] % 360) + 360) % 360, s = Math.min(100, +m[2]) / 100, l = Math.min(100, +m[3]) / 100;
            const a = s * Math.min(l, 1 - l);
            const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
            return [f(0), f(8), f(4)];
        }
        return null;
    }

    const paletteCache = { key: "", colors: [[136, 136, 255]] };
    function paletteColors(palette) {
        const key = palette.join(",");
        if (key === paletteCache.key) return paletteCache.colors;
        paletteCache.key = key;
        const colors = palette.slice(0, 6).map(c => parseColor(c) || [136, 136, 255]);
        paletteCache.colors = colors.length ? colors : [[136, 136, 255]];
        return paletteCache.colors;
    }
    // Smooth palette lookup that wraps around, so colours can flow forever.
    const mixed = [0, 0, 0];
    function paletteAt(colors, u) {
        const n = colors.length;
        const x = ((u % n) + n) % n, i = Math.floor(x), f = x - i, a = colors[i % n], b = colors[(i + 1) % n];
        const s = f * f * (3 - 2 * f);
        mixed[0] = a[0] + (b[0] - a[0]) * s; mixed[1] = a[1] + (b[1] - a[1]) * s; mixed[2] = a[2] + (b[2] - a[2]) * s;
        return mixed;
    }

    // ---------- sprites (cached per quantised colour) ----------
    const sprites = new Map();
    const SPRITE = 64;
    function makeCanvas(size) {
        if (typeof document === "undefined") return { width: size, height: size, dummy: true, getContext: () => null };
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        return canvas;
    }
    const shade = (rgb, k) => k >= 0
        ? `rgb(${Math.round(rgb[0] + (255 - rgb[0]) * k)},${Math.round(rgb[1] + (255 - rgb[1]) * k)},${Math.round(rgb[2] + (255 - rgb[2]) * k)})`
        : `rgb(${Math.round(rgb[0] * (1 + k))},${Math.round(rgb[1] * (1 + k))},${Math.round(rgb[2] * (1 + k))})`;
    function spriteFor(rgb) {
        const qr = rgb[0] >> 3, qg = rgb[1] >> 3, qb = rgb[2] >> 3, key = (qr << 10) | (qg << 5) | qb;
        let entry = sprites.get(key);
        if (entry) return entry;
        if (sprites.size > 600) sprites.clear();
        const c = [qr * 8 + 4, qg * 8 + 4, qb * 8 + 4];
        const body = makeCanvas(SPRITE), halo = makeCanvas(SPRITE), soft = makeCanvas(SPRITE);
        const b = body.getContext && body.getContext("2d");
        if (b) {
            // Shaded ball lit from the upper left, with a soft rim so it never looks flat.
            const g = b.createRadialGradient(SPRITE * 0.36, SPRITE * 0.3, SPRITE * 0.02, SPRITE * 0.5, SPRITE * 0.5, SPRITE * 0.5);
            g.addColorStop(0, shade(c, 0.85)); g.addColorStop(0.22, shade(c, 0.25)); g.addColorStop(0.62, shade(c, -0.2));
            g.addColorStop(0.92, shade(c, -0.62)); g.addColorStop(1, `rgba(${Math.round(c[0] * 0.3)},${Math.round(c[1] * 0.3)},${Math.round(c[2] * 0.3)},0)`);
            b.fillStyle = g; b.fillRect(0, 0, SPRITE, SPRITE);
            const rim = b.createRadialGradient(SPRITE * 0.5, SPRITE * 0.5, SPRITE * 0.38, SPRITE * 0.5, SPRITE * 0.5, SPRITE * 0.5);
            rim.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`); rim.addColorStop(0.8, `rgba(${c[0]},${c[1]},${c[2]},0.42)`); rim.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
            b.fillStyle = rim; b.fillRect(0, 0, SPRITE, SPRITE);
        }
        const h = halo.getContext && halo.getContext("2d");
        if (h) {
            const g = h.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
            g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.85)`); g.addColorStop(0.3, `rgba(${c[0]},${c[1]},${c[2]},0.34)`);
            g.addColorStop(0.65, `rgba(${c[0]},${c[1]},${c[2]},0.08)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
            h.fillStyle = g; h.fillRect(0, 0, SPRITE, SPRITE);
        }
        const s = soft.getContext && soft.getContext("2d");
        if (s) {
            // Cloud lobe: smooth, wide, no hot core.
            const g = s.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
            g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.5)`); g.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},0.22)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
            s.fillStyle = g; s.fillRect(0, 0, SPRITE, SPRITE);
        }
        entry = { body, halo, soft, color: c, css: `rgb(${c[0]},${c[1]},${c[2]})`, hot: shade(c, 0.6) };
        sprites.set(key, entry);
        return entry;
    }

    // ---------- molecules ----------
    function randomUnit(out) {
        const z = range(-1, 1), a = range(0, TAU), r = Math.sqrt(1 - z * z);
        out[0] = r * Math.cos(a); out[1] = z; out[2] = r * Math.sin(a);
        return out;
    }
    function orbitBasis(shellTilt) {
        const n = randomUnit([0, 0, 0]);
        const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        let u = [n[1] * helper[2] - n[2] * helper[1], n[2] * helper[0] - n[0] * helper[2], n[0] * helper[1] - n[1] * helper[0]];
        const ul = Math.hypot(...u) || 1; u = u.map(v => v / ul);
        const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
        return { n, u, v, tilt: shellTilt };
    }

    function pickTemplate(settings) {
        if (state.forced !== null) return state.forced;
        const atomShare = clamp(tuning.atomShare, 0, 1);
        const soloLive = new Set(state.clusters.filter(c => c.tpl.solo).map(c => c.tpl.key));
        let total = 0;
        const weights = TEMPLATES.map((tpl, i) => {
            let w = tpl.weight * (tpl.atom ? atomShare : 1 - atomShare);
            if (i === state.lastTemplate) w *= 0.15;
            if (tpl.solo && soloLive.size) w *= 0.15;
            if (soloLive.has(tpl.key)) w = 0;
            total += w;
            return w;
        });
        let roll = random() * total;
        for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) return i; }
        return 0;
    }

    function spawn(settings, ageHint = 0) {
        const index = pickTemplate(settings);
        state.lastTemplate = index;
        const tpl = TEMPLATES[index];
        const life = tuning.lifeSeconds * range(0.7, 1.35);
        const cluster = {
            id: state.nextId++, tpl, index, age: ageHint, life: Math.max(tuning.formSeconds + tuning.dissolveSeconds + 1, life),
            hue: range(0, 6),
            pos: [0, 0, 0], vel: [range(-1, 1), range(-1, 1), range(-0.15, 0.15)],
            ang: [range(0, TAU), range(0, TAU), range(0, TAU)], rate: [range(-1, 1), range(-1, 1), range(-0.6, 0.6)],
            m: new Float64Array(9), unit: 0.3, atoms: [], electrons: [], bondState: [], burstDone: false, dissolveBurst: false
        };
        // Choose a free-ish spot: best of several random candidates.
        let best = null, bestScore = -1;
        for (let attempt = 0; attempt < 7; attempt++) {
            const p = [range(-state.extentX, state.extentX) * 1.02, range(-state.extentY, state.extentY) * 1.02, range(-0.7, 1.0)];
            let score = 4;
            for (const other of state.clusters) score = Math.min(score, Math.hypot(p[0] - other.pos[0], p[1] - other.pos[1]) - other.tpl.size * 0.5);
            if (score > bestScore) { bestScore = score; best = p; }
        }
        cluster.pos = best;
        const speed = range(0.04, 0.12);
        const vl = Math.hypot(cluster.vel[0], cluster.vel[1]) || 1;
        cluster.vel = [cluster.vel[0] / vl * speed, cluster.vel[1] / vl * speed, cluster.vel[2] * 0.05];
        const rl = Math.hypot(...cluster.rate) || 1;
        cluster.rate = cluster.rate.map(v => v / rl * range(0.35, 0.9));
        tpl.atoms.forEach((a, i) => {
            const delay = tpl.bohr ? (i % 3) * 0.05 : random() * tuning.formSeconds * 0.55;
            cluster.atoms.push({ i, tpl: a, delay, phase: range(0, TAU), wobble: range(0.7, 1.3), burst: range(0.5, 1.4),
                sx: 0, sy: 0, sz: 0, p: 1, r: 0, scale: 1, alpha: 1, col: null,
                lobeAxis: randomUnit([0, 0, 0]), lobeSpin: range(-0.5, 0.5) });
            // Valence electrons on tilted rings.
            if (!tpl.atom && a.el.e) {
                const gate = random();
                for (let e = 0; e < a.el.e; e++) {
                    cluster.electrons.push({ atom: i, shell: e, orbit: orbitBasis(), theta: range(0, TAU), gate,
                        omega: (e % 2 ? -1 : 1) * range(3.6, 5.4), radius: a.rad * (1.85 + 0.55 * e), flick: range(0, TAU) });
                }
            }
        });
        if (tpl.shells) {
            tpl.shells.forEach((count, s) => {
                const orbit = orbitBasis();
                const radius = [0.36, 0.64, 0.92][s] || 0.92;
                for (let e = 0; e < count; e++) {
                    cluster.electrons.push({ atom: -1, shell: s, orbit, theta: e * TAU / count + range(-0.2, 0.2), gate: 0,
                        omega: (s % 2 ? -1 : 1) * 4.2 / Math.pow(radius / 0.36, 1.5), radius, flick: range(0, TAU), shellOrbit: true });
                }
            });
        }
        tpl.bonds.forEach(([a, b, order], k) => {
            cluster.bondState.push({ a, b, order, delay: Math.max(cluster.atoms[a].delay, cluster.atoms[b].delay) + 0.18, phase: random(), speed: range(0.6, 1.4) });
        });
        state.clusters.push(cluster);
        return cluster;
    }

    function rotationMatrix(c) {
        const [ax, ay, az] = c.ang;
        const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
        const m = c.m;
        // R = Rz · Ry · Rx
        m[0] = cc * cb; m[1] = cc * sb * sa - sc * ca; m[2] = cc * sb * ca + sc * sa;
        m[3] = sc * cb; m[4] = sc * sb * sa + cc * ca; m[5] = sc * sb * ca - cc * sa;
        m[6] = -sb;     m[7] = cb * sa;                 m[8] = cb * ca;
    }

    // ---------- per-frame state ----------
    function measureFrame() {
        if (typeof performance === "undefined" || typeof performance.now !== "function") return;
        const now = performance.now();
        const interval = state.lastFrameAt === null ? 16.7 : now - state.lastFrameAt;
        state.lastFrameAt = now;
        if (interval <= 0 || interval > 250) return;
        state.frameAverage += (interval - state.frameAverage) * 0.05;
        // Shed shells and a few molecules first; the dance itself keeps its pace.
        if (state.guardLocked) { state.budget = 1; return; }
        if (state.frameAverage > 24) state.budget = Math.max(0.45, state.budget - 0.006);
        else if (state.frameAverage < 18) state.budget = Math.min(1, state.budget + 0.003);
    }

    function targetCount(settings, comp) {
        const density = clamp(finite(settings.density, 1600), 300, 3000);
        const base = 6 + 10 * (density - 300) / 2700;
        return Math.round(clamp(base * tuning.count * Math.min(1.8, Math.pow(Math.max(1, comp), 1.5)) * (0.55 + 0.45 * Math.min(state.budget, tuning.quality)), 0, 26));
    }

    function update(settings, width, height, seconds, comp, reach) {
        let dt = state.lastSeconds === null ? 0 : seconds - state.lastSeconds;
        const reentry = state.lastSeconds === null || dt > 1.5 || dt < -0.5;
        if (!reentry) dt = clamp(dt, 0, 0.1); else dt = 0;
        state.lastSeconds = seconds;
        const speed = clamp(finite(settings.speed, 0.5), 0, 2);
        const tempo = speed / 0.5;
        const sdt = dt * tempo;
        const S = 0.5 * Math.min(width, height);
        state.width = width; state.height = height;
        state.extentX = width / 2 / S * reach; state.extentY = height / 2 / S * reach;
        state.clock += sdt;
        state.frame++;

        // Bass: the shared pipeline swells baseSize on attacks (same detector as Mandelbrot Dive).
        const size = clamp(finite(settings.baseSize, 2.4), 0.5, 12);
        if (state.restSize === null || size < state.restSize) state.restSize = size;
        const swell = size / Math.max(0.1, state.restSize) - 1;
        state.swellTime = swell > 0.18 ? state.swellTime + dt : 0;
        if (state.swellTime > 0.6) { state.restSize = size; state.swellTime = 0; }
        else if (swell > 0 && swell < 0.18) state.restSize += (size - state.restSize) * Math.min(1, dt * 0.8);
        const previous = state.pulse;
        state.pulse = Math.max(swell > 0.12 ? swell : 0, state.pulse * Math.pow(0.02, dt));
        state.beat = state.pulse > 0.25 && previous <= 0.25;
        if (state.beat) { state.jump = 1; state.lurch = Math.min(1.5, state.lurch + 1); }
        state.jump = Math.max(0, state.jump - dt * 2.2);
        state.lurch = Math.max(0, state.lurch * Math.pow(0.12, dt));
        state.treble = clamp(finite(settings.trebleIntensity, 0), 0, 1.5);
        state.colorPhase += sdt * tuning.colorFlow * (1 + state.treble * 0.8) * 3;

        // Population: top up, or let the oldest molecules burst early when over target.
        const target = targetCount(settings, reach);
        const live = state.clusters.length;
        if (reentry || live === 0) {
            // Arriving (or returning): half the molecules assemble in front of you,
            // the rest are already mid-life, so the screen is full from the first moment.
            if (reentry) state.clusters.length = 0;
            for (let i = 0; i < target; i++) {
                spawn(settings, i % 2 ? range(0, tuning.formSeconds * 1.4) : range(tuning.formSeconds * 1.5, tuning.lifeSeconds * 0.7));
            }
        } else {
            let spawned = 0;
            while (state.clusters.length < target && spawned < 2) { spawn(settings, 0); spawned++; }
            if (state.clusters.length > target + 1) {
                const oldest = state.clusters.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
                if (oldest.life - oldest.age > tuning.dissolveSeconds) oldest.life = oldest.age + tuning.dissolveSeconds;
            }
        }

        const wobble = clamp(finite(settings.wobble, 0.14), 0, 1);
        const tumble = tuning.tumble * (0.65 + 0.35 * clamp(wobble / 0.14, 0, 3));
        for (const c of state.clusters) {
            c.age += sdt;
            c.pos[0] += c.vel[0] * sdt * tuning.drift;
            c.pos[1] += c.vel[1] * sdt * tuning.drift;
            c.pos[2] += c.vel[2] * sdt * tuning.drift;
            const spin = tumble * (1 + state.lurch * tuning.beatSpin * 2.2);
            for (let k = 0; k < 3; k++) c.ang[k] += c.rate[k] * sdt * spin;
            rotationMatrix(c);
        }
        state.clusters = state.clusters.filter(c => c.age < c.life);
        return { dt, sdt, tempo, S, comp };
    }

    // ---------- drawing ----------
    const out = [0, 0, 0];
    function project(c, lx, ly, lz, frame, depth) {
        const m = c.m, u = c.unit;
        const wx = c.pos[0] + (m[0] * lx + m[1] * ly + m[2] * lz) * u;
        const wy = c.pos[1] + (m[3] * lx + m[4] * ly + m[5] * lz) * u;
        const wz = c.pos[2] + (m[6] * lx + m[7] * ly + m[8] * lz) * u;
        const p = 1 / Math.max(0.35, 1 + 0.5 * depth * wz);
        out[0] = frame.cx + wx * frame.S * p;
        out[1] = frame.cy + wy * frame.S * p;
        out[2] = wz;
        return p;
    }

    const ease = {
        outBack: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
        smooth: t => t * t * (3 - 2 * t)
    };

    function drawSprite(ctx, img, x, y, size, alpha) {
        if (alpha <= 0.004 || size < 0.5) return;
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
    function drawLobe(ctx, img, x, y, dx, dy, length, width, alpha) {
        // An elongated soft blob along the screen direction (dx, dy).
        if (alpha <= 0.004) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        ctx.drawImage(img, -length / 2, -width / 2, length, width);
        ctx.restore();
    }

    const items = [];
    function render(ctx, width, height, settings, palette, frame) {
        const colors = paletteColors(palette);
        const depth = clamp(tuning.depth, 0, 2);
        const sizeMult = clamp(tuning.moleculeSize * clamp(finite(settings.baseSize, 2.4), 0.5, 12) / 2.4, 0.3, 3);
        const cloudBoost = tuning.cloudLevel * clamp(finite(settings.stretch, 1), 0, 3);
        const pulse = clamp(state.pulse * tuning.bassPulse, 0, 0.7);
        const jump = state.jump * tuning.bassJump;
        const treble = state.treble * tuning.trebleSparkle;
        const quality = Math.min(state.budget, tuning.quality);
        // The app's trail fade re-adds every bright additive pixel for several frames;
        // slower fades (longer trails) would otherwise whiten the glow.
        const glowK = clamp(finite(settings.dissipation, 0.3) / 0.3, 0.3, 1.5);
        const time = state.clock;
        frame.cx = width / 2; frame.cy = height / 2;
        items.length = 0;
        let atomCount = 0, bondCount = 0, electronCount = 0;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // --- background: quantum dust (additive) ---
        ctx.globalCompositeOperation = "lighter";
        const S = frame.S;
        const moteCount = Math.round(70 * tuning.motes * (0.4 + 0.6 * quality));
        for (let k = 0; k < moteCount; k++) {
            const mote = state.motes[k] || (state.motes[k] = { x: random(), y: random(), z: random(), p: random() * TAU, s: 0.4 + random() });
            const mx = (((mote.x + time * 0.004 * (0.4 + mote.z)) % 1) + 1) % 1, my = (((mote.y - time * 0.003 * (0.4 + mote.z)) % 1) + 1) % 1;
            const sx = mx * width, sy = my * height;
            const tw = 0.55 + 0.45 * Math.sin(time * 1.6 * mote.s + mote.p);
            const col = spriteFor(paletteAt(colors, mote.p + state.colorPhase));
            drawSprite(ctx, col.halo, sx, sy, (3 + 7 * mote.z) * (1 + treble * 0.6), (0.18 + 0.4 * mote.z) * tw * glowK);
        }

        // --- per-molecule geometry ---
        for (const c of state.clusters) {
            const tpl = c.tpl;
            c.unit = tpl.size * sizeMult;
            const d = c.life - c.age;
            const dis = d < tuning.dissolveSeconds ? 1 - d / Math.max(0.05, tuning.dissolveSeconds) : 0;
            const disE = dis * dis;
            const vibration = tuning.vibration * 0.07 * (1 + pulse * 3);
            const twist = tpl.twist ? time * tpl.twist : 0, ct = Math.cos(twist), st = Math.sin(twist);
            let cxs = 0, cys = 0, cp = 0;
            for (const a of c.atoms) {
                const t = a.tpl;
                const breathe = 1 + vibration * Math.sin(time * 5.2 * a.wobble + a.phase) + disE * 1.6 * a.burst;
                let lx = t.x * breathe, ly = t.y * breathe, lz = t.z * breathe;
                if (twist) { const x = lx * ct - lz * st, z = lx * st + lz * ct; lx = x; lz = z; }
                if (tpl.bohr) {
                    // Nucleons jostle inside the nucleus.
                    lx += 0.012 * Math.sin(time * 9 + a.phase); ly += 0.012 * Math.sin(time * 8 + a.phase * 2); lz += 0.012 * Math.sin(time * 10 + a.phase * 3);
                }
                a.lx = lx; a.ly = ly; a.lz = lz;
                const p = project(c, lx, ly, lz, frame, depth);
                a.sx = out[0]; a.sy = out[1]; a.sz = out[2]; a.p = p;
                const form = clamp((c.age - a.delay) / 0.55, 0, 1);
                a.scale = (form > 0 ? ease.outBack(form) : 0) * (1 + dis * 0.6);
                a.alpha = clamp(1 - Math.pow(dis, 1.5), 0, 1);
                a.r = t.rad * c.unit * S * p * a.scale * (1 + pulse * 0.45);
                const fog = 1 - 0.42 * clamp(depth, 0, 1.5) * clamp((a.sz + 0.2) / 1.4, 0, 1);
                a.fog = fog;
                const slot = t.el.slot + c.hue * 0.35 + (t.x * 0.7 + t.y * 0.5 + t.z * 0.3) * tpl.colorSpread;
                const rgb = paletteAt(colors, slot + state.colorPhase);
                a.sprite = spriteFor(rgb);
                cxs += a.sx; cys += a.sy; cp += a.p;
            }
            const n = c.atoms.length;
            c.sx = cxs / n; c.sy = cys / n; c.sp = cp / n;
            c.dis = dis;
            // Flash rings: one as it forms, one as it bursts.
            if (tuning.burstLevel > 0) {
                const col = spriteFor(paletteAt(colors, c.hue + state.colorPhase));
                const ringFor = (t, strength) => {
                    if (t <= 0 || t >= 1) return;
                    ctx.globalAlpha = clamp((1 - t) * 0.65 * tuning.burstLevel * strength, 0, 1);
                    ctx.strokeStyle = col.css;
                    ctx.lineWidth = Math.max(1, 3 * (1 - t) * c.sp);
                    ctx.beginPath();
                    ctx.arc(c.sx, c.sy, c.unit * S * c.sp * (0.2 + 1.7 * ease.smooth(t)), 0, TAU);
                    ctx.stroke();
                };
                ringFor(c.age / 0.9, 1);
                if (dis > 0) ringFor(dis, 1.2);
            }
            // Soft aura behind the whole molecule.
            const col = spriteFor(paletteAt(colors, c.hue + 1 + state.colorPhase));
            drawSprite(ctx, col.halo, c.sx, c.sy, c.unit * S * c.sp * 3.1, 0.11 * cloudBoost * (1 - dis) * (1 + pulse) * glowK);
        }

        // --- electron clouds (s, p, d lobes) and shells ---
        for (const c of state.clusters) {
            const tpl = c.tpl;
            for (const a of c.atoms) {
                if (a.alpha <= 0.01 || a.scale <= 0.02) continue;
                const orb = a.tpl.el.orb, glow = tuning.atomGlow;
                const fog = a.fog * a.alpha;
                // Halo
                drawSprite(ctx, a.sprite.halo, a.sx, a.sy, Math.max(4, a.r * 4.6), 0.34 * glow * fog * (1 + pulse * 0.8) * glowK);
                if (tpl.bohr || cloudBoost <= 0.01) continue;
                const spin = time * a.lobeSpin;
                // Project the lobe axis (rotated by the molecule) to the screen.
                const ax = a.lobeAxis[0], ay = a.lobeAxis[1], az = a.lobeAxis[2];
                const cs = Math.cos(spin), sn = Math.sin(spin);
                const rx = ax * cs - az * sn, rz = ax * sn + az * cs, ry = ay;
                const m = c.m;
                const sxv = m[0] * rx + m[1] * ry + m[2] * rz, syv = m[3] * rx + m[4] * ry + m[5] * rz;
                const flat = Math.hypot(sxv, syv), dx = flat > 0.001 ? sxv / flat : 1, dy = flat > 0.001 ? syv / flat : 0;
                const lobeAlpha = cloudBoost * fog * 0.42 * glowK;
                const R = a.r;
                if (orb === "s") {
                    drawSprite(ctx, a.sprite.soft, a.sx, a.sy, R * 4.2, lobeAlpha * 0.7);
                } else if (orb === "p") {
                    const reach = R * (1.5 + 0.8 * (1 - flat * 0.5)), len = R * 3.1, wid = R * 1.9 * (0.55 + 0.45 * flat);
                    drawLobe(ctx, a.sprite.soft, a.sx + dx * reach, a.sy + dy * reach, dx, dy, len, wid, lobeAlpha);
                    drawLobe(ctx, a.sprite.soft, a.sx - dx * reach, a.sy - dy * reach, dx, dy, len, wid, lobeAlpha);
                } else {
                    for (let k = 0; k < 4; k++) {
                        const angle = Math.atan2(dy, dx) + k * Math.PI / 2 + Math.PI / 4;
                        const lx = Math.cos(angle), ly = Math.sin(angle);
                        drawLobe(ctx, a.sprite.soft, a.sx + lx * R * 1.55, a.sy + ly * R * 1.55, lx, ly, R * 2.9, R * 1.5, lobeAlpha * 0.9);
                    }
                }
            }
            // Delocalised ring currents (benzene, graphene flake).
            for (const ring of tpl.rings) {
                if (c.dis >= 1 || c.age < tuning.formSeconds * 0.5) continue;
                const fade = clamp((c.age - tuning.formSeconds * 0.5) / 0.6, 0, 1) * (1 - c.dis);
                const sprite = spriteFor(paletteAt(colors, 2.5 + c.hue * 0.35 + state.colorPhase));
                const nSeg = quality > 0.7 ? 28 : 18;
                ctx.globalCompositeOperation = "lighter";
                ctx.strokeStyle = sprite.css;
                ctx.lineWidth = Math.max(1.5, 0.05 * c.unit * S * c.sp);
                ctx.globalAlpha = 0.22 * fade * tuning.atomGlow * glowK;
                ctx.beginPath();
                // Rings lie in the molecule's xz-plane for every template.
                for (let k = 0; k <= nSeg; k++) {
                    const ang = k / nSeg * TAU;
                    let lx = ring.c[0] + ring.r * Math.cos(ang), lz = ring.c[2] + ring.r * Math.sin(ang), ly = ring.c[1];
                    project(c, lx, ly, lz, frame, depth);
                    if (k === 0) ctx.moveTo(out[0], out[1]); else ctx.lineTo(out[0], out[1]);
                }
                ctx.stroke();
                ctx.lineWidth = Math.max(1, 0.016 * c.unit * S * c.sp);
                ctx.globalAlpha = 0.5 * fade;
                ctx.stroke();
                // Two electrons racing around the ring.
                for (let e = 0; e < 2; e++) {
                    const ang = time * 3.4 * tuning.electronSpeed * (1 + jump * 2) + e * Math.PI;
                    project(c, ring.c[0] + ring.r * Math.cos(ang), ring.c[1], ring.c[2] + ring.r * Math.sin(ang), frame, depth);
                    items.push({ z: out[2], type: 2, x: out[0], y: out[1], size: Math.max(5, 0.16 * c.unit * S * c.sp) * (1 + treble * 0.4), sprite, alpha: fade, hot: true });
                    electronCount++;
                }
            }
        }

        // --- electrons on shells ---
        const orbitShare = clamp(tuning.orbitLevel, 0, 1.5) * (0.5 + 0.5 * quality);
        for (const c of state.clusters) {
            const tpl = c.tpl;
            const dis = c.dis;
            for (const e of c.electrons) {
                if (!tpl.atom && e.gate > orbitShare * tpl.electronShare) continue;
                if (tpl.atom && tuning.orbitLevel <= 0.01) continue;
                const base = e.atom >= 0 ? c.atoms[e.atom] : null;
                const cx = base ? base.lx : 0, cy = base ? base.ly : 0, cz = base ? base.lz : 0;
                const born = base ? clamp((c.age - base.delay - 0.2) / 0.5, 0, 1) : clamp((c.age - 0.35 - e.shell * 0.15) / 0.5, 0, 1);
                if (born <= 0) continue;
                const fade = born * (1 - dis);
                if (fade <= 0.01) continue;
                const radius = e.radius * (1 + jump * 0.75 * (1 + e.shell * 0.4)) * (1 + dis * 1.5);
                const speed = e.omega * tuning.electronSpeed * (1 + jump * 2.4 + state.treble * 0.5) * (tpl.atom ? 1 : 1);
                if (state.lastDt !== undefined) e.theta += speed * state.lastDt;
                const { u, v } = e.orbit;
                // Shell tilt precesses slowly so atoms look like spinning gyroscopes.
                const prec = time * 0.35 * (e.shell + 1);
                const cp = Math.cos(prec), sp = Math.sin(prec);
                const uu = [u[0] * cp + v[0] * sp, u[1] * cp + v[1] * sp, u[2] * cp + v[2] * sp];
                const vv = [v[0] * cp - u[0] * sp, v[1] * cp - u[1] * sp, v[2] * cp - u[2] * sp];
                const col = base ? base.sprite : spriteFor(paletteAt(colors, 1.5 + e.shell * 1.4 + c.hue * 0.35 + state.colorPhase));
                const at = th => {
                    const k = Math.cos(th) * radius, l = Math.sin(th) * radius;
                    return project(c, cx + uu[0] * k + vv[0] * l, cy + uu[1] * k + vv[1] * l, cz + uu[2] * k + vv[2] * l, frame, depth);
                };
                const p = at(e.theta);
                const ex = out[0], ey = out[1], ez = out[2];
                // Streak behind the electron.
                const trail = tuning.trailLength * (0.3 + Math.abs(speed) * 0.1);
                if (trail > 0.02) {
                    ctx.globalCompositeOperation = "lighter";
                    ctx.strokeStyle = col.hot || col.css;
                    const dir = speed >= 0 ? -1 : 1;
                    for (let seg = 0; seg < 2; seg++) {
                        const t0 = e.theta + dir * trail * seg * 0.5, t1 = e.theta + dir * trail * (seg + 1) * 0.5;
                        at(t0); const x0 = out[0], y0 = out[1];
                        at(t1);
                        ctx.globalAlpha = (seg ? 0.14 : 0.34) * glowK * fade * (1 - 0.3 * clamp((ez + 0.2) / 1.4, 0, 1));
                        ctx.lineWidth = Math.max(1, (seg ? 1.2 : 2.0) * p * (1 + c.unit * S * 0.01));
                        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(out[0], out[1]); ctx.stroke();
                    }
                }
                // Faint orbit ring.
                if (quality > 0.55 && tuning.orbitLevel > 0.05) {
                    ctx.globalCompositeOperation = "lighter";
                    ctx.strokeStyle = col.css;
                    ctx.globalAlpha = (e.shellOrbit ? 0.2 : 0.09) * glowK * fade * tuning.orbitLevel;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    const nSeg = e.shellOrbit ? 40 : 22;
                    for (let k = 0; k <= nSeg; k++) {
                        at(k / nSeg * TAU);
                        if (k === 0) ctx.moveTo(out[0], out[1]); else ctx.lineTo(out[0], out[1]);
                    }
                    ctx.stroke();
                }
                const flick = treble > 0.02 ? Math.max(0, Math.sin(time * 17 + e.flick * 5) * Math.sin(time * 11 + e.flick)) : 0;
                items.push({ z: ez, type: 2, x: ex, y: ey, size: Math.max(5, (e.shellOrbit ? 0.075 : 0.05) * c.unit * S * p * 3.2) * (1 + jump * 0.5 + flick * treble * 1.2),
                    sprite: col, alpha: fade * (0.85 + 0.15 * jump) * (1 - 0.3 * clamp((ez + 0.2) / 1.4, 0, 1)), hot: true, glint: flick * treble > 0.35 ? flick * treble : 0 });
                electronCount++;
            }
        }

        // --- sorted pass: bonds, atoms, electrons ---
        for (const c of state.clusters) {
            const tpl = c.tpl;
            for (const a of c.atoms) {
                if (a.alpha <= 0.01 || a.scale <= 0.02) continue;
                items.push({ z: a.sz, type: 1, a, c });
                atomCount++;
            }
            for (const b of c.bondState) {
                const A = c.atoms[b.a], B = c.atoms[b.b];
                const grow = clamp((c.age - b.delay) / 0.4, 0, 1) * (1 - c.dis);
                if (grow <= 0.01 || A.alpha <= 0.01) continue;
                items.push({ z: (A.sz + B.sz) / 2, type: 0, b, A, B, c, grow });
                bondCount++;
            }
        }
        items.sort((p, q) => q.z - p.z);

        const bondW = tuning.bondWidth;

        for (const item of items) {
            if (item.type === 0) {
                const { A, B, c, b, grow } = item;
                // Dense molecules (buckyball, crystal) get quieter bond glow so they stay legible.
                const crowd = clamp(Math.sqrt(14 / Math.max(1, c.bondState.length)), 0.4, 1);
                const fog = Math.min(A.fog, B.fog) * (1 - c.dis);
                const x1 = A.sx, y1 = A.sy, x2 = A.sx + (B.sx - A.sx) * grow, y2 = A.sy + (B.sy - A.sy) * grow;
                const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
                if (len < 1) continue;
                const nx = -dy / len, ny = dx / len;
                const widthPx = Math.max(1.5, 0.058 * c.unit * S * (A.p + B.p) / 2 * bondW);
                const lines = b.order, gap = widthPx * (lines === 1 ? 0 : lines === 2 ? 1.0 : 1.5);
                const w = lines === 1 ? widthPx : lines === 2 ? widthPx * 0.62 : widthPx * 0.5;
                // Glow, then a gradient stick running from one atom's colour to the other's.
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = (0.12 + 0.35 * pulse) * fog * tuning.atomGlow * glowK * crowd;
                ctx.strokeStyle = A.sprite.css;
                ctx.lineWidth = widthPx * (1.5 + 0.6 * lines);
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                ctx.globalCompositeOperation = "source-over";
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, A.sprite.css); gradient.addColorStop(1, B.sprite.css);
                ctx.strokeStyle = gradient;
                ctx.globalAlpha = 0.92 * fog;
                ctx.lineWidth = w;
                for (let l = 0; l < lines; l++) {
                    const o = (l - (lines - 1) / 2) * gap;
                    ctx.beginPath(); ctx.moveTo(x1 + nx * o, y1 + ny * o); ctx.lineTo(x2 + nx * o, y2 + ny * o); ctx.stroke();
                }
                ctx.globalCompositeOperation = "lighter";
                ctx.strokeStyle = "rgb(255,255,255)";
                ctx.globalAlpha = (0.22 + 0.35 * pulse) * fog * glowK * crowd * crowd;
                ctx.lineWidth = Math.max(1, w * 0.28);
                ctx.beginPath(); ctx.moveTo(x1 - nx * w * 0.2, y1 - ny * w * 0.2); ctx.lineTo(x2 - nx * w * 0.2, y2 - ny * w * 0.2); ctx.stroke();
                // Shared-electron pulse travelling along the bond.
                const travel = ((time * 0.55 * b.speed + b.phase) % 1);
                const t = Math.abs(2 * travel - 1);
                drawSprite(ctx, A.sprite.halo, x1 + dx * t, y1 + dy * t, widthPx * 3.2 * (1 + pulse * 1.5), (0.5 + pulse) * fog * glowK * crowd * crowd);
            } else if (item.type === 1) {
                const a = item.a;
                const size = Math.max(3, a.r * 2);
                ctx.globalCompositeOperation = "source-over";
                drawSprite(ctx, a.sprite.body, a.sx, a.sy, size * 1.08, a.alpha * a.fog);
            } else {
                const e = item;
                ctx.globalCompositeOperation = "lighter";
                drawSprite(ctx, e.sprite.halo, e.x, e.y, e.size * 2.6, e.alpha * 0.9 * glowK);
                ctx.globalAlpha = Math.min(1, e.alpha);
                ctx.fillStyle = "rgb(255,255,255)";
                ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1.1, e.size * 0.11), 0, TAU); ctx.fill();
                if (e.glint) {
                    ctx.strokeStyle = e.sprite.hot; ctx.globalAlpha = Math.min(1, e.glint);
                    ctx.lineWidth = 1.2;
                    const g = e.size * (1.2 + e.glint * 1.6);
                    ctx.beginPath(); ctx.moveTo(e.x - g, e.y); ctx.lineTo(e.x + g, e.y); ctx.moveTo(e.x, e.y - g); ctx.lineTo(e.x, e.y + g); ctx.stroke();
                }
            }
        }
        ctx.restore();
        state.drawn = { atoms: atomCount, bonds: bondCount, electrons: electronCount };
    }

    function draw(ctx, width, height, seconds, settings, palette, outerSceneScale = 1) {
        if (!palette?.length || !Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return;
        measureFrame();
        const scene = clamp(finite(outerSceneScale, 1), 1, 4);
        const comp = Math.pow(scene, 0.75);
        // Molecules are spread over the area that can actually be seen: wider than
        // the screen while the camera is close, never more than the shrunk canvas.
        const reach = comp * clamp(1.5 / scene, 0.5, 1);
        const frame = update(settings, width, height, finite(seconds, 0), comp, reach);
        state.lastDt = frame.sdt;
        state.wallClock = finite(seconds, 0);
        frame.comp = comp;
        ctx.save();
        // Veil Drift zoom can enlarge the scene ~1.8x. Molecules live in their own
        // space and are drawn shrunk by most of that zoom (residual ~zoom^0.25),
        // so the screen stays full of molecules; their extents grow to match.
        if (comp > 1.0001) {
            ctx.translate(width * 0.5, height * 0.5);
            ctx.scale(1 / comp, 1 / comp);
            ctx.translate(-width * 0.5, -height * 0.5);
        }
        const segments = kaleidoSegments(settings);
        if (segments >= 3 && typeof document !== "undefined") {
            // The app's kaleidoscope (toggle or Flow): render the dance once into a
            // layer, then lay mirrored, rotated copies over the screen like the
            // app's own particle mirror does.
            const dpr = ctx.canvas && ctx.canvas.width ? ctx.canvas.width / width : 1;
            const layer = ensureLayer(width, height, dpr);
            layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            layer.ctx.clearRect(0, 0, width, height);
            render(layer.ctx, width, height, settings, palette, frame);
            const step = TAU / segments, spin = settings.spinningKaleido ? state.wallClock * 0.12 : 0;
            ctx.globalAlpha = 1;
            if (typeof window !== "undefined" && window.drawWedgeKaleidoscope) {
                // Same true kaleidoscope as every other scene (js/simulation.js).
                window.drawWedgeKaleidoscope(ctx, layer.canvas, width, height, segments, spin);
            } else {
                ctx.drawImage(layer.canvas, 0, 0, width, height);
            }
        } else {
            render(ctx, width, height, settings, palette, frame);
        }
        ctx.restore();
    }

    function kaleidoSegments(settings) {
        if (!settings || !settings.kaleidoscopeEnabled) return 0;
        const segments = Math.floor(clamp(finite(settings.kaleidoscopeSegments, 6), 3, 16));
        return segments >= 3 ? segments : 0;
    }
    function ensureLayer(width, height, dpr) {
        if (!state.layer) {
            const canvas = document.createElement("canvas");
            state.layer = { canvas, ctx: canvas.getContext("2d") };
        }
        const w = Math.max(2, Math.round(width * dpr)), h = Math.max(2, Math.round(height * dpr));
        if (state.layer.canvas.width !== w || state.layer.canvas.height !== h) { state.layer.canvas.width = w; state.layer.canvas.height = h; }
        return state.layer;
    }

    function reset() {
        Object.assign(state, { clusters: [], nextId: 1, seed: 7, clock: 0, lastSeconds: null, colorPhase: 0, restSize: null, swellTime: 0,
            pulse: 0, treble: 0, jump: 0, lurch: 0, beat: false, lastTemplate: -1, budget: 1, frameAverage: 16.7,
            lastFrameAt: null, motes: [], blobs: [], lastDt: undefined, layer: null });
    }
    function setTuning(values) {
        for (const key of Object.keys(DEFAULT_TUNING)) {
            if (values && Number.isFinite(Number(values[key]))) tuning[key] = Number(values[key]);
        }
        tuning.count = clamp(tuning.count, 0, 3);
        tuning.moleculeSize = clamp(tuning.moleculeSize, 0.3, 3);
        tuning.lifeSeconds = clamp(tuning.lifeSeconds, 2.5, 60);
        tuning.formSeconds = clamp(tuning.formSeconds, 0.1, 6);
        tuning.dissolveSeconds = clamp(tuning.dissolveSeconds, 0.1, 6);
        tuning.atomShare = clamp(tuning.atomShare, 0, 1);
        tuning.depth = clamp(tuning.depth, 0, 2);
        tuning.quality = clamp(tuning.quality, 0.4, 1);
        return { ...tuning };
    }
    function forceTemplate(key) {
        const index = TEMPLATES.findIndex(t => t.key === key);
        state.forced = index >= 0 ? index : null;
        state.clusters.length = 0;
    }
    function lockBudget(locked) { state.guardLocked = !!locked; if (locked) state.budget = 1; }
    function seek(seconds) { state.clock = Math.max(0, finite(seconds, 0)); }
    function respawn() { state.clusters.length = 0; }
    function replayEntry() { state.lastSeconds = null; }
    function inspect() {
        return { clusters: state.clusters.length, clock: state.clock, budget: state.budget, pulse: state.pulse, jump: state.jump, lurch: state.lurch,
            colorPhase: state.colorPhase, treble: state.treble, drawn: state.drawn, extentX: state.extentX, extentY: state.extentY,
            templates: TEMPLATES.map(t => ({ key: t.key, name: t.name, atoms: t.atoms.length, bonds: t.bonds.length })),
            live: state.clusters.map(c => ({ key: c.tpl.key, age: c.age, life: c.life, x: c.pos[0], y: c.pos[1], z: c.pos[2] })) };
    }

    return { draw, reset, setTuning, seek, respawn, forceTemplate, lockBudget, kaleidoSegments, replayEntry, inspect, parseColor, paletteColors, TEMPLATES, ELEMENTS, DEFAULT_TUNING, tuning };
})();

if (typeof window !== "undefined") window.MolecularDance = MolecularDance;
if (typeof module !== "undefined" && module.exports) module.exports = MolecularDance;
