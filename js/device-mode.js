// ==========================================================================
// ETERNAL VOID - DEVICE MODE
// Works out whether we're on a TV, phone, tablet or desktop and tags <html>
// with data-device so CSS can adapt. On TV it adds remote-control support:
// the D-pad moves focus between controls, OK clicks, Back closes the topmost
// layer. The Fire TV app (eternal-void-tv) loads the live site and adds
// "EternalVoidTV/<version>" to its user agent, so the site itself decides how
// to look and the app never needs updating for UI changes.
//
// Testing on a desktop: add ?device=tv (or phone/tablet/desktop) to the URL.
// The choice sticks in this browser until ?device=auto.
// Loaded in <head> before the simulation so the TV pixel-ratio cap applies.
// ==========================================================================

(function () {
    const STORAGE_KEY = "voidDeviceOverride";
    const DEVICES = ["tv", "phone", "tablet", "desktop"];
    const ua = navigator.userAgent || "";
    const shellMatch = ua.match(/EternalVoidTV\/([\w.]+)/);

    function readOverride() {
        let forced = null;
        try {
            forced = new URLSearchParams(location.search).get("device");
            if (forced === "auto") {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            if (DEVICES.includes(forced)) {
                localStorage.setItem(STORAGE_KEY, forced);
                return forced;
            }
            const saved = localStorage.getItem(STORAGE_KEY);
            return DEVICES.includes(saved) ? saved : null;
        } catch (e) {
            return DEVICES.includes(forced) ? forced : null;
        }
    }

    function detect() {
        // AFT* is every Fire TV model code; the rest cover Android/Google TV
        // and the common smart-TV browsers.
        if (shellMatch || /\bAFT[A-Z0-9]|Android ?TV|GoogleTV|BRAVIA|SMART-TV|SmartTV|Tizen|Web0S|CrKey/i.test(ua)) {
            return "tv";
        }
        const coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
        if (!coarse) return "desktop";
        const shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
        return shortSide < 600 ? "phone" : "tablet";
    }

    const type = readOverride() || detect();
    const isTV = type === "tv";
    const root = document.documentElement;
    root.dataset.device = type;
    if (shellMatch) root.dataset.shell = "tv";

    const nativeRatio = window.devicePixelRatio || 1;

    const VoidDevice = {
        type,
        isTV,
        isShell: !!shellMatch,
        shellVersion: shellMatch ? shellMatch[1] : null,
        handleBack,
        remote,
        onFps,
        skipFrame
    };
    window.VoidDevice = VoidDevice;
    if (!isTV) return;

    // Measured on a Fire TV Stick 4K Max (PowerVR GE9215), every preset at 30%
    // particles: these nine draw too much to hold 25 fps at a sharp
    // resolution (5-17 fps), so Flow skips them on TV; they can still be picked by hand.
    // Fold effects stop at two rings (3+ rings: 23-30 fps, 2 rings: 44-49).
    VoidDevice.flowSkip = new Set(["mandelbrotDive", "molecularDance", "celticKnotwork", "celticCurrent",
        "cymaticResonance", "liquidChrome", "supernova", "fractalNebula", "stellarNursery"]);
    VoidDevice.maxKaleidoRings = 2;
    document.addEventListener("DOMContentLoaded", () => {
        window.MandelbrotDive?.setTuning?.({ detail: 1.0, resolution: 0.5 });
        window.MolecularDance?.setTuning?.({ quality: 0.5 });
    });

    // ----------------------------------------------------------------------
    // Remote-control navigation (TV only)
    // ----------------------------------------------------------------------

    const FOCUSABLE = "button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex='-1'])";

    function isShown(el) {
        if (!el || el.disabled || el.closest("[inert], .hidden, .panel-collapsed")) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) {
            // Off-screen is fine inside a scrolling panel; off the page is not.
            if (!el.closest(".control-panel, dialog, .modal-overlay, .flow-manual-popover")) return false;
        }
        // pointer-events is inherited, so this also skips everything inside a
        // layer that is fading out (e.g. the splash after Enter).
        const style = getComputedStyle(el);
        return style.visibility !== "hidden" && style.display !== "none" && style.pointerEvents !== "none";
    }

    // The layer the remote is allowed to move within: the topmost open
    // dialog/overlay, otherwise the whole page.
    function activeLayer() {
        const splash = document.getElementById("splash-screen");
        if (splash && isLayerOpen(splash)) return splash;
        const dialogs = [...document.querySelectorAll("dialog[open]")];
        if (dialogs.length) return dialogs[dialogs.length - 1];
        const overlay = [...document.querySelectorAll(".modal-overlay:not(.hidden), .flow-manual-popover:not(.hidden)")]
            .filter(isLayerOpen).pop();
        return overlay || document.body;
    }

    function isLayerOpen(el) {
        if (el.classList.contains("hidden")) return false;
        const style = getComputedStyle(el);
        // A layer fading out stops taking clicks before it disappears.
        return style.display !== "none" && style.visibility !== "hidden" &&
            style.pointerEvents !== "none" && parseFloat(style.opacity) > 0.05;
    }

    function candidates(layer) {
        return [...layer.querySelectorAll(FOCUSABLE)].filter(isShown);
    }

    function focusEl(el) {
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    function focusFirst(layer) {
        const preferred = layer === document.body
            ? document.getElementById("menu-toggle-btn")
            : layer.querySelector("[autofocus], .btn-primary, button");
        focusEl(isShown(preferred) ? preferred : candidates(layer)[0]);
    }

    // Nearest control in the pressed direction. Distance along the direction
    // counts once, sideways drift counts double, so focus stays in its row or
    // column when it can.
    function findNext(from, dir, list) {
        const a = from.getBoundingClientRect();
        const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
        let best = null, bestScore = Infinity;
        for (const el of list) {
            if (el === from) continue;
            const b = el.getBoundingClientRect();
            const bx = b.left + b.width / 2, by = b.top + b.height / 2;
            let along, across;
            if (dir === "up") { along = a.top - b.bottom; across = Math.abs(bx - ax); if (by >= ay) continue; }
            else if (dir === "down") { along = b.top - a.bottom; across = Math.abs(bx - ax); if (by <= ay) continue; }
            else if (dir === "left") { along = a.left - b.right; across = Math.abs(by - ay); if (bx >= ax) continue; }
            else { along = b.left - a.right; across = Math.abs(by - ay); if (bx <= ax) continue; }
            const score = Math.max(0, along) + across * 2;
            if (score < bestScore) { bestScore = score; best = el; }
        }
        return best;
    }

    function uiFaded() {
        const hud = document.getElementById("hud");
        return !!hud && hud.classList.contains("ui-faded");
    }

    const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

    window.addEventListener("keydown", (e) => {
        const dir = DIRS[e.key];
        const active = document.activeElement;

        if (dir) {
            // Let sliders and text fields keep their own left/right.
            if ((dir === "left" || dir === "right") && active &&
                (active.type === "range" || (active.tagName === "INPUT" && /^(text|search|number)$/.test(active.type)) || active.tagName === "TEXTAREA")) {
                return;
            }
            e.preventDefault();
            const layer = activeLayer();
            // The first press after the controls faded just brings them back
            // (app.js wakes the UI on any keydown).
            if (uiFaded() && layer === document.body) {
                // Faded controls can't take focus until app.js has woken them.
                setTimeout(() => {
                    const now = document.activeElement;
                    if (!now || now === document.body || !isShown(now)) focusFirst(layer);
                }, 60);
                return;
            }
            if (!active || active === document.body || !layer.contains(active) || !isShown(active)) {
                focusFirst(layer);
                return;
            }
            focusEl(findNext(active, dir, candidates(layer)));
            return;
        }

        // OK on a checkbox/radio toggles it (browsers only do that for Space).
        if (e.key === "Enter" && active && active.tagName === "INPUT" && /^(checkbox|radio)$/.test(active.type)) {
            e.preventDefault();
            active.click();
            return;
        }

        if (e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack") {
            // Stop here, or app.js's "any key wakes the controls" undoes a hide.
            if (handleBack()) { e.preventDefault(); e.stopImmediatePropagation(); }
            return;
        }

        if (e.key === "MediaPlayPause") { e.preventDefault(); remote("playpause"); }
        else if (e.key === "MediaFastForward" || e.key === "MediaTrackNext") { e.preventDefault(); remote("next"); }
        else if (e.key === "ContextMenu") { e.preventDefault(); remote("menu"); }
    }, true);

    // Splash and dialogs: put focus somewhere the remote can see it.
    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
            const layer = activeLayer();
            if (layer !== document.body) focusFirst(layer);
        }, 300);
    });
    // The GPU (WebGL) TV renderer: loaded on TV only, after the page's own
    // scripts. It takes over the scenes it can draw (js/tvgl/tv-mode.js).
    document.addEventListener("DOMContentLoaded", () => {
        const files = ["js/tvgl/core.js", "js/tvgl/host.js", "js/tvgl/tv-mode.js"];
        (function next() {
            const file = files.shift();
            if (!file) return;
            const el = document.createElement("script");
            el.src = file + "?v=tvgl-2";
            el.onload = next;
            el.onerror = () => console.warn("TV renderer: could not load " + file);
            document.body.appendChild(el);
        })();
    });

    // Opening the console moves focus into it, so the next press is already there.
    document.addEventListener("DOMContentLoaded", () => {
        const panel = document.getElementById("control-panel");
        if (!panel) return;
        let wasOpen = !panel.classList.contains("panel-collapsed");
        new MutationObserver(() => {
            const open = !panel.classList.contains("panel-collapsed");
            if (open && !wasOpen && !panel.contains(document.activeElement)) {
                // After the slide-in; start on the selected tab.
                setTimeout(() => focusEl(panel.querySelector(".tab-btn.active") || candidates(panel)[0]), 350);
            }
            wasOpen = open;
        }).observe(panel, { attributes: true, attributeFilter: ["class"] });
    });
    document.addEventListener("toggle", (e) => {
        if (e.target.tagName === "DIALOG" && e.target.open) setTimeout(() => focusFirst(e.target), 50);
    }, true);

    // ----------------------------------------------------------------------
    // Back button and remote shortcuts (also called by the Fire TV app)
    // ----------------------------------------------------------------------

    // Close whatever is on top. Returns false when there is nothing left to
    // close, which tells the app to exit.
    function handleBack() {
        const dialogs = [...document.querySelectorAll("dialog[open]")];
        if (dialogs.length) { dialogs[dialogs.length - 1].close(); return true; }

        const keyboard = document.getElementById("keyboard-modal");
        if (keyboard && !keyboard.classList.contains("hidden")) { keyboard.classList.add("hidden"); return true; }

        const popover = document.getElementById("flow-manual-popover");
        if (popover && !popover.classList.contains("hidden")) {
            document.getElementById("flow-popover-close-btn")?.click();
            return true;
        }

        const panel = document.getElementById("control-panel");
        if (panel && !panel.classList.contains("panel-collapsed")) {
            document.getElementById("menu-toggle-btn")?.click();
            focusEl(document.getElementById("menu-toggle-btn"));
            return true;
        }

        if (!uiFaded()) {
            document.getElementById("hide-controls-btn")?.click();
            return true;
        }
        return false;
    }

    // ----------------------------------------------------------------------
    // Frame pacing and quality governor (TV only).
    //
    // A TV stick can't draw these scenes at 50-60 fps with full detail, and
    // chasing that rate cost sharpness (a 960x540 or smaller canvas stretched
    // over the TV). Flowing visuals with time-based motion and trails look
    // smooth at a steady 25-30 fps, so on TV we draw on every 2nd display
    // refresh and spend the extra time on resolution and particles.
    //
    // Quality steps protect sharpness: particles go before resolution, and the
    // canvas never drops below one pixel per CSS pixel. Because the frame rate
    // is capped, spare capacity can't be seen in the fps, so after a stable
    // stretch the governor tries one step up and backs off if frames slip.
    // Set VoidDevice.governor = false to hold the current level (testing).
    // ----------------------------------------------------------------------

    // Sharpness first: a soft or jagged picture was the visible cost, while
    // 16-30% of the particles still reads as a full scene. So particles go all
    // the way down at native resolution before the canvas gets any smaller.
    const LEVELS = [
        { particles: 1, resolution: 2 },
        { particles: 0.75, resolution: 2 },
        { particles: 0.55, resolution: 2 },
        { particles: 0.4, resolution: 2 },
        { particles: 0.3, resolution: 2 },
        { particles: 0.22, resolution: 2 },
        { particles: 0.16, resolution: 2 },
        { particles: 0.22, resolution: 1.5 },
        { particles: 0.16, resolution: 1.5 },
        { particles: 0.16, resolution: 1.25 }
    ];
    const START_LEVEL = 4;
    const PROBE_AFTER = 16;   // readings (8 s) at target before trying a step up
    const PROBE_WINDOW = 6;   // readings (3 s) a step up must hold
    let level = START_LEVEL, applied = null, lowReadings = 0, steadyReadings = 0;
    let probeFrom = null, probeAge = 0, probeAfter = PROBE_AFTER;

    // Display refresh interval, measured from skipped frames only: two skips
    // in a row land exactly one refresh apart (frames after a draw don't).
    // The 60 Hz default already paces correctly at 50 Hz too (draws land on
    // every 2nd refresh either way); the measurement just tells the governor
    // what rate to expect (30 or 25 fps).
    let refreshMs = 1000 / 60, lastDrawn = 0, lastRaf = 0, prevSkipped = false;
    const rafSamples = [];
    function frameIntervalMs() { return refreshMs * 2; }
    function targetFps() { return 1000 / frameIntervalMs(); }

    function skipFrame() {
        if (!isTV || VoidDevice.pacing === false) return false;
        // The frame's display-aligned time (same as the rAF timestamp); the
        // moment our callback happens to run is much noisier on a TV stick.
        const now = document.timeline?.currentTime ?? performance.now();
        if (prevSkipped && lastRaf) {
            rafSamples.push(now - lastRaf);
            if (rafSamples.length >= 40) {
                const sorted = rafSamples.splice(0).sort((a, b) => a - b);
                refreshMs = Math.min(1000 / 24, Math.max(1000 / 75, sorted[20]));
            }
        }
        lastRaf = now;
        // Draw once ~1.5 refreshes have passed: every 2nd display refresh.
        prevSkipped = now - lastDrawn < refreshMs * 1.5;
        if (prevSkipped) return true;
        lastDrawn = now;
        VoidDevice.framesDrawn = (VoidDevice.framesDrawn || 0) + 1;
        return false;
    }

    function applyLevel(sim) {
        const target = LEVELS[level];
        const resolution = Math.min(target.resolution, nativeRatio);
        if (!applied || applied.particles !== target.particles) sim.setParticleScale(target.particles);
        if (sim.dpr !== resolution) sim.resize(window.innerWidth, window.innerHeight, resolution);
        applied = target;
        VoidDevice.quality = { level, particles: target.particles, resolution, targetFps: Math.round(targetFps()) };
    }

    // app.js resizes the canvas at the device ratio on window resize; put the
    // governor's resolution back afterwards.
    window.addEventListener("resize", () => {
        setTimeout(() => { if (applied && VoidDevice.sim) applyLevel(VoidDevice.sim); }, 250);
    });

    function setLevel(next, sim) {
        level = Math.max(0, Math.min(LEVELS.length - 1, next));
        lowReadings = steadyReadings = 0;
        applyLevel(sim);
    }

    // Per-scene memory. Scenes differ a lot in cost (a kaleidoscope at full
    // resolution can cost more than all the particles), so the governor
    // remembers the level each kind of scene held and starts there next time
    // Flow brings it back. Kept in this browser, so the TV learns over time.
    const MEMORY_KEY = "voidTvQuality";
    let learned = {};
    try { learned = JSON.parse(localStorage.getItem(MEMORY_KEY) || "{}") || {}; } catch (e) { learned = {}; }
    let sceneKey = null, saveTimer = 0;

    function keyFor(sim) {
        const s = sim.settings;
        return [s.particleShape, s.kaleidoscopeEnabled ? "k" + Math.round(s.kaleidoAxesRings || 1) : "",
            s.spinningKaleido ? "s" : ""].join("|");
    }

    function remember(key) {
        if (!key) return;
        learned[key] = level;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try { localStorage.setItem(MEMORY_KEY, JSON.stringify(learned)); } catch (e) { /* private mode */ }
        }, 2000);
    }

    function onFps(fps, sim) {
        if (!isTV) return; // desktop/phone keep the preset's full density
        VoidDevice.sim = sim;
        if (!applied) applyLevel(sim);
        // Held while the GPU renderer draws the scene (js/tvgl/tv-mode.js).
        if (VoidDevice.governor === false || VoidDevice.governorHeld || document.hidden) return;
        const target = targetFps();

        const key = keyFor(sim);
        if (key !== sceneKey) {
            sceneKey = key;
            probeFrom = null;
            probeAfter = PROBE_AFTER;
            if (learned[key] !== undefined) setLevel(learned[key], sim);
            else lowReadings = steadyReadings = 0;
            return;
        }

        if (fps < target * 0.88) { lowReadings++; steadyReadings = 0; }
        else { steadyReadings++; lowReadings = 0; }

        if (probeFrom !== null) {
            probeAge++;
            if (lowReadings >= 2) {           // the step up didn't hold: back off, wait longer
                setLevel(probeFrom, sim);
                probeFrom = null;
                probeAfter = Math.min(probeAfter * 2, 240);
                remember(key);
                return;
            }
            if (probeAge >= PROBE_WINDOW) { probeFrom = null; probeAfter = PROBE_AFTER; remember(key); }
            return;
        }
        if (lowReadings >= 3) {
            setLevel(level + (fps < target * 0.6 ? 2 : 1), sim);
            remember(key);
        } else if (steadyReadings >= probeAfter && level > 0) {
            probeFrom = level;
            probeAge = 0;
            setLevel(level - 1, sim);
        }
    }

    // Shortcuts reuse the existing keyboard shortcuts in app.js.
    function remote(action) {
        const keys = { playpause: " ", next: "g", menu: "m" };
        const key = keys[action];
        if (!key) return false;
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        return true;
    }
})();
