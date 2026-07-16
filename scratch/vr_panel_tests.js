const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/simulation3d-native.js", "utf8");
const sandbox = { console, window: {} };
vm.createContext(sandbox);
vm.runInContext(`${source}\nglobalThis.NativeFlowSimulation3D = NativeFlowSimulation3D;`, sandbox);

const NativeFlowSimulation3D = sandbox.NativeFlowSimulation3D;
const labels = [];
const context = {
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    clearRect() {},
    arc() {},
    fillText(text) { labels.push(text); },
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {}
};

const buttonPattern = /\{ page: "(main|looks)", action: "([^"]+)", x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/g;
const buttons = Array.from(source.matchAll(buttonPattern), match => ({
    page: match[1],
    action: match[2],
    x: Number(match[3]),
    y: Number(match[4]),
    w: Number(match[5]),
    h: Number(match[6])
}));

const panel = Object.create(NativeFlowSimulation3D.prototype);
panel.vrPanelCanvas = { getContext: () => context };
panel.vrPanelTexture = { needsUpdate: false };
panel.vrPanelButtons = buttons;
panel.vrPanelHoverAction = null;
panel.vrPanelPage = "main";
panel.getVRControlState = () => ({
    autopilot: true,
    paused: false,
    size: 3.5,
    speed: 0.75,
    density: 2600,
    palette: ["#14b8a6", "#5eead4", "#7dd3fc"],
    paletteName: "Ocean Glass",
    lighting: "reactive",
    effectName: "Rain Ocean",
    historyCanBack: true,
    historyCanForward: true
});

panel.drawVRPanel();
assert.ok(labels.includes("RANDOM FLOW"), "Main VR page should expose a random-flow action");
assert.ok(labels.includes("< LAST"), "Main VR page should expose history back");
assert.ok(labels.includes("NEXT >"), "Main VR page should expose history forward");
assert.ok(labels.includes("COLORS + EFFECTS  >"), "Main VR page should link to appearance controls");

labels.length = 0;
panel.vrPanelPage = "looks";
panel.drawVRPanel();
assert.ok(labels.includes("RANDOM COLOR"), "Looks page should expose color randomization");
assert.ok(labels.includes("< PALETTE"), "Looks page should expose previous palette");
assert.ok(labels.includes("PALETTE >"), "Looks page should expose next palette");
assert.ok(labels.includes("< EFFECT"), "Looks page should expose previous effect");
assert.ok(labels.includes("EFFECT >"), "Looks page should expose next effect");
assert.ok(labels.includes("LIGHTING  /  REACTIVE"), "Looks page should show the active lighting style");
assert.ok(labels.includes("SEND A GENTLE RIPPLE"), "Looks page should expose an in-world interaction");

let redrawn = false;
panel.drawVRPanel = () => { redrawn = true; };
panel.activateVRControl("pageMain");
assert.strictEqual(panel.vrPanelPage, "main", "VR navigation should return to the main page");
assert.strictEqual(redrawn, true, "VR page navigation should redraw the panel");

console.log("✅ VR panel main/looks pages and controls validated.");
