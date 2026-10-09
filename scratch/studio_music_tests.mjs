// Studio Music tab back end: catalog read/write round trip, validation, and a real upload
// (WAV converted to MP3 by ffmpeg, then measured). Run: node scratch/studio_music_tests.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.STUDIO_UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-uploads-'));
const studio = await import(pathToUrl(path.join(root, 'tools', 'studio-server.mjs')));
function pathToUrl(p) { return 'file:///' + p.replace(/\\/g, '/'); }

const text = fs.readFileSync(path.join(root, 'js', 'music-catalog.js'), 'utf8');
const live = studio.loadCatalog(text);
assert(live.tracks.length >= 6 && live.playlists.some(p => p.id === 'nocturnal'), 'reads the shipped catalog');
assert.equal(studio.writeCatalog(text, studio.cleanCatalog(live)), text, 'writing the same catalog changes nothing');

const next = studio.cleanCatalog({
  tracks: [...live.tracks, { id: 'test-song', title: '  Test Song ', duration: 12.345, upload: '0123456789abcdef', extra: 'dropped' }],
  playlists: [{ id: 'evening', name: 'Evening', tracks: ['test-song', 'undertow', 'undertow'] }, ...live.playlists]
});
assert.equal(next.tracks.at(-1).url, 'audio/library/test-song.mp3', 'new songs live in audio/library');
assert.equal(next.tracks.at(-1).title, 'Test Song');
assert(!('extra' in next.tracks.at(-1)));
assert.deepEqual(next.playlists[0].tracks, ['test-song', 'undertow'], 'repeats removed');
const written = studio.loadCatalog(studio.writeCatalog(text, next));
assert.equal(written.playlists[0].name, 'Evening');
assert(!('upload' in written.tracks.at(-1)), 'upload ids never reach the site');

const bad = [
  { tracks: [{ id: 'Bad Id', title: 'x', duration: 1, url: 'audio/a/b.mp3' }], playlists: [{ id: 'p', name: 'p', tracks: [] }] },
  { tracks: [{ id: 'a', title: 'x', duration: 1, url: '../../etc/passwd' }], playlists: [{ id: 'p', name: 'p', tracks: [] }] },
  { tracks: [{ id: 'a', title: 'x', duration: 1, url: 'audio/a/a.mp3' }], playlists: [{ id: 'p', name: 'p', tracks: ['missing'] }] },
  { tracks: [{ id: 'a', title: 'x', duration: 1, url: 'audio/a/a.mp3' }], playlists: [{ id: 'favorites', name: 'f', tracks: [] }] },
  { tracks: [{ id: 'a', title: 'x', duration: 1, url: 'audio/a/a.mp3' }], playlists: [] }
];
for (const c of bad) assert.throws(() => studio.cleanCatalog(c));

// The site's library reads the catalog for built-in playlists.
const MusicLibrary = (await import(pathToUrl(path.join(root, 'js', 'music-library.js')))).default;
const lib = new MusicLibrary({ getItem: () => null, setItem() {} });
assert.equal(lib.defaultPlaylist, live.playlists[0].id, 'the first playlist is the default');
assert.deepEqual(lib.trackIds(live.playlists[0].id), live.playlists[0].tracks);

// Real upload: one second of tone as WAV, converted to MP3.
const wav = path.join(process.env.STUDIO_UPLOADS, 'tone.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', wav]);
const up = await studio.receiveUpload(Readable.from([fs.readFileSync(wav)]), 'My Tone.wav');
assert(/^[a-f0-9]{16}$/.test(up.upload) && Math.abs(up.duration - 1) < 0.1, 'wav converted and measured');
assert(fs.existsSync(path.join(process.env.STUDIO_UPLOADS, `${up.upload}.mp3`)));
await assert.rejects(studio.receiveUpload(Readable.from([Buffer.from('hi')]), 'notes.txt'), /MP3, WAV/);
await assert.rejects(studio.receiveUpload(Readable.from([Buffer.from('not audio at all')]), 'fake.wav'), /ffmpeg/);
fs.rmSync(process.env.STUDIO_UPLOADS, { recursive: true, force: true });
console.log('PASS: Studio music catalog round trip, validation, library playlists, WAV upload conversion.');
