"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const StateSchema = require("../js/state-schema.js");

function load() {
    const sandbox = { window: {}, module: { exports: {} }, Math, Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Number, String, Map, Set, console,
        performance: { now: () => global.performance.now() } };
    vm.runInNewContext(fs.readFileSync("js/stellar-nursery.js", "utf8"), sandbox);
    return sandbox.module.exports;
}
// A canvas stand-in that accepts any 2D call and records the interesting ones.
function makeCtx() {
    const calls = { scale: [], drawImage: 0, alphaSum: 0, fillRect: 0, maxAlpha: 0, finite: true };
    let alpha = 1;
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, {
        get(_, name) {
            if (name === "createLinearGradient" || name === "createRadialGradient") return () => gradient;
            if (name === "scale") return (x, y) => calls.scale.push([x, y]);
            if (name === "drawImage") return (img, x, y, w, h) => {
                calls.drawImage++; calls.alphaSum += alpha * (w || 0) * (h || 0); calls.maxAlpha = Math.max(calls.maxAlpha, alpha);
                if (![x, y, w, h].every(Number.isFinite)) calls.finite = false;
            };
            if (name === "fillRect") return () => { calls.fillRect++; };
            if (name === "globalAlpha") return alpha;
            return () => {};
        },
        set(_, name, value) { if (name === "globalAlpha") { alpha = value; if (!Number.isFinite(value) || value < 0 || value > 1.0001) calls.finite = false; } return true; }
    });
    return { ctx, calls };
}
const settings = { speed: 0.5, baseSize: 2.4, density: 1600, stretch: 1.2, wobble: 0.14, rotationSpeed: 0.02, trebleIntensity: 0, dissipation: 0.3 };
const palette = ["#c026d3", "#9333ea", "#6d28d9", "#3b82f6", "#f0abfc", "#fb7185"];
const N = load();

// 1. Defaults are finite and setTuning clamps every value into a sane range.
for (const [key, value] of Object.entries(N.DEFAULT_TUNING)) assert(Number.isFinite(value), `${key} default is finite`);
{
    const M = load();
    M.setTuning({ gasLevel: 99, dustLevel: -5, filaments: 0, cloudScale: 99, lifeSeconds: 1, fadeSeconds: 999, quality: 5, colorFlow: 9, starDensity: NaN, bogus: 3 });
    assert.equal(M.tuning.gasLevel, 3); assert.equal(M.tuning.dustLevel, 0); assert.equal(M.tuning.filaments, 0.2);
    assert.equal(M.tuning.cloudScale, 2.5); assert.equal(M.tuning.lifeSeconds, 15); assert.equal(M.tuning.fadeSeconds, 40);
    assert.equal(M.tuning.quality, 1); assert.equal(M.tuning.colorFlow, 0.6);
    assert.equal(M.tuning.starDensity, M.DEFAULT_TUNING.starDensity, "NaN is ignored");
    assert.equal(M.tuning.bogus, undefined, "unknown keys are ignored");
}

// 2. The nebula runs for a long time: bounded population, filaments are born and fade, drawing stays finite.
{
    const M = load();
    const { ctx, calls } = makeCtx();
    const seen = new Set();
    let maxFilaments = 0, maxStars = 0;
    for (let frame = 0; frame < 60 * 400; frame++) {
        M.draw(ctx, 1280, 720, frame / 60, settings, palette, 1);
        if (frame % 30 === 0) {
            const info = M.inspect();
            info.live.forEach(f => seen.add(f.id));
            maxFilaments = Math.max(maxFilaments, info.filaments); maxStars = Math.max(maxStars, info.stars);
            for (const f of info.live) assert(Number.isFinite(f.x) && Number.isFinite(f.y) && f.age >= 0 && f.age <= f.life + 0.5, "finite, alive filament");
        }
    }
    assert(seen.size > 20, `filaments are born over time (${seen.size})`);
    assert(maxFilaments >= 6 && maxFilaments <= 26, `bounded filament count (${maxFilaments})`);
    assert(maxStars > 60 && maxStars <= 640, `bounded star count (${maxStars})`);
    assert(calls.drawImage > 20000 && calls.finite, "draws many finite sprites with alpha in range");
}

// 3. Entering mid-life: the screen is full on the first frame; a time jump rebuilds it without a huge step.
{
    const M = load();
    const { ctx, calls } = makeCtx();
    M.draw(ctx, 1280, 720, 100, settings, palette, 1);
    const first = M.inspect();
    assert(first.filaments >= 6, "full on the first frame");
    assert(first.live.some(f => f.age > 5), "some filaments already mid-life");
    assert(first.drawn.puffs > 40, "visible gas straight away");
    M.draw(ctx, 1280, 720, 5000, settings, palette, 1);
    assert(M.inspect().filaments >= 6 && calls.finite, "time jump rebuilds cleanly");
}

// 4. Palettes: hex, short hex, rgb(), hsl() (Flow), a single colour, and garbage all render.
{
    for (const pal of [palette, ["#f0a"], ["hsl(190, 85%, 58%)", "hsl(290, 80%, 64%)", "hsl(40, 90%, 60%)"], ["rgb(10,200,30)", "rgba(250,10,10,0.5)"], ["nonsense"], ["#ffffff"], ["#000000"]]) {
        const M = load();
        const { ctx, calls } = makeCtx();
        for (let f = 0; f < 120; f++) M.draw(ctx, 800, 600, f / 60, settings, pal, 1);
        assert(calls.drawImage > 0 && calls.finite, `renders with palette ${JSON.stringify(pal)}`);
    }
    assert.deepEqual(Array.from(N.parseColor("hsl(0, 100%, 50%)")), [255, 0, 0]);
    assert.deepEqual(Array.from(N.parseColor("#0f0")), [0, 255, 0]);
    assert.equal(N.parseColor("not a colour"), null);
    // Draw bails out quietly on unusable input.
    const M = load();
    const { ctx } = makeCtx();
    M.draw(ctx, 800, 600, 0, settings, [], 1);
    M.draw(ctx, NaN, 600, 0, settings, palette, 1);
    M.draw(ctx, 800, 600, NaN, { speed: NaN, baseSize: NaN, density: NaN, stretch: NaN, wobble: NaN, rotationSpeed: NaN, dissipation: NaN }, palette, NaN);
}

// 5. Veil Drift zoom: the scene is drawn shrunk and spread over the visible area.
{
    const M = load();
    const { ctx, calls } = makeCtx();
    M.draw(ctx, 1280, 720, 0, settings, palette, 1);
    const flat = M.inspect();
    assert.equal(calls.scale.length, 0, "no compensation at scale 1");
    M.reset();
    M.draw(ctx, 1280, 720, 0, settings, palette, 1.8);
    assert(calls.scale.length === 1 && calls.scale[0][0] < 1 && calls.scale[0][0] > 0.5, "shrunk when the camera zooms in");
    assert(M.inspect().extentX > 0 && Number.isFinite(M.inspect().extentX) && flat.extentX > 0);
}

// 6. Music: a bass attack (the shared baseSize swell) launches a bounded shockwave; treble lifts the star flare; silence calms everything.
{
    const M = load();
    const { ctx } = makeCtx();
    let t = 0;
    const step = s => { M.draw(ctx, 1280, 720, t, s, palette, 1); t += 1 / 60; };
    for (let i = 0; i < 90; i++) step(settings);
    assert.equal(M.inspect().waves, 0, "silent: no shockwaves");
    for (let i = 0; i < 12; i++) step({ ...settings, baseSize: 4.6 });
    assert(M.inspect().pulse > 0.3, "bass attack registers");
    assert(M.inspect().waves >= 1, "bass attack launches a shockwave");
    for (let beat = 0; beat < 40; beat++) {
        for (let i = 0; i < 10; i++) step({ ...settings, baseSize: 4.6 });
        for (let i = 0; i < 20; i++) step(settings);
        assert(M.inspect().waves <= 3, "shockwaves stay bounded");
    }
    for (let i = 0; i < 60 * 6; i++) step(settings);
    assert(M.inspect().pulse < 0.05 && M.inspect().waves === 0, "calm again after the music stops");
    step({ ...settings, trebleIntensity: 1 });
    assert(M.inspect().treble >= 0.99, "treble is read");
    step({ ...settings, trebleIntensity: 0 });
    assert.equal(M.inspect().treble, 0, "treble returns to zero");
    // Bass response can be switched off.
    const Q = load(); Q.setTuning({ bassWave: 0 });
    let u = 0;
    for (let i = 0; i < 90; i++) { Q.draw(ctx, 1280, 720, u, settings, palette, 1); u += 1 / 60; }
    for (let i = 0; i < 12; i++) { Q.draw(ctx, 1280, 720, u, { ...settings, baseSize: 4.6 }, palette, 1); u += 1 / 60; }
    assert.equal(Q.inspect().waves, 0, "bassWave 0 launches none");
}

// 7. Brightness is held steady across the app's trail-fade (dissipation) setting.
{
    const total = d => {
        const M = load(); const { ctx, calls } = makeCtx();
        for (let f = 0; f < 3; f++) M.draw(ctx, 1280, 720, f / 60, { ...settings, dissipation: d }, palette, 1);
        return calls.alphaSum;
    };
    const normal = total(0.3), slow = total(0.03), fast = total(0.6);
    assert(slow < normal * 0.5, "slower fade → each frame drawn dimmer");
    assert(fast >= normal * 0.95, "faster fade is not dimmed");
}

// 8. Controls reach existing content: gas, dust, stars and cores scale with their sliders; quality sheds detail.
{
    const count = (tune, key) => {
        const M = load(); M.setTuning(tune); const { ctx } = makeCtx();
        for (let f = 0; f < 5; f++) M.draw(ctx, 1280, 720, f / 60, settings, palette, 1);
        return M.inspect()[key] !== undefined ? M.inspect()[key] : M.inspect().drawn[key];
    };
    const drawnOf = (tune, key) => { const M = load(); M.setTuning(tune); const { ctx } = makeCtx(); for (let f = 0; f < 5; f++) M.draw(ctx, 1280, 720, f / 60, settings, palette, 1); return M.inspect().drawn[key]; };
    assert(drawnOf({ dustLevel: 0 }, "dust") === 0, "dust 0 draws no dust");
    assert(drawnOf({ coreLevel: 0 }, "cores") === 0, "core level 0 draws no cores");
    assert(drawnOf({ cores: 0 }, "cores") === 0, "no newborn stars at 0");
    assert(drawnOf({ starDensity: 0 }, "stars") === 0, "no stars at 0");
    assert(drawnOf({ starDensity: 3 }, "stars") > drawnOf({ starDensity: 1 }, "stars") * 1.5, "more stars on request");
    assert(count({ filaments: 3 }, "filaments") > count({ filaments: 0.3 }, "filaments") * 2, "filament count follows its slider");
    assert(drawnOf({ detail: 0 }, "puffs") < drawnOf({ detail: 1 }, "puffs"), "fine ridges can be removed");
    assert(drawnOf({ quality: 0.4 }, "puffs") < drawnOf({ quality: 1 }, "puffs"), "quality sheds detail");
    assert(count({}, "filaments") > 0);
    // The app's density setting scales the population.
    const M = load(); M.setTuning({ filaments: 1 }); const { ctx } = makeCtx();
    M.draw(ctx, 1280, 720, 0, { ...settings, density: 300 }, palette, 1); const low = M.inspect().filaments;
    const H = load(); H.setTuning({ filaments: 1 }); H.draw(ctx, 1280, 720, 0, { ...settings, density: 3000 }, palette, 1); const high = H.inspect().filaments;
    assert(high > low * 1.5, `density scales filaments (${low} -> ${high})`);
}

// 9. Speed 0 freezes motion (no drift, no aging) and zero stays zero.
{
    const M = load(); const { ctx } = makeCtx();
    M.draw(ctx, 1280, 720, 0, { ...settings, speed: 0 }, palette, 1);
    const a = M.inspect().live.map(f => [f.x, f.y, f.age]);
    for (let f = 1; f <= 120; f++) M.draw(ctx, 1280, 720, f / 60, { ...settings, speed: 0 }, palette, 1);
    assert.deepEqual(M.inspect().live.map(f => [f.x, f.y, f.age]), a, "speed 0 freezes the nebula");
}

// 10. The app's kaleidoscope: segment count is read; the particle mirror pass is skipped for this preset.
{
    assert.equal(N.kaleidoSegments({ kaleidoscopeEnabled: false, kaleidoscopeSegments: 8 }), 0);
    assert.equal(N.kaleidoSegments({ kaleidoscopeEnabled: true, kaleidoscopeSegments: 8 }), 8);
    assert.equal(N.kaleidoSegments({ kaleidoscopeEnabled: true, kaleidoscopeSegments: 2 }), 3, "clamped up to 3");
    assert.equal(N.kaleidoSegments({ kaleidoscopeEnabled: true, kaleidoscopeSegments: 99 }), 16, "clamped down to 16");
    assert.equal(N.kaleidoSegments(null), 0);
}

// 11. Integration: preset, schema, share links, simulation, page, Flow and Random Config.
{
    const presetsSource = fs.readFileSync("js/presets.js", "utf8");
    const presets = vm.runInNewContext(presetsSource + "\n;StylePresets", { window: {} });
    const p = presets.stellarNursery;
    assert(p && p.name === "Stellar Nursery" && p.particleShape === "stellarNursery", "preset entry");
    assert(StateSchema.VALID_PARTICLE_SHAPES.has("stellarNursery"), "schema allows the shape");
    assert.equal(p.colors.length, 6);
    for (const key of ["speed", "density", "dissipation", "size", "stretch", "rotationSpeed", "wobble"]) assert(Number.isFinite(p[key]), `${key} finite`);
    const urlSync = fs.readFileSync("js/url-sync.js", "utf8");
    assert(urlSync.includes('"mandelbrotDive", "molecularDance", "stellarNursery"]'), "share-link wire table is append-only: new shape last");
    const sim = fs.readFileSync("js/simulation.js", "utf8");
    assert(sim.includes('particleShape === "stellarNursery" && window.StellarNursery'), "simulation draws it");
    assert(sim.includes('particleShape !== "stellarNursery"'), "particle mirror pass skipped");
    const index = fs.readFileSync("index.html", "utf8");
    assert(index.includes('value="stellarNursery"') && index.includes("js/stellar-nursery.js"), "page lists and loads it");
    assert(index.indexOf("js/stellar-nursery.js") < index.indexOf("js/simulation.js"), "module loads before the simulation");
    const app = fs.readFileSync("js/app.js", "utf8");
    assert(/nextShape === "stellarNursery"/.test(app) && /nextPatternShape === "stellarNursery"/.test(app), "Random Config and authored Flow branches");
    assert((app.match(/"stellarNursery"/g) || []).length >= 7, "registered in the Flow pool and protected lists");
    const gate = fs.readFileSync("tools/work-gate.js", "utf8");
    assert(gate.includes("stellar_nursery_tests.js"), "work gate runs this test");
}

console.log("Stellar Nursery: textures, lifecycle, palettes, zoom compensation, music response, exposure, controls and integration pass.");
