// ==========================================================================
// ETERNAL VOID - TV RENDERER (WebGL2) - APP INTEGRATION
// TV only (loaded by js/device-mode.js). Each frame app.js asks
// VoidDevice.tvgl.frame(sim): when the current scene's shape is one the GPU
// renderer draws (TvGLCore.SUPPORTED_SHAPES), the GPU canvas shows it from
// the same live settings, palette and beat forces, and the 2D canvas rests;
// any other scene stays on the 2D renderer. Switches cross-fade.
// Clay approved the GPU look on the TV (2026-10-09, tools/tvgl-compare.html).
// ==========================================================================

(function () {
    "use strict";
    const VD = window.VoidDevice;
    if (!VD || !VD.isTV || !window.TvGL || !window.TvGLCore) return;

    const FADE_MS = 700;
    let api = null, canvas = null, starting = false, failed = false, active = false;
    let lastPalette = "", lastBg = "", hooked = null;

    function supports(sim) {
        // A preset's own sprite shape (js/particle-sprites.js) isn't on the GPU yet.
        const sprite = window.ParticleSprites && ParticleSprites.resolve(sim.settings);
        return !sim.isSolidMode && !sprite && TvGLCore.SUPPORTED_SHAPES.has(sim.settings.particleShape || "ellipse");
    }

    function makeCanvas() {
        const base = document.getElementById("canvas");
        const c = document.createElement("canvas");
        c.id = "tvgl-canvas";
        c.setAttribute("aria-hidden", "true");
        Object.assign(c.style, {
            position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
            zIndex: "1", pointerEvents: "none", opacity: "0", transition: `opacity ${FADE_MS}ms ease`
        });
        base.insertAdjacentElement("afterend", c);
        return c;
    }

    function background(sim) {
        return sim.backgroundColor || "#000000";
    }

    async function start(sim) {
        starting = true;
        try {
            canvas = makeCanvas();
            api = await TvGL.create(canvas, {
                width: window.innerWidth, height: window.innerHeight,
                resolution: window.devicePixelRatio || 1, every: 2,
                settings: sim.settings, palette: sim.palette, background: background(sim)
            });
            api.onError = (msg) => { console.warn(msg); fail(sim); };
            api.onStats = (stats) => { VD.tvglStats = stats; };
            api.pause(true);
            hookForces(sim);
            window.addEventListener("resize", () => {
                api && api.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
            });
            document.addEventListener("visibilitychange", () => {
                if (api && active) api.pause(document.hidden || sim.isPaused);
            });
        } catch (err) {
            console.warn("TV renderer unavailable, staying on 2D:", err);
            fail(sim);
        } finally {
            starting = false;
        }
    }

    function fail(sim) {
        failed = true;
        if (active) deactivate(sim);
        api && api.destroy();
        api = null;
        canvas && canvas.remove();
    }

    // Beats push the GPU particles too (the 2D sim keeps its own copies).
    function hookForces(sim) {
        if (hooked === sim) return;
        hooked = sim;
        const shock = sim.triggerShockwave.bind(sim);
        const vortex = sim.triggerVortex.bind(sim);
        sim.triggerShockwave = function (x, y, force, speed, widthPx) {
            shock(x, y, force, speed, widthPx);
            if (active && api) api.shockwave(x, y, force, speed, widthPx);
        };
        sim.triggerVortex = function (x, y, radius, strength, life) {
            vortex(x, y, radius, strength, life);
            if (active && api) api.vortex(x, y, radius, strength, life);
        };
    }

    function activate(sim) {
        active = true;
        lastPalette = lastBg = "";
        sync(sim);
        api.pausedFor = !!sim.isPaused;
        api.pause(api.pausedFor);
        canvas.style.opacity = "1";
        // The governor tunes the 2D renderer; it holds while the GPU draws.
        VD.governorHeld = true;
    }

    function deactivate(sim) {
        active = false;
        VD.governorHeld = false;
        if (canvas) canvas.style.opacity = "0";
        // Start the 2D scene from a clean background under the fade.
        try {
            sim.ctx.save();
            sim.ctx.setTransform(1, 0, 0, 1, 0, 0);
            sim.ctx.fillStyle = background(sim);
            sim.ctx.fillRect(0, 0, sim.canvas.width, sim.canvas.height);
            sim.ctx.restore();
        } catch (e) { /* canvas gone */ }
        setTimeout(() => { if (!active && api) { api.pausedFor = true; api.pause(true); } }, FADE_MS);
    }

    function sync(sim) {
        api.setSettings(sim.settings);
        const palette = (sim.palette || []).join("|");
        if (palette !== lastPalette) { lastPalette = palette; api.setPalette(sim.palette); }
        const bg = background(sim);
        if (bg !== lastBg) { lastBg = bg; api.setBackground(bg); }
    }

    // Called by app.js every frame instead of sim.tick() on TV. Returns true
    // when the GPU renderer drew this frame (app.js then skips sim.tick).
    function frame(sim) {
        if (failed || !VD.tvglEnabled) { if (active) deactivate(sim); return false; }
        const wants = supports(sim);
        if (!api) {
            if (wants && !starting) start(sim);
            return false;
        }
        if (!wants) {
            if (active) deactivate(sim);
            return false;
        }
        if (!active) activate(sim);
        if (api.pausedFor !== !!sim.isPaused) { api.pausedFor = !!sim.isPaused; api.pause(!!sim.isPaused); }
        sync(sim);
        return true;
    }

    VD.tvglEnabled = true;     // VoidDevice.tvglEnabled = false: back to 2D (testing)
    VD.tvgl = { frame, get active() { return active; }, get mode() { return api && api.mode; } };
})();
