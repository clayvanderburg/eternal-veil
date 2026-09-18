const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("--------------------------------------------------");
console.log("🧪 RUNNING PRESET AUDIT TESTS (POST-ROLLBACK)...");
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
const keptShapes = ["jadeCurrents", "quantumDrift", "prismDrift"];
const removedShapes = ["nebulaSpark", "solarFlare", "violetUndertow"];

for (const shape of keptShapes) {
    assert(schemaCode.includes(`"${shape}"`), `StateSchema must include kept shape "${shape}" in VALID_PARTICLE_SHAPES`);
}
for (const shape of removedShapes) {
    assert(!schemaCode.includes(`"${shape}"`), `StateSchema must NOT include removed shape "${shape}"`);
}
console.log("✅ Passed: StateSchema particle shapes correctly contain only kept custom shapes.");

// 3. Check PRESETS configurations
const presetsPath = path.resolve(__dirname, "../js/presets.js");
const presetsCode = fs.readFileSync(presetsPath, "utf-8");
const fn = new Function(presetsCode + "\nreturn StylePresets;");
const presets = fn();

// Kept presets:
assert(presets.liquid, "liquid (Jade Currents) preset exists");
assert(presets.liquid.particleShape === "jadeCurrents", "liquid particleShape is jadeCurrents");

assert(presets.quantum, "quantum (Quantum Drift) preset exists");
assert(presets.quantum.particleShape === "quantumDrift", "quantum particleShape is quantumDrift");

assert(presets.mandala, "mandala (Prism Drift) preset exists");
assert(presets.mandala.particleShape === "prismDrift", "mandala particleShape is prismDrift");

// Rolled back presets:
assert(presets.breathSanctuary, "breathSanctuary preset exists");
assert(presets.breathSanctuary.speed === 0.30, "breathSanctuary speed is restored to baseline 0.30");
assert(presets.breathSanctuary.particleShape === "lotus", "breathSanctuary shape is lotus");

assert(presets.ethereal, "ethereal preset exists");
assert(presets.ethereal.speed === 0.85, "ethereal speed is restored to baseline 0.85");
assert(!presets.ethereal.kaleidoscopeEnabled, "ethereal kaleidoscope is restored to false/undefined");

assert(presets.cosmic, "cosmic (Nebula Spark) preset exists");
assert(presets.cosmic.speed === 1.25, "cosmic speed is restored to baseline 1.25");
assert(!presets.cosmic.particleShape || presets.cosmic.particleShape === "ellipse", "cosmic particleShape is restored to baseline");

assert(presets.supernova, "supernova (Solar Flare) preset exists");
assert(presets.supernova.speed === 2.20, "supernova speed is restored to baseline 2.20");
assert(!presets.supernova.particleShape || presets.supernova.particleShape === "ellipse", "supernova particleShape is restored to baseline");

assert(presets.vortex, "vortex (Violet Undertow) preset exists");
assert(presets.vortex.speed === 1.60, "vortex speed is restored to baseline 1.60");
assert(!presets.vortex.particleShape || presets.vortex.particleShape === "tightTailVortex", "vortex particleShape is restored to baseline");

assert(presets.strings, "strings (Cosmic Strings) preset exists");
assert(presets.strings.speed === 2.50, "strings speed is restored to baseline 2.50");
assert(!presets.strings.particleShape || presets.strings.particleShape === "spiral", "strings particleShape is restored to baseline");

assert(presets.hypno, "hypno (Hypnotic Spiral) preset exists");
assert(presets.hypno.particleShape === "pendulumSpiral", "hypno particleShape is restored to pendulumSpiral");
assert(presets.hypno.speed === 0.42, "hypno speed is restored to baseline 0.42");

console.log("✅ Passed: Presets verified - kept Jade Currents, Quantum Drift, Prism Drift; rolled back others.");

// 4. Check app.js pauses autopilot on loadPreset
const appPath = path.resolve(__dirname, "../js/app.js");
const appCode = fs.readFileSync(appPath, "utf-8");
assert(
    appCode.includes("if (isAutopilot) toggleAutopilot(false);"),
    "loadPreset should pause autopilot to prevent flowing parameter drift during audit"
);
console.log("✅ Passed: app.js pauses autopilot when loading presets.");

// 5. Check simulation.js authored shapes and independent prism rotation
const simPath = path.resolve(__dirname, "../js/simulation.js");
const simCode = fs.readFileSync(simPath, "utf-8");

for (const shape of keptShapes) {
    assert(simCode.includes(`"${shape}"`), `simulation.js must handle shape "${shape}"`);
}
for (const shape of removedShapes) {
    assert(!simCode.includes(`"${shape}"`), `simulation.js must NOT handle removed shape "${shape}"`);
}
assert(
    simCode.includes("this.prismRot"),
    "simulation.js Particle must track independent random prism rotation"
);
assert(
    simCode.includes("this.prismRotSpeed"),
    "simulation.js Particle must track independent random prism rotation speed"
);
console.log("✅ Passed: simulation.js correctly handles kept shapes, independent prism rotation, and removes rolled back shapes.");

console.log("--------------------------------------------------");
console.log("🎉 ALL PRESET AUDIT ROLLBACK TESTS PASSED SUCCESSFULLY!");
console.log("--------------------------------------------------");
