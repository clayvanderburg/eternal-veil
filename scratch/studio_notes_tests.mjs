// Studio notes: each draft keeps its own note and the pull request prints it under that
// preset (or under the music playlists); a preset with only a note gets its own section.
// Dry run against this commit: nothing is pushed. Run: node scratch/studio_notes_tests.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.STUDIO_DRY_RUN = '1';
process.env.STUDIO_BASE = 'HEAD';
process.env.STUDIO_PREVIEW = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ev-notes-')), 'preview');
const studio = await import('file:///' + path.join(root, 'tools', 'studio-server.mjs').replace(/\\/g, '/'));
const server = studio.createStudioServer();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const post = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json() }; };
try {
  const r = await post('/api/studio/publish', {
    presets: { cosmic: { speed: 1.3 }, supernova: { speed: 1.0 } },
    music: {},
    notes: { cosmic: 'kaleidoscope does not segment', ethereal: 'colors feel washed out', supernova: '' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const msg = r.json.diff;
  const nebula = msg.indexOf('### Nebula Spark'), solar = msg.indexOf('### Solar Flare'), note = msg.indexOf('> Note: kaleidoscope does not segment');
  assert(nebula >= 0 && note > nebula && (solar < 0 || note < solar || solar < nebula), 'the Nebula Spark note sits under Nebula Spark, not at the end');
  assert(msg.includes('### Ethereal Aura (note only)') && msg.includes('> Note: colors feel washed out'), 'a note-only preset gets its own section');
  assert.equal((msg.match(/> Note:/g) || []).length, 2, 'empty notes are left out');
  const onlyNotes = await post('/api/studio/publish', { presets: {}, music: {}, notes: { cosmic: 'just a note' } });
  assert.equal(onlyNotes.status, 400);
  assert.match(onlyNotes.json.error, /Notes travel with changes/);
  console.log('PASS: Studio notes are kept per draft and printed under their own preset.');
} finally {
  server.close();
  fs.rmSync(path.dirname(process.env.STUDIO_PREVIEW), { recursive: true, force: true });
}
