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
    const siteUrl = `http://127.0.0.1:${port}/index.html`;

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

    if (!wsUrl) {
        throw new Error('Failed to connect to Chrome DevTools port');
    }

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

    // Wait for page load
    await new Promise(resolve => {
        const timer = setTimeout(resolve, 2000);
        const onMsg = (msg) => {
            if (msg.method === 'Page.loadEventFired') {
                clearTimeout(timer);
                eventListeners.delete(onMsg);
                resolve();
            }
        };
        eventListeners.add(onMsg);
    });

    await new Promise(r => setTimeout(r, 800));

    // 1. Dismiss splash
    await send('Runtime.evaluate', {
        expression: `
            const enterBtn = document.getElementById('enter-standard-btn');
            if (enterBtn) enterBtn.click();
            const splash = document.getElementById('splash-screen');
            if (splash) splash.remove();
        `
    }, sessionId);

    await new Promise(r => setTimeout(r, 1500));

    // 2. Select preset 'liquid' (Jade Currents) - sets signature keys to manual!
    const presetRes = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const card = document.querySelector('.preset-card[data-preset="liquid"]');
                if (card) card.click();
                const banner = document.getElementById('flow-status-banner');
                const count = document.getElementById('flow-manual-count')?.textContent;
                const isHidden = banner?.classList.contains('hidden');
                return { isHidden, count };
            })()
        `,
        returnByValue: true
    }, sessionId);
    console.log('Preset loaded, banner state:', presetRes.result?.result?.value);

    await new Promise(r => setTimeout(r, 500));

    // Capture Snap 1: Banner visible at top center
    const snap1 = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const snap1Path = path.join(artifactDir, 'snap_flow_banner_top.png');
    fs.writeFileSync(snap1Path, Buffer.from(snap1.result.data, 'base64'));
    console.log('Saved snap 1:', snap1Path);

    // 3. Click the pill info button to open popover
    const popoverRes = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const infoBtn = document.getElementById('flow-status-info');
                if (infoBtn) infoBtn.click();
                const popover = document.getElementById('flow-manual-popover');
                const items = document.querySelectorAll('.flow-manual-item');
                return {
                    popoverHidden: popover?.classList.contains('hidden'),
                    itemCount: items.length
                };
            })()
        `,
        returnByValue: true
    }, sessionId);
    console.log('Popover opened:', popoverRes.result?.result?.value);

    await new Promise(r => setTimeout(r, 400));

    // Capture Snap 2: Popover open showing manual settings with X and toggles
    const snap2 = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const snap2Path = path.join(artifactDir, 'snap_flow_banner_popover.png');
    fs.writeFileSync(snap2Path, Buffer.from(snap2.result.data, 'base64'));
    console.log('Saved snap 2:', snap2Path);

    // 4. Click "BACK TO FLOW" button
    const resetRes = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const resetBtn = document.getElementById('flow-reset-all-btn');
                if (resetBtn) resetBtn.click();
                const banner = document.getElementById('flow-status-banner');
                const popover = document.getElementById('flow-manual-popover');
                return {
                    bannerHidden: banner?.classList.contains('hidden'),
                    popoverHidden: popover?.classList.contains('hidden')
                };
            })()
        `,
        returnByValue: true
    }, sessionId);
    console.log('Reset all clicked:', resetRes.result?.result?.value);

    await new Promise(r => setTimeout(r, 600));

    // Capture Snap 3: After reset, banner is smoothly hidden
    const snap3 = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const snap3Path = path.join(artifactDir, 'snap_flow_banner_reset.png');
    fs.writeFileSync(snap3Path, Buffer.from(snap3.result.data, 'base64'));
    console.log('Saved snap 3:', snap3Path);

    // Teardown
    ws.close();
    chrome.kill();
    server.close();
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
    console.log('All flow banner verification captures completed!');
}

main().catch(err => {
    console.error('Error during verification:', err);
    process.exit(1);
});
