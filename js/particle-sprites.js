// ==========================================================================
// ETERNAL VOID - PARTICLE SPRITES
// A preset can give its plain particles a shape of its own (star, petal, comet…).
// One drawing routine shared by the site (Particle.draw in js/simulation.js) and the
// Studio's particle preview, so the preview is always exactly what the site draws.
//
// Preset / app settings (all optional; "auto" keeps the scene's own look):
//   particleSprite  auto | comet | orb | teardrop | star | spark | diamond | petal | gem | ring | crescent
//   spriteTaper     0-1  tail length (comet, teardrop), point sharpness (star, spark),
//                        stretch (diamond, gem), petal thinness, ring/crescent thinness
//   spritePoints    3-8  points (star, spark), petals (petal), sides (gem)
//   spriteGlow      0-1  soft halo around the shape
//   spriteCore      0-1  bright centre
//   spriteSpin     -1-1  0 = points along its motion; otherwise tumbles that way and fast
// Only scenes that draw generic particles use it (SCENES below); scenes with their own
// authored particles (ribbons, ocean, lotus, spirals...) keep their look.
// ==========================================================================
(function () {
    const SHAPES = [
        { key: "auto", label: "Scene default" },
        { key: "comet", label: "Comet", uses: ["taper"] },
        { key: "orb", label: "Orb", uses: [] },
        { key: "teardrop", label: "Teardrop", uses: ["taper"] },
        { key: "star", label: "Star", uses: ["taper", "points"] },
        { key: "spark", label: "Spark", uses: ["taper", "points"] },
        { key: "diamond", label: "Diamond", uses: ["taper"] },
        { key: "petal", label: "Petal flower", uses: ["taper", "points"] },
        { key: "gem", label: "Gem", uses: ["taper", "points"] },
        { key: "ring", label: "Ring", uses: ["taper"] },
        { key: "crescent", label: "Crescent", uses: ["taper"] }
    ];
    const KEYS = SHAPES.map(s => s.key);
    const DEFAULTS = { particleSprite: "auto", spriteTaper: 0.5, spritePoints: 5, spriteGlow: 0.5, spriteCore: 0.4, spriteSpin: 0 };
    // Scenes whose particles are drawn generically, so a sprite shape applies. Notes say
    // which of their particles change.
    const SCENES = {
        ellipse: "all particles", drop: "all particles", ring: "all particles", cluster: "all particles",
        acid: "all raindrops", nebula: "the stars (clouds keep their look)", aquatic: "the bubbles (paint trails keep their look)",
        nebulaSpark: "the background sparks", solarFlare: "the background particles", violetUndertow: "the background particles"
    };

    const clamp = (v, lo, hi, fallback) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
    };
    // The sprite a settings object asks for, or null for the scene's own look.
    function resolve(settings) {
        const s = settings || {};
        const shape = KEYS.includes(s.particleSprite) ? s.particleSprite : "auto";
        if (shape === "auto") return null;
        return {
            shape,
            taper: clamp(s.spriteTaper, 0, 1, DEFAULTS.spriteTaper),
            points: Math.round(clamp(s.spritePoints, 3, 8, DEFAULTS.spritePoints)),
            glow: clamp(s.spriteGlow, 0, 1, DEFAULTS.spriteGlow),
            core: clamp(s.spriteCore, 0, 1, DEFAULTS.spriteCore),
            spin: clamp(s.spriteSpin, -1, 1, DEFAULTS.spriteSpin)
        };
    }
    function appliesTo(sceneShape) {
        return Object.prototype.hasOwnProperty.call(SCENES, sceneShape || "ellipse");
    }

    // ---------- unit shapes (radius 1, heading along +x) ----------
    const cache = new Map();
    function unitPath(shape, taper, points) {
        const key = `${shape}|${Math.round(taper * 50)}|${points}`;
        let entry = cache.get(key);
        if (entry) return entry;
        if (typeof Path2D === "undefined") return null;
        const p = new Path2D();
        let evenOdd = false;
        const poly = pts => { pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); };
        const TAU = Math.PI * 2;
        if (shape === "orb") {
            p.arc(0, 0, 1, 0, TAU);
        } else if (shape === "comet" || shape === "teardrop") {
            // Round head at the front, tapering to a point behind.
            const tail = shape === "comet" ? 1.4 + taper * 5 : 0.5 + taper * 2.2;
            const waist = shape === "comet" ? 0.75 - taper * 0.35 : 0.9 - taper * 0.3;
            p.moveTo(0, -1);
            p.arc(0, 0, 1, -Math.PI / 2, Math.PI / 2);
            p.quadraticCurveTo(-tail * 0.45, waist, -tail, 0);
            p.quadraticCurveTo(-tail * 0.45, -waist, 0, -1);
            p.closePath();
        } else if (shape === "star" || shape === "spark") {
            const inner = shape === "star" ? 0.62 - taper * 0.45 : 0.16 - taper * 0.1;
            const outer = shape === "star" ? 1 : 1.3;
            const pts = [];
            for (let i = 0; i < points * 2; i++) {
                const a = (i * Math.PI) / points;
                const r = i % 2 ? inner : outer;
                pts.push([Math.cos(a) * r, Math.sin(a) * r]);
            }
            poly(pts);
        } else if (shape === "diamond") {
            poly([[1 + taper * 1.4, 0], [0, 0.7], [-(0.9 + taper * 0.6), 0], [0, -0.7]]);
        } else if (shape === "petal") {
            const wide = 0.5 * (1 - taper * 0.7);
            for (let i = 0; i < points; i++) {
                const a = (i * TAU) / points;
                p.moveTo(Math.cos(a) * 1.05, Math.sin(a) * 1.05);
                p.ellipse(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.5, wide, a, 0, TAU);
            }
        } else if (shape === "gem") {
            const stretch = 1 + taper * 0.9;
            const pts = [];
            for (let i = 0; i < points; i++) {
                const a = (i * TAU) / points;
                pts.push([Math.cos(a) * stretch, Math.sin(a)]);
            }
            poly(pts);
        } else if (shape === "ring") {
            p.arc(0, 0, 1, 0, TAU);
            p.moveTo(0.8 - taper * 0.3 + 0.12, 0);
            p.arc(0, 0, 0.92 - taper * 0.3, 0, TAU, true);
            evenOdd = true;
        } else if (shape === "crescent") {
            // Outer arc of the unit circle and inner arc of the same circle shifted by d.
            const d = 0.3 + taper * 0.55;
            const y = Math.sqrt(1 - (d * d) / 4);
            const t1 = Math.atan2(y, d / 2);
            p.arc(0, 0, 1, t1, TAU - t1);
            p.arc(d, 0, 1, Math.atan2(-y, -d / 2), Math.atan2(y, -d / 2), true);
            p.closePath();
        } else {
            p.arc(0, 0, 1, 0, TAU);
        }
        entry = { path: p, rule: evenOdd ? "evenodd" : "nonzero" };
        if (cache.size > 96) cache.clear();
        cache.set(key, entry);
        return entry;
    }

    // Glow layers, outermost first: [how much bigger at full glow, alpha].
    const GLOW_LAYERS = [[1.6, 0.07], [0.9, 0.12], [0.35, 0.2]];

    // Vector drawing of one particle (used to build the cached images, and directly where
    // there is no document, e.g. tests). `radius` is its size on screen, `angle` its turn.
    function drawVector(ctx, x, y, radius, angle, color, alpha, sprite) {
        const shape = unitPath(sprite.shape, sprite.taper, sprite.points);
        if (!shape) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(radius, radius);
        ctx.fillStyle = color;
        if (sprite.glow > 0) {
            // Soft halo: three faint, growing copies of the shape, so the glow fades out
            // in steps instead of showing one hard-edged ghost.
            for (const [grow, fade] of GLOW_LAYERS) {
                const k = 1 + grow * (0.4 + sprite.glow * 0.6);
                ctx.save();
                ctx.scale(k, k);
                ctx.globalAlpha = alpha * fade * sprite.glow;
                ctx.fill(shape.path, shape.rule);
                ctx.restore();
            }
        }
        if (sprite.shape === "comet") {
            // A fainter, longer wake behind the comet's body.
            ctx.save();
            ctx.translate(-0.3, 0);
            ctx.scale(1.55, 1.1);
            ctx.globalAlpha = alpha * 0.28;
            ctx.fill(shape.path, shape.rule);
            ctx.restore();
        }
        ctx.globalAlpha = alpha * 0.9;
        ctx.fill(shape.path, shape.rule);
        if (sprite.core > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = alpha * 0.85 * sprite.core;
            ctx.beginPath();
            ctx.arc(sprite.shape === "comet" || sprite.shape === "teardrop" ? 0.15 : 0, 0, 0.22 + sprite.core * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // How far each shape reaches from its centre, in unit radii: [back, front, half height].
    function extent(sprite) {
        const t = sprite.taper;
        switch (sprite.shape) {
            case "comet": return [(1.4 + t * 5) * 1.55 + 0.3, 1, 1.1];
            case "teardrop": return [0.5 + t * 2.2, 1, 1];
            case "spark": return [1.3, 1.3, 1.3];
            case "diamond": return [0.9 + t * 0.6, 1 + t * 1.4, 0.7];
            case "petal": return [1.05, 1.05, 1.05];
            case "gem": return [1 + t * 0.9, 1 + t * 0.9, 1];
            default: return [1, 1, 1];
        }
    }

    // Each look is drawn once into a small image (per color) and stamped for every particle:
    // several times cheaper than filling its paths per particle. Rainbow Cycle gives every
    // particle a fresh hue each frame, so hsl hues share images in 6° steps.
    const IMAGE_RADIUS = 40;
    const images = new Map();
    function colorKey(color) {
        const m = /^hsla?\(\s*([-\d.]+)(.*)$/i.exec(color);
        if (!m) return color;
        const hue = ((Math.round(Number(m[1]) / 6) * 6) % 360 + 360) % 360;
        return `hsla(${hue}${m[2]}`;
    }
    function image(sprite, color) {
        if (typeof document === "undefined") return null;
        const shade = colorKey(color);
        const key = `${sprite.shape}|${Math.round(sprite.taper * 50)}|${sprite.points}|${Math.round(sprite.glow * 20)}|${Math.round(sprite.core * 20)}|${shade}`;
        let img = images.get(key);
        if (img) return img;
        const [back, front, half] = extent(sprite);
        const grow = sprite.glow > 0 ? 1 + GLOW_LAYERS[0][0] * (0.4 + sprite.glow * 0.6) : 1;
        const R = IMAGE_RADIUS, pad = 2;
        const w = Math.ceil((back + front) * grow * R) + pad * 2, h = Math.ceil(2 * half * grow * R) + pad * 2;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const g = canvas.getContext("2d");
        if (!g) return null;
        const ox = back * grow * R + pad, oy = h / 2;
        drawVector(g, ox, oy, R, 0, shade, 1, sprite);
        img = { canvas, ox, oy, w, h };
        if (images.size >= 400) images.delete(images.keys().next().value); // oldest first
        images.set(key, img);
        return img;
    }

    // Draw one particle. `radius` is its size on screen, `heading` its direction of motion,
    // `time` seconds, `phase` a per-particle offset (spin and variety).
    function draw(ctx, x, y, radius, heading, color, alpha, sprite, time = 0, phase = 0) {
        if (!sprite || !(radius > 0) || !(alpha > 0)) return;
        const angle = sprite.spin ? phase * 6.283 + time * sprite.spin * 2.5 : heading;
        const img = image(sprite, color);
        if (!img) { drawVector(ctx, x, y, radius, angle, color, alpha, sprite); return; }
        const k = radius / IMAGE_RADIUS;
        // Set the turned transform directly and put the canvas back afterwards
        // (about a fifth cheaper than save/restore per particle).
        const m = ctx.getTransform();
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const alphaBefore = ctx.globalAlpha;
        ctx.setTransform(m.a * cos + m.c * sin, m.b * cos + m.d * sin, m.c * cos - m.a * sin, m.d * cos - m.b * sin,
            m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
        ctx.globalAlpha = alpha;
        ctx.drawImage(img.canvas, -img.ox * k, -img.oy * k, img.w * k, img.h * k);
        ctx.setTransform(m);
        ctx.globalAlpha = alphaBefore;
    }

    const api = { SHAPES, KEYS, DEFAULTS, SCENES, resolve, appliesTo, draw, drawVector, unitPath, extent, colorKey };
    if (typeof window !== "undefined") window.ParticleSprites = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
