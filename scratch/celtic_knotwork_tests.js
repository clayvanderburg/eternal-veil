"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const StateSchema = require("../js/state-schema.js");

const sandbox = { window: {}, module: { exports: {} }, Math };
vm.runInNewContext(fs.readFileSync("js/celtic-knotwork.js", "utf8"), sandbox);
const knot = sandbox.module.exports;
function context() {
    const counts = { paths: 0, strokes: 0, travelers: 0, rotations: 0, widths: [] };
    const check = (...values) => assert(values.every(Number.isFinite), "knot geometry is finite");
    return {
        counts, save() {}, restore() {}, beginPath() { counts.paths++; }, closePath() {},
        moveTo(...values) { check(...values); }, lineTo(...values) { check(...values); },
        ellipse(...values) { check(...values); }, fill() { counts.travelers++; },
        stroke() { counts.strokes++; }, translate(...values) { check(...values); },
        scale(...values) { check(...values); }, rotate(...values) { check(...values); counts.rotations++; },
        set globalAlpha(value) { check(value); assert(value >= 0 && value <= 1); },
        set lineWidth(value) { check(value); assert(value > 0); counts.widths.push(value); },
        set strokeStyle(value) { assert.match(value, /^#/); },
        set fillStyle(value) { assert.match(value, /^#/); },
        set lineCap(value) {}, set lineJoin(value) {}
    };
}
const settings = { density: 1650, baseSize: 4.2, speed: .52, rotationSpeed: .075, wobble: .13, stretch: 1 };
const palette = ["#06b6d4", "#67e8f9", "#14b8a6", "#a7f3d0", "#8b5cf6", "#c4b5fd"];
for (const [width, height] of [[1920, 1080], [390, 844]]) {
    for (const seconds of [0, 12, 360]) {
        const ctx = context();
        knot.draw(ctx, width, height, seconds, settings, palette, 1.75);
        assert(ctx.counts.paths > 35, "visible woven paths");
        assert(ctx.counts.strokes >= 30, "three woven guides per ring and center");
        assert(ctx.counts.travelers > 100, "dense independently moving paint currents");
    }
}
const quiet = context();
knot.draw(quiet, 390, 844, 12, { ...settings, density: 1250 }, palette);
const dense = context();
knot.draw(dense, 390, 844, 12, { ...settings, density: 2050 }, palette);
assert(dense.counts.strokes > quiet.counts.strokes, "density adds a ring but retains outer border");
const baseline = context();
const bassPulse = context();
knot.draw(baseline, 390, 844, 12, settings, palette);
knot.draw(bassPulse, 390, 844, 12, { ...settings, baseSize: 8.4 }, palette);
assert(Math.max(...bassPulse.counts.widths) > Math.max(...baseline.counts.widths) * 1.5,
    "shared bass-size modulation visibly widens Knotwork marks");
const treblePulse = context();
knot.draw(treblePulse, 390, 844, 12,
    { ...settings, speed: 1.8, wobble: 1.4, stretch: 8, rotationSpeed: 0.6 }, palette);
assert(treblePulse.counts.paths > 35 && treblePulse.counts.travelers > 100,
    "bounded high-energy treble settings retain the woven composition");
// Large screens should receive more source pixels when Veil Drift zooms in.
let layer;
sandbox.document = {
    createElement(type) {
        assert.equal(type, "canvas");
        layer = { width: 0, height: 0, getContext: () => ({ ...context(), clearRect() {} }) };
        return layer;
    }
};
const screen = { ...context(), drawImage() {} };
knot.draw(screen, 1920, 1080, 1, settings, palette, 1);
const basePixels = layer.width * layer.height;
knot.draw(screen, 1920, 1080, 2, settings, palette, 2.6);
knot.draw(screen, 1920, 1080, 2.1, settings, palette, 2.6);
assert(layer.width * layer.height > basePixels * 2,
    `high zoom gets a sharper paint layer: ${basePixels} -> ${layer.width * layer.height}`);
assert(StateSchema.VALID_PARTICLE_SHAPES.has("celticKnotwork"), "saved/shared scenes accept the new shape");
console.log("Celtic Knotwork: finite geometry, opposed currents, density, zoom-detail scaling, and schema pass.");
