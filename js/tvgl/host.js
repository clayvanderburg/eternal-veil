// ==========================================================================
// ETERNAL VOID - TV RENDERER (WebGL2) - HOST
// Page-side API for the GPU renderer. Runs the engine in a worker with an
// OffscreenCanvas when the browser can (physics and drawing on another core),
// otherwise on the page. Same API either way:
//
//   const tv = await TvGL.create(canvas, { width, height, resolution, every });
//   tv.setSettings(sim.settings)    // plain values; send whenever they change
//   tv.setPalette(["#6366f1", "hsl(260, 80%, 70%)", ...])
//   tv.setBackground("#000000")
//   tv.shockwave(x, y, force, speed, widthPx) / tv.vortex(x, y, radius, strength, life)
//   tv.resize(width, height, resolution); tv.pause(true|false); tv.destroy()
//   tv.onStats = ({ fps, count, workMs, targetFps }) => {}
//   tv.mode  -> "worker" | "page"
// Needs js/tvgl/core.js loaded on the page for the page fallback.
// ==========================================================================

(function () {
    "use strict";

    const scriptSrc = (document.currentScript && document.currentScript.src) || "";
    const scriptBase = scriptSrc ? scriptSrc.slice(0, scriptSrc.lastIndexOf("/") + 1) : "js/tvgl/";
    // The page's cache version (?v=...) travels to the worker and its imports.
    const scriptVersion = scriptSrc.includes("?") ? scriptSrc.slice(scriptSrc.indexOf("?")) : "";

    // CSS colour -> [r, g, b, a] in 0..1, using the browser's own parser.
    let probe = null;
    function parseColor(css) {
        if (!probe) probe = document.createElement("canvas").getContext("2d");
        probe.fillStyle = "#000";
        probe.fillStyle = String(css);
        const v = probe.fillStyle;
        if (v[0] === "#") {
            const n = parseInt(v.slice(1), 16);
            return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
        }
        const m = v.match(/rgba?\(([^)]+)\)/);
        if (!m) return [1, 1, 1, 1];
        const p = m[1].split(",").map(Number);
        return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
    }

    // Only plain values cross to the worker (settings may hold anything).
    function plain(settings) {
        const out = {};
        for (const k in settings) {
            const v = settings[k];
            const t = typeof v;
            if (t === "number" || t === "string" || t === "boolean" || v === null) out[k] = v;
            else if (Array.isArray(v) && v.every(x => typeof x === "number" || typeof x === "string")) out[k] = v.slice();
        }
        return out;
    }

    function supported() {
        try {
            const c = document.createElement("canvas");
            return !!c.getContext("webgl2");
        } catch (e) { return false; }
    }

    async function create(canvas, opts = {}) {
        const width = opts.width || window.innerWidth;
        const height = opts.height || window.innerHeight;
        const resolution = opts.resolution || window.devicePixelRatio || 1;
        const every = opts.every || 2;
        canvas.width = Math.round(width * resolution);
        canvas.height = Math.round(height * resolution);
        const useWorker = opts.worker !== false && typeof canvas.transferControlToOffscreen === "function"
            && typeof Worker !== "undefined";
        const api = { mode: useWorker ? "worker" : "page", onStats: null, onError: null, stats: null };

        if (useWorker) {
            const offscreen = canvas.transferControlToOffscreen();
            const worker = new Worker(scriptBase + "worker.js" + scriptVersion);
            const send = (m, transfer) => worker.postMessage(m, transfer || []);
            await new Promise((resolve, reject) => {
                worker.onmessage = (e) => {
                    const m = e.data;
                    if (m.type === "ready") resolve();
                    else if (m.type === "stats") { api.stats = m.stats; api.onStats && api.onStats(m.stats); }
                    else if (m.type === "note") console.info("TvGL " + m.message);
                    else if (m.type === "error") { (api.onError || console.error)("TvGL worker: " + m.message); reject(new Error(m.message)); }
                };
                worker.onerror = (e) => reject(e);
                send({ type: "init", canvas: offscreen, width, height, resolution, every,
                    settings: opts.settings && plain(opts.settings),
                    palette: opts.palette && opts.palette.map(parseColor), paletteCss: opts.palette && opts.palette.map(String),
                    background: opts.background && parseColor(opts.background).slice(0, 3),
                    backgroundCss: opts.background && String(opts.background) }, [offscreen]);
            });
            Object.assign(api, {
                setSettings: s => send({ type: "settings", settings: plain(s) }),
                setPalette: colors => send({ type: "palette", palette: colors.map(parseColor), paletteCss: colors.map(String) }),
                setBackground: css => send({ type: "background", background: parseColor(css).slice(0, 3), backgroundCss: String(css) }),
                setParticleScale: value => send({ type: "particleScale", value }),
                setPace: every => send({ type: "pace", every }),
                shockwave: (x, y, force, speed, widthPx) => send({ type: "shockwave", x, y, force, speed, widthPx }),
                vortex: (x, y, radius, strength, life) => send({ type: "vortex", x, y, radius, strength, life }),
                resize: (w, h, r) => send({ type: "resize", width: w, height: h, resolution: r,
                    canvasWidth: Math.round(w * r), canvasHeight: Math.round(h * r) }),
                pause: paused => send({ type: "pause", paused }),
                destroy: () => { send({ type: "stop" }); setTimeout(() => worker.terminate(), 100); }
            });
            return api;
        }

        // Page fallback: same engine on this thread.
        const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false,
            preserveDrawingBuffer: false, powerPreference: "high-performance" });
        if (!gl || !window.TvGLCore) throw new Error("TvGL: WebGL2 unavailable");
        const engine = new TvGLCore.Engine(gl);
        engine.resize(width, height, resolution);
        if (opts.settings) engine.setSettings(plain(opts.settings));
        if (opts.palette) engine.setPalette(opts.palette.map(parseColor));
        if (opts.background) engine.setBackground(parseColor(opts.background).slice(0, 3));
        const pacer = new TvGLCore.Pacer(every);
        const loop = TvGLCore.runLoop(engine, cb => requestAnimationFrame(cb),
            stats => { api.stats = stats; api.onStats && api.onStats(stats); }, pacer);
        Object.assign(api, {
            engine,
            setSettings: s => engine.setSettings(plain(s)),
            setPalette: colors => engine.setPalette(colors.map(parseColor)),
            setBackground: css => engine.setBackground(parseColor(css).slice(0, 3)),
            setParticleScale: v => engine.setParticleScale(v),
            setPace: every => { pacer.every = every; },
            shockwave: (x, y, f, s, wpx) => engine.addShockwave(x, y, f, s, wpx),
            vortex: (x, y, r, s, l) => engine.addVortex(x, y, r, s, l),
            resize: (w, h, r) => { canvas.width = Math.round(w * r); canvas.height = Math.round(h * r); engine.resize(w, h, r); },
            pause: paused => { engine.paused = !!paused; if (!paused) engine.lastFrame = 0; },
            destroy: () => loop.stop()
        });
        return api;
    }

    window.TvGL = { create, supported, parseColor };
})();
