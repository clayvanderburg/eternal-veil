// Kaleidoscope geometry (drawWedgeKaleidoscope in js/simulation.js): every scene mirrors one
// slice around the centre. Checks, across aspect ratios, segment counts (odd too) and spin:
// 2N slices, each stamped with its apex on the scene centre, alternating mirror images, radii
// preserved, the source clipped and drawn only once per frame, and the outer transform restored.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/simulation.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('let kaleidoSlice = null;');
const end = source.indexOf('if (typeof window !== "undefined") window.drawWedgeKaleidoscope');
assert(start > 0 && end > start, 'drawWedgeKaleidoscope found');
assert(!/kaleidoCanvas|LAYER_KALEIDOSCOPE_SHAPES|WEDGE_KALEIDOSCOPE_SHAPES/.test(source), 'the old stacked-copies pass is gone');

let sourceDraws = 0, clips = 0;
const sliceCtx = { setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, arc() {}, closePath() {},
    clip() { clips++; }, scale() {}, translate() {}, drawImage() { sourceDraws++; } };
const document = { createElement: () => ({ width: 0, height: 0, getContext: () => sliceCtx }) };
const drawWedgeKaleidoscope = new Function('document', source.slice(start, end) + '\nreturn drawWedgeKaleidoscope;')(document);

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
            drawWedgeKaleidoscope(ctx, {}, width, height, segments, spin);
            assert.equal(dets.length, segments * 2, `${segments} segments = ${segments * 2} slices`);
            dets.forEach((d, i) => assert.equal(d, i % 2 ? -1 : 1, 'slices alternate with their mirror image'));
            assert.equal(sourceDraws, 1, 'the scene is clipped and drawn once per frame, not per slice');
            assert.equal(clips, 1);
            assert.deepEqual(m, initial, 'outer transform restored');
        }
    }
}
console.log('Kaleidoscope: true mirrored slices on the centre for every aspect, segment count and spin; one clip per frame.');
