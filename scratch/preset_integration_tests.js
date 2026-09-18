const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const source = fs.readFileSync('js/simulation.js', 'utf8');
const presets = vm.runInNewContext(fs.readFileSync('js/presets.js', 'utf8') + '\nStylePresets;');
const sandbox = { window: {}, console };
const { Particle, FlowSimulation } = vm.runInNewContext(source + '\n({Particle, FlowSimulation});', sandbox);
const settings = { particleShape: 'solarFlare', speed: 0.5, zoom: 1, turbulence: 0.2,
    drag: 0.93, interaction: 0, wobble: 0, rotationSpeed: 0, eclipseCount: 12, eclipseSize: 1 };
const p = new Particle(1200, 800, ['#00ffaa']);
p.index = 15;
const step = () => p.update(settings, 10, { x: -999, y: -999 }, [], [], [], 1);
step();
assert.equal(p.solarHero, false);
settings.eclipseCount = 20;
step();
assert.equal(p.solarHero, true);
assert(Number.isFinite(p.sunHomeX) && Number.isFinite(p.sunFreqX));
const radius = p.sunBaseR;
settings.eclipseSize = 1.5;
step();
assert(Math.abs(p.sunBaseR / radius - 1.5) < 1e-9, 'live eclipse size scales existing heroes');
settings.eclipseCount = 12;
step();
assert.equal(p.solarHero, false);
assert(p.life < 300 && p.sunId < 12, 'demotion restores finite lifetime and valid host');
settings.eclipseCount = 20;
step();
settings.particleShape = 'prismDrift';
settings.speed = 0;
step();
assert(p.life < 300, 'leaving eclipse does not inherit immortal lifetime');
const rotation = p.prismRot;
for (let i = 0; i < 50; i++) step();
assert.equal(p.prismRot, rotation, 'zero speed does not become one for prism spin');
assert([p.x, p.y, p.vx, p.vy].every(Number.isFinite));
const hostState = { settings: { miniSpiralCount: 5 } };
for (let i = 0; i < 1000; i++) FlowSimulation.prototype.syncMiniHosts.call(hostState, 3);
assert.equal(hostState.liveMiniCount, 5, 'manual count remains stable over time');

// Run the actual family-target block at range endpoints, checking manual locks.
const block = app.slice(app.indexOf('        const familyPresetKeys ='), app.indexOf('        const activeFlowShape ='));
assert(block.length > 100);
const evaluate = new Function('StylePresets', 'nextPatternShape', 'effectivePersonality', 'rnd', 'isFlowEnabled', 'startMorph', 'baseDuration', block);
const keys = { jadeCurrents: 'liquid', quantumDrift: 'quantum', prismDrift: 'mandala', nebulaSpark: 'cosmic', solarFlare: 'supernova', violetUndertow: 'vortex' };
for (const [shape, preset] of Object.entries(keys)) {
    for (const personality of ['serene', 'alive', 'wild']) {
        for (const endpoint of [0, 1]) {
            const targets = {};
            evaluate(presets, shape, personality, (lo, hi) => endpoint ? hi : lo, k => k !== 'baseSize', (k, v) => targets[k] = v, 1000);
            assert(!('baseSize' in targets), 'manual size preserved');
            assert(targets.speed >= presets[preset].speed * .72 - 1e-9);
            assert(targets.speed <= presets[preset].speed * 1.28 + 1e-9);
            assert(Number.isInteger(targets.density));
            assert(Object.values(targets).every(Number.isFinite));
        }
    }
}
const dissExpr = app.match(/const dissMod = (.*);/)[1];
const diss = new Function('baseSettings', 'appliedSizePulse', `return ${dissExpr}`);
assert.equal(diss({ dissipation: .002 }, 0), .002, 'silence preserves long trails');
assert(diss({ dissipation: .02 }, .3) <= .02, 'bass never shortens baseline trails');
console.log('Preset integration: live eclipse controls, lifecycle, zero spin, manual count, bounded Flow targets, bass baseline passed.');
