/**
 * ETERNAL VEIL — Color Cycles & Playlists Unit Tests
 */

const assert = require('assert');

// Simple browser mock environment for Node
global.window = {};
global.localStorage = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        this.store[key] = String(value);
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    }
};

// Load color cycles script
require('../js/color-cycles.js');
const ColorCycles = global.window.ColorCycles;

console.log('--------------------------------------------------');
console.log('🧪 RUNNING COLOR PLAYLISTS ENGINE TESTS...');
console.log('--------------------------------------------------');

// 1. Verify all theme cycles exist and contain valid palette arrays
const expectedThemes = ['cyberpunk', 'seasons', 'candy', 'goth', 'ocean', 'chakra'];
expectedThemes.forEach(theme => {
    const playlists = ColorCycles.playlists[theme];
    assert.ok(playlists, `Theme "${theme}" should be defined`);
    assert.ok(Array.isArray(playlists), `Theme "${theme}" playlists should be an array`);
    assert.ok(playlists.length >= 3, `Theme "${theme}" should have at least 3 distinct palettes`);
    
    playlists.forEach((palette, pIdx) => {
        assert.ok(Array.isArray(palette), `Theme "${theme}" palette ${pIdx} should be an array`);
        assert.strictEqual(palette.length, 5, `Theme "${theme}" palette ${pIdx} should contain exactly 5 colors`);
        palette.forEach((color, cIdx) => {
            assert.ok(
                color.startsWith('#') || color.startsWith('hsl'),
                `Color "${color}" in theme "${theme}" palette ${pIdx} color ${cIdx} should be hex or hsl`
            );
        });
    });
    console.log(`✅ Passed: Theme "${theme}" contains correct palettes and formats.`);
});

// 2. Test getNextPalette logic for predefined themes
const cyberpunkPalettes = ColorCycles.playlists.cyberpunk;
const activePalette1 = ColorCycles.getNextPalette('cyberpunk', []);
assert.ok(activePalette1, 'getNextPalette with empty current should return a palette');
assert.ok(cyberpunkPalettes.some(p => p.join(',') === activePalette1.join(',')), 'Returned palette must match one of the defined cyberpunk palettes');

// Pick a palette that differs from the current active one
const activePalette2 = ColorCycles.getNextPalette('cyberpunk', activePalette1);
assert.notDeepStrictEqual(activePalette1, activePalette2, 'getNextPalette should try to return a different palette if possible');
console.log('✅ Passed: getNextPalette selects distinct palettes from the theme group.');

// 3. Test getNextPalette fallback for random theme
const randomResult = ColorCycles.getNextPalette('random', []);
assert.strictEqual(randomResult, null, 'getNextPalette("random") should return null to delegate fallback to main app engine');
console.log('✅ Passed: getNextPalette("random") returns null fallback.');

// 4. Test custom swatches looping
// Test when library is empty
const customEmpty = ColorCycles.getNextPalette('custom', []);
assert.strictEqual(customEmpty, null, 'custom loop with empty library should fall back to null');

// Seed library mock
const mockCustomLibrary = [
    { id: '1', name: 'Custom Red', colors: ['#ff0000', '#ee0000', '#dd0000', '#cc0000', '#bb0000'] },
    { id: '2', name: 'Custom Green', colors: ['#00ff00', '#00ee00', '#00dd00', '#00cc00', '#00bb00'] },
    { id: '3', name: 'Custom Blue', colors: ['#0000ff', '#0000ee', '#0000dd', '#0000cc', '#0000bb'] }
];
global.localStorage.setItem('eternal_veil_custom_palettes', JSON.stringify(mockCustomLibrary));

// Test random select when current is empty
const customSelect1 = ColorCycles.getNextPalette('custom', []);
assert.ok(customSelect1, 'custom loop should pick a palette when library has entries');
assert.ok(mockCustomLibrary.some(p => p.colors.join(',') === customSelect1.join(',')), 'Returned custom palette must match a seed palette');

// Test sequential loop select
// Set current to first seed palette
const customSelect2 = ColorCycles.getNextPalette('custom', mockCustomLibrary[0].colors);
assert.deepStrictEqual(customSelect2, mockCustomLibrary[1].colors, 'custom loop select should return the next item sequentially');

const customSelect3 = ColorCycles.getNextPalette('custom', mockCustomLibrary[2].colors);
assert.deepStrictEqual(customSelect3, mockCustomLibrary[0].colors, 'custom loop select should wrap around to the first item');
console.log('✅ Passed: custom library loops select items sequentially and wrap around correctly.');

console.log('--------------------------------------------------');
console.log('🎉 ALL COLOR PLAYLISTS ENGINE TESTS PASSED!');
console.log('--------------------------------------------------');
