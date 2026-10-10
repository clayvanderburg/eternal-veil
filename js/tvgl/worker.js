// ==========================================================================
// ETERNAL VOID - TV RENDERER (WebGL2) - WORKER
// Owns the OffscreenCanvas: physics and drawing run here, on another core,
// while the page keeps the UI, music and Flow. Messages from js/tvgl/host.js.
// ==========================================================================
/* global TvGLCore */
"use strict";
importScripts("core.js");

let engine = null, loop = null, pacer = null;

function post(type, data) { self.postMessage({ type, ...data }); }

self.onmessage = (e) => {
    const m = e.data;
    try {
        switch (m.type) {
            case "init": {
                const gl = m.canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false,
                    preserveDrawingBuffer: false, powerPreference: "high-performance" });
                if (!gl) { post("error", { message: "WebGL2 unavailable in worker" }); return; }
                engine = new TvGLCore.Engine(gl);
                engine.resize(m.width, m.height, m.resolution);
                if (m.settings) engine.setSettings(m.settings);
                if (m.palette) engine.setPalette(m.palette);
                if (m.background) engine.setBackground(m.background);
                pacer = new TvGLCore.Pacer(m.every || 2);
                loop = TvGLCore.runLoop(engine, cb => self.requestAnimationFrame(cb), stats => post("stats", { stats }), pacer);
                post("ready", {});
                break;
            }
            case "resize":
                m.canvasWidth && (engine.renderer.gl.canvas.width = m.canvasWidth, engine.renderer.gl.canvas.height = m.canvasHeight);
                engine.resize(m.width, m.height, m.resolution);
                break;
            case "settings": engine.setSettings(m.settings); break;
            case "palette": engine.setPalette(m.palette); break;
            case "background": engine.setBackground(m.background); break;
            case "particleScale": engine.setParticleScale(m.value); break;
            case "pace": if (pacer) pacer.every = m.every; break;
            case "shockwave": engine.addShockwave(m.x, m.y, m.force, m.speed, m.widthPx); break;
            case "vortex": engine.addVortex(m.x, m.y, m.radius, m.strength, m.life); break;
            case "pause": engine.paused = !!m.paused; if (!m.paused) engine.lastFrame = 0; break;
            case "stop": loop && loop.stop(); self.close(); break;
        }
    } catch (err) {
        post("error", { message: String(err && err.message || err) });
    }
};
