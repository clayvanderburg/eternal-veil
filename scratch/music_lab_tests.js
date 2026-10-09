"use strict";
// Music Lab smoke test: loads tools/music-lab.html in jsdom with a fake canvas and audio,
// cycles every preset through the real renderer with music playing, and exercises the editor,
// the playlist source, locking, auto-save and the one-line copy of everything.
const assert = require("node:assert/strict");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const file = path.resolve(__dirname, "../tools/music-lab.html");

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
const makeStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _map: m }; };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function boot(store) {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    // Google Fonts is a network request; it is not part of what is under test.
    virtualConsole.on("jsdomError", e => { const text = String(e.stack || e.message || e); if (!/Could not load link/.test(text)) errors.push(text); });
    const copied = [];
    const dom = await JSDOM.fromFile(file, {
        runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole,
        beforeParse(window) {
            window.HTMLCanvasElement.prototype.getContext = function (type) { return type === "2d" ? fakeCtx() : null; };
            window.AudioContext = class { createAnalyser() { return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData() {}, getFloatFrequencyData() {}, connect() {} }; } get sampleRate() { return 48000; } createMediaElementSource() { return { connect() {} }; } get destination() { return {}; } resume() {} };
            window.HTMLMediaElement.prototype.play = function () { this._played = (this._played || 0) + 1; return Promise.resolve(); };
            window.HTMLMediaElement.prototype.pause = () => {};
            Object.defineProperty(window, "localStorage", { value: store, configurable: true });
            Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async t => { copied.push(t); } }, configurable: true });
            window.innerWidth = 1280; window.innerHeight = 720;
        }
    });
    const { window } = dom;
    await new Promise(r => { if (window.document.readyState === "complete") r(); else window.addEventListener("load", r); });
    await wait(300);
    return { window, errors, copied, $: id => window.document.getElementById(id) };
}
const fire = (w, el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));

(async () => {
    const store = makeStore();
    const lab = await boot(store);
    const { window, errors, $ } = lab;
    assert.equal(errors.length, 0, "lab loads without script errors:\n" + errors.join("\n"));

    const MM = window.MusicMoods;
    assert(MM && window.FlowSimulation && window.simInstance, "real renderer and Music Moods are loaded");
    const options = [...$("presetSelect").options];
    assert(options.length >= 36, `every preset is listed (${options.length})`);

    // Cycle every preset with music playing; the real tick/update/draw must not throw.
    const sim = window.simInstance;
    const StylePresets = window.eval("StylePresets"); // top-level const, not a window property
    const seen = new Set();
    for (const o of options) {
        $("presetSelect").value = o.value;
        fire(window, $("presetSelect"), "change");
        assert.equal(sim.settings.particleShape, StylePresets[o.value].particleShape || "ellipse", `${o.value}: preset applied`);
        seen.add(sim.settings.particleShape);
        await wait(50);
        assert.equal(errors.length, 0, `${o.value}: no errors while rendering with music:\n` + errors.join("\n"));
    }
    assert(MM.state.active, "the test beat drives Music Moods");
    assert(MM.state.beatId > 0, "beats were detected from the test beat");

    // ---- playlist source: the app's own songs ----
    assert([...$("source").options].some(o => o.value === "playlist"), "playlist is offered as a source");
    $("source").value = "playlist";
    fire(window, $("source"), "change");
    await wait(30);
    assert.equal($("listBox").hidden, false, "playlist controls appear");
    // Whatever playlist Studio made first; songs come from js/music-catalog.js.
    const CATALOG = require("../js/music-catalog.js");
    const first = CATALOG.playlists[0];
    const urls = first.tracks.map(id => CATALOG.tracks.find(t => t.id === id).url);
    const playing = i => assert($("listAudio").src.endsWith("/" + urls[i]), `song ${i + 1} of ${first.name} (${urls[i]}), got ${$("listAudio").src}`);
    assert(urls.length >= 3, "the first playlist has at least three songs");
    assert.equal($("trackSelect").options.length, urls.length, "every song of the first playlist is listed");
    assert.equal($("playlistSelect").options[0].value, first.id, "the catalog's first playlist is first");
    playing(0);
    assert($("listAudio")._played >= 1, "playback is started");
    $("nextTrack").dispatchEvent(new window.Event("click"));
    playing(1);
    fire(window, $("listAudio"), "ended");
    playing(2);
    $("prevTrack").dispatchEvent(new window.Event("click"));
    playing(1);
    $("trackSelect").value = String(urls.length - 1);
    fire(window, $("trackSelect"), "change");
    playing(urls.length - 1);
    $("nextTrack").dispatchEvent(new window.Event("click"));
    playing(0);
    await wait(100);
    assert(MM.state.active, "playlist audio feeds Music Moods");
    assert.equal(errors.length, 0, "no errors while the playlist plays:\n" + errors.join("\n"));
    $("source").value = "beat";
    fire(window, $("source"), "change");

    // ---- tuning two presets, locking one, copying everything at once ----
    const pick = key => { $("presetSelect").value = key; fire(window, $("presetSelect"), "change"); };
    pick("quantum");
    const kick = $("v-kick");
    assert(kick, "kick slider exists for Quantum Drift");
    kick.value = "1.4"; fire(window, kick, "input");
    assert.equal(MM.profileFor("quantumDrift").kick, 1.4, "slider edits the live reaction");
    assert.equal($("lockVoice").textContent, "Lock this reaction");
    $("lockVoice").dispatchEvent(new window.Event("click"));
    assert.equal($("v-kick").disabled, true, "a locked reaction's sliders are protected");
    assert.equal($("resetVoice").disabled, true, "a locked reaction cannot be reset by accident");
    assert.equal($("lockVoice").textContent, "Unlock this reaction");
    assert([...$("presetSelect").options].find(o => o.value === "quantum").textContent.startsWith("✓"), "locked presets are marked ✓");

    pick("liquid");
    const sway = $("v-sway");
    sway.value = "0.9"; fire(window, sway, "input");
    assert([...$("presetSelect").options].find(o => o.value === "liquid").textContent.startsWith("●"), "edited presets are marked ●");
    // Lock a reaction that was not changed at all: "I like it as it is".
    pick("lotusPulse");
    $("lockVoice").dispatchEvent(new window.Event("click"));

    assert.equal($("tunedList").querySelectorAll(".tuned-row").length, 3, "the tuned list shows every reaction you worked on");
    const all = JSON.parse($("settingsText").value);
    assert.equal(all.lab, "music");
    assert.equal(JSON.stringify(Object.keys(all.voices).sort()), JSON.stringify(["jadeCurrents", "quantumDrift"]), "one line holds every edited reaction");
    assert.equal(all.voices.quantumDrift.kick, 1.4);
    assert.equal(all.voices.jadeCurrents.sway, 0.9);
    assert.equal(JSON.stringify([...all.locked].sort()), JSON.stringify(["lotus", "quantumDrift"]), "locked reactions travel with it (even unchanged ones)");
    assert.match($("copy").textContent, /\(3\)/, "the copy button shows how many reactions it will copy");
    $("copy").dispatchEvent(new window.Event("click"));
    await wait(20);
    assert.equal(lab.copied.length, 1, "copy sends one line to the clipboard");
    assert.equal(lab.copied[0], $("settingsText").value, "clipboard holds exactly the line shown");
    assert.match($("status").textContent, /Copied 3 reactions in one line/, "status says what was copied");

    $("lockedOnly").checked = true; fire(window, $("lockedOnly"), "change");
    const lockedLine = JSON.parse($("settingsText").value);
    assert.equal(JSON.stringify(Object.keys(lockedLine.voices)), JSON.stringify(["quantumDrift"]), "locked-only copies just the locked edits");
    $("lockedOnly").checked = false; fire(window, $("lockedOnly"), "change");

    // ---- auto-save: a fresh page in the same browser gets everything back ----
    const saved = JSON.parse(store.getItem("eternalvoid.musiclab.v1"));
    assert.equal(saved.voices.quantumDrift.kick, 1.4, "edits are auto-saved");
    assert.equal(JSON.stringify([...saved.locked].sort()), JSON.stringify(["lotus", "quantumDrift"]), "locks are auto-saved");
    window.close();
    const again = await boot(store);
    assert.equal(again.errors.length, 0, "second visit loads cleanly:\n" + again.errors.join("\n"));
    assert.equal(again.window.MusicMoods.profileFor("quantumDrift").kick, 1.4, "tuned reactions are restored on the next visit");
    assert.equal(again.window.MusicMoods.profileFor("jadeCurrents").sway, 0.9, "every tuned reaction is restored");
    assert([...again.$("presetSelect").options].find(o => o.value === "quantum").textContent.startsWith("✓"), "locks are restored");
    assert.equal(again.$("tunedList").querySelectorAll(".tuned-row").length, 3, "the tuned list is restored");

    // ---- pasting a line loads it (including locks); unknown keys are ignored ----
    again.window.MusicMoods.resetProfile("jadeCurrents");
    again.$("settingsText").value = JSON.stringify({ lab: "music", voices: { jadeCurrents: { sway: 0.7, "ripple.amp": 0.5, bogus: 5 } }, locked: ["jadeCurrents", "notAShape"] });
    fire(again.window, again.$("settingsText"), "paste");
    await wait(30);
    assert.equal(again.window.MusicMoods.profileFor("jadeCurrents").sway, 0.7, "pasted line is applied");
    assert.equal(again.window.MusicMoods.profileFor("jadeCurrents").ripple.amp, 0.5, "pasted ripple value is applied");
    assert(!("bogus" in again.window.MusicMoods.profileFor("jadeCurrents")), "unknown keys are ignored");
    assert.match(again.$("tunedList").textContent, /Locked/, "pasted locks are applied");

    // ---- reset everything needs a second click, then clears values, locks and the saved copy ----
    again.$("resetAll").dispatchEvent(new again.window.Event("click"));
    assert.equal(again.window.MusicMoods.profileFor("quantumDrift").kick, 1.4, "one click does not reset");
    assert.match(again.$("resetAll").textContent, /again/i, "the button asks for confirmation");
    again.$("resetAll").dispatchEvent(new again.window.Event("click"));
    assert.equal(JSON.stringify(again.window.MusicMoods.exportChanges()), "{}", "reset everything restores the shipped defaults");
    assert.equal(again.$("settingsText").value, "", "nothing left to copy after a reset");
    const afterReset = JSON.parse(store.getItem("eternalvoid.musiclab.v1"));
    assert.equal(afterReset.locked.length, 0, "locks are cleared and the saved copy is emptied");

    // ---- silence returns everything to neutral ----
    again.$("source").value = "off";
    fire(again.window, again.$("source"), "change");
    await wait(80);
    assert.equal(again.window.MusicMoods.active, false, "silence resets Music Moods");
    assert.equal(again.window.simInstance.settings.trebleIntensity, 0, "silence clears the treble modulation");
    assert.equal(again.errors.length, 0, "no errors after silence:\n" + again.errors.join("\n"));

    again.window.close();
    console.log(`Music lab checks passed (${options.length} presets, ${seen.size} geometries rendered, playlist, locks, auto-save).`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
