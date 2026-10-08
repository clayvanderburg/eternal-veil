/**
 * ETERNAL VOID — Visual Playlists model tests
 * Storage, ordering, repeat/shuffle order, timing, Flow-within-playlist
 * variation bounds, Comfort Mode, and one/two color playlist rotations.
 */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const presetCtx = { window: {}, console };
vm.createContext(presetCtx);
vm.runInContext(fs.readFileSync(path.join(root, "js/presets.js"), "utf8") + ";this.SP = StylePresets;", presetCtx);
const StylePresets = presetCtx.SP;
const colorCtx = { window: {}, console, localStorage: { getItem: () => null } };
vm.createContext(colorCtx);
vm.runInContext(fs.readFileSync(path.join(root, "js/color-cycles.js"), "utf8"), colorCtx);
const ColorCycles = colorCtx.window.ColorCycles;

const VP = require(path.join(root, "js/visual-playlists.js"));
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const memoryStorage = () => { const data = {}; return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data }; };
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

console.log("Visual playlists model");

test("first load seeds the demo playlist with real, non-excluded-by-default presets", () => {
    const store = VP.loadStore(memoryStorage());
    assert.strictEqual(store.playlists.length, 1);
    const demo = store.playlists[0];
    assert.ok(demo.demo);
    assert.strictEqual(store.selectedId, demo.id);
    demo.entries.forEach(entry => assert.ok(StylePresets[entry.preset], `demo preset ${entry.preset} exists`));
    assert.strictEqual(demo.colors.mode, "playlists");
    assert.ok(ColorCycles.playlists[demo.colors.a]);
    assert.strictEqual(VP.passSeconds(demo), 8 * 16);
    // Every demo preset is a calm, non-flashing scene.
    demo.entries.forEach(entry => assert.ok(!StylePresets[entry.preset].psychedelicMode, entry.preset));
});

test("new playlists start with Clay's chosen defaults", () => {
    const p = VP.createPlaylist("x", ["nebula"]);
    assert.deepStrictEqual([p.mode, p.stay, p.transition, p.repeat, p.shuffle], ["flow", 10, 6, "all", true]);
    assert.deepStrictEqual(p.colors, { mode: "playlists", a: "ocean", b: "", combine: "alternate", every: 15, fade: 3 });
    const demo = VP.createDemoPlaylist();
    assert.deepStrictEqual([demo.stay, demo.transition, demo.shuffle, demo.colors.every, demo.colors.fade], [10, 6, true, 15, 3]);
});

test("Wildwood and Stardream fade only through their own colour families", () => {
    const hue = hex => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
        if (!d) return { h: 0, s: 0 };
        const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
        return { h: h * 60, s: s * 100 }; };
    const forbidden = { wildwood: h => h > 190 && h < 330, stardream: h => h > 70 && h < 170 };
    for (const [name, isForbidden] of Object.entries(forbidden)) {
        const list = ColorCycles.playlists[name];
        assert.ok(list.length >= 5 && VP.COLOR_PLAYLIST_NAMES[name], name);
        list.forEach((palette, i) => {
            const next = list[(i + 1) % list.length];
            palette.forEach((color, slot) => {
                const a = hue(color), b = hue(next[slot]);
                if (a.s < 12 || b.s < 12) return;
                const delta = ((b.h - a.h + 540) % 360) - 180; // the app's palette morph takes the short way round
                for (let t = 0; t <= 1; t += 0.05) assert.ok(!isForbidden((a.h + delta * t + 360) % 360), `${name} ${i}->${i + 1} slot ${slot}`);
            });
        });
    }
});

test("playlists persist and reload unchanged (order, repeats, overrides, settings)", () => {
    const storage = memoryStorage();
    const playlist = VP.createPlaylist("Long take", ["mandalaZen", "mandala", "mandalaZen"]);
    playlist.entries[1].stay = 120;
    playlist.mode = "sequence"; playlist.stay = 90; playlist.transition = 12; playlist.repeat = "off"; playlist.shuffle = true;
    playlist.colors = { mode: "playlists", a: "goth", b: "ocean", combine: "combine", every: 60, fade: 20 };
    VP.saveStore(storage, { selectedId: playlist.id, playlists: [playlist] });
    const loaded = VP.loadStore(storage);
    assert.strictEqual(loaded.selectedId, playlist.id);
    const p = loaded.playlists[0];
    assert.deepStrictEqual(p.entries.map(e => e.preset), ["mandalaZen", "mandala", "mandalaZen"]);
    assert.deepStrictEqual(p.entries.map(e => e.stay), [null, 120, null]);
    assert.deepStrictEqual([p.mode, p.stay, p.transition, p.repeat, p.shuffle], ["sequence", 90, 12, "off", true]);
    assert.deepStrictEqual(p.colors, playlist.colors);
});

test("an emptied store stays empty (deleting the demo is respected)", () => {
    const storage = memoryStorage();
    VP.saveStore(storage, { selectedId: null, playlists: [] });
    assert.strictEqual(VP.loadStore(storage).playlists.length, 0);
});

test("corrupt or hostile values are normalized", () => {
    const p = VP.normalizePlaylist({ name: "x".repeat(99), entries: [{ preset: "nebula", stay: -4 }, null, { preset: 7 }], mode: "nope", stay: "abc", transition: 9999, repeat: "sometimes",
        colors: { mode: "playlists", a: "missing", b: "missing", every: 0, fade: -1 } });
    assert.strictEqual(p.name.length, 40);
    assert.deepStrictEqual(p.entries.map(e => [e.preset, e.stay]), [["nebula", null]]);
    assert.strictEqual(p.mode, "flow");
    assert.strictEqual(p.transition, 120);
    assert.strictEqual(p.repeat, "all");
    assert.strictEqual(p.colors.a, "ocean");
    assert.strictEqual(p.colors.b, "");
});

test("duplicate gets new ids and is no longer the demo", () => {
    const demo = VP.createDemoPlaylist();
    const copy = VP.duplicatePlaylist(demo);
    assert.notStrictEqual(copy.id, demo.id);
    assert.ok(!copy.demo);
    assert.strictEqual(copy.name, "Night Voyage copy");
    copy.entries.forEach((entry, i) => { assert.notStrictEqual(entry.id, demo.entries[i].id); assert.strictEqual(entry.preset, demo.entries[i].preset); });
});

test("reordering moves exactly one entry", () => {
    const entries = ["a", "b", "c", "d"].map(preset => ({ id: preset, preset }));
    assert.deepStrictEqual(VP.moveEntry(entries, 0, 2).map(e => e.id), ["b", "c", "a", "d"]);
    assert.deepStrictEqual(VP.moveEntry(entries, 3, 0).map(e => e.id), ["d", "a", "b", "c"]);
    assert.deepStrictEqual(VP.moveEntry(entries, 1, 99).map(e => e.id), ["a", "c", "d", "b"]);
});

test("in-order playback keeps the list order and intentional repeats", () => {
    const p = VP.createPlaylist("x", ["nebula", "nebula", "cosmic", "mandala"]);
    p.shuffle = false;
    assert.deepStrictEqual(VP.buildOrder(p), [0, 1, 2, 3]);
});

test("excluded presets are skipped", () => {
    const p = VP.createPlaylist("x", ["nebula", "acid", "cosmic"]);
    p.shuffle = false;
    const excluded = new Set(["acid"]);
    assert.deepStrictEqual(VP.buildOrder(p, { isPlayable: key => !excluded.has(key) }), [0, 2]);
    assert.strictEqual(VP.passSeconds(p, key => !excluded.has(key)), 2 * (p.transition + p.stay));
});

test("shuffle plays every entry once per pass and avoids back-to-back repeats", () => {
    const p = VP.createPlaylist("x", ["nebula", "nebula", "cosmic", "mandala", "lotusPulse", "mandala"]);
    p.shuffle = true;
    for (let seed = 1; seed < 60; seed++) {
        const order = VP.buildOrder(p, { rand: seeded(seed), avoidFirstPreset: "cosmic" });
        assert.deepStrictEqual([...order].sort(), [0, 1, 2, 3, 4, 5]);
        order.forEach((index, i) => { if (i) assert.notStrictEqual(p.entries[index].preset, p.entries[order[i - 1]].preset, `seed ${seed}`); });
        assert.notStrictEqual(p.entries[order[0]].preset, "cosmic", `pass boundary, seed ${seed}`);
    }
});

test("timing: per-entry overrides and Comfort Mode's minimum transition", () => {
    const p = VP.createPlaylist("x", ["nebula", "cosmic"]);
    p.stay = 30; p.transition = 2; p.entries[1].stay = 300;
    assert.strictEqual(VP.entryStay(p, p.entries[0]), 30);
    assert.strictEqual(VP.entryStay(p, p.entries[1]), 300);
    assert.strictEqual(VP.passSeconds(p), 2 + 30 + 2 + 300);
    assert.strictEqual(VP.effectiveTransition(p, true), 6);
    assert.strictEqual(VP.passSeconds(p, () => true, true), 6 + 30 + 6 + 300);
    assert.strictEqual(VP.formatDuration(45), "45 s");
    assert.strictEqual(VP.formatDuration(440), "7 min 20 s");
    assert.strictEqual(VP.formatDuration(3720), "1 h 2 min");
});

test("preset sequence uses each preset's exact saved values", () => {
    const keys = new Set(["speed", "flowOrganic", "baseSize"]);
    for (const [key, preset] of Object.entries(StylePresets)) {
        const t = VP.computeTargets(preset, { variation: false, settingKeys: keys });
        assert.strictEqual(t.speed, preset.speed, key);
        assert.strictEqual(t.flowOrganic, preset.curl, key);
        assert.strictEqual(t.baseSize, preset.size, key);
        assert.strictEqual(t.density, Math.round(preset.density), key);
        if (preset.kaleidoscopeEnabled && preset.kaleidoscopeSegments != null) assert.strictEqual(t.kaleidoscopeSegments, preset.kaleidoscopeSegments, key);
        else assert.ok(!("kaleidoscopeSegments" in t), key);
    }
});

test("Flow within playlist stays near each preset and keeps zeros at zero", () => {
    for (const personality of ["serene", "alive", "wild"]) {
        const spread = { serene: 0.12, alive: 0.2, wild: 0.28 }[personality];
        for (const [key, preset] of Object.entries(StylePresets)) {
            for (let seed = 1; seed < 12; seed++) {
                const t = VP.computeTargets(preset, { variation: true, personality, rand: seeded(seed * 31 + key.length) });
                assert.ok(Math.abs(t.speed - preset.speed) <= preset.speed * spread + 1e-9, `${key} speed`);
                assert.ok(Math.abs(t.zoom - preset.zoom) <= preset.zoom * spread * 0.3 + 1e-9, `${key} zoom`);
                assert.ok(t.density <= Math.round(preset.density * 1.1) + 1, `${key} density cap`);
                assert.ok(Math.abs(t.dissipation - preset.dissipation) <= preset.dissipation * spread * 0.4 + 1e-9, `${key} dissipation`);
                if (preset.turbulence === 0) assert.strictEqual(t.turbulence, 0, `${key} turbulence stays 0`);
                if (preset.miniSpiralCount != null) assert.ok(t.miniSpiralCount >= 4 && t.miniSpiralCount <= 8 && Number.isInteger(t.miniSpiralCount));
                if (preset.kaleidoscopeEnabled && preset.kaleidoscopeSegments != null) assert.strictEqual(t.kaleidoscopeSegments, preset.kaleidoscopeSegments, `${key} keeps its segments`);
            }
        }
    }
});

test("Comfort Mode caps motion and drops flashing switches", () => {
    const acid = StylePresets.acid;
    const t = VP.computeTargets({ ...acid, speed: 4, density: 5000 }, { variation: true, personality: "wild", comfort: true, rand: () => 1 });
    assert.ok(t.speed <= 1.35 && t.density <= 2200);
    const d = VP.discreteSettings(acid, true);
    assert.strictEqual(d.psychedelicMode, false);
    assert.strictEqual(VP.discreteSettings(acid, false).psychedelicMode, true);
    assert.strictEqual(VP.discreteSettings(StylePresets.strings).particleShape, "ellipse");
    assert.strictEqual(VP.discreteSettings(StylePresets.liquidChrome).particleLighting, "metal");
});

test("future numeric preset fields carry over when the simulation supports them", () => {
    const t = VP.computeTargets({ speed: 1, vortexHole: 0.4, notASetting: 3 }, { settingKeys: new Set(["vortexHole"]) });
    assert.strictEqual(t.vortexHole, 0.4);
    assert.ok(!("notASetting" in t));
});

const palettesFor = name => ColorCycles.playlists[name] || [];
test("one color playlist rotates through its palettes", () => {
    const rotation = VP.buildColorRotation({ a: "ocean", b: "", combine: "alternate" }, palettesFor);
    assert.deepStrictEqual(rotation.map(r => r.palette), ColorCycles.playlists.ocean);
});

test("two color playlists alternate strictly", () => {
    const rotation = VP.buildColorRotation({ a: "ocean", b: "chakra", combine: "alternate" }, palettesFor);
    assert.strictEqual(rotation.length, 2 * Math.max(ColorCycles.playlists.ocean.length, ColorCycles.playlists.chakra.length));
    rotation.forEach((item, i) => assert.strictEqual(item.source, i % 2 ? "chakra" : "ocean"));
    assert.strictEqual(new Set(rotation.filter(r => r.source === "chakra").map(r => r.palette)).size, ColorCycles.playlists.chakra.length);
});

test("two color playlists combine into one shuffled rotation of every palette", () => {
    const rotation = VP.buildColorRotation({ a: "ocean", b: "goth", combine: "combine" }, palettesFor, seeded(7));
    assert.strictEqual(rotation.length, ColorCycles.playlists.ocean.length + ColorCycles.playlists.goth.length);
    assert.deepStrictEqual(new Set(rotation.map(r => r.source)), new Set(["ocean", "goth"]));
    assert.notDeepStrictEqual(rotation.map(r => r.source), [...Array(4).fill("ocean"), ...Array(4).fill("goth")]);
});

test("an empty color playlist falls back to the other one", () => {
    const rotation = VP.buildColorRotation({ a: "custom", b: "ocean", combine: "alternate" }, name => name === "custom" ? [] : palettesFor(name));
    assert.ok(rotation.length && rotation.every(r => r.source === "ocean"));
    assert.deepStrictEqual(VP.buildColorRotation({ a: "custom", b: "", combine: "alternate" }, () => []), []);
});

test("app.js wires takeover, dissolve, fade and the bridge", () => {
    const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    for (const hook of ['takeover("preset"', 'takeover("flow")', 'takeover("dice")', 'takeover("history")', 'takeover("scene"', "dissolveFrame(sim)", "getElementById('playlist-bar')", "VisualPlaylists?.init("]) {
        assert.ok(app.includes(hook), hook);
    }
    assert.ok(html.indexOf("js/visual-playlists.js") < html.indexOf("js/app.js"));
    assert.ok(html.includes('id="tab-playlists"') && html.includes('data-tab="tab-playlists"') && html.includes('id="playlist-bar"'));
    // The recorder's 60 s limit is documented, not silently changed.
    assert.ok(fs.readFileSync(path.join(root, "js/exporter.js"), "utf8").includes("this.recordDuration >= 60"));
});

console.log(`Visual playlists: ${passed} tests passed`);
