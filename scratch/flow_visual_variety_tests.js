const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const start = source.indexOf('    function chooseNextFlowPattern(effectivePersonality) {');
const end = source.indexOf('\n    function randomizeAllParameters()', start);
assert(start >= 0 && end > start, 'Flow pattern selector found');

const sim = { settings: { particleShape: 'ellipse' } };
const elements = { particleShapeSelect: { value: 'ellipse' } };
let shapeUnlocked = true;
const excludedPresetKeys = new Set();
const getPresetByShape = shape => shape === 'zenMandala' ? 'mandalaZen' : shape;
const choose = new Function('sim', 'elements', 'isFlowEnabled', 'excludedPresetKeys', 'getPresetByShape',
    `let lastFlowPatternShape = null;\n${source.slice(start, end)}\nreturn chooseNextFlowPattern;`
)(sim, elements, key => key === 'particleShape' && shapeUnlocked, excludedPresetKeys, getPresetByShape);

for (const personality of ['serene', 'alive', 'wild']) {
    const counts = new Map();
    let previous = sim.settings.particleShape;
    for (let i = 0; i < 10000; i++) {
        const next = choose(personality);
        assert.notEqual(next, previous, 'consecutive Flow geometry differs');
        assert.equal(elements.particleShapeSelect.value, next);
        counts.set(next, (counts.get(next) || 0) + 1);
        previous = next;
    }
    const mandalaRate = counts.get('zenMandala') / 10000;
    assert(mandalaRate > (personality === 'serene' ? 0.14 : 0.10), `${personality}: mandala remains too rare`);
    assert(mandalaRate < 0.32, `${personality}: mandala crowds out variety`);
    assert(counts.size >= (personality === 'serene' ? 12 : 22), `${personality}: other patterns still appear`);
}

shapeUnlocked = false;
assert.equal(choose('alive'), null, 'manual shape lock prevents Flow selection');
shapeUnlocked = true;
excludedPresetKeys.add('mandalaZen');
for (let i = 0; i < 1000; i++) assert.notEqual(choose('alive'), 'zenMandala', 'excluded Mandala remains excluded');
assert(source.includes('kaleidoEligibleShapes.has(activeFlowShape)'), 'Flow symmetry uses curated geometry');
for (const shape of ['quantumLattice', 'pipesTight', 'pipesCathedral', 'pipesShrine']) {
    assert(source.includes(`"${shape}"`), `${shape} remains in the Flow symmetry inventory`);
}
assert(source.includes('kaleidoGeometricShapes.has(activeFlowShape) ? Math.max(kaleidoChance, 0.58)'), 'grid and circuit geometry get a meaningful symmetry chance');
assert(source.includes('!kaleidoGeometricShapes.has(activeFlowShape) && isFlowEnabled("density")'), 'circuit/grid density is not thinned just for kaleidoscope');
assert(source.includes('currentKaleidoEnabled\n                && kaleidoEligibleShapes.has(activeFlowShape)'), 'spinning needs active compatible kaleidoscope');
console.log('Flow visual variety: weighted mandala, diverse patterns, lock and coupled kaleidoscope pass.');
