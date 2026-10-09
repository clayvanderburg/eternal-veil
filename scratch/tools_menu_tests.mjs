// Tools menu (tools/index.html): every tool page in tools/ is listed, and the Studio server
// gives one address for all of them: / and /tools go to /tools/, the menu is served from this
// folder, labs answer HEAD (the menu's "is it here?" check) without a body.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const menu = fs.readFileSync(path.join(root, 'tools/index.html'), 'utf8');
const listed = [...menu.matchAll(/file: '([^']+\.html)'/g)].map(m => m[1]);
const pages = fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.html') && f !== 'index.html');
for (const page of pages) assert(listed.includes(page), `tools/${page} is listed in the tools menu`);
assert.equal(new Set(listed).size, listed.length, 'each tool listed once');
assert(/<meta name="robots" content="noindex">/.test(menu), 'menu stays out of search engines');

// Serve from this folder (no preview copy) on a free port.
process.env.STUDIO_PREVIEW = path.join(os.tmpdir(), `no-preview-${process.pid}`);
const { createStudioServer } = await import('../tools/studio-server.mjs');
const server = createStudioServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
    for (const p of ['/', '/tools']) {
        const r = await fetch(base + p, { redirect: 'manual' });
        assert.equal(r.status, 302, `${p} redirects`);
        assert.equal(r.headers.get('location'), '/tools/');
    }
    const r = await fetch(base + '/tools/');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /ETERNAL VOID TOOLS/, '/tools/ is the menu');
    const head = await fetch(base + '/tools/music-lab.html', { method: 'HEAD' });
    assert.equal(head.status, 200, 'labs answer HEAD');
    assert.equal((await head.text()).length, 0, 'HEAD has no body');
    assert.equal((await fetch(base + '/tools/not-a-tool.html', { method: 'HEAD' })).status, 404, 'missing tool: 404');
    assert.equal((await fetch(base + '/tools/studio.html')).status, 200, 'Studio still at /tools/studio.html');

    // The steady name: void.localhost (any *.localhost) is accepted; other sites are not.
    const { isLocalHost } = await import('../tools/studio-server.mjs');
    for (const h of ['void.localhost', 'void.localhost:80', 'studio.localhost:8820', 'localhost', '127.0.0.1:8820', '[::1]:8820']) assert(isLocalHost(h), `${h} allowed`);
    for (const h of ['evil.com', 'void.localhost.evil.com', 'localhost.evil.com', '10.0.0.5', '', undefined, 'a.b.localhost']) assert(!isLocalHost(h), `${h} refused`);
    const http = await import('node:http');
    const withHost = (host, p = '/tools/') => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: server.address().port, path: p, headers: { host } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
    });
    assert.equal(await withHost('void.localhost'), 200, 'served at void.localhost');
    assert.equal(await withHost('evil.com'), 403, 'other hosts refused');
} finally {
    server.close();
}

// listenLocal: IPv4 + IPv6 loopback; a busy port is reported, not fatal.
{
    const { listenLocal } = await import('../tools/studio-server.mjs');
    const first = await listenLocal(0);
    assert(first.some(r => r.server), 'listens on loopback');
    const port = first.find(r => r.server).server.address().port;
    const again = await listenLocal(port);
    assert(again.find(r => r.host === '127.0.0.1').error, 'busy port reported');
    for (const r of [...first, ...again]) r.server?.close();
}
const serverSource = fs.readFileSync(path.join(root, 'tools/studio-server.mjs'), 'utf8');
assert(serverSource.includes("const NAME = 'void.localhost';") && /STUDIO_NAME_PORT \?\? 80/.test(serverSource), 'void.localhost on port 80 by default');
console.log(`Tools menu: ${pages.length} tool pages listed; / and /tools lead to /tools/ on the Studio server.`);
