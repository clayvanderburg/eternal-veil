const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\MadKing\\.gemini\\antigravity\\brain\\cb600ee1-d737-455d-b5fa-4f6e7ba68089';

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(rootDir, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    // Create a realistic shared scene seed
    const sharedScene = {
        v: 1,
        s: 0.18,
        t: 0.45,
        d: 1800,
        o: 1.8,
        dp: 0.003,
        z: 1.0,
        sz: 4.0,
        sv: 2.0,
        st: 3.5,
        in: 1.2,
        mi: 0.8,
        mm: "repel",
        ke: 1,
        ks: 8,
        rs: 0.25,
        wb: 0.35,
        pm: 0,
        mb: 0,
        sk: 1,
        ps: "prismDrift",
        pl: "glow",
        se: 1,
        be: 0,
        ae: 0,
        bm: "theta",
        p: ["#00f0ff", "#7000ff", "#ff0077"],
        bg: "#080614",
        sm: 0,
        ap: 0,
        vm: 0,
        vs: "native"
    };
    const json = JSON.stringify(sharedScene);
    const seed = Buffer.from(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (m, p) => String.fromCharCode(parseInt(p, 16)))).toString('base64');
    const siteUrl = `http://127.0.0.1:${port}/index.html#seed=${seed}`;

    console.log('Testing shared scene URL with seed...');

    const cdpPort = 9200 + Math.floor(Math.random() * 500);
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-cdp-'));
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const chrome = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${tempProfile}`,
        '--no-first-run',
        '--hide-scrollbars',
        '--window-size=1280,720',
        siteUrl
    ], { stdio: 'ignore' });

    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 150));
        try {
            const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
            if (res.ok) {
                const data = await res.json();
                wsUrl = data.webSocketDebuggerUrl;
                break;
            }
        } catch (_) {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome DevTools port');

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();
    const eventListeners = new Set();

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id)(msg);
            callbacks.delete(msg.id);
        }
        for (const listener of eventListeners) {
            listener(msg);
        }
    };

    const send = (method, params = {}, sessionId = undefined) => {
        return new Promise((resolve) => {
            const id = msgId++;
            callbacks.set(id, resolve);
            ws.send(JSON.stringify({ id, method, params, sessionId }));
        });
    };

    await new Promise(r => ws.onopen = r);

    const targetsRes = await send('Target.getTargets');
    const pageTarget = targetsRes.result.targetInfos.find(t => t.type === 'page');
    const attachRes = await send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });
    const sessionId = attachRes.result.sessionId;

    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);

    // Wait for load
    await new Promise(r => setTimeout(r, 1800));

    // Dismiss splash
    await send('Runtime.evaluate', {
        expression: `
            const enterBtn = document.getElementById('enter-standard-btn');
            if (enterBtn) enterBtn.click();
            const splash = document.getElementById('splash-screen');
            if (splash) splash.remove();
        `
    }, sessionId);

    await new Promise(r => setTimeout(r, 800));

    // Check banner state on shared scene
    const bannerState = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const banner = document.getElementById('flow-status-banner');
                const count = document.getElementById('flow-manual-count')?.textContent;
                const isHidden = banner?.classList.contains('hidden');
                return { isHidden, count, shape: window.sim?.settings?.particleShape };
            })()
        `,
        returnByValue: true
    }, sessionId);
    console.log('Shared scene loaded, banner check:', bannerState.result?.result?.value);

    // Capture screenshot of shared scene showing Back To Flow banner
    const snap1 = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const snap1Path = path.join(artifactDir, 'snap_shared_scene_banner.png');
    fs.writeFileSync(snap1Path, Buffer.from(snap1.result.data, 'base64'));
    console.log('Saved snap 1:', snap1Path);

    // Click "BACK TO FLOW"
    const resetRes = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const resetBtn = document.getElementById('flow-reset-all-btn');
                if (resetBtn) resetBtn.click();
                const banner = document.getElementById('flow-status-banner');
                return {
                    bannerHidden: banner?.classList.contains('hidden')
                };
            })()
        `,
        returnByValue: true
    }, sessionId);
    console.log('Reset all clicked on shared scene:', resetRes.result?.result?.value);

    await new Promise(r => setTimeout(r, 500));

    const snap2 = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const snap2Path = path.join(artifactDir, 'snap_shared_scene_reset.png');
    fs.writeFileSync(snap2Path, Buffer.from(snap2.result.data, 'base64'));
    console.log('Saved snap 2:', snap2Path);

    ws.close();
    chrome.kill();
    server.close();
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
    console.log('Shared scene verification complete!');
}

main().catch(err => {
    console.error('Error during verification:', err);
    process.exit(1);
});
