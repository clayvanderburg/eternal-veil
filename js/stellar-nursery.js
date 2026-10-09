// Stellar Nursery: an emission nebula you drift through. Ridged, glowing gas
// filaments (hydrogen, oxygen and sulphur colours taken from the palette) sweep
// across the screen in three parallax layers; dark dust lanes lie over them and
// carve silhouettes; newborn stars ignite inside the gas with hot cores and
// diffraction spikes; a field of stars twinkles behind it all. Bass sends an
// ionisation shockwave rolling through the clouds (they brighten and bulge as it
// passes); treble makes the stars flare. Gas is built from procedurally
// generated noise textures (made once, tinted and cached per colour) drawn on
// the shared 2D canvas, so the cost is a few hundred sprite blits per frame.
const StellarNursery = (() => {
    const TAU = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const finite = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };
    const smooth = t => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

    // Artistic tunables. Nursery Lab edits these live; the preset uses these
    // defaults. Several are multiplied with the matching app setting
    // (speed, baseSize, density, stretch, wobble, rotationSpeed, dissipation).
    const DEFAULT_TUNING = {
        gasLevel: 0.44,       // brightness of the glowing gas
        dustLevel: 0.25,       // darkness of the dust lanes laid over it
        filaments: 3,       // number of gas filaments (× density)
        cloudScale: 1.78,      // size of the gas puffs
        detail: 0.82,          // share of fine, sharp ridges inside the gas
        swirl: 3,           // how much the filaments undulate and bend
        drift: 4,           // how fast the gas drifts
        depth: 1.2,           // parallax between the layers (camera sway)
        coreLevel: 0.07,       // brightness of newborn-star cores
        cores: 1.69,           // how many filaments hold a newborn star
        starDensity: 3,     // stars in the field
        starSize: 1,        // star size (× baseSize / 2.4)
        spikeLevel: 0.8,      // diffraction spikes on bright stars
        twinkle: 1.13,         // star shimmer
        colorFlow: 0.21,      // palette cycles per second across the gas
        colorSpread: 0.83,     // how many palette colours show at once in one filament
        lifeSeconds: 124,      // average life of a filament before it fades away
        fadeSeconds: 12,      // fade in / out time
        bassPulse: 1,       // bass → gas and cores swell
        bassWave: 1,        // bass → ionisation shockwave through the clouds
        trebleSparkle: 1,   // treble → stars flare, spikes lengthen
        quality: 1          // cap on detail; the frame guard can lower it further
    };
    const tuning = { ...DEFAULT_TUNING };

    const state = {
        seed: 11, nextId: 1, clock: 0, lastSeconds: null, colorPhase: 0, restSize: null, swellTime: 0,
        pulse: 0, treble: 0, beat: false, budget: 1, frameAverage: 16.7, lastFrameAt: null, guardLocked: false,
        filaments: [], stars: [], waves: [], starCount: 0, layer: null, frame: 0, camX: 0, camY: 0,
        extentX: 1.8, extentY: 1, lastDt: undefined, wallClock: 0, drawn: { puffs: 0, dust: 0, stars: 0, cores: 0 }
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
    const paletteCache = { key: "", colors: [[170, 90, 255]] };
    function paletteColors(palette) {
        const key = palette.join(",");
        if (key === paletteCache.key) return paletteCache.colors;
        paletteCache.key = key;
        const colors = palette.slice(0, 6).map(c => parseColor(c) || [170, 90, 255]);
        paletteCache.colors = colors.length ? colors : [[170, 90, 255]];
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

    // ---------- procedural gas textures (white + alpha, tinted later) ----------
    const TEX = 128;
    function hash(ix, iy, s) {
        let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }
    function vnoise(x, y, s) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, s, octaves) {
        let sum = 0, amp = 0.5, f = 1, norm = 0;
        for (let i = 0; i < octaves; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
        return sum / norm;
    }
    function makeCanvas(size) {
        if (typeof document === "undefined") return { width: size, height: size, dummy: true, getContext: () => null };
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        return canvas;
    }
    // Each texture function returns alpha 0..1 for a point (nx, ny) in -1..1.
    const TEXTURES = [
        { key: "puff0", kind: "gas", fn: (nx, ny, r2) => {                     // round, cottony
            const fall = Math.max(0, 1 - r2), f = fbm(nx * 1.7 + 3.1, ny * 1.7 + 1.7, 11, 5);
            return Math.pow(fall, 1.45) * (0.1 + 1.5 * f * f);
        } },
        { key: "puff1", kind: "gas", fn: (nx, ny, r2) => {
            const fall = Math.max(0, 1 - r2), f = fbm(nx * 2.3 + 8.4, ny * 2.3 + 5.2, 29, 5);
            return Math.pow(fall, 1.3) * (0.05 + 1.7 * f * f * f);
        } },
        { key: "wisp0", kind: "ridge", fn: (nx, ny) => {                      // sharp streaky ridges
            const fall = Math.max(0, 1 - (nx * nx + ny * ny * 3.3));
            const n = fbm(nx * 1.1 + 5, ny * 5.2 + 2, 23, 5);
            return Math.pow(fall, 1.15) * Math.pow(1 - Math.abs(2 * n - 1), 2.4) * 1.35;
        } },
        { key: "wisp1", kind: "ridge", fn: (nx, ny) => {
            const fall = Math.max(0, 1 - (nx * nx + ny * ny * 4.2));
            const n = fbm(nx * 1.4 + 11, ny * 6.5 + 7, 53, 5);
            return Math.pow(fall, 1.0) * Math.pow(1 - Math.abs(2 * n - 1), 3.0) * 1.5;
        } },
        { key: "veil", kind: "gas", fn: (nx, ny, r2) => {                     // faint broad haze
            const fall = Math.max(0, 1 - r2);
            return Math.pow(fall, 1.15) * (0.5 + 0.5 * fbm(nx * 1.1 + 2, ny * 1.1 + 9, 5, 3));
        } },
        { key: "dust0", kind: "dust", fn: (nx, ny, r2) => {                    // patchy opaque dust
            const fall = Math.max(0, 1 - r2), n = fbm(nx * 2.2 + 9, ny * 2.2 + 4, 41, 5);
            return Math.pow(fall, 0.9) * smooth((n - 0.34) / 0.34);
        } },
        { key: "dust1", kind: "dust", fn: (nx, ny, r2) => {
            const fall = Math.max(0, 1 - (nx * nx + ny * ny * 1.8)), n = fbm(nx * 1.8 + 3, ny * 3.4 + 13, 67, 5);
            return Math.pow(fall, 0.9) * smooth((n - 0.38) / 0.3);
        } },
        { key: "glow", kind: "star", fn: (nx, ny, r2) => Math.pow(Math.max(0, 1 - Math.sqrt(r2)), 2.3) },
        { key: "spike", kind: "star", fn: (nx, ny) => Math.exp(-ny * ny * 420) * Math.pow(Math.max(0, 1 - Math.abs(nx)), 2.6) }
    ];
    const TEX_INDEX = {};
    TEXTURES.forEach((t, i) => { TEX_INDEX[t.key] = i; });
    const GAS = [TEX_INDEX.puff0, TEX_INDEX.puff1], RIDGE = [TEX_INDEX.wisp0, TEX_INDEX.wisp1], DUST = [TEX_INDEX.dust0, TEX_INDEX.dust1];
    const T_VEIL = TEX_INDEX.veil, T_GLOW = TEX_INDEX.glow, T_SPIKE = TEX_INDEX.spike;

    const whites = [];
    function whiteTexture(index) {
        if (whites[index]) return whites[index];
        const canvas = makeCanvas(TEX);
        const c = canvas.getContext && canvas.getContext("2d");
        if (c) {
            const img = c.createImageData(TEX, TEX), d = img.data, fn = TEXTURES[index].fn;
            for (let y = 0; y < TEX; y++) {
                for (let x = 0; x < TEX; x++) {
                    const nx = (x + 0.5) / TEX * 2 - 1, ny = (y + 0.5) / TEX * 2 - 1;
                    const a = clamp(fn(nx, ny, nx * nx + ny * ny), 0, 1), o = (y * TEX + x) * 4;
                    d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(a * 255);
                }
            }
            c.putImageData(img, 0, 0);
        }
        whites[index] = canvas;
        return canvas;
    }
    const tinted = new Map();
    function sprite(index, rgb) {
        const qr = rgb[0] >> 4, qg = rgb[1] >> 4, qb = rgb[2] >> 4;
        const key = (index << 12) | (qr << 8) | (qg << 4) | qb;
        let entry = tinted.get(key);
        if (entry) return entry;
        if (tinted.size > 900) tinted.clear();
        const canvas = makeCanvas(TEX), c = canvas.getContext && canvas.getContext("2d");
        if (c) {
            c.drawImage(whiteTexture(index), 0, 0);
            c.globalCompositeOperation = "source-in";
            c.fillStyle = `rgb(${qr * 16 + 8},${qg * 16 + 8},${qb * 16 + 8})`;
            c.fillRect(0, 0, TEX, TEX);
        }
        tinted.set(key, canvas);
        return canvas;
    }

    // ---------- scene model ----------
    // World units: 1 = half of the shorter screen side; x and y extents are the
    // visible half-sizes (state.extentX / extentY), grown while the camera zooms.
    const LAYERS = [
        { z: 0.35, scale: 0.8, alpha: 0.7, share: 0.4 },   // far: small, faint, barely shifts
        { z: 0.75, scale: 1.0, alpha: 1.0, share: 0.4 },   // middle
        { z: 1.25, scale: 1.55, alpha: 0.5, share: 0.2 }   // near: big, soft, shifts the most
    ];
    function pickLayer() {
        let u = random();
        for (let i = 0; i < LAYERS.length; i++) { u -= LAYERS[i].share; if (u <= 0) return i; }
        return 1;
    }

    // Best-candidate placement: of a few random spots take the one farthest from
    // existing filaments, so the nebula covers the screen instead of clumping.
    const pos = { x: 0, y: 0 };
    function bestPosition() {
        let best = -1;
        for (let k = 0; k < 7; k++) {
            const x = range(-1, 1) * state.extentX * 1.05, y = range(-1, 1) * state.extentY * 1.05;
            let nearest = 1e9;
            for (const f of state.filaments) { const d = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y); if (d < nearest) nearest = d; }
            if (nearest > best) { best = nearest; pos.x = x; pos.y = y; }
        }
        return pos;
    }

    function spawnFilament(settings, ageHint) {
        const layer = pickLayer();
        const L = LAYERS[layer];
        const n = 7 + Math.floor(random() * 4);
        const heading = state.clock * 0.011 + 0.6;   // slowly turning prevailing wind
        const windAngle = heading + range(-0.9, 0.9);
        const windSpeed = range(0.006, 0.02) * (0.5 + L.z * 0.7);
        const pos = bestPosition();
        const f = {
            id: state.nextId++, layer,
            x: pos.x, y: pos.y,
            vx: Math.cos(windAngle) * windSpeed, vy: Math.sin(windAngle) * windSpeed,
            ang: random() < 0.45 ? windAngle + range(-0.5, 0.5) : random() * Math.PI, len: range(1.2, 2.4), curve: range(-1.1, 1.1),
            spin: range(-0.02, 0.02), phase: random() * TAU, undulate: range(0.5, 1.2),
            u0: random() * 6, age: ageHint, life: tuning.lifeSeconds * range(0.7, 1.3), puffs: [], dust: [], core: null
        };
        for (let i = 0; i < n; i++) {
            const ridge = random() < 0.5;
            f.puffs.push({
                t: i / (n - 1) - 0.5, jx: range(-1, 1) * 0.09, jy: range(-1, 1) * 0.09, r: range(0.7, 1.35), a: range(0.65, 1),
                tex: ridge ? RIDGE[random() < 0.5 ? 0 : 1] : GAS[random() < 0.5 ? 0 : 1], ridge, hue: random() - 0.5,
                rank: random(), rot: range(-0.5, 0.5)
            });
        }
        // A haze puff behind the whole filament.
        f.puffs.push({ t: range(-0.1, 0.1), jx: 0, jy: 0, r: range(2.4, 3.2), a: 0.6, tex: T_VEIL, ridge: false, hue: range(-0.3, 0.3), rank: -1, rot: 0 });
        const dustCount = 3 + Math.floor(random() * 2);
        for (let i = 0; i < dustCount; i++) {
            f.dust.push({ t: range(-0.5, 0.5), side: random() < 0.5 ? -1 : 1, off: range(0.05, 0.2), r: range(0.55, 1.05), a: range(0.6, 1), tex: DUST[random() < 0.5 ? 0 : 1], rot: range(-0.6, 0.6), rank: random() });
        }
        if (random() < clamp(0.5 * tuning.cores, 0, 1)) {
            f.core = { t: range(-0.25, 0.25), side: range(-0.04, 0.04), r: range(0.13, 0.3), phase: random() * TAU, rate: range(0.4, 1.1), spike: random() < 0.65, hue: random() };
        }
        state.filaments.push(f);
        return f;
    }

    function spawnStars(count) {
        state.stars.length = 0;
        for (let i = 0; i < count; i++) {
            const mag = Math.pow(random(), 2.6);   // few bright, many faint
            const kindRoll = random();
            state.stars.push({
                x: random(), y: random(), z: range(0.25, 1.4), mag, tw: random() * TAU, rate: range(0.6, 2.4),
                color: kindRoll < 0.5 ? 0 : kindRoll < 0.78 ? 1 : 2, u: random() * 6, spike: mag > 0.55 && random() < 0.8
            });
        }
        state.starCount = count;
    }

    function measureFrame() {
        if (typeof performance === "undefined" || typeof performance.now !== "function") return;
        const now = performance.now();
        const interval = state.lastFrameAt === null ? 16.7 : now - state.lastFrameAt;
        state.lastFrameAt = now;
        if (interval <= 0 || interval > 250) return;
        state.frameAverage += (interval - state.frameAverage) * 0.05;
        // Shed fine ridges, haze and stars first; the big gas shapes stay.
        if (state.guardLocked) { state.budget = 1; return; }
        if (state.frameAverage > 24) state.budget = Math.max(0.45, state.budget - 0.006);
        else if (state.frameAverage < 18) state.budget = Math.min(1, state.budget + 0.003);
    }
    const effort = () => Math.min(state.budget, tuning.quality);

    function filamentTarget(settings, comp) {
        const density = clamp(finite(settings.density, 1600), 300, 3000);
        const base = 8 + 10 * (density - 300) / 2700;
        return Math.round(clamp(base * tuning.filaments * Math.min(1.8, Math.pow(Math.max(1, comp), 1.2)) * (0.6 + 0.4 * effort()), 0, 26));
    }
    function starTarget(settings) {
        const density = clamp(finite(settings.density, 1600), 300, 3000);
        return Math.round(clamp((110 + 200 * (density - 300) / 2700) * tuning.starDensity * (0.5 + 0.5 * effort()), 0, 640));
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
        state.pulse = Math.max(swell > 0.12 ? swell : 0, state.pulse * Math.pow(0.03, dt));
        state.beat = state.pulse > 0.25 && previous <= 0.25;
        state.treble = clamp(finite(settings.trebleIntensity, 0), 0, 1.5);
        state.colorPhase += sdt * tuning.colorFlow * 3;

        // Slow camera sway: this is what separates the parallax layers.
        state.camX = Math.sin(state.clock * 0.05) * 0.28 * tuning.depth;
        state.camY = Math.cos(state.clock * 0.037 + 1.3) * 0.2 * tuning.depth;

        // Filaments: top up, retire the oldest when over target.
        const target = filamentTarget(settings, reach);
        if (reentry || state.filaments.length === 0) {
            // Arriving (or returning): the nebula is already there, mid-life, from the first frame.
            state.filaments.length = 0;
            for (let i = 0; i < target; i++) spawnFilament(settings, range(0, tuning.lifeSeconds * 0.8));
        } else {
            let spawned = 0;
            while (state.filaments.length < target && spawned < 1) { spawnFilament(settings, 0); spawned++; }
            if (state.filaments.length > target + 1) {
                const oldest = state.filaments.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
                if (oldest.life - oldest.age > tuning.fadeSeconds) oldest.life = oldest.age + tuning.fadeSeconds;
            }
        }
        const wantStars = starTarget(settings);
        if (reentry || Math.abs(wantStars - state.starCount) > Math.max(24, state.starCount * 0.25)) spawnStars(wantStars);

        const spinK = clamp(finite(settings.rotationSpeed, 0.02), 0, 0.5) / 0.02;
        for (const f of state.filaments) {
            f.age += sdt;
            f.x += f.vx * sdt * tuning.drift; f.y += f.vy * sdt * tuning.drift;
            f.ang += f.spin * spinK * sdt;
            // Wandered far off screen: let it fade instead of drifting forever.
            if (Math.abs(f.x) > state.extentX * 2.2 + 1 || Math.abs(f.y) > state.extentY * 2.2 + 1) f.life = Math.min(f.life, f.age + tuning.fadeSeconds * 0.5);
        }
        state.filaments = state.filaments.filter(f => f.age < f.life);

        // Shockwaves from bass attacks.
        if (state.beat && tuning.bassWave > 0.01 && state.waves.length < 3) {
            state.waves.push({ x: range(-0.7, 0.7) * state.extentX, y: range(-0.7, 0.7) * state.extentY, r: 0.05, age: 0, strength: clamp(0.6 + state.pulse, 0.6, 1.4), u: random() * 6 });
        }
        for (const w of state.waves) { w.age += sdt; w.r += sdt * 0.85; }
        state.waves = state.waves.filter(w => w.r < 2.6);
        return { dt, sdt, tempo, S, comp };
    }

    // ---------- drawing ----------
    function blit(ctx, img, x, y, w, h, rot, alpha) {
        ctx.globalAlpha = alpha;
        if (rot) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        } else ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    }
    const rgbTmp = [0, 0, 0];

    // Brightening and outward push from the shockwaves, at world point (x, y).
    const waveOut = { glow: 0, dx: 0, dy: 0 };
    function waveAt(x, y) {
        waveOut.glow = 0; waveOut.dx = 0; waveOut.dy = 0;
        for (const w of state.waves) {
            const dx = x - w.x, dy = y - w.y, d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
            const width = 0.16 + 0.1 * w.r, off = (d - w.r) / width;
            const bump = Math.exp(-off * off) * w.strength * Math.max(0, 1 - w.r / 2.6) * tuning.bassWave;
            waveOut.glow += bump; waveOut.dx += dx / d * bump * 0.05; waveOut.dy += dy / d * bump * 0.05;
        }
    }

    function render(ctx, width, height, settings, palette, frame) {
        const colors = paletteColors(palette);
        const S = frame.S, cx = width / 2, cy = height / 2;
        const clock = state.clock, comp = frame.comp;
        const dissipation = clamp(finite(settings.dissipation, 0.3), 0.005, 1);
        // Keep brightness steady whatever the trail fade is set to: slower fades
        // pile up more frames, so each frame is drawn dimmer.
        const expo = clamp(Math.pow(dissipation / 0.3, 0.85), 0.05, 1.6);
        const stretchK = clamp(finite(settings.stretch, 1.2), 0.3, 4) / 1.2;
        const wobbleK = clamp(finite(settings.wobble, 0.14), 0, 1) / 0.14;
        const swirlK = tuning.swirl * (0.5 + 0.5 * clamp(wobbleK, 0, 3));
        const sizeK = Math.sqrt(clamp(finite(settings.baseSize, 2.4), 0.5, 12) / 2.4);
        const bassBoost = 1 + clamp(state.pulse, 0, 0.7) * tuning.bassPulse * 0.55;
        const hasWaves = state.waves.length > 0;
        const q = effort();
        const drawn = state.drawn; drawn.puffs = 0; drawn.dust = 0; drawn.stars = 0; drawn.cores = 0;
        const cloud = tuning.cloudScale;
        const minX = -width * 0.2, maxX = width * 1.2, minY = -height * 0.2, maxY = height * 1.2;

        ctx.globalCompositeOperation = "source-over";
        drawStars(ctx, width, height, S, 0, frame, colors, expo, sizeK, q);   // distant stars first

        for (let li = 0; li < LAYERS.length; li++) {
            const L = LAYERS[li];
            const shiftX = state.camX * L.z, shiftY = state.camY * L.z;
            // ---- gas (additive) ----
            ctx.globalCompositeOperation = "lighter";
            for (const f of state.filaments) {
                if (f.layer !== li) continue;
                const env = smooth(Math.min(f.age / tuning.fadeSeconds, (f.life - f.age) / tuning.fadeSeconds, 1));
                if (env <= 0.002) continue;
                const cos = Math.cos(f.ang), sin = Math.sin(f.ang);
                const len = f.len * cloud;
                for (const p of f.puffs) {
                    // Fine ridges are the first thing to go (detail slider, then the frame guard); so is the haze.
                    if (p.ridge) { if (p.rank > tuning.detail * q) continue; }
                    else if (p.rank < 0 && q < 0.6) continue;
                    const along = p.t * len;
                    const bend = f.curve * (p.t * p.t - 0.083) * len;
                    const wob = Math.sin(clock * 0.32 * f.undulate + f.phase + p.t * 5.2) * 0.06 * len * swirlK;
                    let wx = f.x + cos * along - sin * (bend + wob) + p.jx * len;
                    let wy = f.y + sin * along + cos * (bend + wob) + p.jy * len;
                    let lit = 0;
                    if (hasWaves) { waveAt(wx, wy); wx += waveOut.dx * cloud; wy += waveOut.dy * cloud; lit = waveOut.glow; }
                    const sx = cx + (wx - shiftX) * S, sy = cy + (wy - shiftY) * S;
                    const radius = p.r * (p.ridge ? 0.27 : 0.5) * cloud * L.scale * S;
                    if (sx + radius * 2 < minX || sx - radius * 2 > maxX || sy + radius * 2 < minY || sy - radius * 2 > maxY) continue;
                    const u = f.u0 + (p.t + 0.5) * tuning.colorSpread * 3 + p.hue * tuning.colorSpread * 2 + state.colorPhase;
                    const rgb = paletteAt(colors, u);
                    rgbTmp[0] = rgb[0]; rgbTmp[1] = rgb[1]; rgbTmp[2] = rgb[2];
                    const img = sprite(p.tex, rgbTmp);
                    const alpha = p.a * (p.tex === T_VEIL ? 0.06 : p.ridge ? 0.24 : 0.28) * L.alpha * env * tuning.gasLevel * expo * bassBoost * (1 + lit * 1.4);
                    if (alpha < 0.002) continue;
                    if (p.ridge) {
                        const dw = radius * 2 * (1 + stretchK * 0.55), dh = radius * 2 * 0.62;
                        blit(ctx, img, sx, sy, dw, dh, f.ang + p.rot * 0.4, Math.min(1, alpha));
                    } else {
                        blit(ctx, img, sx, sy, radius * 2, radius * 2 * (p.tex === T_VEIL ? 0.8 : 1), f.ang + p.rot, Math.min(1, alpha));
                    }
                    drawn.puffs++;
                }
            }
            // ---- newborn-star cores sit in the gas, before the dust covers them ----
            for (const f of state.filaments) {
                if (f.layer !== li || !f.core || tuning.coreLevel < 0.01) continue;
                const env = smooth(Math.min(f.age / tuning.fadeSeconds, (f.life - f.age) / tuning.fadeSeconds, 1));
                if (env <= 0.01) continue;
                const k = f.core, cos = Math.cos(f.ang), sin = Math.sin(f.ang), len = f.len * cloud;
                const along = k.t * len, bend = f.curve * (k.t * k.t - 0.083) * len;
                const wx = f.x + cos * along - sin * (bend + k.side * len), wy = f.y + sin * along + cos * (bend + k.side * len);
                const sx = cx + (wx - shiftX) * S, sy = cy + (wy - shiftY) * S;
                const flicker = 0.82 + 0.18 * Math.sin(clock * k.rate * 1.7 + k.phase) + state.treble * tuning.trebleSparkle * 0.18 * Math.sin(clock * 21 + k.phase * 3);
                const flare = (1 + clamp(state.pulse, 0, 0.7) * tuning.bassPulse * 1.2) * flicker;
                const radius = k.r * cloud * L.scale * S * (0.9 + 0.1 * flare);
                if (sx + radius * 3 < minX || sx - radius * 3 > maxX || sy + radius * 3 < minY || sy - radius * 3 > maxY) continue;
                const rgb = paletteAt(colors, f.u0 + state.colorPhase + k.hue * 2 + 0.6);
                rgbTmp[0] = Math.min(255, rgb[0] * 0.7 + 90); rgbTmp[1] = Math.min(255, rgb[1] * 0.7 + 90); rgbTmp[2] = Math.min(255, rgb[2] * 0.7 + 90);
                const halo = sprite(T_GLOW, rgbTmp);
                const a = env * tuning.coreLevel * expo * L.alpha;
                blit(ctx, halo, sx, sy, radius * 5.2, radius * 5.2, 0, Math.min(1, 0.32 * a * flare));
                blit(ctx, halo, sx, sy, radius * 2.2, radius * 2.2, 0, Math.min(1, 0.7 * a * flare));
                rgbTmp[0] = 255; rgbTmp[1] = 248; rgbTmp[2] = 240;
                blit(ctx, sprite(T_GLOW, rgbTmp), sx, sy, radius * 0.9, radius * 0.9, 0, Math.min(1, 0.95 * a * flare));
                if (k.spike && tuning.spikeLevel > 0.01) {
                    const spikeLen = radius * (5 + 3 * state.treble * tuning.trebleSparkle) * tuning.spikeLevel;
                    const spk = sprite(T_SPIKE, rgbTmp), sa = Math.min(1, 0.5 * a * flare);
                    blit(ctx, spk, sx, sy, spikeLen, spikeLen * 0.5, 0.0 + k.phase * 0.05, sa);
                    blit(ctx, spk, sx, sy, spikeLen, spikeLen * 0.5, Math.PI / 2 + k.phase * 0.05, sa);
                }
                drawn.cores++;
            }
            // ---- dust (opaque dark) lies over this layer's gas and everything behind ----
            if (tuning.dustLevel > 0.01) {
                ctx.globalCompositeOperation = "source-over";
                for (const f of state.filaments) {
                    if (f.layer !== li) continue;
                    const env = smooth(Math.min(f.age / tuning.fadeSeconds, (f.life - f.age) / tuning.fadeSeconds, 1));
                    if (env <= 0.01) continue;
                    const cos = Math.cos(f.ang), sin = Math.sin(f.ang), len = f.len * cloud;
                    for (const d of f.dust) {
                        if (d.rank > Math.max(0.35, q)) continue;
                        const along = d.t * len, bend = f.curve * (d.t * d.t - 0.083) * len;
                        const wob = Math.sin(clock * 0.27 * f.undulate + f.phase * 1.3 + d.t * 4.1) * 0.05 * len * swirlK;
                        const nOff = bend + wob + d.side * d.off * len;
                        const wx = f.x + cos * along - sin * nOff, wy = f.y + sin * along + cos * nOff;
                        const sx = cx + (wx - shiftX) * S, sy = cy + (wy - shiftY) * S;
                        const radius = d.r * 0.38 * cloud * L.scale * S;
                        if (sx + radius * 2 < minX || sx - radius * 2 > maxX || sy + radius * 2 < minY || sy - radius * 2 > maxY) continue;
                        const rgb = paletteAt(colors, f.u0 + state.colorPhase * 0.5);
                        rgbTmp[0] = 6 + rgb[0] * 0.07; rgbTmp[1] = 3 + rgb[1] * 0.05; rgbTmp[2] = 14 + rgb[2] * 0.09;
                        const alpha = d.a * 0.62 * env * tuning.dustLevel * (li === 2 ? 0.75 : 1) * clamp(expo, 0.35, 1.2);
                        blit(ctx, sprite(d.tex, rgbTmp), sx, sy, radius * 2 * (1 + stretchK * 0.25), radius * 2 * 0.8, f.ang + d.rot, Math.min(0.92, alpha));
                        drawn.dust++;
                    }
                }
            }
        }

        // Ionisation fronts: a faint coloured ring that travels with each shockwave.
        if (hasWaves) {
            ctx.globalCompositeOperation = "lighter";
            for (const w of state.waves) {
                const sx = cx + (w.x - state.camX * 0.75) * S, sy = cy + (w.y - state.camY * 0.75) * S, r = w.r * S;
                if (r < 4) continue;
                const rgb = paletteAt(colors, w.u + state.colorPhase);
                const fade = Math.max(0, 1 - w.r / 2.6) * tuning.bassWave * w.strength * expo;
                const g = ctx.createRadialGradient(sx, sy, Math.max(0, r * 0.78), sx, sy, r * 1.08);
                const c = `${Math.round(Math.min(255, rgb[0] * 0.6 + 100))},${Math.round(Math.min(255, rgb[1] * 0.6 + 100))},${Math.round(Math.min(255, rgb[2] * 0.6 + 100))}`;
                g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.72, `rgba(${c},${(0.09 * fade).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`);
                ctx.globalAlpha = 1; ctx.fillStyle = g;
                ctx.fillRect(sx - r * 1.1, sy - r * 1.1, r * 2.2, r * 2.2);
            }
        }

        ctx.globalCompositeOperation = "source-over";
        drawStars(ctx, width, height, S, 1, frame, colors, expo, sizeK, q);   // foreground stars on top
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
    }

    const WARM = [255, 214, 176], COOL = [196, 214, 255];
    function drawStars(ctx, width, height, S, pass, frame, colors, expo, sizeK, q) {
        const cx = width / 2, cy = height / 2;
        const spanX = state.extentX * 2.3, spanY = state.extentY * 2.3;
        const clock = state.clock, treble = state.treble * tuning.trebleSparkle;
        const sizeBase = tuning.starSize * sizeK;
        const drawn = state.drawn;
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < state.stars.length; i++) {
            const s = state.stars[i];
            if ((s.z > 0.8) !== (pass === 1)) continue;
            if (i / state.stars.length > 0.5 + 0.5 * q) continue;
            // Wrapped field position, shifted by the camera so near stars slide more.
            let fx = (s.x + clock * 0.003 * s.z - state.camX * s.z * 0.12) % 1; if (fx < 0) fx += 1;
            let fy = (s.y + clock * 0.0012 * s.z - state.camY * s.z * 0.12) % 1; if (fy < 0) fy += 1;
            const sx = cx + (fx - 0.5) * spanX * S, sy = cy + (fy - 0.5) * spanY * S;
            if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
            const tw = 1 - 0.5 * tuning.twinkle * (0.5 + 0.5 * Math.sin(clock * s.rate * 2.2 + s.tw)) + treble * 0.9 * (0.5 + 0.5 * Math.sin(clock * 17 + s.tw * 5)) * s.mag;
            const bright = (0.25 + 0.75 * s.mag) * clamp(tw, 0.1, 2.4) * expo;
            const rgb = s.color === 0 ? COOL : s.color === 1 ? WARM : null;
            let col = rgb;
            if (!col) { const p = paletteAt(colors, s.u + state.colorPhase * 0.4); rgbTmp[0] = Math.min(255, p[0] * 0.55 + 115); rgbTmp[1] = Math.min(255, p[1] * 0.55 + 115); rgbTmp[2] = Math.min(255, p[2] * 0.55 + 115); col = rgbTmp; }
            const px = (0.9 + s.mag * 3.2) * sizeBase * (0.7 + 0.5 * s.z);
            if (px < 1.7) {
                ctx.globalAlpha = Math.min(1, bright * 0.9);
                ctx.fillStyle = `rgb(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])})`;
                ctx.fillRect(sx - px * 0.5, sy - px * 0.5, px, px);
            } else {
                const img = sprite(T_GLOW, col);
                blit(ctx, img, sx, sy, px * 5, px * 5, 0, Math.min(1, bright * 0.55));
                blit(ctx, img, sx, sy, px * 1.8, px * 1.8, 0, Math.min(1, bright));
                if (s.spike && tuning.spikeLevel > 0.01) {
                    const len = px * (7 + 6 * s.mag + treble * 6) * tuning.spikeLevel;
                    const spk = sprite(T_SPIKE, col), a = Math.min(1, bright * 0.55);
                    blit(ctx, spk, sx, sy, len, len * 0.5, 0, a);
                    blit(ctx, spk, sx, sy, len, len * 0.5, Math.PI / 2, a);
                    if (s.mag > 0.8) { blit(ctx, spk, sx, sy, len * 0.55, len * 0.28, Math.PI / 4, a * 0.5); blit(ctx, spk, sx, sy, len * 0.55, len * 0.28, -Math.PI / 4, a * 0.5); }
                }
            }
            drawn.stars++;
        }
    }

    function draw(ctx, width, height, seconds, settings, palette, outerSceneScale = 1) {
        if (!palette?.length || !Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return;
        measureFrame();
        const scene = clamp(finite(outerSceneScale, 1), 1, 4);
        const comp = Math.pow(scene, 0.75);
        // The nebula fills the area that can actually be seen: wider than the
        // screen while the camera is close, never more than the shrunk canvas.
        const reach = comp * clamp(1.5 / scene, 0.5, 1);
        const frame = update(settings, width, height, finite(seconds, 0), comp, reach);
        state.lastDt = frame.sdt;
        state.wallClock = finite(seconds, 0);
        frame.comp = comp;
        ctx.save();
        // Veil Drift zoom can enlarge the scene ~1.8x. The nebula lives in its
        // own space and is drawn shrunk by most of that zoom (residual ~zoom^0.25).
        if (comp > 1.0001) {
            ctx.translate(width * 0.5, height * 0.5);
            ctx.scale(1 / comp, 1 / comp);
            ctx.translate(-width * 0.5, -height * 0.5);
        }
        const segments = kaleidoSegments(settings);
        if (segments >= 3 && typeof document !== "undefined") {
            // The app's kaleidoscope (toggle or Flow): render the nebula once into a
            // layer, then lay mirrored, rotated copies over the screen.
            const dpr = ctx.canvas && ctx.canvas.width ? ctx.canvas.width / width : 1;
            const layer = ensureLayer(width, height, dpr);
            layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            layer.ctx.clearRect(0, 0, width, height);
            render(layer.ctx, width, height, settings, palette, frame);
            ctx.globalAlpha = 1;
            if (typeof window !== "undefined" && window.drawWedgeKaleidoscope) {
                // Same true kaleidoscope as every other scene (js/simulation.js).
                const axes = window.kaleidoscopeAxis ? window.kaleidoscopeAxis(settings.spinningKaleido === true) : { axis: 0, mix: 0 };
                window.drawWedgeKaleidoscope(ctx, layer.canvas, width, height, segments, axes.axis, axes.mix);
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
        Object.assign(state, { filaments: [], stars: [], waves: [], starCount: 0, nextId: 1, seed: 11, clock: 0, lastSeconds: null, colorPhase: 0,
            restSize: null, swellTime: 0, pulse: 0, treble: 0, beat: false, budget: 1, frameAverage: 16.7, lastFrameAt: null,
            lastDt: undefined, layer: null, camX: 0, camY: 0 });
    }
    function setTuning(values) {
        for (const key of Object.keys(DEFAULT_TUNING)) {
            if (values && Number.isFinite(Number(values[key]))) tuning[key] = Number(values[key]);
        }
        tuning.gasLevel = clamp(tuning.gasLevel, 0, 3);
        tuning.dustLevel = clamp(tuning.dustLevel, 0, 2.5);
        tuning.filaments = clamp(tuning.filaments, 0.2, 3);
        tuning.cloudScale = clamp(tuning.cloudScale, 0.4, 2.5);
        tuning.detail = clamp(tuning.detail, 0, 1);
        tuning.swirl = clamp(tuning.swirl, 0, 3);
        tuning.drift = clamp(tuning.drift, 0, 4);
        tuning.depth = clamp(tuning.depth, 0, 3);
        tuning.coreLevel = clamp(tuning.coreLevel, 0, 3);
        tuning.cores = clamp(tuning.cores, 0, 2);
        tuning.starDensity = clamp(tuning.starDensity, 0, 3);
        tuning.starSize = clamp(tuning.starSize, 0.3, 3);
        tuning.spikeLevel = clamp(tuning.spikeLevel, 0, 3);
        tuning.twinkle = clamp(tuning.twinkle, 0, 2);
        tuning.colorFlow = clamp(tuning.colorFlow, 0, 0.6);
        tuning.colorSpread = clamp(tuning.colorSpread, 0, 1.5);
        tuning.lifeSeconds = clamp(tuning.lifeSeconds, 15, 240);
        tuning.fadeSeconds = clamp(tuning.fadeSeconds, 2, 40);
        tuning.bassPulse = clamp(tuning.bassPulse, 0, 3);
        tuning.bassWave = clamp(tuning.bassWave, 0, 3);
        tuning.trebleSparkle = clamp(tuning.trebleSparkle, 0, 3);
        tuning.quality = clamp(tuning.quality, 0.4, 1);
        return { ...tuning };
    }
    function lockBudget(locked) { state.guardLocked = !!locked; if (locked) state.budget = 1; }
    function seek(seconds) { state.clock = Math.max(0, finite(seconds, 0)); }
    function respawn() { state.filaments.length = 0; state.stars.length = 0; state.starCount = 0; state.waves.length = 0; }
    function replayEntry() { state.lastSeconds = null; }
    function inspect() {
        return { filaments: state.filaments.length, stars: state.stars.length, waves: state.waves.length, clock: state.clock, budget: state.budget,
            pulse: state.pulse, treble: state.treble, colorPhase: state.colorPhase, drawn: state.drawn, extentX: state.extentX, extentY: state.extentY,
            live: state.filaments.map(f => ({ id: f.id, layer: f.layer, age: f.age, life: f.life, x: f.x, y: f.y, core: !!f.core })) };
    }

    return { draw, reset, setTuning, seek, respawn, lockBudget, kaleidoSegments, replayEntry, inspect, parseColor, paletteColors, LAYERS, DEFAULT_TUNING, tuning };
})();

if (typeof window !== "undefined") window.StellarNursery = StellarNursery;
if (typeof module !== "undefined" && module.exports) module.exports = StellarNursery;
