// Cymatic Resonance: glowing sand on an invisible vibrating plate.
// Grains are shaken off the moving parts of a circular Chladni-style standing
// wave and gather on its still (nodal) lines, so the figure emerges from the
// sand rather than being drawn. The plate slowly changes resonant mode and the
// whole field streams across the screen to re-form. Bass attacks strike the
// plate (sand leaps, then resettles); treble attacks make loose sand shimmer.
const CymaticResonance = (() => {
    const TAU = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const finite = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    // Circular plate modes: f = cos(nθ)·cos(aR) − cos(mθ)·cos(bR).
    // Pairs are chosen for readable, varied symmetry (4-, 5-, 6-, 7-, 8-fold
    // and 3-fold), not for strict physical plate eigenvalues.
    const MODES = [
        { n: 6, m: 3, a: 14, b: 9 },
        { n: 4, m: 8, a: 18, b: 11 },
        { n: 5, m: 10, a: 12, b: 17 },
        { n: 8, m: 4, a: 16, b: 10 },
        { n: 7, m: 14, a: 13, b: 19 },
        { n: 3, m: 6, a: 10, b: 15 },
        { n: 6, m: 12, a: 15, b: 21 }
    ];
    const MAX_GRAINS = 22000;
    const CENTER_CLEAR = 0.035;

    const state = {
        count: 0,
        x: new Float32Array(MAX_GRAINS),
        y: new Float32Array(MAX_GRAINS),
        vx: new Float32Array(MAX_GRAINS),
        vy: new Float32Array(MAX_GRAINS),
        // Unit tangent of the nearest still line, used to spread grains along
        // lines and to draw each settled grain as a short aligned streak.
        tx: new Float32Array(MAX_GRAINS),
        ty: new Float32Array(MAX_GRAINS),
        width: 0,
        height: 0,
        lastSeconds: null,
        // Plate-space extent (>= 1) needed to cover the screen after zoom compensation.
        reach: 1,
        // Frame-time guard: sheds sand on slow devices, restores it when smooth.
        budget: 1,
        frameAverage: 16.7,
        lastFrameAt: null,
        clock: 0,
        restSize: null,
        swellTime: 0,
        strike: 0,
        seed: 1
    };

    // Small deterministic generator keeps tests repeatable.
    function random() {
        state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
        return state.seed / 4294967296;
    }

    function spawn(index, width, height) {
        if (random() < 0.3) {
            // The figure's lines crowd together near the middle; a share of
            // new sand lands there so the center reads as solidly as the rim.
            const radius = Math.sqrt(random()) * Math.min(width, height) * 0.36;
            const direction = random() * TAU;
            state.x[index] = width * 0.5 + Math.cos(direction) * radius;
            state.y[index] = height * 0.5 + Math.sin(direction) * radius;
        } else {
            // Slight overscan so grains exist beneath rotation/zoom crop edges;
            // widened by zoom compensation so corners never empty out.
            const reach = state.reach * 1.1;
            state.x[index] = width * 0.5 + (random() - 0.5) * reach * width;
            state.y[index] = height * 0.5 + (random() - 0.5) * reach * height;
        }
        state.vx[index] = 0;
        state.vy[index] = 0;
        const direction = random() * TAU;
        state.tx[index] = Math.cos(direction);
        state.ty[index] = Math.sin(direction);
    }

    function resize(count, width, height) {
        if (state.width && state.height && (state.width !== width || state.height !== height)) {
            const sx = width / state.width;
            const sy = height / state.height;
            for (let i = 0; i < state.count; i++) {
                state.x[i] *= sx;
                state.y[i] *= sy;
            }
        }
        for (let i = state.count; i < count; i++) spawn(i, width, height);
        state.count = count;
        state.width = width;
        state.height = height;
    }

    function grainCount(settings, width, height) {
        const density = clamp(finite(settings.density, 1600), 900, 2400);
        // Phones get fewer grains; the figure stays legible because lines are
        // formed by where grains gather, not by how many there are.
        const areaScale = clamp(Math.sqrt((width * height) / 2073600), 0.45, 1);
        return Math.round(clamp(density * 12 * areaScale, 4000, MAX_GRAINS));
    }

    // Returns the field value and gradient (in normalized units) for a mode.
    function sampleMode(mode, radius, angle, breathe, out) {
        const a = mode.a * breathe;
        const b = mode.b * (2 - breathe);
        const cn = Math.cos(mode.n * angle), sn = Math.sin(mode.n * angle);
        const cm = Math.cos(mode.m * angle), sm = Math.sin(mode.m * angle);
        const ca = Math.cos(a * radius), sa = Math.sin(a * radius);
        const cb = Math.cos(b * radius), sb = Math.sin(b * radius);
        out.f = cn * ca - cm * cb;
        out.dr = -a * cn * sa + b * cm * sb;
        out.dt = -mode.n * sn * ca + mode.m * sm * cb;
    }

    // Mode schedule is driven by an internal clock advanced by speed, so a
    // speed of zero truly freezes both morphing and grain travel.
    function modeAt(clock) {
        // Constant motion: ~1 s to settle after a morph, ~3 s to admire the
        // finished figure, then the plate shifts again.
        const hold = 3.4;
        const morph = 1.5;
        const cycle = hold + morph;
        const step = Math.floor(clock / cycle);
        const within = clock - step * cycle;
        const from = MODES[((step % MODES.length) + MODES.length) % MODES.length];
        const to = MODES[(((step + 1) % MODES.length) + MODES.length) % MODES.length];
        const raw = within <= hold ? 0 : (within - hold) / morph;
        const blend = raw * raw * (3 - 2 * raw);
        return { from, to, blend };
    }

    const sampleA = { f: 0, dr: 0, dt: 0 };
    const sampleB = { f: 0, dr: 0, dt: 0 };

    function update(settings, width, height, seconds, reach) {
        state.reach = reach;
        // More plate area is on screen while zoom is compensated; add sand
        // (bounded) so lines stay as full as at rest.
        const wanted = grainCount(settings, width, height) * Math.min(reach * reach, 1.6) * state.budget;
        // Step in blocks of 250 so the guard does not reallocate every frame.
        const count = Math.min(MAX_GRAINS, Math.max(1500, Math.round(wanted / 250) * 250));
        if (count !== state.count || width !== state.width || height !== state.height) {
            resize(count, width, height);
        }
        let dtSeconds = state.lastSeconds === null ? 0 : seconds - state.lastSeconds;
        // A long gap means the preset was re-entered; scatter the sand so the
        // figure visibly re-forms instead of resuming a stale frame.
        if (state.lastSeconds !== null && (dtSeconds > 1.5 || dtSeconds < -0.5)) {
            for (let i = 0; i < state.count; i++) spawn(i, width, height);
            dtSeconds = 0;
        }
        dtSeconds = clamp(dtSeconds, 0, 0.1);
        state.lastSeconds = seconds;

        const speed = clamp(finite(settings.speed, 0.5), 0, 2);
        const tempo = speed / 0.5;
        state.clock += dtSeconds * tempo;

        // Bass: the shared music pipeline swells baseSize on attacks. Track a
        // resting size and treat a sharp rise as a strike on the plate.
        const size = clamp(finite(settings.baseSize, 2.2), 0.5, 12);
        if (state.restSize === null || size < state.restSize) state.restSize = size;
        const swell = size / Math.max(0.1, state.restSize) - 1;
        // Follow deliberate size changes, but never chase a beat. Music pulses
        // decay within ~150 ms; a swell that persists is a slider change.
        state.swellTime = swell > 0.18 ? state.swellTime + dtSeconds : 0;
        if (state.swellTime > 0.6) {
            state.restSize = size;
            state.swellTime = 0;
        } else if (swell > 0 && swell < 0.18) {
            state.restSize += (size - state.restSize) * Math.min(1, dtSeconds * 0.8);
        }
        let impulse = 0;
        if (swell > 0.18) {
            impulse = clamp(swell - state.strike, 0, 1);
            state.strike = Math.max(state.strike, swell);
        }
        state.strike *= Math.pow(0.05, dtSeconds);
        const treble = clamp(finite(settings.trebleIntensity, 0), 0, 1.5);

        const minDim = Math.min(width, height);
        const half = minDim * 0.5;
        const cx = width * 0.5;
        const cy = height * 0.5;
        const stretch = clamp(finite(settings.stretch, 1), 0, 3);
        // Stretch sets plate scale: low = bold, broad figures; high = finer lace.
        const scale = 1.7 + stretch * 0.45;
        const wobble = clamp(finite(settings.wobble, 0.12), 0, 0.8);
        const breathe = 1 + wobble * 0.12 * Math.sin(state.clock * 0.55);
        const turbulence = clamp(finite(settings.turbulence, 0.05), 0, 0.5);
        const { from, to, blend } = modeAt(state.clock);
        // Fast enough for the sand to keep pace with a quick 1.5 s morph.
        const settle = clamp(7 * tempo, 0, 14) * dtSeconds;
        const maxStep = minDim * 0.035 * tempo;
        const shake = (0.35 + turbulence * 6 + treble * 1.4) * minDim * 0.0022 * Math.min(tempo, 2);
        const damping = Math.pow(0.02, dtSeconds);
        const recycle = 0.012 * tempo * dtSeconds;
        // Leap scales with attack strength but is bounded: a typical beat makes
        // the sand hop and shimmer, only a very hard hit scatters the figure.
        const kick = impulse * impulse * minDim * 0.55;
        // Settled sand streams along its line; the tangent's orientation flips
        // between neighbouring lines, so adjacent lines flow in opposite ways.
        const flow = minDim * 0.045 * tempo * dtSeconds;

        for (let i = 0; i < state.count; i++) {
            let x = state.x[i];
            let y = state.y[i];
            const dx = (x - cx) / half;
            const dy = (y - cy) / half;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < CENTER_CLEAR || random() < recycle) {
                spawn(i, width, height);
                continue;
            }
            const radius = r * scale;
            const angle = Math.atan2(dy, dx);
            sampleMode(from, radius, angle, breathe, sampleA);
            let f = sampleA.f, dr = sampleA.dr, dth = sampleA.dt;
            if (blend > 0) {
                sampleMode(to, radius, angle, breathe, sampleB);
                f += (sampleB.f - f) * blend;
                dr += (sampleB.dr - dr) * blend;
                dth += (sampleB.dt - dth) * blend;
            }
            // Convert polar gradient to screen-space pixels.
            const ux = dx / r, uy = dy / r;
            const gr = dr * scale / half;
            const gt = dth / (r * half);
            const gx = gr * ux - gt * uy;
            const gy = gr * uy + gt * ux;
            const g2 = gx * gx + gy * gy + 1e-9;
            // Newton step toward the nearest still line, capped per frame.
            let sx = -f * gx / g2 * settle;
            let sy = -f * gy / g2 * settle;
            const stepLength = Math.hypot(sx, sy);
            if (stepLength > maxStep) {
                sx *= maxStep / stepLength;
                sy *= maxStep / stepLength;
            }
            // Vibration: grains on moving plate regions jitter; grains resting
            // on nodal lines only slide along them, which keeps lines thin while
            // spreading sand evenly instead of leaving dotted gaps.
            const agitation = Math.min(1, Math.abs(f) * 0.6);
            const active = dtSeconds > 0 ? 1 : 0;
            const inverse = 1 / Math.sqrt(g2);
            const tangentX = -gy * inverse;
            const tangentY = gx * inverse;
            state.tx[i] = tangentX;
            state.ty[i] = tangentY;
            const across = (random() - 0.5) * shake * agitation * active;
            const along = (random() - 0.5) * shake * (3.2 + agitation) * active;
            if (kick > 0) {
                const direction = random() * TAU;
                const leap = kick * (0.25 + 0.75 * random()) * (0.4 + agitation);
                state.vx[i] += Math.cos(direction) * leap;
                state.vy[i] += Math.sin(direction) * leap;
            }
            const stream = flow * (1 - agitation);
            x += sx + tangentX * (along + stream) - tangentY * across + state.vx[i] * dtSeconds;
            y += sy + tangentY * (along + stream) + tangentX * across + state.vy[i] * dtSeconds;
            state.vx[i] *= damping;
            state.vy[i] *= damping;
            const edge = 0.58 * state.reach;
            if (Math.abs(x - cx) > edge * width || Math.abs(y - cy) > edge * height) {
                spawn(i, width, height);
                continue;
            }
            state.x[i] = x;
            state.y[i] = y;
        }
        return { from, to, blend, scale, breathe, cx, cy, half, treble };
    }

    const lightCache = new Map();
    // Glints use a lighter tint of the grain's own palette colour, never white,
    // so bright moments stay in palette and cannot bleach the screen.
    function lighten(hex) {
        if (lightCache.has(hex)) return lightCache.get(hex);
        let result = hex;
        const match = /^#([0-9a-f]{6})$/i.exec(String(hex));
        if (match) {
            const value = parseInt(match[1], 16);
            const mix = channel => Math.round(channel + (255 - channel) * 0.45);
            const r = mix(value >> 16), g = mix((value >> 8) & 255), b = mix(value & 255);
            result = "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
        }
        if (lightCache.size > 64) lightCache.clear();
        lightCache.set(hex, result);
        return result;
    }

    function render(ctx, width, height, settings, palette, frame) {
        const size = clamp(finite(settings.baseSize, 2.2), 0.5, 12);
        const rest = clamp(state.restSize ?? size, 0.5, 12);
        const minDim = Math.min(width, height);
        // Bass swells the sand (shared music pipeline) but is capped at 1.6×
        // so hard hits never turn grains into blocks.
        const zoomBack = frame.compensation || 1;
        const grain = clamp(Math.min(size, rest * 1.6) * minDim / 820, 0.8, 7) * zoomBack;
        const speck = clamp(rest * minDim / 820 * 0.7, 0.6, 3) * zoomBack;
        const variation = clamp(finite(settings.sizeVariation, 0.5), 0, 2);
        const colors = palette.length;
        // Colour travels outward in slow rings, like sound leaving the plate.
        const bands = 4.5;
        const drift = state.clock * 0.09;
        const { cx, cy, half, treble } = frame;
        const buckets = colors * 2;
        const paths = new Array(buckets);
        for (let b = 0; b < buckets; b++) paths[b] = [];
        for (let i = 0; i < state.count; i++) {
            const dx = (state.x[i] - cx) / half;
            const dy = (state.y[i] - cy) / half;
            const r = Math.sqrt(dx * dx + dy * dy);
            const band = Math.floor(r * bands - drift);
            const color = ((band % colors) + colors) % colors;
            const moving = Math.abs(state.vx[i]) + Math.abs(state.vy[i]) > minDim * 0.08;
            paths[color * 2 + (moving ? 1 : 0)].push(i);
        }
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "round";
        const streak = grain * 1.35;
        for (let b = 0; b < buckets; b++) {
            const list = paths[b];
            if (!list.length) continue;
            const airborne = b % 2 === 1;
            ctx.fillStyle = palette[Math.floor(b / 2)];
            ctx.strokeStyle = palette[Math.floor(b / 2)];
            if (airborne) {
                // Airborne sand after a strike: dim specks, so the burst reads
                // as a shimmering cloud rather than a white flash.
                ctx.globalAlpha = 0.38;
                ctx.beginPath();
                for (let k = 0; k < list.length; k++) {
                    const i = list[k];
                    ctx.rect(state.x[i] - speck * 0.5, state.y[i] - speck * 0.5, speck, speck);
                }
                ctx.fill();
                continue;
            }
            // Settled sand: short streaks aligned with their line, so gathered
            // grains read as continuous luminous figures.
            ctx.beginPath();
            for (let k = 0; k < list.length; k++) {
                const i = list[k];
                const s = streak * (1 + variation * 0.3 * ((((i * 2654435761) >>> 0) % 7) - 3) / 3);
                const hx = state.tx[i] * s * 0.5;
                const hy = state.ty[i] * s * 0.5;
                ctx.moveTo(state.x[i] - hx, state.y[i] - hy);
                ctx.lineTo(state.x[i] + hx, state.y[i] + hy);
            }
            ctx.globalAlpha = 0.05;
            ctx.lineWidth = grain * 2.1;
            ctx.stroke();
            ctx.globalAlpha = 0.72;
            ctx.lineWidth = grain * 0.85;
            ctx.stroke();
        }
        // Glints: a small, changing subset of settled grains catches the light.
        // Treble attacks raise the glint rate (bounded) so hi-hats shimmer.
        const glintRate = clamp(0.012 + treble * 0.03, 0, 0.06);
        const glintSize = grain * 1.5;
        ctx.globalAlpha = 0.9;
        for (let b = 0; b < buckets; b += 2) {
            const list = paths[b];
            if (!list.length) continue;
            ctx.fillStyle = lighten(palette[b / 2]);
            ctx.beginPath();
            for (let k = 0; k < list.length; k++) {
                if (random() >= glintRate) continue;
                const i = list[k];
                ctx.rect(state.x[i] - glintSize * 0.5, state.y[i] - glintSize * 0.5, glintSize, glintSize);
            }
            ctx.fill();
        }
        ctx.restore();
    }

    function measureFrame() {
        if (typeof performance === "undefined" || typeof performance.now !== "function") return;
        const now = performance.now();
        const interval = state.lastFrameAt === null ? 16.7 : now - state.lastFrameAt;
        state.lastFrameAt = now;
        if (interval <= 0 || interval > 250) return; // paused tab or re-entry
        state.frameAverage += (interval - state.frameAverage) * 0.05;
        if (state.frameAverage > 26) state.budget = Math.max(0.45, state.budget - 0.004);
        else if (state.frameAverage < 19) state.budget = Math.min(1, state.budget + 0.002);
    }

    function draw(ctx, width, height, seconds, settings, palette, outerSceneScale = 1) {
        if (!palette?.length || !Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return;
        measureFrame();
        const compensation = Math.pow(clamp(finite(outerSceneScale, 1), 1, 3), 0.75);
        const frame = update(settings, width, height, finite(seconds, 0), compensation);
        // Veil Drift can zoom the scene ~1.8x, leaving only a few enlarged
        // lines on screen. The plate lives in its own space and is drawn
        // shrunk by most of that zoom (residual ~zoom^0.25), so the screen
        // stays full of lines. Grain size is scaled back up to match.
        frame.compensation = compensation;
        if (compensation > 1.0001) {
            ctx.save();
            ctx.translate(width * 0.5, height * 0.5);
            ctx.scale(1 / compensation, 1 / compensation);
            ctx.translate(-width * 0.5, -height * 0.5);
            render(ctx, width, height, settings, palette, frame);
            ctx.restore();
        } else {
            render(ctx, width, height, settings, palette, frame);
        }
    }

    function reset() {
        state.count = 0;
        state.width = 0;
        state.height = 0;
        state.lastSeconds = null;
        state.reach = 1;
        state.budget = 1;
        state.frameAverage = 16.7;
        state.lastFrameAt = null;
        state.clock = 0;
        state.restSize = null;
        state.swellTime = 0;
        state.strike = 0;
        state.seed = 1;
    }

    function inspect() {
        return {
            count: state.count, clock: state.clock, budget: state.budget, strike: state.strike,
            x: state.x, y: state.y, vx: state.vx, vy: state.vy, modes: MODES.length,
            modeAt
        };
    }

    return { draw, reset, inspect, sampleMode, MODES };
})();

if (typeof window !== "undefined") window.CymaticResonance = CymaticResonance;
if (typeof module !== "undefined" && module.exports) module.exports = CymaticResonance;
