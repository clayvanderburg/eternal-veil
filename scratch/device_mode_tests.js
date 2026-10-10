"use strict";
// Device mode: TV/phone/tablet/desktop detection, ?device= override, TV pixel
// ratio cap, and the Back button closing the topmost layer before exiting.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(path.resolve(__dirname, "../js/device-mode.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

function boot({ ua, url = "https://eternalvoid.io/", coarse = false, screenW = 1920, body = "", dpr = 2 }) {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${body}</body></html>`, {
        url, runScripts: "outside-only", pretendToBeVisual: true
    });
    const w = dom.window;
    Object.defineProperty(w.navigator, "userAgent", { value: ua });
    w.Element.prototype.scrollIntoView = () => {}; // jsdom has no layout
    w.matchMedia = q => ({ matches: coarse && q.includes("coarse"), addEventListener() {} });
    Object.defineProperty(w.screen, "width", { value: screenW });
    Object.defineProperty(w.screen, "height", { value: Math.round(screenW * 0.5625) });
    Object.defineProperty(w, "devicePixelRatio", { value: dpr, configurable: true });
    w.eval(source);
    return w;
}

const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";
const FIRE_SILK = "Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633) AppleWebKit/537.36 Silk/120.3 Chrome/120.0 Mobile Safari/537.36";
const SHELL = "Mozilla/5.0 (Linux; Android 11; AFTKRT; wv) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 EternalVoidTV/1.0";
const PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36";

// Detection
let w = boot({ ua: DESKTOP });
assert.equal(w.VoidDevice.type, "desktop");
assert.equal(w.document.documentElement.dataset.device, "desktop");
assert.equal(w.devicePixelRatio, 2, "desktop keeps its pixel ratio");

w = boot({ ua: FIRE_SILK });
assert.equal(w.VoidDevice.type, "tv", "Fire TV browser (AFT model code) is a TV");
assert.equal(w.VoidDevice.isShell, false);

w = boot({ ua: SHELL });
assert.equal(w.VoidDevice.type, "tv");
assert.equal(w.VoidDevice.isShell, true);
assert.equal(w.VoidDevice.shellVersion, "1.0");
assert.equal(w.document.documentElement.dataset.shell, "tv");

assert.equal(boot({ ua: PHONE, coarse: true, screenW: 412 }).VoidDevice.type, "phone");
assert.equal(boot({ ua: PHONE, coarse: true, screenW: 1280 }).VoidDevice.type, "tablet");

// Override sticks until ?device=auto
w = boot({ ua: DESKTOP, url: "https://eternalvoid.io/?device=tv" });
assert.equal(w.VoidDevice.type, "tv");
assert.equal(w.localStorage.getItem("voidDeviceOverride"), "tv");
assert.equal(boot({ ua: DESKTOP, url: "https://eternalvoid.io/?device=bogus" }).VoidDevice.type, "desktop");

// Back button: closes the topmost layer, then hides controls, then lets the app exit.
w = boot({
    ua: SHELL,
    body: `
        <header id="hud"></header>
        <div class="modal-overlay" id="keyboard-modal"></div>
        <aside class="control-panel" id="control-panel"></aside>
        <button id="menu-toggle-btn"></button>
        <button id="hide-controls-btn"></button>`
});
const doc = w.document;
doc.getElementById("menu-toggle-btn").onclick = () => doc.getElementById("control-panel").classList.add("panel-collapsed");
doc.getElementById("hide-controls-btn").onclick = () => doc.getElementById("hud").classList.add("ui-faded");
assert.equal(w.VoidDevice.handleBack(), true);
assert.ok(doc.getElementById("keyboard-modal").classList.contains("hidden"), "1st Back closes the open modal");
assert.equal(w.VoidDevice.handleBack(), true);
assert.ok(doc.getElementById("control-panel").classList.contains("panel-collapsed"), "2nd Back closes the panel");
assert.equal(w.VoidDevice.handleBack(), true);
assert.ok(doc.getElementById("hud").classList.contains("ui-faded"), "3rd Back hides the controls");
assert.equal(w.VoidDevice.handleBack(), false, "4th Back has nothing left: the app may exit");

// Remote shortcuts reuse app.js keys
const seen = [];
w.addEventListener("keydown", e => seen.push(e.key));
w.VoidDevice.remote("playpause");
w.VoidDevice.remote("next");
w.VoidDevice.remote("menu");
assert.deepEqual(seen, [" ", "g", "m"]);
assert.equal(w.VoidDevice.remote("nope"), false);

// Quality governor: TV only, sharpness first, per-scene memory; frame pacing.
function fakeSim(shape = "ellipse") {
    return { particleScale: 1, dpr: 2, settings: { particleShape: shape },
        setParticleScale(v) { this.particleScale = v; },
        resize(w, h, d) { this.dpr = d; } };
}
let sim = fakeSim();
boot({ ua: DESKTOP }).VoidDevice.onFps(5, sim);
assert.equal(sim.particleScale, 1, "desktop never touches the particle budget");
assert.equal(boot({ ua: DESKTOP }).VoidDevice.skipFrame(), false, "desktop draws every frame");
assert.equal(boot({ ua: DESKTOP }).VoidDevice.flowSkip, undefined, "desktop Flow skips nothing");

w = boot({ ua: SHELL });
assert.equal(w.devicePixelRatio, 2, "the device ratio is left alone; the governor sets the canvas");
sim = fakeSim();
w.VoidDevice.onFps(30, sim);
assert.deepEqual({ ...w.VoidDevice.quality }, { level: 4, particles: 0.3, resolution: 2, targetFps: 30 },
    "TV starts sharp (native resolution) with 30% particles, aiming for every 2nd refresh");
for (let i = 0; i < 3; i++) w.VoidDevice.onFps(22, sim);
assert.deepEqual([sim.particleScale, sim.dpr], [0.22, 2], "slow: particles go first, resolution stays native");
for (let i = 0; i < 3; i++) w.VoidDevice.onFps(10, sim);
assert.deepEqual([sim.particleScale, sim.dpr], [0.22, 1.5], "very slow: two steps, now resolution");
for (let i = 0; i < 16; i++) w.VoidDevice.onFps(30, sim);
assert.equal(w.VoidDevice.quality.level, 6, "8 s on target: try one step up");
for (let i = 0; i < 2; i++) w.VoidDevice.onFps(20, sim);
assert.equal(w.VoidDevice.quality.level, 7, "the step up didn't hold: back off");

sim.settings.particleShape = "mandala";            // Flow changes scene
w.VoidDevice.onFps(30, sim);
for (let i = 0; i < 16; i++) w.VoidDevice.onFps(30, sim);
assert.equal(w.VoidDevice.quality.level, 6, "a new scene gets a fresh, quick probe");
sim.settings.particleShape = "ellipse";            // ...and back
w.VoidDevice.onFps(30, sim);
assert.equal(w.VoidDevice.quality.level, 7, "returning to a scene starts at the level it held");
w.VoidDevice.governor = false;
for (let i = 0; i < 6; i++) w.VoidDevice.onFps(5, sim);
assert.equal(w.VoidDevice.quality.level, 7, "governor = false holds the level");
assert.ok(w.VoidDevice.flowSkip.has("mandelbrotDive") && w.VoidDevice.flowSkip.size === 7 && w.VoidDevice.maxKaleidoRings === 2, "TV Flow limits");

// Wiring: loaded in <head> before the simulation, TV stylesheet linked.
const head = html.slice(0, html.indexOf("</head>"));
assert.ok(head.includes('src="js/device-mode.js'), "device-mode.js loads in <head>");
assert.ok(head.indexOf("device-mode.js") < html.indexOf("js/simulation.js"), "before the simulation reads devicePixelRatio");
assert.ok(head.includes('href="tv.css'), "tv.css linked");

console.log("PASS: device mode (desktop/phone/tablet/TV/Fire TV app detection, override, Back order, remote keys, frame pacing + quality governor with scene memory, TV Flow limits, wiring).");
