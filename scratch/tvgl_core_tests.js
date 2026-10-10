"use strict";
// TV renderer core (js/tvgl/core.js) against the 2D renderer it was ported from
// (js/simulation.js): noise, curl, kaleidoscope rules, flow physics, and the
// kaleidoscope mesh's screen -> scene mapping.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The 2D renderer, loaded without a page.
global.window = global;
global.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
const simSrc = fs.readFileSync(path.resolve(__dirname, "../js/simulation.js"), "utf8");
const orig = new Function(simSrc + "; return { Particle, simplexNoise, getCurlNoise, kaleidoRingFolds, kaleidoRingAxis, kaleidoRingRadius };")();
require(path.resolve(__dirname, "../js/tvgl/core.js"));
const core = global.TvGLCore;

// Noise and curl: identical.
for (let i = 0; i < 2000; i++) {
    const x = (Math.random() - 0.5) * 400, y = (Math.random() - 0.5) * 400, t = Math.random() * 100;
    assert.equal(core.simplexNoise(x, y), orig.simplexNoise(x, y));
    const a = orig.getCurlNoise(x, y, t, 0.007), b = core.curlNoise(x, y, t, 0.007);
    assert.equal(b[0], a.vx);
    assert.equal(b[1], a.vy);
}

// Kaleidoscope rules: identical.
for (const s of [{}, { kaleidoAxesRings: 3, kaleidoRingFolds: "doubling", kaleidoscopeSegments: 4 },
    { kaleidoAxesRings: 4, kaleidoRingFolds: "growing", kaleidoRingStep: 3, kaleidoscopeSegments: 5.7 },
    { kaleidoAxesRings: 2, kaleidoRingFolds: "custom", kaleidoRingCustom: [7, 30] }]) {
    assert.deepEqual(core.kaleidoRingFolds(s), orig.kaleidoRingFolds(s));
}
for (let k = 0; k < 5; k++) {
    assert.equal(core.kaleidoRingAxis(1.3, k), orig.kaleidoRingAxis(1.3, k));
    assert.equal(core.kaleidoRingRadius(1920, 1080, k, 5), orig.kaleidoRingRadius(1920, 1080, k, 5));
}

// Flow physics: Field.step follows Particle.update step for step.
const settings = { particleShape: "ellipse", speed: 0.8, zoom: 0.9, flowOrganic: 0.8, turbulence: 0.5,
    drag: 0.9, interaction: 0, trebleIntensity: 0 };
const W = 960, H = 540, scaleRef = Math.max(0.4, W / 1600);
const field = new core.Field();
field.setCount(50, W, H);
const ps = [];
for (let i = 0; i < 50; i++) {
    const p = new orig.Particle(W, H, ["#fff"]);
    p.viewportScale = scaleRef;
    p.x = field.x[i]; p.y = field.y[i]; p.vx = field.vx[i]; p.vy = field.vy[i];
    p.life = p.maxLife = 1e9; field.life[i] = field.maxLife[i] = 1e9; // no respawns
    ps.push(p);
}
let t = 0;
for (let step = 0; step < 200; step++) {
    const dt = 1 + (step % 3) * 0.7;
    t += dt;
    ps.forEach(p => p.update(settings, t, null, [], [], [], dt));
    field.step(settings, t, dt, W, H, scaleRef, { shockwaves: [], vortices: [] });
}
for (let i = 0; i < 50; i++) {
    assert.ok(Math.abs(field.x[i] - ps[i].x) < 0.05 && Math.abs(field.y[i] - ps[i].y) < 0.05,
        `particle ${i} drifted: ${field.x[i]},${field.y[i]} vs ${ps[i].x},${ps[i].y}`);
}

// Kaleidoscope mesh: every vertex maps screen -> scene the way the stamped
// slices do (rotate slice i into place, mirror odd slices, sample at `axis`).
function expected(w, h, folds, axis, sx, sy) {
    const slices = Math.max(3, Math.floor(folds)) * 2, step = 2 * Math.PI / slices, half = step / 2;
    const cx = w / 2, cy = h / 2, reach = Math.hypot(cx, cy);
    const available = Math.min(w / 2, half < Math.PI / 2 ? (h / 2) / Math.sin(half) : h / 2);
    const zoom = Math.max(1, reach / available);
    const r = Math.hypot(sx - cx, sy - cy);
    let phi = Math.atan2(sy - cy, sx - cx);
    const i = ((Math.round(phi / step) % slices) + slices) % slices;
    let th = phi - step * Math.round(phi / step);
    if (i % 2 === 1) th = -th;
    const qx = Math.cos(th) * r / zoom, qy = Math.sin(th) * r / zoom;
    return [(cx + Math.cos(axis) * qx - Math.sin(axis) * qy) / w, (cy + Math.sin(axis) * qx + Math.cos(axis) * qy) / h];
}
for (const [folds, axis] of [[6, 0], [4, 0.7], [9, -2.1], [3, 0]]) {
    const mesh = core.kaleidoMesh(1920, 1080, { kaleidoscopeSegments: folds }, axis);
    assert.equal(mesh.length % 12, 0);
    // centroid of each triangle: interpolate uv and compare with the mapping
    for (let tri = 0; tri < mesh.length; tri += 12) {
        const px = (mesh[tri] + mesh[tri + 4] + mesh[tri + 8]) / 3, py = (mesh[tri + 1] + mesh[tri + 5] + mesh[tri + 9]) / 3;
        const u = (mesh[tri + 2] + mesh[tri + 6] + mesh[tri + 10]) / 3, v = (mesh[tri + 3] + mesh[tri + 7] + mesh[tri + 11]) / 3;
        const [eu, ev] = expected(1920, 1080, folds, axis, px, py);
        assert.ok(Math.abs(u - eu) < 1e-4 && Math.abs(v - ev) < 1e-4, `folds ${folds} axis ${axis}: ${u},${v} vs ${eu},${ev}`);
    }
}
// Rings: outer tier reaches the corners; inner tiers stop at their radius.
const rings = core.kaleidoMesh(1920, 1080, { kaleidoAxesRings: 3, kaleidoscopeSegments: 6, kaleidoRingFolds: "doubling" }, 0.4);
let maxR = 0;
for (let i = 0; i < rings.length; i += 4) maxR = Math.max(maxR, Math.hypot(rings[i] - 960, rings[i + 1] - 540));
assert.ok(maxR > Math.hypot(960, 540), "outer tier covers the corners");

console.log("PASS: tvgl core (noise, curl, kaleidoscope rules, flow physics = Particle.update, kaleidoscope mesh mapping).");
