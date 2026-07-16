/**
 * ETERNAL VEIL — Color Theory Engine Test Suite
 * 
 * Run: node scratch/color_theory_tests.js
 */

// Mock window/global environment for node environment execution
const mockGlobal = {};
global.window = mockGlobal;

// Load the file under test
require('../js/color-theory.js');

const ColorTheory = mockGlobal.ColorTheory;

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    }
}

console.log("--------------------------------------------------");
console.log("🧪 RUNNING COLOR THEORY ENGINE TESTS...");
console.log("--------------------------------------------------");

// Test 1: Harmony rule outputs
const rules = ['mono', 'analogous', 'complementary', 'triad', 'tetrad'];
rules.forEach(rule => {
    const palette = ColorTheory.generateHarmony(220, 85, 50, rule);
    assert(Array.isArray(palette), `Palette for rule '${rule}' must be an array`);
    assert(palette.length === 5, `Palette for rule '${rule}' must have exactly 5 colors (got ${palette.length})`);
    palette.forEach((color, idx) => {
        assert(color.startsWith('hsl('), `Color ${idx} in rule '${rule}' must be HSL string (got '${color}')`);
    });
    console.log(`✅ Passed: '${rule}' rule returns exactly 5 valid HSL values.`);
});

// Test 2: Angle wrapping and clamping bounds
const clampedMono = ColorTheory.generateHarmony(410, 150, -20, 'mono');
assert(clampedMono.length === 5, "Wrapping hue above 360 and clamping bounds should succeed");
// 410 mod 360 = 50. Let's check first element hsl format
assert(clampedMono[2] === 'hsl(50, 100%, 0%)', `Middle element (base) should wrap hue to 50, clamp Saturation to 100%, Lightness to 0% (got '${clampedMono[2]}')`);
console.log("✅ Passed: Hue wrapping ($410^\\circ \\rightarrow 50^\\circ$) and bounds clamping succeed.");

// Test 3: Standalone HSL to HEX conversions
const hexRed = ColorTheory.hslToHex(0, 100, 50);
assert(hexRed === '#ff0000', `HSL(0, 100%, 50%) should equal #ff0000 (got '${hexRed}')`);

const hexFromStr = ColorTheory.hslToHex('hsl(240, 100%, 50%)');
assert(hexFromStr === '#0000ff', `hsl(240, 100%, 50%) string translation should equal #0000ff (got '${hexFromStr}')`);
console.log("✅ Passed: HSL to HEX conversions match.");

// Test 4: Standalone HEX to HSL conversions
const hslBlue = ColorTheory.hexToHsl('#0000ff');
assert(hslBlue.h === 240 && hslBlue.s === 100 && hslBlue.l === 50, 
    `HEX #0000ff should equal HSL {240, 100, 50} (got {${hslBlue.h}, ${hslBlue.s}, ${hslBlue.l}})`);

const hslShorthand = ColorTheory.hexToHsl('#f00'); // shorthand #ff0000
assert(hslShorthand.h === 0 && hslShorthand.s === 100 && hslShorthand.l === 50, 
    `HEX shorthand #f00 should parse to HSL {0, 100, 50} (got {${hslShorthand.h}, ${hslShorthand.s}, ${hslShorthand.l}})`);
console.log("✅ Passed: HEX to HSL parsing and shorthand expansions match.");

console.log("--------------------------------------------------");
console.log("🎉 ALL COLOR ENGINE TESTS PASSED SUCCESSFULLY!");
console.log("--------------------------------------------------");
