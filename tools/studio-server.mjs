// Eternal Void Studio server — LOCAL ONLY.
//   node tools/studio-server.mjs        then open http://127.0.0.1:8820/tools/studio.html
//
// The preview runs from Studio's own copy of the site (.studio/preview), kept on the live
// code (origin/main) or on an open pull request being reviewed, so it never depends on
// which branch this folder has checked out. Drafts live in the browser. Publish writes
// every draft into a fresh git worktree (origin/main, or the reviewed pull request),
// commits them, and either opens one pull request or adds the commit to the one under
// review. The live site only changes when a PR is merged. Your working folder is never edited.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.STUDIO_PORT || 8820);
const GH = process.env.GH_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh');
const REPO = 'clayvanderburg/eternal-veil';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
// Uploaded songs wait here (git-ignored) until a publish copies them into the pull request.
const UPLOADS = process.env.STUDIO_UPLOADS || path.join(root, '.studio', 'uploads');
// Studio's own checkout of the site for the preview.
const PREVIEW = process.env.STUDIO_PREVIEW || path.join(root, '.studio', 'preview');
// What counts as live. Tests point this at a local ref; normally it is GitHub main.
const LIVE_REF = process.env.STUDIO_BASE || 'origin/main';
const REVIEWED_LABEL = 'studio-reviewed';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

// ---------- reading ----------
export function loadPresets(text) {
  const ctx = vm.createContext({});
  vm.runInContext(text + ';globalThis.__P = StylePresets; globalThis.__O = getOrderedPresetKeys();', ctx);
  return { presets: JSON.parse(JSON.stringify(ctx.__P)), order: [...ctx.__O] };
}
export function loadMusic(text) {
  const ctx = vm.createContext({ window: {} });
  ctx.window = ctx;
  vm.runInContext(text, ctx);
  const m = ctx.MusicMoods;
  return { profiles: JSON.parse(JSON.stringify(m.DEFAULT_PROFILES)), params: JSON.parse(JSON.stringify(m.PARAMS)), choices: JSON.parse(JSON.stringify(m.CHOICES)) };
}

// ---------- writing presets.js ----------
const COLOR = /^#[0-9a-fA-F]{6}$/;
function formatValue(value) {
  if (value === null) return 'null'; // "auto" for optional Flow fields
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 100000) throw new Error('Number out of range');
    return String(Math.round(value * 10000) / 10000);
  }
  if (Array.isArray(value)) {
    if (!value.length || value.length > 8 || !value.every(c => typeof c === 'string' && COLOR.test(c))) throw new Error('Colors must be 1–8 #rrggbb values');
    return '[' + value.map(c => `"${c.toLowerCase()}"`).join(', ') + ']';
  }
  if (typeof value === 'string' && /^[A-Za-z]{1,40}$/.test(value)) return `"${value}"`;
  if (value && typeof value === 'object') {
    // flowRanges: { field: [min, max] }
    const entries = Object.entries(value);
    if (entries.length > 40) throw new Error('Too many Flow ranges');
    const parts = entries.map(([field, range]) => {
      if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(field) || !Array.isArray(range) || range.length !== 2 || !range.every(n => typeof n === 'number' && Number.isFinite(n))) {
        throw new Error(`Bad Flow range for ${field}`);
      }
      return `${field}: [${formatValue(Math.min(...range))}, ${formatValue(Math.max(...range))}]`;
    });
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  throw new Error('Unsupported value');
}
function presetBlock(text, key) {
  let start = text.indexOf(`\n    ${key}: {\n`);
  if (start >= 0) { start += 1; const end = text.indexOf('\n    },', start); return { start, end, indent: '        ' }; }
  start = text.indexOf(`\nStylePresets.${key} = {\n`);
  if (start >= 0) { start += 1; const end = text.indexOf('\n};', start); return { start, end, indent: '    ' }; }
  throw new Error(`Preset ${key} not found`);
}
// Writers work on LF text and hand back the file's own line endings.
const withEol = (text, edit) => {
  const crlf = text.includes('\r\n');
  const out = edit(text.replace(/\r\n/g, '\n'));
  return crlf ? out.replace(/\n/g, '\r\n') : out;
};
export function applyPresetChanges(text, key, changes) {
  return withEol(text, lf => applyPresetChangesLf(lf, key, changes));
}
function applyPresetChangesLf(text, key, changes) {
  const known = loadPresets(text).presets[key];
  if (!known) throw new Error(`Unknown preset ${key}`);
  const { start, end, indent } = presetBlock(text, key);
  let block = text.slice(start, end);
  for (const [field, value] of Object.entries(changes)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(field) || ['name', 'desc', 'addedOn'].includes(field)) throw new Error(`Field ${field} can't be edited here`);
    const flowField = /^flow[A-Z]/.test(field);
    if (!(field in known) && !flowField && typeof value !== 'number' && typeof value !== 'boolean') throw new Error(`Unknown field ${field}`);
    if (!flowField && (value === null || (typeof value === 'object' && !Array.isArray(value)))) throw new Error(`Field ${field} needs a value`);
    const formatted = formatValue(value);
    const pattern = new RegExp(`(^|[\\s,{])(${field}:\\s*)(\\{[^}]*\\}|\\[[^\\]]*\\]|"[^"]*"|[^,\\n}]+)`, 'm');
    if (pattern.test(block)) block = block.replace(pattern, (m, pre, label) => `${pre}${label}${formatted}`);
    else {
      // Inherited or new field: add it as this preset's own line, after name/desc.
      const lines = block.split('\n');
      let at = 1;
      for (let i = 1; i < lines.length; i++) if (/^\s*(name|desc|addedOn|\.\.\.)/.test(lines[i])) at = i + 1;
      lines.splice(at, 0, `${indent}${field}: ${formatted},`);
      block = lines.join('\n');
    }
  }
  const out = text.slice(0, start) + block + text.slice(end);
  const check = loadPresets(out).presets[key];
  for (const [field, value] of Object.entries(changes)) {
    const got = check[field];
    const ok = Array.isArray(value) ? JSON.stringify(got) === JSON.stringify(value.map(c => c.toLowerCase()))
      : value && typeof value === 'object' ? Object.entries(value).every(([f, r]) => Math.abs(got?.[f]?.[0] - Math.min(...r)) < 1e-3 && Math.abs(got?.[f]?.[1] - Math.max(...r)) < 1e-3)
      : typeof value === 'number' ? Math.abs(got - value) < 1e-3 : got === value;
    if (!ok) throw new Error(`Couldn't write ${key}.${field} safely`);
  }
  return out;
}

// ---------- writing music-moods.js ----------
function formatProfile(profile, meta) {
  const parts = [];
  for (const [k, v] of Object.entries(profile)) {
    if (k === 'ripple') {
      if (!v) continue;
      const dirs = meta.choices['ripple.dir'], tos = meta.choices['ripple.to'];
      if (!dirs.includes(v.dir) || !tos.includes(v.to)) throw new Error('Bad ripple choice');
      parts.push(`ripple: { amp: ${num(v.amp, 'ripple.amp', meta)}, dir: '${v.dir}', freq: ${num(v.freq, 'ripple.freq', meta)}, to: '${v.to}' }`);
    } else parts.push(`${k}: ${num(v, k, meta)}`);
  }
  return `{ ${parts.join(', ')} }`;
}
function num(v, key, meta) {
  const p = meta.params.find(x => x.key === key);
  const n = Number(v);
  if (!p || !Number.isFinite(n)) throw new Error(`Bad music value ${key}`);
  const clamped = Math.round(Math.min(p.max, Math.max(p.min, n)) * 1000) / 1000;
  return String(clamped).replace(/^(-?)0\./, '$1.');
}
export function applyMusicChange(text, shape, profile) {
  return withEol(text, lf => applyMusicChangeLf(lf, shape, profile));
}
function applyMusicChangeLf(text, shape, profile) {
  const meta = loadMusic(text);
  if (!meta.profiles[shape]) throw new Error(`No music card for ${shape}`);
  const line = new RegExp(`^(\\s+${shape}:\\s*)\\{.*\\},\\s*$`, 'm');
  if (!line.test(text)) throw new Error(`Music card line for ${shape} not found`);
  const out = text.replace(line, (m, pre) => `${pre}${formatProfile(profile, meta)},`);
  loadMusic(out);
  return out;
}

// ---------- music catalog (js/music-catalog.js) ----------
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
export function loadCatalog(text) {
  const ctx = vm.createContext({});
  ctx.window = ctx;
  vm.runInContext(text, ctx);
  return JSON.parse(JSON.stringify(ctx.EternalMusicCatalog));
}
// Checks a catalog sent by the Studio and returns a clean copy (known fields only).
export function cleanCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.tracks) || !Array.isArray(catalog.playlists)) throw new Error('Catalog needs tracks and playlists');
  if (catalog.tracks.length > 500 || catalog.playlists.length > 50) throw new Error('Too many songs or playlists');
  const ids = new Set();
  const tracks = catalog.tracks.map(t => {
    if (!t || !SLUG.test(t.id) || ids.has(t.id)) throw new Error(`Bad or repeated song id ${t && t.id}`);
    ids.add(t.id);
    const title = String(t.title || '').trim().slice(0, 80);
    if (!title) throw new Error(`Song ${t.id} needs a title`);
    const duration = Math.round(Number(t.duration) * 100) / 100;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 4 * 3600) throw new Error(`Song ${t.id} has a bad length`);
    if (t.upload && !/^[a-f0-9]{16}$/.test(t.upload)) throw new Error(`Song ${t.id} has a bad upload`);
    const url = t.upload ? `audio/library/${t.id}.mp3` : String(t.url || '');
    if (!/^audio\/[a-z0-9-]+\/[a-z0-9-]+\.mp3$/.test(url)) throw new Error(`Song ${t.id} has a bad file path`);
    return { id: t.id, title, duration, url, ...(t.upload ? { upload: t.upload } : {}) };
  });
  const listIds = new Set();
  const playlists = catalog.playlists.map(p => {
    if (!p || !SLUG.test(p.id) || p.id === 'favorites' || p.id.startsWith('custom-') || listIds.has(p.id)) throw new Error(`Bad or repeated playlist id ${p && p.id}`);
    listIds.add(p.id);
    const name = String(p.name || '').trim().slice(0, 60);
    if (!name) throw new Error(`Playlist ${p.id} needs a name`);
    const list = Array.isArray(p.tracks) ? p.tracks : [];
    if (list.some(id => !ids.has(id))) throw new Error(`Playlist ${name} uses a song that isn't in the library`);
    return { id: p.id, name, tracks: [...new Set(list)] };
  });
  if (!playlists.length) throw new Error('Keep at least one playlist');
  return { tracks, playlists };
}
const oneLine = obj => '    { ' + Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${Array.isArray(v) ? `[${v.map(x => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v)}`).join(', ') + ' }';
export function writeCatalog(text, catalog) {
  return withEol(text, lf => {
    const start = lf.indexOf('const CATALOG = ');
    const end = lf.indexOf('\n};\n', start);
    if (start < 0 || end < 0) throw new Error('CATALOG block not found in js/music-catalog.js');
    const strip = ({ upload, ...t }) => t;
    const body = ['{', '  "tracks": [', catalog.tracks.map(t => oneLine(strip(t))).join(',\n'), '  ],',
      '  "playlists": [', catalog.playlists.map(oneLine).join(',\n'), '  ]'].join('\n');
    const out = lf.slice(0, start) + 'const CATALOG = ' + body + lf.slice(end);
    const want = { tracks: catalog.tracks.map(strip), playlists: catalog.playlists };
    if (JSON.stringify(loadCatalog(out)) !== JSON.stringify(want)) throw new Error("Couldn't write the music catalog safely");
    return out;
  });
}

// Saves an uploaded song as MP3 (other formats are converted with ffmpeg) and measures it.
export async function receiveUpload(req, name) {
  fs.mkdirSync(UPLOADS, { recursive: true });
  const ext = (path.extname(String(name || '')).toLowerCase().match(/^\.(mp3|wav|flac|ogg|oga|m4a|aac|aif|aiff|opus|webm)$/) || [])[0];
  if (!ext) throw new Error('Use an MP3, WAV, FLAC, OGG, M4A, AAC, AIFF or Opus file');
  const id = crypto.randomBytes(8).toString('hex');
  const raw = path.join(UPLOADS, `${id}-source${ext}`), out = path.join(UPLOADS, `${id}.mp3`);
  const file = fs.createWriteStream(raw);
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 400 * 1024 * 1024) throw new Error('That file is over 400 MB');
      if (!file.write(chunk)) await new Promise(r => file.once('drain', r));
    }
    await new Promise((resolve, reject) => file.end(err => err ? reject(err) : resolve()));
    if (!size) throw new Error('That file is empty');
    if (ext === '.mp3') fs.renameSync(raw, out);
    else {
      execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', raw, '-vn', '-codec:a', 'libmp3lame', '-b:a', '192k', out], { stdio: ['ignore', 'ignore', 'pipe'] });
      fs.rmSync(raw, { force: true });
    }
    const duration = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).trim());
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Couldn't read that song's length");
    const mb = fs.statSync(out).size / 1048576;
    if (mb > 60) throw new Error(`That song is ${Math.round(mb)} MB as MP3; keep songs under 60 MB`);
    return { upload: id, duration: Math.round(duration * 100) / 100, sizeMb: Math.round(mb * 10) / 10 };
  } catch (error) {
    file.destroy();
    fs.rmSync(raw, { force: true }); fs.rmSync(out, { force: true });
    throw new Error(error.stderr ? `ffmpeg couldn't read that file (${String(error.stderr).trim().split('\n').pop()})` : error.message);
  }
}

// ---------- git / PR ----------
const git = (cwd, ...args) => execFileSync('git', ['-c', 'safe.directory=*', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// Fetch GitHub main at most every 20 seconds (offline: keep the last fetched main).
let lastFetch = 0;
function fetchLive(force = false) {
  if (LIVE_REF !== 'origin/main' || (!force && Date.now() - lastFetch < 20000)) return;
  try { git(root, 'fetch', '-q', 'origin', 'main'); } catch { /* offline */ }
  lastFetch = Date.now();
}
// Presets, music cards and song catalog as they are at a git ref.
const refCache = new Map();
export function readRef(ref) {
  const sha = git(root, 'rev-parse', ref);
  if (refCache.has(sha)) return refCache.get(sha);
  const show = file => git(root, 'show', `${sha}:${file}`);
  let catalog = null;
  try { catalog = loadCatalog(show('js/music-catalog.js')); } catch { /* predates the catalog file */ }
  const value = { ...loadPresets(show('js/presets.js')), music: loadMusic(show('js/music-moods.js')), catalog, sha: sha.slice(0, 7) };
  refCache.set(sha, value);
  return value;
}
// ---------- pull requests waiting for review ----------
const PR_NUMBER = /^[1-9][0-9]{0,6}$/;
const prRef = n => `refs/studio/pr-${n}`;
function gh(...args) { return execFileSync(GH, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function prMeta(n) {
  if (!PR_NUMBER.test(String(n))) throw new Error('Bad pull request number');
  const meta = JSON.parse(gh('pr', 'view', String(n), '--repo', REPO, '--json', 'number,title,url,state,headRefName,isCrossRepository,labels'));
  if (meta.state !== 'OPEN') throw new Error(`Pull request #${n} is ${meta.state.toLowerCase()}`);
  if (meta.isCrossRepository) throw new Error(`Pull request #${n} comes from another repository; Studio only reviews this repository's branches`);
  git(root, 'fetch', '-q', 'origin', `+pull/${n}/head:${prRef(n)}`);
  return { number: meta.number, title: meta.title, url: meta.url, branch: meta.headRefName, reviewed: meta.labels.some(l => l.name === REVIEWED_LABEL) };
}
let candidatesCache = { at: 0, value: null };
function listCandidates() {
  if (candidatesCache.value && Date.now() - candidatesCache.at < 30000) return candidatesCache.value;
  const prs = JSON.parse(gh('pr', 'list', '--repo', REPO, '--state', 'open', '--limit', '40', '--json', 'number,title,headRefName,isCrossRepository,files,labels,updatedAt'));
  const watched = ['js/presets.js', 'js/music-moods.js', 'js/music-catalog.js'];
  const value = prs.filter(pr => !pr.isCrossRepository && pr.files.some(f => watched.includes(f.path)))
    .map(pr => ({ number: pr.number, title: pr.title, branch: pr.headRefName, updatedAt: pr.updatedAt,
      reviewed: pr.labels.some(l => l.name === REVIEWED_LABEL), presets: pr.files.some(f => f.path === 'js/presets.js') }));
  candidatesCache = { at: Date.now(), value };
  return value;
}
// ---------- the preview copy ----------
// Moves .studio/preview to a ref (live or a pull request), creating it the first time.
export function syncPreview(ref) {
  const sha = git(root, 'rev-parse', ref);
  const isTree = fs.existsSync(path.join(PREVIEW, '.git'));
  if (!isTree) {
    fs.rmSync(PREVIEW, { recursive: true, force: true });
    try { git(root, 'worktree', 'prune'); } catch { /* nothing to prune */ }
    fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
    git(root, 'worktree', 'add', '-q', '--detach', PREVIEW, sha);
  } else if (git(PREVIEW, 'rev-parse', 'HEAD') !== sha) {
    git(PREVIEW, 'checkout', '-q', '--detach', '-f', sha);
    git(PREVIEW, 'clean', '-fdq');
  }
  return sha.slice(0, 7);
}
// Everything the Studio page needs for one target ('live' or a PR number).
function studioState(target) {
  fetchLive();
  const live = readRef(LIVE_REF);
  if (target === 'live') return { ...live, live: live.sha, preview: syncPreview(LIVE_REF), target: 'live' };
  const candidate = prMeta(target);
  const cand = readRef(prRef(target));
  const newKeys = cand.order.filter(k => !live.presets[k]);
  return { ...cand, live: live.sha, preview: syncPreview(prRef(target)), target: candidate.number, candidate: { ...candidate, newKeys } };
}
function markReviewed(n) {
  const meta = prMeta(n);
  gh('label', 'create', REVIEWED_LABEL, '--repo', REPO, '--color', '6ee7b7', '--description', 'Tuned and approved in Eternal Void Studio', '--force');
  gh('pr', 'edit', String(meta.number), '--repo', REPO, '--add-label', REVIEWED_LABEL);
  candidatesCache.at = 0;
  return { ok: true, url: meta.url };
}

// One pull request for every drafted preset and music card.
function openPullRequest({ presets = {}, music = {}, catalog = null, note, target = 'live' }) {
  const review = target === 'live' ? null : prMeta(target);
  const presetKeys = Object.keys(presets).filter(k => presets[k] && Object.keys(presets[k]).length);
  const shapes = Object.keys(music).filter(k => music[k]);
  const songs = catalog ? cleanCatalog(catalog) : null;
  if (songs) for (const t of songs.tracks) if (t.upload && !fs.existsSync(path.join(UPLOADS, `${t.upload}.mp3`))) throw new Error(`The upload for "${t.title}" is missing; add that song again`);
  if (!presetKeys.length && !shapes.length && !songs) throw new Error('Nothing to publish');
  if (presetKeys.length + shapes.length > 60) throw new Error('Too many drafts in one pull request');
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const branch = `studio/${stamp}-${presetKeys[0] || shapes[0] || 'music'}${presetKeys.length + shapes.length + (songs ? 1 : 0) > 1 ? '-and-more' : ''}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-studio-'));
  fetchLive(true);
  // Reviewing a pull request: commit on top of it (detached), then push to its branch.
  if (review) git(root, 'worktree', 'add', '-q', '--detach', dir, prRef(review.number));
  else git(root, 'worktree', 'add', '-q', '-b', branch, dir, LIVE_REF);
  try {
    const files = [];
    const presetFile = path.join(dir, 'js', 'presets.js');
    let presetText = fs.readFileSync(presetFile, 'utf8');
    const names = loadPresets(presetText).presets;
    const lines = [];
    for (const key of presetKeys) {
      presetText = applyPresetChanges(presetText, key, presets[key]);
      lines.push(`### ${names[key]?.name || key}`, ...Object.entries(presets[key]).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`), '');
    }
    if (presetKeys.length) { fs.writeFileSync(presetFile, presetText); files.push('js/presets.js'); }
    if (shapes.length) {
      const musicFile = path.join(dir, 'js', 'music-moods.js');
      let musicText = fs.readFileSync(musicFile, 'utf8');
      for (const shape of shapes) {
        musicText = applyMusicChange(musicText, shape, music[shape]);
        lines.push(`### Music card: ${shape}`, `- ${JSON.stringify(music[shape])}`, '');
      }
      fs.writeFileSync(musicFile, musicText);
      files.push('js/music-moods.js');
    }
    if (songs) {
      const catalogFile = path.join(dir, 'js', 'music-catalog.js');
      if (!fs.existsSync(catalogFile)) throw new Error('The live site has no music catalog yet: merge the Studio music update first');
      const catalogText = fs.readFileSync(catalogFile, 'utf8');
      const before = loadCatalog(catalogText);
      fs.mkdirSync(path.join(dir, 'audio', 'library'), { recursive: true });
      for (const t of songs.tracks) {
        if (!t.upload) continue;
        fs.copyFileSync(path.join(UPLOADS, `${t.upload}.mp3`), path.join(dir, t.url));
        files.push(t.url);
      }
      // Songs the Studio added earlier and that are now removed: delete their files too.
      const keep = new Set(songs.tracks.map(t => t.url));
      for (const t of before.tracks) {
        if (keep.has(t.url) || !t.url.startsWith('audio/library/') || !fs.existsSync(path.join(dir, t.url))) continue;
        git(dir, 'rm', '-q', t.url);
      }
      fs.writeFileSync(catalogFile, writeCatalog(catalogText, songs));
      files.push('js/music-catalog.js');
      const indexFile = path.join(dir, 'index.html');
      const indexText = fs.readFileSync(indexFile, 'utf8');
      const bumped = indexText.replace(/js\/music-catalog\.js\?v=[A-Za-z0-9-]+/, `js/music-catalog.js?v=${stamp}`);
      if (bumped !== indexText) { fs.writeFileSync(indexFile, bumped); files.push('index.html'); }
      const beforeIds = new Set(before.tracks.map(t => t.id)), afterIds = new Set(songs.tracks.map(t => t.id));
      const added = songs.tracks.filter(t => !beforeIds.has(t.id)).map(t => t.title);
      const removed = before.tracks.filter(t => !afterIds.has(t.id)).map(t => t.title);
      lines.push('### Music playlists',
        ...(added.length ? [`- New songs: ${added.join(', ')}`] : []),
        ...(removed.length ? [`- Removed songs: ${removed.join(', ')}`] : []),
        ...songs.playlists.map(p => `- ${p.name}: ${p.tracks.length} song${p.tracks.length === 1 ? '' : 's'}`), '');
    }
    const titled = [...presetKeys.map(k => names[k]?.name || k), ...shapes.map(s => `${s} music`), ...(songs ? ['music playlists'] : [])];
    const title = `Studio: tune ${titled.length <= 3 ? titled.join(', ') : `${titled.slice(0, 3).join(', ')} and ${titled.length - 3} more`}${review ? ` (review of #${review.number})` : ''}`;
    const body = `Tuned in Eternal Void Studio.\n\n${lines.join('\n')}${note ? `\nNote: ${String(note).slice(0, 500)}\n` : ''}\nMerging publishes to eternalvoid.io.`;
    git(dir, 'add', ...files);
    git(dir, 'commit', '-q', '-m', `${title}\n\n${lines.join('\n')}`);
    if (process.env.STUDIO_DRY_RUN) {
      // Test mode: everything up to the commit, then report the diff and discard the branch.
      const diff = git(dir, 'show', '--stat', '--format=%s', 'HEAD');
      const catalogAfter = songs ? fs.readFileSync(path.join(dir, 'js', 'music-catalog.js'), 'utf8') : null;
      git(root, 'worktree', 'remove', '--force', dir);
      if (!review) git(root, 'branch', '-D', branch);
      return { url: 'dry-run', branch: review ? review.branch : branch, diff, catalogAfter, review: !!review };
    }
    const auth = ['-c', 'credential.helper=', '-c', `credential.helper=!"${GH.replace(/\\/g, '/')}" auth git-credential`];
    if (review) {
      // Plain push (never forced): if the branch moved since the preview loaded, this fails safely.
      try { git(dir, ...auth, 'push', '-q', 'origin', `HEAD:refs/heads/${review.branch}`); }
      catch { throw new Error(`Pull request #${review.number} changed since Studio loaded it. Reload Studio and save your drafts again.`); }
      candidatesCache.at = 0;
      return { url: review.url, branch: review.branch, review: true };
    }
    git(dir, ...auth, 'push', '-q', '-u', 'origin', branch);
    const url = execFileSync(GH, ['pr', 'create', '--repo', REPO, '--base', 'main', '--head', branch, '--title', title, '--body', body], { encoding: 'utf8' }).trim();
    return { url, branch };
  } finally {
    try { git(root, 'worktree', 'remove', '--force', dir); } catch { /* already removed */ }
  }
}

// ---------- server ----------
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
export function createStudioServer() {
  return http.createServer(async (req, res) => {
    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(res, 403, { error: 'Studio runs locally only.' });
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'Origin rejected.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/api/studio/state') {
        const t = url.searchParams.get('target') || 'live';
        return send(res, 200, studioState(t === 'live' ? 'live' : Number(t)));
      }
      if (url.pathname === '/api/studio/live') {
        // Cheap poll: has the live site moved on since the page loaded?
        fetchLive();
        return send(res, 200, { live: git(root, 'rev-parse', '--short', LIVE_REF) });
      }
      if (url.pathname === '/api/studio/candidates') return send(res, 200, { candidates: listCandidates() });
      if (url.pathname === '/api/studio/review' && req.method === 'POST') {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return send(res, 413, { error: 'Too large.' }); }
        return send(res, 200, markReviewed(Number(JSON.parse(raw || '{}').target)));
      }
      if (url.pathname === '/api/studio/upload' && req.method === 'POST') {
        return send(res, 200, await receiveUpload(req, url.searchParams.get('name')));
      }
      if (url.pathname === '/api/studio/publish' && req.method === 'POST') {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1048576) return send(res, 413, { error: 'Too large.' }); }
        const body = JSON.parse(raw || '{}');
        return send(res, 200, openPullRequest(body));
      }
      if (req.method !== 'GET') return send(res, 404, { error: 'Not found.' });
      const rel = decodeURIComponent(url.pathname === '/' ? '/tools/studio.html' : url.pathname);
      // Studio's own page and uploads come from this folder; the site itself from the preview copy.
      const own = rel.startsWith('/tools/studio') || rel.startsWith('/.studio/uploads/');
      const base = own || !fs.existsSync(path.join(PREVIEW, 'index.html')) ? root : PREVIEW;
      const file = path.resolve(base, '.' + rel);
      if (!file.startsWith(base + path.sep) || file.includes(`${path.sep}.git${path.sep}`) || (base === root && !own && file.startsWith(path.join(root, '.studio')))) return send(res, 403, { error: 'Invalid path.' });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'Not found.' });
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      send(res, 400, { error: error.message || 'Request failed.' });
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createStudioServer().listen(PORT, '127.0.0.1', () => console.log(`Eternal Void Studio: http://127.0.0.1:${PORT}/tools/studio.html`));
}
