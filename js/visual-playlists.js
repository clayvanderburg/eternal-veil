// ==========================================================================
// ETERNAL VOID - VISUAL PLAYLISTS
// Ordered preset playlists that play on their own, paired with zero, one or
// two color playlists. The model below is pure (and node-testable); the
// controller drives the scene only through the small host bridge app.js
// passes to init(), so the Flow engine and preset loader stay untouched.
// ==========================================================================

(function (global) {
    "use strict";

    const STORAGE_KEY = "eternalVoidVisualPlaylists";
    const MAX_PLAYLISTS = 24;
    const MAX_ENTRIES = 80;

    // Slider stops (seconds). Index-based sliders keep long holds reachable
    // without making short values fiddly.
    const STAY_STEPS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600];
    const TRANSITION_STEPS = [2, 3, 4, 6, 8, 10, 12, 15, 20, 30, 45, 60];
    const COLOR_EVERY_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600];
    const COLOR_FADE_STEPS = [2, 3, 4, 6, 8, 10, 12, 15, 20, 30, 45];

    // Same caps app.js applies to presets in Comfort Mode.
    const COMFORT_CAPS = { speed: 1.35, turbulence: 0.85, density: 2200, baseSize: 7, stretch: 3, rotationSpeed: 0.18, wobble: 0.38 };
    const COMFORT_MIN_TRANSITION = 6;
    const COMFORT_MIN_COLOR_FADE = 6;
    const COMFORT_MIN_COLOR_EVERY = 15;

    const COLOR_PLAYLIST_NAMES = {
        cyberpunk: "Cyberpunk", seasons: "Seasons", candy: "Candy Pop", goth: "Goth/Shadow",
        ocean: "Ocean Calm", chakra: "Chakra/Aura", psychedelic: "Psychedelic", custom: "My Library"
    };

    // Preset field -> simulation setting. Fields not listed here are still
    // carried when the simulation has a setting of the same name.
    const FIELD_MAP = {
        speed: "speed", turbulence: "turbulence", curl: "flowOrganic", density: "density",
        dissipation: "dissipation", zoom: "zoom", size: "baseSize", sizeVar: "sizeVariation",
        stretch: "stretch", interaction: "interaction", rotationSpeed: "rotationSpeed", wobble: "wobble",
        eclipseCount: "eclipseCount", eclipseSize: "eclipseSize", miniSpiralCount: "miniSpiralCount",
        spiralExtent: "spiralExtent", wanderMix: "wanderMix", kaleidoscopeSegments: "kaleidoscopeSegments"
    };
    const NON_SETTING_FIELDS = new Set(["name", "desc", "colors", "addedOn", "meditationPreset"]);

    // "Flow within playlist" varies each setting around the preset's own value.
    // weight scales the personality spread; zero-valued settings stay zero, so
    // a preset with no turbulence never gains any. Geometry, lighting and
    // kaleidoscope segments are never varied: they are the preset's identity.
    const VARIATION = {
        speed: { weight: 1 }, turbulence: { weight: 1 }, flowOrganic: { weight: 0.5 },
        density: { weight: 0.5, maxRatio: 1.1 }, dissipation: { weight: 0.4 },
        zoom: { weight: 0.3 }, baseSize: { weight: 0.7 }, sizeVariation: { weight: 1 },
        stretch: { weight: 0.8 }, interaction: { weight: 1 }, rotationSpeed: { weight: 1 },
        wobble: { weight: 1 }, eclipseSize: { weight: 0.5 }, eclipseCount: { weight: 0.6, integer: true },
        miniSpiralCount: { step: 1, min: 4, max: 8 }, spiralExtent: { weight: 0.25, min: 0.55, max: 0.98 },
        wanderMix: { weight: 0.6, min: 0.04, max: 0.4 }
    };
    const PERSONALITY_SPREAD = { serene: 0.12, alive: 0.2, wild: 0.28 };

    // ---------------------------------------------------------------------
    // Pure model
    // ---------------------------------------------------------------------
    const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const nearestStep = (steps, value) => steps.reduce((best, s) => Math.abs(s - value) < Math.abs(best - value) ? s : best, steps[0]);

    function defaultSettings() {
        return {
            mode: "flow",               // "flow" | "sequence"
            stay: 45,                   // seconds each preset holds after arriving
            transition: 8,              // seconds each glide into the next preset takes
            repeat: "all",              // "all" | "one" | "off"
            shuffle: false,
            colors: { mode: "preset", a: "ocean", b: "", combine: "alternate", every: 30, fade: 10 }
        };
    }

    function createPlaylist(name = "New playlist", entries = []) {
        const now = Date.now();
        return {
            id: uid(), name: String(name).slice(0, 40), createdAt: now, updatedAt: now,
            entries: entries.map(preset => ({ id: uid(), preset, stay: null })),
            ...defaultSettings()
        };
    }

    // The demonstration playlist, "Night Voyage": a deep-sea night in Ocean
    // Calm. Geometry alternates between open fields and strong centres, so
    // every glide hands one structure to a related one: diffuse cloud, sparks,
    // filaments, drifting curtains, braided currents, the slow mandala bloom,
    // a spiral unwinding, and Lotus Pulse's soft vortex, whose dark field
    // opens back into the cloud when the loop closes. See VISUAL_PLAYLISTS.md.
    const DEMO_PRESETS = ["nebula", "cosmic", "stellarNursery", "auroraCathedral", "celticCurrent", "mandalaZen", "hypno", "lotusPulse"];
    function createDemoPlaylist() {
        const playlist = createPlaylist("Night Voyage (demo)", DEMO_PRESETS);
        playlist.demo = true;
        playlist.mode = "flow";
        playlist.stay = 45;
        playlist.transition = 10;
        // Colors change every 40 s against a 55 s preset cycle, so palette
        // fades drift across the scenes instead of landing on every switch.
        playlist.colors = { mode: "playlists", a: "ocean", b: "", combine: "alternate", every: 40, fade: 15 };
        return playlist;
    }

    function normalizeEntry(raw) {
        if (!raw || typeof raw.preset !== "string") return null;
        const stay = Number(raw.stay);
        return { id: typeof raw.id === "string" ? raw.id : uid(), preset: raw.preset, stay: Number.isFinite(stay) && stay >= 5 ? clamp(Math.round(stay), 5, 3600) : null };
    }

    function normalizePlaylist(raw) {
        if (!raw || typeof raw !== "object") return null;
        const base = defaultSettings();
        const colors = { ...base.colors, ...(raw.colors && typeof raw.colors === "object" ? raw.colors : {}) };
        return {
            id: typeof raw.id === "string" ? raw.id : uid(),
            name: String(raw.name || "Untitled playlist").slice(0, 40),
            createdAt: Number(raw.createdAt) || Date.now(),
            updatedAt: Number(raw.updatedAt) || Date.now(),
            demo: raw.demo === true,
            entries: (Array.isArray(raw.entries) ? raw.entries : []).map(normalizeEntry).filter(Boolean).slice(0, MAX_ENTRIES),
            mode: raw.mode === "sequence" ? "sequence" : "flow",
            stay: clamp(Number(raw.stay) || base.stay, 5, 3600),
            transition: clamp(Number(raw.transition) || base.transition, 1, 120),
            repeat: ["all", "one", "off"].includes(raw.repeat) ? raw.repeat : "all",
            shuffle: raw.shuffle === true,
            colors: {
                mode: colors.mode === "playlists" ? "playlists" : "preset",
                a: COLOR_PLAYLIST_NAMES[colors.a] ? colors.a : "ocean",
                b: COLOR_PLAYLIST_NAMES[colors.b] && colors.b !== colors.a ? colors.b : "",
                combine: colors.combine === "combine" ? "combine" : "alternate",
                every: clamp(Number(colors.every) || base.colors.every, 3, 3600),
                fade: clamp(Number(colors.fade) || base.colors.fade, 1, 120)
            }
        };
    }

    function loadStore(storage) {
        let raw = null;
        try { raw = JSON.parse(storage.getItem(STORAGE_KEY) || "null"); } catch (error) { raw = null; }
        if (!raw || !Array.isArray(raw.playlists)) {
            const demo = createDemoPlaylist();
            return { version: 1, selectedId: demo.id, playlists: [demo] };
        }
        const playlists = raw.playlists.map(normalizePlaylist).filter(Boolean).slice(0, MAX_PLAYLISTS);
        const selectedId = playlists.some(p => p.id === raw.selectedId) ? raw.selectedId : (playlists[0]?.id || null);
        return { version: 1, selectedId, playlists };
    }

    function saveStore(storage, store) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selectedId: store.selectedId, playlists: store.playlists }));
            return true;
        } catch (error) {
            return false;
        }
    }

    function duplicatePlaylist(playlist) {
        const copy = normalizePlaylist(JSON.parse(JSON.stringify(playlist)));
        const now = Date.now();
        copy.id = uid();
        copy.demo = false;
        copy.name = `${playlist.name.replace(/ \(demo\)$/, "")} copy`.slice(0, 40);
        copy.createdAt = now;
        copy.updatedAt = now;
        copy.entries = copy.entries.map(entry => ({ ...entry, id: uid() }));
        return copy;
    }

    function moveEntry(entries, from, to) {
        const list = [...entries];
        if (from < 0 || from >= list.length) return list;
        const target = clamp(to, 0, list.length - 1);
        const [item] = list.splice(from, 1);
        list.splice(target, 0, item);
        return list;
    }

    function entryStay(playlist, entry) {
        return entry && Number.isFinite(entry.stay) && entry.stay >= 5 ? entry.stay : playlist.stay;
    }

    function effectiveTransition(playlist, comfort) {
        return comfort ? Math.max(COMFORT_MIN_TRANSITION, playlist.transition) : playlist.transition;
    }

    // One pass: every playable entry glides in, then holds.
    function passSeconds(playlist, isPlayable = () => true, comfort = false) {
        const transition = effectiveTransition(playlist, comfort);
        return playlist.entries.filter(entry => isPlayable(entry.preset))
            .reduce((total, entry) => total + transition + entryStay(playlist, entry), 0);
    }

    function formatDuration(seconds) {
        const s = Math.max(0, Math.round(seconds));
        if (s < 60) return `${s} s`;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const rest = s % 60;
        if (h) return `${h} h ${m} min`;
        return rest ? `${m} min ${rest} s` : `${m} min`;
    }

    function shuffled(list, rand = Math.random) {
        const out = [...list];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    // Order of entry indexes for one pass. Shuffle avoids putting the same
    // preset back to back (unless the playlist leaves no other choice), and
    // avoids opening a new pass with the preset that just ended.
    function buildOrder(playlist, { isPlayable = () => true, shuffle = playlist.shuffle, rand = Math.random, avoidFirstPreset = null } = {}) {
        const indexes = playlist.entries.map((entry, index) => index).filter(index => isPlayable(playlist.entries[index].preset));
        if (!shuffle || indexes.length < 2) return indexes;
        const presetAt = index => playlist.entries[index].preset;
        const score = order => order.reduce((bad, index, i) => bad
            + (i > 0 && presetAt(order[i - 1]) === presetAt(index) ? 1 : 0), 0)
            + (avoidFirstPreset && presetAt(order[0]) === avoidFirstPreset ? 1 : 0);
        let best = shuffled(indexes, rand);
        for (let attempt = 0; attempt < 24 && score(best) > 0; attempt++) {
            const candidate = shuffled(indexes, rand);
            if (score(candidate) < score(best)) best = candidate;
        }
        return best;
    }

    // Numeric targets for one preset. With variation, every supported setting
    // wanders a personality-sized step around the preset's own value.
    function computeTargets(preset, { variation = false, personality = "serene", comfort = false, rand = Math.random, settingKeys = null } = {}) {
        const targets = {};
        const spread = PERSONALITY_SPREAD[comfort ? "serene" : personality] ?? PERSONALITY_SPREAD.serene;
        for (const [field, value] of Object.entries(preset || {})) {
            if (typeof value !== "number" || !Number.isFinite(value) || NON_SETTING_FIELDS.has(field)) continue;
            const key = FIELD_MAP[field] || field;
            if (!FIELD_MAP[field] && !(settingKeys && settingKeys.has(key))) continue;
            if (key === "kaleidoscopeSegments" && !preset.kaleidoscopeEnabled) continue;
            let target = value;
            const rule = VARIATION[key];
            if (variation && rule) {
                if (rule.step) {
                    target = value + Math.round((rand() * 2 - 1) * rule.step);
                } else {
                    target = value * (1 + (rand() * 2 - 1) * spread * rule.weight);
                    if (rule.maxRatio) target = Math.min(target, value * rule.maxRatio);
                }
                if (rule.min != null) target = Math.max(rule.min, target);
                if (rule.max != null) target = Math.min(rule.max, target);
                if (rule.integer || rule.step) target = Math.round(target);
            }
            if (key === "density") target = Math.round(target);
            if (comfort && COMFORT_CAPS[key] !== undefined) target = Math.min(target, COMFORT_CAPS[key]);
            targets[key] = target;
        }
        return targets;
    }

    // Discrete settings switch once, mid-transition; they cannot be morphed.
    function discreteSettings(preset, comfort = false) {
        return {
            particleShape: preset.particleShape || "ellipse",
            particleLighting: preset.particleLighting || "glow",
            kaleidoscopeEnabled: preset.kaleidoscopeEnabled === true,
            psychedelicMode: !comfort && preset.psychedelicMode === true,
            morphingBg: !comfort && preset.morphingBg === true,
            spinningKaleido: !comfort && preset.spinningKaleido === true
        };
    }

    // Palette rotation for one or two color playlists.
    // alternate: A, B, A, B... (each list advancing on its own turn)
    // combine:   every palette from both lists in one shuffled rotation
    function buildColorRotation(colors, palettesFor, rand = Math.random) {
        const listA = (palettesFor(colors.a) || []).map(palette => ({ source: colors.a, palette }));
        const listB = colors.b ? (palettesFor(colors.b) || []).map(palette => ({ source: colors.b, palette })) : [];
        if (!listA.length && !listB.length) return [];
        if (!listB.length) return listA;
        if (!listA.length) return listB;
        if (colors.combine === "combine") {
            const pool = [...listA, ...listB];
            let best = shuffled(pool, rand);
            const repeats = order => order.reduce((bad, item, i) => bad + (i > 0 && order[i - 1].palette === item.palette ? 1 : 0), 0);
            for (let attempt = 0; attempt < 12 && repeats(best) > 0; attempt++) best = shuffled(pool, rand);
            return best;
        }
        const rounds = Math.max(listA.length, listB.length);
        const rotation = [];
        for (let i = 0; i < rounds; i++) rotation.push(listA[i % listA.length], listB[i % listB.length]);
        return rotation;
    }

    function stepIndex(steps, value) {
        return steps.indexOf(nearestStep(steps, value));
    }

    // ---------------------------------------------------------------------
    // Trail dissolve: when geometry switches, the previous frame is held in
    // the canvas and released on a fixed curve. Low-dissipation scenes already
    // keep their trails long enough and receive no extra drawing; high-
    // dissipation scenes (Liquid Chrome, Mandelbrot) would otherwise cut.
    // Drawn into the canvas itself, so recordings include it.
    // ---------------------------------------------------------------------
    function createDissolve() {
        let snapshot = null;
        let startedAt = 0;
        let duration = 0;
        let weight = 0;
        let lastFrame = 0;
        return {
            capture(canvas, seconds) {
                if (!canvas?.width || !canvas?.height || typeof document === "undefined") return;
                if (!snapshot) snapshot = document.createElement("canvas");
                if (snapshot.width !== canvas.width || snapshot.height !== canvas.height) {
                    snapshot.width = canvas.width;
                    snapshot.height = canvas.height;
                }
                const ctx = snapshot.getContext("2d");
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, snapshot.width, snapshot.height);
                ctx.drawImage(canvas, 0, 0);
                startedAt = performance.now();
                lastFrame = startedAt;
                duration = Math.max(0.4, seconds) * 1000;
                weight = 1;
            },
            active() { return weight > 0; },
            frame(sim) {
                if (!weight || !snapshot) return;
                const canvas = sim.canvas;
                const now = performance.now();
                const t = (now - startedAt) / duration;
                if (t >= 1 || canvas.width !== snapshot.width || canvas.height !== snapshot.height) { weight = 0; return; }
                const dt = Math.min((now - lastFrame) / (1000 / 60), 2);
                lastFrame = now;
                const dissipation = sim.isSolidMode ? 1 : clamp(Number(sim.settings.dissipation) || 0.02, 0.001, 1);
                const natural = weight * Math.pow(1 - dissipation, dt);
                const eased = t * t * (3 - 2 * t);
                const wanted = 1 - eased;
                const alpha = natural >= wanted ? 0 : clamp((wanted - natural) / (1 - natural), 0, 1);
                weight = Math.max(natural, wanted);
                if (alpha < 0.002) return;
                const ctx = sim.ctx;
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = alpha;
                ctx.drawImage(snapshot, 0, 0);
                ctx.restore();
            }
        };
    }

    // ---------------------------------------------------------------------
    // Controller + UI
    // ---------------------------------------------------------------------
    function createController(host) {
        const storage = host.storage || global.localStorage;
        let store = loadStore(storage);
        const dissolve = createDissolve();
        let session = null;
        let clock = null;
        let lastClock = 0;
        let pickerOpen = false;
        let pickerGroup = "favorites";
        let pickerQuery = "";
        const ui = {};

        const presets = () => host.presets();
        const presetName = key => presets()[key]?.name || key;
        const isComfort = () => host.isComfortMode();
        const isPlayable = key => Boolean(presets()[key]) && !host.excluded().has(key);
        const selected = () => store.playlists.find(p => p.id === store.selectedId) || null;
        const sessionPlaylist = () => session ? store.playlists.find(p => p.id === session.playlistId) || null : null;
        const persist = () => { if (!saveStore(storage, store)) host.toast("Could not save playlists in this browser"); };
        const el = (tag, props = {}, children = []) => {
            const node = document.createElement(tag);
            for (const [key, value] of Object.entries(props)) {
                if (value == null || value === false) continue;
                if (key === "class") node.className = value;
                else if (key === "text") node.textContent = value;
                else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
                else if (key === "dataset") Object.assign(node.dataset, value);
                else node.setAttribute(key, value === true ? "" : value);
            }
            (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(child => node.append(child));
            return node;
        };
        const swatch = colors => el("span", { class: "preset-swatch vp-swatch", "aria-hidden": "true" },
            (colors || []).slice(0, 5).map(color => { const i = el("i"); i.style.background = color; return i; }));

        function colorPalettesFor(name) {
            if (name === "custom") {
                try {
                    const lib = JSON.parse(storage.getItem("eternal_void_custom_palettes") || storage.getItem("eternal_veil_custom_palettes") || "[]");
                    return Array.isArray(lib) ? lib.map(item => item?.colors).filter(c => Array.isArray(c) && c.length) : [];
                } catch (error) { return []; }
            }
            return (global.ColorCycles?.playlists?.[name] || []).map(palette => [...palette]);
        }

        function touch(playlist) {
            playlist.updatedAt = Date.now();
            persist();
            if (session && session.playlistId === playlist.id) resyncOrder();
            render();
        }

        // ---- Playback -------------------------------------------------
        function currentEntry() {
            const playlist = sessionPlaylist();
            if (!playlist || !session) return null;
            return playlist.entries[session.order[session.pos]] || null;
        }

        function upcomingEntry() {
            const playlist = sessionPlaylist();
            if (!playlist || !session) return null;
            if (playlist.repeat === "one") return currentEntry();
            const nextPos = session.pos + 1;
            if (nextPos < session.order.length) return playlist.entries[session.order[nextPos]];
            if (playlist.repeat === "all") return playlist.shuffle ? null : playlist.entries[session.order[0]];
            return null;
        }

        function resyncOrder() {
            const playlist = sessionPlaylist();
            if (!playlist) { stop({ restoreFlow: false }); return; }
            const currentId = session.entryId;
            const order = buildOrder(playlist, { isPlayable, shuffle: false });
            if (playlist.shuffle) {
                const others = buildOrder({ ...playlist, entries: playlist.entries }, { isPlayable }).filter(index => playlist.entries[index].id !== currentId);
                const currentIndex = playlist.entries.findIndex(entry => entry.id === currentId);
                session.order = currentIndex >= 0 && isPlayable(playlist.entries[currentIndex].preset) ? [currentIndex, ...others] : others;
                session.pos = 0;
            } else {
                session.order = order;
                const at = order.findIndex(index => playlist.entries[index].id === currentId);
                if (at >= 0) session.pos = at;
                else session.pos = Math.min(session.pos, Math.max(0, order.length - 1)) - 1; // next advance lands on the following entry
            }
            if (!session.order.length) {
                host.toast("No playable presets left in this playlist");
                stop({ restoreFlow: false });
            }
        }

        function enterEntry({ immediate = false } = {}) {
            const playlist = sessionPlaylist();
            const entry = currentEntry();
            if (!playlist || !entry) return;
            const preset = presets()[entry.preset];
            if (!preset) return;
            const comfort = isComfort();
            const transition = immediate ? Math.min(3, effectiveTransition(playlist, comfort)) : effectiveTransition(playlist, comfort);
            session.entryId = entry.id;
            session.t = 0;
            session.transitionSeconds = transition;
            session.lastEvolveAt = transition;
            const targets = computeTargets(preset, {
                variation: playlist.mode === "flow", personality: host.personality(), comfort, settingKeys: host.settingKeys()
            });
            host.applyScene({
                key: entry.preset,
                targets,
                discrete: discreteSettings(preset, comfort),
                duration: transition,
                palette: playlist.colors.mode === "preset" ? [...preset.colors] : null,
                dissolve: (canvas, seconds) => dissolve.capture(canvas, seconds)
            });
            render();
        }

        function startColors({ immediate = true } = {}) {
            const playlist = sessionPlaylist();
            if (!playlist || !session) return;
            session.colorT = 0;
            session.colorRotation = playlist.colors.mode === "playlists"
                ? buildColorRotation(playlist.colors, colorPalettesFor) : [];
            session.colorIndex = -1;
            if (playlist.colors.mode === "playlists" && !session.colorRotation.length) {
                host.toast(`${COLOR_PLAYLIST_NAMES[playlist.colors.a]} has no palettes yet · using preset colors`);
            }
            if (immediate) nextColor();
        }

        function colorTiming(playlist) {
            const comfort = isComfort();
            return {
                every: comfort ? Math.max(COMFORT_MIN_COLOR_EVERY, playlist.colors.every) : playlist.colors.every,
                fade: comfort ? Math.max(COMFORT_MIN_COLOR_FADE, playlist.colors.fade) : playlist.colors.fade
            };
        }

        function nextColor() {
            const playlist = sessionPlaylist();
            if (!playlist || !session) return;
            if (playlist.colors.mode !== "playlists" || !session.colorRotation.length) {
                const preset = presets()[currentEntry()?.preset];
                if (preset && playlist.colors.mode === "playlists") host.morphPalette([...preset.colors], colorTiming(playlist).fade);
                return;
            }
            session.colorIndex = (session.colorIndex + 1) % session.colorRotation.length;
            if (session.colorIndex === 0 && playlist.colors.combine === "combine" && session.colorRotation.length > 2) {
                session.colorRotation = buildColorRotation(playlist.colors, colorPalettesFor);
            }
            const item = session.colorRotation[session.colorIndex];
            session.colorSource = item.source;
            host.morphPalette([...item.palette], Math.min(colorTiming(playlist).fade, colorTiming(playlist).every));
            session.colorT = 0;
        }

        function play(playlistId = store.selectedId, { fromStart = false } = {}) {
            const playlist = store.playlists.find(p => p.id === playlistId);
            if (!playlist) return;
            if (host.is3D()) { host.toast("Visual playlists play in the 2D view"); return; }
            if (session && session.playlistId === playlistId && !fromStart) {
                if (session.state === "ended") { play(playlistId, { fromStart: true }); return; }
                resume();
                return;
            }
            const order = buildOrder(playlist, { isPlayable });
            if (!order.length) {
                host.toast(playlist.entries.length ? "Every preset in this playlist is excluded" : "Add presets to this playlist first");
                return;
            }
            const wasAutopilot = session ? session.wasAutopilot : host.isAutopilot();
            session = {
                playlistId, order, pos: 0, state: "playing", pausedBy: null, takeoverLabel: "",
                t: 0, transitionSeconds: 0, lastEvolveAt: 0, entryId: null, wasAutopilot,
                colorT: 0, colorRotation: [], colorIndex: -1, colorSource: ""
            };
            host.suspendFlow();
            enterEntry();
            startColors();
            ensureClock();
            host.toast(`Playing “${playlist.name}”`);
            host.log(`Visual playlist started: ${playlist.name} (${playlist.mode === "flow" ? "Flow within playlist" : "Preset sequence"}).`);
            render();
        }

        function pause(reason = "user", label = "") {
            if (!session || session.state !== "playing") return false;
            session.state = "paused";
            session.pausedBy = reason;
            session.takeoverLabel = label;
            render();
            return true;
        }

        function resume() {
            if (!session) return;
            const wasTakeover = session.pausedBy === "takeover";
            session.state = "playing";
            session.pausedBy = null;
            session.takeoverLabel = "";
            host.suspendFlow();
            if (wasTakeover) {
                // The scene moved on manually; glide back into the current entry.
                enterEntry();
                startColors();
            }
            lastClock = performance.now();
            render();
        }

        function advance(direction = 1, { natural = false } = {}) {
            const playlist = sessionPlaylist();
            if (!playlist || !session) return;
            if (natural && playlist.repeat === "one") { enterEntry(); return; }
            // Step in the chosen direction, skipping entries excluded since the
            // order was built, so an excluded preset never starts to appear.
            let pos = session.pos;
            for (let tries = 0; tries <= session.order.length + 1; tries++) {
                pos += direction;
                if (pos >= session.order.length) {
                    if (playlist.repeat === "off" && natural) {
                        session.state = "ended";
                        session.pausedBy = null;
                        host.toast(`“${playlist.name}” finished · holding the last preset`);
                        render();
                        return;
                    }
                    const lastPreset = currentEntry()?.preset;
                    session.order = buildOrder(playlist, { isPlayable, avoidFirstPreset: lastPreset });
                    pos = 0;
                } else if (pos < 0) {
                    pos = playlist.repeat === "off" ? 0 : session.order.length - 1;
                }
                if (!session.order.length) break;
                const entry = playlist.entries[session.order[pos]];
                if (entry && isPlayable(entry.preset)) break;
            }
            const landed = playlist.entries[session.order[pos]];
            if (!session.order.length || !landed || !isPlayable(landed.preset)) {
                host.toast("No playable presets left in this playlist");
                stop({ restoreFlow: false });
                return;
            }
            session.pos = pos;
            if (session.state !== "playing") { session.state = "playing"; session.pausedBy = null; host.suspendFlow(); }
            enterEntry();
        }

        function stop({ restoreFlow = true } = {}) {
            if (!session) return;
            const wasAutopilot = session.wasAutopilot;
            session = null;
            if (restoreFlow && wasAutopilot) host.resumeFlow();
            host.log("Visual playlist stopped.");
            render();
        }

        // Called by app.js before a manual preset, Flow, dice, history or
        // saved-scene change. Returns true when it paused a running playlist.
        function takeover(kind, label = "") {
            if (!session || session.state !== "playing") return false;
            const text = { preset: label || "A preset", flow: "Flow", dice: "The dice", history: "History", scene: label || "A saved scene" }[kind] || "A manual change";
            pause("takeover", text);
            host.toast(`${text} took over · playlist paused`);
            host.log(`Visual playlist paused: ${text} took over.`);
            return true;
        }

        function ensureClock() {
            if (clock) return;
            lastClock = performance.now();
            clock = setInterval(tickClock, 250);
        }

        function tickClock() {
            const now = performance.now();
            const elapsed = Math.min(1, (now - lastClock) / 1000);
            lastClock = now;
            if (!session) return;
            if (session.state !== "playing" || document.hidden || host.isSimPaused() || host.is3D()) { renderProgress(); return; }
            const playlist = sessionPlaylist();
            if (!playlist) { stop({ restoreFlow: false }); return; }
            const entry = currentEntry();
            if (!entry || !isPlayable(entry.preset)) { advance(1); return; }

            session.t += elapsed;
            const stay = entryStay(playlist, entry);
            const transition = session.transitionSeconds;
            // Flow within playlist: keep the preset alive with gentle re-rolls
            // around its own values while it holds.
            if (playlist.mode === "flow") {
                const every = clamp(stay / 2, 10, 40);
                const remaining = transition + stay - session.t;
                if (session.t - session.lastEvolveAt >= every && remaining > every * 0.6) {
                    const preset = presets()[entry.preset];
                    host.morphSettings(computeTargets(preset, {
                        variation: true, personality: host.personality(), comfort: isComfort(), settingKeys: host.settingKeys()
                    }), every * 0.85);
                    session.lastEvolveAt = session.t;
                }
            }
            if (playlist.colors.mode === "playlists" && session.colorRotation.length) {
                session.colorT += elapsed;
                if (session.colorT >= colorTiming(playlist).every) nextColor();
            }
            if (session.t >= transition + stay) advance(1, { natural: true });
            renderProgress();
        }

        function dissolveFrame(sim) { dissolve.frame(sim); }

        // ---- Rendering --------------------------------------------------
        function render() {
            renderList();
            renderEditor();
            renderTransport(ui.consoleTransport, true);
            renderBar();
        }

        function renderList() {
            if (!ui.list) return;
            ui.list.replaceChildren();
            if (!store.playlists.length) {
                ui.list.append(el("p", { class: "vp-empty", text: "No playlists yet. Create one, or restore the demo." }));
            }
            store.playlists.forEach(playlist => {
                const active = session?.playlistId === playlist.id;
                const playable = playlist.entries.filter(entry => isPlayable(entry.preset)).length;
                const row = el("div", { class: `vp-list-row${playlist.id === store.selectedId ? " selected" : ""}${active ? " playing" : ""}` }, [
                    el("button", {
                        class: "vp-list-open", type: "button", "aria-pressed": String(playlist.id === store.selectedId),
                        onclick: () => { store.selectedId = playlist.id; pickerOpen = false; persist(); render(); }
                    }, [
                        el("span", { class: "vp-list-name", text: playlist.name }),
                        el("span", { class: "vp-list-meta", text: `${playable} preset${playable === 1 ? "" : "s"} · ${formatDuration(passSeconds(playlist, isPlayable, isComfort()))}${active ? ` · ${session.state === "playing" ? "playing" : session.state === "ended" ? "finished" : "paused"}` : ""}` })
                    ]),
                    el("button", {
                        class: "vp-icon-btn", type: "button", title: active && session.state === "playing" ? "Pause" : "Play",
                        "aria-label": `${active && session.state === "playing" ? "Pause" : "Play"} ${playlist.name}`,
                        onclick: () => active && session.state === "playing" ? pause() : play(playlist.id)
                    }, icon(active && session.state === "playing" ? "pause" : "play"))
                ]);
                ui.list.append(row);
            });
        }

        function segmented(options, value, onChange, label) {
            return el("div", { class: "vp-segments", role: "group", "aria-label": label },
                options.map(([optionValue, text]) => el("button", {
                    class: `vp-segment${optionValue === value ? " active" : ""}`, type: "button",
                    "aria-pressed": String(optionValue === value), onclick: () => onChange(optionValue)
                }, text)));
        }

        function stepSlider({ id, label, steps, value, onInput, describe = formatDuration }) {
            const output = el("span", { class: "slider-value", text: describe(value) });
            const input = el("input", {
                type: "range", id, class: "range-slider", min: "0", max: String(steps.length - 1), step: "1",
                value: String(stepIndex(steps, value)), "aria-label": label
            });
            input.addEventListener("input", () => {
                const next = steps[Number(input.value)];
                output.textContent = describe(next);
                onInput(next);
            });
            return el("div", { class: "control-item" }, [
                el("div", { class: "slider-header" }, [el("label", { class: "setting-label", for: id, text: label }), output]),
                input
            ]);
        }

        function timingSummary(playlist) {
            const comfort = isComfort();
            const transition = effectiveTransition(playlist, comfort);
            const overrides = playlist.entries.some(entry => entry.stay);
            const pass = formatDuration(passSeconds(playlist, isPlayable, comfort));
            return `Each preset holds ${formatDuration(playlist.stay)}${overrides ? " (or its own time)" : ""}, then glides ${formatDuration(transition)} into the next. One pass: ${pass}.`
                + (comfort && transition !== playlist.transition ? ` Comfort Mode keeps transitions at least ${COMFORT_MIN_TRANSITION} s.` : "");
        }

        function renderEditor() {
            if (!ui.editor) return;
            const playlist = selected();
            ui.editor.replaceChildren();
            if (!playlist) return;
            const update = mutate => { mutate(playlist); touch(playlist); };

            // Name + playlist actions
            const nameInput = el("input", {
                class: "preset-search vp-name", type: "text", value: playlist.name, maxlength: "40",
                "aria-label": "Playlist name", id: "vp-name-input"
            });
            nameInput.addEventListener("change", () => {
                const name = nameInput.value.trim();
                if (name) update(p => { p.name = name.slice(0, 40); });
                else nameInput.value = playlist.name;
            });
            ui.editor.append(el("div", { class: "vp-name-row" }, [
                nameInput,
                el("button", { class: "btn-text", type: "button", onclick: () => {
                    if (store.playlists.length >= MAX_PLAYLISTS) { host.toast(`Up to ${MAX_PLAYLISTS} playlists`); return; }
                    const copy = duplicatePlaylist(playlist);
                    store.playlists.splice(store.playlists.indexOf(playlist) + 1, 0, copy);
                    store.selectedId = copy.id;
                    persist(); render();
                    host.toast(`Duplicated as “${copy.name}”`);
                } }, "Duplicate"),
                el("button", { class: "btn-text vp-danger", type: "button", onclick: () => {
                    if (!global.confirm(`Delete “${playlist.name}”?`)) return;
                    if (session?.playlistId === playlist.id) stop();
                    store.playlists = store.playlists.filter(p => p.id !== playlist.id);
                    store.selectedId = store.playlists[0]?.id || null;
                    persist(); render();
                } }, "Delete")
            ]));

            // Entries
            const entryList = el("ol", { class: "vp-entries", "aria-label": `Presets in ${playlist.name}` });
            playlist.entries.forEach((entry, index) => {
                const preset = presets()[entry.preset];
                const excluded = host.excluded().has(entry.preset);
                const current = session?.playlistId === playlist.id && session.entryId === entry.id;
                const name = preset ? preset.name : `${entry.preset} (missing)`;
                entryList.append(el("li", { class: `vp-entry${excluded || !preset ? " unavailable" : ""}${current ? " current" : ""}`, dataset: { index: String(index) }, draggable: "true" }, [
                    el("span", { class: "vp-entry-num", text: String(index + 1) }),
                    swatch(preset?.colors),
                    el("span", { class: "vp-entry-name" }, [
                        el("span", { text: name }),
                        excluded ? el("small", { text: "Excluded · skipped" }) : null,
                        entry.stay ? el("small", { text: `Holds ${formatDuration(entry.stay)}` }) : null
                    ]),
                    el("button", { class: "vp-icon-btn", type: "button", title: "Move up", "aria-label": `Move ${name} up`, disabled: index === 0,
                        onclick: () => update(p => { p.entries = moveEntry(p.entries, index, index - 1); }) }, "↑"),
                    el("button", { class: "vp-icon-btn", type: "button", title: "Move down", "aria-label": `Move ${name} down`, disabled: index === playlist.entries.length - 1,
                        onclick: () => update(p => { p.entries = moveEntry(p.entries, index, index + 1); }) }, "↓"),
                    el("button", { class: "vp-icon-btn", type: "button", title: "Play it again right after (intentional repeat)", "aria-label": `Repeat ${name} right after`,
                        onclick: () => {
                            if (playlist.entries.length >= MAX_ENTRIES) { host.toast(`Up to ${MAX_ENTRIES} presets per playlist`); return; }
                            update(p => { p.entries.splice(index + 1, 0, { id: uid(), preset: entry.preset, stay: entry.stay }); });
                        } }, "⧉"),
                    el("button", { class: "vp-icon-btn vp-danger", type: "button", title: "Remove", "aria-label": `Remove ${name}`,
                        onclick: () => update(p => { p.entries.splice(index, 1); }) }, "×")
                ]));
            });
            wireDrag(entryList, playlist, update);
            if (!playlist.entries.length) entryList.append(el("li", { class: "vp-empty", text: "Add favorite presets below to start." }));
            ui.editor.append(el("div", { class: "vp-section" }, [
                el("span", { class: "setting-label-header", text: `PRESETS (${playlist.entries.length})` }),
                entryList,
                el("button", { class: "btn btn-secondary vp-wide", type: "button", "aria-expanded": String(pickerOpen),
                    onclick: () => { pickerOpen = !pickerOpen; renderEditor(); if (pickerOpen) ui.editor.querySelector(".vp-picker .preset-search")?.focus(); } },
                pickerOpen ? "Done adding" : "+ Add presets"),
                pickerOpen ? buildPicker(playlist, update) : null
            ]));

            // Playback mode + timing
            ui.editor.append(el("div", { class: "vp-section" }, [
                el("span", { class: "setting-label-header", text: "PLAYBACK" }),
                segmented([["flow", "Flow within playlist"], ["sequence", "Preset sequence"]], playlist.mode,
                    mode => update(p => { p.mode = mode; }), "Playback mode"),
                el("p", { class: "setting-desc", text: playlist.mode === "flow"
                    ? `Moves only through these presets. While each one holds, its settings keep evolving around its own values (${host.personality()} range), and its geometry never changes.`
                    : "Plays each preset exactly as saved, holds it steady, then glides to the next." }),
                stepSlider({ id: "vp-stay", label: "Each preset stays", steps: STAY_STEPS, value: playlist.stay,
                    onInput: value => { playlist.stay = value; persistSoon(playlist); } }),
                stepSlider({ id: "vp-transition", label: "Transition takes", steps: TRANSITION_STEPS, value: playlist.transition,
                    onInput: value => { playlist.transition = value; persistSoon(playlist); } }),
                el("p", { class: "vp-summary", id: "vp-timing-summary", text: timingSummary(playlist) }),
                el("div", { class: "vp-row" }, [
                    el("span", { class: "setting-label", text: "Repeat" }),
                    segmented([["all", "Loop"], ["one", "Repeat one"], ["off", "Play once"]], playlist.repeat,
                        repeat => update(p => { p.repeat = repeat; }), "Repeat")
                ]),
                el("label", { class: "vp-row vp-check" }, [
                    el("span", { class: "setting-label", text: "Shuffle" }),
                    (() => { const box = el("input", { type: "checkbox", checked: playlist.shuffle }); box.addEventListener("change", () => update(p => { p.shuffle = box.checked; })); return box; })()
                ])
            ]));

            // Colors
            const colors = playlist.colors;
            const options = Object.entries(COLOR_PLAYLIST_NAMES);
            const select = (id, value, allowNone, onChange, label) => {
                const node = el("select", { class: "vp-select", id, "aria-label": label },
                    [allowNone ? el("option", { value: "", text: "None" }) : null,
                        ...options.filter(([key]) => !allowNone || key !== colors.a).map(([key, name]) => {
                            const count = colorPalettesFor(key).length;
                            return el("option", { value: key, text: `${name}${count ? ` · ${count}` : " · empty"}`, selected: key === value });
                        })]);
                node.value = value;
                node.addEventListener("change", () => onChange(node.value));
                return node;
            };
            const colorSection = el("div", { class: "vp-section" }, [
                el("span", { class: "setting-label-header", text: "COLORS" }),
                segmented([["preset", "Preset colors"], ["playlists", "Color playlists"]], colors.mode,
                    mode => update(p => { p.colors.mode = mode; }), "Color source"),
                el("p", { class: "setting-desc", text: colors.mode === "preset"
                    ? "Each preset arrives in its original colors, fading with the transition."
                    : "Colors follow your color playlists on their own clock, independent of preset changes." })
            ]);
            if (colors.mode === "playlists") {
                colorSection.append(
                    el("div", { class: "vp-row" }, [el("label", { class: "setting-label", for: "vp-color-a", text: "Color playlist" }),
                        select("vp-color-a", colors.a, false, value => update(p => { p.colors.a = value; if (p.colors.b === value) p.colors.b = ""; }), "First color playlist")]),
                    el("div", { class: "vp-row" }, [el("label", { class: "setting-label", for: "vp-color-b", text: "Second (optional)" }),
                        select("vp-color-b", colors.b, true, value => update(p => { p.colors.b = value; }), "Second color playlist")])
                );
                if (colors.b) {
                    colorSection.append(
                        segmented([["alternate", `Alternate ${COLOR_PLAYLIST_NAMES[colors.a]} ↔ ${COLOR_PLAYLIST_NAMES[colors.b]}`], ["combine", "Combine into one rotation"]],
                            colors.combine, value => update(p => { p.colors.combine = value; }), "Two color playlists"),
                        el("p", { class: "setting-desc", text: colors.combine === "alternate"
                            ? "Every color change switches playlist: one palette from the first, then one from the second."
                            : "All palettes from both playlists are pooled and shuffled into a single rotation." })
                    );
                }
                colorSection.append(
                    stepSlider({ id: "vp-color-every", label: "Change colors every", steps: COLOR_EVERY_STEPS, value: colors.every,
                        onInput: value => { playlist.colors.every = value; persistSoon(playlist); } }),
                    stepSlider({ id: "vp-color-fade", label: "Color fade", steps: COLOR_FADE_STEPS, value: colors.fade,
                        onInput: value => { playlist.colors.fade = value; persistSoon(playlist); } })
                );
            }
            ui.editor.append(colorSection);

            // Advanced: per-entry hold times
            const advanced = el("details", { class: "vp-section vp-advanced" }, [
                el("summary", { class: "setting-label-header", text: "ADVANCED · PER-PRESET HOLD TIMES" }),
                el("p", { class: "setting-desc", text: "Leave blank to use the playlist time. Transition time is shared by every entry." })
            ]);
            playlist.entries.forEach((entry, index) => {
                const input = el("input", { class: "preset-search vp-stay-input", type: "number", min: "5", max: "3600", step: "5",
                    placeholder: String(playlist.stay), value: entry.stay ?? "", "aria-label": `Hold time in seconds for entry ${index + 1}` });
                input.addEventListener("change", () => update(p => {
                    const value = Number(input.value);
                    p.entries[index].stay = input.value === "" || !Number.isFinite(value) ? null : clamp(Math.round(value), 5, 3600);
                }));
                advanced.append(el("label", { class: "vp-row" }, [
                    el("span", { class: "setting-label", text: `${index + 1}. ${presetName(entry.preset)}` }), input, el("span", { class: "vp-unit", text: "s" })
                ]));
            });
            if (playlist.entries.some(entry => entry.stay)) advanced.open = true;
            ui.editor.append(advanced);

            // Recording notes
            const canvas = host.canvas();
            ui.editor.append(el("details", { class: "vp-section vp-advanced" }, [
                el("summary", { class: "setting-label-header", text: "RECORDING" }),
                el("p", { class: "setting-desc", id: "vp-record-size", text: recordSizeText(canvas) }),
                el("p", { class: "setting-desc", text: "For portrait video, use a portrait window or device: the scene renders natively at that shape. Nothing is cropped from landscape and enlarged." }),
                el("p", { class: "setting-desc", text: "The built-in recorder (Audio & Share) captures 30 fps WebM and stops at 60 seconds. For longer playlist videos, record the canvas with a screen recorder such as OBS while the controls are hidden." })
            ]));
        }

        let persistTimer = null;
        function persistSoon(playlist) {
            const summary = ui.editor?.querySelector("#vp-timing-summary");
            if (summary) summary.textContent = timingSummary(playlist);
            clearTimeout(persistTimer);
            persistTimer = setTimeout(() => { playlist.updatedAt = Date.now(); persist(); renderList(); renderBar(); }, 250);
        }

        function wireDrag(list, playlist, update) {
            let from = null;
            list.addEventListener("dragstart", event => {
                const item = event.target.closest(".vp-entry");
                if (!item) return;
                from = Number(item.dataset.index);
                item.classList.add("dragging");
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(from));
            });
            list.addEventListener("dragover", event => { if (from !== null) event.preventDefault(); });
            list.addEventListener("drop", event => {
                event.preventDefault();
                const item = event.target.closest(".vp-entry");
                if (from === null || !item) return;
                const to = Number(item.dataset.index);
                const origin = from;
                from = null;
                if (to !== origin) update(p => { p.entries = moveEntry(p.entries, origin, to); });
            });
            list.addEventListener("dragend", () => { from = null; list.querySelectorAll(".dragging").forEach(node => node.classList.remove("dragging")); });
        }

        function buildPicker(playlist, update) {
            const favorites = host.favorites();
            const query = pickerQuery.trim().toLowerCase();
            const keys = host.orderedKeys().filter(key => {
                const p = presets()[key];
                if (!p) return false;
                if (pickerGroup === "favorites" && !favorites.has(key)) return false;
                return !query || p.name.toLowerCase().includes(query) || (p.desc || "").toLowerCase().includes(query);
            });
            const list = el("div", { class: "vp-picker-list" });
            keys.forEach(key => {
                const p = presets()[key];
                const excluded = host.excluded().has(key);
                const count = playlist.entries.filter(entry => entry.preset === key).length;
                list.append(el("button", {
                    class: "vp-picker-item", type: "button", disabled: excluded,
                    title: excluded ? "Excluded presets are skipped. Include it again in the Presets tab to add it." : `Add ${p.name}`,
                    onclick: () => {
                        if (playlist.entries.length >= MAX_ENTRIES) { host.toast(`Up to ${MAX_ENTRIES} presets per playlist`); return; }
                        update(pl => { pl.entries.push({ id: uid(), preset: key, stay: null }); });
                        host.toast(`Added ${p.name}`);
                    }
                }, [swatch(p.colors), el("span", { class: "vp-entry-name", text: p.name }),
                    el("small", { text: excluded ? "Excluded" : count ? `In list ×${count}` : "" }), el("span", { class: "vp-add", text: "+" })]));
            });
            if (!keys.length) {
                list.append(el("p", { class: "vp-empty", text: pickerGroup === "favorites" && !favorites.size
                    ? "No favorites yet. Star presets in the Presets tab, or browse All presets." : "No presets match." }));
            }
            const search = el("input", { class: "preset-search", type: "search", placeholder: "Search presets", value: pickerQuery, "aria-label": "Search presets to add" });
            search.addEventListener("input", () => {
                pickerQuery = search.value;
                const fresh = buildPicker(playlist, update);
                ui.editor.querySelector(".vp-picker")?.replaceWith(fresh);
                const box = fresh.querySelector(".preset-search");
                box.focus();
                box.setSelectionRange(box.value.length, box.value.length);
            });
            return el("div", { class: "vp-picker" }, [
                segmented([["favorites", `Favorites (${favorites.size})`], ["all", "All presets"]], pickerGroup,
                    group => { pickerGroup = group; renderEditor(); }, "Preset source"),
                search, list
            ]);
        }

        function icon(name) {
            const paths = {
                play: '<polygon points="7 4 19 12 7 20 7 4"></polygon>',
                pause: '<rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect>',
                prev: '<polygon points="18 5 9 12 18 19 18 5"></polygon><line x1="6" y1="5" x2="6" y2="19"></line>',
                next: '<polygon points="6 5 15 12 6 19 6 5"></polygon><line x1="18" y1="5" x2="18" y2="19"></line>',
                repeat: '<polyline points="17 2 21 6 17 10"></polyline><path d="M3 12V10a4 4 0 0 1 4-4h14"></path><polyline points="7 22 3 18 7 14"></polyline><path d="M21 12v2a4 4 0 0 1-4 4H3"></path>',
                shuffle: '<polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line>',
                close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
                list: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><polygon points="3 4.5 5.5 6 3 7.5"></polygon><line x1="3" y1="12" x2="4" y2="12"></line><line x1="3" y1="18" x2="4" y2="18"></line>'
            };
            const span = el("span", { class: "vp-icon", "aria-hidden": "true" });
            span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
            return span;
        }

        function statusText() {
            const playlist = sessionPlaylist();
            if (!session || !playlist) return { title: "", line: "" };
            const entry = currentEntry();
            const now = entry ? presetName(entry.preset) : "—";
            const position = `${session.pos + 1}/${session.order.length}`;
            if (session.state === "paused" && session.pausedBy === "takeover") {
                return { title: `${playlist.name} · paused`, line: `${session.takeoverLabel} took over. Resume to continue at ${now}.` };
            }
            if (session.state === "ended") return { title: `${playlist.name} · finished`, line: `Holding ${now}` };
            const upcoming = upcomingEntry();
            const nextText = playlist.repeat === "one" ? "repeating" : upcoming ? `next ${presetName(upcoming.preset)}` : playlist.repeat === "off" && session.pos + 1 >= session.order.length ? "last preset" : "next: shuffled";
            const colorText = playlist.colors.mode === "playlists" && session.colorSource ? ` · colors ${COLOR_PLAYLIST_NAMES[session.colorSource]}` : "";
            return { title: `${playlist.name} · ${position}${session.state === "paused" ? " · paused" : ""}`, line: `${now} · ${nextText}${colorText}` };
        }

        function renderTransport(container, inConsole) {
            if (!container) return;
            container.replaceChildren();
            const playlist = inConsole ? (session ? sessionPlaylist() : selected()) : sessionPlaylist();
            if (!playlist) { container.hidden = true; return; }
            container.hidden = false;
            const active = session && session.playlistId === playlist.id;
            const playing = active && session.state === "playing";
            const button = (name, label, onclick, extra = {}) => el("button", { class: `vp-icon-btn${extra.pressed ? " active" : ""}`, type: "button", title: label, "aria-label": label,
                "aria-pressed": extra.pressed == null ? null : String(Boolean(extra.pressed)), disabled: extra.disabled, onclick }, icon(name));
            const repeatLabels = { all: "Repeat: loop playlist", one: "Repeat: this preset", off: "Repeat: off (play once)" };
            const controls = el("div", { class: "vp-transport-buttons" }, [
                button("prev", "Previous preset", () => active ? advance(-1) : play(playlist.id), { disabled: !active }),
                button(playing ? "pause" : "play", playing ? "Pause playlist" : session?.pausedBy === "takeover" && active ? "Resume playlist" : "Play playlist", () => playing ? pause() : play(playlist.id)),
                button("next", "Next preset", () => active ? advance(1) : play(playlist.id), { disabled: !active }),
                el("button", { class: `vp-icon-btn vp-repeat-${playlist.repeat}${playlist.repeat !== "off" ? " active" : ""}`, type: "button", title: repeatLabels[playlist.repeat], "aria-label": repeatLabels[playlist.repeat],
                    onclick: () => { playlist.repeat = { all: "one", one: "off", off: "all" }[playlist.repeat]; touch(playlist); host.toast(repeatLabels[playlist.repeat]); } },
                [icon("repeat"), playlist.repeat === "one" ? el("span", { class: "vp-badge", text: "1" }) : null]),
                button("shuffle", playlist.shuffle ? "Shuffle on" : "Shuffle off", () => { playlist.shuffle = !playlist.shuffle; touch(playlist); host.toast(playlist.shuffle ? "Shuffle on" : "Shuffle off"); }, { pressed: playlist.shuffle }),
                active ? button("close", "Stop playlist", () => { stop(); host.toast("Playlist stopped"); }) : null
            ]);
            if (inConsole) {
                const status = active ? statusText() : { title: playlist.name, line: "Ready to play" };
                container.append(
                    el("div", { class: "vp-transport-status" }, [el("strong", { text: status.title }), el("span", { text: status.line })]),
                    el("div", { class: "vp-progress" }, el("i")),
                    controls,
                    el("p", { class: "micro-tip", text: "Choosing a preset, turning on Flow, the dice, history or a saved scene pauses the playlist. Slider tweaks last until the next preset." })
                );
            } else {
                const status = statusText();
                container.append(
                    el("button", { class: "vp-bar-open", type: "button", title: "Edit in Cosmic Console", "aria-label": "Edit playlist in Cosmic Console", onclick: () => host.openConsole() }, icon("list")),
                    el("div", { class: "vp-transport-status" }, [el("strong", { text: status.title }), el("span", { text: status.line })]),
                    controls,
                    el("div", { class: "vp-progress" }, el("i"))
                );
            }
            renderProgress();
        }

        function renderBar() {
            if (!ui.bar) return;
            renderTransport(ui.bar, false);
            ui.bar.classList.toggle("vp-attention", Boolean(session && session.pausedBy === "takeover"));
            document.body.classList.toggle("vp-session", Boolean(session));
        }

        function renderProgress() {
            const playlist = sessionPlaylist();
            const entry = currentEntry();
            const fraction = session && playlist && entry
                ? clamp(session.t / Math.max(0.1, session.transitionSeconds + entryStay(playlist, entry)), 0, 1) : 0;
            document.querySelectorAll(".vp-progress i").forEach(bar => { bar.style.transform = `scaleX(${fraction})`; });
            const size = document.getElementById("vp-record-size");
            const canvas = host.canvas();
            if (size && canvas) {
                const text = recordSizeText(canvas);
                if (size.textContent !== text) size.textContent = text;
            }
        }

        function recordSizeText(canvas) {
            return `The canvas renders at ${canvas.width} × ${canvas.height} (${canvas.width >= canvas.height ? "landscape" : "portrait"}) on this screen. Captures and recordings contain only the canvas: no controls, status bar or toasts.`;
        }

        // ---- Mount ---------------------------------------------------------
        function mount() {
            const tab = document.getElementById("tab-playlists");
            if (tab) {
                ui.list = el("div", { class: "vp-list" });
                ui.consoleTransport = el("div", { class: "vp-transport vp-console-transport" });
                ui.editor = el("div", { class: "vp-editor" });
                tab.append(
                    el("div", { class: "setting-group" }, [
                        el("span", { class: "setting-label-header", text: "VISUAL PLAYLISTS" }),
                        el("p", { class: "setting-desc", text: "Line up favorite presets, pair them with color playlists, and let them play on their own. Saved in this browser." }),
                        ui.consoleTransport,
                        ui.list,
                        el("div", { class: "vp-list-actions" }, [
                            el("button", { class: "btn-text", type: "button", onclick: () => {
                                if (store.playlists.length >= MAX_PLAYLISTS) { host.toast(`Up to ${MAX_PLAYLISTS} playlists`); return; }
                                const favorites = host.orderedKeys().filter(key => host.favorites().has(key) && isPlayable(key));
                                const playlist = createPlaylist(`Playlist ${store.playlists.length + 1}`, favorites.slice(0, 12));
                                store.playlists.push(playlist);
                                store.selectedId = playlist.id;
                                pickerOpen = !favorites.length;
                                persist(); render();
                                host.toast(favorites.length ? `New playlist with your ${Math.min(12, favorites.length)} favorites` : "New playlist · add presets below");
                                document.getElementById("vp-name-input")?.select();
                            } }, "+ New playlist"),
                            store.playlists.some(p => p.demo) ? null : el("button", { class: "btn-text", type: "button", onclick: () => {
                                const demo = createDemoPlaylist();
                                store.playlists.push(demo);
                                store.selectedId = demo.id;
                                persist(); render();
                            } }, "Restore demo")
                        ])
                    ]),
                    ui.editor
                );
            }
            ui.bar = document.getElementById("playlist-bar");
            render();
            ensureClock();
        }

        // Excluding or favoriting presets elsewhere changes what can play.
        function refresh() { render(); }

        mount();
        return {
            play, pause, resume, stop, next: () => advance(1), previous: () => advance(-1),
            takeover, dissolveFrame, refresh,
            isActive: () => Boolean(session),
            isPlaying: () => session?.state === "playing",
            getState: () => session ? { ...session, playlist: sessionPlaylist()?.name, entry: currentEntry()?.preset } : null,
            getStore: () => store,
            // Read-only snapshot of the live scene, for checks and diagnostics.
            sceneSettings: () => host.scene?.() || null
        };
    }

    const api = {
        STORAGE_KEY, STAY_STEPS, TRANSITION_STEPS, COLOR_EVERY_STEPS, COLOR_FADE_STEPS, COLOR_PLAYLIST_NAMES, DEMO_PRESETS,
        createPlaylist, createDemoPlaylist, normalizePlaylist, loadStore, saveStore, duplicatePlaylist, moveEntry,
        entryStay, passSeconds, formatDuration, buildOrder, computeTargets, discreteSettings, buildColorRotation,
        effectiveTransition,
        controller: null,
        init(host) {
            api.controller = createController(host);
            return api.controller;
        },
        // Thin forwards so app.js can call these before or without init.
        takeover(kind, label) { return api.controller ? api.controller.takeover(kind, label) : false; },
        dissolveFrame(sim) { api.controller?.dissolveFrame(sim); },
        refresh() { api.controller?.refresh(); }
    };

    global.VisualPlaylists = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
