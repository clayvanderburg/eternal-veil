// Particle shapes (js/particle-sprites.js): settings resolve and clamp, every shape builds a
// closed path, drawing is balanced (save/restore) and follows heading or spin, and the site
// only swaps the look for generic scenes (never Nebula's clouds or paint trails).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Minimal Path2D that records what each shape draws.
class Path2D {
    constructor() { this.ops = []; }
    moveTo(...a) { this.ops.push(['moveTo', ...a]); }
    lineTo(...a) { this.ops.push(['lineTo', ...a]); }
    arc(...a) { this.ops.push(['arc', ...a]); }
    ellipse(...a) { this.ops.push(['ellipse', ...a]); }
    quadraticCurveTo(...a) { this.ops.push(['quad', ...a]); }
    closePath() { this.ops.push(['close']); }
}
global.Path2D = Path2D;
const S = require('../js/particle-sprites.js');

// Settings
assert.equal(S.resolve({}), null, 'no sprite: scene default');
assert.equal(S.resolve({ particleSprite: 'auto' }), null);
assert.equal(S.resolve({ particleSprite: 'nonsense' }), null, 'unknown shape: scene default');
assert.deepEqual(S.resolve({ particleSprite: 'star', spriteTaper: 2, spritePoints: 11.4, spriteGlow: -1, spriteCore: 'x', spriteSpin: -3 }),
    { shape: 'star', taper: 1, points: 8, glow: 0, core: 0.4, spin: -1 }, 'clamped');
assert.deepEqual(S.KEYS[0], 'auto');
assert.equal(new Set(S.KEYS).size, S.KEYS.length);

// Which scenes change
for (const scene of ['ellipse', 'drop', 'acid', 'nebula', 'cluster', 'ring', 'aquatic', 'nebulaSpark', 'solarFlare', 'violetUndertow', undefined]) {
    assert(S.appliesTo(scene), `${scene} uses generic particles`);
}
for (const scene of ['ocean', 'lotus', 'chromeRibbon', 'mandelbrotDive', 'pendulumSpiral', 'zenMandala', 'brush']) {
    assert(!S.appliesTo(scene), `${scene} keeps its own particles`);
}

// Every shape builds a path that stays near the unit size, for any taper and point count.
for (const { key } of S.SHAPES.filter(s => s.key !== 'auto')) {
    for (const taper of [0, 0.5, 1]) {
        for (const points of [3, 5, 8]) {
            const { path: p, rule } = S.unitPath(key, taper, points);
            assert(p.ops.length > 0, `${key} draws`);
            assert(['nonzero', 'evenodd'].includes(rule));
            const xs = [], ys = [];
            for (const [op, ...a] of p.ops) {
                if (op === 'moveTo' || op === 'lineTo') { xs.push(a[0]); ys.push(a[1]); }
                if (op === 'quad') { xs.push(a[2]); ys.push(a[3]); }
                if (op === 'arc') { xs.push(a[0] - a[2], a[0] + a[2]); ys.push(a[1] - a[2], a[1] + a[2]); }
                if (op === 'ellipse') { xs.push(a[0] - a[2], a[0] + a[2]); ys.push(a[1] - a[2], a[1] + a[2]); }
            }
            assert(xs.concat(ys).every(Number.isFinite), `${key} finite`);
            assert(Math.max(...ys.map(Math.abs)) <= 1.4, `${key} stays about one radius tall`);
            assert(Math.max(...xs.map(Math.abs)) <= 7, `${key} tail stays bounded`);
        }
    }
}
const star5 = S.unitPath('star', 0.5, 5).path.ops.filter(o => o[0] === 'lineTo' || o[0] === 'moveTo').length;
assert.equal(star5, 10, 'a 5-point star has 10 corners');
assert.equal(S.unitPath('petal', 0.5, 6).path.ops.filter(o => o[0] === 'ellipse').length, 6, '6 petals');
assert.equal(S.unitPath('gem', 0.2, 6).path.ops.filter(o => o[0] === 'lineTo' || o[0] === 'moveTo').length, 6, 'hexagon gem');
assert(S.unitPath('comet', 1, 5).path.ops.some(o => o[0] === 'quad' && o[3] < -5), 'long taper = long comet tail');
assert(S.unitPath('teardrop', 0, 5).path.ops.some(o => o[0] === 'quad' && o[3] > -1), 'no taper = short teardrop');
assert.equal(S.unitPath('ring', 0.5, 5).rule, 'evenodd', 'ring has a hole');

// Drawing: balanced, follows heading (or spins), honours glow/core.
const log = [];
let depth = 0;
const ctx = {
    save() { depth++; }, restore() { depth--; }, translate(x, y) { log.push(['t', x, y]); }, rotate(a) { log.push(['r', a]); },
    scale(x, y) { log.push(['s', x, y]); }, fill() { log.push(['fill', this.globalAlpha, this.fillStyle]); },
    beginPath() {}, arc() {}, globalAlpha: 1, fillStyle: ''
};
const draw = (sprite, opts = {}) => { log.length = 0; S.draw(ctx, 10, 20, 6, 0.7, '#ff00aa', 0.8, sprite, opts.t || 0, opts.phase || 0); return log.slice(); };
const star = S.resolve({ particleSprite: 'star', spriteGlow: 0, spriteCore: 0 });
let ops = draw(star);
assert.equal(depth, 0, 'balanced save/restore');
assert.deepEqual(ops.filter(o => o[0] === 't')[0], ['t', 10, 20]);
assert.deepEqual(ops.filter(o => o[0] === 'r')[0], ['r', 0.7], 'points along its motion');
assert.equal(ops.filter(o => o[0] === 'fill').length, 1, 'no glow, no core: one fill');
assert(ops.find(o => o[0] === 'fill')[1] <= 0.8, 'alpha never above the particle alpha');
ops = draw(S.resolve({ particleSprite: 'star', spriteGlow: 1, spriteCore: 1 }));
assert.equal(ops.filter(o => o[0] === 'fill').length, 5, 'three halo layers + body + core');
assert.equal(depth, 0);
const spun = S.resolve({ particleSprite: 'gem', spriteSpin: 0.5 });
const angleAt = t => draw(spun, { t, phase: 0.2 }).find(o => o[0] === 'r')[1];
assert.notEqual(angleAt(0), 0.7, 'spinning ignores heading');
assert(Math.abs(angleAt(1) - angleAt(0) - 1.25) < 1e-9, 'spin 0.5 turns 1.25 rad per second');
draw(null); draw(star, {}); S.draw(ctx, 0, 0, 0, 0, '#fff', 1, star); S.draw(ctx, 0, 0, 5, 0, '#fff', 0, star);
assert.equal(depth, 0, 'nothing to draw: nothing changes');

// Cached images: built once per look and color (Rainbow hues share 6° steps), stamped centred
// on the particle under any canvas transform, canvas state put back afterwards.
assert.equal(S.colorKey('#ff00aa'), '#ff00aa');
assert.equal(S.colorKey('hsla(123.4, 98%, 62%, 0.85)'), 'hsla(126, 98%, 62%, 0.85)');
assert.equal(S.colorKey('hsla(359, 98%, 62%, 0.85)'), 'hsla(0, 98%, 62%, 0.85)');
let built = 0;
global.document = { createElement: () => { built++; return { width: 0, height: 0, getContext: () => ({ ...ctx, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), setTransform() {} }) }; } };
{
    let m = [2, 0, 0, 2, 30, 40]; // a DPR / zoom transform already on the canvas
    const stamps = [];
    const target = {
        globalAlpha: 0.33,
        getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
        setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f]; },
        drawImage(img, dx, dy, dw, dh) { stamps.push({ img, m: m.slice(), dx, dy, dw, dh, alpha: this.globalAlpha }); }
    };
    const petal = S.resolve({ particleSprite: 'comet', spriteGlow: 0.6 });
    S.draw(target, 100, 50, 8, Math.PI / 2, '#ff00aa', 0.7, petal);
    S.draw(target, 10, 10, 4, 0, '#ff00aa', 0.5, petal);
    assert.equal(built, 1, 'one image per look and color, reused');
    assert.equal(stamps[0].img, stamps[1].img);
    const st = stamps[0];
    // The image's origin (the particle centre) must land on the particle, through the base transform.
    const ox = st.dx + (-st.dx), oy = st.dy + (-st.dy); // local point (0,0)
    const [a, b, c, d, e, f] = st.m;
    assert(Math.abs(a * ox + c * oy + e - (2 * 100 + 30)) < 1e-9 && Math.abs(b * ox + d * oy + f - (2 * 50 + 40)) < 1e-9, 'centred on the particle');
    assert(Math.abs(Math.hypot(a, b) - 2) < 1e-9, 'scale kept');
    assert(Math.abs(Math.atan2(b, a) - Math.PI / 2) < 1e-9, 'turned to its heading');
    assert.equal(st.alpha, 0.7);
    assert.deepEqual(m, [2, 0, 0, 2, 30, 40], 'transform put back');
    assert.equal(target.globalAlpha, 0.33, 'alpha put back');
    assert(st.dx < 0 && st.dx + st.dw > 0 && st.dy < 0 && st.dy + st.dh > 0, 'the image surrounds the centre');
    assert(-st.dx > st.dx + st.dw, 'a comet image reaches further back (its tail) than forward');
    built = 0;
    for (let i = 0; i < 360; i++) S.draw(target, 0, 0, 4, 0, `hsla(${i + 0.5}, 98%, 62%, 0.85)`, 0.5, S.resolve({ particleSprite: 'star' }));
    assert(built <= 61, `Rainbow hues share images (${built} built for 360 hues)`);
}
delete global.document;

// The site: generic scenes only, never clouds or paint trails; orb keeps lit lighting.
const sim = fs.readFileSync(path.join(__dirname, '../js/simulation.js'), 'utf8').replace(/\r\n/g, '\n');
assert(sim.includes('!keepsSceneLook && shape !== "brush" && sprites.appliesTo(settings.particleShape)'), 'sprite only for generic particles');
assert(/nebulaType === "cloud"\) \{\n\s+keepsSceneLook = true;/.test(sim), 'Nebula clouds keep their look');
assert(sim.includes('sprite.shape === "orb" && (settings.particleLighting || "glow") !== "glow"'), 'orb keeps lit lighting modes');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(html.indexOf('js/particle-sprites.js') > 0 && html.indexOf('js/particle-sprites.js') < html.indexOf('js/simulation.js'), 'loaded before the simulation');

// The app: a preset's shape on load and when Flow visits its scene; defaults otherwise.
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8').replace(/\r\n/g, '\n');
assert(app.includes('applyPresetSprite(p);'), 'loading a preset applies its shape');
assert(app.includes('if (nextPatternShape) applyPresetSprite(familyPreset);'), 'Flow applies the scene preset shape');
const fnStart = app.indexOf('    function particleSpriteKeys() {');
const fnEnd = app.indexOf('    function isFlowEnabled(key) {');
const settings = { particleSprite: 'star', spriteTaper: 0.9 };
const apply = new Function('sim', 'window', app.slice(fnStart, fnEnd) + '\nreturn applyPresetSprite;')({ settings }, { ParticleSprites: S });
apply({ particleSprite: 'petal', spritePoints: 7 });
assert.deepEqual(settings, { particleSprite: 'petal', spriteTaper: 0.5, spritePoints: 7, spriteGlow: 0.5, spriteCore: 0.4, spriteSpin: 0 });
apply(undefined);
assert.equal(settings.particleSprite, 'auto', 'no preset: scene default');

console.log(`Particle shapes: ${S.SHAPES.length - 1} shapes build and draw cleanly; only generic particles change.`);
