const assert = require('node:assert/strict');
const fs = require('node:fs');

console.log('--------------------------------------------------');
console.log('🧪 RUNNING FLOW STATUS BANNER & MANUAL INSPECTOR TESTS...');
console.log('--------------------------------------------------');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('js/app.js', 'utf8');

// 1. HTML Element Existence
const requiredElements = [
    'id="flow-status-banner"',
    'id="flow-status-pill"',
    'id="flow-status-info"',
    'id="flow-manual-count"',
    'id="flow-reset-all-btn"',
    'id="flow-manual-popover"',
    'id="flow-popover-count"',
    'id="flow-popover-close-btn"',
    'id="flow-manual-items-list"',
    'id="flow-popover-reset-all-btn"'
];
for (const idSnippet of requiredElements) {
    assert(html.includes(idSnippet), `HTML must contain ${idSnippet}`);
}
console.log('✅ Passed: HTML structure contains all flow status banner and popover elements.');

// 2. CSS Rules
assert(css.includes('.flow-status-banner'), 'CSS must define .flow-status-banner');
assert(css.includes('.flow-status-pill'), 'CSS must define .flow-status-pill');
assert(css.includes('.flow-reset-btn'), 'CSS must define .flow-reset-btn');
assert(css.includes('.flow-manual-popover'), 'CSS must define .flow-manual-popover');
assert(css.includes('.flow-manual-item'), 'CSS must define .flow-manual-item');
assert(css.includes('.flow-item-remove-btn'), 'CSS must define .flow-item-remove-btn');
console.log('✅ Passed: CSS contains required classes and animations for banner and popover.');

// 3. FLOWABLE_OPTIONS completeness in JS
assert(js.includes('const FLOWABLE_OPTIONS = ['), 'app.js must declare FLOWABLE_OPTIONS array');
const options = [
    'speed', 'turbulence', 'density', 'flowOrganic', 'dissipation', 'zoom',
    'baseSize', 'sizeVariation', 'stretch', 'interaction', 'mouseInfluence',
    'rotationSpeed', 'wobble', 'veilDriftEnabled', 'veilDriftRotation',
    'veilDriftZoom', 'veilDriftWander', 'miniSpiralCount', 'spiralExtent',
    'wanderMix', 'eclipseCount', 'eclipseSize', 'kaleidoscopeSegments',
    'kaleidoscopeEnabled', 'psychedelicMode', 'morphingBg', 'spinningKaleido',
    'particleShape', 'particleLighting', 'colors'
];
for (const key of options) {
    assert(js.includes(`key: "${key}"`), `FLOWABLE_OPTIONS must include key: "${key}"`);
}
console.log('✅ Passed: All 30 flowable parameters are registered in FLOWABLE_OPTIONS.');

// 4. Selector existence in HTML for each option
const optRegex = /selector:\s*"([^"]+)"/g;
let match;
const selectors = [];
while ((match = optRegex.exec(js)) !== null) {
    selectors.push(match[1]);
}
assert(selectors.length >= 30, `Expected at least 30 selectors in app.js, found ${selectors.length}`);
for (const sel of selectors) {
    const id = sel.replace('#', '');
    assert(html.includes(`id="${id}"`), `HTML must contain target element with id="${id}" for selector ${sel}`);
}
console.log('✅ Passed: All 30 control selectors correspond to real HTML elements.');

// 5. Banner lifecycle methods
assert(js.includes('function getManualOptions()'), 'app.js must implement getManualOptions');
assert(js.includes('function updateFlowStatusBanner()'), 'app.js must implement updateFlowStatusBanner');
assert(js.includes('function renderFlowManualList('), 'app.js must implement renderFlowManualList');
assert(js.includes('function resetAllToFlow()'), 'app.js must implement resetAllToFlow');
assert(js.includes('function toggleFlowManualPopover('), 'app.js must implement toggleFlowManualPopover');
console.log('✅ Passed: Core flow status banner and reset controller functions are defined.');

// 6. Verification of unified setOptionToManual / setOptionToFlow
assert(js.includes('pillGroups.forEach(pillGroup => {'), 'app.js must synchronize all matching pill groups');
assert(js.includes('updateFlowStatusBanner()'), 'app.js must update flow status banner on manual/flow changes');

console.log('--------------------------------------------------');
console.log('🎉 ALL FLOW STATUS BANNER TESTS PASSED SUCCESSFULLY!');
console.log('--------------------------------------------------');
