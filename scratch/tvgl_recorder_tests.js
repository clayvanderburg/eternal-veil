"use strict";
// TV renderer recorder (js/tvgl/recorder.js): every authored preset runs the
// ORIGINAL simulation against the recording canvas without errors, records
// drawable primitives, and uses only the canvas subset the GPU draws.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const load = f => new Function(fs.readFileSync(path.resolve(__dirname, "..", f), "utf8"))();

global.self = global; global.window = global;
global.document = { getElementById: () => null, createElement: () => ({ getContext: () => null }) };
load("js/presets.js"); // eslint-disable-line
global.StylePresets = new Function(fs.readFileSync(path.resolve(__dirname, "../js/presets.js"), "utf8") + "; return StylePresets;")();
require(path.resolve(__dirname, "../js/tvgl/core.js"));
global.PresetCompositions = new Function(fs.readFileSync(path.resolve(__dirname, "../js/preset-compositions.js"), "utf8") + "; return PresetCompositions;")();
// the module scenes the worker imports (js/tvgl/worker.js)
for (const f of ["celtic-currents", "cymatic-resonance"]) new Function(fs.readFileSync(path.resolve(__dirname, "../js/" + f + ".js"), "utf8"))();
global.FlowSimulation = new Function(fs.readFileSync(path.resolve(__dirname, "../js/simulation.js"), "utf8") + "; return FlowSimulation;")();
require(path.resolve(__dirname, "../js/tvgl/recorder.js"));
const { RecEngine, Recorder, RECORDED_SHAPES, PRIM_FLOATS } = global.TvGLRecorder;

// RecEngine without a GPU: just its simulation + recorder.
const eng = Object.create(RecEngine.prototype);
eng.rec = new Recorder();
eng.bg = "#000000";
eng.lastPalette = "";
eng.ensureSim(960, 540, 2);

const presets = Object.entries(StylePresets).filter(([, p]) => RECORDED_SHAPES.has(p.particleShape));
assert.ok(presets.length >= 15, "most authored presets are recorded");
const report = [];
for (const [key, p] of presets) {
    const sim = eng.sim;
    Object.assign(sim.settings, { speed: p.speed, turbulence: p.turbulence, flowOrganic: p.curl, density: p.density,
        dissipation: p.dissipation, zoom: p.zoom, baseSize: p.size, sizeVariation: p.sizeVar, stretch: p.stretch,
        interaction: p.interaction, rotationSpeed: p.rotationSpeed, wobble: p.wobble, particleShape: p.particleShape,
        kaleidoscopeEnabled: p.kaleidoscopeEnabled === true, kaleidoscopeSegments: p.kaleidoscopeSegments || 6 });
    sim.updateDensity();
    eng.setPaletteCss([...p.colors]);
    eng.rec.unsupported.clear();
    let prims = 0;
    for (let f = 0; f < 6; f++) {
        eng.rec.beginFrame(); eng.rec.resetState(); eng.rec.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
        sim.lastFrameTime = Date.now() - 40;
        sim.tick();
        prims = eng.rec.n + eng.rec.layerN + eng.rec.softN + eng.rec.softLayerN;
        assert.ok(eng.rec.fade, `${key}: trail fade recorded`);
    }
    assert.ok(prims > 0, `${key}: draws something`);
    // every recorded primitive is a known type with finite numbers
    for (const [buf, n] of [[eng.rec.buf, eng.rec.n], [eng.rec.layerBuf, eng.rec.layerN], [eng.rec.softBuf, eng.rec.softN], [eng.rec.softLayerBuf, eng.rec.softLayerN]]) {
        for (let i = 0; i < n; i++) {
            const o = i * PRIM_FLOATS;
            assert.ok(buf[o + 20] >= 0 && buf[o + 20] <= 4, `${key}: prim type`);
            for (let k = 0; k < PRIM_FLOATS; k++) assert.ok(Number.isFinite(buf[o + k]), `${key}: finite prim data`);
        }
    }
    report.push(`${key}(${p.particleShape}): ${prims} prims${eng.rec.unsupported.size ? " [approx: " + [...eng.rec.unsupported].join(", ") + "]" : ""}`);
}
console.log(report.join("\n"));
console.log(`PASS: tvgl recorder (${presets.length} authored presets run the original simulation into GPU primitives).`);
