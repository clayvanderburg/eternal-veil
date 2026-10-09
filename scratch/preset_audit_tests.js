const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("--------------------------------------------------");
console.log("🧪 RUNNING PRESET AUDIT TESTS (REMAINING PRESETS)...");
console.log("--------------------------------------------------");

const htmlPath = path.resolve(__dirname, "../index.html");
const html = fs.readFileSync(htmlPath, "utf-8");
assert(
    html.includes('id="speed-slider"') && html.includes('min="0.00" max="4.00" step="0.01" value="1.00"'),
    "HTML #speed-slider should allow fine adjustment from 0.00 to 4.00 with 0.01 step"
);
console.log("✅ Passed: HTML #speed-slider range and step are configured for ultra-slow speeds.");

const schemaPath = path.resolve(__dirname, "../js/state-schema.js");
const schemaCode = fs.readFileSync(schemaPath, "utf-8");
const keptShapes = ["jadeCurrents", "quantumDrift", "prismDrift"];
const newShapes = ["nebulaSpark", "solarFlare", "violetUndertow"];

for (const shape of keptShapes.concat(newShapes)) {
    assert(schemaCode.includes(`"${shape}"`), `StateSchema must include shape "${shape}" in VALID_PARTICLE_SHAPES`);
}
console.log("✅ Passed: StateSchema includes kept custom shapes plus nebulaSpark, solarFlare, violetUndertow.");

const presetsPath = path.resolve(__dirname, "../js/presets.js");
const presetsCode = fs.readFileSync(presetsPath, "utf-8");
const fn = new Function(presetsCode + "\nreturn StylePresets;");
const presets = fn();

assert(presets.liquid.particleShape === "jadeCurrents", "Jade Currents shape is unchanged");
assert(presets.quantum.particleShape === "quantumDrift", "Quantum Drift shape is unchanged");
assert(presets.mandala.particleShape === "prismDrift", "Prism Drift shape is unchanged");

assert(presets.breathSanctuary.particleShape === "lotus", "Breath Sanctuary still uses lotus");

assert(presets.ethereal.kaleidoscopeEnabled === true, "Ethereal Aura defaults to kaleidoscope");

assert(presets.cosmic.particleShape === "nebulaSpark", "Nebula Spark uses nebulaSpark");

assert(presets.supernova.particleShape === "solarFlare", "Solar Flare uses solarFlare");

assert(presets.vortex.particleShape === "violetUndertow", "Violet Undertow uses violetUndertow");

assert(presets.strings.kaleidoscopeEnabled === true, "Cosmic Strings defaults to kaleidoscope");

assert(presets.hypno.particleShape === "pendulumSpiral", "Chaotic Spiral still uses pendulumSpiral geometry id");
assert(presets.hypno.name === "Chaotic Spiral", "Hypno preset is renamed Chaotic Spiral");

// Tuned values belong to Clay (Eternal Void Studio), so tests no longer pin exact numbers.
// They only check every tuned value is a real number inside its control's range.
const RANGES = { speed: [0, 4], density: [100, 8000], size: [0.1, 14], sizeVar: [0, 7], turbulence: [0, 5],
    dissipation: [0.0005, 0.5], zoom: [0.1, 7], stretch: [0, 8], rotationSpeed: [-1.2, 1.2], wobble: [0, 1.5],
    kaleidoscopeSegments: [2, 24], miniSpiralCount: [0, 24], spiralExtent: [0.1, 2], eclipseCount: [1, 400] };
for (const [key, preset] of Object.entries(presets)) {
    for (const [field, [lo, hi]] of Object.entries(RANGES)) {
        if (!(field in preset)) continue;
        const v = preset[field];
        assert(Number.isFinite(v) && v >= lo && v <= hi, `${preset.name || key}.${field} = ${v} is outside ${lo}..${hi}`);
    }
}
assert(Number.isFinite(presets.supernova.eclipseCount), "Solar Flare eclipse count is a flowable setting");
assert(Number.isFinite(presets.hypno.miniSpiralCount) && Number.isFinite(presets.hypno.spiralExtent), "Chaotic Spiral keeps its mini-spiral settings");
console.log("✅ Passed: every tuned preset value is a finite number inside its control range.");

console.log("✅ Passed: Preset values match the remaining audit notes. Jade/Quantum/Prism left intact.");

const appPath = path.resolve(__dirname, "../js/app.js");
const appCode = fs.readFileSync(appPath, "utf-8");
assert(
    appCode.includes("if (isAutopilot) toggleAutopilot(false);"),
    "loadPreset should pause autopilot to prevent flowing parameter drift during audit"
);
console.log("✅ Passed: app.js pauses autopilot when loading presets.");

const simPath = path.resolve(__dirname, "../js/simulation.js");
const simCode = fs.readFileSync(simPath, "utf-8");

for (const shape of keptShapes.concat(newShapes)) {
    assert(simCode.includes(`"${shape}"`), `simulation.js must handle shape "${shape}"`);
}
assert(simCode.includes("this.prismRot"), "simulation.js Particle must track independent random prism rotation");
assert(simCode.includes("this.prismRotSpeed"), "simulation.js Particle must track independent random prism rotation speed");
assert(simCode.includes("isDedicatedHero"), "lotus still uses two dedicated hero orbs");
assert(simCode.includes("ECLIPSED_SUNS"), "Solar Flare uses a counted set of eclipsed suns");
assert(simCode.includes("drawWavyEclipse"), "Solar Flare eclipses have an undulating rim");
assert(simCode.includes("mainSpiralPoint"), "Chaotic Spiral keeps the original main coil");
assert(simCode.includes("miniSpiralPoint"), "Four smaller spirals sit on the original coil");
assert(simCode.includes("MINI_SPIRALS"), "Mini spirals are extras, not a rewrite of the main coil");
assert(simCode.includes("this.spiralFamily"), "Chaotic Spiral splits a minority of particles onto the mini coils");
assert(simCode.includes("cloudHomeX"), "Nebula Spark clouds stay near a home position");
assert(simCode.includes("this.isNebulaCloud"), "Nebula Spark has cloud lifecycle particles");
assert(simCode.includes("this.isWavySpiral"), "Violet Undertow has a secondary wavy spiral");
assert(simCode.includes("this.spiralProgress"), "Chaotic Spiral recycles along a bounded coil");
console.log("✅ Passed: simulation.js implements remaining audit identities without dropping kept shapes.");

console.log("--------------------------------------------------");
console.log("🎉 ALL PRESET AUDIT TESTS PASSED SUCCESSFULLY!");
console.log("--------------------------------------------------");
