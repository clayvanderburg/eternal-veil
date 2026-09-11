const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../js/simulation.js'), 'utf8');
const context = { window: {}, console, Math };
vm.createContext(context);
vm.runInContext(source + '\nthis.ParticleForTest = Particle;', context);
for (const shape of ['pipes', 'pipesTight', 'pipesCathedral', 'pipesShrine']) {
    const p = new context.ParticleForTest(1600, 1000, ['#00ffff']);
    const settings = { particleShape: shape, speed: 0.5 };
    p.configureAuthoredEffect(shape, 100000, settings);
    for (let i = 0; i < 600; i++) {
        settings.speed = i % 2 ? 0.45 : 0.8;
        p.updatePipeMotion(settings, 100000 + i, 1);
        assert(p.activeEffectShape === shape, 'respawns stay on the authored route');
        assert(Math.hypot(p.x - p.lastX, p.y - p.lastY) < 100, 'no teleport from changing speed or respawning');
        const expected = p.getPipeRoutePoint(p.pipeProgress);
        assert(Math.abs(p.x - expected.x) < 1e-6 && Math.abs(p.y - expected.y) < 1e-6);
    }
}
console.log('Pipe continuity and respawn checks passed.');
