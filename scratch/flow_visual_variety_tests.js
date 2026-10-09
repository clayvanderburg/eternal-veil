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
// Flow kaleidoscope odds live in the presets (Clay's review 2026-10-07, tunable in the Studio).
const vm = require('node:vm');
const presetContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/presets.js'), 'utf8')
    + ';globalThis.P = StylePresets; globalThis.E = FlowExtraEffects; globalThis.pick = pickFlowExtraEffect;', presetContext);
const P = presetContext.P;
for (const key of ['acid', 'quantumGrid']) assert.equal(P[key].flowEffectChance, 0, `${key} never mirrored in Flow`);
for (const key of ['mandelbrotDive', 'cosmic']) assert.equal(P[key].flowEffectChance, 0.5, `${key} mirrored half the time`);
for (const key of ['hypno', 'cluster', 'neonConduits', 'circuitCity', 'conduitCathedral', 'circuitShrine', 'mandalaZen']) {
    assert.equal(P[key].flowEffectChance, 0.58, `${key} gets the "often" kaleidoscope chance`);
}
for (const key of ['fractalNebula', 'liquidChrome']) assert(!Number.isFinite(P[key].flowEffectChance), `${key} uses the Flow personality chance`);
assert.equal(P.tightTailVortex.flowKaleidoMax, 4, 'Tight Tail Vortex mirrors with at most 4 segments');
assert.deepEqual([P.strings.flowEffectChance, P.strings.flowKaleidoMin, P.strings.flowKaleidoMax], [1, 8, 8], 'Cosmic Strings always keeps 8 segments');
assert(source.includes('Math.random() < (presetEffectChance ?? effectChance)'), 'Flow reads the preset extra effect chance, else the personality chance');
assert(source.includes('pickFlowExtraEffect(kaleidoPreset?.flowEffectWeights)'), 'Flow picks the extra effect by the preset weights');
assert(source.includes('kaleidoPreset?.flowEffectChance ?? kaleidoPreset?.flowKaleidoChance'), 'the old chance name still reads');
assert(!Object.values(P).some(p => 'flowKaleidoChance' in p), 'every preset uses flowEffectChance');

// Extra effects: every effect starts equally likely; weights steer the pick; 0 turns one off.
const { E, pick } = presetContext;
assert.deepEqual([...E].map(e => e.key), ['kaleidoscope', 'spinningAxes', 'axesRings', 'foldsGrowing', 'foldsDoubling', 'foldsAlternating']);
const tally = weights => {
    const counts = Object.fromEntries(E.map(e => [e.key, 0]));
    for (let i = 0; i < 6000; i++) counts[pick(weights, () => (i + 0.5) / 6000)]++;
    return counts;
};
for (const n of Object.values(tally(undefined))) assert.equal(n, 1000, 'even by default');
const steered = tally({ kaleidoscope: 0, foldsDoubling: 3 });
assert.equal(steered.kaleidoscope, 0, 'weight 0 never picks it');
assert(Math.abs(steered.foldsDoubling - 3 * steered.spinningAxes) <= 3, 'weight 3 is three times as likely');
assert.equal(pick(Object.fromEntries(E.map(e => [e.key, 0]))), null, 'all off: no effect');
assert.equal(pick({ spinningAxes: 0, axesRings: 0, foldsGrowing: 0, foldsDoubling: 0, foldsAlternating: 0 }, () => 0.9999), 'kaleidoscope');
// Flow sets up what it picked; settings held by hand stay put.
const applyStart = source.indexOf('    function applyFlowExtraEffect(effect, spinChance) {');
const applyEnd = source.indexOf('\n    }\n', applyStart) + 6;
assert(applyStart > 0, 'applyFlowExtraEffect found');
const runEffect = (effect, { comfort = false, manual = [], spinRoll = 0 } = {}) => {
    const s = { spinningKaleido: false, kaleidoAxesRings: 5, kaleidoRingFolds: 'custom', kaleidoRingStep: 2 };
    const realRandom = Math.random;
    Math.random = () => spinRoll;
    try {
        new Function('sim', 'isFlowEnabled', 'isComfortMode', 'elements', 'syncRingControls',
            source.slice(applyStart, applyEnd) + '\nreturn applyFlowExtraEffect;')(
            { settings: s }, k => !manual.includes(k), comfort, { spinningKaleidoToggle: {} }, () => {})(effect, 0.5);
    } finally { Math.random = realRandom; }
    return s;
};
assert.deepEqual(runEffect('kaleidoscope'), { spinningKaleido: false, kaleidoAxesRings: 1, kaleidoRingFolds: 'same', kaleidoRingStep: 2 });
assert.equal(runEffect('spinningAxes').spinningKaleido, true);
assert.equal(runEffect('spinningAxes').kaleidoAxesRings, 1);
for (const roll of [0, 0.999]) {
    const r = runEffect('axesRings', { spinRoll: roll });
    assert(r.spinningKaleido && r.kaleidoAxesRings >= 2 && r.kaleidoAxesRings <= 4 && r.kaleidoRingFolds === 'same', 'counter-turning rings');
}
for (const [effect, mode] of [['foldsGrowing', 'growing'], ['foldsDoubling', 'doubling'], ['foldsAlternating', 'alternating']]) {
    const r = runEffect(effect, { spinRoll: 0.999 });
    assert(r.kaleidoRingFolds === mode && r.kaleidoAxesRings >= 3 && r.kaleidoAxesRings <= 4, `${effect} rings`);
    assert.equal(r.spinningKaleido, false, 'fold effects spin only on the personality roll');
    assert.equal(runEffect(effect, { spinRoll: 0 }).spinningKaleido, true);
}
assert.equal(runEffect('spinningAxes', { comfort: true }).spinningKaleido, false, 'Comfort Mode never spins');
assert.deepEqual(runEffect(null), { spinningKaleido: false, kaleidoAxesRings: 1, kaleidoRingFolds: 'same', kaleidoRingStep: 2 }, 'no effect: plain');
assert.equal(runEffect('foldsDoubling', { manual: ['kaleidoRingFolds'] }).kaleidoRingFolds, 'custom', 'hand-set folds stay');
assert(source.includes('rndInt(kaleidoMinSegments, kaleidoMaxSegments)'), 'Flow segments come from the preset range');
assert(source.includes('!kaleidoGeometricShapes.has(activeFlowShape) && isFlowEnabled("density")'), 'circuit/grid density is not thinned just for kaleidoscope');
assert(source.includes('sim.settings.spinningKaleido = !isComfortMode && currentKaleidoEnabled'), 'spinning needs an active kaleidoscope');
console.log('Flow visual variety: weighted mandala, diverse patterns, lock and coupled kaleidoscope pass.');
