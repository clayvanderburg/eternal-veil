const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const presetKey = process.argv[2] || 'liquid';
const durationMs = Number(process.argv[3]) || 3500;
const outputFile = process.argv[4] || path.resolve(__dirname, `preset_${presetKey}.png`);

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
        '--disable-gpu',
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

    // Dismiss splash screen, click the requested preset card, and hide UI for clear capture
    const evalRes = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const enterBtn = document.getElementById('enter-standard-btn');
                if (enterBtn) enterBtn.click();
                const splash = document.getElementById('splash-screen');
                if (splash) splash.remove();
                
                // Find and click preset card
                const card = document.querySelector('.preset-card[data-preset="${presetKey}"]');
                let clickedCard = false;
                if (card) {
                    card.click();
                    clickedCard = true;
                }
                
                // Hide HUD overlays for clean visual inspection
                const hud = document.querySelector('.hud-stats');
                if (hud) hud.style.display = 'none';
                const controls = document.getElementById('controls-panel');
                if (controls) controls.style.display = 'none';
                const dice = document.getElementById('hud-dice-controls');
                if (dice) dice.style.display = 'none';
                
                return {
                    clickedCard,
                    shape: window.sim?.settings?.particleShape,
                    activePreset: document.querySelector('.preset-card.active')?.dataset?.preset
                };
            })()
        `,
        returnByValue: true
    }, sessionId);

    console.log('Eval result:', evalRes.result?.result?.value);
    console.log(`Rendering preset "${presetKey}" for ${durationMs}ms...`);
    await new Promise(r => setTimeout(r, durationMs));

    // Capture screenshot
    const shotRes = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const buffer = Buffer.from(shotRes.result.data, 'base64');
    fs.writeFileSync(outputFile, buffer);
    console.log(`Saved screenshot to: ${outputFile}`);

    ws.close();
    chrome.kill('SIGTERM');
    server.close();
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
}

main().catch(err => {
    console.error('Capture error:', err);
    process.exit(1);
});
