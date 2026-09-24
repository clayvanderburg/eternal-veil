const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const compositions = require('../js/preset-compositions.js');
const root = path.resolve(__dirname, '..');
const presets = vm.runInNewContext(fs.readFileSync(path.join(root, 'js/presets.js'), 'utf8') + '\nStylePresets;');
assert.equal(Object.keys(presets).length, 36);
assert.equal(presets.celticCurrent.name, 'Celtic Current');
assert.equal(presets.celticCurrent.particleShape, 'celticCurrent');
assert.equal(presets.celticKnotwork.name, 'Celtic Knotwork');
assert.equal(presets.celticKnotwork.particleShape, 'celticKnotwork');
assert.equal(presets.cymaticResonance.name, 'Cymatic Resonance');
assert.equal(presets.cymaticResonance.particleShape, 'cymaticResonance');
assert.equal(presets.fractal.name, 'Prismatic Lace');
assert.equal(presets.fractal.density, 2500);
assert.equal(presets.fractal.particleShape, 'ring');
assert.equal(presets.fractalNebula.particleShape, 'fractalBloom');
assert.equal(presets.fractalNebula.speed, 1.17);
assert.equal(presets.quantumGrid.speed, 3.5);
assert.equal(presets.quantumGrid.density, 2200);
assert.equal(presets.fractalNebula.density, 3600);
assert.equal(presets.quantum.name, 'Quantum Drift');
assert.equal(presets.quantum.density, 2800);
assert.equal(presets.mandala.density, 1200);
assert.equal(presets.vortex.rotationSpeed, 0.70);
assert.equal(presets.quantum.particleShape, 'quantumDrift');
for (const shape of ['zenMandala', 'quantumLattice', 'gravityWell', 'fractalBloom']) {
    assert(compositions.supports(shape));
    for (let i = 0; i < 100; i++) {
        for (const t of [0, 0.016, 12, 120, 10000]) {
            const p = compositions.point(shape, i / 100, (i * 0.618) % 1, i * 0.19, t);
            assert([p.x, p.y, p.z].every(Number.isFinite));
            assert(Math.hypot(p.x, p.y) < (['quantumLattice', 'zenMandala'].includes(shape) ? 1.8 : 1));
            assert(p.fade === undefined || (p.fade >= 0 && p.fade <= 1));
        }
    }
}
// Twelvefold rosette symmetry at a fixed time; exact rotational spacing.
for (let i = 0; i < 180; i++) {
    const p = compositions.point('fractalBloom', i / 180, (i * 0.618) % 1, i * 0.19, 25);
    const b = p.branch;
    const curve = Math.sin(b.travel * Math.PI);
    assert(Math.abs(p.x - (b.x + b.dx * b.travel + b.bx * curve)) < 1e-10);
    assert(Math.abs(p.y - (b.y + b.dy * b.travel + b.by * curve)) < 1e-10);
    assert(b.level >= 0 && b.level <= 5);
}
const a = compositions.point('zenMandala', 0.4, 0.3, 0.2, 10);
const b = compositions.point('zenMandala', 0.4, 0.3, 0.2 + Math.PI / 6, 10);
assert(Math.abs(Math.hypot(a.x,a.y) - Math.hypot(b.x,b.y)) < 1e-10);
const inwardA = compositions.point('gravityWell', 0.3, 0.8, 0, 0);
// Explicit grid tails must stop at the start of their current cell traversal.
// Sampling beyond that boundary would draw a chord across a recycled route.
for (let i = 0; i < 200; i++) {
    const time = i * 0.117;
    const phase = i * 0.31;
    const head = compositions.point('quantumLattice', 0.3, 0.4, phase, time);
    const span = Math.min(2.6, head.age);
    let prev;
    for (let j = 0; j <= 5; j++) {
        const p = compositions.point('quantumLattice', 0.3, 0.4, phase, time - span * (1 - j / 5) + 1e-9);
        assert([p.x, p.y, p.z].every(Number.isFinite));
        if (prev) assert(Math.hypot(p.x - prev.x, p.y - prev.y) < 0.04);
        prev = p;
    }
}
const inwardB = compositions.point('gravityWell', 0.3, 0.8, 0, 10);
assert(Math.hypot(inwardB.x, inwardB.y / 0.78) < Math.hypot(inwardA.x, inwardA.y / 0.78));
console.log('Preset compositions: finite positions, bounds, symmetry, inward motion, and preserved legacy keys pass.');
