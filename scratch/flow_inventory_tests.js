const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const poolStart = source.indexOf('const serenePatterns =');
const poolEnd = source.indexOf('const pool =', poolStart);
assert(poolStart >= 0 && poolEnd > poolStart, 'Flow pattern pool must be present');
const pool = source.slice(poolStart, poolEnd);

// Every recent flagship composition must have a path into Flow, not only a preset card.
for (const shape of [
    'tightTailVortex', 'zenMandala', 'quantumLattice', 'gravityWell',
    'fractalBloom', 'chromeRibbon', 'pendulumSpiral', 'painterlyVortex',
    'jadeCurrents', 'quantumDrift', 'prismDrift', 'nebulaSpark', 'solarFlare', 'violetUndertow'
]) {
    assert(pool.includes(`"${shape}"`), `${shape} is missing from the Flow pool`);
}

const authoredStart = source.indexOf('const authoredTargets =');
const authoredEnd = source.indexOf('const activeFlowShape =', authoredStart);
assert(authoredStart >= 0 && authoredEnd > authoredStart, 'Authored Flow targets must be present');
const authored = source.slice(authoredStart, authoredEnd);
for (const shape of ['tightTailVortex', 'zenMandala', 'quantumLattice', 'gravityWell', 'fractalBloom', 'chromeRibbon']) {
    assert(authored.includes(`"${shape}"`), `${shape} needs a bounded authored Flow profile`);
}

console.log('Flow inventory: flagship presets are eligible with authored profiles.');
