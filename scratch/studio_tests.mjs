// Studio file writers: edits land in the right preset/music card and nothing else changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPresets, loadMusic, applyPresetChanges, applyMusicChange } from '../tools/studio-server.mjs';

const presetsText = fs.readFileSync(new URL('../js/presets.js', import.meta.url), 'utf8');
const musicText = fs.readFileSync(new URL('../js/music-moods.js', import.meta.url), 'utf8');
const before = loadPresets(presetsText).presets;

// Object-literal preset: edit existing fields, booleans and colors.
let out = applyPresetChanges(presetsText, 'tightTailVortex', { speed: 0.42, size: 1.2, kaleidoscopeEnabled: true, colors: ['#112233', '#AABBCC', '#445566'] });
let after = loadPresets(out).presets;
assert.equal(after.tightTailVortex.speed, 0.42);
assert.equal(after.tightTailVortex.size, 1.2);
assert.equal(after.tightTailVortex.kaleidoscopeEnabled, true);
assert.deepEqual(after.tightTailVortex.colors, ['#112233', '#aabbcc', '#445566']);
for (const key of Object.keys(before)) if (key !== 'tightTailVortex') assert.deepEqual(after[key], before[key], `${key} untouched`);

// Assignment preset that inherits fields (...StylePresets.mandalaZen): an inherited field is added locally.
out = applyPresetChanges(presetsText, 'blackHoleVortex', { size: 2.1, curl: 0.7 });
after = loadPresets(out).presets;
assert.equal(after.blackHoleVortex.size, 2.1);
assert.equal(after.blackHoleVortex.curl, 0.7);
assert.deepEqual(after.mandalaZen, before.mandalaZen, 'base preset untouched');
assert.deepEqual(after.fractalNebula, before.fractalNebula, 'sibling preset untouched');

// Flow fields: ranges object, chance and auto (null), including editing an existing range.
out = applyPresetChanges(presetsText, 'mandalaZen', { flowRanges: { speed: [0.3, 0.1], size: [3, 5] }, flowKaleidoChance: 0.7, flowKaleidoMin: 5 });
after = loadPresets(out).presets;
assert.deepEqual(after.mandalaZen.flowRanges, { speed: [0.1, 0.3], size: [3, 5] });
assert.equal(after.mandalaZen.flowKaleidoChance, 0.7);
assert.equal(after.mandalaZen.flowKaleidoMin, 5);
out = applyPresetChanges(out, 'mandalaZen', { flowRanges: { speed: [0.12, 0.2] }, flowKaleidoChance: null });
after = loadPresets(out).presets;
assert.deepEqual(after.mandalaZen.flowRanges, { speed: [0.12, 0.2] });
assert.equal(after.mandalaZen.flowKaleidoChance, null);
assert.throws(() => applyPresetChanges(presetsText, 'mandalaZen', { flowRanges: { speed: [0.1] } }));
assert.throws(() => applyPresetChanges(presetsText, 'mandalaZen', { speed: null }));

// Unsafe input is refused.
assert.throws(() => applyPresetChanges(presetsText, 'tightTailVortex', { speed: '1; alert(1)' }));
assert.throws(() => applyPresetChanges(presetsText, 'tightTailVortex', { colors: ['red'] }));
assert.throws(() => applyPresetChanges(presetsText, 'tightTailVortex', { name: 'X' }));
assert.throws(() => applyPresetChanges(presetsText, 'notAPreset', { speed: 1 }));

// Music card: one line rewritten, clamped to the runtime limits, others identical.
const music = loadMusic(musicText);
const card = { ...music.profiles.tightTailVortex, kick: -1.2, glow: 9, ripple: { amp: 0.3, dir: 'in', freq: 1.5, to: 'size' } };
const musicOut = applyMusicChange(musicText, 'tightTailVortex', card);
const musicAfter = loadMusic(musicOut).profiles;
assert.equal(musicAfter.tightTailVortex.kick, -1.2);
assert.equal(musicAfter.tightTailVortex.glow, 0.8, 'clamped to max');
assert.deepEqual(musicAfter.tightTailVortex.ripple, { amp: 0.3, dir: 'in', freq: 1.5, to: 'size' });
for (const shape of Object.keys(music.profiles)) if (shape !== 'tightTailVortex') assert.deepEqual(musicAfter[shape], music.profiles[shape], `${shape} music untouched`);
assert.throws(() => applyMusicChange(musicText, 'tightTailVortex', { ripple: { amp: 0.2, dir: 'sideways', freq: 1, to: 'size' } }));
console.log('Studio writers: presets (literal + inherited), colors, safety refusals and music cards pass.');
