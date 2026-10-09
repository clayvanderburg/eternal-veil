// Speaker alignment (js/synth.js alignToSpeakers): sources the site plays itself are held back by
// the reported output latency so reactions land when the beat is heard; capture sources pass
// straight through; low frame rates pick the reading closest to the target age.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let clock = 0;
const context = { window: {}, console, performance: { now: () => clock }, navigator: {}, AudioContext: function () {} };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/synth.js'), 'utf8') + ';globalThis.Engine = BinauralBeatEngine;', context);
const engine = new context.Engine();
const read = (mode, latency, frameMs, frames) => {
    engine.visualizerMode = mode; engine.ctx = { outputLatency: latency, baseLatency: 0.01 }; engine.speakerQueue = null;
    let out;
    for (let i = 0; i < frames; i++) { clock += frameMs; out = engine.alignToSpeakers({ at: clock }); }
    return clock - out.at;
};
assert(Math.abs(read('playlist', 0.04, 16.7, 60) - 33.4) < 0.01, 'wired: ~30 ms held back (latency minus a frame of detection)');
const bt = read('playlist', 0.22, 16.7, 60);
assert(bt >= 200 && bt <= 220, `Bluetooth: ~210 ms held back, got ${bt}`);
assert.equal(read('playlist', 0.9, 16.7, 60) <= 351, true, 'never more than 350 ms');
assert.equal(read('system', 0.22, 16.7, 60), 0, 'device audio passes straight through');
assert.equal(read('mic', 0.22, 16.7, 60), 0, 'microphone passes straight through');
assert.equal(read('playlist', 0, 16.7, 60), 0, 'no reported latency: no hold');
const slow = read('playlist', 0.05, 100, 20);
assert(slow <= 50, `10 fps picks the reading nearest the 40 ms target, got ${slow}`);
console.log('PASS: speaker alignment holds played sources by output latency, passes capture sources, handles low frame rates.');
