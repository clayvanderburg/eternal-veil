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

    // TV GPUs are weak and the screen is far away: render at one canvas pixel
    // per CSS pixel (960x540 on a 1080p Fire TV) instead of 2x.
    if (isTV && (window.devicePixelRatio || 1) > 1) {
        try {
            Object.defineProperty(window, "devicePixelRatio", { get: () => 1, configurable: true });
        } catch (e) { /* read-only in this browser; render at native ratio */ }
    }

    const VoidDevice = {
        type,
        isTV,
        isShell: !!shellMatch,
        shellVersion: shellMatch ? shellMatch[1] : null,
        handleBack,
        remote,
        onFps
    };
    window.VoidDevice = VoidDevice;
    if (!isTV) return;

    // Measured on a Fire TV Stick 4K Max (PowerVR GE9215). Four scenes draw
    // too much for a TV stick at any setting (Mandelbrot Dive 2-12 fps, Molecular
    // Dance 10-20, Celtic Knotwork 6-16, Cymatic Resonance 6-18), so Flow skips
    // them on TV while everything else holds 30-50 fps; they can still
    // be picked by hand, with lighter settings below. Flow's fold effects stop
    // at two rings (3+ rings: 23-30 fps, 2 rings: 44-49).
    VoidDevice.flowSkip = new Set(["mandelbrotDive", "molecularDance", "celticKnotwork", "cymaticResonance"]);
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
    // Frame-rate governor (TV only). app.js reports fps twice a second. While
    // it stays low we step down: first the particle budget, then (for scenes
    // that draw their own heavy effects) the canvas resolution. With headroom
    // we step back up. Presets keep their look, just lighter.
    // Measured on a Fire TV Stick 4K Max: most particle presets run 35-50 fps
    // at 30% particles versus 5-18 fps at full density.
    // Set VoidDevice.governor = false to hold the current level (testing).
    // ----------------------------------------------------------------------

    const LEVELS = [
        { particles: 1, resolution: 1 },
        { particles: 0.75, resolution: 1 },
        { particles: 0.55, resolution: 1 },
        { particles: 0.4, resolution: 1 },
        { particles: 0.3, resolution: 1 },
        { particles: 0.22, resolution: 0.85 },
        { particles: 0.16, resolution: 0.7 },
        { particles: 0.16, resolution: 0.55 }
    ];
    const START_LEVEL = 3; // start light; climbs back up when there's headroom
    let level = START_LEVEL, applied = null, lowReadings = 0, highReadings = 0;

    function applyLevel(sim) {
        const target = LEVELS[level];
        if (!applied || applied.particles !== target.particles) sim.setParticleScale(target.particles);
        if (sim.dpr !== target.resolution) sim.resize(window.innerWidth, window.innerHeight, target.resolution);
        applied = target;
        VoidDevice.quality = { level, ...target };
    }

    // app.js resizes the canvas at full resolution on window resize; put the
    // governor's resolution back afterwards.
    window.addEventListener("resize", () => {
        setTimeout(() => { if (applied && VoidDevice.sim) applyLevel(VoidDevice.sim); }, 250);
    });

    function onFps(fps, sim) {
        if (!isTV) return; // desktop/phone keep the preset's full density
        VoidDevice.sim = sim;
        if (!applied) applyLevel(sim);
        if (VoidDevice.governor === false || document.hidden) return;
        if (fps < 26) { lowReadings++; highReadings = 0; }
        else if (fps > 44) { highReadings++; lowReadings = 0; }
        else { lowReadings = highReadings = 0; }

        let next = level;
        if (lowReadings >= 3) next = Math.min(LEVELS.length - 1, level + (fps < 14 ? 2 : 1));
        else if (highReadings >= 16) next = Math.max(0, level - 1);
        if (next !== level) {
            level = next;
            lowReadings = highReadings = 0;
            applyLevel(sim);
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
