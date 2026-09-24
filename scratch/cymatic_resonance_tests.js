"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const StateSchema = require("../js/state-schema.js");

function load() {
    const sandbox = { window: {}, module: { exports: {} }, Math, Float32Array, Map, Number, String };
    vm.runInNewContext(fs.readFileSync("js/cymatic-resonance.js", "utf8"), sandbox);
    return sandbox.module.exports;
}
function context() {
    const counts = { fills: 0, strokes: 0, rects: 0, segments: 0, widths: [], alphas: [] };
    const check = (...values) => assert(values.every(Number.isFinite), "sand geometry is finite");
    return {
        counts, save() {}, restore() {}, beginPath() {},
        moveTo(...v) { check(...v); counts.segments++; }, lineTo(...v) { check(...v); },
        rect(...v) { check(...v); counts.rects++; }, fill() { counts.fills++; }, stroke() { counts.strokes++; },
        set globalAlpha(v) { check(v); assert(v >= 0 && v <= 1, "alpha bounded"); counts.alphas.push(v); },
        set lineWidth(v) { check(v); assert(v > 0); counts.widths.push(v); },
        set strokeStyle(v) { assert.match(v, /^#/); }, set fillStyle(v) { assert.match(v, /^#/); },
        set lineCap(v) {}, set globalCompositeOperation(v) {}
    };
}
const settings = { density: 1600, baseSize: 2.2, speed: 0.5, rotationSpeed: 0.03, wobble: 0.14, stretch: 1, turbulence: 0.05, sizeVariation: 0.6 };
const palette = ["#fde68a", "#fbbf24", "#f472b6", "#c084fc", "#38bdf8", "#5eead4"];

// Mean distance (in field units) from a still line, measured through the module's own field.
function meanField(sand, width, height, stretch = 1) {
    const info = sand.inspect();
    const { from } = info.modeAt(info.clock);
    const out = { f: 0, dr: 0, dt: 0 };
    const half = Math.min(width, height) / 2;
    let total = 0;
    for (let i = 0; i < info.count; i++) {
        const dx = (info.x[i] - width / 2) / half, dy = (info.y[i] - height / 2) / half;
        sand.sampleMode(from, Math.hypot(dx, dy) * (1 + stretch * 0.35), Math.atan2(dy, dx), 1, out);
        total += Math.abs(out.f);
    }
    return total / info.count;
}
function run(sand, width, height, from, to, step, overrides = {}) {
    let ctx;
    for (let t = from; t <= to + 1e-9; t += step) {
        ctx = context();
        sand.draw(ctx, width, height, t, { ...settings, ...overrides }, palette);
    }
    return ctx;
}

// 1. Grains gather on the still lines of the plate (the preset's identity).
{
    const sand = load();
    run(sand, 1280, 720, 0, 0, 1);
    const scattered = meanField(sand, 1280, 720);
    // wobble 0 keeps the measured field identical to the one grains follow.
    run(sand, 1280, 720, 1 / 60, 3, 1 / 60, { wobble: 0 });
    const settled = meanField(sand, 1280, 720);
    assert(settled < scattered * 0.3, `sand settles onto nodal lines: ${scattered.toFixed(3)} -> ${settled.toFixed(3)}`);
    const ctx = run(sand, 1280, 720, 3 + 1 / 60, 3 + 1 / 60, 1);
    assert(ctx.counts.segments > 5000, "settled grains render as aligned streaks");
    assert(ctx.counts.strokes >= 2 && ctx.counts.strokes <= 24, "draw work is batched by colour, not per grain");
}

// 2. Density and screen size bound the grain count; phones get fewer grains.
{
    const counts = {};
    for (const [label, w, h, density] of [["low", 1920, 1080, 900], ["high", 1920, 1080, 2400], ["phone", 390, 844, 1600], ["huge", 3840, 2160, 99999]]) {
        const sand = load();
        run(sand, w, h, 0, 0, 1, { density });
        counts[label] = sand.inspect().count;
    }
    assert(counts.high > counts.low, "density adds sand");
    assert(counts.phone < counts.high, "phone-sized canvases get fewer grains");
    assert(counts.huge <= 18000, `grain count is capped: ${counts.huge}`);
}

// 3. Speed zero truly freezes; it must not fall back to a default speed.
{
    const sand = load();
    run(sand, 800, 600, 0, 1, 1 / 60);
    const clock = sand.inspect().clock;
    const before = Float32Array.from(sand.inspect().x.slice(0, 500));
    run(sand, 800, 600, 1 + 1 / 60, 2, 1 / 60, { speed: 0 });
    assert.equal(sand.inspect().clock, clock, "mode clock frozen at speed 0");
    const after = sand.inspect().x.slice(0, 500);
    let moved = 0;
    for (let i = 0; i < 500; i++) moved += Math.abs(after[i] - before[i]);
    assert(moved / 500 < 0.01, `grains frozen at speed 0 (mean drift ${moved / 500})`);
}

// 4. The plate changes resonant mode over time and every mode is reachable.
{
    const sand = load();
    const info = sand.inspect();
    const seen = new Set();
    for (let clock = 0; clock < 22 * info.modes; clock += 1) seen.add(info.modeAt(clock).from);
    assert.equal(seen.size, info.modes, "schedule visits every mode");
    const morph = info.modeAt(19);
    assert(morph.blend > 0 && morph.blend < 1 && morph.from !== morph.to, "modes cross-fade");
}

// 5. Bass: a baseSize swell (shared music pipeline) strikes the plate; sand leaps, then resettles.
{
    const sand = load();
    run(sand, 1280, 720, 0, 3, 1 / 60, { wobble: 0 });
    const calm = meanField(sand, 1280, 720);
    run(sand, 1280, 720, 3 + 1 / 60, 3 + 1 / 60, 1, { wobble: 0, baseSize: 2.2 * 2.2 });
    let speed = 0;
    const info = sand.inspect();
    for (let i = 0; i < info.count; i++) speed += Math.hypot(info.vx[i], info.vy[i]);
    assert(speed / info.count > 20, "strike launches the sand");
    run(sand, 1280, 720, 3 + 2 / 60, 3.3, 1 / 60, { wobble: 0 });
    const airborne = meanField(sand, 1280, 720);
    assert(airborne > calm * 1.5, "figure visibly disturbed after strike");
    run(sand, 1280, 720, 3.3 + 1 / 60, 6, 1 / 60, { wobble: 0 });
    assert(meanField(sand, 1280, 720) < airborne * 0.6, "sand resettles after the strike");
    // Hard hits are bounded: grain width capped at 1.6x resting size.
    const loud = run(sand, 1280, 720, 6 + 1 / 60, 6 + 1 / 60, 1, { baseSize: 2.2 * 3.5 });
    const quiet = run(sand, 1280, 720, 6 + 2 / 60, 6 + 2 / 60, 1);
    assert(Math.max(...loud.counts.widths) <= Math.max(...quiet.counts.widths) * 1.61 + 1e-6, "bass swell is capped");
}

// 6. Treble raises glints but alpha stays bounded (no whiteout).
{
    const sand = load();
    run(sand, 1280, 720, 0, 2, 1 / 60);
    const plain = run(sand, 1280, 720, 2 + 1 / 60, 2 + 1 / 60, 1);
    const bright = run(sand, 1280, 720, 2 + 2 / 60, 2 + 2 / 60, 1, { trebleIntensity: 5 });
    assert(bright.counts.rects > plain.counts.rects, "treble adds glints");
    assert(Math.max(...bright.counts.alphas) <= 0.9, "treble alpha bounded");
}

// 7. Re-entering after a long gap scatters the sand so the figure re-forms; resize keeps grains on screen.
{
    const sand = load();
    run(sand, 1280, 720, 0, 3, 1 / 60, { wobble: 0 });
    const settled = meanField(sand, 1280, 720);
    run(sand, 1280, 720, 60, 60, 1, { wobble: 0 });
    assert(meanField(sand, 1280, 720) > settled * 2, "stale figure is not resumed after a long gap");
    run(sand, 390, 844, 60 + 1 / 60, 60 + 1 / 60, 1);
    const info = sand.inspect();
    for (let i = 0; i < info.count; i++) {
        assert(info.x[i] > -0.1 * 390 && info.x[i] < 1.1 * 390 && info.y[i] > -0.1 * 844 && info.y[i] < 1.1 * 844, "grains stay near the canvas");
    }
    // Bad input never throws or draws NaN.
    sand.draw(context(), 0, 0, 1, settings, palette);
    sand.draw(context(), 800, 600, NaN, { density: "x", speed: undefined }, palette);
    sand.draw(context(), 800, 600, 1, settings, []);
}

// 8. A deliberate size-slider increase is honoured, not capped as if it were a beat.
{
    const sand = load();
    run(sand, 1280, 720, 0, 1, 1 / 60);
    const small = run(sand, 1280, 720, 1 + 1 / 60, 1 + 1 / 60, 1);
    const big = run(sand, 1280, 720, 1 + 2 / 60, 2.5, 1 / 60, { baseSize: 6 });
    assert(Math.max(...big.counts.widths) > Math.max(...small.counts.widths) * 2.4, "manual size change fully applies");
}

assert(StateSchema.VALID_PARTICLE_SHAPES.has("cymaticResonance"), "saved/shared scenes accept the new shape");
console.log("Cymatic Resonance: sand settles on nodal lines, density/phone bounds, speed-zero freeze, mode cycle, bass strike + resettle, bounded treble, re-entry and schema pass.");
