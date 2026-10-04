"use strict";
// Music Moods: shared music signal + per-family voices. Behavioural and bounds checks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load() {
    const sandbox = { window: {}, module: { exports: {} }, Math, Number, Date, console };
    vm.runInNewContext(fs.readFileSync("js/music-moods.js", "utf8"), sandbox);
    return sandbox.module.exports;
}
const MM = load();
const particle = (x, y) => ({ x, y, w: 1600, h: 900, effectPhase: 1.3, effectRole: 0.4, effectLane: 0.5, spiralProgress: 0.2, tunnelTimer: 0 });
const frame = (now, o = {}) => MM.feed({ now, bass: 0, mid: 0, trebleLevel: 0, bassAttack: 0, trebleAttack: 0, gain: 1, bassOn: true, trebleOn: true, ...o });

// 1. Silence: nothing moves, multipliers are exactly neutral.
let now = 1000;
for (let i = 0; i < 120; i++) { now += 16.667; frame(now); }
assert.equal(MM.state.beat, 0, "no beat in silence");
assert.equal(MM.state.drive, 0, "no drive in silence");
let L = MM.look(particle(300, 300), { particleShape: "lotus" });
assert(Math.abs(L.size - 1) < 1e-9 && Math.abs(L.alpha - 1) < 1e-9, "silence leaves size/alpha untouched");

// 2. A steady 120 BPM kick: beats found, tempo ~120, phase locks to the beat.
for (let i = 0; i < 480; i++) {
    now += 16.667;
    const onBeat = i % 30 === 0;
    frame(now, { bass: onBeat ? 0.95 : 0.55, bassAttack: onBeat ? 0.5 : 0, mid: 0.5, trebleLevel: 0.4 });
}
assert(MM.state.beatId >= 12, `beats detected (${MM.state.beatId})`);
assert(MM.state.bpm > 105 && MM.state.bpm < 135, `tempo ~120 BPM (${MM.state.bpm.toFixed(1)})`);
assert(MM.state.lock > 0.9, "tempo confidence while beats continue");
assert(MM.state.drive > 0.3, "sustained energy builds drive");
{
    // Right after a beat the phase is near 0 (or near 1 just before the next one).
    now += 16.667; frame(now, { bass: 0.95, bassAttack: 0.5, mid: 0.5, trebleLevel: 0.4 });
    const p = MM.state.phase;
    assert(p < 0.12 || p > 0.88, `phase locked to beat (${p.toFixed(3)})`);
}

// 3. Every voice stays bounded and finite under a hard, loud signal.
const shapes = Object.keys(MM.PROFILES);
for (const shape of shapes) {
    const settings = Object.freeze({ particleShape: shape });
    for (const [x, y] of [[0, 0], [800, 450], [1600, 900], [200, 700]]) {
        const l = MM.look(particle(x, y), settings);
        assert(l.size >= 0.85 && l.size <= 1.9, `${shape}: size bound ${l.size}`);
        assert(l.alpha >= 0.7 && l.alpha <= 1.5, `${shape}: alpha bound ${l.alpha}`);
        const s = MM.steer(particle(x, y), settings, 100, 1, 1);
        assert(Number.isFinite(s.vx) && Number.isFinite(s.vy) && Number.isFinite(s.speed), `${shape}: finite steer`);
        assert(Math.hypot(s.vx, s.vy) < 3.5, `${shape}: bounded kick ${Math.hypot(s.vx, s.vy)}`);
        assert(s.speed >= 1 && s.speed <= 1.9, `${shape}: bounded speed ${s.speed}`);
    }
    assert(MM.speedMul(shape) <= 1.9, `${shape}: bounded clock surge`);
}

// 4. Voices are genuinely different: not every family answers a beat the same way.
{
    const sigs = new Set();
    for (const shape of shapes) {
        const p = particle(1000, 300);
        const s = MM.steer(p, { particleShape: shape }, 100, 1, 1);
        const l = MM.look(particle(1000, 300), { particleShape: shape });
        sigs.add([s.vx, s.vy, s.speed, l.size, l.alpha].map(v => v.toFixed(3)).join("|"));
    }
    assert(sigs.size >= shapes.length * 0.7, `varied reactions (${sigs.size} of ${shapes.length})`);
}

// 5. Midrange alone (no bass) is a real channel: swirl families move, kick families stay put.
MM.reset();
now += 5000;
for (let i = 0; i < 240; i++) { now += 16.667; frame(now, { bass: 0, mid: 0.8, trebleLevel: 0, bassAttack: 0 }); }
assert(MM.state.mid > 0.5 && MM.state.beat === 0, "midrange registers without bass");
const swirl = MM.steer(particle(1000, 300), { particleShape: "violetUndertow" }, 100, 1, 1);
assert(Math.hypot(swirl.vx, swirl.vy) > 0.05, "midrange swirls Violet Undertow");

// 6. Bass toggle off: no beats at all.
MM.reset(); now += 5000;
const idBefore = MM.state.beatId;
for (let i = 0; i < 200; i++) { now += 16.667; frame(now, { bass: 0.9, bassAttack: i % 25 === 0 ? 0.6 : 0, bassOn: false }); }
assert.equal(MM.state.beat, 0, "bass toggle off means no beat response");
assert.equal(MM.state.beatId, idBefore, "no beats registered while bass response is off");

// 7. Comfort gain halves the reaction.
function beatSize(gain) {
    MM.reset(); now += 5000;
    for (let i = 0; i < 60; i++) { now += 16.667; frame(now, { bass: 0.9, bassAttack: i === 59 ? 0.6 : 0, gain }); }
    return MM.look(particle(800, 450), { particleShape: "cluster" }).size - 1;
}
const full = beatSize(1), half = beatSize(0.5);
assert(full > 0 && half > 0 && half < full * 0.75, `comfort gain softens response (${half.toFixed(3)} < ${full.toFixed(3)})`);

// 8. Stop: reset restores neutral look/steer, never touches settings, and flow time never runs backwards.
const flowBefore = MM.flowOffset();
MM.reset();
assert.equal(MM.active, false, "inactive after reset");
assert(MM.flowOffset() === flowBefore, "flow clock keeps its value");
L = MM.look(particle(300, 300), { particleShape: "cluster" });
assert(Math.abs(L.size - 1) < 1e-9 && Math.abs(L.alpha - 1) < 1e-9, "reset leaves neutral look");
assert.equal(MM.speedMul("jadeCurrents"), 1, "reset leaves neutral clock");
assert.equal(MM.beatSwell(0.3), 1, "reset leaves neutral module swell");

// 9. Coverage: every geometry in the preset file has a voice; no voice is orphaned.
const presets = fs.readFileSync("js/presets.js", "utf8");
const used = new Set([...presets.matchAll(/particleShape:\s*"([A-Za-z0-9]+)"/g)].map(m => m[1]));
for (const shape of used) assert(MM.PROFILES[shape], `preset geometry "${shape}" has no music voice`);
// stellarNursery lives on another branch until merged; its voice is reserved here.
const reserved = new Set(["stellarNursery"]);
for (const shape of shapes) assert(used.has(shape) || reserved.has(shape), `music voice "${shape}" matches no preset geometry`);

// 10. Hooks are wired where they must be.
const sim = fs.readFileSync("js/simulation.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8"), synth = fs.readFileSync("js/synth.js", "utf8");
assert(sim.includes("MusicMoods.steer") && sim.includes("MusicMoods.look") && sim.includes("MusicMoods.speedMul"), "simulation hooks");
assert(app.includes("MusicMoods.feed") && app.includes("MusicMoods.reset"), "app feeds and resets the signal");
assert(synth.includes("mid: midVal") && synth.includes("level: levelVal"), "synth exposes midrange and level");
assert(html.indexOf("music-moods.js") > 0 && html.indexOf("music-moods.js") < html.indexOf("js/simulation.js"), "module loads before the simulation");


// 11. Runtime smoke: real Particle update/draw for every geometry while music plays, then silence.
{
    const simSource = fs.readFileSync("js/simulation.js", "utf8");
    const box = { window: { MusicMoods: MM }, console, Date };
    const { Particle } = vm.runInNewContext(simSource + "\n({Particle});", box);
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, { get(_, n) { return (n === "createLinearGradient" || n === "createRadialGradient") ? () => gradient : () => {}; }, set() { return true; } });
    for (const shape of shapes) {
        if (["celticCurrent", "celticKnotwork", "cymaticResonance", "mandelbrotDive", "molecularDance", "stellarNursery"].includes(shape)) continue;
        const settings = { particleShape: shape, speed: 1, zoom: 1, turbulence: 0.5, drag: 0.9, interaction: 0, wobble: 0, rotationSpeed: 0,
            baseSize: 3, sizeVariation: 1, stretch: 1.5, eclipseCount: 12, eclipseSize: 1, miniSpiralCount: 3, trebleIntensity: 0, particleLighting: "glow" };
        const ps = Array.from({ length: 24 }, (_, i) => { const q = new Particle(1600, 900, ["#22d3ee", "#a78bfa"]); q.index = i; q.viewportScale = 1; return q; });
        MM.reset(); let t = 0; let clock = 50000;
        for (let f = 0; f < 240; f++) {
            clock += 16.667; t += 1;
            const onBeat = f % 28 === 0;
            MM.feed({ now: clock, bass: onBeat ? 0.95 : 0.5, mid: 0.6, trebleLevel: 0.5, bassAttack: onBeat ? 0.5 : 0, trebleAttack: f % 9 === 0 ? 0.3 : 0, gain: 1, bassOn: true, trebleOn: true });
            for (const q of ps) { q.update(settings, t, { x: -999, y: -999, active: false }, [], [], [], 1, t); q.draw(ctx, settings); }
        }
        for (const q of ps) assert([q.x, q.y, q.vx, q.vy].every(Number.isFinite), `${shape}: finite particle state under music`);
        MM.reset();
        for (let f = 0; f < 30; f++) { t += 1; for (const q of ps) { q.update(settings, t, { x: -999, y: -999, active: false }, [], [], [], 1, t); q.draw(ctx, settings); } }
        for (const q of ps) assert([q.x, q.y, q.vx, q.vy].every(Number.isFinite), `${shape}: finite particle state after stop`);
    }
}

// 12. Tuning: values are clamped, unknown keys ignored, changes are exportable and resettable.
{
    assert.equal(MM.setProfile("notAShape", { kick: 1 }), null, "unknown geometry is ignored");
    MM.setProfile("jadeCurrents", { kick: 99, swirl: -5, sway: "abc", bogus: 3, "ripple.amp": 5, ripple: { freq: 0.01, dir: "sideways", to: "size" } });
    const j = MM.profileFor("jadeCurrents");
    assert.equal(j.kick, 2, "kick clamps to its maximum");
    assert.equal(j.swirl, 0, "swirl clamps to its minimum");
    assert.equal(j.sway, 0.5, "non-numeric values are ignored");
    assert(!("bogus" in j), "unknown keys are ignored");
    assert.equal(j.ripple.amp, 0.8, "ripple strength clamps");
    assert.equal(j.ripple.freq, 0.2, "ripple spacing clamps");
    assert.equal(j.ripple.dir, "x", "invalid direction is ignored");
    assert.equal(j.ripple.to, "size", "valid ripple target is applied");
    const changes = MM.exportChanges();
    assert(changes.jadeCurrents && changes.jadeCurrents.kick === 2 && changes.jadeCurrents.swirl === 0, "changes are exported");
    assert.equal(Object.keys(changes).length, 1, "only edited geometries are exported");
    // Even with every value at its limit, motion and look stay inside the hard ceilings.
    MM.reset(); now += 5000;
    for (let i = 0; i < 90; i++) { now += 16.667; frame(now, { bass: 1, mid: 1, trebleLevel: 1, bassAttack: i % 28 === 0 ? 0.6 : 0, trebleAttack: 0.4 }); }
    MM.setProfile("jadeCurrents", { kick: 2, swirl: 1.5, sway: 1.5, rise: 1.5, surge: 1, pulse: .6, bloom: .6, glow: .8, lift: .6, twinkle: 1, "ripple.amp": .8 });
    const extreme = MM.steer(particle(1000, 300), { particleShape: "jadeCurrents" }, 100, 1, 1);
    assert(Math.hypot(extreme.vx, extreme.vy) <= 3.41, "velocity ceiling holds at maximum tuning");
    const lookMax = MM.look(particle(1000, 300), { particleShape: "jadeCurrents" });
    assert(lookMax.size <= 1.9 && lookMax.alpha <= 1.5, "look ceilings hold at maximum tuning");
    MM.resetProfile("jadeCurrents");
    assert.equal(JSON.stringify(MM.exportChanges()), "{}", "reset restores the shipped defaults");
    assert.equal(MM.profileFor("jadeCurrents").kick, undefined, "default has no kick");
}

console.log(`Music moods checks passed (${shapes.length} voices).`);
