const path = require('path');
const assert = require('assert');
global.window = global;
const MM = require(path.join(__dirname, '..', 'js', 'music-moods.js'));

function run(label, kick, floor, bpm, noise, secs = 20) {
  MM.reset();
  let smooth = 0, maxB = 0.4, prevB = 0, seed = 7, truth = 0, hits = 0, last = MM.state.beatId;
  const fps = 60, period = 60000 / bpm;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let beatFrames = 0;
  for (let f = 0; f < secs * fps; f++) {
    const t = f * 1000 / fps, now = 1e6 + t;
    const s = t - Math.floor(t / period) * period;
    let raw = floor + (rnd() - 0.5) * noise;
    if (s < 40) raw += kick; else if (s < 160) raw += kick * Math.exp(-(s - 40) / 55);
    if (t > 1000 && s < 17) truth++;
    smooth = smooth * 0.8 + raw * 0.2;
    const bass = Math.min(1, smooth);
    if (bass > maxB) maxB = bass; else maxB = Math.max(0.1, maxB * 0.9995);
    const nB = Math.min(1, bass / maxB), atk = Math.max(0, nB - prevB); prevB = nB;
    MM.feed({ now, bass: nB, mid: 0.4, trebleLevel: 0.4, bassAttack: atk, trebleAttack: 0, gain: 1, bassOn: true, trebleOn: true });
    if (MM.state.beatId !== last) { hits++; last = MM.state.beatId; }
    if (MM.state.beat > 0.2) beatFrames++;
  }
  return { label, hits, beatFrames, frames: secs * fps };
  console.log(label.padEnd(44), 'kicks', String(truth).padStart(3), ' detected', String(hits).padStart(3), ' bpm', MM.state.bpm.toFixed(0), ' lock', MM.state.lock.toFixed(2), ' beat>0.2:', (100 * beatFrames / (secs * fps)).toFixed(0) + '%');
}

// Dark ambient: 65 BPM soft low pulse (slow attack ~150ms, decay ~450ms), sustained ostinato notes that change level,
// slow pad swells, rolled-off highs. Analyser smoothing 0.8 + rolling-peak normalisation like the app.
function runDark(label, pulse, floor, ost, secs = 40) {
  MM.reset();
  let smooth = 0, maxB = 0.4, prevB = 0, hits = 0, last = MM.state.beatId, beatFrames = 0, seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const fps = 60, period = 60000 / 65; let ostLevel = 0, nextOst = 0;
  const strengths = [];
  for (let f = 0; f < secs * fps; f++) {
    const t = f * 1000 / fps, now = 1e6 + t, s = t % period;
    if (t >= nextOst) { ostLevel = (rnd() - 0.5) * ost; nextOst = t + 460 + rnd() * 920; }
    const padSwell = 0.05 * Math.sin(t / 4000);
    let p = 0;
    if (s < 150) p = 0.5 - 0.5 * Math.cos(Math.PI * s / 150); else p = Math.exp(-(s - 150) / 450);
    const raw = floor + padSwell + ostLevel + pulse * p + (rnd() - 0.5) * 0.02;
    smooth = smooth * 0.8 + raw * 0.2;
    const bass = Math.max(0, Math.min(1, smooth));
    if (bass > maxB) maxB = bass; else maxB = Math.max(0.1, maxB * 0.9995);
    const nB = Math.min(1, bass / maxB), atk = Math.max(0, nB - prevB); prevB = nB;
    MM.feed({ now, bass: nB, mid: 0.35, trebleLevel: 0.08, bassAttack: atk, trebleAttack: 0, gain: 1, bassOn: true, trebleOn: true });
    if (MM.state.beatId !== last) { hits++; last = MM.state.beatId; strengths.push(MM.state.beat); }
    if (MM.state.beat > 0.2) beatFrames++;
  }
  const kicks = Math.floor(secs * 65 / 60) - 1;
  const m = strengths.length ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0;
  return { label, hits, beatFrames, frames: secs * fps };
  console.log(label.padEnd(46), 'pulses', kicks, ' detected', String(hits).padStart(3), ' beat>0.2:', (100 * beatFrames / (secs * fps)).toFixed(0) + '%', ' avg strength', m.toFixed(2), ' lock', MM.state.lock.toFixed(2));
}

const expect = (label, kick, floor, bpm, noise, secs = 20) => {
  const r = run(label, kick, floor, bpm, noise, secs);
  const kicks = Math.floor(secs * bpm / 60) - 1;
  assert(r.hits >= kicks * 0.9 && r.hits <= kicks * 1.2, label + ': detected ' + r.hits + ' of ' + kicks + ' kicks');
  assert(r.beatFrames / r.frames > 0.15, label + ': beat pulse too weak (' + Math.round(100 * r.beatFrames / r.frames) + '% of frames)');
};
expect('clean kick', 0.9, 0.0, 120, 0.0);
expect('real floor .45', 0.35, 0.45, 120, 0.05);
expect('real noisy', 0.25, 0.55, 124, 0.12);
expect('real dense mix', 0.18, 0.6, 100, 0.12);
expect('real slow 80bpm', 0.3, 0.4, 80, 0.08);
const quiet = run('steady noise', 0.0, 0.6, 120, 0.12);
assert(quiet.hits <= 3, 'steady noise should not look like a beat (' + quiet.hits + ' false beats)');

// Soft, slow-attack 65 BPM dark ambient (the original detector found 1 beat in 40 s here).
const darkExpect = (label, pulse, floor, ost, minShare) => {
  const secs = 40, pulses = Math.floor(secs * 65 / 60) - 1;
  const r = runDark(label, pulse, floor, ost, secs);
  assert(r.hits >= pulses * minShare, label + ': detected ' + r.hits + ' of ' + pulses + ' pulses');
  assert(r.beatFrames / r.frames > 0.08, label + ': beat pulse too weak');
};
darkExpect('dark ambient pulse +.12', 0.12, 0.55, 0.10, 0.6);
darkExpect('dark ambient pulse +.18', 0.18, 0.5, 0.08, 0.8);
const calm = runDark('dark, no pulse', 0.0, 0.55, 0.16, 40);
assert(calm.hits <= 16, 'bass notes without a pulse should stay calm (' + calm.hits + ' beats in 40 s)');
console.log('Realistic music beat checks passed (smoothed bass, 5 song-like cases, noise, soft 65 BPM ambient).');
