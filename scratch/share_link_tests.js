"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const StateSchema = require("../js/state-schema.js");

const window = { location: { origin: "https://eternalvoid.io", pathname: "/", hash: "" }, StateSchema };
const testConsole = { ...console, error: () => {} };
const context = {
    window, console: testConsole, Uint8Array,
    btoa: data => Buffer.from(data, "binary").toString("base64"),
    atob: data => Buffer.from(data, "base64").toString("binary"),
    parseColorToHex: value => value
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/url-sync.js"), "utf8"), context);
const sync = window.UrlStateSync;
const settings = {
    speed: 1.23, turbulence: 0.85, density: 2200, flowOrganic: 0.72,
    dissipation: 0.0123, zoom: 1.75, baseSize: 3.5, sizeVariation: 2.4,
    stretch: 1.9, interaction: 0.7, mouseInfluence: 0.5,
    mouseMode: "paint", kaleidoscopeEnabled: true, kaleidoscopeSegments: 8,
    rotationSpeed: 0.32, wobble: 0.45, psychedelicMode: true,
    morphingBg: true, spinningKaleido: false, particleShape: "celticCurrent",
    particleLighting: "pearl", shockwavesEnabled: false,
    bilateralEnabled: false, asmrEnabled: true, binauralMode: "alpha"
};
const sim = { settings, palette: ["#24aaff", "#00ff80", "#fa93d1"],
    backgroundColor: "#000000", isSolidMode: false };
const shortUrl = sync.generateShareUrl(sim, false, { is3DMode: true, style: "dome" });
assert.match(shortUrl, /#scene=[A-Za-z0-9_-]+$/);
assert.ok(shortUrl.length < 150, `Expected compact link, got ${shortUrl.length} characters`);
window.location.hash = shortUrl.slice(shortUrl.indexOf("#"));
const loaded = sync.parseUrlState();
assert.equal(loaded.settings.speed, settings.speed);
assert.equal(loaded.settings.dissipation, settings.dissipation);
assert.equal(loaded.settings.particleShape, settings.particleShape);
assert.equal(loaded.settings.mouseMode, settings.mouseMode);
assert.equal(loaded.settings.shockwavesEnabled, false);
assert.equal(loaded.settings.asmrEnabled, true);
assert.equal(loaded.settings.kaleidoscopeSegments, 8);
assert.equal(loaded.presentation.is3DMode, true);
assert.equal(loaded.presentation.style, "dome");
assert.equal(loaded.palette.join(","), sim.palette.join(","));
for (const shape of sync.shapes) {
    settings.particleShape = shape;
    const url = sync.generateShareUrl(sim, false);
    window.location.hash = url.slice(url.indexOf("#"));
    assert.equal(sync.parseUrlState().settings.particleShape, shape);
}
settings.particleShape = "celticCurrent";
// Axes Rings ride in spare flag bits: same link length, and links without them read as 1 ring.
assert.equal(loaded.settings.kaleidoAxesRings, 1);
settings.spinningKaleido = true;
for (const rings of [1, 2, 3, 4, 5]) {
    settings.kaleidoAxesRings = rings;
    const url = sync.generateShareUrl(sim, false, { is3DMode: true, style: "dome" });
    assert.equal(url.length, shortUrl.length, "rings do not lengthen the link");
    window.location.hash = url.slice(url.indexOf("#"));
    const back = sync.parseUrlState();
    assert.equal(back.settings.kaleidoAxesRings, rings);
    assert.equal(back.settings.spinningKaleido, true);
    assert.equal(back.presentation.style, "dome", "neighbouring flag bits untouched");
}
// Ring folds ride in an optional 7-byte trailer, only when they are not the default.
settings.kaleidoAxesRings = 4;
for (const mode of ["growing", "doubling", "alternating", "custom"]) {
    Object.assign(settings, { kaleidoRingFolds: mode, kaleidoRingStep: 3, kaleidoRingCustom: [5, 9, 13, 17, 21] });
    const url = sync.generateShareUrl(sim, false, { is3DMode: true, style: "dome" });
    assert(url.length > shortUrl.length && url.length < shortUrl.length + 12, "small trailer");
    window.location.hash = url.slice(url.indexOf("#"));
    const back = sync.parseUrlState().settings;
    assert.deepEqual([back.kaleidoRingFolds, back.kaleidoRingStep, back.kaleidoRingCustom, back.kaleidoAxesRings],
        [mode, 3, [5, 9, 13, 17, 21], 4], `${mode} folds round trip`);
}
settings.kaleidoRingFolds = "same";
assert.equal(sync.generateShareUrl(sim, false, { is3DMode: true, style: "dome" }).length, shortUrl.length, "default folds: no trailer");
window.location.hash = shortUrl.slice(shortUrl.indexOf("#"));
assert.equal(sync.parseUrlState().settings.kaleidoRingFolds, "same", "links without the trailer read as same folds");
// Particle shape rides after the folds in the trailer (13 bytes), with or without custom folds.
for (const folds of ["same", "doubling"]) {
    Object.assign(settings, { kaleidoRingFolds: folds, particleSprite: "petal", spriteTaper: 0.35, spritePoints: 7, spriteGlow: 0.8, spriteCore: 0.1, spriteSpin: -0.6 });
    const url = sync.generateShareUrl(sim, false, { is3DMode: true, style: "dome" });
    window.location.hash = url.slice(url.indexOf("#"));
    const back = sync.parseUrlState().settings;
    assert.deepEqual([back.particleSprite, back.spriteTaper, back.spritePoints, back.spriteGlow, back.spriteCore, back.spriteSpin, back.kaleidoRingFolds],
        ["petal", 0.35, 7, 0.8, 0.1, -0.6, folds], `particle shape round trip (${folds} folds)`);
}
settings.particleSprite = "auto";
settings.kaleidoRingFolds = "same";
assert.equal(sync.generateShareUrl(sim, false, { is3DMode: true, style: "dome" }).length, shortUrl.length, "scene-default shape: no trailer");
window.location.hash = shortUrl.slice(shortUrl.indexOf("#"));
assert.equal(sync.parseUrlState().settings.particleSprite, "auto", "links without it keep the scene's own look");
for (const k of ["particleSprite", "spriteTaper", "spritePoints", "spriteGlow", "spriteCore", "spriteSpin"]) delete settings[k];
delete settings.kaleidoRingFolds; delete settings.kaleidoRingStep; delete settings.kaleidoRingCustom;
delete settings.kaleidoAxesRings;
settings.spinningKaleido = false;

const legacy = {
    v: 1, s: 1.23, t: 0.85, d: 2200, o: 0.72, dp: 0.0123, z: 1.75,
    sz: 3.5, sv: 2.4, st: 1.9, in: 0.7, mi: 0.5, mm: "paint",
    ke: 1, ks: 8, rs: 0.32, wb: 0.45, pm: 1, mb: 1, sk: 0,
    ps: "celticCurrent", pl: "pearl", se: 0, be: 0, ae: 1, bm: "alpha",
    p: sim.palette, bg: sim.backgroundColor, sm: 0, ap: 0, vm: 1, vs: "dome"
};
window.location.hash = `#seed=${Buffer.from(JSON.stringify(legacy)).toString("base64")}`;
const oldLoaded = sync.parseUrlState();
assert.equal(oldLoaded.settings.particleShape, settings.particleShape);
assert.equal(oldLoaded.settings.speed, settings.speed);
assert.equal(oldLoaded.presentation.style, "dome");
assert.ok(shortUrl.length < window.location.origin.length + window.location.pathname.length + window.location.hash.length * 0.4,
    "Compact URL should be less than 40% of legacy length");

for (const hash of ["#scene=bad", "#scene=!!!", "#scene=" + "A".repeat(400), "#scene=", "#seed=bad"] ) {
    window.location.hash = hash;
    assert.equal(sync.parseUrlState(), null, `Malformed link should fail safely: ${hash.slice(0, 20)}`);
}
console.log(`Share links: compact round trip, legacy compatibility, malformed input; ${shortUrl.length} characters.`);
