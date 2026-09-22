const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
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
            const speedMin = presets[preset].speed * .72;
            const speedMax = presets[preset].speed * 1.28;
            assert(targets.speed >= speedMin - 1e-9, `${shape}/${personality} speed ${targets.speed} below ${speedMin}`);
            assert(targets.speed <= speedMax + 1e-9, `${shape}/${personality} speed ${targets.speed} above ${speedMax}`);
            assert(Number.isInteger(targets.density));
            assert(Object.values(targets).every(Number.isFinite));
        }
    }
}
assert(app.includes('nextPatternShape === "celticCurrent"'), 'Celtic Current has a dedicated authored Flow envelope');
assert(app.includes('speed: rnd(0.42, 0.62)'), 'Celtic Current Flow speed stays in its designed range');
assert.match(html, /id="auto-pattern-slider"[^>]*value="15"/, 'pattern default is 15 seconds');
assert.match(html, /id="auto-color-slider"[^>]*value="18"/, 'color default is 18 seconds');
assert.match(html, /id="hud-pattern-slider"[^>]*value="15"/, 'HUD mirrors pattern default');
assert.match(html, /id="hud-color-slider"[^>]*value="18"/, 'HUD mirrors color default');
assert.equal((html.match(/data-signature-shape="pendulumSpiral"/g) || []).length, 3,
    'only the three spiral controls show for Chaotic Spiral');
assert.equal((html.match(/data-signature-shape="solarFlare"/g) || []).length, 2,
    'only the two eclipse controls show for Solar Flare');
assert(app.includes('startAutopilotIntervals(false, "pattern")')
    && app.includes('startAutopilotIntervals(false, "color")'),
    'adjusting either timer reschedules only that timer without an immediate shift');
const dissExpr = app.match(/const dissMod = (.*);/)[1];
const diss = new Function('baseSettings', 'appliedSizePulse', `return ${dissExpr}`);
assert.equal(diss({ dissipation: .002 }, 0), .002, 'silence preserves long trails');
assert(diss({ dissipation: .02 }, .3) <= .02, 'bass never shortens baseline trails');

// Celtic Current is a dedicated two-plane renderer. Keep its depth separation,
// finite transforms, and phone/low-quality workload reduction from regressing.
const celticSandbox = { window: { RenderQuality: { currentProfileKey: 'desktopHigh' } }, module: { exports: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/celtic-currents.js', 'utf8'), celticSandbox);
const celtic = celticSandbox.module.exports;
const makeContext = () => {
    const calls = { ellipses: 0, scales: [], translates: [], rotations: [], alphas: [] };
    return {
        calls,
        save() {}, restore() {}, beginPath() {}, fill() {},
        ellipse(...args) { calls.ellipses++; assert(args.every(Number.isFinite), 'finite Celtic ellipse'); },
        translate(x, y) { calls.translates.push([x, y]); assert(Number.isFinite(x) && Number.isFinite(y)); },
        rotate(a) { calls.rotations.push(a); assert(Number.isFinite(a)); },
        scale(x, y) { calls.scales.push([x, y]); assert(Number.isFinite(x) && Number.isFinite(y)); },
        set fillStyle(value) {}, set globalAlpha(value) { assert(Number.isFinite(value)); calls.alphas.push(value); }
    };
};
const celticSettings = { density: 1500, baseSize: 4.8, speed: .5, rotationSpeed: .08, wobble: .12 };
const desktopCtx = makeContext();
celtic.draw(desktopCtx, 1200, 800, 12, celticSettings, ['#12d9cf', '#a7f3d0']);
assert.equal(desktopCtx.calls.scales.length, 2, 'Celtic Current keeps exactly two independent depth planes');
assert(desktopCtx.calls.scales[0][0] < desktopCtx.calls.scales[1][0], 'rear plane remains smaller than front');
assert(desktopCtx.calls.scales.every(([x]) => x > 0.6), 'breathing zoom never shrinks below full-bleed baseline');
assert(desktopCtx.calls.ellipses > 1000, 'dense Jade-style paint marks remain present');
assert(Math.max(...desktopCtx.calls.alphas) >= .85, 'Celtic marks retain the approved scratch opacity');
const restingCtx = makeContext();
celtic.draw(restingCtx, 1200, 800, 12, { ...celticSettings, stretch: 0 }, ['#12d9cf', '#a7f3d0']);
assert(restingCtx.calls.scales.every(([x, y]) => Math.abs(x - y) < 1e-9),
    'zero Velocity Stretch leaves both weave planes unstretched');
const flexedCtx = makeContext();
celtic.draw(flexedCtx, 1200, 800, 12, { ...celticSettings, stretch: 1 }, ['#12d9cf', '#a7f3d0']);
assert(flexedCtx.calls.scales.some(([x, y]) => Math.abs(x - y) > .04),
    'Velocity Stretch visibly changes a weave plane’s diamond proportions');
assert(flexedCtx.calls.scales[0][0] / flexedCtx.calls.scales[0][1]
    !== flexedCtx.calls.scales[1][0] / flexedCtx.calls.scales[1][1],
    'front and rear planes flex on offset cycles');
const zoomedCtx = makeContext();
celtic.draw(zoomedCtx, 1200, 800, 12, celticSettings, ['#12d9cf', '#a7f3d0'], 1.69);
assert(zoomedCtx.calls.scales[1][0] < desktopCtx.calls.scales[1][0],
    'Celtic Current compensates internally for outer zoom density');
assert(Math.abs(zoomedCtx.calls.scales[1][0] / desktopCtx.calls.scales[1][0] - (1 / 1.3)) < 1e-9,
    'Celtic compensation preserves half the outer zoom response');
assert(source.includes('this.palette, sceneScale'), 'Veil Drift scale reaches the Celtic renderer');
const lowCtx = makeContext();
celticSandbox.window.RenderQuality.currentProfileKey = 'desktopLow';
celtic.draw(lowCtx, 1200, 800, 12, celticSettings, ['#12d9cf', '#a7f3d0']);
assert(lowCtx.calls.ellipses < desktopCtx.calls.ellipses, 'low quality reduces mark workload');
console.log('Preset integration: live eclipse controls, lifecycle, zero spin, manual count, bounded Flow targets, bass baseline, Celtic depth/mobile renderer passed.');
