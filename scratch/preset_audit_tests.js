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

assert(presets.breathSanctuary.speed === 0.15, "Breath Sanctuary base speed is 50% of the previous 0.30");
assert(presets.breathSanctuary.turbulence === 0.03, "Breath Sanctuary turbulence is reduced");
assert(presets.breathSanctuary.rotationSpeed === 0.025, "Breath Sanctuary rotation speed is unchanged");
assert(presets.breathSanctuary.particleShape === "lotus", "Breath Sanctuary still uses lotus");

assert(presets.ethereal.speed === 0.20, "Ethereal Aura speed is 0.20");
assert(presets.ethereal.size === 2.5, "Ethereal Aura size is 2.5");
assert(presets.ethereal.sizeVar === 2.5, "Ethereal Aura size variation is 2.5");
assert(presets.ethereal.kaleidoscopeEnabled === true, "Ethereal Aura defaults to kaleidoscope");
assert(presets.ethereal.kaleidoscopeSegments === 6, "Ethereal Aura uses 6 mandala segments");

assert(presets.cosmic.particleShape === "nebulaSpark", "Nebula Spark uses nebulaSpark");
assert(presets.cosmic.speed < 1.25, "Nebula Spark is slower than the previous baseline");

assert(presets.supernova.particleShape === "solarFlare", "Solar Flare uses solarFlare");
assert(presets.supernova.speed < 2.20, "Solar Flare is slower than the previous baseline");
assert(presets.supernova.density < 1800, "Solar Flare field is thinned");

assert(presets.vortex.particleShape === "violetUndertow", "Violet Undertow uses violetUndertow");
assert(presets.vortex.speed < 1.60, "Violet Undertow is slower than the previous baseline");

assert(presets.strings.density === 3500, "Cosmic Strings density is increased");
assert(presets.strings.size === 0.8, "Cosmic Strings particles are much smaller");
assert(presets.strings.stretch === 6.5, "Cosmic Strings are longer");
assert(presets.strings.dissipation === 0.002, "Cosmic Strings dissipate less");
assert(presets.strings.kaleidoscopeEnabled === true, "Cosmic Strings defaults to kaleidoscope");
assert(presets.strings.kaleidoscopeSegments === 8, "Cosmic Strings uses 8 mirrors");

assert(presets.hypno.particleShape === "pendulumSpiral", "Chaotic Spiral still uses pendulumSpiral geometry id");
assert(presets.hypno.name === "Chaotic Spiral", "Hypno preset is renamed Chaotic Spiral");
assert(presets.hypno.speed === 0.32, "Chaotic Spiral has enough speed for zigzag wanderers");
assert(presets.hypno.turbulence === 0.16, "Chaotic Spiral turbulence is back for zigzag motion");
assert(presets.hypno.miniSpiralCount === 6, "Chaotic Spiral defaults to 6 mini spirals");
assert(presets.hypno.spiralExtent === 0.90, "Chaotic Spiral extent is set to fill the screen");
assert(presets.supernova.eclipseCount === 66, "Solar Flare eclipse count is a flowable setting");

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
