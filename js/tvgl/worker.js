// ==========================================================================
// ETERNAL VOID - TV RENDERER (WebGL2) - WORKER
// Owns the OffscreenCanvas: physics and drawing run here, on another core,
// while the page keeps the UI, music and Flow. Messages from js/tvgl/host.js.
// Two engines share one renderer (so trails carry across scene changes):
//   - core.js Engine: the plain flow shapes, physics ported to typed arrays
//   - recorder.js RecEngine: the authored presets, the original simulation
//     code run here against a recording canvas
// ==========================================================================
/* global TvGLCore, TvGLRecorder */
"use strict";
// The original simulation expects a browser page.
self.window = self;
self.document = { getElementById: () => null, createElement: () => ({ getContext: () => null }) };
const v = self.location.search || "";
importScripts("core.js" + v, "../preset-compositions.js" + v, "../celtic-currents.js" + v,
    "../cymatic-resonance.js" + v, "../celtic-knotwork.js" + v, "../simulation.js" + v, "recorder.js" + v);

let field = null, rec = null, renderer = null, loop = null, pacer = null;
let settings = {}, paused = false, size = null;
let paletteRgba = null, paletteCss = null, bgRgb = [0, 0, 0], bgCss = "#000000";

function post(type, data) { self.postMessage({ type, ...data }); }

function recEngine() {
    if (!rec) {
        rec = new TvGLRecorder.RecEngine(field.gl, renderer);
        rec.resize(size.width, size.height, size.resolution);
        rec.setBackgroundCss(bgCss);
        rec.setSettings(settings);
        if (paletteCss) rec.setPaletteCss(paletteCss);
    }
    return rec;
}

// The engine for the current scene's shape.
function engineFor() {
    const shape = settings.particleShape || "ellipse";
    if (TvGLCore.SUPPORTED_SHAPES.has(shape)) return field;
    if (TvGLRecorder.RECORDED_SHAPES.has(shape)) return recEngine();
    return null;
}

const switcher = {
    frame(now) {
        if (paused) return 0;
        const e = engineFor();
        if (!e) return 0;
        if (e !== switcher.active) {
            switcher.active = e;
            e.lastFrame = 0;
            if (e === rec) rec.sim.lastFrameTime = Date.now();
        }
        const n = e.frame(now);
        if (e === rec && rec.rec.unsupported.size && !switcher.reported) {
            switcher.reported = true;
            post("note", { message: "recorder: not drawn on GPU: " + [...rec.rec.unsupported].join(", ") });
        }
        return n;
    }
};

function forEach(fn) { if (field) fn(field); if (rec) fn(rec); }

// GPU frame-rate governor. Resolution always stays native; a scene that
// can't hold the paced rate (e.g. Aurora Cathedral's huge curtain glows at
// full density) steps its particle count down, and tries back up after a
// steady stretch. Levels are remembered per scene shape for the session.
const LEVELS = [1, 0.8, 0.65, 0.5, 0.4, 0.3];
const governor = { byShape: {}, low: 0, steady: 0, probeFrom: null, probeAge: 0, wait: 10, shape: null };
function govApply(shape) {
    const scale = LEVELS[governor.byShape[shape] || 0];
    const e = switcher.active;
    if (e && e.setParticleScale) e.setParticleScale(scale * (settings.particleScaleCap || 1));
}
function govTick(stats) {
    const shape = settings.particleShape || "ellipse";
    if (shape !== governor.shape) {
        governor.shape = shape; governor.low = governor.steady = 0; governor.probeFrom = null; governor.wait = 10;
        govApply(shape);
        return;
    }
    const target = stats.targetFps || 25;
    const lvl = governor.byShape[shape] || 0;
    if (stats.fps < target * 0.88) { governor.low++; governor.steady = 0; } else { governor.steady++; governor.low = 0; }
    if (governor.probeFrom !== null) {
        governor.probeAge++;
        if (governor.low >= 1) {
            governor.byShape[shape] = governor.probeFrom; governor.probeFrom = null;
            governor.wait = Math.min(governor.wait * 2, 120); governor.low = 0;
            govApply(shape);
        } else if (governor.probeAge >= 3) { governor.probeFrom = null; governor.wait = 10; }
        return;
    }
    if (governor.low >= 2 && lvl < LEVELS.length - 1) {
        governor.byShape[shape] = lvl + (stats.fps < target * 0.5 ? 2 : 1);
        governor.byShape[shape] = Math.min(LEVELS.length - 1, governor.byShape[shape]);
        governor.low = 0;
        govApply(shape);
    } else if (governor.steady >= governor.wait && lvl > 0) {
        governor.probeFrom = lvl; governor.probeAge = 0; governor.steady = 0;
        governor.byShape[shape] = lvl - 1;
        govApply(shape);
    }
    stats.particleLevel = LEVELS[governor.byShape[shape] || 0];
}

self.onmessage = (e) => {
    const m = e.data;
    try {
        switch (m.type) {
            case "init": {
                const gl = m.canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false,
                    preserveDrawingBuffer: false, powerPreference: "high-performance" });
                if (!gl) { post("error", { message: "WebGL2 unavailable in worker" }); return; }
                renderer = new TvGLCore.Renderer(gl);
                field = new TvGLCore.Engine(gl, renderer);
                size = { width: m.width, height: m.height, resolution: m.resolution };
                field.resize(m.width, m.height, m.resolution);
                if (m.settings) { settings = Object.assign({}, m.settings); field.setSettings(settings); }
                if (m.palette) { paletteRgba = m.palette; field.setPalette(m.palette); }
                if (m.paletteCss) paletteCss = m.paletteCss;
                if (m.background) { bgRgb = m.background; field.setBackground(m.background); }
                if (m.backgroundCss) bgCss = m.backgroundCss;
                pacer = new TvGLCore.Pacer(m.every || 2);
                loop = TvGLCore.runLoop(switcher, cb => self.requestAnimationFrame(cb), stats => {
                    if (!paused && switcher.active) govTick(stats);
                    post("stats", { stats });
                }, pacer);
                post("ready", {});
                break;
            }
            case "resize":
                if (m.canvasWidth) { renderer.gl.canvas.width = m.canvasWidth; renderer.gl.canvas.height = m.canvasHeight; }
                size = { width: m.width, height: m.height, resolution: m.resolution };
                forEach(x => x.resize(m.width, m.height, m.resolution));
                break;
            case "settings":
                settings = Object.assign(settings, m.settings);
                forEach(x => x.setSettings(m.settings));
                break;
            case "palette":
                paletteRgba = m.palette; paletteCss = m.paletteCss || paletteCss;
                field.setPalette(m.palette);
                if (rec && paletteCss) rec.setPaletteCss(paletteCss);
                break;
            case "background":
                bgRgb = m.background; bgCss = m.backgroundCss || bgCss;
                field.setBackground(m.background);
                if (rec) rec.setBackgroundCss(bgCss);
                break;
            case "particleScale": settings.particleScaleCap = m.value; govApply(settings.particleShape || "ellipse"); break;
            case "pace": if (pacer) pacer.every = m.every; break;
            case "shockwave": (switcher.active || field).addShockwave(m.x, m.y, m.force, m.speed, m.widthPx); break;
            case "vortex": (switcher.active || field).addVortex(m.x, m.y, m.radius, m.strength, m.life); break;
            case "pause":
                paused = !!m.paused;
                if (!paused) { if (field) field.lastFrame = 0; if (rec && rec.sim) rec.sim.lastFrameTime = Date.now(); }
                break;
            case "stop": loop && loop.stop(); self.close(); break;
        }
    } catch (err) {
        post("error", { message: String(err && err.stack || err) });
    }
};
