"use strict";
// Music Lab smoke test: loads tools/music-lab.html in jsdom with a fake canvas and audio,
// cycles every preset through the real renderer with music playing, and exercises the editor.
const assert = require("node:assert/strict");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const file = path.resolve(__dirname, "../tools/music-lab.html");
const errors = [];
const virtualConsole = new VirtualConsole();
// Google Fonts is a network request; it is not part of what is under test.
virtualConsole.on("jsdomError", e => { const text = String(e.stack || e.message || e); if (!/Could not load link/.test(text)) errors.push(text); });

function fakeCtx() {
    const gradient = { addColorStop() {} };
    return new Proxy({}, {
        get(_, name) {
            if (name === "createLinearGradient" || name === "createRadialGradient" || name === "createConicGradient") return () => gradient;
            if (name === "measureText") return () => ({ width: 10 });
            if (name === "getImageData" || name === "createImageData") return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
            if (name === "canvas") return {};
            return () => {};
        },
        set() { return true; }
    });
}

(async () => {
    const dom = await JSDOM.fromFile(file, {
        runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole,
        beforeParse(window) {
            window.HTMLCanvasElement.prototype.getContext = function (type) { return type === "2d" ? fakeCtx() : null; };
            window.AudioContext = class { createAnalyser() { return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData() {}, connect() {} }; } createMediaElementSource() { return { connect() {} }; } get destination() { return {}; } resume() {} };
            window.HTMLMediaElement.prototype.play = () => Promise.resolve();
            window.HTMLMediaElement.prototype.pause = () => {};
            window.innerWidth = 1280; window.innerHeight = 720;
        }
    });
    const { window } = dom;
    const $ = id => window.document.getElementById(id);
    await new Promise(r => { if (window.document.readyState === "complete") r(); else window.addEventListener("load", r); });
    await new Promise(r => setTimeout(r, 400));
    assert.equal(errors.length, 0, "lab loads without script errors:\n" + errors.join("\n"));

    const MM = window.MusicMoods;
    assert(MM && window.FlowSimulation && window.simInstance, "real renderer and Music Moods are loaded");
    const options = [...$("presetSelect").options];
    assert(options.length >= 36, `every preset is listed (${options.length})`);
    assert.equal($("hudPreset").textContent.trim().length > 0, true, "current preset is shown");

    // Cycle every preset with music playing; the real tick/update/draw must not throw.
    const sim = window.simInstance;
    const StylePresets = window.eval("StylePresets"); // top-level const, not a window property
    const seen = new Set();
    for (const o of options) {
        $("presetSelect").value = o.value;
        $("presetSelect").dispatchEvent(new window.Event("change"));
        assert.equal(sim.settings.particleShape, StylePresets[o.value].particleShape || "ellipse", `${o.value}: preset applied`);
        seen.add(sim.settings.particleShape);
        await new Promise(r => setTimeout(r, 60));
        assert.equal(errors.length, 0, `${o.value}: no errors while rendering with music:\n` + errors.join("\n"));
    }
    assert(MM.state.active, "the test beat drives Music Moods");
    assert(MM.state.beatId > 0, "beats were detected from the test beat");

    // Editing a reaction updates the live voice and the copyable line.
    $("presetSelect").value = "quantum";
    $("presetSelect").dispatchEvent(new window.Event("change"));
    const kick = $("v-kick");
    assert(kick, "kick slider exists for Quantum Drift");
    kick.value = "1.4";
    kick.dispatchEvent(new window.Event("input"));
    assert.equal(MM.profileFor("quantumDrift").kick, 1.4, "slider edits the live reaction");
    const line = JSON.parse($("settingsText").value);
    assert.equal(line.lab, "music");
    assert.equal(JSON.stringify(line.voices), JSON.stringify({ quantumDrift: { kick: 1.4 } }), "copy line holds only what changed");

    // Pasting a line loads it; reset restores the defaults.
    MM.resetProfile("quantumDrift");
    $("settingsText").value = JSON.stringify({ lab: "music", voices: { jadeCurrents: { sway: 0.9, "ripple.amp": 0.5, bogus: 5 } } });
    $("settingsText").dispatchEvent(new window.Event("paste"));
    await new Promise(r => setTimeout(r, 30));
    assert.equal(MM.profileFor("jadeCurrents").sway, 0.9, "pasted line is applied");
    assert.equal(MM.profileFor("jadeCurrents").ripple.amp, 0.5, "pasted ripple value is applied");
    assert(!("bogus" in MM.profileFor("jadeCurrents")), "unknown keys are ignored");
    $("resetAll").dispatchEvent(new window.Event("click"));
    assert.equal(JSON.stringify(MM.exportChanges()), "{}", "reset everything restores the shipped defaults");
    assert.equal($("settingsText").value, "", "nothing left to copy after a reset");

    // Silence returns everything to neutral.
    $("source").value = "off";
    $("source").dispatchEvent(new window.Event("change"));
    await new Promise(r => setTimeout(r, 80));
    assert.equal(MM.active, false, "silence resets Music Moods");
    assert.equal(sim.settings.trebleIntensity, 0, "silence clears the treble modulation");
    assert.equal(errors.length, 0, "no errors after silence:\n" + errors.join("\n"));

    window.close();
    console.log(`Music lab checks passed (${options.length} presets, ${seen.size} geometries rendered).`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
