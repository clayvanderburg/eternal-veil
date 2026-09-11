const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/simulation.js'), 'utf8');
const line = source.split('\n').find(line => line.includes('this.compositionTime = (this.compositionTime'));
assert(line);
const advance = new Function('delta', line);
for (const initial of [0, 100, 10000]) {
    const sim = { compositionTime: initial, settings: { speed: 2 } };
    for (let i = 0; i < 600; i++) {
        sim.settings.speed = 2 + (0.5 - 2) * Math.min(1, i / 300);
        const before = sim.compositionTime;
        advance.call(sim, 1 / 60);
        assert(Math.abs(sim.compositionTime - before - sim.settings.speed / 30 * 4) < 1e-10);
    }
}
const native = fs.readFileSync(require('node:path').join(__dirname, '../js/simulation3d-native.js'), 'utf8');
assert(!native.includes('uTime * (0.24 + uSpeed * 0.18)'));
assert(!native.includes('uTime * uSpeed * 0.66'));
console.log('Composition clocks remain continuous through speed transitions at any session age.');
