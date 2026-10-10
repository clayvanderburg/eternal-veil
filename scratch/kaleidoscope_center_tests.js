// Kaleidoscope geometry (drawWedgeKaleidoscope in js/simulation.js): every scene mirrors one
// slice around the centre. Checks, across aspect ratios, segment counts (odd too) and spin:
// 2N slices, each stamped with its apex on the scene centre, alternating mirror images, radii
// preserved, the source clipped and drawn only once per frame, and the outer transform restored.
// Spinning Mandala Axes: the axis turns where the slice is sampled (never the stamps), the zoom
// never changes, the scene's mirrored tiles fill wherever a turned slice runs past its edges,
// and axis 0 is the still kaleidoscope (one draw).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/simulation.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('let kaleidoSlice = null;');
const end = source.indexOf('if (typeof window !== "undefined") {\n    window.drawWedgeKaleidoscope');
assert(start > 0 && end > start, 'drawWedgeKaleidoscope found');
assert(!/kaleidoCanvas|LAYER_KALEIDOSCOPE_SHAPES|WEDGE_KALEIDOSCOPE_SHAPES/.test(source), 'the old stacked-copies pass is gone');

let sourceDraws = 0, clips = 0, sliceZoom = 0, sliceTurn = 0, zoomPending = false;
const sliceCtx = { setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, arc() {}, closePath() {},
    clip() { clips++; zoomPending = true; }, scale(z) { if (zoomPending) { sliceZoom = z; zoomPending = false; } },
    rotate(a) { sliceTurn += a; }, translate() {}, drawImage() { sourceDraws++; } };
const document = { createElement: () => ({ width: 0, height: 0, getContext: () => sliceCtx }) };
let clock = 0;
const performance = { now: () => clock };
const { drawWedgeKaleidoscope, kaleidoscopeAxis, kaleidoMirrorTiles, kaleidoRingFolds } = new Function('document', 'performance',
    source.slice(start, end) + '\nreturn { drawWedgeKaleidoscope, kaleidoscopeAxis, kaleidoMirrorTiles, kaleidoRingFolds };')(document, performance);
const noopCtx = { getTransform: () => ({ a: 1, b: 0 }), save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage() {} };

const stillZoomOf = (width, height, segments) => {
    const half = Math.PI / (segments * 2);
    return Math.max(1, Math.hypot(width / 2, height / 2) / Math.min(width / 2, (height / 2) / Math.sin(half)));
};
// Every point of the slice the screen can show (out to the corners) must land on a drawn tile,
// or the mandala would show empty wedges.
function tilesCoverSlice(width, height, segments, axis, zoom) {
    const half = Math.PI / (segments * 2), radius = Math.hypot(width / 2, height / 2) / zoom;
    const tiles = kaleidoMirrorTiles(width, height, half, axis, radius);
    for (let k = 0; k <= 64; k++) {
        const phi = axis - half + (2 * half * k) / 64;
        for (const r of [radius * 0.5, radius * 0.999]) {
            const x = width / 2 + r * Math.cos(phi), y = height / 2 + r * Math.sin(phi);
            if (!tiles.some(([ix, iy]) => x >= ix * width - 1 && x <= (ix + 1) * width + 1 && y >= iy * height - 1 && y <= (iy + 1) * height + 1)) return false;
        }
    }
    return tiles;
}

for (const [width, height] of [[1600, 900], [900, 1600], [1024, 1024]]) {
    for (const segments of [3, 5, 6, 8]) {
        for (const spin of [0, 0.7]) {
            const initial = [1.6, 0, 0, 1.6, 12, 18]; // a DPR/breath transform already on the canvas
            let m = initial.slice();
            const stack = [];
            const multiply = ([a, b, c, d, e, f]) => {
                const [A, B, C, D, E, F] = m;
                m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
            };
            const apply = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
            const dets = [];
            const ctx = {
                getTransform: () => ({ a: m[0], b: m[1] }),
                save() { stack.push(m.slice()); }, restore() { m = stack.pop(); },
                translate(x, y) { multiply([1, 0, 0, 1, x, y]); },
                rotate(a) { multiply([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
                scale(x, y) { multiply([x, 0, 0, y, 0, 0]); },
                drawImage(img, dx, dy, dw, dh) {
                    // The slice's apex (left edge, vertical middle) must land on the scene centre.
                    const [x, y] = apply(dx, dy + dh / 2);
                    assert(Math.abs(x - (1.6 * width / 2 + 12)) < 1e-6 && Math.abs(y - (1.6 * height / 2 + 18)) < 1e-6, 'slice apex on the centre');
                    assert(Math.abs(Math.hypot(m[0] * 37 + m[2] * 19, m[1] * 37 + m[3] * 19) - 1.6 * Math.hypot(37, 19)) < 1e-6, 'radius preserved');
                    dets.push(Math.sign(m[0] * m[3] - m[1] * m[2]));
                }
            };
            sourceDraws = 0; clips = 0;
            const stamps = [];
            const draw = ctx.drawImage;
            ctx.drawImage = function (...args) { stamps.push(m.slice()); return draw.apply(this, args); };
            sliceTurn = 0;
            drawWedgeKaleidoscope(ctx, {}, width, height, segments, spin);
            assert(Math.abs(sliceTurn + spin) < 1e-12, 'the axis turns where the slice is sampled');
            assert(Math.abs(sliceZoom - stillZoomOf(width, height, segments)) < 1e-9, 'same zoom as the still kaleidoscope');
            const tiles = tilesCoverSlice(width, height, segments, spin, sliceZoom);
            assert(tiles, 'mirrored tiles fill the turned slice');
            if (!spin) {
                assert.deepEqual(tiles, [[0, 0]], 'axes at rest: the slice fits the scene');
            } else {
                // The stamps (where the copies land) never turn with the axis.
                const still = [], counts = [sourceDraws, clips];
                ctx.drawImage = function () { still.push(m.slice()); };
                drawWedgeKaleidoscope(ctx, {}, width, height, segments, 0);
                ctx.drawImage = draw;
                [sourceDraws, clips] = counts;
                still.forEach((t, i) => t.forEach((v, j) => assert(Math.abs(v - stamps[i][j]) < 1e-9, 'stamps fixed while the axes turn')));
            }
            assert.equal(dets.length, segments * 2, `${segments} segments = ${segments * 2} slices`);
            dets.forEach((d, i) => assert.equal(d, i % 2 ? -1 : 1, 'slices alternate with their mirror image'));
            assert.equal(sourceDraws, spin ? tiles.length : 1, 'the scene is drawn once per touched tile per frame, not per slice');
            assert.equal(clips, 1);
            assert.deepEqual(m, initial, 'outer transform restored');
        }
    }
}
// At every angle, for every aspect and count: the zoom never changes and the tiles cover the slice.
for (const [width, height] of [[1600, 900], [900, 1600], [1024, 1024], [390, 844], [2560, 1080]]) {
    for (const segments of [3, 4, 5, 6, 8, 12]) {
        for (let k = 0; k < 96; k++) {
            const axis = (Math.PI * 2 * k) / 96;
            sourceDraws = 0;
            drawWedgeKaleidoscope(noopCtx, {}, width, height, segments, axis);
            assert(Math.abs(sliceZoom - stillZoomOf(width, height, segments)) < 1e-9, 'zoom never changes while the axes turn');
            const tiles = tilesCoverSlice(width, height, segments, axis, sliceZoom);
            assert(tiles, `${width}x${height} ${segments}: tiles cover the slice at ${axis.toFixed(2)}`);
            assert(sourceDraws === tiles.length && tiles.length <= 4, 'only the few tiles the slice touches are drawn');
        }
    }
}

// Axes Rings: n concentric tiers, the outermost unclipped and each inner one inside its own
// circle, each sampled at its own axis (alternating direction, faster outward); the centre
// tier follows the axes exactly. One ring, or axes at rest, stays a single plain tier.
{
    const kaleidoRingAxis = new Function(source.slice(source.indexOf('const KALEIDO_RING_SPEEDUP'), source.indexOf('function kaleidoRingRadius')) + '\nreturn kaleidoRingAxis;')();
    const circles = [];
    let depth = 0;
    const ringCtx = { ...noopCtx, save() { depth++; }, restore() { depth--; }, beginPath() {}, arc(x, y, r) { circles.push([x, y, r]); }, clip() {} };
    const tierTurns = (rings, axis) => {
        const turns = [];
        circles.length = 0; sliceTurn = 0; clips = 0;
        const rotate = sliceCtx.rotate;
        sliceCtx.rotate = a => turns.push(-a);
        drawWedgeKaleidoscope(ringCtx, {}, 1600, 900, 6, axis, rings);
        sliceCtx.rotate = rotate;
        return turns;
    };
    assert.deepEqual(tierTurns(1, 0.8), [0.8], 'one ring: the plain sweep');
    assert.deepEqual(tierTurns(4, 0), [], 'axes at rest: one plain tier, no rings');
    assert.equal(clips, 1);
    for (const rings of [2, 3, 5]) {
        const turns = tierTurns(rings, 0.8);
        assert.equal(turns.length, rings, `${rings} rings = ${rings} tiers`);
        assert.equal(clips, rings, 'one slice per tier');
        assert.equal(circles.length, rings - 1, 'every tier but the outermost sits inside a circle');
        assert.equal(depth, 0, 'clips restored');
        // Drawn outermost first, so turns[rings - 1 - k] is ring k.
        turns.reverse().forEach((t, k) => assert(Math.abs(t - kaleidoRingAxis(0.8, k)) < 1e-12, `ring ${k} sweeps at its own axis`));
        assert(Math.abs(turns[0] - 0.8) < 1e-12, 'the centre tier follows the axes');
        assert(turns[1] < 0 && Math.abs(turns[1]) > 0.8, 'its neighbour turns the other way, a little faster');
        circles.forEach(([x, y, r], i) => {
            assert(x === 800 && y === 450, 'rings centred');
            if (i) assert(r < circles[i - 1][2], 'drawn outside in');
        });
        assert(circles[0][2] < Math.hypot(800, 450), 'the outermost tier still reaches the corners');
    }
    assert.equal(tierTurns(9, 0.8).length, 5, 'at most 5 rings');

    // Ring Folds: per-ring fold counts by mode.
    const folds = (mode, extra = {}) => kaleidoRingFolds({ kaleidoscopeSegments: 6, kaleidoAxesRings: 4, kaleidoRingFolds: mode, ...extra });
    assert.deepEqual(folds('same'), [6, 6, 6, 6]);
    assert.deepEqual(folds('growing'), [6, 8, 10, 12], 'growing adds 2 by default');
    assert.deepEqual(folds('growing', { kaleidoRingStep: 3 }), [6, 9, 12, 15]);
    assert.deepEqual(folds('doubling', { kaleidoscopeSegments: 4, kaleidoAxesRings: 3 }), [4, 8, 16]);
    assert.deepEqual(folds('doubling'), [6, 12, 24, 24], 'capped at 24 folds');
    assert.deepEqual(folds('alternating'), [6, 12, 6, 12]);
    assert.deepEqual(folds('custom', { kaleidoRingCustom: [5, 7, 2, 99, 9] }), [5, 7, 3, 24], 'custom, clamped 3-24');
    assert.deepEqual(folds('nonsense'), [6, 6, 6, 6], 'unknown mode: same');
    assert.deepEqual(kaleidoRingFolds({ kaleidoscopeSegments: 7.6 }), [7], 'morphing segments: whole folds, one ring');

    // Each tier stamps 2 × its own folds; different folds show rings even with the axes at rest.
    const tierStamps = (segments, axis, rings) => {
        const per = [];
        const clip = sliceCtx.clip;
        sliceCtx.clip = () => { per.push(0); };
        const counted = { ...ringCtx, drawImage() { per[per.length - 1]++; } };
        drawWedgeKaleidoscope(counted, {}, 1600, 900, segments, axis, rings);
        sliceCtx.clip = clip;
        return per.reverse(); // ring 0 first
    };
    assert.deepEqual(tierStamps([4, 8, 16], 0, 3), [8, 16, 32], 'still layered mandala: each ring its own folds');
    assert.deepEqual(tierStamps([4, 8, 16], 0.5, 3), [8, 16, 32], 'spinning too');
    assert.deepEqual(tierStamps([6, 6, 6], 0, 3), [12], 'same folds at rest: one plain tier');
    assert.deepEqual(tierStamps(6, 0.5, 1), [12], 'a plain number still works');
}

// The shared axes clock: still while off, eases in over ~1.5 s, turns ~0.12 rad/s, glides to a
// stop where it is when switched off, and a long pause (hidden tab) cannot make it jump.
clock = 1000;
let a = kaleidoscopeAxis(false);
assert.equal(a.axis, 0); assert.equal(a.mix, 0);
for (let t = 0; t < 120; t++) { clock += 1000 / 60; a = kaleidoscopeAxis(false); }
assert.equal(a.axis, 0, 'axes still while off');
for (let t = 0; t < 30; t++) { clock += 1000 / 60; a = kaleidoscopeAxis(true); }
assert(a.mix > 0 && a.mix < 1, 'easing in');
for (let t = 0; t < 120; t++) { clock += 1000 / 60; a = kaleidoscopeAxis(true); }
assert.equal(a.mix, 1, 'fully on after ~1.5 s');
let before = a.axis;
for (let t = 0; t < 60; t++) { clock += 1000 / 60; a = kaleidoscopeAxis(true); }
assert(Math.abs(a.axis - before - 0.12) < 1e-6, 'turns 0.12 rad per second');
before = a.axis;
clock += 60000; a = kaleidoscopeAxis(true);
assert(a.axis - before <= 0.12 * 0.1 + 1e-9, 'a long pause cannot make the axes jump');
for (let t = 0; t < 200; t++) { clock += 1000 / 60; a = kaleidoscopeAxis(false); }
assert.equal(a.mix, 0, 'eased out');
before = a.axis;
clock += 1000; a = kaleidoscopeAxis(false);
assert.equal(a.axis, before, 'stopped where it was');

// The kaleidoscope keeps the scene's spin and zoom: the scene is mirrored as drawn before the
// camera move (Veil Drift turn / breathing zoom / wander, global rotation), and the finished
// mandala is then turned, zoomed and drifted by that camera.
{
    const methodStart = source.indexOf('    drawKaleidoscoped(draw) {');
    const methodEnd = source.indexOf('\n    initCanvas() {');
    assert(methodStart > 0 && methodEnd > methodStart, 'drawKaleidoscoped found');
    const body = source.slice(methodStart, methodEnd).replace('    drawKaleidoscoped(draw) {', '').replace(/\}\s*$/, '');
    const layerTransforms = [];
    const mul = (m, [a, b, c, d, e, f]) => [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
    const makeCtx = (onStamp) => {
        let m = [1, 0, 0, 1, 0, 0];
        const stack = [];
        return {
            canvas: { width: 1600, height: 900 },
            getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
            setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f]; },
            save() { stack.push(m.slice()); }, restore() { m = stack.pop(); },
            translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); }, scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
            rotate(a) { m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
            clearRect() {}, beginPath() {}, arc() {}, clip() {},
            drawImage() { onStamp(m.slice()); }, get m() { return m; }
        };
    };
    const stamps = [];
    const main = makeCtx(t => stamps.push(t));
    const layer = makeCtx(() => {});
    const self = {
        settings: { kaleidoscopeEnabled: true, kaleidoscopeSegments: 6, spinningKaleido: false, kaleidoAxesRings: 1 },
        canvas: main.canvas, ctx: main, width: 800, height: 450,
        sceneLayer: { width: 1600, height: 900 }, sceneLayerCtx: layer,
        preCameraTransform: { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }, // DPR 2, before the camera
        camera: { x: 410, y: 220, scale: 1.4, angle: 0.6, cx: 400, cy: 225 }
    };
    const run = new Function('drawWedgeKaleidoscope', 'kaleidoscopeAxis', 'kaleidoRingFolds', 'document', `return function (draw) {${body}}`)(
        (ctx) => { ctx.drawImage(); }, () => ({ axis: 0 }), () => [6], {});
    run.call(self, l => layerTransforms.push(l.m.slice()));
    assert.deepEqual(layerTransforms[0], [2, 0, 0, 2, 0, 0], 'the scene is mirrored as drawn before the camera move');
    const t = stamps[0];
    assert(Math.abs(Math.atan2(t[1], t[0]) - 0.6) < 1e-9, 'the mandala turns with the scene');
    assert(Math.abs(Math.hypot(t[0], t[1]) - 2 * 1.4) < 1e-9, 'and zooms with it');
    // The mandala's centre (400, 225) follows the camera's drifted centre (410, 220), in device pixels.
    assert(Math.abs(t[0] * 400 + t[2] * 225 + t[4] - 2 * 410) < 1e-6 && Math.abs(t[1] * 400 + t[3] * 225 + t[5] - 2 * 220) < 1e-6, 'and drifts with it');
    assert.deepEqual(main.m, [1, 0, 0, 1, 0, 0], 'main canvas transform put back');
    // Turning the camera turns the mandala by the same amount, frame to frame.
    stamps.length = 0; self.camera = { ...self.camera, angle: 1.1 };
    run.call(self, () => {});
    assert(Math.abs(Math.atan2(stamps[0][1], stamps[0][0]) - 1.1) < 1e-9, 'keeps spinning');
}
console.log('Kaleidoscope keeps the scene spin, zoom and drift (mirrors before the camera move, then moves the mandala).');

console.log('Axes Rings: 1-5 concentric tiers, each sweeping its own way; one ring or axes at rest is the plain kaleidoscope.');
console.log('Spinning Mandala Axes: mirror lines sweep through the scene with fixed stamps and fixed zoom; mirrored tiles fill past the edges; eased in/out.');
console.log('Kaleidoscope: true mirrored slices on the centre for every aspect, segment count and spin; one clip per frame.');
