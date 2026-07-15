// ==========================================================================
// ETERNAL VEIL - STATE SCHEMA REGRESSION TESTING HARNESS
// Tests sanitization, validation, and safe fallback logic for loaded states.
// Run using: node scratch/url_tests.js
// ==========================================================================

const assert = require("assert");
const StateSchema = require("../js/state-schema.js");

// Mock window object for node compatibility if needed (StateSchema is designed to run in node too)
global.window = {};

console.log("--------------------------------------------------");
console.log("🧪 RUNNING STATE SCHEMA VALIDATOR TESTS...");
console.log("--------------------------------------------------");

try {
    // Test Case 1: Null/Malformed inputs
    assert.strictEqual(StateSchema.sanitize(null), null, "Null input should return null fallback");
    assert.strictEqual(StateSchema.sanitize(undefined), null, "Undefined input should return null fallback");
    assert.strictEqual(StateSchema.sanitize("invalid string"), null, "String input should return null fallback");
    console.log("✅ Passed: Malformed root objects fail gracefully.");

    // Test Case 2: Schema version mismatch
    const badVersion = { v: 2, settings: { density: 500 } };
    assert.strictEqual(StateSchema.sanitize(badVersion), null, "Unsupported schema version should return null");
    console.log("✅ Passed: Unsupported schema versions are safely rejected.");

    // Test Case 3: Perfect valid state preservation
    const validState = {
        v: 1,
        settings: {
            speed: 2.2,
            turbulence: 1.5,
            density: 2500,
            flowOrganic: 0.5,
            dissipation: 0.025,
            zoom: 1.8,
            baseSize: 5.0,
            sizeVariation: 2.0,
            stretch: 3.0,
            interaction: 1.2,
            mouseInfluence: 2.0,
            mouseMode: "paint",
            kaleidoscopeEnabled: true,
            kaleidoscopeSegments: 8,
            rotationSpeed: 0.8,
            wobble: 1.1,
            psychedelicMode: true,
            morphingBg: true,
            spinningKaleido: true,
            shockwavesEnabled: false,
            particleShape: "aquatic",
            bilateralEnabled: true,
            asmrEnabled: true
        },
        palette: ["#ff0000", "#00ff00", "#0000ff"],
        backgroundColor: "#112233",
        isSolidMode: true,
        autopilotEnabled: false
    };

    const outValid = StateSchema.sanitize(validState);
    assert.ok(outValid, "Sanitized output should exist");
    assert.strictEqual(outValid.settings.speed, 2.2, "Speed should remain 2.2");
    assert.strictEqual(outValid.settings.density, 2500, "Density should remain 2500");
    assert.strictEqual(outValid.settings.mouseMode, "paint", "Mouse mode should remain paint");
    assert.strictEqual(outValid.settings.particleShape, "aquatic", "Shape should remain aquatic");
    assert.strictEqual(outValid.palette[0], "#ff0000", "Palette colors should remain valid");
    assert.strictEqual(outValid.backgroundColor, "#112233", "Background color should remain valid");
    assert.strictEqual(outValid.isSolidMode, true, "isSolidMode should remain true");
    console.log("✅ Passed: Valid configuration state is fully preserved.");

    // Test Case 4: Security clamping of extreme settings
    const extremeState = {
        v: 1,
        settings: {
            density: 999999,      // Exceeds max 4000
            speed: 55.5,          // Exceeds max 4.0
            turbulence: -12.0,    // Exceeds min 0.0
            zoom: 0.02,           // Exceeds min 0.3
            kaleidoscopeSegments: 99, // Exceeds max 12
        }
    };

    const outExtreme = StateSchema.sanitize(extremeState);
    assert.strictEqual(outExtreme.settings.density, 4000, "Extreme density 999999 should be clamped to 4000");
    assert.strictEqual(outExtreme.settings.speed, 4.0, "Extreme speed 55.5 should be clamped to 4.0");
    assert.strictEqual(outExtreme.settings.turbulence, 0.0, "Negative turbulence should be clamped to 0.0");
    assert.strictEqual(outExtreme.settings.zoom, 0.3, "Tiny zoom 0.02 should be clamped to 0.3");
    assert.strictEqual(outExtreme.settings.kaleidoscopeSegments, 12, "Extreme segments should be clamped to 12");
    assert.strictEqual(outExtreme.clampedWarning, true, "clampedWarning flag should be set");
    console.log("✅ Passed: Extreme setting bounds are correctly clamped.");

    // Test Case 5: Invalid values fall back to defaults
    const corruptState = {
        v: 1,
        settings: {
            density: "Not a number",
            speed: NaN,
            turbulence: Infinity,
            mouseMode: "hacky-hacker-mode",
            particleShape: "oblong-box"
        }
    };

    const outCorrupt = StateSchema.sanitize(corruptState);
    assert.strictEqual(outCorrupt.settings.density, 1200, "Corrupt density string should fall back to 1200 default");
    assert.strictEqual(outCorrupt.settings.speed, 1.0, "NaN speed should fall back to 1.0 default");
    assert.strictEqual(outCorrupt.settings.turbulence, 0.65, "Infinity turbulence should fall back to 0.65 default");
    assert.strictEqual(outCorrupt.settings.mouseMode, "burst", "Invalid mouseMode should fall back to burst default");
    assert.strictEqual(outCorrupt.settings.particleShape, "ellipse", "Invalid shape should fall back to ellipse default");
    console.log("✅ Passed: Invalid data types and invalid enums fall back to defaults safely.");

    // Test Case 6: Palette validation & length constraints
    const corruptPaletteState = {
        v: 1,
        palette: ["#fff", "invalid-color", "#00ff00", "rgba(0,0,0,0)", "#ff33a1", "#f00", "#000", "#111"],
        backgroundColor: "invalid-bg"
    };

    const outPalette = StateSchema.sanitize(corruptPaletteState);
    // Max 6 colors from input list, invalid elements replaced with fallback #6366f1
    assert.strictEqual(outPalette.palette.length, 6, "Palette length must be clamped to 6 max");
    assert.strictEqual(outPalette.palette[0], "#fff", "First color should be valid hex");
    assert.strictEqual(outPalette.palette[1], "#6366f1", "Invalid color element should fall back to default hex");
    assert.strictEqual(outPalette.backgroundColor, "#050507", "Invalid background color should fall back to default");
    console.log("✅ Passed: Color palettes are validated, sanitized, and sized to maximum 6 elements.");

    console.log("\n--------------------------------------------------");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("--------------------------------------------------");
} catch (e) {
    console.error("\n❌ TEST FAILED:", e.message);
    process.exit(1);
}
