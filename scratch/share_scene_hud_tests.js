'use strict';
// Regression: restored scene labels must describe the loaded shape and Flow state.
// Executes app functions; mocks only their DOM/audio boundaries, not the label logic.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const presetContext = {};
vm.createContext(presetContext);
vm.runInContext(fs.readFileSync(path.join(root, 'js/presets.js'), 'utf8') + '\nthis.presets = StylePresets;', presetContext);
const element = () => ({ textContent: '', value: '', checked: false, style: {}, querySelector: () => null, classList: { add() {}, remove() {}, toggle() {} } });
const elements = new Proxy({}, { get(target, key) { return target[key] ??= element(); } });
const context = {
    elements, StylePresets: presetContext.presets,
    sim: { settings: { particleShape: 'ellipse' }, updateDensity() {} },
    excludedPresetKeys: new Set(), favoritePresetKeys: new Set(), isAutopilot: false,
    window: { CosmicSynth: new Proxy({}, { get() { return () => {}; } }) },
    document: { getElementById: element }, FLOWABLE_OPTIONS: [],
    updateSignatureControlsVisibility() {}, updateActivePalette() {}, setOptionToManual() {},
    updateSliderTextDisplays() {}, updateFlowStatusBanner() {},
    toggleAutopilot(enabled) { context.isAutopilot = enabled; }
};
vm.createContext(context);
function extract(name, next) {
    const start = source.indexOf('    function ' + name + '(');
    const end = source.indexOf('    function ' + next + '(', start);
    assert(start >= 0 && end > start, `Cannot locate ${name}`);
    return source.slice(start, end);
}
vm.runInContext(extract('getPresetByShape', 'updateHudPresetName') +
    extract('updateHudPresetName', 'updateHudColorSwatches') +
    extract('applyLoadedState', 'updateSliderTextDisplays'), context);
context.releaseActivePreset = () => context.updateHudPresetName(null);
context.syncRingControls = () => {};

const scenarios = [
    ['mandelbrotDive', 'MANDELBROT DIVE'],
    ['celticKnotwork', 'CELTIC KNOTWORK'],
    ['fractalBloom', 'FRACTAL NEBULA'],
    ['cymaticResonance', 'CYMATIC RESONANCE'],
    ['painterlyVortex', 'PAINTED DEPTH SPIRAL'],
    ['quantumLattice', 'QUANTUM GRID']
];
for (const [shape, expected] of scenarios) {
    // Start on a different scene so a stale label cannot accidentally pass.
    context.sim.settings.particleShape = 'ellipse';
    context.applyLoadedState({ settings: { particleShape: shape }, palette: ['#ffffff'],
        backgroundColor: '#000000', isSolidMode: false, autopilotEnabled: false });
    assert.equal(elements.hudPresetName.textContent, expected, shape);
}
context.applyLoadedState({ settings: { particleShape: 'quantumLattice' }, palette: ['#ffffff'],
    backgroundColor: '#000000', isSolidMode: false, autopilotEnabled: true });
assert.equal(elements.hudPresetName.textContent, 'QUANTUM GRID (FLOW)');
context.sim.settings.particleShape = 'not-a-registered-shape';
context.updateHudPresetName(null);
assert.equal(elements.hudPresetName.textContent, 'CUSTOM');
console.log('PASS: six restored scene names, saved Flow state, and unknown-shape fallback.');
