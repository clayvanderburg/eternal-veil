// ==========================================================================
// ETERNAL VOID - MAIN APPLICATION CONTROLLER
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // --- DIAGNOSTIC LOGGER UTILITY ---
    class CosmicLogger {
        static logs = [];
        static maxLogs = 100;
        
        static log(message, type = "info") {
            const time = new Date().toTimeString().split(' ')[0];
            const entryText = `[${time}] [${type.toUpperCase()}] ${message}`;
            
            this.logs.push({ text: entryText, type });
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }
            
            const container = document.getElementById("console-log-history");
            if (container) {
                const el = document.createElement("div");
                el.className = `log-entry log-${type}`;
                el.textContent = entryText;
                container.appendChild(el);
                container.scrollTop = container.scrollHeight;
            }
            
            if (type === "info") console.log(entryText);
            else if (type === "warn") console.warn(entryText);
            else if (type === "error") console.error(entryText);
        }
        
        static info(msg) { this.log(msg, "info"); }
        static warn(msg) { this.log(msg, "warn"); }
        static error(msg) { this.log(msg, "error"); }
    }
    window.CosmicLogger = CosmicLogger;

    // 1. Initialize core modules
    const sim = new FlowSimulation("canvas");
    const exporter = new MediaExporter(sim);
    
    // Active UI transitions for smooth parameter morphing
    const activeTransitions = {};
    let activePaletteTransition = null;
    let autopilotTimer = null;
    let autopilotColorTimer = null;
    let isAutopilot = true;
    let lastPresetKey = null;
    let lastFlowPatternShape = null;
    const validFlowPersonalities = ["serene", "alive", "wild"];
    let flowPersonality = localStorage.getItem("eternalVoidFlowPersonality") || localStorage.getItem("eternalVeilFlowPersonality") || "serene";
    if (!validFlowPersonalities.includes(flowPersonality)) flowPersonality = "serene";
    let isComfortMode = (localStorage.getItem("eternalVoidComfortMode") || localStorage.getItem("eternalVeilComfortMode")) === "true";
    const validExperienceModes = ["flow", "meditation", "solid"];
    // Always open in the approachable general-purpose Flow experience. Modes are
    // intentional session choices; Meditation must never surprise a returning user.
    let experienceMode = "flow";
    let breathingRhythm = localStorage.getItem("eternalVoidBreathingRhythm") || localStorage.getItem("eternalVeilBreathingRhythm") || "relaxed";
    if (!["relaxed", "box", "deep"].includes(breathingRhythm)) breathingRhythm = "relaxed";
    let breathingCycleStartedAt = Date.now();
    let lastMeditationPaletteUpdateAt = 0;
    let preMeditationState = null;
    let autopilotBeforeMeditation = true;
    let activePresetLocks = [];
    let activeColorCycle = localStorage.getItem("eternalVoidColorCycle") || localStorage.getItem("eternalVeilColorCycle") || "random";
    let favoritePresetKeys = new Set();
    let excludedPresetKeys = new Set();
    try {
        const savedFavorites = JSON.parse(localStorage.getItem("eternalVoidFavoritePresets") || localStorage.getItem("eternalVeilFavoritePresets") || "[]");
        if (Array.isArray(savedFavorites)) favoritePresetKeys = new Set(savedFavorites);
        
        const savedExcluded = JSON.parse(localStorage.getItem("eternalVoidExcludedPresets") || "[]");
        if (Array.isArray(savedExcluded)) excludedPresetKeys = new Set(savedExcluded);
    } catch (error) {
        console.warn("Could not load preset favorites", error);
    }
    
    // 3D/VR Mode States
    let is3DMode = false;
    let sim3D = null;

    function load3DStyle() {
        const saved = localStorage.getItem("eternalVoid3DStyle") || localStorage.getItem("eternalVeil3DStyle");
        return (saved === "dome" || saved === "native") ? saved : "native";
    }

    function save3DStyle(style) {
        localStorage.setItem("eternalVoid3DStyle", style);
    }

    let selected3DStyle = load3DStyle();
    let vrPaletteIndex = -1;
    const vrPaletteNames = [
        "Solar Ember", "Violet Dream", "Ocean Glass", "Sunset Voltage",
        "Verdant Tide", "Rose Horizon", "Cosmic Dawn", "Hyper Neon"
    ];

    // --- COSMIC CONFIGURATION HISTORY ENGINE ---
    const ConfigHistory = {
        states: [],
        index: -1,
        maxSize: 50,
        
        init() {
            try {
                const saved = localStorage.getItem("eternalVoidHistory") || localStorage.getItem("eternalVeilHistory");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        this.states = parsed;
                        this.index = this.states.length - 1;
                    }
                }
            } catch (e) {
                console.error("Failed to load configuration history", e);
            }
        },
        
        save() {
            try {
                localStorage.setItem("eternalVoidHistory", JSON.stringify(this.states));
            } catch (e) {
                console.error("Failed to save configuration history", e);
            }
        },
        
        push(state) {
            // If we are in the middle of history (went back) and push a new config,
            // truncate all forward history (browser history style)
            if (this.index < this.states.length - 1) {
                this.states = this.states.slice(0, this.index + 1);
            }
            
            // Check if the state is identical to current to avoid duplicate history states
            if (this.states.length > 0) {
                const current = this.states[this.index];
                if (current && JSON.stringify(current.settings) === JSON.stringify(state.settings) && 
                    JSON.stringify(current.palette) === JSON.stringify(state.palette) && 
                    current.backgroundColor === state.backgroundColor && 
                    current.isSolidMode === state.isSolidMode) {
                    return;
                }
            }
            
            this.states.push(state);
            if (this.states.length > this.maxSize) {
                this.states.shift();
            }
            this.index = this.states.length - 1;
            this.save();
            this.updateButtons();
        },
        
        back() {
            if (this.index > 0) {
                this.index--;
                this.updateButtons();
                return this.states[this.index];
            }
            return null;
        },
        
        forward() {
            if (this.index < this.states.length - 1) {
                this.index++;
                this.updateButtons();
                return this.states[this.index];
            }
            return null;
        },
        
        updateButtons() {
            const prevBtn = document.getElementById("history-prev-btn");
            const nextBtn = document.getElementById("history-next-btn");
            if (prevBtn) {
                prevBtn.disabled = this.index <= 0;
                prevBtn.classList.toggle("disabled", this.index <= 0);
            }
            if (nextBtn) {
                nextBtn.disabled = this.index >= this.states.length - 1;
                nextBtn.classList.toggle("disabled", this.index >= this.states.length - 1);
            }
        }
    };

    function captureHistoryState() {
        if (!sim) return;
        const state = {
            settings: { ...sim.settings },
            palette: [...sim.palette],
            backgroundColor: sim.backgroundColor,
            isSolidMode: sim.isSolidMode
        };
        ConfigHistory.push(state);
    }

    let historyDebounceTimer = null;
    function triggerHistoryCaptureDebounced() {
        clearTimeout(historyDebounceTimer);
        historyDebounceTimer = setTimeout(() => {
            captureHistoryState();
        }, 1000);
    }

    function syncAllSlidersToSettings() {
        const sliderMap = {
            speed: "speed-slider",
            turbulence: "turbulence-slider",
            density: "density-slider",
            flowOrganic: "curl-slider",
            dissipation: "dissipation-slider",
            zoom: "zoom-slider",
            baseSize: "size-slider",
            sizeVariation: "size-var-slider",
            stretch: "stretch-slider",
            interaction: "interaction-slider",
            mouseInfluence: "mouse-influence-slider",
            rotationSpeed: "rotation-slider",
            wobble: "wobble-slider",
            kaleidoscopeSegments: "kaleido-segments-slider"
        };
        Object.keys(sliderMap).forEach(key => {
            const slider = document.getElementById(sliderMap[key]);
            if (slider && sim.settings[key] !== undefined) {
                slider.value = sim.settings[key];
            }
        });
        updateSliderTextDisplays();
    }

    function applyHistoryState(state) {
        if (!state) return;
        
        Object.keys(state.settings).forEach(key => {
            const val = state.settings[key];
            if (typeof val === "number") {
                startMorph(key, val);
            } else {
                sim.settings[key] = val;
            }
        });
        
        elements.kaleidoscopeToggle.checked = state.settings.kaleidoscopeEnabled;
        if (state.settings.kaleidoscopeEnabled) {
            elements.kaleidoscopeSettings.classList.remove("hidden");
        } else {
            elements.kaleidoscopeSettings.classList.add("hidden");
        }
        elements.psychedelicToggle.checked = state.settings.psychedelicMode;
        elements.morphingBgToggle.checked = state.settings.morphingBg;
        elements.spinningKaleidoToggle.checked = state.settings.spinningKaleido;
        elements.particleShapeSelect.value = state.settings.particleShape || "ellipse";
        elements.particleLightingSelect.value = state.settings.particleLighting || "glow";
        
        syncAllSlidersToSettings();
        
        updateActivePalette([...state.palette]);
        renderSwatches();
        
        sim.backgroundColor = state.backgroundColor;
        if (elements.bgColorPicker) {
            elements.bgColorPicker.value = state.backgroundColor;
            elements.bgHexVal.textContent = state.backgroundColor.toUpperCase();
        }
        
        sim.isSolidMode = state.isSolidMode;
        elements.solidModeToggle.checked = state.isSolidMode;
        
        modulateSynth();
        
        releaseActivePreset({ announce: false });
    }

    function applyRandomConfig() {
        const rnd = (min, max) => min + Math.random() * (max - min);
        const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
        const occasionallyChange = (current, chance, enabledChance) =>
            Math.random() < chance ? Math.random() < enabledChance : current;
        const zenShapes = [
            "ellipse", "ellipse", "drop", "ring", "nebula", "aquatic",
            "ocean", "aurora", "orbitals", "lotus", "spiral"
        ];
        const nextShape = Math.random() < 0.24
            ? zenShapes[Math.floor(Math.random() * zenShapes.length)]
            : sim.settings.particleShape;
        const lightingStyles = ["glow", "reactive", "pearl"];
        const nextLighting = Math.random() < 0.22
            ? lightingStyles[Math.floor(Math.random() * lightingStyles.length)]
            : (sim.settings.particleLighting || "glow");
        
        const randomSettings = {
            speed: rnd(0.2, 2.8),
            turbulence: rnd(0.08, 1.9),
            density: rndInt(650, 3300),
            flowOrganic: rnd(0.3, 1.5),
            dissipation: rnd(0.006, 0.05),
            zoom: rnd(0.55, 3.5),
            baseSize: rnd(0.7, 7.8),
            sizeVariation: rnd(0.2, 3.8),
            stretch: rnd(0.1, 3.6),
            interaction: rnd(0.05, 2.2),
            mouseInfluence: rnd(0.2, 3.0),
            rotationSpeed: rnd(0.0, 0.36),
            wobble: rnd(0.04, 0.7),
            kaleidoscopeEnabled: occasionallyChange(sim.settings.kaleidoscopeEnabled, 0.12, 0.18),
            kaleidoscopeSegments: rndInt(4, 9),
            psychedelicMode: occasionallyChange(sim.settings.psychedelicMode, 0.07, 0.06),
            morphingBg: occasionallyChange(sim.settings.morphingBg, 0.12, 0.24),
            spinningKaleido: occasionallyChange(sim.settings.spinningKaleido, 0.07, 0.08),
            particleShape: nextShape,
            particleLighting: nextLighting
        };
        if (isComfortMode) {
            randomSettings.speed = Math.min(randomSettings.speed, 1.35);
            randomSettings.turbulence = Math.min(randomSettings.turbulence, 0.85);
            randomSettings.density = Math.min(randomSettings.density, 2200);
            randomSettings.baseSize = Math.min(randomSettings.baseSize, 7);
            randomSettings.stretch = Math.min(randomSettings.stretch, 3);
            randomSettings.rotationSpeed = Math.min(randomSettings.rotationSpeed, 0.18);
            randomSettings.wobble = Math.min(randomSettings.wobble, 0.38);
            randomSettings.psychedelicMode = false;
            randomSettings.morphingBg = false;
            randomSettings.spinningKaleido = false;
        }

        const randomPalette = generateHarmoniousPalette(flowPersonality);
        const duration = rnd(8000, 12000);
        
        Object.keys(randomSettings).forEach(key => {
            if (typeof randomSettings[key] === "number") {
                startMorph(key, randomSettings[key], duration * rnd(0.88, 1.12));
            } else {
                sim.settings[key] = randomSettings[key];
            }
        });
        
        elements.kaleidoscopeToggle.checked = randomSettings.kaleidoscopeEnabled;
        if (randomSettings.kaleidoscopeEnabled) {
            elements.kaleidoscopeSettings.classList.remove("hidden");
        } else {
            elements.kaleidoscopeSettings.classList.add("hidden");
        }
        elements.psychedelicToggle.checked = randomSettings.psychedelicMode;
        elements.morphingBgToggle.checked = randomSettings.morphingBg;
        elements.spinningKaleidoToggle.checked = randomSettings.spinningKaleido;
        elements.particleShapeSelect.value = randomSettings.particleShape;
        elements.particleLightingSelect.value = randomSettings.particleLighting;
        
        startPaletteMorph(randomPalette, duration * 1.25);
        modulateSynth();
        
        releaseActivePreset({ announce: false });
        
        captureHistoryState();
        
        showToast("New cosmic configuration generated! 🎲");
        CosmicLogger.info("Generated new custom randomized settings.");
    }

    // Fading UI inactivity timers & headphones warning variables
    let uiFadeTimeout = null;
    let isMouseOverUI = false;
    let headphonesPromptTimeout = null;

    // Cache DOM Elements
    const elements = {
        controlPanel: document.getElementById("control-panel"),
        menuToggleBtn: document.getElementById("menu-toggle-btn"),
        closePanelBtn: document.getElementById("close-panel-btn"),
        sidebarHandle: document.getElementById("sidebar-handle"),
        floatingActions: document.getElementById("floating-actions"),
        
        // Modal & Guide
        shortcutLegendBtn: document.getElementById("shortcut-legend-btn"),
        keyboardModal: document.getElementById("keyboard-modal"),
        modalCloseBtn: document.getElementById("modal-close-btn"),
        toast: document.getElementById("toast-notify"),
        
        // Quick Buttons
        audioToggleBtn: document.getElementById("audio-toggle-btn"),
        fullscreenToggleBtn: document.getElementById("fullscreen-toggle-btn"),
        pauseBtn: document.getElementById("pause-btn"),
        
        // HUD Texts
        hudFps: document.getElementById("hud-fps"),
        hudParticles: document.getElementById("hud-particles"),
        hudMode: document.getElementById("hud-mode"),
        hudPresetName: document.getElementById("hud-preset-name"),
        hudPresetBan: document.getElementById("hud-preset-ban"),
        hudPresetStar: document.getElementById("hud-preset-star"),
        hudPresetLock: document.getElementById("hud-preset-lock"),
        hudColorSwatches: document.getElementById("hud-color-swatches"),
        hudColorStar: document.getElementById("hud-color-star"),
        hudColorLock: document.getElementById("hud-color-lock"),
        hudVisualizer: document.getElementById("hud-audio-visualizer-container"),
        
        // Presets & Colors
        presetsGrid: document.getElementById("presets-grid"),
        swatchesPalette: document.getElementById("swatches-palette"),
        randomizePaletteBtn: document.getElementById("randomize-palette-btn"),
        particleColorPicker: document.getElementById("particle-color-picker"),
        pickerHexVal: document.getElementById("picker-hex-val"),
        addColorBtn: document.getElementById("add-color-btn"),
        bgColorPicker: document.getElementById("bg-color-picker"),
        bgHexVal: document.getElementById("bg-hex-val"),
        solidModeToggle: document.getElementById("solid-mode-toggle"),
        
        // Autopilot
        autopilotToggle: document.getElementById("autopilot-toggle"),
        autopilotSettings: document.getElementById("autopilot-settings"),
        autopilotColorToggle: document.getElementById("autopilot-color-toggle"),
        autoPatternSlider: document.getElementById("auto-pattern-slider"),
        autoPatternVal: document.getElementById("auto-pattern-val"),
        autoColorSlider: document.getElementById("auto-color-slider"),
        autoColorVal: document.getElementById("auto-color-val"),
        comfortModeToggle: document.getElementById("comfort-mode-toggle"),
        personalityButtons: document.querySelectorAll(".personality-btn"),
        flowPersonalityDescription: document.getElementById("flow-personality-description"),
        experienceModeButtons: document.querySelectorAll(".experience-mode-btn"),
        experienceModeDescription: document.getElementById("experience-mode-description"),
        meditationControls: document.getElementById("meditation-controls"),
        breathingRhythmSelect: document.getElementById("breathing-rhythm-select"),
        breathingGuideToggle: document.getElementById("breathing-guide-toggle"),
        breathingGuide: document.getElementById("breathing-guide"),
        breathingPhase: document.getElementById("breathing-phase"),
        breathingCountdown: document.getElementById("breathing-countdown"),
        
        // Sliders & Controls
        speedSlider: document.getElementById("speed-slider"),
        speedVal: document.getElementById("speed-val"),
        turbulenceSlider: document.getElementById("turbulence-slider"),
        turbulenceVal: document.getElementById("turbulence-val"),
        densitySlider: document.getElementById("density-slider"),
        densityVal: document.getElementById("density-val"),
        curlSlider: document.getElementById("curl-slider"),
        curlVal: document.getElementById("curl-val"),
        dissipationSlider: document.getElementById("dissipation-slider"),
        dissipationVal: document.getElementById("dissipation-val"),
        zoomSlider: document.getElementById("zoom-slider"),
        zoomVal: document.getElementById("zoom-val"),
        
        sizeSlider: document.getElementById("size-slider"),
        sizeVal: document.getElementById("size-val"),
        sizeVarSlider: document.getElementById("size-var-slider"),
        sizeVarVal: document.getElementById("size-var-val"),
        stretchSlider: document.getElementById("stretch-slider"),
        stretchVal: document.getElementById("stretch-val"),
        interactionSlider: document.getElementById("interaction-slider"),
        interactionVal: document.getElementById("interaction-val"),
        
        mouseInfluenceSlider: document.getElementById("mouse-influence-slider"),
        mouseInfluenceVal: document.getElementById("mouse-influence-val"),
        mouseModeSelect: document.getElementById("mouse-mode-select"),
        
        kaleidoscopeToggle: document.getElementById("kaleidoscope-toggle"),
        kaleidoscopeSettings: document.getElementById("kaleidoscope-settings"),
        kaleidoSegmentsSlider: document.getElementById("kaleido-segments-slider"),
        kaleidoSegmentsVal: document.getElementById("kaleido-segments-val"),
        
        rotationSlider: document.getElementById("rotation-slider"),
        rotationVal: document.getElementById("rotation-val"),
        wobbleSlider: document.getElementById("wobble-slider"),
        wobbleVal: document.getElementById("wobble-val"),
        
        // Export & Audio
        soundEnableToggle: document.getElementById("sound-enable-toggle"),
        audioSettingsSliders: document.getElementById("audio-settings-sliders"),
        synthVolumeSlider: document.getElementById("synth-volume-slider"),
        synthVolumeVal: document.getElementById("synth-volume-val"),
        shareLinkBtn: document.getElementById("share-link-btn"),
        captureSnapshotBtn: document.getElementById("capture-snapshot-btn"),
        recordFlowBtn: document.getElementById("record-flow-btn"),
        factoryResetBtn: document.getElementById("factory-reset-btn"),
        resetAllFlowBtn: document.getElementById("reset-all-flow-btn"),
        
        // Psychedelic elements
        psychedelicToggle: document.getElementById("psychedelic-toggle"),
        morphingBgToggle: document.getElementById("morphing-bg-toggle"),
        spinningKaleidoToggle: document.getElementById("spinning-kaleido-toggle"),
        shockwavesToggle: document.getElementById("shockwaves-toggle"),
        particleShapeSelect: document.getElementById("particle-shape-select"),
        particleLightingSelect: document.getElementById("particle-lighting-select"),
        webglStyleQuickSelector: document.getElementById("webgl-style-quick-selector"),
        stylePillNative: document.getElementById("style-pill-native"),
        stylePillDome: document.getElementById("style-pill-dome"),
        
        // Fading & binaural elements
        hud: document.getElementById("hud"),
        autopilotHelpTooltip: document.getElementById("autopilot-help-tooltip"),
        binauralModeSelect: document.getElementById("binaural-mode-select"),
        headphonesPrompt: document.getElementById("headphones-prompt"),
        splashScreen: document.getElementById("splash-screen"),
        bilateralToggle: document.getElementById("bilateral-toggle"),
        asmrToggle: document.getElementById("asmr-toggle"),
        
        // Channel Mixer elements
        droneVolumeSlider: document.getElementById("drone-volume-slider"),
        droneVolumeVal: document.getElementById("drone-volume-val"),
        bilateralVolumeSlider: document.getElementById("bilateral-volume-slider"),
        bilateralVolumeVal: document.getElementById("bilateral-volume-val"),
        asmrVolumeSlider: document.getElementById("asmr-volume-slider"),
        asmrVolumeVal: document.getElementById("asmr-volume-val"),
        
        // Music Reactivity elements
        micReactBtn: document.getElementById("mic-react-btn"),
        systemReactBtn: document.getElementById("system-react-btn"),
        uploadReactBtn: document.getElementById("upload-react-btn"),
        musicFileInput: document.getElementById("music-file-input"),
        visualizerStatus: document.getElementById("visualizer-status"),
        pulseBassToggle: document.getElementById("pulse-bass-toggle"),
        pulseTrebleToggle: document.getElementById("pulse-treble-toggle"),
        
        // WebGL 3D elements
        webgl3DToggleBtn: document.getElementById("webgl-3d-toggle-btn"),
        enterVrBtn: document.getElementById("enter-vr-btn"),
        webglCanvas: document.getElementById("webgl-canvas"),
        canvas2D: document.getElementById("canvas"),
        
        musicReactQuickBtn: document.getElementById("music-react-quick-btn"),
        enterStandardBtn: document.getElementById("enter-standard-btn"),
        enterComfortBtn: document.getElementById("enter-comfort-btn"),
        
        // Color Cycle Playlist buttons
        themeCycleButtons: document.querySelectorAll(".theme-cycle-btn"),
        themeCycleDesc: document.getElementById("theme-cycle-desc")
    };



    // --- INITIALIZATION ---
    function initialize() {
        CosmicLogger.info("ETERNAL VOID initializing...");
        
        // --- DOMAIN LOCK PROTECTOR ---
        const allowedHosts = [
            "localhost", 
            "127.0.0.1", 
            "eternal-veil.netlify.app", 
            "eternal-void.netlify.app", 
            "eternalvoid.io", 
            "www.eternalvoid.io"
        ];
        const hostname = window.location.hostname.toLowerCase();
        const isCanonicalPreview = hostname.endsWith("--eternal-veil.netlify.app") || hostname.endsWith("--eternal-void.netlify.app");
        const isAllowed = allowedHosts.includes(hostname) || isCanonicalPreview;
        if (!isAllowed) {
            document.body.innerHTML = `
                <div style="
                    display: flex; 
                    flex-direction: column; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    background: #020207; 
                    color: #e2e8f0; 
                    font-family: 'Inter', system-ui, sans-serif;
                    text-align: center;
                    padding: 20px;
                ">
                    <h1 style="color: #818cf8; font-size: 24px; margin-bottom: 10px; font-weight: 700; letter-spacing: 0.5px;">Unauthorized Mirror Detected</h1>
                    <p style="color: #94a3b8; font-size: 14px; max-width: 400px; line-height: 1.6; margin-bottom: 24px;">
                        This digital interactive art piece is hosted exclusively at the official domain.
                    </p>
                    <a href="https://eternalvoid.io" style="
                        background: #4f46e5; 
                        color: #ffffff; 
                        text-decoration: none; 
                        padding: 12px 24px; 
                        border-radius: 8px; 
                        font-weight: 700;
                        font-size: 13px;
                        box-shadow: 0 0 20px rgba(79, 70, 229, 0.4);
                        transition: all 0.2s ease;
                    ">Go to Official Site</a>
                </div>
            `;
            throw new Error("Domain lock triggered: unauthorized hostname mirror.");
        }
        ConfigHistory.init();
        setupTabs();
        setupFlowToggles();
        buildPresetCards();
        setupHarmonicDesigner();
        setupColorCycles();
        setFlowPersonality(flowPersonality, { announce: false, restart: false });
        setComfortMode(isComfortMode, { persist: false, announce: false });
        
        // Initialize master volume to 40% (comfortable default, starts muted)
        elements.synthVolumeSlider.value = 40;
        elements.synthVolumeVal.textContent = "40%";
        window.CosmicSynth.setVolume(0.4);
        CosmicLogger.info("Master volume initialized to 40%.");
        
        // Check for URL State Share link
        const urlState = UrlStateSync.parseUrlState();
        if (urlState) {
            applyLoadedState(urlState);
            showToast("Cosmic seed loaded successfully from URL");
            CosmicLogger.info("URL sharing seed parameters applied.");
        } else {
            // Enable Autoplay and randomize parameters immediately on load
            toggleAutopilot(true);
            randomizeAllParameters();
            CosmicLogger.info("Autopilot enabled and parameters randomized on launch.");
        }
        setExperienceMode(experienceMode, { persist: false, announce: false, initial: true });
        captureHistoryState();
        
        setupEventListeners();
        setupInteractionEvents();
        updateSliderTextDisplays();
        renderSwatches();

        // WebXR VR session callbacks to resize the canvas dynamically
        window.onVRSessionStart = () => {
            if (elements.stylePillNative) elements.stylePillNative.disabled = true;
            if (elements.stylePillDome) elements.stylePillDome.disabled = true;
            if (sim3D && sim3D.usesFlowTexture === false) {
                CosmicLogger.info("WebXR VR Session active in native volumetric particle mode.");
                return;
            }
            const profile = window.RenderQuality.getProfile("vrBalanced");
            CosmicLogger.info(`WebXR VR Session active. Resizing simulation backing texture to: ${profile.width}x${profile.height}`);
            sim.resize(profile.width, profile.height, 1.0);
        };

        window.onVRSessionEnd = () => {
            if (elements.stylePillNative) elements.stylePillNative.disabled = false;
            if (elements.stylePillDome) elements.stylePillDome.disabled = false;
            if (sim3D && sim3D.usesFlowTexture === false) {
                CosmicLogger.info("WebXR VR Session ended. Returning to the 2D visualizer and opening settings.");
                toggle3DMode(false);
                togglePanel(true);
                showToast("VR closed. Settings are ready.");
                return;
            }
            const profile = window.RenderQuality.getProfile("desktopHigh");
            CosmicLogger.info(`WebXR VR Session ended. Restoring desktop-3D backing texture to: ${profile.width}x${profile.height}`);
            sim.resize(profile.width, profile.height, 1.0);
        };
        
        // Native VR uses a lightweight in-headset canvas panel instead of trying
        // to project the full desktop drawer into WebXR. Keep this bridge small
        // and explicit so controller actions use the same settings/state logic as
        // desktop controls and remain synchronized after leaving the headset.
        window.onNativeVRControl = action => {
            const state = () => ({
                autopilot: isAutopilot,
                paused: Boolean(sim.isPaused),
                size: sim.settings.baseSize,
                speed: sim.settings.speed,
                density: sim.settings.density,
                palette: [...sim.palette],
                paletteName: vrPaletteNames[vrPaletteIndex] || "Custom Palette",
                lighting: sim.settings.particleLighting || "glow",
                effectName: lastPresetKey && StylePresets[lastPresetKey]
                    ? StylePresets[lastPresetKey].name
                    : `Custom / ${(sim.settings.particleShape || "ellipse").toUpperCase()}`,
                historyCanBack: ConfigHistory.index > 0,
                historyCanForward: ConfigHistory.index < ConfigHistory.states.length - 1
            });
            if (action === "getState") return state();

            const adjust = (key, delta, min, max, slider, integer = false) => {
                delete activeTransitions[key];
                setOptionToManual(key);
                let next = Math.max(min, Math.min(max, Number(sim.settings[key]) + delta));
                if (integer) next = Math.round(next);
                updateActiveSetting(key, next);
                if (slider) slider.value = String(next);
                if (key === "density") sim.updateDensity();
                updateSliderTextDisplays();
            };

            const capturePaletteTarget = palette => ConfigHistory.push({
                settings: { ...sim.settings },
                palette: [...palette],
                backgroundColor: sim.backgroundColor,
                isSolidMode: sim.isSolidMode
            });

            const selectCuratedPalette = delta => {
                releaseActivePreset({ announce: false });
                if (vrPaletteIndex < 0) {
                    vrPaletteIndex = delta > 0 ? 0 : CuratedPalettes.length - 1;
                } else {
                    vrPaletteIndex = (vrPaletteIndex + delta + CuratedPalettes.length) % CuratedPalettes.length;
                }
                const palette = [...CuratedPalettes[vrPaletteIndex]];
                startPaletteMorph(palette, 5200);
                capturePaletteTarget(palette);
            };

            const cyclePreset = delta => {
                const keys = Object.keys(StylePresets);
                if (keys.length === 0) return;
                let index = lastPresetKey ? keys.indexOf(lastPresetKey) : -1;
                if (index < 0) index = delta > 0 ? -1 : 0;
                index = (index + delta + keys.length) % keys.length;
                loadPreset(keys[index]);
            };

            switch (action) {
                case "togglePause":
                    togglePause();
                    break;
                case "toggleAutopilot":
                    toggleAutopilot(!isAutopilot);
                    break;
                case "historyBack": {
                    const previous = ConfigHistory.back();
                    if (previous) applyHistoryState(previous);
                    break;
                }
                case "historyForward": {
                    const next = ConfigHistory.forward();
                    if (next) applyHistoryState(next);
                    break;
                }
                case "randomFlow":
                    applyRandomConfig();
                    break;
                case "palettePrev":
                    selectCuratedPalette(-1);
                    break;
                case "paletteNext":
                    selectCuratedPalette(1);
                    break;
                case "randomPalette":
                    {
                        releaseActivePreset({ announce: false });
                        const palette = generateHarmoniousPalette(flowPersonality);
                        vrPaletteIndex = -1;
                        startPaletteMorph(palette, 5200);
                        capturePaletteTarget(palette);
                    }
                    break;
                case "effectPrev":
                    cyclePreset(-1);
                    break;
                case "effectNext":
                    cyclePreset(1);
                    break;
                case "cycleLighting": {
                    const styles = ["glow", "reactive", "pearl"];
                    const current = Math.max(0, styles.indexOf(sim.settings.particleLighting || "glow"));
                    const next = styles[(current + 1) % styles.length];
                    sim.settings.particleLighting = next;
                    if (elements.particleLightingSelect) elements.particleLightingSelect.value = next;
                    captureHistoryState();
                    break;
                }
                case "sizeDown":
                    adjust("baseSize", -0.5, 0.1, 14.0, elements.sizeSlider);
                    break;
                case "sizeUp":
                    adjust("baseSize", 0.5, 0.1, 14.0, elements.sizeSlider);
                    break;
                case "speedDown":
                    adjust("speed", -0.25, 0.0, 8.0, elements.speedSlider);
                    break;
                case "speedUp":
                    adjust("speed", 0.25, 0.0, 8.0, elements.speedSlider);
                    break;
                case "densityDown":
                    adjust("density", -250, 100, 8000, elements.densitySlider, true);
                    break;
                case "densityUp":
                    adjust("density", 250, 100, 8000, elements.densitySlider, true);
                    break;
            }

            if (sim3D && sim3D.usesFlowTexture === false) {
                sim3D.isPaused = Boolean(sim.isPaused);
            }
            return state();
        };
        
        // Start inactivity fade countdown
        resetUiFadeTimer();
        
        // Start animation loop
        requestAnimationFrame(tickLoop);
        CosmicLogger.info("ETERNAL VOID initialization complete. Main animation loop running.");
    }

    // --- SMOOTH MORPH TRANSITIONS ---
    function startMorph(key, targetValue, duration = 5200) {
        const current = sim.settings[key];
        if (current === undefined || Math.abs(current - targetValue) < 0.0001) return;
        
        activeTransitions[key] = {
            from: current,
            to: targetValue,
            start: Date.now(),
            duration: duration
        };
    }

    function startPaletteMorph(targetPalette, duration = 12000) {
        if (!Array.isArray(targetPalette) || targetPalette.length === 0) return;
        const count = Math.max(sim.palette.length, targetPalette.length);
        const normalize = palette => Array.from({ length: count }, (_, index) => {
            const hex = parseColorToHex(palette[index % palette.length]);
            return hexToHsl(hex) || { h: 0, s: 0, l: 100 };
        });

        activePaletteTransition = {
            from: normalize(sim.palette),
            to: normalize(targetPalette),
            start: Date.now(),
            duration,
            lastPaint: 0
        };
    }

    function processMorphs() {
        const now = Date.now();
        let updated = false;
        
        for (const key in activeTransitions) {
            const transition = activeTransitions[key];
            const elapsed = now - transition.start;
            const progress = Math.min(elapsed / transition.duration, 1.0);
            
            // Smootherstep eases gently at both ends, so changes drift instead of lurching.
            const eased = progress * progress * progress
                * (progress * (progress * 6.0 - 15.0) + 10.0);
            const val = transition.from + (transition.to - transition.from) * eased;
            
            updateActiveSetting(key, val);
            
            // Sync slider UI position
            const sliderId = `${key}-slider`;
            const customSliderMap = {
                flowOrganic: "curl-slider",
                baseSize: "size-slider",
                sizeVariation: "size-var-slider",
                mouseInfluence: "mouse-influence-slider",
                kaleidoscopeSegments: "kaleido-segments-slider"
            };
            
            const targetSlider = document.getElementById(customSliderMap[key] || sliderId);
            if (targetSlider) {
                targetSlider.value = val;
                updated = true;
            }
            
            if (progress >= 1.0) {
                delete activeTransitions[key];
            }
        }

        if (activePaletteTransition) {
            const transition = activePaletteTransition;
            const progress = Math.min((now - transition.start) / transition.duration, 1.0);
            const eased = progress * progress * progress
                * (progress * (progress * 6.0 - 15.0) + 10.0);

            if (now - transition.lastPaint >= 50 || progress >= 1.0) {
                const palette = transition.from.map((from, index) => {
                    const to = transition.to[index];
                    const hueDelta = ((to.h - from.h + 540) % 360) - 180;
                    const h = (from.h + hueDelta * eased + 360) % 360;
                    const s = from.s + (to.s - from.s) * eased;
                    const l = from.l + (to.l - from.l) * eased;
                    return hslToHex(h, s, l);
                });
                updateActivePalette(palette);
                transition.lastPaint = now;
            }

            if (progress >= 1.0) {
                activePaletteTransition = null;
                renderSwatches();
            }
        }
        
        if (updated) {
            updateSliderTextDisplays();
            if (sim.settings.density) sim.updateDensity();
        }
    }

    // --- PRESETS MANAGEMENT ---
    function buildPresetCards() {
        elements.presetsGrid.innerHTML = "";
        const keys = Object.keys(StylePresets).sort((a, b) => {
            const aEx = excludedPresetKeys.has(a) ? 1 : 0;
            const bEx = excludedPresetKeys.has(b) ? 1 : 0;
            if (aEx !== bEx) return aEx - bEx;
            const aFav = favoritePresetKeys.has(a) ? 1 : 0;
            const bFav = favoritePresetKeys.has(b) ? 1 : 0;
            return bFav - aFav;
        });
        keys.forEach(key => {
            const p = StylePresets[key];
            const isExcluded = excludedPresetKeys.has(key);
            const card = document.createElement("div");
            card.className = `preset-card${lastPresetKey === key ? " active" : ""}${isExcluded ? " excluded" : ""}`;
            card.setAttribute("data-preset", key);
            card.innerHTML = `
                <div class="preset-card-heading">
                    <div class="preset-name">${p.name}</div>
                    ${p.meditationPreset ? '<span class="meditation-preset-badge">MEDITATE</span>' : ''}
                    <div style="display:flex; gap:4px;">
                        <button class="preset-ban${isExcluded ? " active" : ""}" aria-label="Exclude preset" title="Exclude preset">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        </button>
                        <button class="preset-favorite${favoritePresetKeys.has(key) ? " active" : ""}" aria-label="Favorite preset" title="Favorite preset">★</button>
                    </div>
                </div>
                <div class="preset-desc">${p.desc}</div>
            `;
            const favoriteButton = card.querySelector(".preset-favorite");
            favoriteButton.onclick = event => {
                event.stopPropagation();
                if (favoritePresetKeys.has(key)) favoritePresetKeys.delete(key);
                else favoritePresetKeys.add(key);
                localStorage.setItem("eternalVoidFavoritePresets", JSON.stringify([...favoritePresetKeys]));
                buildPresetCards();
            };
            const banButton = card.querySelector(".preset-ban");
            banButton.onclick = event => {
                event.stopPropagation();
                if (excludedPresetKeys.has(key)) excludedPresetKeys.delete(key);
                else excludedPresetKeys.add(key);
                localStorage.setItem("eternalVoidExcludedPresets", JSON.stringify([...excludedPresetKeys]));
                buildPresetCards();
            };
            card.onclick = () => {
                if (!excludedPresetKeys.has(key)) loadPreset(key);
            };
            elements.presetsGrid.appendChild(card);
        });
    }

    function getPresetSignatureKeys(preset) {
        const keys = [
            "speed", "turbulence", "flowOrganic", "density", "dissipation", "zoom",
            "baseSize", "sizeVariation", "stretch", "interaction", "rotationSpeed", "wobble",
            "particleShape", "particleLighting", "colors"
        ];
        if (preset.kaleidoscopeEnabled) keys.push("kaleidoscopeEnabled", "kaleidoscopeSegments");
        if (preset.psychedelicMode) keys.push("psychedelicMode");
        if (preset.morphingBg) keys.push("morphingBg");
        if (preset.spinningKaleido) keys.push("spinningKaleido");
        return keys;
    }

    function updateHudPresetName(key) {
        if (!elements.hudPresetName) return;
        if (!key || !StylePresets[key]) {
            elements.hudPresetName.textContent = "CUSTOM";
            if (elements.hudPresetBan) elements.hudPresetBan.classList.add("hide");
            if (elements.hudPresetStar) elements.hudPresetStar.classList.add("hide");
            if (elements.hudPresetLock) elements.hudPresetLock.classList.add("hide");
        } else {
            elements.hudPresetName.textContent = StylePresets[key].name.toUpperCase();
            if (elements.hudPresetBan) {
                elements.hudPresetBan.classList.remove("hide");
                elements.hudPresetBan.classList.toggle("active-ban", excludedPresetKeys.has(key));
            }
            if (elements.hudPresetStar) {
                elements.hudPresetStar.classList.remove("hide");
                elements.hudPresetStar.classList.toggle("active-star", favoritePresetKeys.has(key));
            }
            if (elements.hudPresetLock) {
                elements.hudPresetLock.classList.remove("hide");
                elements.hudPresetLock.classList.toggle("active-lock", !isAutopilot);
                const lockIcon = elements.hudPresetLock.querySelector('.lock-icon');
                const unlockIcon = elements.hudPresetLock.querySelector('.unlock-icon');
                if (lockIcon) lockIcon.classList.toggle("hide", !isAutopilot);
                if (unlockIcon) unlockIcon.classList.toggle("hide", isAutopilot);
            }
        }
    }

    function updateHudColorSwatches(palette) {
        if (!elements.hudColorSwatches || !Array.isArray(palette)) return;
        elements.hudColorSwatches.innerHTML = "";
        for (let i = 0; i < 5; i++) {
            const color = palette[i] || palette[palette.length - 1] || "#ffffff";
            const swatch = document.createElement("div");
            swatch.className = "hud-swatch-circle";
            swatch.style.backgroundColor = color;
            swatch.style.boxShadow = `0 0 8px ${color}80`;
            elements.hudColorSwatches.appendChild(swatch);
        }
    }

    function releaseActivePreset({ announce = true } = {}) {
        activePresetLocks.forEach(setOptionToFlow);
        activePresetLocks = [];
        lastPresetKey = null;
        updateHudPresetName(null);
        document.querySelectorAll(".preset-card").forEach(card => card.classList.remove("active"));
        if (announce) showToast("Preset released. Flow is free again.");
    }

    function loadPreset(key) {
        const p = StylePresets[key];
        if (!p) return;

        if (lastPresetKey === key) {
            releaseActivePreset();
            return;
        }

        releaseActivePreset({ announce: false });
        
        lastPresetKey = key;
        updateHudPresetName(key);
        activePresetLocks = getPresetSignatureKeys(p);
        activePresetLocks.forEach(setOptionToManual);
        
        // Highlight active card
        document.querySelectorAll(".preset-card").forEach(c => {
            c.classList.remove("active");
            if (c.getAttribute("data-preset") === key) c.classList.add("active");
        });

        // Trigger smooth parameter morph transitions
        const comfortCaps = { speed: 1.35, turbulence: 0.85, density: 2200, baseSize: 7, stretch: 3, rotationSpeed: 0.18, wobble: 0.38 };
        const presetTarget = (key, value) => isComfortMode && comfortCaps[key] !== undefined
            ? Math.min(value, comfortCaps[key])
            : value;
        startMorph("speed", presetTarget("speed", p.speed));
        startMorph("turbulence", presetTarget("turbulence", p.turbulence));
        startMorph("flowOrganic", p.curl);
        startMorph("density", presetTarget("density", p.density));
        startMorph("dissipation", p.dissipation);
        startMorph("zoom", p.zoom);
        startMorph("baseSize", presetTarget("baseSize", p.size));
        startMorph("sizeVariation", p.sizeVar);
        startMorph("stretch", presetTarget("stretch", p.stretch));
        startMorph("interaction", p.interaction);
        startMorph("rotationSpeed", presetTarget("rotationSpeed", p.rotationSpeed));
        startMorph("wobble", presetTarget("wobble", p.wobble));
        
        // Colors travel the same gentle path instead of snapping to the preset.
        startPaletteMorph([...p.colors], 7000);

        // Apply custom flags for Psychedelic Drives if defined, else reset to default states
        const psychOn = !isComfortMode && p.psychedelicMode === true;
        sim.settings.psychedelicMode = psychOn;
        elements.psychedelicToggle.checked = psychOn;

        const morphBgOn = !isComfortMode && p.morphingBg === true;
        sim.settings.morphingBg = morphBgOn;
        elements.morphingBgToggle.checked = morphBgOn;

        const spinKaleidoOn = !isComfortMode && p.spinningKaleido === true;
        sim.settings.spinningKaleido = spinKaleidoOn;
        elements.spinningKaleidoToggle.checked = spinKaleidoOn;

        const shape = p.particleShape || "ellipse";
        sim.settings.particleShape = shape;
        elements.particleShapeSelect.value = shape;

        const lighting = p.particleLighting || "glow";
        sim.settings.particleLighting = lighting;
        elements.particleLightingSelect.value = lighting;

        const kaleidoOn = p.kaleidoscopeEnabled === true;
        sim.settings.kaleidoscopeEnabled = kaleidoOn;
        elements.kaleidoscopeToggle.checked = kaleidoOn;
        if (kaleidoOn) {
            elements.kaleidoscopeSettings.classList.remove("hidden");
            startMorph("kaleidoscopeSegments", p.kaleidoscopeSegments || 6);
        } else {
            elements.kaleidoscopeSettings.classList.add("hidden");
        }
        
        // Apply optional preset-specific audio overrides (e.g. for Hypnotic preset)
        const bilateralOn = p.bilateralEnabled === true;
        sim.settings.bilateralEnabled = bilateralOn;
        elements.bilateralToggle.checked = bilateralOn;
        window.CosmicSynth.setBilateralEnabled(bilateralOn);

        const asmrOn = p.asmrEnabled === true;
        sim.settings.asmrEnabled = asmrOn;
        elements.asmrToggle.checked = asmrOn;
        window.CosmicSynth.setAsmrEnabled(asmrOn);
        
        // Modulate synthesizer frequencies matching the active preset scale
        modulateSynth();
        
        showToast(`Preset shifted to: ${p.name}`);
        CosmicLogger.info(`Preset shifted to: ${p.name.toUpperCase()}.`);
        captureHistoryState();
    }

    // Loads a preset's PATTERN/PHYSICS only — colors are left to the independent
    // color playlist (Autopilot color interval / manual palette). This is what
    // Autopilot uses so the "current preset" is always a named, favoritable,
    // excludable entity while colors keep flowing on their own track.
    // Applies ONLY the PARTICLE GEOMETRY of a preset (shape, lighting, kaleidoscope,
    // look/audio flags). Flow params (speed/turbulence/density/colors/etc.) are left
    // to Autopilot's independent intervals — we do NOT lock them to Manual, so the
    // sim keeps flowing. This is what the HUD "current preset" actually means: the
    // geometry currently loaded.
    function loadPresetPatternOnly(key) {
        const p = StylePresets[key];
        if (!p) return;

        lastPresetKey = key;
        updateHudPresetName(key);

        // Geometry keys only — applied directly, no setOptionToManual on flow params.
        const shape = p.particleShape || "ellipse";
        sim.settings.particleShape = shape;
        if (elements.particleShapeSelect) elements.particleShapeSelect.value = shape;

        const lighting = p.particleLighting || "glow";
        sim.settings.particleLighting = lighting;
        if (elements.particleLightingSelect) elements.particleLightingSelect.value = lighting;

        const kaleidoOn = p.kaleidoscopeEnabled === true;
        sim.settings.kaleidoscopeEnabled = kaleidoOn;
        if (elements.kaleidoscopeToggle) elements.kaleidoscopeToggle.checked = kaleidoOn;
        if (kaleidoOn && elements.kaleidoscopeSettings) {
            elements.kaleidoscopeSettings.classList.remove("hidden");
            if (typeof p.kaleidoscopeSegments === "number") {
                startMorph("kaleidoscopeSegments", p.kaleidoscopeSegments);
            }
        } else if (elements.kaleidoscopeSettings) {
            elements.kaleidoscopeSettings.classList.add("hidden");
        }

        const spinOn = !isComfortMode && p.spinningKaleido === true;
        sim.settings.spinningKaleido = spinOn;
        if (elements.spinningKaleidoToggle) elements.spinningKaleidoToggle.checked = spinOn;

        const psychOn = !isComfortMode && p.psychedelicMode === true;
        sim.settings.psychedelicMode = psychOn;
        if (elements.psychedelicToggle) elements.psychedelicToggle.checked = psychOn;

        const morphBgOn = !isComfortMode && p.morphingBg === true;
        sim.settings.morphingBg = morphBgOn;
        if (elements.morphingBgToggle) elements.morphingBgToggle.checked = morphBgOn;

        const bilateralOn = p.bilateralEnabled === true;
        sim.settings.bilateralEnabled = bilateralOn;
        if (elements.bilateralToggle) elements.bilateralToggle.checked = bilateralOn;
        if (window.CosmicSynth && window.CosmicSynth.setBilateralEnabled) window.CosmicSynth.setBilateralEnabled(bilateralOn);

        const asmrOn = p.asmrEnabled === true;
        sim.settings.asmrEnabled = asmrOn;
        if (elements.asmrToggle) elements.asmrToggle.checked = asmrOn;
        if (window.CosmicSynth && window.CosmicSynth.setAsmrEnabled) window.CosmicSynth.setAsmrEnabled(asmrOn);

        // Highlight active card in the sidebar
        document.querySelectorAll(".preset-card").forEach(c => {
            c.classList.remove("active");
            if (c.getAttribute("data-preset") === key) c.classList.add("active");
        });

        modulateSynth();
        updateHudPresetName(key);
    }

    // Geometry-only signature: the keys that define a preset's "particle geometry".
    // Used for favorite/ban/exclude logic — favoriting = favoriting the geometry.
    function getPresetGeometryKeys() {
        return [
            "particleShape", "particleLighting", "kaleidoscopeEnabled",
            "kaleidoscopeSegments", "spinningKaleido", "psychedelicMode",
            "morphingBg", "bilateralEnabled", "asmrEnabled"
        ];
    }

    // Autopilot pattern picker: selects a REAL preset (not random params) so the
    // HUD always shows a live, named "current preset" (its geometry). Favorites are
    // weighted higher; excluded presets are never chosen; the most recent pick is
    // avoided so it doesn't immediately reselect itself.
    function autopilotPickPreset() {
        const keys = Object.keys(StylePresets).filter(k => !excludedPresetKeys.has(k));
        if (keys.length === 0) {
            showToast("All presets excluded. Reset in the sidebar.");
            return;
        }
        const favs = keys.filter(k => favoritePresetKeys.has(k));
        // 65% chance to favor a favorited geometry when any are available
        const pool = (favs.length > 0 && Math.random() < 0.65) ? favs : keys;
        const candidates = pool.filter(k => k !== lastPresetKey);
        const choice = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length ? candidates.length : pool.length))];
        loadPresetPatternOnly(choice);
    }
    function turnOffPsychedelicMode() {
        if (sim.settings.psychedelicMode) {
            sim.settings.psychedelicMode = false;
            if (elements.psychedelicToggle) elements.psychedelicToggle.checked = false;
            showToast("Rainbow Mode disabled to show custom colors.");
            CosmicLogger.info("Rainbow Cycle Mode disabled due to manual color change.");
        }
    }

    // --- PALETTE SWATCHES RENDERER ---
    function renderSwatches() {
        elements.swatchesPalette.innerHTML = "";
        sim.palette.forEach((color, idx) => {
            const swatch = document.createElement("div");
            swatch.className = "color-swatch";
            swatch.style.backgroundColor = color;
            swatch.title = "Click to remove";
            swatch.onclick = () => {
                if (sim.palette.length <= 1) {
                    showToast("Palette must retain at least 1 color.");
                    return;
                }
                setOptionToManual("colors");
                turnOffPsychedelicMode();
                sim.palette.splice(idx, 1);
                updateActivePalette([...sim.palette]);
                renderSwatches();
                modulateSynth();
            };
            elements.swatchesPalette.appendChild(swatch);
        });

        // Update root accent color for CSS glows to match first color in palette
        if (sim.palette[0]) {
            const hex = parseColorToHex(sim.palette[0]);
            // Convert Hex to HSL for dynamic variables
            const hsl = hexToHsl(hex);
            if (hsl) {
                document.documentElement.style.setProperty('--accent-h', hsl.h);
                document.documentElement.style.setProperty('--accent-s', `${hsl.s}%`);
                document.documentElement.style.setProperty('--accent-l', `${hsl.l}%`);
            }
        }
    }

    function hexToHsl(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    // --- AUTOPILOT MANUAL VS FLOW LOGIC ---
    let baseSettings = null;
    let basePalette = null;
    const optionModes = {};

    function updateActiveSetting(key, value) {
        sim.settings[key] = value;
        // If music reactivity is active and caching, sync manual overrides
        if (baseSettings && baseSettings.hasOwnProperty(key)) {
            baseSettings[key] = value;
        }
    }

    function updateActivePalette(newPalette) {
        sim.updatePalette(newPalette);
        if (sim3D) sim3D.updatePalette(newPalette);
        updateHudColorSwatches(newPalette);
        // If music reactivity is active and caching, sync manual overrides
        if (basePalette) {
            basePalette = [...newPalette];
        }
    }

    function isFlowEnabled(key) {
        if (!isAutopilot) return false;
        return optionModes[key] !== "manual";
    }

    const breathingRhythms = {
        relaxed: [
            { name: "BREATHE IN", duration: 4, from: 0, to: 1 },
            { name: "BREATHE OUT", duration: 6, from: 1, to: 0 }
        ],
        box: [
            { name: "BREATHE IN", duration: 4, from: 0, to: 1 },
            { name: "HOLD", duration: 4, from: 1, to: 1 },
            { name: "BREATHE OUT", duration: 4, from: 1, to: 0 },
            { name: "REST", duration: 4, from: 0, to: 0 }
        ],
        deep: [
            { name: "BREATHE IN", duration: 5, from: 0, to: 1 },
            { name: "HOLD", duration: 1, from: 1, to: 1 },
            { name: "BREATHE OUT", duration: 7, from: 1, to: 0 },
            { name: "REST", duration: 1, from: 0, to: 0 }
        ]
    };

    function setExperienceMode(mode, { persist = true, announce = true, initial = false } = {}) {
        const previousMode = experienceMode;
        experienceMode = validExperienceModes.includes(mode) ? mode : "flow";
        if (persist) localStorage.removeItem("eternalVoidExperienceMode");
        document.body.classList.toggle("meditation-mode", experienceMode === "meditation");
        document.body.classList.toggle("show-breathing-guide", experienceMode === "meditation" && elements.breathingGuideToggle.checked);
        elements.experienceModeButtons.forEach(button => {
            button.classList.toggle("active", button.dataset.experienceMode === experienceMode);
        });
        elements.meditationControls.classList.toggle("hidden", experienceMode !== "meditation");

        const descriptions = {
            flow: "Living visuals that continuously discover new configurations.",
            meditation: "A coherent breathing sanctuary layered over any visual preset.",
            solid: "A still field of uninterrupted color for ambient focus and chakra work."
        };
        elements.experienceModeDescription.textContent = descriptions[experienceMode];

        if (experienceMode === "meditation") {
            if (previousMode !== "meditation") {
                preMeditationState = {
                    settings: { ...sim.settings },
                    palette: [...sim.palette],
                    backgroundColor: sim.backgroundColor,
                    isSolidMode: false,
                    presetKey: lastPresetKey
                };
            }
            autopilotBeforeMeditation = isAutopilot;
            if (isAutopilot) toggleAutopilot(false);
            sim.isSolidMode = false;
            elements.solidModeToggle.checked = false;
            breathingCycleStartedAt = Date.now();
            if (lastPresetKey !== "breathSanctuary") loadPreset("breathSanctuary");
        } else if (experienceMode === "solid") {
            autopilotBeforeMeditation = isAutopilot;
            if (isAutopilot) toggleAutopilot(false);
            sim.isSolidMode = true;
            elements.solidModeToggle.checked = true;
            document.body.classList.remove("show-breathing-guide");
            if (is3DMode) toggle3DMode(false);
        } else {
            sim.isSolidMode = false;
            elements.solidModeToggle.checked = false;
            document.body.classList.remove("show-breathing-guide");
            if (preMeditationState) {
                const restoreState = preMeditationState;
                preMeditationState = null;
                applyHistoryState(restoreState);
                if (restoreState.presetKey && StylePresets[restoreState.presetKey]) {
                    lastPresetKey = restoreState.presetKey;
                    activePresetLocks = getPresetSignatureKeys(StylePresets[lastPresetKey]);
                    activePresetLocks.forEach(setOptionToManual);
                    buildPresetCards();
                }
            }
            if (!initial && autopilotBeforeMeditation && !isAutopilot) toggleAutopilot(true);
        }
        if (experienceMode !== "meditation") {
            delete sim.settings.meditationBreathLevel;
            delete sim.settings.meditationFieldScale;
            delete sim.settings.meditationTailScale;
            delete sim.settings.meditationGlowScale;
            delete sim.settings.meditationMotionScale;
            lastMeditationPaletteUpdateAt = 0;
            sim.particles.forEach(particle => {
                particle.palette = sim.palette;
                particle.color = sim.palette[particle.colorIndex % sim.palette.length] || particle.color;
            });
            elements.canvas2D.style.transform = "";
            elements.webglCanvas.style.transform = "";
            if (sim3D?.world) sim3D.world.scale.setScalar(1);
        }
        elements.hudMode.textContent = experienceMode === "meditation" ? "MEDITATE" : (experienceMode === "solid" ? "SOLID" : "FLOW");
        if (announce) showToast(`${experienceMode === "meditation" ? "Meditation" : experienceMode[0].toUpperCase() + experienceMode.slice(1)} mode active.`);
    }

    function processMeditationMode() {
        if (experienceMode !== "meditation") return;
        const phases = breathingRhythms[breathingRhythm] || breathingRhythms.relaxed;
        const total = phases.reduce((sum, phase) => sum + phase.duration, 0);
        let cursor = ((Date.now() - breathingCycleStartedAt) / 1000) % total;
        let phase = phases[0];
        for (const candidate of phases) {
            if (cursor <= candidate.duration) { phase = candidate; break; }
            cursor -= candidate.duration;
        }
        const progress = Math.max(0, Math.min(1, cursor / phase.duration));
        const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;
        const breathLevel = phase.from + (phase.to - phase.from) * eased;
        // Camera zoom never drops below 100%, so breathing cannot uncover an edge.
        // Most of the visible breath comes from the particles themselves below.
        const scale = 1.0 + breathLevel * 0.06;
        sim.settings.meditationBreathLevel = breathLevel;
        sim.settings.meditationFieldScale = scale;
        sim.settings.meditationTailScale = 0.52 + breathLevel * 1.08;
        sim.settings.meditationGlowScale = 0.58 + breathLevel * 0.76;
        sim.settings.meditationMotionScale = 0.62 + breathLevel * 0.68;

        // Recolor the small palette and existing particles at a modest cadence
        // instead of filtering every screen pixel every frame. This keeps the
        // temperature shift vivid while avoiding the severe full-canvas FPS cost.
        const now = Date.now();
        if (now - lastMeditationPaletteUpdateAt >= 90) {
            lastMeditationPaletteUpdateAt = now;
            const breathingPalette = sim.palette.map(color => {
                const hsl = hexToHsl(parseColorToHex(color));
                if (!hsl) return color;
                const hue = (hsl.h + 8 - breathLevel * 16 + 360) % 360;
                const saturation = Math.max(0, Math.min(100, hsl.s + 18 - breathLevel * 22));
                // Exhale retains the source lightness; only inhale brightens.
                const lightness = Math.max(0, Math.min(94, hsl.l + breathLevel * 12));
                return hslToHex(hue, saturation, lightness);
            });
            sim.particles.forEach(particle => {
                particle.palette = breathingPalette;
                particle.color = breathingPalette[particle.colorIndex % breathingPalette.length] || particle.color;
            });
        }
        elements.breathingGuide.style.setProperty("--breath-level", breathLevel.toFixed(3));
        elements.breathingPhase.textContent = phase.name;
        elements.breathingCountdown.textContent = Math.max(1, Math.ceil(phase.duration - cursor));
        // Keep both canvases fixed at full viewport coverage. The 2D renderer
        // applies this as an internal world/camera scale after painting its
        // background, so exhaling can never expose the page around the canvas.
        elements.canvas2D.style.transform = "";
        elements.webglCanvas.style.transform = "";
        if (is3DMode && sim3D?.usesFlowTexture === false && sim3D.world) {
            sim3D.world.scale.setScalar(scale);
        }
        elements.hudMode.textContent = is3DMode ? "MEDITATE 3D" : "MEDITATE";
    }

    function setOptionToManual(key) {
        optionModes[key] = "manual";
        const pillGroup = document.querySelector(`.flow-toggle-group[data-key="${key}"]`);
        if (pillGroup) {
            const options = pillGroup.querySelectorAll(".flow-toggle-option");
            options.forEach(span => {
                if (span.getAttribute("data-val") === "manual") {
                    span.classList.add("active");
                } else {
                    span.classList.remove("active");
                }
            });
        }
    }

    function setOptionToFlow(key) {
        optionModes[key] = "flow";
        const pillGroup = document.querySelector(`.flow-toggle-group[data-key="${key}"]`);
        if (!pillGroup) return;
        pillGroup.querySelectorAll(".flow-toggle-option").forEach(option => {
            option.classList.toggle("active", option.getAttribute("data-val") === "flow");
        });
    }

    function setFlowPersonality(personality, { announce = true, restart = true } = {}) {
        flowPersonality = validFlowPersonalities.includes(personality) ? personality : "serene";
        localStorage.setItem("eternalVoidFlowPersonality", flowPersonality);
        document.body.dataset.flowPersonality = flowPersonality;
        const descriptions = {
            serene: "Gentle motion, harmonious colors, and smaller changes.",
            alive: "Balanced variety with recognizable shifts and occasional energy.",
            wild: "Bold contrast, larger motion, and rare spectacle moments."
        };
        if (elements.flowPersonalityDescription) {
            elements.flowPersonalityDescription.textContent = descriptions[flowPersonality];
        }
        if (elements.hudPatternName) {
            elements.hudPatternName.textContent = flowPersonality.toUpperCase();
        }
        elements.personalityButtons?.forEach(button => {
            button.classList.toggle("active", button.dataset.personality === flowPersonality);
        });
        if (flowPersonality === "serene") {
            const sereneCaps = { speed: 0.9, turbulence: 0.48, density: 1600, baseSize: 4.8, sizeVariation: 1.6, stretch: 1.8, rotationSpeed: 0.1, wobble: 0.22 };
            Object.entries(sereneCaps).forEach(([key, maximum]) => {
                if (isFlowEnabled(key) && Number(sim.settings[key]) > maximum) {
                    startMorph(key, maximum, 4200);
                }
            });
        }
        if (restart && isAutopilot) startAutopilotIntervals();
        if (announce) showToast(`${flowPersonality[0].toUpperCase() + flowPersonality.slice(1)} Flow selected.`);
    }

    function setComfortMode(enabled, { persist = true, announce = true } = {}) {
        isComfortMode = Boolean(enabled);
        document.body.classList.toggle("comfort-mode", isComfortMode);
        if (elements.comfortModeToggle) elements.comfortModeToggle.checked = isComfortMode;
        if (persist) localStorage.setItem("eternalVoidComfortMode", String(isComfortMode));
        if (isComfortMode) {
            const caps = { speed: 1.35, turbulence: 0.85, density: 2200, baseSize: 7, stretch: 3, rotationSpeed: 0.18, wobble: 0.38 };
            Object.entries(caps).forEach(([key, maximum]) => {
                if (Number(sim.settings[key]) > maximum) sim.settings[key] = maximum;
            });
            ["psychedelicMode", "morphingBg", "spinningKaleido", "shockwavesEnabled"].forEach(key => {
                sim.settings[key] = false;
            });
            if (elements.psychedelicToggle) elements.psychedelicToggle.checked = false;
            if (elements.morphingBgToggle) elements.morphingBgToggle.checked = false;
            if (elements.spinningKaleidoToggle) elements.spinningKaleidoToggle.checked = false;
            if (elements.shockwavesToggle) elements.shockwavesToggle.checked = false;
            syncAllSlidersToSettings();
        }
        if (announce) showToast(isComfortMode ? "Comfort Mode on: gentler motion and light." : "Comfort Mode off.");
    }

    function setupFlowToggles() {
        const flowableOptions = [
            { key: "speed", selector: "#speed-slider", type: "slider" },
            { key: "turbulence", selector: "#turbulence-slider", type: "slider" },
            { key: "density", selector: "#density-slider", type: "slider" },
            { key: "flowOrganic", selector: "#curl-slider", type: "slider" },
            { key: "dissipation", selector: "#dissipation-slider", type: "slider" },
            { key: "zoom", selector: "#zoom-slider", type: "slider" },
            { key: "baseSize", selector: "#size-slider", type: "slider" },
            { key: "sizeVariation", selector: "#size-var-slider", type: "slider" },
            { key: "stretch", selector: "#stretch-slider", type: "slider" },
            { key: "interaction", selector: "#interaction-slider", type: "slider" },
            { key: "mouseInfluence", selector: "#mouse-influence-slider", type: "slider" },
            { key: "rotationSpeed", selector: "#rotation-slider", type: "slider" },
            { key: "wobble", selector: "#wobble-slider", type: "slider" },
            { key: "kaleidoscopeSegments", selector: "#kaleido-segments-slider", type: "slider" },
            { key: "kaleidoscopeEnabled", selector: "#kaleidoscope-toggle", type: "switch" },
            { key: "psychedelicMode", selector: "#psychedelic-toggle", type: "switch" },
            { key: "morphingBg", selector: "#morphing-bg-toggle", type: "switch" },
            { key: "spinningKaleido", selector: "#spinning-kaleido-toggle", type: "switch" },
            { key: "particleShape", selector: "#particle-shape-select", type: "select" },
            { key: "particleLighting", selector: "#particle-lighting-select", type: "select" },
            { key: "colors", selector: "#swatches-palette", type: "palette" }
        ];

        flowableOptions.forEach(opt => {
            optionModes[opt.key] = "flow"; // default state

            const target = document.querySelector(opt.selector);
            if (!target) return;

            // Create pill group
            const pillGroup = document.createElement("div");
            pillGroup.className = "flow-toggle-group";
            pillGroup.setAttribute("data-key", opt.key);
            pillGroup.innerHTML = `
                <span class="flow-toggle-option" data-val="manual">Man</span>
                <span class="flow-toggle-option active" data-val="flow">Flow</span>
            `;

            // Click listener
            const options = pillGroup.querySelectorAll(".flow-toggle-option");
            options.forEach(span => {
                span.onclick = (e) => {
                    e.stopPropagation();
                    options.forEach(s => s.classList.remove("active"));
                    span.classList.add("active");
                    const value = span.getAttribute("data-val");
                    optionModes[opt.key] = value;
                };
            });

            // Insert into DOM
            if (opt.type === "slider") {
                const header = target.parentElement.querySelector(".slider-header");
                if (header) {
                    const valSpan = header.querySelector(".slider-value");
                    if (valSpan) {
                        header.insertBefore(pillGroup, valSpan);
                    } else {
                        header.appendChild(pillGroup);
                    }
                }
            } else if (opt.type === "switch") {
                const row = target.closest(".control-row");
                if (row) {
                    const labelSwitch = row.querySelector(".switch");
                    if (labelSwitch) {
                        row.insertBefore(pillGroup, labelSwitch);
                    } else {
                        row.appendChild(pillGroup);
                    }
                }
            } else if (opt.type === "select") {
                const row = target.closest(".setting-select-row");
                if (row) {
                    row.insertBefore(pillGroup, target);
                }
            } else if (opt.type === "palette") {
                const group = target.closest(".setting-group");
                if (group) {
                    const header = group.querySelector(".flex-header");
                    if (header) {
                        const randBtn = header.querySelector("#randomize-palette-btn");
                        if (randBtn) {
                            header.insertBefore(pillGroup, randBtn);
                        } else {
                            header.appendChild(pillGroup);
                        }
                    }
                }
            }
        });
    }

    // --- AUTOPILOT MORPH ROTATOR ---
    function toggleAutopilot(state) {
        isAutopilot = state;
        if (elements.autopilotToggle) elements.autopilotToggle.checked = state;
        
        if (elements.hudPresetLock) {
            elements.hudPresetLock.classList.toggle("active-lock", !state);
            const lockIcon = elements.hudPresetLock.querySelector('.lock-icon');
            const unlockIcon = elements.hudPresetLock.querySelector('.unlock-icon');
            if (lockIcon) lockIcon.classList.toggle("hide", state);
            if (unlockIcon) unlockIcon.classList.toggle("hide", !state);
        }

        if (state) {
            document.body.classList.add("autopilot-active");
            if (elements.autopilotSettings) elements.autopilotSettings.classList.remove("hidden");
            startAutopilotIntervals();
            showToast("Autopilot co-pilot engaged.");
        } else {
            document.body.classList.remove("autopilot-active");
            if (elements.autopilotSettings) elements.autopilotSettings.classList.add("hidden");
            stopAutopilotIntervals();
            showToast("Autopilot co-pilot disengaged.");
        }
    }

    function startAutopilotIntervals() {
        stopAutopilotIntervals();
        
        const patternInterval = parseInt(elements.autoPatternSlider.value) * 1000;
        const colorInterval = parseInt(elements.autoColorSlider.value) * 1000;
        
        // 1. Drift through real presets (pattern only; colors flow independently).
        autopilotPickPreset();
        autopilotTimer = setInterval(() => {
            autopilotPickPreset();
        }, patternInterval);

        // 2. Morph colors (if checked and set to FLOW)
        if (elements.autopilotColorToggle.checked) {
            autopilotColorTimer = setInterval(() => {
                try {
                    if (isFlowEnabled("colors")) {
                        let palette = null;
                        if (activeColorCycle !== "random" && window.ColorCycles) {
                            palette = window.ColorCycles.getNextPalette(activeColorCycle, sim.palette);
                        }
                        if (!palette) {
                            palette = generateHarmoniousPalette(flowPersonality);
                        }
                        const paletteDuration = Math.max(4500, Math.min(12000, colorInterval * 0.45));
                        startPaletteMorph(palette, paletteDuration);
                        modulateSynth();
                    }
                } catch (err) {
                    CosmicLogger.error(`Autopilot color shift error: ${err.message}`);
                }
            }, colorInterval);
        }
    }

    function stopAutopilotIntervals() {
        clearInterval(autopilotTimer);
        clearInterval(autopilotColorTimer);
    }

    function chooseNextFlowPattern(effectivePersonality) {
        if (!isFlowEnabled("particleShape")) return null;

        const serenePatterns = [
            "ellipse", "drop", "ring", "nebula", "aquatic",
            "aurora", "lotus", "spiral"
        ];
        const alivePatterns = [
            ...serenePatterns, "ocean", "orbitals", "brush", "cluster", "pipes",
            "pipesTight", "pipesCathedral", "pipesShrine"
        ];
        const wildPatterns = [...alivePatterns, "acid"];
        const pool = effectivePersonality === "serene"
            ? serenePatterns
            : (effectivePersonality === "wild" ? wildPatterns : alivePatterns);
        const currentShape = sim.settings.particleShape || lastFlowPatternShape || "ellipse";
        const alternatives = pool.filter(shape => shape !== currentShape);
        const nextShape = alternatives[Math.floor(Math.random() * alternatives.length)] || "ellipse";

        sim.settings.particleShape = nextShape;
        elements.particleShapeSelect.value = nextShape;
        lastFlowPatternShape = nextShape;
        return nextShape;
    }

    function randomizeAllParameters() {
        const rnd = (min, max) => min + Math.random() * (max - min);
        const rndInt = (min, max) => Math.floor(rnd(min, max + 1));

        // Most cycles are a nearby drift, some are a scenic shift, and only a
        // tiny minority are a controlled surge. Even surges stay below the UI's
        // deliberately extreme limits: Autopilot should feel alive, not alarming.
        const roll = Math.random();
        const effectivePersonality = isComfortMode ? "serene" : flowPersonality;
        const thresholds = { serene: [0.84, 1.0], alive: [0.74, 0.97], wild: [0.58, 0.88] }[effectivePersonality];
        const mode = roll < thresholds[0] ? "drift" : (roll < thresholds[1] ? "scenic" : "surge");
        const patternSeconds = parseInt(elements.autoPatternSlider.value, 10) || 20;
        // Keep transitions smooth without reducing how often the scene discovers
        // something new. At the 5-second minimum, a morph completes before the
        // next one; at the 20-second default, it glides for about 11 seconds.
        const baseDuration = Math.max(3200, Math.min(12000, patternSeconds * 550));
        const nextPatternShape = chooseNextFlowPattern(effectivePersonality);
        const defaultFields = {
            speed: [0.15, 2.4, 0.42, 0.05, 4.0],
            turbulence: [0.08, 1.65, 0.28, 0.0, 3.0],
            density: [650, 3000, 430, 350, 5000, true],
            flowOrganic: [0.35, 1.45, 0.2, 0.1, 1.8],
            dissipation: [0.006, 0.045, 0.006, 0.003, 0.075],
            zoom: [0.65, 3.2, 0.48, 0.35, 4.8],
            baseSize: [0.8, 7.2, 1.0, 0.4, 10.5],
            sizeVariation: [0.25, 3.4, 0.55, 0.0, 5.2],
            stretch: [0.15, 3.2, 0.52, 0.0, 5.0],
            interaction: [0.1, 2.0, 0.32, 0.0, 3.2],
            mouseInfluence: [0.25, 2.8, 0.45, 0.0, 4.0],
            rotationSpeed: [0.0, 0.32, 0.055, 0.0, 0.58],
            wobble: [0.05, 0.62, 0.1, 0.0, 0.95]
        };
        const sereneFields = {
            speed: [0.1, 0.9, 0.12, 0.1, 0.9], turbulence: [0.02, 0.48, 0.09, 0.02, 0.48],
            density: [550, 1600, 170, 550, 1600, true], flowOrganic: [0.5, 1.15, 0.09, 0.5, 1.15],
            dissipation: [0.009, 0.032, 0.003, 0.009, 0.032], zoom: [0.8, 2.25, 0.2, 0.8, 2.25],
            baseSize: [0.7, 4.8, 0.42, 0.7, 4.8], sizeVariation: [0.15, 1.6, 0.22, 0.15, 1.6],
            stretch: [0.1, 1.8, 0.22, 0.1, 1.8], interaction: [0.08, 1.1, 0.14, 0.08, 1.1],
            mouseInfluence: [0.2, 1.5, 0.2, 0.2, 1.5], rotationSpeed: [0, 0.1, 0.018, 0, 0.1],
            wobble: [0.02, 0.22, 0.035, 0.02, 0.22]
        };
        const wildFields = {
            speed: [0.18, 3.3, 0.6, 0.05, 5], turbulence: [0.08, 2.1, 0.4, 0, 3.8],
            density: [650, 3800, 600, 350, 6000, true], flowOrganic: [0.25, 1.7, 0.3, 0.05, 2],
            dissipation: [0.004, 0.06, 0.01, 0.002, 0.09], zoom: [0.45, 4.2, 0.7, 0.2, 6],
            baseSize: [0.6, 9, 1.4, 0.3, 13], sizeVariation: [0.1, 4.6, 0.8, 0, 6.5],
            stretch: [0.1, 4.2, 0.75, 0, 6.5], interaction: [0.05, 2.7, 0.5, 0, 4],
            mouseInfluence: [0.2, 3.6, 0.65, 0, 5], rotationSpeed: [0, 0.45, 0.08, 0, 0.8],
            wobble: [0.04, 0.82, 0.14, 0, 1.25]
        };
        const fields = effectivePersonality === "serene" ? sereneFields : (effectivePersonality === "wild" ? wildFields : defaultFields);

        Object.entries(fields).forEach(([key, field]) => {
            if (!isFlowEnabled(key)) return;
            const [zenMin, zenMax, localStep, surgeMin, surgeMax, integer] = field;
            const current = Number(sim.settings[key] ?? zenMin);
            let target;
            if (mode === "drift") {
                target = Math.max(zenMin, Math.min(zenMax, current + rnd(-localStep, localStep)));
            } else if (mode === "scenic") {
                target = rnd(zenMin, zenMax);
            } else {
                target = rnd(surgeMin, surgeMax);
            }
            if (integer) target = Math.round(target);
            startMorph(key, target, baseDuration * rnd(0.78, 1.12));
        });

        // Rare state changes prevent every cycle from flipping the scene's identity.
        const nextKaleidoEnabledFlow = isFlowEnabled("kaleidoscopeEnabled");
        const nextKaleidoSegmentsFlow = isFlowEnabled("kaleidoscopeSegments");

        let currentKaleidoEnabled = sim.settings.kaleidoscopeEnabled;
        if (nextKaleidoEnabledFlow && Math.random() < 0.08) {
            currentKaleidoEnabled = Math.random() < 0.18;
            elements.kaleidoscopeToggle.checked = currentKaleidoEnabled;
            sim.settings.kaleidoscopeEnabled = currentKaleidoEnabled;
        }

        if (currentKaleidoEnabled) {
            elements.kaleidoscopeSettings.classList.remove("hidden");
            if (nextKaleidoSegmentsFlow) {
                startMorph("kaleidoscopeSegments", rndInt(4, 9), baseDuration);
            }
        } else {
            elements.kaleidoscopeSettings.classList.add("hidden");
        }

        startMorph("drag", rnd(0.89, 0.945), baseDuration);

        if (!isComfortMode && isFlowEnabled("psychedelicMode") && Math.random() < (effectivePersonality === "wild" ? 0.11 : 0.04)) {
            const psychOn = Math.random() < 0.12;
            sim.settings.psychedelicMode = psychOn;
            elements.psychedelicToggle.checked = psychOn;
        }

        if (!isComfortMode && isFlowEnabled("morphingBg") && Math.random() < (effectivePersonality === "wild" ? 0.16 : 0.08)) {
            const morphBgOn = Math.random() < 0.28;
            sim.settings.morphingBg = morphBgOn;
            elements.morphingBgToggle.checked = morphBgOn;
        }

        if (!isComfortMode && isFlowEnabled("spinningKaleido") && Math.random() < (effectivePersonality === "wild" ? 0.12 : 0.04)) {
            const spinKaleidoOn = Math.random() < 0.12;
            sim.settings.spinningKaleido = spinKaleidoOn;
            elements.spinningKaleidoToggle.checked = spinKaleidoOn;
        }

        if (isFlowEnabled("particleLighting") && Math.random() < 0.32) {
            const lightingStyles = ["glow", "reactive", "pearl"];
            const currentLighting = sim.settings.particleLighting || "glow";
            const lightingChoices = lightingStyles.filter(style => style !== currentLighting);
            const lighting = lightingChoices[Math.floor(Math.random() * lightingChoices.length)];
            sim.settings.particleLighting = lighting;
            elements.particleLightingSelect.value = lighting;
        }

        if (nextPatternShape) {
            CosmicLogger.info(`Flow pattern shifted to: ${nextPatternShape.toUpperCase()}.`);
        }
    }

    // Modulate audio params based on physics
    function modulateSynth() {
        if (window.CosmicSynth && window.CosmicSynth.initialized) {
            // Get hues
            const colorHues = sim.palette.map(c => {
                const hsl = hexToHsl(parseColorToHex(c));
                return hsl ? hsl.h : 0;
            });
            window.CosmicSynth.modulate(sim.settings.speed, sim.settings.turbulence, colorHues);
        }
    }

    // --- PANEL DRAW CONTROL TRANSLATIONS ---
    function togglePanel(open) {
        if (open === undefined) {
            open = elements.controlPanel.classList.contains("panel-collapsed");
        }
        
        if (open) {
            elements.controlPanel.classList.remove("panel-collapsed");
            elements.floatingActions.classList.add("panel-open");
            elements.menuToggleBtn.classList.add("highlight");
            
            // Show help tooltip explaining Manual vs Flow on first open
            if (localStorage.getItem("autopilotHelpShown") !== "true") {
                setTimeout(() => {
                    if (elements.autopilotHelpTooltip) {
                        elements.autopilotHelpTooltip.classList.remove("hidden");
                    }
                    localStorage.setItem("autopilotHelpShown", "true");
                }, 400); // delay slightly for sliding transition to finish!
            }
        } else {
            elements.controlPanel.classList.add("panel-collapsed");
            elements.floatingActions.classList.remove("panel-open");
            elements.menuToggleBtn.classList.remove("highlight");
            
            // Auto hide tooltip if drawer is closed
            if (elements.autopilotHelpTooltip) {
                elements.autopilotHelpTooltip.classList.add("hidden");
            }
        }
    }

    // Toggle 3D WebGL / WebXR VR Visualizer mode
    function toggle3DMode(forceState) {
        const nextState = forceState !== undefined ? forceState : !is3DMode;
        if (nextState === is3DMode) return;
        
        is3DMode = nextState;
        
        if (is3DMode) {
            if (elements.webglStyleQuickSelector) {
                elements.webglStyleQuickSelector.classList.remove("hide");
                if (typeof window.updateQuickSelectorPill === "function") {
                    window.updateQuickSelectorPill(selected3DStyle);
                }
            }
            
            if (!sim3D) {
                CosmicLogger.info(`Initializing 3D renderer style: ${selected3DStyle.toUpperCase()} using Three.js...`);
                try {
                    if (selected3DStyle === "dome") {
                        sim3D = new FlowSimulation3D("webgl-canvas");
                    } else {
                        sim3D = new NativeFlowSimulation3D("webgl-canvas");
                    }
                } catch (error) {
                    CosmicLogger.warn("3D initialization failed; falling back to Parallax Flow Dome. " + error.message);
                    selected3DStyle = "dome";
                    save3DStyle("dome");
                    if (typeof window.updateQuickSelectorPill === "function") {
                        window.updateQuickSelectorPill("dome");
                    }
                    sim3D = new FlowSimulation3D("webgl-canvas");
                }
                window.sim3D = sim3D;
                window.addEventListener("resize", () => {
                    if (sim3D) sim3D.resize();
                });
            }

            // The dome renderer needs a hidden 2D texture; native particles do not.
            if (sim3D.usesFlowTexture !== false) {
                const profile = window.RenderQuality.getProfile("desktopHigh");
                sim.resize(profile.width, profile.height, 1.0);
            }
            
            sim3D.settings = sim.settings;
            sim3D.backgroundColor = sim.backgroundColor;
            sim3D.updatePalette([...sim.palette]);
            
            elements.canvas2D.classList.add("hidden");
            elements.webglCanvas.classList.remove("hidden");
            
            elements.webgl3DToggleBtn.classList.add("highlight");
            elements.hudMode.textContent = sim3D.usesFlowTexture === false ? "NATIVE 3D" : "3D FLOW";
            
            if (navigator.xr) {
                navigator.xr.isSessionSupported('immersive-vr').then(supported => {
                    if (supported && elements.enterVrBtn) {
                        elements.enterVrBtn.classList.remove("hide");
                        CosmicLogger.info("WebGL 3D Mode loaded. VR Headset detected. Enter VR enabled.");
                    }
                });
            }
            
            showToast(sim3D.usesFlowTexture === false
                ? "Native 3D cosmic flow active!"
                : "WebGL 3D visualizer active!");
            CosmicLogger.info(sim3D.usesFlowTexture === false
                ? "Switched from 2D Canvas to native GPU-driven volumetric particles."
                : "Switched simulation engine from 2D Canvas to 3D WebGL projection.");
            
            // Start the Three.js loop
            restart3DLoop();
            
        } else {
            if (elements.webglStyleQuickSelector) {
                elements.webglStyleQuickSelector.classList.add("hide");
            }
            
            if (sim3D) {
                sim3D.renderer.setAnimationLoop(null);
            }
            
            // Restore 2D canvas buffer to native window viewport dimensions and default DPR
            sim.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1.0);

            elements.webglCanvas.classList.add("hidden");
            elements.canvas2D.classList.remove("hidden");
            
            elements.webgl3DToggleBtn.classList.remove("highlight");
            if (elements.enterVrBtn) elements.enterVrBtn.classList.add("hide");
            elements.hudMode.textContent = "FLOW";
            
            showToast("2D Canvas visualizer active.");
            CosmicLogger.info("Switched simulation engine from 3D WebGL to 2D Canvas.");
            
            requestAnimationFrame(tickLoop);
        }
    }

    // Handles live hot-swapping between Native 3D Volumetric and Parallax Dome styles
    function change3DStyle(newStyle) {
        if (newStyle === selected3DStyle) return;
        
        // Safety lock: do not allow style changes during WebXR presentations
        if (sim3D && sim3D.renderer.xr.isPresenting) {
            CosmicLogger.warn("Cannot switch 3D styles during an active WebXR VR session.");
            showToast("Exit VR first to switch 3D styles.");
            if (typeof window.updateQuickSelectorPill === "function") {
                window.updateQuickSelectorPill(selected3DStyle);
            }
            return;
        }

        selected3DStyle = newStyle;
        save3DStyle(newStyle);
        
        if (is3DMode) {
            CosmicLogger.info(`Hot-swapping active 3D renderer style to: ${newStyle.toUpperCase()}`);
            
            // 1. Shut down and clean up active renderer
            if (sim3D) {
                sim3D.dispose();
                sim3D = null;
                window.sim3D = null;
            }
            
            // 2. Instantiate newly selected renderer style
            try {
                if (selected3DStyle === "dome") {
                    sim3D = new FlowSimulation3D("webgl-canvas");
                } else {
                    sim3D = new NativeFlowSimulation3D("webgl-canvas");
                }
            } catch (err) {
                CosmicLogger.error("Failed to hot-swap 3D renderer. Rolling back to Dome. " + err.message);
                selected3DStyle = "dome";
                save3DStyle("dome");
                if (typeof window.updateQuickSelectorPill === "function") {
                    window.updateQuickSelectorPill("dome");
                }
                sim3D = new FlowSimulation3D("webgl-canvas");
            }
            window.sim3D = sim3D;
            
            // 3. Toggle hidden 2D buffer resizing depending on engine style needs
            if (sim3D.usesFlowTexture !== false) {
                const profile = window.RenderQuality.getProfile("desktopHigh");
                sim.resize(profile.width, profile.height, 1.0);
            }
            
            // 4. Propagate active configurations
            sim3D.settings = sim.settings;
            sim3D.backgroundColor = sim.backgroundColor;
            sim3D.updatePalette([...sim.palette]);
            
            // 5. Restart WebGL render pipeline
            restart3DLoop();
            
            // 6. Refresh indicators and HUD values
            elements.hudMode.textContent = sim3D.usesFlowTexture === false ? "NATIVE 3D" : "3D FLOW";
            showToast(selected3DStyle === "native" ? "Switched to Volumetric GPU particles" : "Switched to Parallax Flow Dome");
        }
    }

    // Configures and starts the Three.js render loop for the active 3D engine style
    function restart3DLoop() {
        if (!sim3D) return;
        
        let lastFlowUpdateTime = 0;
        let lastRenderTime = performance.now();
        let lastFpsUpdate = performance.now();
        
        sim3D.renderer.setAnimationLoop(() => {
            if (is3DMode && sim3D) {
                const now = performance.now();
                const frameDuration = now - lastRenderTime;
                lastRenderTime = now;

                processMusicReactivity();
                processMeditationMode();
                processMorphs();
                
                // Track music pulse and treble intensity in both renderers
                const audioValues = window.audioReactivityValues || { bass: 0, mid: 0, treble: 0, volume: 0 };
                sim3D.sizePulse = audioValues.bass * (sim.settings.zoom ?? 1.0);
                sim3D.trebleIntensity = audioValues.treble;
                
                // Decoupled flow scheduler (only runs if dome style is active)
                const profile = window.RenderQuality.getProfile();
                const flowHz = profile.flowHz || 60;
                const flowInterval = 1000 / flowHz;
                
                let flowMs = 0;
                let flowTicked = false;
                
                const elapsed = now - lastFlowUpdateTime;
                if (sim3D.usesFlowTexture !== false && elapsed >= flowInterval) {
                    const flowStart = performance.now();
                    sim.tick();
                    const flowEnd = performance.now();
                    flowMs = flowEnd - flowStart;
                    
                    if (sim3D.texture) sim3D.texture.needsUpdate = true;
                    
                    lastFlowUpdateTime = now - (elapsed % flowInterval);
                    flowTicked = true;
                }
                
                // Tick and render WebGL dome/camera perspective
                const threeStart = performance.now();
                sim3D.tick();
                const threeEnd = performance.now();
                const threeMs = threeEnd - threeStart;
                
                // Accumulate timing samples
                if (sim3D.usesFlowTexture !== false) {
                    if (flowTicked) {
                        window.RenderQuality.sampleFrame(frameDuration, flowMs, threeMs);
                    } else {
                        window.RenderQuality.sampleFrame(frameDuration, undefined, threeMs);
                    }
                } else {
                    // Volumetric Native mode doesn't compute 2D canvas flows
                    window.RenderQuality.averageFrameInterval =
                        window.RenderQuality.averageFrameInterval * 0.95 + frameDuration * 0.05;
                    window.RenderQuality.canvasDrawMsAvg =
                        window.RenderQuality.canvasDrawMsAvg * 0.95 + threeMs * 0.05;
                    window.RenderQuality.flowMsAvg = 0;
                }
                
                // Diagnostics and diagnostics console updater
                frameCount++;
                if (now - lastFpsUpdate >= 500) {
                    const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
                    elements.hudFps.textContent = fps;
                    if (sim3D.usesFlowTexture === false && sim3D.activeParticles) {
                        elements.hudParticles.textContent = sim3D.activeParticles;
                    }
                    frameCount = 0;
                    lastFpsUpdate = now;
                    
                    updatePerfDiagnosticConsole(fps);
                }
                
                updateHudWaveform();
            }
        });
    }

    // Update floating HUD waveform visualizer bar scales
    function updateHudWaveform() {
        const bars = elements.hudVisualizer.querySelectorAll(".eq-bar");
        if (bars.length === 0) return;

        const visualData = window.CosmicSynth.getVisualizerData();
        if (visualData && bars.length > 0) {
            bars.forEach((bar, i) => {
                const val = visualData[i * 2] || 0;
                const pct = Math.max(10, Math.round((val / 255) * 100));
                bar.style.height = `${pct}%`;
                bar.style.background = `var(--accent-color)`;
                bar.style.opacity = 0.5 + (pct / 200);
            });
        } else {
            bars.forEach((bar) => {
                const currentHeight = parseFloat(bar.style.height) || 0;
                const newHeight = Math.max(10, currentHeight - 4);
                bar.style.height = `${newHeight}%`;
                bar.style.opacity = 0.2;
                bar.style.background = `var(--accent-color)`;
            });
        }
    }

    // Update real-time performance metrics in the system diagnostics console
    function updatePerfDiagnosticConsole(fps) {
        const perfPanel = document.getElementById("console-perf-stats");
        if (!perfPanel || perfPanel.parentNode.classList.contains("hidden")) return;
        
        const profile = window.RenderQuality.getProfile();
        const rq = window.RenderQuality;
        
        // WebXR Target Info
        let xrInfo = "2D Canvas";
        if (is3DMode) {
            xrInfo = (sim3D && sim3D.renderer.xr.isPresenting) ? "WebXR (VR)" : "Desktop 3D";
        }
        
        perfPanel.innerHTML = `
            <div>Engine Mode: <strong>${xrInfo}</strong></div>
            <div>FPS (Render): <strong>${fps}</strong></div>
            <div>Avg Latency: <strong>${rq.averageFrameInterval.toFixed(1)} ms</strong></div>
            <div>Flow Backing: <strong>${sim.width}x${sim.height}</strong></div>
            <div>Flow Target: <strong>${profile.flowHz} Hz</strong></div>
            <div>Quality Tier: <strong>${rq.currentProfileKey}</strong></div>
            <div>Particles: <strong>${sim.particles.length}</strong></div>
            <div>Sim CPU: <strong>${rq.flowMsAvg.toFixed(1)} ms</strong></div>
            <div>Render CPU: <strong>${rq.canvasDrawMsAvg.toFixed(1)} ms</strong></div>
        `;
    }

    // Setup Drawer navigation tabs
    function setupTabs() {
        const tabBtns = document.querySelectorAll(".tab-btn");
        const tabContents = document.querySelectorAll(".tab-content");
        
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove("active"));
                tabContents.forEach(c => c.classList.remove("active"));
                
                btn.classList.add("active");
                document.getElementById(btn.getAttribute("data-tab")).classList.add("active");
            };
        });
    }

    // Setup input slider events and map them directly to simulation settings
    function setupEventListeners() {
        // Config History Navigation
        const prevBtn = document.getElementById("history-prev-btn");
        const nextBtn = document.getElementById("history-next-btn");
        const randBtn = document.getElementById("history-rand-btn");
        
        if (prevBtn) {
            prevBtn.onclick = () => {
                const prevState = ConfigHistory.back();
                if (prevState) applyHistoryState(prevState);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                const nextState = ConfigHistory.forward();
                if (nextState) applyHistoryState(nextState);
            };
        }
        if (randBtn) {
            randBtn.onclick = () => {
                applyRandomConfig();
            };
        }

        // Toggle Sidebar panel
        elements.menuToggleBtn.onclick = () => togglePanel();
        elements.closePanelBtn.onclick = () => togglePanel(false);
        elements.sidebarHandle.onclick = () => togglePanel(true);
        
        // Handle sidebar edge drag trigger
        let dragStartX = 0;
        elements.sidebarHandle.addEventListener("mousedown", (e) => {
            dragStartX = e.clientX;
        });
        window.addEventListener("mouseup", (e) => {
            if (dragStartX > 0 && e.clientX - dragStartX < -30) {
                togglePanel(true);
            }
            dragStartX = 0;
        });
        
        // Audio Toggle Click
        elements.audioToggleBtn.onclick = () => toggleAudio();
        
        // Fullscreen Toggle Click
        elements.fullscreenToggleBtn.onclick = () => toggleFullscreen();
        
        // Pause Click
        elements.pauseBtn.onclick = () => togglePause();
        
        // Legend Modal
        elements.shortcutLegendBtn.onclick = () => elements.keyboardModal.classList.remove("hidden");
        elements.modalCloseBtn.onclick = () => elements.keyboardModal.classList.add("hidden");
        elements.keyboardModal.onclick = (e) => {
            if (e.target === elements.keyboardModal) elements.keyboardModal.classList.add("hidden");
        };

        // Diagnostic Console close button toggle
        const closeConsoleBtn = document.getElementById("console-close-btn");
        if (closeConsoleBtn) {
            closeConsoleBtn.onclick = () => {
                document.getElementById("diagnostic-console").classList.add("hidden");
            };
        }

        // WebGL 3D & VR Toggle triggers
        if (elements.webgl3DToggleBtn) {
            elements.webgl3DToggleBtn.onclick = () => {
                toggle3DMode();
            };
        }

        if (elements.enterVrBtn) {
            elements.enterVrBtn.onclick = () => {
                if (sim3D) {
                    sim3D.startVR();
                    elements.enterVrBtn.classList.add("highlight");
                }
            };
        }

        // Check WebXR Device capability on launch
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr').then(supported => {
                if (supported) {
                    CosmicLogger.info("WebXR device support verified. VR headset is ready.");
                } else {
                    CosmicLogger.info("WebXR supported by browser but no VR device detected.");
                }
            }).catch(err => {
                CosmicLogger.warn("WebXR device query error: " + err.message);
            });
        } else {
            CosmicLogger.info("WebXR Device API not supported in this browser (HTTPS/localhost required).");
        }

        // Autopilot switches
        elements.autopilotToggle.onchange = () => toggleAutopilot(elements.autopilotToggle.checked);
        elements.personalityButtons.forEach(button => {
            button.onclick = () => setFlowPersonality(button.dataset.personality);
        });
        elements.comfortModeToggle.onchange = () => setComfortMode(elements.comfortModeToggle.checked);
        elements.experienceModeButtons.forEach(button => {
            button.onclick = () => setExperienceMode(button.dataset.experienceMode);
        });
        elements.breathingRhythmSelect.value = breathingRhythm;
        elements.breathingRhythmSelect.onchange = () => {
            const requested = elements.breathingRhythmSelect.value;
            breathingRhythm = breathingRhythms[requested] ? requested : "relaxed";
            localStorage.setItem("eternalVoidBreathingRhythm", breathingRhythm);
            breathingCycleStartedAt = Date.now();
        };
        elements.breathingGuideToggle.onchange = () => {
            document.body.classList.toggle("show-breathing-guide", experienceMode === "meditation" && elements.breathingGuideToggle.checked);
        };
        elements.autopilotColorToggle.onchange = () => {
            const isActive = elements.autopilotColorToggle.checked;
            if (elements.hudColorLock) {
                elements.hudColorLock.classList.toggle("active-lock", !isActive);
                const lockIcon = elements.hudColorLock.querySelector('.lock-icon');
                const unlockIcon = elements.hudColorLock.querySelector('.unlock-icon');
                if (lockIcon) lockIcon.classList.toggle("hide", isActive);
                if (unlockIcon) unlockIcon.classList.toggle("hide", !isActive);
            }
            if (isAutopilot) startAutopilotIntervals();
        };

        // HUD Interactive Controls
        if (elements.hudPresetLock) {
            elements.hudPresetLock.onclick = () => {
                toggleAutopilot(!isAutopilot);
            };
        }
        if (elements.hudPresetStar) {
            elements.hudPresetStar.onclick = () => {
                if (!lastPresetKey) {
                    showToast("No preset loaded to favorite.");
                    return;
                }
                if (favoritePresetKeys.has(lastPresetKey)) favoritePresetKeys.delete(lastPresetKey);
                else favoritePresetKeys.add(lastPresetKey);
                localStorage.setItem("eternalVoidFavoritePresets", JSON.stringify([...favoritePresetKeys]));
                buildPresetCards();
                const name = StylePresets[lastPresetKey]?.name || lastPresetKey;
                showToast(favoritePresetKeys.has(lastPresetKey) ? `★ Favorited: ${name}` : `Unfavorited: ${name}`);
                elements.hudPresetStar.classList.toggle("active-star", favoritePresetKeys.has(lastPresetKey));
            };
        }
        if (elements.hudPresetBan) {
            elements.hudPresetBan.onclick = () => {
                if (!lastPresetKey) return;
                if (excludedPresetKeys.has(lastPresetKey)) excludedPresetKeys.delete(lastPresetKey);
                else excludedPresetKeys.add(lastPresetKey);
                
                localStorage.setItem("eternalVoidExcludedPresets", JSON.stringify([...excludedPresetKeys]));
                buildPresetCards();

                if (excludedPresetKeys.has(lastPresetKey)) {
                    elements.hudPresetBan.classList.add("active-ban");
                    showToast("Preset excluded.");
                    // Autopilot skip if banned
                    if (isAutopilot) {
                        randomizeAllParameters();
                    }
                } else {
                    elements.hudPresetBan.classList.remove("active-ban");
                    showToast("Preset un-excluded.");
                }
            };
        }
        if (elements.hudColorLock) {
            elements.hudColorLock.onclick = () => {
                elements.autopilotColorToggle.checked = !elements.autopilotColorToggle.checked;
                elements.autopilotColorToggle.onchange();
                if (elements.autopilotColorToggle.checked) {
                    showToast("Color cycling unlocked.");
                } else {
                    showToast("Colors locked.");
                }
            };
        }
        if (elements.hudColorStar) {
            elements.hudColorStar.onclick = () => {
                // Save the CURRENT on-screen palette to My Theme Library directly,
                // with an auto-generated name (no sidebar typing required).
                const colorsToSave = (sim && sim.palette && sim.palette.length > 0)
                    ? [...sim.palette]
                    : [];
                if (colorsToSave.length === 0) {
                    showToast("No colors to save yet.");
                    return;
                }
                const cycleName = (typeof activeColorCycle !== "undefined" && activeColorCycle)
                    ? activeColorCycle : "Cosmic";
                const autoName = `${cycleName.toUpperCase()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                let lib = [];
                try {
                    lib = JSON.parse(localStorage.getItem("eternal_void_custom_palettes") ||
                                     localStorage.getItem("eternal_veil_custom_palettes")) || [];
                } catch (e) { lib = []; }
                if (lib.length >= 12) {
                    showToast("Library full (max 12 saved palettes)");
                    return;
                }
                const newItem = { id: Date.now().toString(), name: autoName.substring(0, 24), colors: colorsToSave };
                lib.unshift(newItem);
                localStorage.setItem("eternal_void_custom_palettes", JSON.stringify(lib));
                elements.hudColorStar.classList.add("active-star");
                setTimeout(() => elements.hudColorStar.classList.remove("active-star"), 800);
                showToast(`Palette "${autoName}" saved to My Theme Library → Colors`);
                // Reveal the saved palette in the Colors tab so the user sees it land.
                // Self-contained re-render (renderLibrary/getLibrary live in another
                // closure and aren't reachable here) so the grid updates instantly.
                (function renderColorsGrid() {
                    const gridEl = document.getElementById("saved-swatches-grid");
                    if (!gridEl) return;
                    let lib = [];
                    try {
                        lib = JSON.parse(localStorage.getItem("eternal_void_custom_palettes") ||
                                         localStorage.getItem("eternal_veil_custom_palettes")) || [];
                    } catch (e) { lib = []; }
                    gridEl.innerHTML = "";
                    if (lib.length === 0) {
                        gridEl.innerHTML = `<div style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 10px 0;">No custom palettes saved yet.</div>`;
                        return;
                    }
                    lib.forEach(item => {
                        const card = document.createElement("div");
                        card.className = "saved-swatch-card";
                        card.setAttribute("role", "button");
                        card.setAttribute("tabindex", "0");
                        const meta = document.createElement("div");
                        meta.className = "saved-swatch-meta";
                        const name = document.createElement("span");
                        name.className = "saved-swatch-name";
                        name.textContent = item.name;
                        const colorsContainer = document.createElement("div");
                        colorsContainer.className = "saved-swatch-colors";
                        (item.colors || []).forEach(col => {
                            const circle = document.createElement("div");
                            circle.className = "saved-swatch-circle";
                            circle.style.backgroundColor = col;
                            colorsContainer.appendChild(circle);
                        });
                        meta.appendChild(name);
                        meta.appendChild(colorsContainer);
                        card.appendChild(meta);
                        gridEl.appendChild(card);
                    });
                })();
                const colorsTabBtn = document.querySelector('.tab-btn[data-tab="tab-colors"]');
                const colorsTabContent = document.getElementById("tab-colors");
                if (colorsTabBtn && colorsTabContent) {
                    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
                    colorsTabBtn.classList.add("active");
                    colorsTabContent.classList.add("active");
                    if (elements.controlPanel) elements.controlPanel.classList.remove("hidden");
                    const gridEl = document.getElementById("saved-swatches-grid");
                    if (gridEl) {
                        gridEl.scrollTop = 0;
                        const firstCard = gridEl.querySelector(".saved-swatch-card");
                        if (firstCard) {
                            firstCard.animate(
                                [{ boxShadow: "0 0 0 2px var(--accent-color)" }, { boxShadow: "0 0 0 0 transparent" }],
                                { duration: 1200, iterations: 2 }
                            );
                        }
                    }
                }
            };
        }
        elements.autoPatternSlider.oninput = () => {
            elements.autoPatternVal.textContent = `${elements.autoPatternSlider.value}s`;
            if (isAutopilot) startAutopilotIntervals();
        };
        elements.autoColorSlider.oninput = () => {
            elements.autoColorVal.textContent = `${elements.autoColorSlider.value}s`;
            if (isAutopilot) startAutopilotIntervals();
        };
        elements.resetAllFlowBtn.onclick = () => {
            releaseActivePreset({ announce: false });
            const flowToggles = document.querySelectorAll(".flow-toggle-group");
            flowToggles.forEach(group => {
                const key = group.getAttribute("data-key");
                optionModes[key] = "flow";
                const options = group.querySelectorAll(".flow-toggle-option");
                options.forEach(span => {
                    if (span.getAttribute("data-val") === "flow") {
                        span.classList.add("active");
                    } else {
                        span.classList.remove("active");
                    }
                });
            });
            showToast("All settings reset to Flow co-pilot 🌊");
        };

        // Color additions
        elements.randomizePaletteBtn.onclick = () => {
            setOptionToManual("colors");
            turnOffPsychedelicMode();
            const palette = generateHarmoniousPalette(flowPersonality);
            updateActivePalette(palette);
            renderSwatches();
            modulateSynth();
            showToast("Harmonious palette generated.");
        };
        elements.particleColorPicker.oninput = () => {
            elements.pickerHexVal.textContent = elements.particleColorPicker.value.toUpperCase();
        };
        elements.addColorBtn.onclick = () => {
            setOptionToManual("colors");
            turnOffPsychedelicMode();
            if (sim.palette.length >= 6) {
                sim.palette.shift(); // remove oldest
            }
            sim.palette.push(elements.particleColorPicker.value);
            updateActivePalette([...sim.palette]);
            renderSwatches();
            modulateSynth();
            showToast("Color added to palette.");
        };

        // Background Color Pick
        elements.bgColorPicker.oninput = () => {
            sim.backgroundColor = elements.bgColorPicker.value;
            elements.bgHexVal.textContent = elements.bgColorPicker.value.toUpperCase();
            
            // Adjust ambient glow backing center color
            document.getElementById("ambient-glow").style.background = 
                `radial-gradient(circle, ${sim.backgroundColor}88 0%, transparent 70%)`;
        };
        elements.solidModeToggle.onchange = () => setExperienceMode(elements.solidModeToggle.checked ? "solid" : "flow");

        // Bind Sliders to settings parameters
        const bindSlider = (slider, valText, settingKey, isDensity = false) => {
            slider.oninput = () => {
                const comfortCaps = { speed: 1.35, turbulence: 0.85, density: 2200, baseSize: 7, stretch: 3, rotationSpeed: 0.18, wobble: 0.38 };
                let v = parseFloat(slider.value);
                if (isComfortMode && comfortCaps[settingKey] !== undefined) {
                    v = Math.min(v, comfortCaps[settingKey]);
                    slider.value = String(v);
                }
                updateActiveSetting(settingKey, v);
                
                // Format floating displays nicely
                if (valText) {
                    if (v % 1 === 0 && settingKey !== "dissipation") valText.textContent = v;
                    else valText.textContent = v.toFixed(settingKey === "dissipation" ? 3 : 2);
                }
                
                if (isDensity) sim.updateDensity();
                
                // Modulate synth immediately if speed or turbulence is altered
                if (settingKey === "speed" || settingKey === "turbulence") modulateSynth();
            };
        };

        bindSlider(elements.speedSlider, elements.speedVal, "speed");
        bindSlider(elements.turbulenceSlider, elements.turbulenceVal, "turbulence");
        bindSlider(elements.densitySlider, elements.densityVal, "density", true);
        bindSlider(elements.curlSlider, elements.curlVal, "flowOrganic");
        bindSlider(elements.dissipationSlider, elements.dissipationVal, "dissipation");
        bindSlider(elements.zoomSlider, elements.zoomVal, "zoom");
        
        bindSlider(elements.sizeSlider, elements.sizeVal, "baseSize");
        bindSlider(elements.sizeVarSlider, elements.sizeVarVal, "sizeVariation");
        bindSlider(elements.stretchSlider, elements.stretchVal, "stretch");
        bindSlider(elements.interactionSlider, elements.interactionVal, "interaction");
        
        bindSlider(elements.mouseInfluenceSlider, elements.mouseInfluenceVal, "mouseInfluence");
        elements.mouseModeSelect.onchange = () => {
            sim.settings.mouseMode = elements.mouseModeSelect.value;
            showToast(`Mouse interact: ${sim.settings.mouseMode.toUpperCase()}`);
        };

        // Kaleidoscope Configs
        elements.kaleidoscopeToggle.onchange = () => {
            sim.settings.kaleidoscopeEnabled = elements.kaleidoscopeToggle.checked;
            if (sim.settings.kaleidoscopeEnabled) {
                elements.kaleidoscopeSettings.classList.remove("hidden");
            } else {
                elements.kaleidoscopeSettings.classList.add("hidden");
            }
        };
        bindSlider(elements.kaleidoSegmentsSlider, elements.kaleidoSegmentsVal, "kaleidoscopeSegments");

        // Rotation & Wobble
        bindSlider(elements.rotationSlider, elements.rotationVal, "rotationSpeed");
        bindSlider(elements.wobbleSlider, elements.wobbleVal, "wobble");

        // Psychedelic Drives
        elements.psychedelicToggle.onchange = () => {
            if (isComfortMode && elements.psychedelicToggle.checked) {
                elements.psychedelicToggle.checked = false;
                showToast("Comfort Mode keeps Rainbow Cycle off.");
            }
            sim.settings.psychedelicMode = elements.psychedelicToggle.checked;
        };
        elements.morphingBgToggle.onchange = () => {
            if (isComfortMode && elements.morphingBgToggle.checked) {
                elements.morphingBgToggle.checked = false;
                showToast("Comfort Mode keeps background flashing off.");
            }
            sim.settings.morphingBg = elements.morphingBgToggle.checked;
        };
        elements.spinningKaleidoToggle.onchange = () => {
            if (isComfortMode && elements.spinningKaleidoToggle.checked) {
                elements.spinningKaleidoToggle.checked = false;
                showToast("Comfort Mode keeps spinning reflections off.");
            }
            sim.settings.spinningKaleido = elements.spinningKaleidoToggle.checked;
        };
        elements.shockwavesToggle.onchange = () => {
            if (isComfortMode && elements.shockwavesToggle.checked) {
                elements.shockwavesToggle.checked = false;
                showToast("Comfort Mode keeps shockwaves off.");
            }
            sim.settings.shockwavesEnabled = elements.shockwavesToggle.checked;
        };
        elements.particleShapeSelect.onchange = () => {
            sim.settings.particleShape = elements.particleShapeSelect.value;
        };
        elements.particleLightingSelect.onchange = () => {
            sim.settings.particleLighting = elements.particleLightingSelect.value;
        };
        if (elements.webglStyleQuickSelector) {
            const updateQuickSelectorPill = (style) => {
                if (style === "native") {
                    elements.stylePillNative.classList.add("active");
                    elements.stylePillDome.classList.remove("active");
                } else {
                    elements.stylePillNative.classList.remove("active");
                    elements.stylePillDome.classList.add("active");
                }
            };
            
            updateQuickSelectorPill(selected3DStyle);

            elements.stylePillNative.onclick = () => {
                change3DStyle("native");
                updateQuickSelectorPill("native");
            };
            elements.stylePillDome.onclick = () => {
                change3DStyle("dome");
                updateQuickSelectorPill("dome");
            };
            
            // Expose globally so other functions can keep the quick selector synced
            window.updateQuickSelectorPill = updateQuickSelectorPill;
        }

        // Media Exports
        elements.captureSnapshotBtn.onclick = () => exporter.captureSnapshot();
        
        // Video record button states
        elements.recordFlowBtn.onclick = () => {
            if (exporter.isRecording) {
                exporter.stopRecording();
            } else {
                exporter.startRecording();
            }
        };

        // Share Configuration
        elements.shareLinkBtn.onclick = () => {
            const url = UrlStateSync.generateShareUrl(sim, isAutopilot);
            if (url) {
                navigator.clipboard.writeText(url)
                    .then(() => showToast("Share URL copied to clipboard!"))
                    .catch(() => showToast("Failed to copy link automatically"));
            }
        };

        // Sound adjustments
        elements.soundEnableToggle.onchange = () => {
            const active = elements.soundEnableToggle.checked;
            toggleAudio(active);
        };
        
        elements.synthVolumeSlider.oninput = () => {
            const currentVol = window.CosmicSynth.volume;
            const newVol = parseInt(elements.synthVolumeSlider.value) / 100;
            elements.synthVolumeVal.textContent = `${elements.synthVolumeSlider.value}%`;
            window.CosmicSynth.setVolume(newVol);
            
            // Trigger headphones warning overlay if turning volume up from 0%
            if (currentVol === 0 && newVol > 0 && !window.CosmicSynth.isMuted) {
                triggerHeadphonesPrompt();
            }
        };

        // Channel Mixer volume adjustments
        elements.droneVolumeSlider.oninput = () => {
            const val = parseInt(elements.droneVolumeSlider.value) / 100;
            elements.droneVolumeVal.textContent = `${elements.droneVolumeSlider.value}%`;
            window.CosmicSynth.setDroneVolume(val);
        };

        elements.bilateralVolumeSlider.oninput = () => {
            const val = parseInt(elements.bilateralVolumeSlider.value) / 100;
            elements.bilateralVolumeVal.textContent = `${elements.bilateralVolumeSlider.value}%`;
            window.CosmicSynth.setBilateralVolume(val);
        };
        elements.bilateralVolumeSlider.onchange = () => {
            const val = parseInt(elements.bilateralVolumeSlider.value) / 100;
            window.CosmicSynth.triggerBilateralVolumePreview(val);
        };

        elements.asmrVolumeSlider.oninput = () => {
            const val = parseInt(elements.asmrVolumeSlider.value) / 100;
            elements.asmrVolumeVal.textContent = `${elements.asmrVolumeSlider.value}%`;
            window.CosmicSynth.setAsmrVolume(val);
        };
        elements.asmrVolumeSlider.onchange = () => {
            const val = parseInt(elements.asmrVolumeSlider.value) / 100;
            window.CosmicSynth.triggerAsmrVolumePreview(val);
        };

        // Bilateral and ASMR adjustments
        elements.bilateralToggle.onchange = () => {
            const state = elements.bilateralToggle.checked;
            sim.settings.bilateralEnabled = state;
            window.CosmicSynth.setBilateralEnabled(state);
            showToast(state ? "Bilateral rhythm enabled 🧘" : "Bilateral rhythm disabled");
        };

        elements.asmrToggle.onchange = () => {
            const state = elements.asmrToggle.checked;
            sim.settings.asmrEnabled = state;
            window.CosmicSynth.setAsmrEnabled(state);
            showToast(state ? "8D ASMR tingling enabled ✨" : "8D ASMR tingling disabled");
        };

        // Helper to clear highlights from visualizer buttons
        const clearVisualizerHighlights = () => {
            elements.micReactBtn.classList.remove("highlight");
            elements.systemReactBtn.classList.remove("highlight");
            elements.uploadReactBtn.classList.remove("highlight");
        };

        // Music Visualizer Interaction Event Listeners
        elements.micReactBtn.onclick = async () => {
            const synth = window.CosmicSynth;
            const currentMode = synth.visualizerMode;
            
            try {
                if (currentMode === "mic") {
                    synth.stopMusicReactivity();
                    clearVisualizerHighlights();
                    elements.visualizerStatus.style.display = "none";
                    showToast("Microphone visualizer disabled");
                    CosmicLogger.info("Microphone reactivity visualizer disabled.");
                } else {
                    elements.micReactBtn.textContent = "🎙️ Connecting...";
                    const success = await synth.toggleMicReactivity();
                    if (success) {
                        clearVisualizerHighlights();
                        elements.micReactBtn.classList.add("highlight");
                        elements.visualizerStatus.textContent = "Status: Ambient Mic Active 🎙️";
                        elements.visualizerStatus.style.display = "block";
                        showToast("Microphone visualizer active!");
                        CosmicLogger.info("Microphone reactivity visualizer active. Internal ambient chimes auto-muted.");
                        
                        // Silence Eternal Veil's local tones without silencing
                        // the independent device-audio analyser.
                        synth.setMute(true);
                    }
                }
            } catch (err) {
                showToast("Microphone permission denied");
                CosmicLogger.error("Microphone device capture access denied by user/browser.");
            } finally {
                elements.micReactBtn.textContent = "🎙️ Mic";
            }
        };

        const setDeviceAudioUi = (active, busy = false) => {
            elements.systemReactBtn.classList.toggle("highlight", active);
            elements.systemReactBtn.textContent = busy ? "💻 Capturing..." : "💻 Device Audio";
            elements.musicReactQuickBtn.classList.toggle("music-react-active", active);
            elements.musicReactQuickBtn.classList.toggle("music-react-busy", busy);
            elements.musicReactQuickBtn.setAttribute("data-tooltip", busy
                ? "Choose an audio source and enable audio sharing"
                : active ? "Device Audio Reaction Active (Click to Stop)" : "React to Device Audio");

            if (active) {
                elements.visualizerStatus.textContent = "Status: Device Audio Active 💻";
                elements.visualizerStatus.style.display = "block";
            } else if (!busy && window.CosmicSynth.visualizerMode === "none") {
                elements.visualizerStatus.style.display = "none";
            }
        };

        const toggleDeviceAudioReactivity = async () => {
            const synth = window.CosmicSynth;
            const currentMode = synth.visualizerMode;
            
            try {
                if (currentMode === "system") {
                    synth.stopMusicReactivity();
                    clearVisualizerHighlights();
                    setDeviceAudioUi(false);
                    showToast("Device audio visualizer disabled");
                    CosmicLogger.info("Device audio reactivity visualizer disabled.");
                } else {
                    setDeviceAudioUi(false, true);
                    const success = await synth.toggleSystemAudioReactivity();
                    if (success) {
                        clearVisualizerHighlights();
                        setDeviceAudioUi(true);
                        showToast("Device audio capture active! Play music or other sounds now.");
                        CosmicLogger.info("Device audio stream capture active. Internal ambient chimes auto-muted.");

                        const audioTrack = synth.systemStream?.getAudioTracks?.()[0];
                        if (audioTrack) {
                            audioTrack.addEventListener("ended", () => {
                                if (synth.visualizerMode === "system") synth.stopMusicReactivity();
                                clearVisualizerHighlights();
                                setDeviceAudioUi(false);
                                showToast("Device audio sharing ended.");
                            }, { once: true });
                        }
                        
                        // Keep local ambient tones silent; captured audio still
                        // feeds the independent analyser while muted.
                        synth.setMute(true);
                    }
                }
            } catch (err) {
                setDeviceAudioUi(false);
                showToast(err.message || "Device audio sharing cancelled");
                CosmicLogger.warn("Device audio stream capture cancelled or failed: " + err.message);
            }
        };

        elements.systemReactBtn.onclick = toggleDeviceAudioReactivity;
        elements.musicReactQuickBtn.onclick = toggleDeviceAudioReactivity;

        elements.uploadReactBtn.onclick = () => {
            const synth = window.CosmicSynth;
            const currentMode = synth.visualizerMode;
            
            if (currentMode === "upload") {
                synth.stopMusicReactivity();
                clearVisualizerHighlights();
                elements.visualizerStatus.style.display = "none";
                showToast("Music visualizer disabled");
                CosmicLogger.info("Uploaded music reactivity disabled.");
            } else {
                elements.musicFileInput.click();
            }
        };

        elements.musicFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const synth = window.CosmicSynth;
            synth.playUploadedFile(file);
            
            clearVisualizerHighlights();
            elements.uploadReactBtn.classList.add("highlight");
            
            const displayName = file.name.length > 22 ? file.name.substring(0, 20) + "..." : file.name;
            elements.visualizerStatus.textContent = `Status: Playing "${displayName}" 🎵`;
            elements.visualizerStatus.style.display = "block";
            showToast("Visualizer track playing!");
            CosmicLogger.info(`Uploaded audio track playing: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB). Internal ambient chimes auto-muted.`);
            
            if (synth.isMuted) toggleAudio(true);
            elements.musicFileInput.value = "";
        };

        // Factory Reset defaults
        elements.factoryResetBtn.onclick = () => {
            window.location.hash = "";
            loadPreset("ethereal");
            sim.spawnParticles();
            
            // Reset psychedelic settings
            sim.settings.psychedelicMode = false;
            elements.psychedelicToggle.checked = false;
            sim.settings.morphingBg = false;
            elements.morphingBgToggle.checked = false;
            sim.settings.spinningKaleido = false;
            elements.spinningKaleidoToggle.checked = false;
            sim.settings.shockwavesEnabled = true;
            elements.shockwavesToggle.checked = true;
            sim.settings.particleShape = "ellipse";
            elements.particleShapeSelect.value = "ellipse";
            sim.settings.particleLighting = "glow";
            elements.particleLightingSelect.value = "glow";
            sim.shockwaves = [];
            
            // Reset bilateral and ASMR audio configurations
            sim.settings.bilateralEnabled = false;
            elements.bilateralToggle.checked = false;
            window.CosmicSynth.setBilateralEnabled(false);

            sim.settings.asmrEnabled = false;
            elements.asmrToggle.checked = false;
            window.CosmicSynth.setAsmrEnabled(false);
            
            // Reset mixer sliders to defaults
            elements.synthVolumeSlider.value = 40;
            elements.synthVolumeVal.textContent = "40%";
            window.CosmicSynth.setVolume(0.4);
            
            elements.droneVolumeSlider.value = 36;
            elements.droneVolumeVal.textContent = "36%";
            window.CosmicSynth.setDroneVolume(0.36);
            
            elements.bilateralVolumeSlider.value = 75;
            elements.bilateralVolumeVal.textContent = "75%";
            window.CosmicSynth.setBilateralVolume(0.75);
            
            elements.asmrVolumeSlider.value = 50;
            elements.asmrVolumeVal.textContent = "50%";
            window.CosmicSynth.setAsmrVolume(0.50);
            
            // Reset Music Visualizer Mode
            window.CosmicSynth.stopMusicReactivity();
            elements.micReactBtn.classList.remove("highlight");
            elements.systemReactBtn.classList.remove("highlight");
            elements.uploadReactBtn.classList.remove("highlight");
            elements.visualizerStatus.style.display = "none";
            elements.pulseBassToggle.checked = true;
            elements.pulseTrebleToggle.checked = true;
            
            showToast("Restored system settings default");
        };

        // Global key listeners
        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
            
            switch (e.key.toLowerCase()) {
                case "m":
                    e.preventDefault();
                    togglePanel();
                    break;
                case " ":
                    e.preventDefault();
                    togglePause();
                    break;
                case "a":
                    e.preventDefault();
                    toggleAudio();
                    break;
                case "f":
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case "r":
                    e.preventDefault();
                    sim.spawnParticles();
                    showToast("Particles redistributed.");
                    CosmicLogger.info("Particles redistributed manually.");
                    break;
                case "c":
                    e.preventDefault();
                    exporter.captureSnapshot();
                    break;
                case "h":
                    e.preventDefault();
                    elements.keyboardModal.classList.toggle("hidden");
                    break;
                case "l":
                    e.preventDefault();
                    const consoleEl = document.getElementById("diagnostic-console");
                    if (consoleEl) {
                        consoleEl.classList.toggle("hidden");
                        CosmicLogger.info("Diagnostic Console visibility toggled.");
                    }
                    break;
                case "arrowleft":
                    e.preventDefault();
                    const prevState = ConfigHistory.back();
                    if (prevState) applyHistoryState(prevState);
                    break;
                case "arrowright":
                    e.preventDefault();
                    const nextState = ConfigHistory.forward();
                    if (nextState) applyHistoryState(nextState);
                    break;
                case "g":
                    e.preventDefault();
                    applyRandomConfig();
                    break;
                case "3":
                    e.preventDefault();
                    toggle3DMode();
                    break;
                case "v":
                    e.preventDefault();
                    if (is3DMode && sim3D) {
                        sim3D.startVR();
                    }
                    break;
            }
        });

        // Binaural Mode selection
        elements.binauralModeSelect.onchange = () => {
            const mode = elements.binauralModeSelect.value;
            window.CosmicSynth.setBinauralMode(mode);
            sim.settings.binauralMode = mode;
            showToast(`Binaural wave shifted to: ${mode.toUpperCase()}`);
        };

        // Inactivity UI Fading listeners
        const uiContainers = [elements.hud, elements.floatingActions, elements.sidebarHandle, elements.controlPanel];
        uiContainers.forEach(container => {
            if (container) {
                container.addEventListener("mouseenter", () => {
                    isMouseOverUI = true;
                    resetUiFadeTimer();
                });
                container.addEventListener("mouseleave", () => {
                    isMouseOverUI = false;
                    resetUiFadeTimer();
                });
            }
        });

        // Global user activity listeners to trigger UI reveal
        window.addEventListener("mousemove", resetUiFadeTimer);
        window.addEventListener("mousedown", resetUiFadeTimer);
        window.addEventListener("touchstart", resetUiFadeTimer, { passive: true });
        window.addEventListener("keydown", resetUiFadeTimer);

        // One-step entry with an explicit comfort choice. The audio context is
        // unlocked only after the user's gesture, as required by browsers.
        if (elements.splashScreen) {
            const enterVeil = preferComfort => {
                setComfortMode(preferComfort, { persist: true, announce: false });
                elements.splashScreen.classList.add("fade-out");
                window.CosmicSynth.init();
            };
            if (elements.enterStandardBtn) elements.enterStandardBtn.onclick = () => enterVeil(false);
            if (elements.enterComfortBtn) elements.enterComfortBtn.onclick = () => enterVeil(true);
        }

        // Window resize
        window.addEventListener("resize", () => {
            if (is3DMode) {
                elements.canvas2D.width = 2560;
                elements.canvas2D.height = 1440;
                sim.resize(2560, 1440);
            } else {
                sim.resize(window.innerWidth, window.innerHeight);
            }
        });

        // Autopilot smart override: Automatically switch toggle to Manual when user interacts with sliders, selects, or toggles
        elements.controlPanel.addEventListener("input", (e) => {
            const id = e.target.id;
            const inputToKeyMap = {
                "speed-slider": "speed",
                "turbulence-slider": "turbulence",
                "density-slider": "density",
                "curl-slider": "flowOrganic",
                "dissipation-slider": "dissipation",
                "zoom-slider": "zoom",
                "size-slider": "baseSize",
                "size-var-slider": "sizeVariation",
                "stretch-slider": "stretch",
                "interaction-slider": "interaction",
                "mouse-influence-slider": "mouseInfluence",
                "rotation-slider": "rotationSpeed",
                "wobble-slider": "wobble",
                "kaleido-segments-slider": "kaleidoscopeSegments",
                "kaleidoscope-toggle": "kaleidoscopeEnabled",
                "psychedelic-toggle": "psychedelicMode",
                "morphing-bg-toggle": "morphingBg",
                "spinning-kaleido-toggle": "spinningKaleido",
                "particle-shape-select": "particleShape"
            };
            const key = inputToKeyMap[id];
            if (key) setOptionToManual(key);
            triggerHistoryCaptureDebounced();
        });

        elements.controlPanel.addEventListener("change", (e) => {
            const id = e.target.id;
            const inputToKeyMap = {
                "kaleidoscope-toggle": "kaleidoscopeEnabled",
                "psychedelic-toggle": "psychedelicMode",
                "morphing-bg-toggle": "morphingBg",
                "spinning-kaleido-toggle": "spinningKaleido",
                "particle-shape-select": "particleShape"
            };
            const key = inputToKeyMap[id];
            if (key) setOptionToManual(key);
            triggerHistoryCaptureDebounced();
        });

        // Dismiss autopilot help tooltip when clicked anywhere on the screen
        window.addEventListener("click", () => {
            if (elements.autopilotHelpTooltip && !elements.autopilotHelpTooltip.classList.contains("hidden")) {
                elements.autopilotHelpTooltip.classList.add("hidden");
            }
        }, true);
    }

    // --- MOUSE & DRAW PAINT COORDS INTERACTS ---
    function setupInteractionEvents() {
        let isDrawing = false;
        let lastX = 0, lastY = 0;

        const getCoords = (e) => {
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            // Scale dynamically from window viewport coordinates to the active simulation backing size
            return {
                x: (clientX / window.innerWidth) * sim.width,
                y: (clientY / window.innerHeight) * sim.height
            };
        };

        const handleStart = (e) => {
            if (e.target.tagName === "INPUT" || e.target.closest("aside") || e.target.closest("#hud") || e.target.closest("#floating-actions")) return;
            
            isDrawing = true;
            const coords = getCoords(e);
            lastX = coords.x;
            lastY = coords.y;
            
            sim.mouse.x = coords.x;
            sim.mouse.y = coords.y;
            sim.mouse.active = true;

            // Trigger burst explosions immediately on click
            if (sim.settings.mouseMode === "burst") {
                sim.triggerBurst(coords.x, coords.y, 18);
            }

            // Trigger click shockwave ripples if enabled
            if (sim.settings.shockwavesEnabled) {
                sim.triggerShockwave(coords.x, coords.y);
            }
        };

        const handleMove = (e) => {
            const coords = getCoords(e);
            sim.mouse.x = coords.x;
            sim.mouse.y = coords.y;

            if (!isDrawing) return;

            // Paint force vector tracks
            if (sim.settings.mouseMode === "paint") {
                const dx = coords.x - lastX;
                const dy = coords.y - lastY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1.5) {
                    // Accumulate vectors along dragged path
                    sim.addCustomForce(coords.x, coords.y, dx * 0.15, dy * 0.15);
                }
            } else if (sim.settings.mouseMode === "burst") {
                // Spawn tiny trail bursts
                sim.triggerBurst(coords.x, coords.y, 1);
            }

            lastX = coords.x;
            lastY = coords.y;
        };

        const handleEnd = () => {
            isDrawing = false;
            sim.mouse.active = false;
        };

        // Desktop Events
        window.addEventListener("mousedown", handleStart);
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleEnd);

        // Touch mobile Events
        window.addEventListener("touchstart", handleStart, { passive: true });
        window.addEventListener("touchmove", handleMove, { passive: true });
        window.addEventListener("touchend", handleEnd);
    }

    // --- QUICK ACTION UTILITY FUNCS ---
    function togglePause() {
        sim.isPaused = !sim.isPaused;
        if (sim3D && sim3D.usesFlowTexture === false) {
            sim3D.isPaused = sim.isPaused;
        }
        
        const pIcon = elements.pauseBtn.querySelector(".pause-icon");
        const playIcon = elements.pauseBtn.querySelector(".play-icon");
        
        if (sim.isPaused) {
            pIcon.classList.add("hide");
            playIcon.classList.remove("hide");
            elements.pauseBtn.classList.add("highlight");
            showToast("Simulation suspended");
        } else {
            pIcon.classList.remove("hide");
            playIcon.classList.add("hide");
            elements.pauseBtn.classList.remove("highlight");
            showToast("Simulation playing");
            // Reset clock step delta
            sim.lastFrameTime = Date.now();
        }
    }

    function toggleAudio(active) {
        const synth = window.CosmicSynth;
        const state = (active !== undefined) ? !active : !synth.isMuted;
        
        synth.setMute(state);
        
        const muteIcon = elements.audioToggleBtn.querySelector(".audio-muted-icon");
        const playIcon = elements.audioToggleBtn.querySelector(".audio-playing-icon");
        
        elements.soundEnableToggle.checked = !state;
        
        if (state) {
            muteIcon.classList.remove("hide");
            playIcon.classList.add("hide");
            elements.audioToggleBtn.classList.remove("highlight");
            elements.audioSettingsSliders.classList.add("disabled-element");
            showToast("Ambient synthesizer muted");
        } else {
            muteIcon.classList.add("hide");
            playIcon.classList.remove("hide");
            elements.audioToggleBtn.classList.add("highlight");
            elements.audioSettingsSliders.classList.remove("disabled-element");
            showToast("Ambient synthesizer unmuted");
            
            // Show headphones alert prompt overlay
            triggerHeadphonesPrompt();
            
            // Sync frequencies immediately
            modulateSynth();
        }
    }

    function triggerHeadphonesPrompt() {
        if (headphonesPromptTimeout) clearTimeout(headphonesPromptTimeout);
        elements.headphonesPrompt.classList.remove("hidden");
        headphonesPromptTimeout = setTimeout(() => {
            elements.headphonesPrompt.classList.add("hidden");
        }, 3500); // fade out after 3.5 seconds
    }

    function resetUiFadeTimer() {
        if (uiFadeTimeout) clearTimeout(uiFadeTimeout);
        
        // Remove fade styling instantly
        const uiElements = [elements.hud, elements.floatingActions, elements.sidebarHandle, elements.controlPanel];
        uiElements.forEach(el => {
            if (el) el.classList.remove("ui-faded");
        });
        
        // Start countdown only if mouse is NOT hovering over UI elements
        if (!isMouseOverUI) {
            uiFadeTimeout = setTimeout(fadeUiElements, 5000); // 5 seconds fadeout timer
        }
    }

    function fadeUiElements() {
        if (isMouseOverUI) return;
        const uiElements = [elements.hud, elements.floatingActions, elements.sidebarHandle, elements.controlPanel];
        uiElements.forEach(el => {
            if (el) el.classList.add("ui-faded");
        });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => showToast("Fullscreen enabled"))
                .catch(() => showToast("Fullscreen mode restricted"));
        } else {
            document.exitFullscreen();
        }
    }

    // Apply URL State values
    function applyLoadedState(data) {
        // Set settings
        Object.keys(data.settings).forEach(key => {
            sim.settings[key] = data.settings[key];
        });
        
        // Sync sliders & configs
        elements.speedSlider.value = sim.settings.speed;
        elements.turbulenceSlider.value = sim.settings.turbulence;
        elements.densitySlider.value = sim.settings.density;
        elements.curlSlider.value = sim.settings.flowOrganic;
        elements.dissipationSlider.value = sim.settings.dissipation;
        elements.zoomSlider.value = sim.settings.zoom;
        
        elements.sizeSlider.value = sim.settings.baseSize;
        elements.sizeVarSlider.value = sim.settings.sizeVariation;
        elements.stretchSlider.value = sim.settings.stretch;
        elements.interactionSlider.value = sim.settings.interaction;
        
        elements.mouseInfluenceSlider.value = sim.settings.mouseInfluence;
        elements.mouseModeSelect.value = sim.settings.mouseMode;
        
        elements.kaleidoscopeToggle.checked = sim.settings.kaleidoscopeEnabled;
        if (sim.settings.kaleidoscopeEnabled) elements.kaleidoscopeSettings.classList.remove("hidden");
        elements.kaleidoSegmentsSlider.value = sim.settings.kaleidoscopeSegments;
        
        elements.rotationSlider.value = sim.settings.rotationSpeed;
        elements.wobbleSlider.value = sim.settings.wobble;
        
        // Sync Psychedelic Drive UIs
        elements.psychedelicToggle.checked = sim.settings.psychedelicMode;
        elements.morphingBgToggle.checked = sim.settings.morphingBg;
        elements.spinningKaleidoToggle.checked = sim.settings.spinningKaleido;
        elements.shockwavesToggle.checked = sim.settings.shockwavesEnabled;
        elements.particleShapeSelect.value = sim.settings.particleShape || "ellipse";
        elements.particleLightingSelect.value = sim.settings.particleLighting || "glow";
        
        // Sync Audio settings UIs
        const loadedBinauralMode = sim.settings.binauralMode || "theta";
        elements.binauralModeSelect.value = loadedBinauralMode;
        window.CosmicSynth.setBinauralMode(loadedBinauralMode);

        const loadedBilateral = sim.settings.bilateralEnabled === true;
        elements.bilateralToggle.checked = loadedBilateral;
        window.CosmicSynth.setBilateralEnabled(loadedBilateral);

        const loadedAsmr = sim.settings.asmrEnabled === true;
        elements.asmrToggle.checked = loadedAsmr;
        window.CosmicSynth.setAsmrEnabled(loadedAsmr);
        
        // Sync default channel mixer values
        elements.droneVolumeSlider.value = 36;
        elements.droneVolumeVal.textContent = "36%";
        window.CosmicSynth.setDroneVolume(0.36);
        
        elements.bilateralVolumeSlider.value = 75;
        elements.bilateralVolumeVal.textContent = "75%";
        window.CosmicSynth.setBilateralVolume(0.75);
        
        elements.asmrVolumeSlider.value = 50;
        elements.asmrVolumeVal.textContent = "50%";
        window.CosmicSynth.setAsmrVolume(0.50);
        
        // Colors & Background
        updateActivePalette([...data.palette]);
        sim.backgroundColor = data.backgroundColor;
        elements.bgColorPicker.value = data.backgroundColor;
        elements.bgHexVal.textContent = data.backgroundColor.toUpperCase();
        document.getElementById("ambient-glow").style.background = 
            `radial-gradient(circle, ${sim.backgroundColor}88 0%, transparent 70%)`;
            
        sim.isSolidMode = data.isSolidMode;
        elements.solidModeToggle.checked = data.isSolidMode;
        elements.hudMode.textContent = sim.isSolidMode ? "SOLID" : "FLOW";
        
        toggleAutopilot(data.autopilotEnabled);
        
        // Reconcile loaded density target on live particles
        sim.updateDensity();
    }

    // Sync Text values dynamically beside slider handles
    function updateSliderTextDisplays() {
        elements.speedVal.textContent = sim.settings.speed.toFixed(2);
        elements.turbulenceVal.textContent = sim.settings.turbulence.toFixed(2);
        elements.densityVal.textContent = Math.floor(sim.settings.density);
        elements.curlVal.textContent = sim.settings.flowOrganic.toFixed(2);
        elements.dissipationVal.textContent = sim.settings.dissipation.toFixed(3);
        elements.zoomVal.textContent = sim.settings.zoom.toFixed(2);
        
        elements.sizeVal.textContent = sim.settings.baseSize.toFixed(1);
        elements.sizeVarVal.textContent = sim.settings.sizeVariation.toFixed(1);
        elements.stretchVal.textContent = sim.settings.stretch.toFixed(1);
        elements.interactionVal.textContent = sim.settings.interaction.toFixed(1);
        
        elements.mouseInfluenceVal.textContent = sim.settings.mouseInfluence.toFixed(1);
        elements.kaleidoSegmentsVal.textContent = Math.floor(sim.settings.kaleidoscopeSegments);
        elements.rotationVal.textContent = sim.settings.rotationSpeed.toFixed(2);
        elements.wobbleVal.textContent = sim.settings.wobble.toFixed(2);
    }

    // Helper Toast
    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.remove("toast-hidden");
        
        clearTimeout(elements.toastTimeout);
        elements.toastTimeout = setTimeout(() => {
            elements.toast.classList.add("toast-hidden");
        }, 2200);
    }

    // --- MUSIC REACTIVITY CONTROLLER ---
    // (baseSettings and basePalette are declared in higher scope)
    let maxBassSeen = 0.4;
    let maxTrebleSeen = 0.4;
    let lastShockwaveTime = 0;
    let lastColorShiftTime = 0;
    
    // Transient history buffers & envelope states
    let prevBass = 0;
    let prevTreble = 0;
    let sizePulse = 0;
    let speedPulse = 0;
    let turbPulse = 0;
    let wobblePulse = 0;
    let stretchPulse = 0;

    // Mood tracking smoothing offsets (for color palettes)
    let moodH = 0;
    let moodS = 0;
    let moodL = 0;

    function processMusicReactivity() {
        if (!window.CosmicSynth) return;
        
        const analysis = window.CosmicSynth.getMusicAnalysis();
        if (!analysis) {
            // Restore settings if visualizer mode was deactivated
            if (baseSettings) {
                for (const key in baseSettings) {
                    sim.settings[key] = baseSettings[key];
                }
                if (basePalette) {
                    sim.updatePalette(basePalette);
                    renderSwatches();
                    modulateSynth();
                    basePalette = null;
                }
                baseSettings = null;
                moodH = moodS = moodL = 0;
                
                // Restore scale and glow defaults
                const canvasEl = document.getElementById("canvas");
                if (canvasEl) canvasEl.style.transform = "";
                
                const ambientGlowEl = document.getElementById("ambient-glow");
                if (ambientGlowEl) {
                    ambientGlowEl.style.background = `radial-gradient(circle, ${sim.backgroundColor}88 0%, transparent 70%)`;
                    ambientGlowEl.style.opacity = 1.0;
                }
                sim.settings.trebleIntensity = 0;
            }
            return;
        }
        
        // Backup settings and palette before we modulate them
        if (!baseSettings) {
            baseSettings = {
                baseSize: sim.settings.baseSize,
                turbulence: sim.settings.turbulence,
                speed: sim.settings.speed,
                dissipation: sim.settings.dissipation,
                wobble: sim.settings.wobble,
                stretch: sim.settings.stretch,
                rotationSpeed: sim.settings.rotationSpeed
            };
            basePalette = [...sim.palette];
        }
        
        const now = Date.now();
        
        // 1. Dynamic Gain Control (Rolling Peak auto-calibration)
        if (analysis.bass > maxBassSeen) maxBassSeen = analysis.bass;
        else maxBassSeen = Math.max(0.1, maxBassSeen * 0.9995); // decay slowly to retain high sensitivity

        if (analysis.treble > maxTrebleSeen) maxTrebleSeen = analysis.treble;
        else maxTrebleSeen = Math.max(0.1, maxTrebleSeen * 0.9995);
        
        // Normalize raw levels relative to rolling peaks (0.0 to 1.0)
        const normalizedBass = Math.min(1.0, analysis.bass / maxBassSeen);
        const normalizedTreble = Math.min(1.0, analysis.treble / maxTrebleSeen);
        
        // 2. Spectral Flux (Transients / Rate of change detection)
        // Tracks changes from previous frame to isolate beat attacks (onset) rather than raw volume level
        const bassAttack = Math.max(0, normalizedBass - prevBass);
        const trebleAttack = Math.max(0, normalizedTreble - prevTreble);
        // Large immersive displays amplify every pulse. Keep the existing 2D
        // response untouched while applying a calmer half-strength mix in 3D/VR.
        const musicResponseGain = (is3DMode ? 0.5 : 1.0) * (isComfortMode ? 0.5 : 1.0);
        
        prevBass = normalizedBass;
        prevTreble = normalizedTreble;
        
        // 3. ADSR Envelope Injection (Instant Attack)
        // Feed the transient attack strength directly into the visual envelopes
        if (bassAttack > 0.015) {
            sizePulse = Math.max(sizePulse, bassAttack * 3.8);
        }
        
        if (trebleAttack > 0.015) {
            speedPulse = Math.max(speedPulse, trebleAttack * 4.2);
            turbPulse = Math.max(turbPulse, trebleAttack * 3.5);
            wobblePulse = Math.max(wobblePulse, trebleAttack * 5.0);
            stretchPulse = Math.max(stretchPulse, trebleAttack * 6.0);
        }
        
        // 4. Snappy Exponential Decay (Release)
        // Decays the envelopes very fast per frame to keep visual pulses short and punchy
        sizePulse *= 0.82;         // ~150ms decay window
        speedPulse *= 0.86;
        turbPulse *= 0.86;
        wobblePulse *= 0.84;
        stretchPulse *= 0.84;
        
        // 5. Sound Mood Detection & Real-time Color Palette Morphing
        if (isFlowEnabled("colors")) {
            // Bass-to-Treble Ratio (high = warm/mellow bass, low = bright/happy treble)
            const bassTrebleRatio = normalizedBass / (normalizedTreble + 0.08);
            
            // Acoustic Brightness (Spectral Centroid)
            let weightedSum = 0;
            let amplitudeSum = 0;
            const visualData = window.CosmicSynth.getVisualizerData();
            if (visualData) {
                for (let i = 0; i < visualData.length; i++) {
                    weightedSum += i * visualData[i];
                    amplitudeSum += visualData[i];
                }
            }
            const centroid = amplitudeSum > 0 ? (weightedSum / amplitudeSum) / visualData.length : 0.35;
            
            let targetHueShift = 0;
            let targetSatShift = 0;
            let targetLightShift = 0;
            
            if (centroid > 0.42 || bassTrebleRatio < 0.72) {
                // Bright/Happy song -> Shift toward warm golden/magenta hues (+35°), increase saturation (+18%), boost lightness (+4%)
                targetHueShift = 35;
                targetSatShift = 18;
                targetLightShift = 4;
            } else if (centroid < 0.28 || bassTrebleRatio > 1.35) {
                // Mellow/Sad/Deep song -> Shift toward cool blue/indigo hues (-40°), lower saturation (-22%), dim lightness (-8%)
                targetHueShift = -40;
                targetSatShift = -22;
                targetLightShift = -8;
            }

            targetHueShift *= musicResponseGain;
            targetSatShift *= musicResponseGain;
            targetLightShift *= musicResponseGain;
            
            // Smoothly drift offsets (low-pass filter) to avoid flashing or jitter
            moodH += (targetHueShift - moodH) * 0.015;
            moodS += (targetSatShift - moodS) * 0.015;
            moodL += (targetLightShift - moodL) * 0.015;
            
            // Apply calculated offsets to original basePalette
            if (Math.abs(moodH) > 0.5 || Math.abs(moodS) > 0.5 || Math.abs(moodL) > 0.5) {
                const moodPalette = basePalette.map(color => {
                    const hsl = hexToHsl(parseColorToHex(color));
                    if (hsl) {
                        let h = (hsl.h + moodH) % 360;
                        if (h < 0) h += 360;
                        const s = Math.max(10, Math.min(100, hsl.s + moodS));
                        const l = Math.max(8, Math.min(95, hsl.l + moodL));
                        return hslToHex(h, s, l);
                    }
                    return color;
                });
                
                sim.updatePalette(moodPalette);
                renderSwatches();
                modulateSynth();
            }
        }
        
        // 6. Apply Modulations to simulation settings
        const appliedSizePulse = sizePulse * musicResponseGain;
        const appliedSpeedPulse = speedPulse * musicResponseGain;
        const appliedTurbPulse = turbPulse * musicResponseGain;
        const appliedWobblePulse = wobblePulse * musicResponseGain;
        const appliedStretchPulse = stretchPulse * musicResponseGain;
        
        // Dynamic Canvas scale screen bounce (subtle punch up to 1.035x)
        const scaleAmount = 1.0 + Math.min(0.035, appliedSizePulse * 0.03);
        const canvasEl = document.getElementById("canvas");
        if (canvasEl) {
            canvasEl.style.transform = `scale(${scaleAmount})`;
        }
        const webglCanvasEl = document.getElementById("webgl-canvas");
        if (webglCanvasEl) {
            webglCanvasEl.style.transform = `scale(${scaleAmount})`;
        }
        
        // Dynamic Ambient Glow pulse
        const glowSize = 70 + Math.min(25, appliedSizePulse * 22);
        const glowOpacity = 0.5 + Math.min(0.5, appliedSizePulse * 0.4);
        const ambientGlowEl = document.getElementById("ambient-glow");
        if (ambientGlowEl) {
            ambientGlowEl.style.background = `radial-gradient(circle, ${sim.backgroundColor}dd 0%, transparent ${glowSize}%)`;
            ambientGlowEl.style.opacity = glowOpacity;
        }
        
        // Feed Treble pulse to settings to drive particle sparkles
        sim.settings.trebleIntensity = appliedSpeedPulse;
        if (is3DMode && sim3D) {
            sim3D.sizePulse = appliedSizePulse;
            sim3D.trebleIntensity = appliedSpeedPulse;
        }
        
        // Bass Modulations (Particle Size & Dissipation)
        if (elements.pulseBassToggle.checked) {
            // Pulse particle base size (cap size swelling at a clean 3.5x max for visible punch)
            const sizeMod = 1.0 + Math.min(2.5, appliedSizePulse);
            sim.settings.baseSize = baseSettings.baseSize * sizeMod;
            
            // Temporarily decrease dissipation to make flow trails glow on attacks
            const dissMod = Math.max(0.004, baseSettings.dissipation - Math.min(0.04, appliedSizePulse * 0.05));
            sim.settings.dissipation = dissMod;
            
            // Trigger physical starbursts & explosions ONLY on hard transient attacks (not sustained drones)
            if (bassAttack > 0.12 && now - lastShockwaveTime > 380) {
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;
                
                if (is3DMode && sim3D) {
                    sim3D.triggerBurst(0, 0, Math.round(45 * musicResponseGain));
                    sim3D.triggerVortex(0, 0, 280, 18.0 * musicResponseGain, Math.round(50 * musicResponseGain));
                    sim3D.triggerShockwave(0, 0, 60.0, 11.0 * musicResponseGain);
                } else {
                    // Direct physical outward velocity boost to all particles
                    sim.particles.forEach(p => {
                        const dx = p.x - cx;
                        const dy = p.y - cy;
                        const distSq = dx * dx + dy * dy;
                        if (distSq > 9) {
                            const dist = Math.sqrt(distSq);
                            // Blast force scales with the attack intensity
                            const pushForce = 8.0 + (bassAttack * 18.0);
                            p.vx += (dx / dist) * pushForce;
                            p.vy += (dy / dist) * pushForce;
                        }
                    });
                    
                    // Spawn a quick, neat cluster of 35 particles
                    sim.triggerBurst(cx, cy, 35);
                    
                    // Trigger a beat vortex swirl at center (pulls inward and spins)
                    sim.triggerVortex(cx, cy, 280, 16.0, 45);
                    
                    // Silent force wave to push outer vectors
                    sim.triggerShockwave(cx, cy, 55.0, 10.5);
                }
                
                lastShockwaveTime = now;
            }
            
            // Trigger a quick new palette generation on major beats if not mood shifting
            if (isFlowEnabled("colors") && bassAttack > 0.22 && now - lastColorShiftTime > 3000) {
                const palette = generateHarmoniousPalette(flowPersonality);
                updateActivePalette(palette);
                renderSwatches();
                modulateSynth();
                lastColorShiftTime = now;
            }
        } else {
            sim.settings.baseSize = baseSettings.baseSize;
            sim.settings.dissipation = baseSettings.dissipation;
        }
        
        // Treble Modulations (Flow Speed, Turbulence, Wobble & Stretch)
        if (elements.pulseTrebleToggle.checked) {
            // Speed and turbulence pulse to melody attacks (capped at a clean, smooth swell)
            sim.settings.speed = baseSettings.speed * (1.0 + Math.min(2.5, appliedSpeedPulse));
            sim.settings.turbulence = baseSettings.turbulence * (1.0 + Math.min(2.0, appliedTurbPulse));
            
            // Quick wobble and stretch pulses
            sim.settings.wobble = baseSettings.wobble + Math.min(6.0, appliedWobblePulse);
            sim.settings.stretch = baseSettings.stretch + Math.min(7.0, appliedStretchPulse);
            sim.settings.rotationSpeed = baseSettings.rotationSpeed + (appliedSpeedPulse * 0.08);
        } else {
            sim.settings.speed = baseSettings.speed;
            sim.settings.turbulence = baseSettings.turbulence;
            sim.settings.wobble = baseSettings.wobble;
            sim.settings.stretch = baseSettings.stretch;
            sim.settings.rotationSpeed = baseSettings.rotationSpeed;
        }
    }

    // --- MAIN RENDER LOOP TRIGGER ---
    let lastFpsTime = Date.now();
    let frameCount = 0;
    
    function tickLoop() {
        if (is3DMode) return;
        
        // Run real-time music reactivity modulation
        processMusicReactivity();
        processMeditationMode();
        
        // Run physics morph morph transitions
        processMorphs();
        
        // Tick particle movements on canvas
        sim.tick();
        
        // Diagnostic updates in HUD (FPS Counter limit updates to every 500ms)
        frameCount++;
        const now = Date.now();
        if (now - lastFpsTime >= 500) {
            const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
            elements.hudFps.textContent = fps;
            elements.hudParticles.textContent = sim.particles.length;
            
            updatePerfDiagnosticConsole(fps);
            
            // Track low performance runs (FPS < 32 for 3 consecutive readings = 1.5 seconds)
            if (fps < 32) {
                window.lowFpsTicks = (window.lowFpsTicks || 0) + 1;
                if (window.lowFpsTicks === 3) {
                    CosmicLogger.warn(`Low FPS Warning: Rendering at ${fps} FPS. Try lowering density or segment limits.`);
                }
            } else {
                window.lowFpsTicks = 0;
            }
            
            frameCount = 0;
            lastFpsTime = now;
        }

        // Maintain HUD visualizer waveform updates
        updateHudWaveform();

        requestAnimationFrame(tickLoop);
    }

    function setupColorCycles() {
        if (!elements.themeCycleButtons || elements.themeCycleButtons.length === 0) {
            CosmicLogger.warn("setupColorCycles: No buttons found with class .theme-cycle-btn");
            return;
        }
        CosmicLogger.info(`setupColorCycles: Initialized with ${elements.themeCycleButtons.length} playlist buttons.`);

        const cycleDescriptions = {
            random: "Autopilot drifts across any random harmonious colors.",
            cyberpunk: "Electric neon grids, hot violet, and synthetic blues.",
            seasons: "Earthy autumn copper, spring blossoms, and winter frost.",
            candy: "Sweet bubblegum, lollipop pastels, and lavender skies.",
            goth: "Velvet obsidian shadows, crimson red, and deep burgundy.",
            ocean: "Swaying seafoam greens, deep sapphire, and sandy reefs.",
            chakra: "Chakra energies, crown amethyst violet, throat blue, solar yellow.",
            psychedelic: "High contrast neon melts, acid trips, and retro psychedelic hues.",
            custom: "Loops sequentially through custom themes saved in your library."
        };

        function updateCycleDescription(cycle) {
            if (elements.themeCycleDesc) {
                elements.themeCycleDesc.textContent = cycleDescriptions[cycle] || cycleDescriptions.random;
            }
            if (elements.hudColorName) {
                elements.hudColorName.textContent = cycle.toUpperCase();
            }
        }

        elements.themeCycleButtons.forEach(btn => {
            btn.onclick = () => {
                try {
                    const targetCycle = btn.dataset.cycle;
                    CosmicLogger.info(`Theme cycle button clicked: ${targetCycle}`);
                    let nextCycle = targetCycle;

                    // Toggle click behavior: if already active and not "random", click sets it back to "random"
                    if (activeColorCycle === targetCycle && targetCycle !== "random") {
                        nextCycle = "random";
                        CosmicLogger.info("Playlist toggled off. Reverting to random.");
                    }

                    // Update active state in UI buttons
                    elements.themeCycleButtons.forEach(b => {
                        b.classList.toggle("active", b.dataset.cycle === nextCycle);
                    });

                    activeColorCycle = nextCycle;
                    localStorage.setItem("eternalVoidColorCycle", activeColorCycle);
                    updateCycleDescription(activeColorCycle);

                    // Give immediate visual feedback
                    if (window.ColorCycles) {
                        const nextPal = window.ColorCycles.getNextPalette(activeColorCycle, sim.palette);
                        if (nextPal) {
                            setOptionToFlow("colors");
                            elements.autopilotColorToggle.checked = true;
                            if (!isAutopilot) {
                                toggleAutopilot(true);
                            } else {
                                startAutopilotIntervals();
                            }
                            startPaletteMorph(nextPal, 4000);
                            showToast(`Active playlist: ${nextCycle === "random" ? "Random" : btn.textContent}`);
                        } else if (activeColorCycle === "custom") {
                            showToast("Swatches library is empty. Save a custom theme first!");
                            // Revert back to random
                            elements.themeCycleButtons.forEach(b => {
                                b.classList.toggle("active", b.dataset.cycle === "random");
                            });
                            activeColorCycle = "random";
                            localStorage.setItem("eternalVoidColorCycle", "random");
                            updateCycleDescription("random");
                        } else if (activeColorCycle === "random") {
                            // Trigger a random morph
                            const palette = generateHarmoniousPalette(flowPersonality);
                            setOptionToFlow("colors");
                            elements.autopilotColorToggle.checked = true;
                            if (!isAutopilot) {
                                toggleAutopilot(true);
                            } else {
                                startAutopilotIntervals();
                            }
                            startPaletteMorph(palette, 4000);
                            showToast("Active playlist: Random");
                        }
                    }
                } catch (err) {
                    CosmicLogger.error(`Theme cycle click error: ${err.stack || err.message}`);
                }
            };
        });

        // Initialize state selection
        elements.themeCycleButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.cycle === activeColorCycle);
        });
        updateCycleDescription(activeColorCycle);
    }

    function setupHarmonicDesigner() {
        let isInitialLoad = true;
        const toggle = document.getElementById("harmonic-designer-toggle");
        const panel = document.getElementById("harmonic-designer-panel");
        const hueInput = document.getElementById("harmonic-hue");
        const satInput = document.getElementById("harmonic-sat");
        const satVal = document.getElementById("harmonic-sat-val");
        const lightInput = document.getElementById("harmonic-light");
        const lightVal = document.getElementById("harmonic-light-val");
        const previewRow = document.getElementById("harmonic-preview-row");
        const livePreviewToggle = document.getElementById("harmonic-live-preview");
        const btnApply = document.getElementById("btn-apply-harmonic");
        const saveNameInput = document.getElementById("save-swatch-name");
        const btnSave = document.getElementById("btn-save-swatch");
        const savedGrid = document.getElementById("saved-swatches-grid");
        const ruleTabs = document.getElementById("harmony-rule-tabs");

        let activeRule = "mono";
        let generatedColors = [];

        // 1. Accordion Toggle
        if (toggle && panel) {
            toggle.onclick = () => {
                const expanded = toggle.getAttribute("aria-expanded") === "true";
                toggle.setAttribute("aria-expanded", !expanded);
                toggle.classList.toggle("expanded", !expanded);
                panel.setAttribute("aria-hidden", expanded);
            };
            
            // Allow keyboard activation (Space/Enter)
            toggle.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle.click();
                }
            };
        }

        // 2. Rule Tabs Click Handler
        if (ruleTabs) {
            ruleTabs.querySelectorAll(".harmony-tab").forEach(tab => {
                tab.onclick = () => {
                    ruleTabs.querySelectorAll(".harmony-tab").forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    activeRule = tab.getAttribute("data-rule");
                    updateHarmonies();
                };
            });
        }

        // 3. Update preview swatches and morph active colors if Live Preview is checked
        function updateHarmonies() {
            if (!hueInput || !satInput || !lightInput) return;
            const h = parseInt(hueInput.value, 10);
            const s = parseInt(satInput.value, 10);
            const l = parseInt(lightInput.value, 10);

            if (satVal) satVal.textContent = `${s}%`;
            if (lightVal) lightVal.textContent = `${l}%`;

            if (window.ColorTheory && window.ColorTheory.generateHarmony) {
                // Generate HSL strings using ColorTheory helper
                const hslColors = window.ColorTheory.generateHarmony(h, s, l, activeRule);
                // Convert to HEX for application and display
                generatedColors = hslColors.map(c => window.ColorTheory.hslToHex(c));

                // Update preview swatch divs
                if (previewRow) {
                    const swatchDivs = previewRow.querySelectorAll(".preview-swatch-item");
                    swatchDivs.forEach((div, idx) => {
                        if (generatedColors[idx]) {
                            div.style.backgroundColor = generatedColors[idx];
                            div.setAttribute("title", generatedColors[idx]);
                        }
                    });
                }

                // If live preview is active, apply directly to simulation
                if (!isInitialLoad && livePreviewToggle && livePreviewToggle.checked) {
                    setOptionToManual("colors");
                    turnOffPsychedelicMode();
                    startPaletteMorph(generatedColors, 2000);
                }
            }
        }

        // Bind slider inputs
        [hueInput, satInput, lightInput].forEach(slider => {
            if (slider) {
                slider.oninput = () => {
                    updateHarmonies();
                };
            }
        });

        // 4. Apply to simulation explicitly
        if (btnApply) {
            btnApply.onclick = () => {
                if (generatedColors.length > 0) {
                    setOptionToManual("colors");
                    turnOffPsychedelicMode();
                    startPaletteMorph(generatedColors, 4000);
                    // Also trigger swatch history save
                    if (typeof ConfigHistory !== "undefined" && ConfigHistory.push) {
                        ConfigHistory.push({
                            palette: [...generatedColors]
                        });
                    }
                    showToast("Harmonic palette applied");
                }
            };
        }

        // 5. Save Swatch Set to localStorage Library
        function getLibrary() {
            try {
                return JSON.parse(localStorage.getItem("eternal_void_custom_palettes") || localStorage.getItem("eternal_veil_custom_palettes")) || [];
            } catch (e) {
                return [];
            }
        }

        function saveLibrary(lib) {
            localStorage.setItem("eternal_void_custom_palettes", JSON.stringify(lib));
        }

        function renderLibrary() {
            const grid = document.getElementById("saved-swatches-grid");
            if (!grid) return;
            const lib = getLibrary();
            grid.innerHTML = "";

            if (lib.length === 0) {
                grid.innerHTML = `<div style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 10px 0;">No custom palettes saved yet.</div>`;
                return;
            }

            lib.forEach(item => {
                const card = document.createElement("div");
                card.className = "saved-swatch-card";
                card.setAttribute("role", "button");
                card.setAttribute("tabindex", "0");
                
                const meta = document.createElement("div");
                meta.className = "saved-swatch-meta";
                
                const name = document.createElement("span");
                name.className = "saved-swatch-name";
                name.textContent = item.name;
                
                const colorsContainer = document.createElement("div");
                colorsContainer.className = "saved-swatch-colors";
                item.colors.forEach(col => {
                    const circle = document.createElement("div");
                    circle.className = "saved-swatch-circle";
                    circle.style.backgroundColor = col;
                    colorsContainer.appendChild(circle);
                });
                
                meta.appendChild(name);
                meta.appendChild(colorsContainer);
                
                const btnDelete = document.createElement("button");
                btnDelete.className = "btn-delete-swatch";
                btnDelete.innerHTML = "&times;";
                btnDelete.setAttribute("title", "Delete from library");
                btnDelete.setAttribute("aria-label", `Delete palette ${item.name}`);
                
                btnDelete.onclick = (e) => {
                    e.stopPropagation(); // prevent loading on click
                    const updatedLib = getLibrary().filter(x => x.id !== item.id);
                    saveLibrary(updatedLib);
                    renderLibrary();
                    showToast("Palette deleted");
                };

                card.appendChild(meta);
                card.appendChild(btnDelete);
                
                // Click to apply the saved theme
                card.onclick = () => {
                    const firstColor = item.colors[0];
                    if (firstColor && window.ColorTheory && window.ColorTheory.hexToHsl) {
                        const hsl = window.ColorTheory.hexToHsl(firstColor);
                        if (hueInput) hueInput.value = hsl.h;
                        if (satInput) satInput.value = hsl.s;
                        if (lightInput) lightInput.value = hsl.l;
                        if (satVal) satVal.textContent = `${hsl.s}%`;
                        if (lightVal) lightVal.textContent = `${hsl.l}%`;
                    }
                    
                    // Update preview swatches in the designer to show the saved colors
                    if (previewRow) {
                        const swatchDivs = previewRow.querySelectorAll(".preview-swatch-item");
                        swatchDivs.forEach((div, idx) => {
                            if (item.colors[idx]) {
                                div.style.backgroundColor = item.colors[idx];
                                div.setAttribute("title", item.colors[idx]);
                                div.style.display = "block";
                            } else {
                                div.style.display = "none";
                            }
                        });
                    }
                    
                    generatedColors = [...item.colors];

                    setOptionToManual("colors");
                    turnOffPsychedelicMode();
                    startPaletteMorph(item.colors, 4000);
                    showToast(`Loaded palette: ${item.name}`);
                };

                // Accessibility Keyboard support
                card.onkeydown = (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        card.click();
                    }
                };

                grid.appendChild(card);
            });
        }

        if (btnSave) {
            btnSave.onclick = () => {
                const name = saveNameInput.value.trim();
                if (!name) {
                    showToast("Please enter a name for the palette");
                    return;
                }

                // Prioritize active simulation palette (includes custom added colors)
                const colorsToSave = sim && sim.palette && sim.palette.length > 0 
                    ? [...sim.palette] 
                    : [...generatedColors];

                if (colorsToSave.length === 0) {
                    showToast("Generate or create a palette first");
                    return;
                }

                const lib = getLibrary();
                if (lib.length >= 12) {
                    showToast("Library full (max 12 saved palettes)");
                    return;
                }

                const newItem = {
                    id: Date.now().toString(),
                    name: name.substring(0, 20),
                    colors: colorsToSave
                };

                lib.unshift(newItem); // prepend new item
                saveLibrary(lib);
                saveNameInput.value = "";
                renderLibrary();
                showToast(`Palette "${newItem.name}" saved!`);
            };
        }

        // Initialize designer swatches and grid
        updateHarmonies();
        renderLibrary();
        isInitialLoad = false;
    }

    // Boot
    initialize();
});
