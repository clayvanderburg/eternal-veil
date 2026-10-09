// Studio preview copy and review plumbing: the preview follows the ref it is given (not this
// folder's checkout), the site is served from it, Studio's own page and uploads still come from
// this folder, private folders stay blocked, and state reads the live ref.
// Run: node scratch/studio_review_tests.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ev-preview-')), 'preview');
process.env.STUDIO_PREVIEW = preview;
process.env.STUDIO_BASE = 'HEAD'; // "live" = this commit, so the test never needs the network
const studio = await import('file:///' + path.join(root, 'tools', 'studio-server.mjs').replace(/\\/g, '/'));
const git = (...a) => execFileSync('git', ['-c', 'safe.directory=*', ...a], { cwd: root, encoding: 'utf8' }).trim();

try {
  const head = git('rev-parse', '--short=7', 'HEAD'), parent = git('rev-parse', '--short=7', 'HEAD~1');
  assert.equal(studio.syncPreview('HEAD'), head, 'preview created on the live ref');
  assert(fs.existsSync(path.join(preview, 'index.html')));
  assert.equal(studio.syncPreview('HEAD~1'), parent, 'preview moves to another ref (a pull request)');
  fs.writeFileSync(path.join(preview, 'stray.txt'), 'left behind');
  assert.equal(studio.syncPreview('HEAD'), head, 'and back to live');
  assert(!fs.existsSync(path.join(preview, 'stray.txt')), 'stray files are cleaned on a move');

  const live = studio.readRef('HEAD');
  assert(live.order.length > 10 && live.presets[live.order[0]], 'reads presets at a ref');
  assert(live.catalog && live.catalog.playlists.length, 'reads the song catalog at a ref');

  const server = studio.createStudioServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async p => { const r = await fetch(base + p); return { status: r.status, text: await r.text() }; };
  // Make the preview copy distinguishable from this folder.
  fs.appendFileSync(path.join(preview, 'robots.txt'), '\n# preview-copy-marker\n');
  assert((await get('/robots.txt')).text.includes('preview-copy-marker'), 'site files come from the preview copy');
  assert((await get('/tools/studio.html')).text.includes('ETERNAL VOID STUDIO'), "Studio's own page comes from this folder");
  assert.equal((await get('/.git/config')).status, 403);
  assert.equal((await get('/.studio/preview/index.html')).status, 404, 'no path from the preview into private folders');
  const state = JSON.parse((await get('/api/studio/state?target=live')).text);
  assert.equal(state.target, 'live');
  assert.equal(state.live, head);
  assert.equal(state.preview, head);
  assert(state.presets[state.order[0]]);
  assert.equal((await get('/api/studio/state?target=abc')).status, 400, 'bad pull request numbers are refused');
  server.close();
  console.log('PASS: Studio preview copy follows refs, serves the site, keeps private folders blocked, reads live state.');
} finally {
  try { git('worktree', 'remove', '--force', preview); } catch { /* not created */ }
  fs.rmSync(path.dirname(preview), { recursive: true, force: true });
}
