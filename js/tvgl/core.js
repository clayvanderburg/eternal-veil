// ==========================================================================
// ETERNAL VOID - TV RENDERER (WebGL2) - CORE
// Physics and rendering for the GPU renderer (TV_RENDERER.md). No DOM: the
// same code runs inside a worker (OffscreenCanvas) or on the page.
//
// Ported from js/simulation.js. Keep these in step with the 2D renderer:
//   simplexNoise / getCurlNoise            -> noise below (verbatim)
//   Particle.reset / update (flow path)    -> Field
//   Particle.draw "ellipse"                -> PARTICLE_FS (halo, body, core)
//   FlowSimulation.tick: trail fade, Veil Drift, rotation, cover scale
//   drawKaleidoscoped / drawWedgeKaleidoscope / kaleidoRing* / kaleidoscopeAxis
// scratch/tvgl_core_tests.js checks the ports against the originals.
//
// Phase 1 covers the plain flow particles ("ellipse"). Other shapes and the
// authored/module scenes stay on the 2D renderer until they are ported.
// ==========================================================================

(function (root) {
    "use strict";

    const TAU = Math.PI * 2;

    // ---------------------------------------------------------------------
    // Noise (verbatim port)
    // ---------------------------------------------------------------------
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const GX = new Int8Array([1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0]);
    const GY = new Int8Array([1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1]);
    const P_TABLE = [
        151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
        190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,
        20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,
        230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,
        169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,
        147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,
        44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,
        104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
        192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,
        24,72,243,141,128,195,78,66,215,61,156,180
    ];
    const PERM = new Uint8Array(512);
    for (let i = 0; i < 256; i++) PERM[i] = PERM[i + 256] = P_TABLE[i];

    function simplexNoise(xin, yin) {
        let n0, n1, n2;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const x0 = xin - (i - t);
        const y0 = yin - (j - t);
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = PERM[ii + PERM[jj]] % 12;
        const gi1 = PERM[ii + i1 + PERM[jj + j1]] % 12;
        const gi2 = PERM[ii + 1 + PERM[jj + 1]] % 12;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * (GX[gi0] * x0 + GY[gi0] * y0); }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * (GX[gi1] * x1 + GY[gi1] * y1); }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * (GX[gi2] * x2 + GY[gi2] * y2); }
        return 70.0 * (n0 + n1 + n2);
    }

    // getCurlNoise without the per-call object: writes into curlOut.
    const curlOut = new Float64Array(2);
    function curlNoise(x, y, time, scale) {
        const eps = 0.001;
        const t = time * 0.4;
        const n1 = simplexNoise(x * scale, y * scale + t);
        const n2 = simplexNoise(x * scale + t, y * scale);
        const dx = (simplexNoise((x + eps) * scale, y * scale + t) - n1) / (eps * scale);
        const dy = (simplexNoise(x * scale + t, (y + eps) * scale) - n2) / (eps * scale);
        curlOut[0] = dy * 1.8;
        curlOut[1] = -dx * 1.8;
        return curlOut;
    }

    // Particle looks the shader draws (Particle.draw branches).
    const KIND = { ellipse: 0, drop: 1, ring: 2, cluster: 3, brush: 4, litOrb: 5, star: 6, cloud: 7 };
    const INSTANCE_FLOATS = 20;

    // ---------------------------------------------------------------------
    // Particles: struct-of-arrays port of Particle (flow path)
    // ---------------------------------------------------------------------
    // Per-particle randoms are kept as 0..1 values so palette length or
    // preset changes re-map them the way Particle.pickColor / aquaticType do.
    class Field {
        constructor() {
            this.n = 0;
            this.cap = 0;
            this.alloc(4096);
        }

        alloc(cap) {
            const grow = (old, Type) => { const a = new Type(cap); if (old) a.set(old.subarray(0, Math.min(old.length, cap))); return a; };
            // Positions and velocities in doubles like the 2D renderer: the flow
            // is chaotic, so float32 rounding visibly changes paths over time.
            for (const k of ["x", "y", "vx", "vy", "life", "maxLife"]) this[k] = grow(this[k], Float64Array);
            // Previous position and headings (Particle.lastX/lastY/perpX/...): brush strokes
            for (const k of ["lastX", "lastY", "perpX", "perpY", "lastPerpX", "lastPerpY"]) this[k] = grow(this[k], Float64Array);
            for (const k of ["sizeOff", "colorR", "phase", "typeR"]) this[k] = grow(this[k], Float32Array);
            // Instance data for the GPU, INSTANCE_FLOATS per particle (see pack()).
            this.gpu = new Float32Array(cap * INSTANCE_FLOATS);
            this.cap = cap;
        }

        reset(i, w, h, initial) {
            this.x[i] = Math.random() * w;
            this.y[i] = Math.random() * h;
            this.lastX[i] = this.x[i];
            this.lastY[i] = this.y[i];
            this.perpX[i] = this.perpY[i] = this.lastPerpX[i] = this.lastPerpY[i] = 0;
            this.vx[i] = (Math.random() - 0.5) * 0.5;
            this.vy[i] = (Math.random() - 0.5) * 0.5;
            const life = initial ? Math.random() * 80 + 40 : Math.random() * 60 + 80;
            this.life[i] = life;
            this.maxLife[i] = life;
            this.sizeOff[i] = Math.random() - 0.5;
            this.typeR[i] = Math.random();            // aquatic paint/bubble, nebula star/cloud
            this.phase[i] = Math.random() * TAU;      // effectPhase
            this.colorR[i] = Math.random();           // palette pick
        }

        // FlowSimulation.spawnParticles / updateDensity
        setCount(target, w, h) {
            target = Math.max(0, Math.round(target));
            if (target > this.cap) this.alloc(Math.max(target, this.cap * 2));
            for (let i = this.n; i < target; i++) this.reset(i, w, h, true);
            this.n = target;
        }

        respawnAll(w, h) {
            for (let i = 0; i < this.n; i++) this.reset(i, w, h, true);
        }

        // Particle.update for the plain flow shapes. `forces` carries the
        // beat shockwaves and vortices (same objects the 2D sim keeps).
        step(s, globalTime, dt, w, h, scaleRef, forces) {
            const zoom = s.zoom || 1.0;
            const speed = (s.speed ?? 1.0) * (s.meditationMotionScale ?? 1.0);
            const flowFreq = 0.007 / zoom;
            const organic = s.flowOrganic ?? 0.85;
            const turb = s.turbulence ?? 0.65;
            const treble = s.trebleIntensity || 0;
            const speedBoost = 1.0 + treble * 1.5;
            const turbBoost = 1.0 + treble * 1.2;
            const shape = s.particleShape || "ellipse";
            const drag = s.drag !== undefined ? s.drag : 0.90;
            const dragFactor = Math.pow(drag, dt);
            const interaction = s.interaction || 0;
            const minDist = (20 + interaction * 6) * scaleRef;
            const shockwaves = forces && forces.shockwaves;
            const vortices = forces && forces.vortices;
            const n = this.n;
            const X = this.x, Y = this.y, VX = this.vx, VY = this.vy;

            for (let i = 0; i < n; i++) {
                let x = X[i], y = Y[i];
                const c = curlNoise(x / scaleRef, y / scaleRef, globalTime * 0.35, flowFreq);
                const tVal = simplexNoise((x / scaleRef) * 0.015, (y / scaleRef) * 0.015 + globalTime * 0.1);
                let targetVx = (c[0] * organic + tVal * (1 - organic) * (turb * turbBoost)) * (speed * speedBoost) * 0.26 * scaleRef;
                let targetVy = (c[1] * organic + tVal * (1 - organic) * (turb * turbBoost)) * (speed * speedBoost) * 0.26 * scaleRef;
                if (treble > 0.1) {
                    const windAngle = globalTime * 0.05 + this.phase[i];
                    targetVx += Math.cos(windAngle) * (treble * 1.6) * scaleRef;
                    targetVy += Math.sin(windAngle) * (treble * 1.6) * scaleRef;
                }
                if (shape === "aquatic") {
                    if (this.typeR[i] > 0.4) {
                        targetVx += 0.8 * speed * scaleRef;
                        targetVy += Math.sin(globalTime * 0.025 + x * 0.004) * 0.32 * speed * scaleRef;
                    } else {
                        targetVx -= 0.45 * speed * scaleRef;
                        targetVy -= (0.8 + Math.abs(this.sizeOff[i]) * 0.5) * speed * scaleRef;
                        targetVx += Math.cos(globalTime * 0.035 + y * 0.006) * 0.36 * speed * scaleRef;
                    }
                } else if (shape === "acid") {
                    targetVy += 1.35 * speed * scaleRef;
                    targetVx += Math.sin(globalTime * 0.04 + y * 0.012) * 0.75 * speed * scaleRef;
                } else if (shape === "nebula") {
                    const k = this.typeR[i] > 0.25 ? 0.33 : 0.10;
                    targetVx *= k;
                    targetVy *= k;
                }

                let vx = VX[i] * dragFactor + targetVx * 0.58 * dt;
                let vy = VY[i] * dragFactor + targetVy * 0.58 * dt;

                // Swarm repulsion against 3 random particles
                if (interaction > 0.05 && n > 1) {
                    for (let k = 0; k < 3; k++) {
                        const o = (Math.random() * n) | 0;
                        if (o === i) continue;
                        const dx = x - X[o], dy = y - Y[o];
                        const d2 = dx * dx + dy * dy;
                        if (d2 < minDist * minDist && d2 > 0.1) {
                            const dist = Math.sqrt(d2);
                            const f = (minDist - dist) / minDist * interaction * 0.6 * scaleRef * dt;
                            vx += (dx / dist) * f;
                            vy += (dy / dist) * f;
                        }
                    }
                }
                if (vortices && vortices.length) {
                    for (let k = 0; k < vortices.length; k++) {
                        const v = vortices[k];
                        const dx = x - v.x, dy = y - v.y;
                        const d2 = dx * dx + dy * dy;
                        const radius = v.radius * scaleRef;
                        if (d2 < radius * radius && d2 > 4) {
                            const dist = Math.sqrt(d2);
                            const strength = (radius - dist) / radius * v.strength * (v.life / v.maxLife) * scaleRef * dt;
                            vx -= (dx / dist) * strength * 0.45;
                            vy -= (dy / dist) * strength * 0.45;
                            vx += (-dy / dist) * strength * 1.5;
                            vy += (dx / dist) * strength * 1.5;
                        }
                    }
                }
                if (shockwaves && shockwaves.length) {
                    for (let k = 0; k < shockwaves.length; k++) {
                        const sw = shockwaves[k];
                        const dx = x - sw.x, dy = y - sw.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 > 16) {
                            const dist = Math.sqrt(d2);
                            const ringWidth = sw.widthPx || 35 * scaleRef;
                            if (Math.abs(dist - sw.radius) < ringWidth) {
                                const strength = (1.0 - Math.abs(dist - sw.radius) / ringWidth) * (1.0 - sw.radius / sw.maxRadius) * sw.force * scaleRef * dt;
                                vx += (dx / dist) * strength * 0.65;
                                vy += (dy / dist) * strength * 0.65;
                            }
                        }
                    }
                }

                this.lastX[i] = x;
                this.lastY[i] = y;
                this.lastPerpX[i] = this.perpX[i];
                this.lastPerpY[i] = this.perpY[i];
                x += vx * dt;
                y += vy * dt;
                const heading = Math.atan2(vy, vx);
                this.perpX[i] = -Math.sin(heading);
                this.perpY[i] = Math.cos(heading);
                if (this.lastPerpX[i] === 0 && this.lastPerpY[i] === 0) {
                    this.lastPerpX[i] = this.perpX[i];
                    this.lastPerpY[i] = this.perpY[i];
                }
                let wrapped = false;
                if (x < 0) { x = w; vx *= 0.5; wrapped = true; } else if (x > w) { x = 0; vx *= 0.5; wrapped = true; }
                if (y < 0) { y = h; vy *= 0.5; wrapped = true; } else if (y > h) { y = 0; vy *= 0.5; wrapped = true; }
                if (wrapped) {
                    this.lastX[i] = x; this.lastY[i] = y;
                    this.lastPerpX[i] = this.perpX[i]; this.lastPerpY[i] = this.perpY[i];
                }
                X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy;

                this.life[i] -= dt;
                if (this.life[i] <= 0) this.reset(i, w, h, false);
            }
        }

        // Pack the per-instance data the particle shader reads. The scene's
        // shape picks each particle's look (Particle.draw): kind, size and
        // alpha multipliers.
        pack(settings) {
            const g = this.gpu;
            const scene = settings.particleShape || "ellipse";
            this.hasBrush = scene === "brush" || scene === "aquatic";
            this.hasCloud = scene === "nebula";
            const lit = (settings.particleLighting || "glow") !== "glow";
            for (let i = 0, o = 0; i < this.n; i++, o += INSTANCE_FLOATS) {
                let kind = KIND.ellipse, sizeMul = 1, alphaMul = 1;
                const r = this.typeR[i];
                if (scene === "drop" || scene === "acid") kind = lit ? KIND.litOrb : KIND.drop;
                else if (scene === "ring") kind = KIND.ring;
                else if (scene === "cluster") kind = KIND.cluster;
                else if (scene === "brush") kind = KIND.brush;
                else if (scene === "aquatic") kind = r > 0.4 ? KIND.brush : KIND.ring;
                else if (scene === "nebula") {
                    if (r > 0.25) { kind = lit ? KIND.litOrb : KIND.star; sizeMul = 0.35; alphaMul = 0.95; }
                    else { kind = KIND.cloud; sizeMul = 13.75; alphaMul = 0.012; }
                }
                g[o] = this.x[i]; g[o + 1] = this.y[i]; g[o + 2] = this.vx[i]; g[o + 3] = this.vy[i];
                g[o + 4] = Math.max(0.1, this.life[i] / this.maxLife[i]);
                g[o + 5] = this.sizeOff[i]; g[o + 6] = this.colorR[i]; g[o + 7] = this.phase[i];
                g[o + 8] = kind; g[o + 9] = sizeMul; g[o + 10] = alphaMul; g[o + 11] = i;
                g[o + 12] = this.lastX[i]; g[o + 13] = this.lastY[i];
                g[o + 14] = this.perpX[i] || 0; g[o + 15] = this.perpY[i] || 0;
                g[o + 16] = this.lastPerpX[i] || this.perpX[i] || 0; g[o + 17] = this.lastPerpY[i] || this.perpY[i] || 0;
                g[o + 18] = 0; g[o + 19] = 0;
            }
            return g.subarray(0, this.n * INSTANCE_FLOATS);
        }
    }

    // ---------------------------------------------------------------------
    // Kaleidoscope rules (ported from js/simulation.js)
    // ---------------------------------------------------------------------
    const KALEIDO_RING_SPEEDUP = 0.35;
    const KALEIDO_RING_FOLD_MODES = ["same", "growing", "doubling", "alternating", "custom"];
    const KALEIDO_MAX_FOLDS = 24;
    function kaleidoRingAxis(axis, ring) {
        return axis * (ring % 2 ? -1 : 1) * (1 + KALEIDO_RING_SPEEDUP * ring);
    }
    function kaleidoRingRadius(w, h, ring, rings) {
        return ((w / 2 + h / 2) / 2) * (ring + 1) / rings;
    }
    function kaleidoRingFolds(settings) {
        const s = settings || {};
        const rings = Math.max(1, Math.min(5, Math.round(Number(s.kaleidoAxesRings)) || 1));
        const base = Math.max(3, Math.min(KALEIDO_MAX_FOLDS, Math.floor(Number(s.kaleidoscopeSegments)) || 6));
        const step = Math.max(1, Math.min(6, Math.round(Number(s.kaleidoRingStep)) || 2));
        const custom = Array.isArray(s.kaleidoRingCustom) ? s.kaleidoRingCustom : [];
        const mode = KALEIDO_RING_FOLD_MODES.includes(s.kaleidoRingFolds) ? s.kaleidoRingFolds : "same";
        const folds = [];
        for (let k = 0; k < rings; k++) {
            const n = mode === "growing" ? base + step * k
                : mode === "doubling" ? base * Math.pow(2, k)
                : mode === "alternating" ? (k % 2 ? base * 2 : base)
                : mode === "custom" ? (Number(custom[k]) || base)
                : base;
            folds.push(Math.max(3, Math.min(KALEIDO_MAX_FOLDS, Math.round(n))));
        }
        return folds;
    }
    // kaleidoscopeAxis: the shared spin clock, eased over 1.5 s.
    const KALEIDO_AXIS_SPEED = 0.12;
    function makeAxisClock() {
        const s = { axis: 0, mix: 0, last: 0 };
        return function (spinning, nowSeconds) {
            const dt = s.last ? Math.min(0.1, Math.max(0, nowSeconds - s.last)) : 0;
            s.last = nowSeconds;
            s.mix = Math.min(1, Math.max(0, s.mix + (spinning ? dt : -dt) / 1.5));
            const eased = s.mix * s.mix * (3 - 2 * s.mix);
            s.axis += KALEIDO_AXIS_SPEED * eased * dt;
            return s.axis;
        };
    }

    // Triangles for one kaleidoscope tier (drawWedgeKaleidoscopeTier): 2*folds
    // slices around the centre, each showing the same wedge of the scene layer,
    // alternately mirrored, sampled at `axis`. `limit` clips the tier to a
    // circle (inner Axes Rings); null reaches the screen corners. Within a
    // slice the screen -> scene map is a similarity, so per-vertex texture
    // coordinates are exact; past the scene edges the texture wraps as its own
    // mirror image (MIRRORED_REPEAT), like kaleidoMirrorTiles.
    // Output: x, y (pixels), u, v per vertex, appended to `out`.
    function kaleidoTier(out, w, h, folds, axis, limit) {
        const slices = Math.max(3, Math.floor(folds)) * 2;
        const step = TAU / slices;
        const half = step / 2;
        const cx = w / 2, cy = h / 2;
        const reach = Math.hypot(cx, cy);
        const available = Math.min(w / 2, half < Math.PI / 2 ? (h / 2) / Math.sin(half) : h / 2);
        const zoom = Math.max(1, reach / available);
        const sub = limit == null ? 1 : Math.max(1, Math.ceil(step / (TAU / 96)));
        const R = limit == null ? (reach + 2) / Math.cos(half / sub) : limit;
        const ca = Math.cos(axis), sa = Math.sin(axis);
        const vert = (i, phi, r) => {
            out.push(cx + Math.cos(phi) * r, cy + Math.sin(phi) * r);
            let th = phi - step * i;
            if (i % 2 === 1) th = -th;
            const qx = Math.cos(th) * r / zoom, qy = Math.sin(th) * r / zoom;
            out.push((cx + ca * qx - sa * qy) / w, (cy + sa * qx + ca * qy) / h);
        };
        for (let i = 0; i < slices; i++) {
            const a0 = step * i - half;
            for (let k = 0; k < sub; k++) {
                const p0 = a0 + step * k / sub, p1 = a0 + step * (k + 1) / sub;
                vert(i, step * i, 0);
                vert(i, p0, R);
                vert(i, p1, R);
            }
        }
    }

    // drawWedgeKaleidoscope: outermost tier first, inner tiers over it.
    function kaleidoMesh(w, h, settings, axis) {
        const folds = kaleidoRingFolds(settings);
        const count = Math.max(1, Math.min(5, Math.floor(Number(settings.kaleidoAxesRings)) || 1));
        const foldsAt = k => folds[Math.min(k, folds.length - 1)];
        let allSame = true;
        for (let k = 1; k < count; k++) if (Math.floor(foldsAt(k)) !== Math.floor(foldsAt(0))) allSame = false;
        const out = [];
        if (count === 1 || (!axis && allSame)) {
            kaleidoTier(out, w, h, foldsAt(0), axis, null);
        } else {
            for (let k = count - 1; k >= 0; k--) {
                kaleidoTier(out, w, h, foldsAt(k), kaleidoRingAxis(axis, k),
                    k === count - 1 ? null : kaleidoRingRadius(w, h, k, count));
            }
        }
        return new Float32Array(out);
    }

    // ---------------------------------------------------------------------
    // Shaders
    // ---------------------------------------------------------------------
    // Particle.draw for the flow shapes, one instanced draw. Each layer of a
    // shape is composited "over" the previous ones exactly as the canvas's
    // separate fills/strokes would be, and written premultiplied.
    const PARTICLE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;              // -1..1
layout(location=1) in vec4 posVel;              // x, y, vx, vy (scene units)
layout(location=2) in vec4 lifeSizeColorPhase;  // lifeRatio, sizeOff, colorR, phase
layout(location=3) in vec4 kindSizeAlphaSeed;   // kind, sizeMul, alphaMul, index
layout(location=4) in vec4 lastPerp;            // lastX, lastY, perpX, perpY
layout(location=5) in vec4 lastPerp2;           // lastPerpX, lastPerpY
uniform mat3 sceneToClip;
uniform float pxPerUnit;
uniform vec4 sizing;                            // baseSize, sizeVariation, scaleRef, stretch
uniform vec2 alphaScale;                        // glow scale, psychedelic flag
uniform float globalTime;
uniform int paletteSize;
uniform vec4 palette[8];
uniform int passMode;                           // 0 main (no clouds/brushes), 1 clouds only
out vec2 local;                                 // particle-relative offset (see below)
out vec2 scenePos;                              // scene units (brush)
flat out int kind;
flat out vec4 geo;                              // per kind: radii / widths
flat out vec4 geo2;
flat out vec4 color;                            // main colour, alpha = drawAlpha
flat out vec3 accent;                           // next palette colour (cluster, lit orb)
flat out vec4 brushA;                           // lastX, lastY, x, y
flat out vec4 brushP;                           // lastPerp, perp
flat out vec2 seedPhase;                        // index, phase
vec3 hsl2rgb(float h, float s, float l) {
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * max(min(min(k - 3.0, 9.0 - k), 1.0), -1.0);
}
void main() {
    kind = int(kindSizeAlphaSeed.x + 0.5);
    bool skip = passMode == 1 ? kind != 7 : (kind == 7 || kind == 4);
    if (skip) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    if (kind == 7) kind = 0;                      // clouds look like big ellipses
    float lifeRatio = lifeSizeColorPhase.x;
    float stretch = sizing.w;
    float size = max(0.4, (sizing.x + lifeSizeColorPhase.y * sizing.y) * (0.6 + lifeRatio * 0.5)) * sizing.z;
    float ds = size * kindSizeAlphaSeed.y;      // drawSize
    vec2 v = posVel.zw;
    float speed = length(v);
    float dyn = 1.0 + min(2.5, speed) * 0.05 * stretch;
    vec2 dir = speed > 1e-6 ? v / speed : vec2(1.0, 0.0);
    float aa = 1.5 / pxPerUnit;
    seedPhase = vec2(kindSizeAlphaSeed.w, lifeSizeColorPhase.w);
    brushA = vec4(lastPerp.xy, posVel.xy);
    brushP = vec4(lastPerp2.xy, lastPerp.zw);
    geo = vec4(0.0); geo2 = vec4(0.0);

    vec2 ext;                                    // half extents of the quad
    vec2 center = posVel.xy;
    vec2 qdir = dir;                             // quad orientation
    if (kind == 0) {                             // ellipse: halo, body, core
        vec2 halo = ds * vec2(2.4 + stretch * 0.3, 1.1 + dyn * 0.15);
        geo = vec4(halo, ds * vec2(1.7 + stretch * 0.25, 0.65 + dyn * 0.18));
        geo2 = vec4(ds * vec2(0.7 + stretch * 0.1, 0.38 + dyn * 0.08), ds * 0.1, 0.0);
        ext = halo;
    } else if (kind == 1 || kind == 5 || kind == 6) { // drop / lit orb / star
        geo = vec4(ds * 1.5, ds, 0.0, 0.0);
        ext = vec2(ds * 1.5);
    } else if (kind == 2) {                      // ring: two strokes on one circle
        float R = ds * (1.3 + dyn * 0.2);
        geo = vec4(R, ds * 1.35, ds * 0.45, 0.0);
        ext = vec2(R + ds * 0.7);
    } else if (kind == 3) {                      // cluster
        geo = vec4(ds, 0.0, 0.0, 0.0);
        ext = vec2(ds * 1.55);
    } else {                                     // brush: segment last -> now
        float B = ds * 4.2;
        geo = vec4(B, 0.0, 0.0, 0.0);
        vec2 seg = posVel.xy - lastPerp.xy;
        float len = length(seg);
        qdir = len > 1e-4 ? seg / len : dir;
        center = (posVel.xy + lastPerp.xy) * 0.5;
        float wide = B * 1.12;
        ext = vec2(len * 0.5 + wide, wide);
    }
    ext += aa;
    vec2 qn = vec2(-qdir.y, qdir.x);
    vec2 corner2 = corner * ext;
    vec2 p = center + qdir * corner2.x + qn * corner2.y;
    scenePos = p;
    vec2 d = p - posVel.xy;
    // Offsets the fragment shader measures in: the heading's frame for the
    // velocity-aligned shapes (ellipse, drop highlight), scene axes otherwise.
    vec2 nrm = vec2(-dir.y, dir.x);
    local = (kind == 0 || kind == 1 || kind == 6) ? vec2(dot(d, dir), dot(d, nrm)) : d;
    gl_Position = vec4((sceneToClip * vec3(p, 1.0)).xy, 0.0, 1.0);

    int idx = min(paletteSize - 1, int(floor(lifeSizeColorPhase.z * float(paletteSize))));
    vec4 c = palette[idx];
    accent = palette[(idx + 1) % paletteSize].rgb;
    if (alphaScale.y > 0.5) {
        float hue = mod(globalTime * 1.8 + (posVel.x + posVel.y) * 0.1, 360.0);
        c = vec4(hsl2rgb(hue, 0.98, 0.62), 0.85);
    }
    color = vec4(c.rgb, c.a * lifeRatio * 0.78 * alphaScale.x * kindSizeAlphaSeed.z);
}`;

    const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 local;
in vec2 scenePos;
flat in int kind;
flat in vec4 geo;
flat in vec4 geo2;
flat in vec4 color;
flat in vec3 accent;
flat in vec4 brushA;
flat in vec4 brushP;
flat in vec2 seedPhase;
uniform vec4 clocks;          // light T mod 2pi, light T*0.73 mod 2pi, twinkle mod 2pi, frame
uniform float lighting;       // 0 glow, 1 other, 2 pearl
out vec4 frag;
vec4 acc = vec4(0.0);         // premultiplied
void over(vec3 c, float a) { a = clamp(a, 0.0, 1.0); acc = vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a)); }
float aaStep(float d) { return clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0); }
float disc(vec2 p, vec2 c, float r) { return aaStep(length(p - c) - r); }
float ellipseCover(vec2 p, vec2 r) { float d = length(p / r); return clamp((1.0 - d) / max(fwidth(d), 1e-4) + 0.5, 0.0, 1.0); }
float ringStroke(vec2 p, float R, float w) { return aaStep(abs(length(p) - R) - w * 0.5); }
float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a; float l2 = dot(ab, ab);
    float t = l2 > 1e-8 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
}
float hash(float n) { return fract(sin(n * 12.9898 + clocks.w * 78.233) * 43758.5453); }
void main() {
    vec3 c = color.rgb;
    float A = color.a;
    if (kind == 0) {
        over(c, ellipseCover(local, geo.xy) * A * 0.35);
        over(c, ellipseCover(local, geo.zw) * A * 0.9);
        over(c, ellipseCover(local - vec2(geo2.z, 0.0), geo2.xy) * A * 0.75);
    } else if (kind == 1 || kind == 6) {
        if (kind == 6) {                          // nebula star twinkle
            float flicker = 0.10 + sin(clocks.z + seedPhase.y / 6.2831853 * 100.0) * 0.90;
            A *= max(0.0, flicker);
        }
        float ds = geo.y;
        over(c, disc(local, vec2(0.0), geo.x) * A * 0.9);
        over(vec3(1.0), disc(local, vec2(-0.25, -0.25) * ds, ds * 0.45) * A * 0.6);
    } else if (kind == 2) {
        over(c, ringStroke(local, geo.x, geo.y) * A * 0.25);
        over(c, ringStroke(local, geo.x, geo.z) * A * 0.85);
    } else if (kind == 3) {
        float ds = geo.x;
        over(c, disc(local, vec2(0.0), ds * 1.5) * A * 0.58);
        over(c, disc(local, vec2(0.0), ds * 0.72) * A * 0.76);
        over(c, disc(local, vec2(-0.55, -0.55) * ds, ds * 0.45) * A * 0.35);
        over(c, disc(local, vec2(0.5, 0.45) * ds, ds * 0.58) * A * 0.62);
        float lt = seedPhase.y;
        vec2 L = vec2(cos(clocks.x + lt), sin(clocks.y + lt * 0.73));
        over(accent, disc(local, L * ds * 0.48, ds * 0.22) * A * (lighting < 0.5 ? 0.42 : 0.72));
    } else if (kind == 5) {                       // Particle.drawLitOrb (non-glow lighting)
        float R = geo.x, a = A * 0.95;
        float ph = seedPhase.y;
        vec2 L = vec2(cos(clocks.x + ph), sin(clocks.y + ph));
        bool pearl = lighting > 1.5;
        over(c, disc(local, vec2(0.0), R) * a * 0.78);
        over(vec3(0.0078, 0.0235, 0.0902), disc(local, -L * R * 0.22, R * 0.94) * a * (pearl ? 0.22 : 0.34));
        over(accent, disc(local, L * R * 0.36, R * (pearl ? 0.19 : 0.14)) * a * (pearl ? 0.58 : 0.72));
        over(accent, ringStroke(local, R * 0.91, max(1.0, R * (pearl ? 0.12 : 0.06))) * a * (pearl ? 0.72 : 0.34));
    } else {                                      // brush: base stroke + 4 jittered bristles
        float B = geo.x;
        vec2 a0 = brushA.xy, a1 = brushA.zw;
        over(c, aaStep(segDist(scenePos, a0, a1) - B * 0.75) * A * 0.38);
        for (int i = 0; i < 4; i++) {
            float o = i == 0 ? -0.60 : (i == 1 ? -0.20 : (i == 2 ? 0.20 : 0.60));
            float sd = seedPhase.x * 4.0 + float(i);
            float jitterPos = (hash(sd) - 0.5) * B * 0.07;
            float off = o * B * 1.35 + jitterPos;
            vec2 p0 = a0 + brushP.xy * off, p1 = a1 + brushP.zw * off;
            float width = max(0.5, B * 0.46 * (0.90 - abs(o) * 0.45) + (hash(sd + 0.37) - 0.5) * B * 0.08);
            float alpha = max(0.18, A * 0.88 * (1.0 - abs(o) * 0.30) + (hash(sd + 0.71) - 0.5) * 0.08);
            over(c, aaStep(segDist(scenePos, p0, p1) - width * 0.5) * alpha);
        }
    }
    if (acc.a <= 0.002) discard;
    frag = acc;
}`;

    // Brush strokes (oil, aquatic paint): Particle.draw "brush". The bristle
    // geometry and the per-frame jitter are worked out once per stroke here,
    // so each pixel only measures five segment distances.
    const BRUSH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 posVel;
layout(location=2) in vec4 lifeSizeColorPhase;
layout(location=3) in vec4 kindSizeAlphaSeed;
layout(location=4) in vec4 lastPerp;            // lastX, lastY, perpX, perpY
layout(location=5) in vec4 lastPerp2;           // lastPerpX, lastPerpY
uniform mat3 sceneToClip;
uniform float pxPerUnit;
uniform vec4 sizing;
uniform vec2 alphaScale;
uniform float globalTime;
uniform int paletteSize;
uniform vec4 palette[8];
uniform float frameNo;
out vec2 scenePos;
flat out vec4 seg0;            // base stroke a, b
flat out vec4 b0; flat out vec4 b1; flat out vec4 b2; flat out vec4 b3;   // bristle a, b
flat out vec4 halfWidths;      // bristle half widths
flat out vec4 alphas;          // bristle alphas
flat out vec4 colorBase;       // rgb, base stroke alpha
flat out vec2 baseHalfAA;      // base half width, one device pixel (scene units)
vec3 hsl2rgb(float h, float s, float l) {
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * max(min(min(k - 3.0, 9.0 - k), 1.0), -1.0);
}
float hash(float n) { return fract(sin(n * 12.9898 + frameNo * 78.233) * 43758.5453); }
void main() {
    if (int(kindSizeAlphaSeed.x + 0.5) != 4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float lifeRatio = lifeSizeColorPhase.x;
    float size = max(0.4, (sizing.x + lifeSizeColorPhase.y * sizing.y) * (0.6 + lifeRatio * 0.5)) * sizing.z;
    float B = size * kindSizeAlphaSeed.y * 4.2;
    vec2 a = lastPerp.xy, b = posVel.xy;
    vec2 lp = lastPerp2.xy, pp = lastPerp.zw;
    int idx = min(paletteSize - 1, int(floor(lifeSizeColorPhase.z * float(paletteSize))));
    vec4 c = palette[idx];
    if (alphaScale.y > 0.5) {
        float hue = mod(globalTime * 1.8 + (posVel.x + posVel.y) * 0.1, 360.0);
        c = vec4(hsl2rgb(hue, 0.98, 0.62), 0.85);
    }
    float A = c.a * lifeRatio * 0.78 * alphaScale.x * kindSizeAlphaSeed.z;
    colorBase = vec4(c.rgb, A * 0.38);
    baseHalfAA = vec2(B * 0.75, 1.0 / pxPerUnit);
    seg0 = vec4(a, b);
    vec4 offs = vec4(-0.60, -0.20, 0.20, 0.60);
    vec4 hw, al; vec2 q0[4]; vec2 q1[4];
    for (int i = 0; i < 4; i++) {
        float o = offs[i];
        float sd = kindSizeAlphaSeed.w * 4.0 + float(i);
        float off = o * B * 1.35 + (hash(sd) - 0.5) * B * 0.07;
        q0[i] = a + lp * off; q1[i] = b + pp * off;
        hw[i] = 0.5 * max(0.5, B * 0.46 * (0.90 - abs(o) * 0.45) + (hash(sd + 0.37) - 0.5) * B * 0.08);
        al[i] = max(0.18, A * 0.88 * (1.0 - abs(o) * 0.30) + (hash(sd + 0.71) - 0.5) * 0.08);
    }
    b0 = vec4(q0[0], q1[0]); b1 = vec4(q0[1], q1[1]); b2 = vec4(q0[2], q1[2]); b3 = vec4(q0[3], q1[3]);
    halfWidths = hw; alphas = al;
    // quad around the stroke
    vec2 seg = b - a; float len = length(seg);
    vec2 dir = len > 1e-4 ? seg / len : (length(posVel.zw) > 1e-6 ? normalize(posVel.zw) : vec2(1.0, 0.0));
    vec2 nrm = vec2(-dir.y, dir.x);
    float wide = B * 1.07 + 1.5 / pxPerUnit;
    vec2 p = (a + b) * 0.5 + dir * corner.x * (len * 0.5 + wide) + nrm * corner.y * wide;
    scenePos = p;
    gl_Position = vec4((sceneToClip * vec3(p, 1.0)).xy, 0.0, 1.0);
}`;

    const BRUSH_FS = `#version 300 es
precision highp float;
in vec2 scenePos;
flat in vec4 seg0;
flat in vec4 b0; flat in vec4 b1; flat in vec4 b2; flat in vec4 b3;
flat in vec4 halfWidths;
flat in vec4 alphas;
flat in vec4 colorBase;
flat in vec2 baseHalfAA;
out vec4 frag;
float segDist(vec2 p, vec4 s) {
    vec2 a = s.xy, ab = s.zw - s.xy; float l2 = dot(ab, ab);
    float t = l2 > 1e-8 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    return length(p - a - ab * t);
}
float aaw;
float cover(float d, float hw) { return clamp(0.5 - (d - hw) / aaw, 0.0, 1.0); }
void main() {
    aaw = baseHalfAA.y;
    float d0 = segDist(scenePos, seg0);
    float a = cover(d0, baseHalfAA.x) * colorBase.a;
    // source-over of the bristles, all the same colour: alpha union
    float keep = 1.0 - a;
    keep *= 1.0 - cover(segDist(scenePos, b0), halfWidths.x) * alphas.x;
    keep *= 1.0 - cover(segDist(scenePos, b1), halfWidths.y) * alphas.y;
    keep *= 1.0 - cover(segDist(scenePos, b2), halfWidths.z) * alphas.z;
    keep *= 1.0 - cover(segDist(scenePos, b3), halfWidths.w) * alphas.w;
    float A = 1.0 - keep;
    if (A <= 0.002) discard;
    frag = vec4(colorBase.rgb * A, A);
}`;

    const QUAD_VS = `#version 300 es
layout(location=0) in vec2 corner; out vec2 uv;
void main() { uv = corner * 0.5 + 0.5; gl_Position = vec4(corner, 0.0, 1.0); }`;

    // Trail fade toward the background (fillRect with globalAlpha), then the
    // 2D renderer's 'difference' #010101 pass on black so 8-bit rounding
    // can't leave grey ghosts.
    const FADE_FS = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D prev; uniform vec3 bg; uniform float amount; uniform float blackBg;
out vec4 frag;
void main() {
    vec3 c = mix(texture(prev, uv).rgb, bg, amount);
    if (blackBg > 0.5) c = abs(c - vec3(1.0 / 255.0));
    frag = vec4(c, 1.0);
}`;

    const COPY_FS = `#version 300 es
precision mediump float; in vec2 uv; uniform sampler2D src; out vec4 frag;
void main() { frag = texture(src, uv); }`;

    const MESH_VS = `#version 300 es
layout(location=0) in vec2 pos; layout(location=1) in vec2 tc;
uniform vec2 px; out vec2 uv;
void main() { uv = vec2(tc.x, 1.0 - tc.y); gl_Position = vec4(pos.x / px.x * 2.0 - 1.0, 1.0 - pos.y / px.y * 2.0, 0.0, 1.0); }`;

    // ---------------------------------------------------------------------
    // Renderer
    // ---------------------------------------------------------------------
    function compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("TVGL shader: " + gl.getShaderInfoLog(s));
        return s;
    }
    function program(gl, vs, fs, uniforms) {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("TVGL link: " + gl.getProgramInfoLog(p));
        const u = {};
        for (const name of uniforms) u[name] = gl.getUniformLocation(p, name);
        return { p, u };
    }

    class Renderer {
        constructor(gl) {
            this.gl = gl;
            this.particle = program(gl, PARTICLE_VS, PARTICLE_FS,
                ["sceneToClip", "pxPerUnit", "sizing", "alphaScale", "globalTime", "paletteSize", "palette", "clocks", "lighting", "passMode"]);
            this.brush = program(gl, BRUSH_VS, BRUSH_FS,
                ["sceneToClip", "pxPerUnit", "sizing", "alphaScale", "globalTime", "paletteSize", "palette", "frameNo"]);
            this.fade = program(gl, QUAD_VS, FADE_FS, ["prev", "bg", "amount", "blackBg"]);
            this.copy = program(gl, QUAD_VS, COPY_FS, ["src"]);
            this.mesh = program(gl, MESH_VS, COPY_FS, ["px", "src"]);

            this.quadBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            this.quadVAO = gl.createVertexArray();
            gl.bindVertexArray(this.quadVAO);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

            this.instBuf = gl.createBuffer();
            this.instCap = 0;
            this.particleVAO = gl.createVertexArray();
            gl.bindVertexArray(this.particleVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
            for (let a = 1; a <= 5; a++) {
                gl.enableVertexAttribArray(a);
                gl.vertexAttribPointer(a, 4, gl.FLOAT, false, INSTANCE_FLOATS * 4, (a - 1) * 16);
                gl.vertexAttribDivisor(a, 1);
            }

            this.meshBuf = gl.createBuffer();
            this.meshVAO = gl.createVertexArray();
            gl.bindVertexArray(this.meshVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuf);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
            gl.bindVertexArray(null);

            this.trails = [];
            this.layer = null;
            this.cur = 0;
            this.W = 0;
            this.H = 0;
            this.paletteData = new Float32Array(32);
            this.paletteSize = 1;
        }

        target(w, h, wrap) {
            const gl = this.gl;
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return { tex, fb };
        }

        resize(w, h) {
            const gl = this.gl;
            if (w === this.W && h === this.H) return;
            for (const t of [...this.trails, this.layer, this.clouds]) {
                if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
            }
            this.W = w; this.H = h;
            this.trails = [this.target(w, h, gl.CLAMP_TO_EDGE), this.target(w, h, gl.CLAMP_TO_EDGE)];
            this.layer = this.target(w, h, gl.MIRRORED_REPEAT);
            // Nebula's huge, faint clouds are drawn at half resolution.
            this.clouds = this.target(Math.max(1, w >> 1), Math.max(1, h >> 1), gl.CLAMP_TO_EDGE);
        }

        setPalette(colors) {
            // colors: [[r, g, b, a] 0..1, ...]
            const n = Math.max(1, Math.min(8, colors.length));
            for (let i = 0; i < 8; i++) {
                const c = colors[Math.min(i, colors.length - 1)] || [1, 1, 1, 1];
                this.paletteData.set([c[0], c[1], c[2], c[3] ?? 1], i * 4);
            }
            this.paletteSize = n;
        }

        // f: { instances, count, sceneToClip (Float32Array 9), pxPerUnit, sizing [4],
        //      glow, psychedelic, globalTime, bg [3], fadeAmount, blackBg, solid,
        //      kaleido (Float32Array mesh or null) }
        draw(f) {
            const gl = this.gl;
            const W = this.W, H = this.H;
            const src = this.trails[this.cur], dst = this.trails[1 - this.cur];
            gl.viewport(0, 0, W, H);
            gl.bindVertexArray(this.quadVAO);

            // 1. Trails: fade the previous frame toward the background.
            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
            gl.disable(gl.BLEND);
            if (f.solid) {
                gl.clearColor(f.bg[0], f.bg[1], f.bg[2], 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
            } else {
                gl.useProgram(this.fade.p);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, src.tex);
                gl.uniform1i(this.fade.u.prev, 0);
                gl.uniform3fv(this.fade.u.bg, f.bg);
                gl.uniform1f(this.fade.u.amount, f.fadeAmount);
                gl.uniform1f(this.fade.u.blackBg, f.blackBg ? 1 : 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }

            // 2. Particles: straight onto the trails, or into a clear layer that
            //    the kaleidoscope mirrors onto the trails (as drawKaleidoscoped).
            const kaleido = f.kaleido && f.kaleido.length;
            if (kaleido) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.layer.fb);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            // The particle shader writes premultiplied colour.
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            if (f.count > 0) {
                const into = kaleido ? this.layer.fb : dst.fb;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
                if (f.instances.byteLength > this.instCap) {
                    this.instCap = f.instances.byteLength * 2;
                    gl.bufferData(gl.ARRAY_BUFFER, this.instCap, gl.DYNAMIC_DRAW);
                }
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, f.instances);
                gl.bindVertexArray(this.particleVAO);
                const common = (prog, pxPerUnit) => {
                    gl.useProgram(prog.p);
                    gl.uniformMatrix3fv(prog.u.sceneToClip, false, f.sceneToClip);
                    gl.uniform1f(prog.u.pxPerUnit, pxPerUnit);
                    gl.uniform4fv(prog.u.sizing, f.sizing);
                    gl.uniform2f(prog.u.alphaScale, f.glow, f.psychedelic ? 1 : 0);
                    gl.uniform1f(prog.u.globalTime, f.globalTime);
                    gl.uniform1i(prog.u.paletteSize, this.paletteSize);
                    gl.uniform4fv(prog.u.palette, this.paletteData);
                };
                // 1. Nebula clouds: half resolution, then laid over the target.
                if (f.hasCloud) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, this.clouds.fb);
                    gl.viewport(0, 0, Math.max(1, W >> 1), Math.max(1, H >> 1));
                    gl.clearColor(0, 0, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    common(this.particle, f.pxPerUnit / 2);
                    gl.uniform4fv(this.particle.u.clocks, f.clocks);
                    gl.uniform1f(this.particle.u.lighting, f.lighting);
                    gl.uniform1i(this.particle.u.passMode, 1);
                    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, f.count);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, into);
                    gl.viewport(0, 0, W, H);
                    gl.useProgram(this.copy.p);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, this.clouds.tex);
                    gl.uniform1i(this.copy.u.src, 0);
                    gl.bindVertexArray(this.quadVAO);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    gl.bindVertexArray(this.particleVAO);
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, into);
                gl.viewport(0, 0, W, H);
                // 2. Brush strokes (under the bubbles in Aquatic). Big, soft paint
                //    covers the screen many times over, so like the clouds it is
                //    painted at half resolution (VoidDevice-tunable) and laid over.
                if (f.hasBrush) {
                    const half = f.brushHalfRes !== false;
                    if (half) {
                        gl.bindFramebuffer(gl.FRAMEBUFFER, this.clouds.fb);
                        gl.viewport(0, 0, Math.max(1, W >> 1), Math.max(1, H >> 1));
                        gl.clearColor(0, 0, 0, 0);
                        gl.clear(gl.COLOR_BUFFER_BIT);
                    }
                    common(this.brush, half ? f.pxPerUnit / 2 : f.pxPerUnit);
                    gl.uniform1f(this.brush.u.frameNo, f.clocks[3]);
                    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, f.count);
                    if (half) {
                        gl.bindFramebuffer(gl.FRAMEBUFFER, into);
                        gl.viewport(0, 0, W, H);
                        gl.useProgram(this.copy.p);
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, this.clouds.tex);
                        gl.uniform1i(this.copy.u.src, 0);
                        gl.bindVertexArray(this.quadVAO);
                        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                        gl.bindVertexArray(this.particleVAO);
                    }
                }
                // 3. Everything else.
                common(this.particle, f.pxPerUnit);
                gl.uniform4fv(this.particle.u.clocks, f.clocks);
                gl.uniform1f(this.particle.u.lighting, f.lighting);
                gl.uniform1i(this.particle.u.passMode, 0);
                gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, f.count);
            }
            if (kaleido) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.useProgram(this.mesh.p);
                gl.uniform2f(this.mesh.u.px, W, H);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.layer.tex);
                gl.uniform1i(this.mesh.u.src, 0);
                gl.bindVertexArray(this.meshVAO);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuf);
                gl.bufferData(gl.ARRAY_BUFFER, f.kaleido, gl.STREAM_DRAW);
                gl.drawArrays(gl.TRIANGLES, 0, f.kaleido.length / 4);
            }

            // 3. Present.
            gl.disable(gl.BLEND);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.useProgram(this.copy.p);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, dst.tex);
            gl.uniform1i(this.copy.u.src, 0);
            gl.bindVertexArray(this.quadVAO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            this.cur = 1 - this.cur;
        }
    }

    // ---------------------------------------------------------------------
    // Engine: FlowSimulation.tick for the GL path
    // ---------------------------------------------------------------------
    function hslToRgb(h, s, l) {
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)];
    }

    class Engine {
        // gl: WebGL2 context. width/height: scene units (CSS px). resolution:
        // device pixels per scene unit.
        constructor(gl, renderer) {
            this.gl = gl;
            this.renderer = renderer || new Renderer(gl);   // shared with the recorder engine
            this.field = new Field();
            // FlowSimulation's defaults; the page sends its own settings over these.
            this.settings = { speed: 1.0, density: 1200, turbulence: 0.65, flowOrganic: 0.85, dissipation: 0.012,
                zoom: 1.0, baseSize: 2.8, sizeVariation: 1.4, stretch: 1.6, interaction: 0.7,
                kaleidoscopeEnabled: false, kaleidoscopeSegments: 6, rotationSpeed: 0.0, wobble: 0.0,
                veilDriftEnabled: true, veilDriftRotation: 0.55, veilDriftZoom: 0.75, veilDriftWander: 0.45,
                psychedelicMode: false, morphingBg: false, spinningKaleido: false,
                kaleidoAxesRings: 1, kaleidoRingFolds: "same", kaleidoRingStep: 2, kaleidoRingCustom: [6, 8, 10, 12, 14],
                particleShape: "ellipse" };
            this.particleScale = 1;
            this.bg = [0, 0, 0];
            this.forces = { shockwaves: [], vortices: [] };
            this.globalTime = 0;
            this.globalRotation = 0;
            this.lastFrame = 0;
            this.axisClock = makeAxisClock();
            this.solid = false;
            this.paused = false;
            this.width = 0; this.height = 0; this.resolution = 1;
        }

        resize(width, height, resolution) {
            const first = !this.width;
            this.width = width; this.height = height; this.resolution = resolution;
            this.viewportScale = Math.min(2.0, Math.max(0.42, width / 1600));
            this.renderer.resize(Math.round(width * resolution), Math.round(height * resolution));
            this.updateCount();
            if (first) this.field.respawnAll(width, height);
        }

        setSettings(s) {
            const before = this.settings.density;
            Object.assign(this.settings, s);
            if (s.density !== undefined && s.density !== before) this.updateCount();
        }

        setPalette(colors) { this.renderer.setPalette(colors); }
        setBackground(rgb) { this.bg = rgb; }
        setParticleScale(v) { this.particleScale = v; this.updateCount(); }

        updateCount() {
            const scaleRef = Math.max(0.42, this.viewportScale || 1.0);
            this.field.setCount(this.settings.density * (0.35 + scaleRef * 0.65) * this.particleScale, this.width, this.height);
        }

        // Beat forces from the page (FlowSimulation.triggerShockwave / triggerVortex)
        addShockwave(x, y, force = 18.0, speed = 5.5, widthPx = null) {
            const maxRadius = Math.max(this.width, this.height) * 0.55;
            this.forces.shockwaves.push({ x, y, radius: 5, maxRadius, force, speed, widthPx });
        }
        addVortex(x, y, radius = 300, strength = 15.0, life = 45) {
            this.forces.vortices.push({ x, y, radius, strength, life, maxLife: life });
        }

        // One frame. nowMs: frame timestamp. Returns the particle count.
        frame(nowMs) {
            if (this.paused || !this.width) return this.field.n;
            const s = this.settings;
            const elapsedSeconds = this.lastFrame ? Math.max(0, (nowMs - this.lastFrame) / 1000) : 1 / 60;
            this.lastFrame = nowMs;
            // The 2D renderer caps a step at 2/60 s; TV frames are 1/25 s, so
            // allow up to 3.6/60 s here to keep the same motion speed.
            const delta = Math.min(elapsedSeconds, 0.06);
            const dt = Math.min(delta * 60, 3.6);
            this.globalTime += delta * 60;

            const sw = this.forces.shockwaves;
            for (let i = sw.length - 1; i >= 0; i--) { sw[i].radius += sw[i].speed * dt; if (sw[i].radius >= sw[i].maxRadius) sw.splice(i, 1); }
            const vo = this.forces.vortices;
            for (let i = vo.length - 1; i >= 0; i--) { vo[i].life -= dt; if (vo[i].life <= 0) vo.splice(i, 1); }

            let bg = this.bg;
            if (s.morphingBg) bg = hslToRgb((this.globalTime * 0.08) % 360, 0.24, 0.012);
            const blackBg = !s.morphingBg && bg[0] === 0 && bg[1] === 0 && bg[2] === 0;

            const scaleRef = Math.max(0.4, this.viewportScale || 1.0);
            this.field.step(s, this.globalTime, dt, this.width, this.height, scaleRef, this.forces);

            // Scene transform: Veil Drift, rotation/wobble, cover scale (tick()).
            const w = this.width, h = this.height;
            const driftOn = s.veilDriftEnabled !== false;
            if (this.veilDriftBlend === undefined) this.veilDriftBlend = driftOn ? 1 : 0;
            this.veilDriftBlend += ((driftOn ? 1 : 0) - this.veilDriftBlend) * Math.min(1, dt * 0.018);
            const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
            const driftRotation = this.veilDriftBlend * clamp01(s.veilDriftRotation);
            const driftZoom = this.veilDriftBlend * clamp01(s.veilDriftZoom);
            const driftWander = this.veilDriftBlend * clamp01(s.veilDriftWander);
            const motionStep = Math.min(elapsedSeconds, 0.25);
            this.veilDriftAngle = ((this.veilDriftAngle || 0) + (Math.PI / 6 / 4) * (driftRotation / 0.55) * motionStep) % TAU;
            const t = this.globalTime;
            const driftX = (Math.sin(t * 0.00078 + 1.1) + Math.sin(t * 0.00031 + 2.7) * 0.45) * w * driftWander * 0.026;
            const driftY = (Math.sin(t * 0.00065 + 2.1) + Math.sin(t * 0.00027 + 0.4) * 0.5) * h * driftWander * 0.022;
            if (!driftOn) this.veilDriftBreathTime = 0;
            else this.veilDriftBreathTime = (this.veilDriftBreathTime || 0) + motionStep;
            const breathPhase = (1 - Math.cos(this.veilDriftBreathTime * Math.PI / 7.5)) / 2;
            const breathingZoom = 1 + Math.min(0.75, driftZoom) * breathPhase;
            if (s.rotationSpeed > 0.005) {
                const wobbleVal = Math.sin(t * 0.05) * (s.wobble || 0) * 0.03;
                this.globalRotation += ((s.rotationSpeed * 0.004) + wobbleVal * 0.002) * dt;
            }
            const angle = this.globalRotation + this.veilDriftAngle;
            const cx = w / 2, cy = h / 2;
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const offX = Math.abs(cosA * driftX + sinA * driftY);
            const offY = Math.abs(-sinA * driftX + cosA * driftY);
            const cover = Math.max(1,
                Math.abs(cosA) + Math.abs(sinA) * h / w + offX / cx,
                Math.abs(cosA) + Math.abs(sinA) * w / h + offY / cy) * 1.08;
            const scale = cover * breathingZoom;
            // scene -> pixel: T(c + drift) * S(scale) * R(angle) * T(-c), times resolution
            const r = this.resolution, W = this.renderer.W, H = this.renderer.H;
            const a = scale * cosA * r, b = scale * sinA * r;
            const tx = (cx + driftX) * r - (a * cx - b * cy);
            const ty = (cy + driftY) * r - (b * cx + a * cy);
            // pixel -> clip: x' = 2x/W - 1, y' = 1 - 2y/H (column-major mat3)
            const m = this.sceneToClip || (this.sceneToClip = new Float32Array(9));
            m[0] = 2 * a / W;  m[1] = -2 * b / H; m[2] = 0;
            m[3] = -2 * b / W; m[4] = -2 * a / H; m[5] = 0;
            m[6] = 2 * tx / W - 1; m[7] = 1 - 2 * ty / H; m[8] = 1;

            let kaleido = null;
            if (s.kaleidoscopeEnabled && Math.floor(s.kaleidoscopeSegments || 6) >= 3) {
                const axis = this.axisClock(s.spinningKaleido === true, nowMs / 1000);
                kaleido = kaleidoMesh(W, H, s, axis);
            }

            // Wall-clock timers the 2D renderer reads from Date.now(), reduced
            // to small angles so the GPU's floats stay precise.
            const T = Date.now() * 0.00008;
            this.frameNo = ((this.frameNo || 0) + 1) % 997;
            const clocks = [T % TAU, (T * 0.73) % TAU, (Date.now() * 0.016) % TAU, this.frameNo];
            const lighting = s.particleLighting === "pearl" ? 2 : (s.particleLighting && s.particleLighting !== "glow" ? 1 : 0);

            this.renderer.draw({
                clocks, lighting,
                instances: this.field.pack(s),
                hasBrush: this.field.hasBrush,
                brushHalfRes: this.brushHalfRes !== false,
                hasCloud: this.field.hasCloud,
                count: this.field.n,
                sceneToClip: m,
                pxPerUnit: scale * r,
                sizing: [s.baseSize ?? 2.4, s.sizeVariation ?? 1, scaleRef, (s.stretch ?? 1.6) * (s.meditationTailScale || 1.0)],
                glow: s.meditationGlowScale || 1.0,
                psychedelic: !!s.psychedelicMode,
                globalTime: this.globalTime,
                bg,
                fadeAmount: Math.max(0.001, Math.min(1.0, 1.0 - Math.pow(1.0 - (s.dissipation ?? 0.012), dt))),
                blackBg,
                solid: this.solid,
                kaleido
            });
            return this.field.n;
        }
    }

    // ---------------------------------------------------------------------
    // Frame pacing: draw on every `every`-th display refresh. The refresh is
    // measured between callbacks that follow a skipped frame (they land one
    // refresh apart); the 60 Hz default already paces 50 Hz correctly.
    // ---------------------------------------------------------------------
    class Pacer {
        constructor(every = 2) {
            this.every = every;
            this.refreshMs = 1000 / 60;
            this.lastDrawn = 0;
            this.lastCall = 0;
            this.prevSkipped = false;
            this.samples = [];
        }
        // true: draw this frame
        tick(now) {
            if (this.prevSkipped && this.lastCall) {
                this.samples.push(now - this.lastCall);
                if (this.samples.length >= 40) {
                    const sorted = this.samples.splice(0).sort((a, b) => a - b);
                    this.refreshMs = Math.min(1000 / 24, Math.max(1000 / 75, sorted[20]));
                }
            }
            this.lastCall = now;
            if (this.every <= 1) { this.prevSkipped = false; return true; }
            this.prevSkipped = now - this.lastDrawn < this.refreshMs * (this.every - 0.5);
            if (this.prevSkipped) return false;
            this.lastDrawn = now;
            return true;
        }
        get targetFps() { return 1000 / (this.refreshMs * Math.max(1, this.every)); }
    }

    // Runs an Engine on a rAF clock with pacing and once-a-second stats.
    function runLoop(engine, raf, onStats, pacer) {
        let frames = 0, statStart = 0, workMs = 0, running = true;
        function loop(now) {
            if (!running) return;
            raf(loop);
            if (pacer && !pacer.tick(now)) return;
            const t0 = performance.now();
            const count = engine.frame(now);
            workMs += performance.now() - t0;
            frames++;
            if (!statStart) statStart = now;
            if (now - statStart >= 1000) {
                onStats && onStats({ fps: +(frames * 1000 / (now - statStart)).toFixed(1), count,
                    workMs: +(workMs / frames).toFixed(1), targetFps: pacer ? Math.round(pacer.targetFps) : null });
                frames = 0; workMs = 0; statStart = now;
            }
        }
        raf(loop);
        return { stop() { running = false; } };
    }

    // Shapes the GL path can draw so far (everything else stays 2D).
    const SUPPORTED_SHAPES = new Set(["ellipse", "drop", "ring", "cluster", "brush", "acid", "aquatic", "nebula"]);

    root.TvGLCore = {
        simplexNoise, curlNoise, Field, Renderer, Engine, Pacer, runLoop, SUPPORTED_SHAPES,
        kaleidoRingAxis, kaleidoRingRadius, kaleidoRingFolds, kaleidoTier, kaleidoMesh, makeAxisClock
    };
})(typeof self !== "undefined" ? self : globalThis);
