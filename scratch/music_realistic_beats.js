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

const expect = (label, kick, floor, bpm, noise, secs = 20) => {
  const r = run(label, kick, floor, bpm, noise, secs);
  const kicks = Math.floor(secs * bpm / 60) - 1;
  assert(r.hits >= kicks * 0.9 && r.hits <= kicks * 1.2, label + ': detected ' + r.hits + ' of ' + kicks + ' kicks');
  assert(r.beatFrames / r.frames > 0.2, label + ': beat pulse too weak (' + Math.round(100 * r.beatFrames / r.frames) + '% of frames)');
};
expect('clean kick', 0.9, 0.0, 120, 0.0);
expect('real floor .45', 0.35, 0.45, 120, 0.05);
expect('real noisy', 0.25, 0.55, 124, 0.12);
expect('real dense mix', 0.18, 0.6, 100, 0.12);
expect('real slow 80bpm', 0.3, 0.4, 80, 0.08);
const quiet = run('steady noise', 0.0, 0.6, 120, 0.12);
assert(quiet.hits <= 3, 'steady noise should not look like a beat (' + quiet.hits + ' false beats)');
console.log('Realistic music beat checks passed (smoothed bass with a sustained floor, 5 cases + steady noise).');
