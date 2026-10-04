"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const StateSchema = require("../js/state-schema.js");

function load() {
    const sandbox = { window: {}, module: { exports: {} }, Math, Float32Array, Float64Array, Uint8Array, Number, String, Map, Set, console,
        performance: { now: () => global.performance.now() } };
    vm.runInNewContext(fs.readFileSync("js/molecular-dance.js", "utf8"), sandbox);
    return sandbox.module.exports;
}
// A canvas stand-in that accepts any 2D call and records the interesting ones.
function makeCtx() {
    const calls = { scale: [], drawImage: 0, stroke: 0, arc: 0 };
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, {
        get(_, name) {
            if (name === "createLinearGradient" || name === "createRadialGradient") return () => gradient;
            if (name === "scale") return (x, y) => calls.scale.push([x, y]);
            if (name === "drawImage") return () => { calls.drawImage++; };
            if (name === "stroke") return () => { calls.stroke++; };
            if (name === "arc") return () => { calls.arc++; };
            return () => {};
        },
        set() { return true; }
    });
    return { ctx, calls };
}
const settings = { speed: 0.4, baseSize: 2.4, density: 1600, stretch: 1, wobble: 0.14, trebleIntensity: 0, dissipation: 0.3 };
const palette = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];
const D = load();

// 1. Every molecule template is geometrically sound and normalised.
assert(D.TEMPLATES.length >= 12, "a varied family of molecules and atoms");
for (const tpl of D.TEMPLATES) {
    assert(tpl.atoms.length >= 3, `${tpl.key}: has atoms`);
    for (const a of tpl.atoms) {
        assert(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z) && a.rad > 0, `${tpl.key}: finite atom`);
        assert(Math.hypot(a.x, a.y, a.z) + a.rad <= 1.0001 || tpl.shells, `${tpl.key}: fits the unit sphere`);
    }
    for (const [i, j, order] of tpl.bonds) {
        assert(i >= 0 && j >= 0 && i < tpl.atoms.length && j < tpl.atoms.length && i !== j, `${tpl.key}: bond indices`);
        assert([1, 2, 3].includes(order), `${tpl.key}: bond order`);
    }
    assert(tpl.size > 0.2 && tpl.size < 1, `${tpl.key}: sensible world size`);
    if (tpl.atom) assert(tpl.shells && tpl.shells.length >= 1 && tpl.bonds.length === 0, `${tpl.key}: Bohr atom has shells`);
}
const byKey = Object.fromEntries(D.TEMPLATES.map(t => [t.key, t]));
assert.equal(byKey.buckyball.atoms.length, 60); assert.equal(byKey.buckyball.bonds.length, 90, "C60 has 90 bonds");
assert.equal(byKey.water.atoms.length, 3); assert.equal(byKey.methane.bonds.length, 4);
assert.equal(byKey.benzene.rings.length, 1); assert.equal(byKey.flake.atoms.length, 36);
assert.equal(byKey.salt.atoms.length, 27); assert.equal(byKey.salt.bonds.length, 54);
assert(byKey.carbonDioxide.bonds.every(b => b[2] === 2) && byKey.acetylene.bonds.some(b => b[2] === 3), "double and triple bonds");

// 2. The scene runs for a long time: population stays bounded, molecules are born and die constantly.
{
    const M = load();
    const { ctx } = makeCtx();
    const seen = new Set();
    let min = 99, max = 0;
    for (let f = 0; f < 60 * 90; f++) {
        M.draw(ctx, 1280, 720, f / 60, settings, palette, 1);
        const info = M.inspect();
        if (f > 120) { min = Math.min(min, info.clusters); max = Math.max(max, info.clusters); }
        for (const c of info.live) seen.add(c.key);
        assert(info.clusters <= 26, "bounded molecule count");
    }
    assert(min >= 6 && max <= 26, `screen stays full: ${min}–${max} molecules`);
    assert(seen.size >= 9, `variety of molecules appears: ${seen.size}`);
    const info = M.inspect();
    assert(info.drawn.atoms > 20 && info.drawn.electrons > 5, "atoms and electrons drawn");
    for (const c of info.live) assert(c.age >= 0 && c.age < c.life, "live molecules are within their life");
}

// 3. Speed 0 freezes everything; the speed slider scales life and motion.
{
    const M = load();
    const { ctx } = makeCtx();
    for (let f = 0; f < 120; f++) M.draw(ctx, 800, 600, f / 60, settings, palette, 1);
    const before = JSON.stringify(M.inspect().live);
    const clock = M.inspect().clock;
    for (let f = 120; f < 240; f++) M.draw(ctx, 800, 600, f / 60, { ...settings, speed: 0 }, palette, 1);
    assert.equal(M.inspect().clock, clock, "speed 0 freezes the clock");
    assert.equal(JSON.stringify(M.inspect().live), before, "speed 0 freezes molecules (no accidental motion)");
}

// 4. Tuning is clamped, junk is ignored, defaults come back.
{
    const M = load();
    const tuned = M.setTuning({ count: 99, moleculeSize: -4, lifeSeconds: "x", atomShare: 5, quality: 0, depth: 7 });
    assert.equal(tuned.count, 3); assert.equal(tuned.moleculeSize, 0.3); assert.equal(tuned.lifeSeconds, M.DEFAULT_TUNING.lifeSeconds);
    assert.equal(tuned.atomShare, 1); assert.equal(tuned.quality, 0.4); assert.equal(tuned.depth, 2);
    const reset = M.setTuning(M.DEFAULT_TUNING);
    assert.deepEqual({ ...reset }, { ...M.DEFAULT_TUNING });
}

// 5. Count follows the app density setting and the count tuning, and Bohr atoms follow atomShare.
{
    const few = load(), many = load();
    const a = makeCtx().ctx, b = makeCtx().ctx;
    few.draw(a, 1280, 720, 0, { ...settings, density: 400 }, palette, 1);
    many.draw(b, 1280, 720, 0, { ...settings, density: 2800 }, palette, 1);
    assert(many.inspect().clusters > few.inspect().clusters + 3, "density adds molecules");
    const atoms = load(); atoms.setTuning({ atomShare: 1 });
    atoms.draw(a, 1280, 720, 0, settings, palette, 1);
    for (let f = 1; f < 600; f++) atoms.draw(a, 1280, 720, f / 60, settings, palette, 1);
    assert(atoms.inspect().live.every(c => byKey[c.key].atom), "atomShare 1 gives only Bohr atoms");
    const molecules = load(); molecules.setTuning({ atomShare: 0 });
    for (let f = 0; f < 600; f++) molecules.draw(a, 1280, 720, f / 60, settings, palette, 1);
    assert(molecules.inspect().live.every(c => !byKey[c.key].atom), "atomShare 0 gives only molecules");
}

// 6. Bass: a baseSize swell pulses and makes electrons leap; a held slider change is not a beat; it decays.
{
    const M = load();
    const { ctx } = makeCtx();
    for (let f = 0; f < 60; f++) M.draw(ctx, 800, 600, f / 60, settings, palette, 1);
    M.draw(ctx, 800, 600, 61 / 60, { ...settings, baseSize: 4.6 }, palette, 1);
    const hit = M.inspect();
    assert(hit.pulse > 0.5 && hit.jump > 0.9 && hit.lurch > 0.9, "bass swell pulses, leaps and lurches");
    for (let f = 62; f < 260; f++) M.draw(ctx, 800, 600, f / 60, settings, palette, 1);
    const calm = M.inspect();
    assert(calm.pulse < 0.01 && calm.jump === 0 && calm.lurch < 0.05, "response decays back to rest");
    for (let f = 260; f < 520; f++) M.draw(ctx, 800, 600, f / 60, { ...settings, baseSize: 5 }, palette, 1);
    assert(M.inspect().pulse < 0.01, "held slider change is not a beat");
    M.draw(ctx, 800, 600, 9, { ...settings, trebleIntensity: 0.9 }, palette, 1);
    assert.equal(M.inspect().treble, 0.9, "treble recorded");
    M.draw(ctx, 800, 600, 9.02, { ...settings, trebleIntensity: 0 }, palette, 1);
    assert.equal(M.inspect().treble, 0, "treble returns to baseline on silence");
}

// 7. Bass response is temporary: it never edits saved settings.
{
    const M = load();
    const { ctx } = makeCtx();
    const s = { ...settings };
    for (let f = 0; f < 90; f++) M.draw(ctx, 800, 600, f / 60, f === 40 ? { ...s, baseSize: 5 } : s, palette, 1);
    assert.deepEqual(s, settings, "settings object untouched");
}

// 8. Palettes: Flow-style hsl, rgb, shorthand hex, junk and empty palettes never throw.
{
    const M = load();
    const { ctx } = makeCtx();
    assert.deepEqual(Array.from(M.parseColor("#0f0")), [0, 255, 0]);
    assert.deepEqual(Array.from(M.parseColor("rgb(10, 20, 30)")), [10, 20, 30]);
    const hsl = M.parseColor("hsl(120, 100%, 50%)");
    assert(hsl[1] > 250 && hsl[0] < 5 && hsl[2] < 5, "hsl parsed");
    assert.equal(M.parseColor("nonsense"), null);
    const flow = ["hsl(190, 85%, 58%)", "hsl(240, 80%, 66%)", "hsl(290, 80%, 64%)", "hsl(330, 85%, 62%)", "hsl(40, 90%, 60%)"];
    for (let f = 0; f < 60; f++) M.draw(ctx, 800, 600, f / 60, settings, flow, 1);
    for (let f = 0; f < 10; f++) M.draw(ctx, 800, 600, f / 60, settings, ["nonsense", "", null, undefined, "#fff"], 1);
    M.draw(ctx, 800, 600, 1, settings, [], 1);
    M.draw(ctx, 0, 0, 1, settings, palette, 1);
    M.draw(ctx, 800, 600, NaN, {}, palette, 1);
    const colors = M.paletteColors(flow);
    assert.equal(colors.length, 5); assert(colors.every(c => c.every(Number.isFinite)), "flow palette resolves to numbers");
}

// 9. Veil Drift zoom is compensated: content shrinks about the centre and still fills the screen.
{
    const M = load();
    const { ctx, calls } = makeCtx();
    for (let f = 0; f < 120; f++) M.draw(ctx, 1280, 720, f / 60, settings, palette, 1.8);
    const shrink = calls.scale.filter(([x, y]) => x < 0.9 && x === y);
    assert(shrink.length > 100, "scene is drawn shrunk while the camera zooms in");
    assert(Math.abs(shrink[0][0] - 1 / Math.pow(1.8, 0.75)) < 1e-9, "shrink ≈ zoom^-0.75");
    const zoomed = M.inspect();
    const plain = load(); plain.draw(makeCtx().ctx, 1280, 720, 0, settings, palette, 1);
    assert(zoomed.clusters >= plain.inspect().clusters, "zoomed view keeps (or adds) molecules");
    assert(zoomed.clusters <= 26 && zoomed.extentX > plain.inspect().extentX * 0.85, "molecules spread to cover the visible area");
}

// 10. Arriving from another effect (app time jumps) starts a fresh, full scene.
{
    const M = load();
    const { ctx } = makeCtx();
    for (let f = 0; f < 300; f++) M.draw(ctx, 800, 600, f / 60, settings, palette, 1);
    const ids = M.inspect().live.map(c => `${c.key}${c.x.toFixed(3)}`);
    M.draw(ctx, 800, 600, 400, settings, palette, 1);
    const after = M.inspect();
    assert(after.clusters >= 6, "full scene on re-entry");
    assert(after.live.some(c => !ids.includes(`${c.key}${c.x.toFixed(3)}`)), "re-entry spawns new molecules");
    assert(after.live.some(c => c.age < 1.5), "some molecules are assembling in front of you");
}

// 11. Forcing one molecule (lab) and respawning work.
{
    const M = load();
    const { ctx } = makeCtx();
    M.forceTemplate("benzene");
    for (let f = 0; f < 200; f++) M.draw(ctx, 800, 600, f / 60, settings, palette, 1);
    assert(M.inspect().live.every(c => c.key === "benzene"), "only benzene");
    M.forceTemplate(null); M.respawn();
    for (let f = 200; f < 700; f++) M.draw(ctx, 800, 600, f / 60, settings, palette, 1);
    assert(new Set(M.inspect().live.map(c => c.key)).size > 1, "mix returns");
}

// 12. Kaleidoscope follows the app's settings (segments clamped, off by default).
{
    assert.equal(D.kaleidoSegments({}), 0); assert.equal(D.kaleidoSegments({ kaleidoscopeEnabled: true, kaleidoscopeSegments: 6 }), 6);
    assert.equal(D.kaleidoSegments({ kaleidoscopeEnabled: true, kaleidoscopeSegments: 99 }), 16);
    assert.equal(D.kaleidoSegments({ kaleidoscopeEnabled: true, kaleidoscopeSegments: 1 }), 3);
}

// 13. App integration: schema, share links, preset entry, menu, script, Flow and Random Config.
{
    assert(StateSchema.VALID_PARTICLE_SHAPES.has("molecularDance"), "schema accepts the shape");
    const url = fs.readFileSync("js/url-sync.js", "utf8");
    assert(/"mandelbrotDive", "molecularDance"\]/.test(url), "share-link table appends the shape at the end");
    const presets = vm.runInNewContext(fs.readFileSync("js/presets.js", "utf8") + "\nStylePresets;");
    const preset = presets.molecularDance;
    assert(preset && preset.particleShape === "molecularDance" && preset.colors.length === 6, "preset entry");
    const html = fs.readFileSync("index.html", "utf8");
    assert(html.includes('value="molecularDance"') && html.includes("js/molecular-dance.js"), "menu option and script tag");
    const sim = fs.readFileSync("js/simulation.js", "utf8");
    assert(sim.includes("window.MolecularDance.draw("), "simulation draws it");
    assert(/particleShape !== "molecularDance"/.test(sim), "app particle mirror skips it (it mirrors itself)");
    const app = fs.readFileSync("js/app.js", "utf8");
    assert(app.includes('nextShape === "molecularDance"'), "Random Config branch");
    assert(app.includes('nextPatternShape === "molecularDance"'), "authored Flow targets");
    assert(/kaleidoEligibleShapes = new Set\([^)]*"molecularDance"/.test(app), "Flow kaleidoscope eligible");
}

console.log("Molecular Dance: templates, lifecycle, music response, palettes, zoom compensation and integration pass.");
