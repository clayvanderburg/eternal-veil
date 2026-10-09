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
const { drawWedgeKaleidoscope, kaleidoscopeAxis, kaleidoMirrorTiles } = new Function('document', 'performance',
    source.slice(start, end) + '\nreturn { drawWedgeKaleidoscope, kaleidoscopeAxis, kaleidoMirrorTiles };')(document, performance);
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

console.log('Spinning Mandala Axes: mirror lines sweep through the scene with fixed stamps and fixed zoom; mirrored tiles fill past the edges; eased in/out.');
console.log('Kaleidoscope: true mirrored slices on the centre for every aspect, segment count and spin; one clip per frame.');
