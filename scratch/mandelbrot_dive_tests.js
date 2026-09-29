"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const StateSchema = require("../js/state-schema.js");

function load() {
    const sandbox = { window: {}, module: { exports: {} }, Math, Float32Array, Uint8Array, Number, String, Buffer, console,
        performance: { now: () => global.performance.now() } };
    vm.runInNewContext(fs.readFileSync("js/mandelbrot-dive.js", "utf8"), sandbox);
    return sandbox.module.exports;
}
const settings = { speed: 0.5, baseSize: 2.4, density: 1600, stretch: 1, wobble: 0.14 };
const palette = ["#22d3ee", "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#34d399"];
const M = load();

// 1. Embedded reference orbits are genuine periodic nucleus orbits (z0 = 0, z_{n+1} = z_n² + c, z_p = 0).
for (const t of M.TARGETS) {
    assert.equal(t.data.length, t.period * 2, `${t.name}: orbit length`);
    assert.equal(t.data[0], 0); assert.equal(t.data[1], 0);
    const [cr, ci] = t.nucleus;
    for (let k = 0; k < t.period; k++) {
        const x = t.data[2 * k], y = t.data[2 * k + 1];
        const nx = k + 1 < t.period ? t.data[2 * k + 2] : 0, ny = k + 1 < t.period ? t.data[2 * k + 3] : 0;
        const err = Math.hypot(x * x - y * y + cr - nx, 2 * x * y + ci - ny);
        assert(err < 2e-6, `${t.name}: orbit step ${k} error ${err}`);
    }
    assert(t.depth > 18 && t.depth < 34, `${t.name}: dive depth ${t.depth.toFixed(1)} nats`);
    assert(t.period <= 260, `${t.name}: period small enough for phones`);
}

// 2. Each dive starts on the full-set overview (centre −0.5, scale 1.6, upright).
const t0 = M.TARGETS[0];
let v = M.viewAt(0);
assert(Math.abs(t0.nucleus[0] + v.offRe + 0.5) < 1e-12 && Math.abs(t0.nucleus[1] + v.offIm) < 1e-12, "overview centre");
assert.equal(v.nats, 0); assert.equal(v.scale, 1.6); assert.equal(v.fade, 1);

// 3. Each dive ends centred on its mini-Mandelbrot, scaled and rotated to match the full set.
let start = 0;
for (let i = 0; i < M.TARGETS.length; i++) {
    const t = M.TARGETS[i];
    const end = M.viewAt(start + M.diveLength(t) - 0.05, 0);
    assert.equal(end.index, i, `${t.name}: schedule order`);
    assert(Math.abs(end.nats - t.depth) < 1e-9, `${t.name}: reaches full depth`);
    assert(Math.abs(end.scale / (1.6 * t.size) - 1) < 1e-9, `${t.name}: mini fills the view like the overview`);
    assert(Math.abs(end.theta - t.angle) < 1e-9, `${t.name}: mini upright`);
    assert(Math.abs(end.offRe + 0.5 * t.miniRe) < 1e-25 && Math.abs(end.offIm + 0.5 * t.miniIm) < 1e-25, `${t.name}: mini centred`);
    const next = M.viewAt(start + M.diveLength(t) + 0.3);
    assert.equal(next.index, (i + 1) % M.TARGETS.length, "next dive follows");
    assert(next.fade > 0 && next.fade < 1, "cross-fade into next dive");
    start += M.diveLength(t);
}
assert.equal(M.viewAt(start + 0.01).index, 0, "loops forever");

// 4. The held mini-Mandelbrot really looks like the full set (double-precision CPU sampler).
for (let index = 0; index < M.TARGETS.length; index++) {
    const t = M.TARGETS[index];
    let s = 0;
    for (let i = 0; i < index; i++) s += M.diveLength(M.TARGETS[i]);
    const mini = M.viewAt(s + M.diveLength(t) - 0.05, 0);
    const overview = { ...M.viewAt(0), target: t, offRe: -0.5 - t.nucleus[0], offIm: -t.nucleus[1], theta: 0, scale: 1.6 };
    let agree = 0, total = 0;
    for (let y = -0.9; y <= 0.9; y += 0.12) for (let x = -1.6; x <= 1.6; x += 0.12) {
        const a = M.samplePixel(overview, x, y, 400) < 0;
        const b = M.samplePixel(mini, x, y, M.iterationBudget(mini)) < 0;
        agree += a === b ? 1 : 0; total++;
    }
    assert(agree / total > 0.93, `${t.name}: mini matches the full set (${(100 * agree / total).toFixed(0)}%)`);
}

// 5. Iteration budget grows with depth but stays bounded.
const shallow = M.iterationBudget(M.viewAt(0.5)), deep = M.iterationBudget(M.viewAt(M.diveLength(t0) - 0.1));
assert(deep > shallow * 3 && deep <= 6000 && shallow >= 64, `iterations ${shallow} → ${deep}`);

// 6. Speed 0 freezes the dive; tuning is clamped; seek works.
{
    const D = load();
    for (let f = 0; f < 60; f++) D.draw({}, 800, 600, f / 60, settings, palette);
    const clock = D.inspect().clock;
    assert(clock > 0.9 && clock < 1.1, `clock advances at speed 0.5: ${clock}`);
    for (let f = 60; f < 120; f++) D.draw({}, 800, 600, f / 60, { ...settings, speed: 0 }, palette);
    assert.equal(D.inspect().clock, clock, "speed 0 freezes");
    const tuned = D.setTuning({ zoomRate: 99, resolution: -1, detail: "x", glowWidth: 2 });
    assert.equal(tuned.zoomRate, 6); assert.equal(tuned.resolution, 0.15); assert.equal(tuned.glowWidth, 2);
    assert.equal(tuned.detail, D.DEFAULT_TUNING.detail, "junk ignored");
    D.seek(12.5); assert.equal(D.inspect().clock, 12.5);
    D.draw({}, 0, 0, 3, settings, palette); D.draw({}, 800, 600, NaN, {}, []);   // bad input never throws
}

// 7. Bass: a baseSize swell pulses the glow and decays; a lasting slider change is not a beat.
{
    const D = load();
    for (let f = 0; f < 30; f++) D.draw({}, 800, 600, f / 60, settings, palette);
    D.draw({}, 800, 600, 31 / 60, { ...settings, baseSize: 4.5 }, palette);
    assert(D.inspect().pulse > 0.5, "bass swell pulses");
    for (let f = 32; f < 150; f++) D.draw({}, 800, 600, f / 60, settings, palette);
    assert(D.inspect().pulse < 0.01, "pulse decays");
    for (let f = 150; f < 300; f++) D.draw({}, 800, 600, f / 60, { ...settings, baseSize: 5 }, palette);
    assert(D.inspect().pulse < 0.01, "held slider change is not a beat");
}

assert(StateSchema.VALID_PARTICLE_SHAPES.has("mandelbrotDive"), "saved/shared scenes accept the new shape");
console.log("Mandelbrot Dive: periodic reference orbits, overview start, centred upright mini end, seamless loop, mini ≈ full set, bounded iterations, speed-0 freeze, tuning clamps, bass pulse, schema pass.");
