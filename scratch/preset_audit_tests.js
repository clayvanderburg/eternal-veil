const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("--------------------------------------------------");
console.log("🧪 RUNNING PRESET AUDIT OVERHAUL TESTS...");
console.log("--------------------------------------------------");

// 1. Check HTML speed slider range and step
const htmlPath = path.resolve(__dirname, "../index.html");
const html = fs.readFileSync(htmlPath, "utf-8");
assert(
    html.includes('id="speed-slider"') && html.includes('min="0.00" max="4.00" step="0.01" value="1.00"'),
    "HTML #speed-slider should allow fine adjustment from 0.00 to 4.00 with 0.01 step"
);
console.log("✅ Passed: HTML #speed-slider range and step are configured for ultra-slow speeds.");

// 2. Check StateSchema valid shapes
const schemaPath = path.resolve(__dirname, "../js/state-schema.js");
const schemaCode = fs.readFileSync(schemaPath, "utf-8");
const expectedShapes = [
    "nebulaSpark", "solarFlare", "jadeCurrents", "quantumDrift", "violetUndertow", "prismDrift", "cosmicStrings"
];
for (const shape of expectedShapes) {
    assert(schemaCode.includes(`"${shape}"`), `StateSchema must include "${shape}" in VALID_PARTICLE_SHAPES`);
    assert(html.includes(`value="${shape}"`), `index.html particle shape select must include option for "${shape}"`);
}
console.log("✅ Passed: All 7 new particle shapes are present in StateSchema and index.html.");

// 3. Check PRESETS configurations
const presetsPath = path.resolve(__dirname, "../js/presets.js");
const presetsCode = fs.readFileSync(presetsPath, "utf-8");
const fn = new Function(presetsCode + "\nreturn StylePresets;");
const presets = fn();

assert(presets.breathSanctuary, "breathSanctuary preset exists");
assert(presets.breathSanctuary.speed <= 0.15, "breathSanctuary speed is calibrated to slow meditative base (<= 0.15)");
assert(presets.breathSanctuary.particleShape === "lotus", "breathSanctuary shape is lotus");

assert(presets.ethereal, "ethereal preset exists");
assert(presets.ethereal.speed <= 0.20, "ethereal speed is calibrated slow (<= 0.20)");
assert(presets.ethereal.kaleidoscopeEnabled === true, "ethereal has kaleidoscope enabled");
assert(presets.ethereal.kaleidoscopeSegments === 6, "ethereal has 6 kaleidoscope segments");

assert(presets.cosmic, "cosmic (Nebula Spark) preset exists");
assert(presets.cosmic.particleShape === "nebulaSpark", "cosmic particleShape is nebulaSpark");

assert(presets.supernova, "supernova (Solar Flare) preset exists");
assert(presets.supernova.particleShape === "solarFlare", "supernova particleShape is solarFlare");

assert(presets.liquid, "liquid (Jade Currents) preset exists");
assert(presets.liquid.particleShape === "jadeCurrents", "liquid particleShape is jadeCurrents");

assert(presets.quantum, "quantum (Quantum Drift) preset exists");
assert(presets.quantum.particleShape === "quantumDrift", "quantum particleShape is quantumDrift");

assert(presets.vortex, "vortex (Violet Undertow) preset exists");
assert(presets.vortex.particleShape === "violetUndertow", "vortex particleShape is violetUndertow");

assert(presets.mandala, "mandala (Prism Drift) preset exists");
assert(presets.mandala.particleShape === "prismDrift", "mandala particleShape is prismDrift");

assert(presets.strings, "strings (Cosmic Strings) preset exists");
assert(presets.strings.particleShape === "cosmicStrings", "strings particleShape is cosmicStrings");
assert(presets.strings.kaleidoscopeEnabled === true, "strings has kaleidoscope enabled");
assert(presets.strings.kaleidoscopeSegments === 8, "strings has 8-fold kaleidoscope symmetry");

assert(presets.hypno, "hypno (Hypnotic Spiral) preset exists");
assert(presets.hypno.particleShape === "pendulumSpiral", "hypno particleShape is pendulumSpiral");
assert(presets.hypno.speed <= 0.25, "hypno speed is calibrated calm (<= 0.25)");

console.log("✅ Passed: All 10 audited presets have distinct, verified identities and calibrated speeds.");

// 4. Check app.js pauses autopilot on loadPreset
const appPath = path.resolve(__dirname, "../js/app.js");
const appCode = fs.readFileSync(appPath, "utf-8");
assert(
    appCode.includes("if (isAutopilot) toggleAutopilot(false);"),
    "loadPreset should pause autopilot to prevent flowing parameter drift during audit"
);
console.log("✅ Passed: app.js pauses autopilot when loading presets.");

// 5. Check simulation.js authored shapes and bounded spiral
const simPath = path.resolve(__dirname, "../js/simulation.js");
const simCode = fs.readFileSync(simPath, "utf-8");
for (const shape of expectedShapes) {
    assert(simCode.includes(`"${shape}"`), `simulation.js must handle shape "${shape}"`);
}
assert(
    simCode.includes("isHeroOrb = (this.index === 0 || this.index === 1)"),
    "simulation.js Particle must track dedicated hero orbs"
);
assert(
    simCode.includes("minR * Math.pow(maxR / minR, this.spiralProgress)"),
    "simulation.js pendulumSpiral must use strictly bounded logarithmic radius"
);
console.log("✅ Passed: simulation.js implements dedicated hero orbs and bounded spiral dynamics.");

console.log("--------------------------------------------------");
console.log("🎉 ALL PRESET AUDIT TESTS PASSED SUCCESSFULLY!");
console.log("--------------------------------------------------");
