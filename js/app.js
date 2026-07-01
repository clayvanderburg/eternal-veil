// ==========================================================================
// ETERNAL VEIL - MAIN APPLICATION CONTROLLER
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
    let autopilotTimer = null;
    let autopilotColorTimer = null;
    let isAutopilot = true;
    let lastPresetKey = null;
    
    // 3D/VR Mode States
    let is3DMode = false;
    let sim3D = null;

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
        canvas2D: document.getElementById("canvas")
    };

    // --- INITIALIZATION ---
    function initialize() {
        CosmicLogger.info("ETERNAL VEIL initializing...");
        setupTabs();
        setupFlowToggles();
        buildPresetCards();
        
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
        
        setupEventListeners();
        setupInteractionEvents();
        updateSliderTextDisplays();
        renderSwatches();
        
        // Start inactivity fade countdown
        resetUiFadeTimer();
        
        // Start animation loop
        requestAnimationFrame(tickLoop);
        CosmicLogger.info("ETERNAL VEIL initialization complete. Main animation loop running.");
    }

    // --- SMOOTH MORPH TRANSITIONS ---
    function startMorph(key, targetValue, duration = 1800) {
        const current = sim.settings[key];
        if (current === undefined || Math.abs(current - targetValue) < 0.0001) return;
        
        activeTransitions[key] = {
            from: current,
            to: targetValue,
            start: Date.now(),
            duration: duration
        };
    }

    function processMorphs() {
        const now = Date.now();
        let updated = false;
        
        for (const key in activeTransitions) {
            const transition = activeTransitions[key];
            const elapsed = now - transition.start;
            const progress = Math.min(elapsed / transition.duration, 1.0);
            
            // Cubic Ease-Out curve
            const eased = 1.0 - Math.pow(1.0 - progress, 3.0);
            const val = transition.from + (transition.to - transition.from) * eased;
            
            sim.settings[key] = val;
            
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
        
        if (updated) {
            updateSliderTextDisplays();
            if (sim.settings.density) sim.updateDensity();
        }
    }

    // --- PRESETS MANAGEMENT ---
    function buildPresetCards() {
        elements.presetsGrid.innerHTML = "";
        Object.keys(StylePresets).forEach(key => {
            const p = StylePresets[key];
            const card = document.createElement("div");
            card.className = "preset-card";
            card.setAttribute("data-preset", key);
            card.innerHTML = `
                <div class="preset-name">${p.name}</div>
                <div class="preset-desc">${p.desc}</div>
            `;
            card.onclick = () => loadPreset(key);
            elements.presetsGrid.appendChild(card);
        });
    }

    function loadPreset(key) {
        const p = StylePresets[key];
        if (!p) return;
        
        lastPresetKey = key;
        
        // Highlight active card
        document.querySelectorAll(".preset-card").forEach(c => {
            c.classList.remove("active");
            if (c.getAttribute("data-preset") === key) c.classList.add("active");
        });

        // Trigger smooth parameter morph transitions
        startMorph("speed", p.speed);
        startMorph("turbulence", p.turbulence);
        startMorph("flowOrganic", p.curl);
        startMorph("density", p.density);
        startMorph("dissipation", p.dissipation);
        startMorph("zoom", p.zoom);
        startMorph("baseSize", p.size);
        startMorph("sizeVariation", p.sizeVar);
        startMorph("stretch", p.stretch);
        startMorph("interaction", p.interaction);
        startMorph("rotationSpeed", p.rotationSpeed);
        startMorph("wobble", p.wobble);
        
        // Set colors and bg immediately
        sim.updatePalette([...p.colors]);
        if (sim3D) sim3D.updatePalette([...p.colors]);
        renderSwatches();

        // Apply custom flags for Psychedelic Drives if defined, else reset to default states
        const psychOn = p.psychedelicMode === true;
        sim.settings.psychedelicMode = psychOn;
        elements.psychedelicToggle.checked = psychOn;

        const morphBgOn = p.morphingBg === true;
        sim.settings.morphingBg = morphBgOn;
        elements.morphingBgToggle.checked = morphBgOn;

        const spinKaleidoOn = p.spinningKaleido === true;
        sim.settings.spinningKaleido = spinKaleidoOn;
        elements.spinningKaleidoToggle.checked = spinKaleidoOn;

        const shape = p.particleShape || "ellipse";
        sim.settings.particleShape = shape;
        elements.particleShapeSelect.value = shape;

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
                sim.palette.splice(idx, 1);
                sim.updatePalette([...sim.palette]);
                if (sim3D) sim3D.updatePalette([...sim.palette]);
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
    const optionModes = {};

    function isFlowEnabled(key) {
        if (!isAutopilot) return false;
        return optionModes[key] !== "manual";
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
        elements.autopilotToggle.checked = state;
        
        if (state) {
            elements.autopilotSettings.classList.remove("hidden");
            startAutopilotIntervals();
            showToast("Autopilot co-pilot engaged.");
        } else {
            elements.autopilotSettings.classList.add("hidden");
            stopAutopilotIntervals();
            showToast("Autopilot co-pilot disengaged.");
        }
    }

    function startAutopilotIntervals() {
        stopAutopilotIntervals();
        
        const patternInterval = parseInt(elements.autoPatternSlider.value) * 1000;
        const colorInterval = parseInt(elements.autoColorSlider.value) * 1000;
        
        // 1. Shift patterns by randomizing all sliders to their extreme possibilities
        autopilotTimer = setInterval(() => {
            randomizeAllParameters();
        }, patternInterval);

        // 2. Morph colors (if checked and set to FLOW)
        if (elements.autopilotColorToggle.checked) {
            autopilotColorTimer = setInterval(() => {
                if (isFlowEnabled("colors")) {
                    const palette = generateHarmoniousPalette();
                    sim.updatePalette(palette);
                    if (sim3D) sim3D.updatePalette(palette);
                    renderSwatches();
                    modulateSynth();
                }
            }, colorInterval);
        }
    }

    function stopAutopilotIntervals() {
        clearInterval(autopilotTimer);
        clearInterval(autopilotColorTimer);
    }

    function randomizeAllParameters() {
        const rnd = (min, max) => min + Math.random() * (max - min);
        const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
        
        // Randomize all available sliders over their absolute full ranges (matching HTML inputs)
        if (isFlowEnabled("speed")) startMorph("speed", rnd(0.1, 4.0));
        if (isFlowEnabled("turbulence")) startMorph("turbulence", rnd(0.0, 2.5));
        if (isFlowEnabled("density")) startMorph("density", rndInt(200, 4000));
        if (isFlowEnabled("flowOrganic")) startMorph("flowOrganic", rnd(0.0, 1.0));
        if (isFlowEnabled("dissipation")) startMorph("dissipation", rnd(0.002, 0.06));
        if (isFlowEnabled("zoom")) startMorph("zoom", rnd(0.3, 3.5));
        if (isFlowEnabled("baseSize")) startMorph("baseSize", rnd(0.5, 7.0));
        if (isFlowEnabled("sizeVariation")) startMorph("sizeVariation", rnd(0.0, 3.5));
        if (isFlowEnabled("stretch")) startMorph("stretch", rnd(0.0, 4.0));
        if (isFlowEnabled("interaction")) startMorph("interaction", rnd(0.0, 2.5));
        if (isFlowEnabled("mouseInfluence")) startMorph("mouseInfluence", rnd(0.0, 3.0));
        if (isFlowEnabled("rotationSpeed")) startMorph("rotationSpeed", rnd(0.0, 1.2));
        if (isFlowEnabled("wobble")) startMorph("wobble", rnd(0.0, 1.5));
        
        // Kaleidoscope Segments & Toggle
        const nextKaleidoEnabledFlow = isFlowEnabled("kaleidoscopeEnabled");
        const nextKaleidoSegmentsFlow = isFlowEnabled("kaleidoscopeSegments");
        
        let currentKaleidoEnabled = sim.settings.kaleidoscopeEnabled;
        if (nextKaleidoEnabledFlow) {
            currentKaleidoEnabled = Math.random() > 0.5;
            elements.kaleidoscopeToggle.checked = currentKaleidoEnabled;
            sim.settings.kaleidoscopeEnabled = currentKaleidoEnabled;
        }
        
        if (currentKaleidoEnabled) {
            elements.kaleidoscopeSettings.classList.remove("hidden");
            if (nextKaleidoSegmentsFlow) {
                startMorph("kaleidoscopeSegments", rndInt(3, 12));
            }
        } else {
            elements.kaleidoscopeSettings.classList.add("hidden");
        }
        
        // Drag physics morph
        startMorph("drag", rnd(0.85, 0.95));

        // Randomize Psychedelic drives in Autopilot
        if (isFlowEnabled("psychedelicMode")) {
            const psychOn = Math.random() > 0.75;
            sim.settings.psychedelicMode = psychOn;
            elements.psychedelicToggle.checked = psychOn;
        }

        if (isFlowEnabled("morphingBg")) {
            const morphBgOn = Math.random() > 0.75;
            sim.settings.morphingBg = morphBgOn;
            elements.morphingBgToggle.checked = morphBgOn;
        }

        if (isFlowEnabled("spinningKaleido")) {
            const spinKaleidoOn = Math.random() > 0.65;
            sim.settings.spinningKaleido = spinKaleidoOn;
            elements.spinningKaleidoToggle.checked = spinKaleidoOn;
        }

        if (isFlowEnabled("particleShape")) {
            const shapes = ["ellipse", "drop", "ring"];
            const randVal = Math.random();
            const shapeChosen = randVal < 0.75 ? "ellipse" : (randVal < 0.90 ? "drop" : "ring");
            sim.settings.particleShape = shapeChosen;
            elements.particleShapeSelect.value = shapeChosen;
        }

        // Clear active presets selected cards
        document.querySelectorAll(".preset-card").forEach(c => c.classList.remove("active"));
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
            if (!sim3D) {
                CosmicLogger.info("Initializing 3D WebGL Simulation Engine using Three.js...");
                sim3D = new FlowSimulation3D("webgl-canvas");
                window.addEventListener("resize", () => {
                    if (sim3D) sim3D.resize();
                });
            }
            
            sim3D.settings = sim.settings;
            sim3D.updatePalette([...sim.palette]);
            
            elements.canvas2D.classList.add("hidden");
            elements.webglCanvas.classList.remove("hidden");
            
            elements.webgl3DToggleBtn.classList.add("highlight");
            elements.hudMode.textContent = "3D FLOW";
            
            if (navigator.xr) {
                navigator.xr.isSessionSupported('immersive-vr').then(supported => {
                    if (supported && elements.enterVrBtn) {
                        elements.enterVrBtn.classList.remove("hide");
                        CosmicLogger.info("WebGL 3D Mode loaded. VR Headset detected. Enter VR enabled.");
                    }
                });
            }
            
            showToast("WebGL 3D visualizer active! 🌌");
            CosmicLogger.info("Switched simulation engine from 2D Canvas to 3D WebGL projection.");
            
            // Sync current synth settings to WebGL rendering loops
            sim3D.renderer.setAnimationLoop(() => {
                if (is3DMode) {
                    processMusicReactivity();
                    processMorphs();
                    sim3D.tick();
                    
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsTime >= 500) {
                        const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
                        elements.hudFps.textContent = fps;
                        elements.hudParticles.textContent = sim3D.particleCount;
                        
                        if (fps < 32) {
                            window.lowFpsTicks = (window.lowFpsTicks || 0) + 1;
                            if (window.lowFpsTicks === 3) {
                                CosmicLogger.warn(`Low FPS Warning: WebGL 3D rendering at ${fps} FPS. Try lowering flow speed.`);
                            }
                        } else {
                            window.lowFpsTicks = 0;
                        }
                        
                        frameCount = 0;
                        lastFpsTime = now;
                    }
                    
                    updateHudWaveform();
                }
            });
            
        } else {
            if (sim3D) {
                sim3D.renderer.setAnimationLoop(null);
            }
            
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

    // Update floating HUD waveform visualizer bar scales
    function updateHudWaveform() {
        const visualData = window.CosmicSynth.getVisualizerData();
        const bars = elements.hudVisualizer.querySelectorAll(".visualizer-bar");
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
            });
        }
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
        elements.autopilotColorToggle.onchange = () => {
            if (isAutopilot) startAutopilotIntervals();
        };
        elements.autoPatternSlider.oninput = () => {
            elements.autoPatternVal.textContent = `${elements.autoPatternSlider.value}s`;
            if (isAutopilot) startAutopilotIntervals();
        };
        elements.autoColorSlider.oninput = () => {
            elements.autoColorVal.textContent = `${elements.autoColorSlider.value}s`;
            if (isAutopilot) startAutopilotIntervals();
        };
        elements.resetAllFlowBtn.onclick = () => {
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
            const palette = generateHarmoniousPalette();
            sim.updatePalette(palette);
            if (sim3D) sim3D.updatePalette(palette);
            renderSwatches();
            modulateSynth();
            showToast("Harmonious palette generated.");
        };
        elements.particleColorPicker.oninput = () => {
            elements.pickerHexVal.textContent = elements.particleColorPicker.value.toUpperCase();
        };
        elements.addColorBtn.onclick = () => {
            setOptionToManual("colors");
            if (sim.palette.length >= 6) {
                sim.palette.shift(); // remove oldest
            }
            sim.palette.push(elements.particleColorPicker.value);
            sim.updatePalette([...sim.palette]);
            if (sim3D) sim3D.updatePalette([...sim.palette]);
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
        elements.solidModeToggle.onchange = () => {
            sim.isSolidMode = elements.solidModeToggle.checked;
            elements.hudMode.textContent = sim.isSolidMode ? "SOLID" : "FLOW";
        };

        // Bind Sliders to settings parameters
        const bindSlider = (slider, valText, settingKey, isDensity = false) => {
            slider.oninput = () => {
                const v = parseFloat(slider.value);
                sim.settings[settingKey] = v;
                
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
            sim.settings.psychedelicMode = elements.psychedelicToggle.checked;
        };
        elements.morphingBgToggle.onchange = () => {
            sim.settings.morphingBg = elements.morphingBgToggle.checked;
        };
        elements.spinningKaleidoToggle.onchange = () => {
            sim.settings.spinningKaleido = elements.spinningKaleidoToggle.checked;
        };
        elements.shockwavesToggle.onchange = () => {
            sim.settings.shockwavesEnabled = elements.shockwavesToggle.checked;
        };
        elements.particleShapeSelect.onchange = () => {
            sim.settings.particleShape = elements.particleShapeSelect.value;
        };

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

        elements.asmrVolumeSlider.oninput = () => {
            const val = parseInt(elements.asmrVolumeSlider.value) / 100;
            elements.asmrVolumeVal.textContent = `${elements.asmrVolumeSlider.value}%`;
            window.CosmicSynth.setAsmrVolume(val);
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
                        
                        if (synth.isMuted) toggleAudio(true);
                    }
                }
            } catch (err) {
                showToast("Microphone permission denied");
                CosmicLogger.error("Microphone device capture access denied by user/browser.");
            } finally {
                elements.micReactBtn.textContent = "🎙️ Mic";
            }
        };

        elements.systemReactBtn.onclick = async () => {
            const synth = window.CosmicSynth;
            const currentMode = synth.visualizerMode;
            
            try {
                if (currentMode === "system") {
                    synth.stopMusicReactivity();
                    clearVisualizerHighlights();
                    elements.visualizerStatus.style.display = "none";
                    showToast("Device audio visualizer disabled");
                    CosmicLogger.info("Device audio reactivity visualizer disabled.");
                } else {
                    elements.systemReactBtn.textContent = "💻 Capturing...";
                    const success = await synth.toggleSystemAudioReactivity();
                    if (success) {
                        clearVisualizerHighlights();
                        elements.systemReactBtn.classList.add("highlight");
                        elements.visualizerStatus.textContent = "Status: Device Audio Active 💻";
                        elements.visualizerStatus.style.display = "block";
                        showToast("Device audio capture active! Play Spotify/sounds now.");
                        CosmicLogger.info("Device audio stream capture active. Internal ambient chimes auto-muted.");
                        
                        if (synth.isMuted) toggleAudio(true);
                    }
                }
            } catch (err) {
                showToast(err.message || "Device audio sharing cancelled");
                CosmicLogger.warn("Device audio stream capture cancelled or failed: " + err.message);
            } finally {
                elements.systemReactBtn.textContent = "💻 Device Audio";
            }
        };

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

        // Splash screen dismissal & audio pre-unlock gesture
        if (elements.splashScreen) {
            elements.splashScreen.onclick = () => {
                elements.splashScreen.classList.add("fade-out");
                
                // Pre-initialize Cosmic Synth AudioContext on first user click gesture
                window.CosmicSynth.init();
                
                // Display the excited New Features modal overlay
                const featuresModal = document.getElementById("new-features-modal");
                if (featuresModal) {
                    featuresModal.classList.remove("hidden");
                }
            };
        }

        // New Features Modal dismissal actions
        const dismissFeatures = () => {
            const el = document.getElementById("new-features-modal");
            if (el) el.classList.add("hidden");
        };
        
        const featuresCloseBtn = document.getElementById("features-close-btn");
        if (featuresCloseBtn) featuresCloseBtn.onclick = dismissFeatures;
        
        const featuresDismissBtn = document.getElementById("features-dismiss-btn");
        if (featuresDismissBtn) featuresDismissBtn.onclick = dismissFeatures;
        
        const featuresModalEl = document.getElementById("new-features-modal");
        if (featuresModalEl) {
            featuresModalEl.onclick = (e) => {
                if (e.target === featuresModalEl) dismissFeatures();
            };
        }

        // Window resize
        window.addEventListener("resize", () => {
            sim.resize(window.innerWidth, window.innerHeight);
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
            return { x: clientX, y: clientY };
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
        sim.palette = [...data.palette];
        sim.backgroundColor = data.backgroundColor;
        elements.bgColorPicker.value = data.backgroundColor;
        elements.bgHexVal.textContent = data.backgroundColor.toUpperCase();
        document.getElementById("ambient-glow").style.background = 
            `radial-gradient(circle, ${sim.backgroundColor}88 0%, transparent 70%)`;
            
        sim.isSolidMode = data.isSolidMode;
        elements.solidModeToggle.checked = data.isSolidMode;
        elements.hudMode.textContent = sim.isSolidMode ? "SOLID" : "FLOW";
        
        toggleAutopilot(data.autopilotEnabled);
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
    let baseSettings = null;
    let basePalette = null;
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
        
        // Dynamic Canvas scale screen bounce (subtle punch up to 1.035x)
        const scaleAmount = 1.0 + Math.min(0.035, sizePulse * 0.03);
        const canvasEl = document.getElementById("canvas");
        if (canvasEl) {
            canvasEl.style.transform = `scale(${scaleAmount})`;
        }
        const webglCanvasEl = document.getElementById("webgl-canvas");
        if (webglCanvasEl) {
            webglCanvasEl.style.transform = `scale(${scaleAmount})`;
        }
        
        // Dynamic Ambient Glow pulse
        const glowSize = 70 + Math.min(25, sizePulse * 22);
        const glowOpacity = 0.5 + Math.min(0.5, sizePulse * 0.4);
        const ambientGlowEl = document.getElementById("ambient-glow");
        if (ambientGlowEl) {
            ambientGlowEl.style.background = `radial-gradient(circle, ${sim.backgroundColor}dd 0%, transparent ${glowSize}%)`;
            ambientGlowEl.style.opacity = glowOpacity;
        }
        
        // Feed Treble pulse to settings to drive particle sparkles
        sim.settings.trebleIntensity = speedPulse;
        if (is3DMode && sim3D) {
            sim3D.sizePulse = sizePulse;
            sim3D.trebleIntensity = speedPulse;
        }
        
        // Bass Modulations (Particle Size & Dissipation)
        if (elements.pulseBassToggle.checked) {
            // Pulse particle base size (cap size swelling at a clean 3.5x max for visible punch)
            const sizeMod = 1.0 + Math.min(2.5, sizePulse);
            sim.settings.baseSize = baseSettings.baseSize * sizeMod;
            
            // Temporarily decrease dissipation to make flow trails glow on attacks
            const dissMod = Math.max(0.004, baseSettings.dissipation - Math.min(0.04, sizePulse * 0.05));
            sim.settings.dissipation = dissMod;
            
            // Trigger physical starbursts & explosions ONLY on hard transient attacks (not sustained drones)
            if (bassAttack > 0.12 && now - lastShockwaveTime > 380) {
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;
                
                if (is3DMode && sim3D) {
                    sim3D.triggerBurst(0, 0, 45);
                    sim3D.triggerVortex(0, 0, 280, 18.0, 50);
                    sim3D.triggerShockwave(0, 0, 60.0, 11.0);
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
                const palette = generateHarmoniousPalette();
                basePalette = [...palette]; // update base palette references
                sim.updatePalette(palette);
                if (sim3D) sim3D.updatePalette(palette);
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
            sim.settings.speed = baseSettings.speed * (1.0 + Math.min(2.5, speedPulse));
            sim.settings.turbulence = baseSettings.turbulence * (1.0 + Math.min(2.0, turbPulse));
            
            // Quick wobble and stretch pulses
            sim.settings.wobble = baseSettings.wobble + Math.min(6.0, wobblePulse);
            sim.settings.stretch = baseSettings.stretch + Math.min(7.0, stretchPulse);
            sim.settings.rotationSpeed = baseSettings.rotationSpeed + (speedPulse * 0.08);
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

    // Boot
    initialize();
});
