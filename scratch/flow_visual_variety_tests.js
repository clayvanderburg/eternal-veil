const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('    function chooseNextFlowPattern(effectivePersonality) {');
const end = source.indexOf('\n    function randomizeAllParameters()', start);
assert(start >= 0 && end > start, 'Flow pattern selector found');

const sim = { settings: { particleShape: 'ellipse' } };
const elements = { particleShapeSelect: { value: 'ellipse' } };
let shapeUnlocked = true;
const excludedPresetKeys = new Set();
const getPresetByShape = shape => shape === 'zenMandala' ? 'mandalaZen' : shape;
const patternsStart = source.indexOf('    const FLOW_PRESET_PATTERNS = ');
const patternsDef = source.slice(patternsStart, source.indexOf('\n', patternsStart));
assert(patternsStart >= 0, 'Flow preset patterns found');
const choose = new Function('sim', 'elements', 'isFlowEnabled', 'excludedPresetKeys', 'getPresetByShape', 'recordFlowPick',
    `let lastFlowPatternShape = null;\n${patternsDef}\n${source.slice(start, end)}\nreturn chooseNextFlowPattern;`
)(sim, elements, key => key === 'particleShape' && shapeUnlocked, excludedPresetKeys, getPresetByShape, () => {});
const drawnShape = next => next === 'cosmicStrings' ? 'ellipse' : next;

for (const personality of ['serene', 'alive', 'wild']) {
    const counts = new Map();
    let previous = sim.settings.particleShape;
    for (let i = 0; i < 10000; i++) {
        const next = choose(personality);
        assert.notEqual(next, previous, 'consecutive Flow geometry differs');
        assert.equal(elements.particleShapeSelect.value, drawnShape(next));
        counts.set(next, (counts.get(next) || 0) + 1);
        previous = next;
    }
    const mandalaRate = counts.get('zenMandala') / 10000;
    assert(mandalaRate > (personality === 'serene' ? 0.12 : 0.09), `${personality}: mandala remains too rare`);
    assert(mandalaRate < 0.32, `${personality}: mandala crowds out variety`);
    assert(counts.size >= (personality === 'serene' ? 12 : 22), `${personality}: other patterns still appear`);
    const newShapes = ['jadeCurrents', 'celticCurrent', 'celticKnotwork', 'cymaticResonance', 'mandelbrotDive', 'molecularDance', 'stellarNursery', 'prismDrift', 'violetUndertow'];
    newShapes.push('cosmicStrings');
    if (personality !== 'serene') newShapes.push('quantumDrift', 'nebulaSpark', 'solarFlare', 'acid');
    for (const shape of newShapes) assert(counts.get(shape) > 0, `${shape} must actually occur in ${personality} Flow`);
}

shapeUnlocked = false;
assert.equal(choose('alive'), null, 'manual shape lock prevents Flow selection');
shapeUnlocked = true;
excludedPresetKeys.add('mandalaZen');
for (let i = 0; i < 1000; i++) assert.notEqual(choose('alive'), 'zenMandala', 'excluded Mandala remains excluded');
// Flow kaleidoscope tiers from Clay's per-scene review (2026-10-07).
const tierSet = name => new Set([...source.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`))[1].matchAll(/"([A-Za-z]+)"/g)].map(m => m[1]));
assert.deepEqual([...tierSet('kaleidoExcludedShapes')].sort(), ['acid', 'quantumLattice'], 'never-kaleidoscope scenes');
assert.deepEqual([...tierSet('kaleidoHalfShapes')].sort(), ['mandelbrotDive', 'nebulaSpark'], 'half-the-time scenes');
for (const shape of ['pendulumSpiral', 'cluster', 'pipes', 'pipesTight', 'pipesCathedral', 'pipesShrine', 'zenMandala']) {
    assert(tierSet('kaleidoOftenShapes').has(shape), `${shape} gets the "often" kaleidoscope chance`);
}
assert(source.includes('kaleidoOftenShapes.has(activeFlowShape) ? Math.max(kaleidoChance, 0.58)'), 'often scenes get a meaningful symmetry chance');
assert(source.includes('!kaleidoGeometricShapes.has(activeFlowShape) && isFlowEnabled("density")'), 'circuit/grid density is not thinned just for kaleidoscope');
assert(source.includes('currentKaleidoEnabled\n                && !kaleidoExcludedShapes.has(activeFlowShape)'), 'spinning needs an active, allowed kaleidoscope');
console.log('Flow visual variety: weighted mandala, diverse patterns, lock and coupled kaleidoscope pass.');
