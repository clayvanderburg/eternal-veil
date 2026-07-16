// ============================================================================
// ETERNAL VEIL - NATIVE 3D / WEBXR PARTICLE FLOW PROTOTYPE
// GPU-driven volumetric particles, luminous multi-segment trails, music pulses,
// vortex/shockwave events, desktop orbit interaction, and WebXR controllers.
// This renderer intentionally does not depend on the hidden 2D flow texture.
// ============================================================================

class NativeFlowSimulation3D {
    constructor(canvasId) {
        if (!window.THREE) throw new Error("Three.js is required for Native 3D mode.");

        this.canvas = document.getElementById(canvasId);
        this.usesFlowTexture = false;
        this.texture = null;
        this.settings = null;
        this.sizePulse = 0;
        this.trebleIntensity = 0;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        if (this.renderer.xr.setReferenceSpaceType) {
            this.renderer.xr.setReferenceSpaceType("local-floor");
        }
        if (THREE.ACESFilmicToneMapping !== undefined) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.96;
        }
        if (THREE.sRGBEncoding !== undefined) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#020207");
        this.scene.fog = new THREE.FogExp2("#020207", 0.00115);

        this.camera = new THREE.PerspectiveCamera(
            72,
            window.innerWidth / window.innerHeight,
            0.1,
            1800
        );
        this.camera.position.set(0, 0, 4);

        this.world = new THREE.Group();
        this.scene.add(this.world);

        this.maxParticles = 14000;
        // Dense enough that the glow samples overlap into a continuous comet tail
        // instead of reading as a string of separate pearls.
        this.trailSegments = 52;
        this.activeParticles = 5600;
        this.palette = ["#6366f1", "#a855f7", "#06b6d4", "#f472b6"];

        this.clock = new THREE.Clock();
        this.elapsed = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.isPointerDown = false;
        this.pointerMoved = false;
        this.pointerX = 0;
        this.pointerY = 0;

        this.burstStrength = 0;
        this.vortexStrength = 0;
        this.shockStrength = 0;
        this.shockRadius = 0;
        this.xrControllers = [];
        this.isPaused = false;
        this.vrPanelGroup = null;
        this.vrPanelMesh = null;
        this.vrPanelCanvas = null;
        this.vrPanelTexture = null;
        this.vrPanelButtons = [];
        this.vrPanelHoverAction = null;
        this.vrPanelPage = "main";
        this.vrPanelStateHash = "";
        this.vrPanelRefreshAt = 0;
        this.xrRaycaster = new THREE.Raycaster();
        this.xrRayRotation = new THREE.Matrix4();

        this.sharedUniforms = this.createSharedUniforms();
        this.initParticleField();
        this.initNebulaClouds();
        this.initDeepStars();
        this.initInteraction();

        window.nativeSim3DInstance = this;
    }

    useBoundedGlowBlending(material) {
        // Screen-style blending keeps luminous overlaps bright, but unlike pure
        // additive blending it asymptotically approaches white instead of piling
        // unlimited energy into a blinding, featureless hotspot. It is also
        // order-independent, which is important for unsorted 3D particles.
        material.blending = THREE.CustomBlending;
        material.blendEquation = THREE.AddEquation;
        material.blendSrc = THREE.OneFactor;
        material.blendDst = THREE.OneMinusSrcColorFactor;
        material.blendEquationAlpha = THREE.AddEquation;
        material.blendSrcAlpha = THREE.OneFactor;
        material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
        return material;
    }

    getVRControlState() {
        if (typeof window.onNativeVRControl === "function") {
            return window.onNativeVRControl("getState") || {};
        }
        const s = this.settings || {};
        return {
            autopilot: true,
            paused: this.isPaused,
            size: s.baseSize ?? 2.8,
            speed: s.speed ?? 1,
            density: s.density ?? 1200
        };
    }

    initVRPanel() {
        if (this.vrPanelGroup) {
            this.vrPanelGroup.visible = true;
            this.drawVRPanel();
            return;
        }

        this.vrPanelCanvas = document.createElement("canvas");
        this.vrPanelCanvas.width = 1024;
        this.vrPanelCanvas.height = 1024;
        this.vrPanelTexture = new THREE.CanvasTexture(this.vrPanelCanvas);
        this.vrPanelTexture.minFilter = THREE.LinearFilter;
        this.vrPanelTexture.magFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(0.92, 0.92);
        const material = new THREE.MeshBasicMaterial({
            map: this.vrPanelTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        this.vrPanelMesh = new THREE.Mesh(geometry, material);
        this.vrPanelMesh.renderOrder = 1000;

        this.vrPanelGroup = new THREE.Group();
        this.vrPanelGroup.position.set(-0.58, 1.42, -1.48);
        this.vrPanelGroup.add(this.vrPanelMesh);
        this.vrPanelGroup.lookAt(0, 1.42, 0);
        this.scene.add(this.vrPanelGroup);

        this.vrPanelButtons = [
            { page: "main", action: "togglePause", x: 56, y: 145, w: 438, h: 88 },
            { page: "main", action: "toggleAutopilot", x: 530, y: 145, w: 438, h: 88 },
            { page: "main", action: "historyBack", x: 56, y: 255, w: 280, h: 82 },
            { page: "main", action: "randomFlow", x: 372, y: 255, w: 280, h: 82 },
            { page: "main", action: "historyForward", x: 688, y: 255, w: 280, h: 82 },
            { page: "main", action: "sizeDown", x: 700, y: 365, w: 120, h: 84 },
            { page: "main", action: "sizeUp", x: 848, y: 365, w: 120, h: 84 },
            { page: "main", action: "speedDown", x: 700, y: 475, w: 120, h: 84 },
            { page: "main", action: "speedUp", x: 848, y: 475, w: 120, h: 84 },
            { page: "main", action: "densityDown", x: 700, y: 585, w: 120, h: 84 },
            { page: "main", action: "densityUp", x: 848, y: 585, w: 120, h: 84 },
            { page: "main", action: "pageLooks", x: 56, y: 700, w: 912, h: 82 },
            { page: "main", action: "hideMenu", x: 56, y: 798, w: 912, h: 82 },
            { page: "main", action: "exitToSettings", x: 56, y: 898, w: 912, h: 82 },
            { page: "looks", action: "pageMainTop", x: 56, y: 145, w: 912, h: 82 },
            { page: "looks", action: "palettePrev", x: 56, y: 260, w: 280, h: 86 },
            { page: "looks", action: "randomPalette", x: 372, y: 260, w: 280, h: 86 },
            { page: "looks", action: "paletteNext", x: 688, y: 260, w: 280, h: 86 },
            { page: "looks", action: "effectPrev", x: 56, y: 470, w: 438, h: 86 },
            { page: "looks", action: "effectNext", x: 530, y: 470, w: 438, h: 86 },
            { page: "looks", action: "cycleLighting", x: 56, y: 590, w: 912, h: 86 },
            { page: "looks", action: "gentleRipple", x: 56, y: 700, w: 912, h: 86 },
            { page: "looks", action: "hideMenu", x: 56, y: 806, w: 438, h: 76 },
            { page: "looks", action: "exitToSettings", x: 530, y: 806, w: 438, h: 76 },
            { page: "looks", action: "pageMain", x: 56, y: 898, w: 912, h: 82 }
        ];
        this.drawVRPanel();
    }

    drawVRPanel(hoverAction = this.vrPanelHoverAction) {
        if (!this.vrPanelCanvas || !this.vrPanelTexture) return;
        const ctx = this.vrPanelCanvas.getContext("2d");
        const state = this.getVRControlState();
        const roundedRect = (x, y, w, h, radius) => {
            const r = Math.min(radius, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        };
        const button = (rect, label, accent = "#60a5fa", disabled = false) => {
            if (!rect) return;
            const hovered = hoverAction === rect.action && !disabled;
            ctx.fillStyle = disabled
                ? "rgba(20, 26, 42, 0.74)"
                : (hovered ? accent : "rgba(25, 33, 57, 0.96)");
            ctx.strokeStyle = disabled ? "#475569" : (hovered ? "#ffffff" : accent);
            ctx.lineWidth = hovered ? 5 : 3;
            roundedRect(rect.x, rect.y, rect.w, rect.h, 22);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = disabled ? "#64748b" : (hovered ? "#07101f" : "#f8fafc");
            ctx.font = "700 31px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
        };

        ctx.clearRect(0, 0, 1024, 1024);
        ctx.fillStyle = "rgba(3, 7, 18, 0.94)";
        roundedRect(12, 12, 1000, 1000, 38);
        ctx.fill();
        ctx.strokeStyle = "rgba(103, 232, 249, 0.72)";
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#e0f2fe";
        ctx.font = "800 42px system-ui, sans-serif";
        ctx.fillText("ETERNAL VEIL  //  VR", 58, 70);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 23px system-ui, sans-serif";
        ctx.fillText("Aim + trigger to select  /  Grip hides or shows this menu", 58, 116);

        const findButton = action => this.vrPanelButtons.find(
            b => b.page === this.vrPanelPage && b.action === action
        );

        const drawSettingRow = (y, label, value, downAction, upAction) => {
            ctx.fillStyle = "#cbd5e1";
            ctx.font = "650 31px system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(label, 66, y + 38);
            ctx.fillStyle = "#67e8f9";
            ctx.font = "800 39px system-ui, sans-serif";
            ctx.fillText(value, 360, y + 39);
            button(findButton(downAction), "-", "#38bdf8");
            button(findButton(upAction), "+", "#38bdf8");
        };

        if (this.vrPanelPage === "looks") {
            button(findButton("pageMainTop"), "<  MAIN CONTROLS", "#64748b");
            button(findButton("palettePrev"), "< PALETTE", "#22d3ee");
            button(findButton("randomPalette"), "RANDOM COLOR", "#c084fc");
            button(findButton("paletteNext"), "PALETTE >", "#22d3ee");

            ctx.fillStyle = "#94a3b8";
            ctx.font = "650 25px system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(state.paletteName || "CURRENT PALETTE", 58, 395);
            const palette = Array.isArray(state.palette) ? state.palette.slice(0, 6) : [];
            palette.forEach((color, index) => {
                ctx.beginPath();
                ctx.arc(475 + index * 72, 386, 24, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.65)";
                ctx.lineWidth = 3;
                ctx.stroke();
            });

            button(findButton("effectPrev"), "< EFFECT", "#60a5fa");
            button(findButton("effectNext"), "EFFECT >", "#60a5fa");
            ctx.fillStyle = "#e0f2fe";
            ctx.font = "700 27px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(state.effectName || "Custom Flow", 512, 575);
            button(findButton("cycleLighting"), `LIGHTING  /  ${(state.lighting || "glow").toUpperCase()}`, "#fbbf24");
            button(findButton("gentleRipple"), "SEND A GENTLE RIPPLE", "#34d399");
            button(findButton("hideMenu"), "HIDE MENU", "#64748b");
            button(findButton("exitToSettings"), "EXIT VR", "#fb7185");
            button(findButton("pageMain"), "<  MAIN CONTROLS", "#64748b");
        } else {
            button(findButton("togglePause"), state.paused ? "RESUME" : "PAUSE", "#a78bfa");
            button(
                findButton("toggleAutopilot"),
                `AUTOPILOT  ${state.autopilot ? "ON" : "OFF"}`,
                state.autopilot ? "#34d399" : "#64748b"
            );
            button(findButton("historyBack"), "< LAST", "#60a5fa", !state.historyCanBack);
            button(findButton("randomFlow"), "RANDOM FLOW", "#c084fc");
            button(findButton("historyForward"), "NEXT >", "#60a5fa", !state.historyCanForward);
            drawSettingRow(365, "PARTICLE SIZE", Number(state.size || 0).toFixed(1), "sizeDown", "sizeUp");
            drawSettingRow(475, "FLOW SPEED", Number(state.speed || 0).toFixed(2), "speedDown", "speedUp");
            drawSettingRow(585, "PARTICLES", String(Math.round(state.density || 0)), "densityDown", "densityUp");
            button(findButton("pageLooks"), "COLORS + EFFECTS  >", "#22d3ee");
            button(findButton("hideMenu"), "HIDE MENU  /  GRIP TO REOPEN", "#64748b");
            button(findButton("exitToSettings"), "EXIT VR  >  2D SETTINGS", "#fb7185");
        }

        this.vrPanelTexture.needsUpdate = true;
        this.vrPanelStateHash = JSON.stringify(state);
    }

    setVRPanelVisible(visible) {
        if (!this.vrPanelGroup) this.initVRPanel();
        this.vrPanelGroup.visible = visible;
        this.vrPanelHoverAction = null;
        if (visible) this.drawVRPanel();
    }

    getVRPanelHit(controller) {
        if (!this.vrPanelMesh || !this.vrPanelGroup.visible) return null;
        controller.updateMatrixWorld(true);
        this.xrRayRotation.identity().extractRotation(controller.matrixWorld);
        this.xrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.xrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.xrRayRotation).normalize();
        const intersection = this.xrRaycaster.intersectObject(this.vrPanelMesh, false)[0];
        if (!intersection || !intersection.uv) return null;
        const x = intersection.uv.x * this.vrPanelCanvas.width;
        const y = (1 - intersection.uv.y) * this.vrPanelCanvas.height;
        const control = this.vrPanelButtons.find(b =>
            b.page === this.vrPanelPage &&
            x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
        );
        return control ? { action: control.action, distance: intersection.distance } : null;
    }

    updateVRPanelInteraction() {
        if (!this.vrPanelGroup || !this.vrPanelGroup.visible) return;
        let nextHover = null;
        for (const controller of this.xrControllers) {
            const hit = this.getVRPanelHit(controller);
            controller.userData.vrPanelHit = hit;
            const ray = controller.userData.pointerRay;
            if (ray) {
                ray.scale.z = hit ? Math.max(0.15, hit.distance) : 18;
                ray.material.opacity = hit ? 1 : 0.72;
            }
            if (!nextHover && hit) nextHover = hit.action;
        }

        const now = this.elapsed;
        const stateHash = JSON.stringify(this.getVRControlState());
        if (nextHover !== this.vrPanelHoverAction || stateHash !== this.vrPanelStateHash || now >= this.vrPanelRefreshAt) {
            this.vrPanelHoverAction = nextHover;
            this.vrPanelRefreshAt = now + 0.5;
            this.drawVRPanel(nextHover);
        }
    }

    activateVRControl(action) {
        if (!action) return false;
        if (action === "hideMenu") {
            this.setVRPanelVisible(false);
            return true;
        }
        if (action === "exitToSettings") {
            const session = this.renderer.xr.getSession ? this.renderer.xr.getSession() : null;
            if (session) session.end();
            return true;
        }
        if (action === "pageLooks" || action === "pageMain" || action === "pageMainTop") {
            this.vrPanelPage = action === "pageLooks" ? "looks" : "main";
            this.vrPanelHoverAction = null;
            this.drawVRPanel();
            return true;
        }
        if (action === "gentleRipple") {
            this.triggerGentleRipple();
            this.drawVRPanel(action);
            return true;
        }
        if (typeof window.onNativeVRControl === "function") {
            window.onNativeVRControl(action);
            const state = this.getVRControlState();
            this.isPaused = Boolean(state.paused);
            this.drawVRPanel(action);
            return true;
        }
        return false;
    }

    createSharedUniforms() {
        const colors = new Array(6).fill(0).map((_, i) =>
            new THREE.Color(this.palette[i % this.palette.length])
        );
        return {
            uTime: { value: 0 },
            uSpeed: { value: 0.75 },
            uTurbulence: { value: 0.8 },
            uOrganic: { value: 0.85 },
            uVolumeRadius: { value: 250 },
            uDepth: { value: 1000 },
            uTrailLength: { value: 0.72 },
            uPointSize: { value: 9.5 },
            uBass: { value: 0 },
            uTreble: { value: 0 },
            uBurst: { value: 0 },
            uVortex: { value: 0 },
            uShock: { value: 0 },
            uShockRadius: { value: 0 },
            uGlowEnergy: { value: 0.78 },
            uEffectMode: { value: 0 },
            uLightingStyle: { value: 0 },
            uPalette: { value: colors }
        };
    }

    createFlowVertexShader(isTrail) {
        return `
            precision highp float;

            attribute vec3 aSeed;
            attribute float aPhase;
            attribute float aPaletteIndex;
            attribute float aScale;
            attribute float aHero;
            ${isTrail ? "attribute float aTrail;" : ""}

            uniform float uTime;
            uniform float uSpeed;
            uniform float uTurbulence;
            uniform float uOrganic;
            uniform float uVolumeRadius;
            uniform float uDepth;
            uniform float uTrailLength;
            uniform float uPointSize;
            ${isTrail ? "uniform float uTrailWidthScale;" : ""}
            uniform float uBass;
            uniform float uTreble;
            uniform float uBurst;
            uniform float uVortex;
            uniform float uShock;
            uniform float uShockRadius;
            uniform float uEffectMode;
            uniform vec3 uPalette[6];

            varying vec3 vColor;
            varying float vAlpha;
            varying float vTrailAmount;
            varying float vRenderedSize;
            varying float vEffectClass;

            const float PI = 3.141592653589793;

            float hash21(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            vec3 paletteColor(float indexValue) {
                vec3 c = uPalette[0];
                c = mix(c, uPalette[1], step(0.5, indexValue));
                c = mix(c, uPalette[2], step(1.5, indexValue));
                c = mix(c, uPalette[3], step(2.5, indexValue));
                c = mix(c, uPalette[4], step(3.5, indexValue));
                c = mix(c, uPalette[5], step(4.5, indexValue));
                // Lift dark palettes into emissive VR space without destroying hue.
                return pow(max(c, vec3(0.001)), vec3(0.62));
            }

            vec3 flowPosition(float trailAmount) {
                float t = uTime * (0.24 + uSpeed * 0.18) - trailAmount * uTrailLength;
                float lane = aPhase * PI * 2.0;
                float role = hash21(aSeed.xy + vec2(aPhase, aSeed.z));
                float seededZ = aSeed.z * uDepth * 0.5;
                vec3 result = vec3(0.0);

                // Authored modes keep the motion spatial while giving the eye a
                // recognizable composition. Trail samples use the same time offset,
                // so every streak remains a continuous path instead of a pearl chain.
                if (uEffectMode > 0.5 && uEffectMode < 1.5) {
                    // Rain Ocean: layered lower-half waves, vertical rain, and a
                    // handful of huge moons/suns in the open sky.
                    if (role < 0.70) {
                        float waveLane = floor(aPhase * 7.0);
                        float span = uVolumeRadius * 2.65;
                        float x = mod((aSeed.x * 0.5 + 0.5) * span + t * 58.0 + span, span) - span * 0.5;
                        float swell = sin(x * 0.024 + t * 0.92 + aSeed.y * 6.0);
                        float crossSwell = sin(x * 0.011 - t * 0.38 + waveLane * 1.7);
                        float y = -58.0 - waveLane * 16.0 + swell * (9.0 + waveLane * 1.9) + crossSwell * 4.5;
                        result = vec3(x, y, seededZ * 0.64 + waveLane * 11.0);
                    } else if (role < 0.995) {
                        float rainSpan = 390.0;
                        float y = mod((aSeed.y * 0.5 + 0.5) * rainSpan - t * 108.0 + rainSpan, rainSpan) - rainSpan * 0.5;
                        result = vec3(aSeed.x * uVolumeRadius * 1.12, y, seededZ * 0.72);
                    } else {
                        result = vec3(
                            aSeed.x * uVolumeRadius * 0.76 + sin(t * 0.08 + lane) * 18.0,
                            82.0 + abs(aSeed.y) * 105.0,
                            seededZ * 0.36
                        );
                    }
                } else if (uEffectMode > 1.5 && uEffectMode < 2.5) {
                    // Aurora Cathedral: deep, slowly breathing curtains rather than
                    // an unstructured particle cloud.
                    float column = floor(aPhase * 9.0);
                    float ySpan = 430.0;
                    float y = mod((aSeed.y * 0.5 + 0.5) * ySpan + t * 17.0 + ySpan, ySpan) - ySpan * 0.5;
                    float x = aSeed.x * uVolumeRadius * 0.94
                        + sin(y * 0.014 + t * 0.34 + column) * (22.0 + 8.0 * abs(aSeed.z));
                    float z = seededZ * 0.62 + sin(x * 0.013 - t * 0.22 + column * 0.8) * 46.0;
                    result = vec3(x, y, z);
                } else if (uEffectMode > 2.5 && uEffectMode < 3.5) {
                    // Celestial Orrery: nested orbital planes make the different
                    // streams legible from almost any headset viewing direction.
                    float ring = 38.0 + (aSeed.x * 0.5 + 0.5) * uVolumeRadius * 0.84;
                    float orbit = lane + t * (0.20 + abs(aSeed.y) * 0.16);
                    float tilt = aSeed.z * 0.48;
                    vec3 p = vec3(cos(orbit) * ring, sin(orbit) * ring * 0.72, sin(orbit * 2.0) * 28.0);
                    float ct = cos(tilt);
                    float st = sin(tilt);
                    p.yz = mat2(ct, -st, st, ct) * p.yz;
                    p.z += aSeed.z * 115.0;
                    result = p;
                } else if (uEffectMode > 3.5) {
                    // Lotus Pulse: ten petal lanes open and close around a softly
                    // breathing center, with real depth between the layers.
                    float petal = floor(aPhase * 10.0);
                    float baseAngle = petal * (PI * 2.0 / 10.0);
                    float breath = 0.86 + 0.14 * sin(t * 0.25 + aSeed.y * 5.0);
                    float radial = (28.0 + (aSeed.x * 0.5 + 0.5) * uVolumeRadius * 0.78) * breath;
                    float angle = baseAngle + aSeed.y * 0.19 + sin(t * 0.14) * 0.06;
                    result = vec3(
                        cos(angle) * radial,
                        sin(angle) * radial,
                        seededZ * 0.23 + sin(radial * 0.042 + t * 0.31 + petal) * 28.0
                    );
                } else {
                    // A small subset passes very close to the viewer for genuine depth/fly-bys.
                float seedRadius = 0.035 + pow(abs(aSeed.x), 1.08) * 0.965;
                float radius = uVolumeRadius * seedRadius;

                // Forward-moving tunnel depth with deterministic wrapping.
                float rawZ = (aSeed.z * 0.5 + 0.5) * uDepth + t * (42.0 + 36.0 * uSpeed);
                float z = mod(rawZ + uDepth * 0.5, uDepth) - uDepth * 0.5;

                // Nested helical lanes create real spatial streams around the viewer.
                float swirl = lane
                    + z * (0.007 + 0.006 * uTurbulence)
                    + t * (0.36 + abs(aSeed.y) * 0.25)
                    + sin(t * 0.41 + aSeed.z * 9.0) * uOrganic;

                vec3 p = vec3(
                    cos(swirl) * radius,
                    sin(swirl) * radius * (0.62 + abs(aSeed.y) * 0.72),
                    z
                );

                // Curl-like spatial warping retains the character of the 2D flow field.
                p.x += sin(p.y * 0.018 + t * 0.83 + aSeed.z * 7.0)
                    * (18.0 + 34.0 * uTurbulence);
                p.y += cos(p.x * 0.016 - t * 0.67 + aSeed.x * 8.0)
                    * (16.0 + 30.0 * uTurbulence);
                p.z += sin((p.x + p.y) * 0.012 + t * 0.72 + aSeed.y * 6.0)
                    * 30.0 * uOrganic;

                // Beat vortex twists the whole volume without moving the camera.
                float vortexAngle = uVortex * (0.7 + 0.45 * sin(z * 0.012 + lane));
                float cs = cos(vortexAngle);
                float sn = sin(vortexAngle);
                p.xy = mat2(cs, -sn, sn, cs) * p.xy;

                // Bass burst pushes lanes outward in genuine 3D.
                vec3 burstDir = normalize(vec3(aSeed.xy, aSeed.z * 0.45) + vec3(0.001));
                p += burstDir * uBurst * (45.0 + 25.0 * aScale);

                // Spherical shock shell creates a traveling depth wave.
                float distFromCenter = length(p);
                float shell = exp(-abs(distFromCenter - uShockRadius) * 0.022);
                p += normalize(p + vec3(0.001)) * shell * uShock * 55.0;

                    result = p;
                }

                return result;
            }

            void main() {
                ${isTrail ? "float trailAmount = aTrail;" : "float trailAmount = 0.0;"}
                vec3 p = flowPosition(trailAmount);
                vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

                float distanceFade = smoothstep(1050.0, 80.0, length(mvPosition.xyz));
                float nearFade = smoothstep(2.0, 18.0, abs(mvPosition.z));
                // Fade both ends of the wrapping tunnel. This prevents a trail segment
                // from drawing a giant line across the scene when its endpoints wrap.
                float wrapFade = smoothstep(0.0, 54.0, uDepth * 0.5 - abs(p.z));
                vAlpha = distanceFade * nearFade * wrapFade;
                if (uEffectMode > 0.5) vAlpha = distanceFade * nearFade;
                vTrailAmount = trailAmount;
                vColor = paletteColor(aPaletteIndex);
                float effectRole = hash21(aSeed.xy + vec2(aPhase, aSeed.z));
                vEffectClass = 0.0;
                if (uEffectMode > 0.5 && uEffectMode < 1.5) {
                    vEffectClass = effectRole < 0.70 ? 0.5 : (effectRole < 0.995 ? 1.0 : 2.0);
                } else if (uEffectMode > 1.5 && uEffectMode < 2.5) {
                    vEffectClass = 3.0;
                } else if (uEffectMode > 2.5 && uEffectMode < 3.5) {
                    vEffectClass = effectRole > 0.992 ? 2.0 : 4.0;
                } else if (uEffectMode > 3.5) {
                    vEffectClass = effectRole > 0.994 ? 2.0 : 5.0;
                }

                float effectScale = 1.0;
                if (vEffectClass > 0.4 && vEffectClass < 0.8) effectScale = 1.24;
                if (vEffectClass > 0.8 && vEffectClass < 1.2) effectScale = 0.28;
                if (vEffectClass > 1.8 && vEffectClass < 2.2) effectScale = ${isTrail ? "2.2" : "8.5"};
                if (vEffectClass > 2.8 && vEffectClass < 3.2) effectScale = 1.32;
                if (vEffectClass > 3.8 && vEffectClass < 5.2) effectScale = 0.92;

                ${isTrail ? `
                    gl_Position = projectionMatrix * mvPosition;
                    float perspective = 300.0 / max(10.0, -mvPosition.z);
                    float pulse = 1.0 + min(2.4, uBass * 1.8);
                    float sizeCeiling = mix(144.0, 432.0, aHero);
                    float headDiameter = clamp(uPointSize * aScale * effectScale * perspective * pulse, 1.0, sizeCeiling);
                    float taper = pow(max(0.0, 1.0 - aTrail), 0.74);
                    // The first glow sample exactly matches the particle diameter;
                    // subsequent overlapping samples taper into a soft plasma tail.
                    vRenderedSize = max(0.5, headDiameter * taper * uTrailWidthScale);
                    gl_PointSize = vRenderedSize;
                ` : `
                    gl_Position = projectionMatrix * mvPosition;
                    float perspective = 300.0 / max(10.0, -mvPosition.z);
                    float pulse = 1.0 + min(2.4, uBass * 1.8);
                    // Allow the size control to produce everything from fine dust
                    // to large, soft energy orbs. The hardware point-size limit is
                    // still respected automatically by WebGL.
                    float sizeCeiling = mix(144.0, 432.0, aHero);
                    sizeCeiling = vEffectClass > 1.8 && vEffectClass < 2.2 ? 620.0 : sizeCeiling;
                    vRenderedSize = clamp(uPointSize * aScale * effectScale * perspective * pulse, 1.0, sizeCeiling);
                    gl_PointSize = vRenderedSize;
                `}
            }
        `;
    }

    createHeadFragmentShader() {
        return `
            precision highp float;
            uniform float uTime;
            uniform float uTreble;
            uniform float uPointSize;
            uniform float uGlowEnergy;
            uniform float uLightingStyle;
            varying vec3 vColor;
            varying float vAlpha;
            varying float vRenderedSize;
            varying float vEffectClass;

            void main() {
                vec2 d = gl_PointCoord - vec2(0.5);
                float r = length(d);
                if (r > 0.5) discard;

                float core = smoothstep(0.16, 0.0, r);
                float halo = smoothstep(0.5, 0.04, r);
                float sparkle = 1.0 + min(1.8, uTreble * 1.35);
                float settingBalance = mix(1.0, 0.42, smoothstep(12.0, 36.0, uPointSize));
                float heroBalance = mix(1.0, 0.14, smoothstep(90.0, 432.0, vRenderedSize));
                float largeSizeBalance = min(settingBalance, heroBalance);
                float lightingStyle = max(uLightingStyle, step(1.8, vEffectClass));
                vec3 color;
                float alpha;

                if (lightingStyle < 0.5) {
                    // Original soft energy-glow style remains available as an
                    // intentionally flatter randomized look.
                    color = vColor * (halo * 0.82 + core * 1.9)
                        * sparkle * mix(1.0, 0.72, 1.0 - largeSizeBalance);
                    alpha = (halo * 0.56 + core * 0.86) * vAlpha
                        * largeSizeBalance * uGlowEnergy;
                } else {
                    // Reconstruct a sphere normal from the point sprite. Two slow,
                    // palette-tinted environment lights make shading respond as a
                    // volume instead of reading like a static white sticker.
                    vec2 sphereXY = d * 2.0;
                    float sphereZ = sqrt(max(0.0, 1.0 - dot(sphereXY, sphereXY)));
                    vec3 normal = normalize(vec3(sphereXY, sphereZ));
                    vec3 viewDir = vec3(0.0, 0.0, 1.0);
                    vec3 keyDir = normalize(vec3(
                        cos(uTime * 0.13),
                        0.42 + 0.28 * sin(uTime * 0.09),
                        0.78
                    ));
                    vec3 fillDir = normalize(vec3(
                        -0.62 + 0.22 * sin(uTime * 0.07),
                        -0.36,
                        0.52
                    ));
                    float key = max(dot(normal, keyDir), 0.0);
                    float fill = max(dot(normal, fillDir), 0.0);
                    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.25);
                    vec3 halfDir = normalize(keyDir + viewDir);
                    float specular = pow(max(dot(normal, halfDir), 0.0), 22.0);

                    vec3 brightTint = pow(max(vColor, vec3(0.015)), vec3(0.62));
                    vec3 coolTint = mix(vColor.bgr, vColor, 0.42);
                    float diffuse = 0.20 + key * 0.84 + fill * 0.16;
                    vec3 reactiveColor = vColor * diffuse
                        + brightTint * specular * 0.40
                        + coolTint * fresnel * 0.18;

                    if (lightingStyle > 1.5) {
                        // Pearl turns the rim and secondary reflection up while
                        // retaining a deep colored shadow side.
                        reactiveColor = vColor * (0.18 + key * 0.72 + fill * 0.24)
                            + brightTint * (specular * 0.88 + fresnel * 0.34)
                            + coolTint * fresnel * 0.24;
                    }

                    float silhouette = smoothstep(0.5, 0.445, r);
                    float softAura = smoothstep(0.5, 0.28, r) * 0.20;
                    color = reactiveColor * sparkle + vColor * softAura;
                    alpha = (silhouette * 0.94 + softAura) * vAlpha
                        * largeSizeBalance * uGlowEnergy;
                }
                gl_FragColor = vec4(color * alpha, alpha);
            }
        `;
    }

    createTrailFragmentShader() {
        return `
            precision highp float;
            uniform float uTime;
            uniform float uTreble;
            uniform float uPointSize;
            uniform float uTrailOpacity;
            uniform float uTrailCoreBoost;
            uniform float uGlowEnergy;
            varying vec3 vColor;
            varying float vAlpha;
            varying float vTrailAmount;
            varying float vRenderedSize;

            void main() {
                float tail = pow(1.0 - vTrailAmount, 0.92);
                vec2 d = gl_PointCoord - vec2(0.5);
                float radius = length(d);
                if (radius > 0.5) discard;
                float halo = smoothstep(0.5, 0.04, radius);
                float core = smoothstep(0.2, 0.0, radius);

                // Bright packets travel backward through the tail, giving the
                // stream visible internal motion even without external audio.
                float energyWave = 0.9 + 0.1 * pow(
                    0.5 + 0.5 * sin(uTime * 8.0 - vTrailAmount * 24.0),
                    3.0
                );
                float shimmer = (0.95 + min(1.0, uTreble * 0.62)) * energyWave;
                vec3 hotColor = mix(vColor, vec3(1.0), core * 0.08 * uTrailCoreBoost);
                vec3 glow = hotColor * shimmer * (0.86 + core * 0.32 * uTrailCoreBoost);
                // Large particles cover far more pixels. Temper only their energy,
                // not their width, so max-size trails stay readable without whiteout.
                float settingBalance = mix(1.0, 0.18, smoothstep(12.0, 36.0, uPointSize));
                float heroBalance = mix(1.0, 0.1, smoothstep(90.0, 432.0, vRenderedSize));
                float largeSizeBalance = min(settingBalance, heroBalance);
                float alpha = tail * halo * vAlpha * uTrailOpacity
                    * largeSizeBalance * uGlowEnergy;
                gl_FragColor = vec4(glow * alpha, alpha);
            }
        `;
    }

    initParticleField() {
        const count = this.maxParticles;
        const seeds = new Float32Array(count * 3);
        const phases = new Float32Array(count);
        const paletteIndices = new Float32Array(count);
        const scales = new Float32Array(count);
        const heroes = new Float32Array(count);
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            seeds[i3] = Math.random() * 2 - 1;
            seeds[i3 + 1] = Math.random() * 2 - 1;
            seeds[i3 + 2] = Math.random() * 2 - 1;
            phases[i] = Math.random();
            paletteIndices[i] = Math.floor(Math.random() * 6);
            scales[i] = 0.55 + Math.pow(Math.random(), 2.0) * 2.8;
            // A tiny population becomes a hero comet. Its head and matching tail
            // can reach roughly three times the ordinary close-fly-by ceiling.
            heroes[i] = Math.random() < 0.006 ? 1 : 0;
            if (heroes[i] > 0.5) scales[i] *= 2.7;
        }

        this.headGeometry = new THREE.BufferGeometry();
        this.headGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.headGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
        this.headGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        this.headGeometry.setAttribute("aPaletteIndex", new THREE.BufferAttribute(paletteIndices, 1));
        this.headGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
        this.headGeometry.setAttribute("aHero", new THREE.BufferAttribute(heroes, 1));

        this.headMaterial = new THREE.ShaderMaterial({
            uniforms: this.sharedUniforms,
            vertexShader: this.createFlowVertexShader(false),
            fragmentShader: this.createHeadFragmentShader(),
            transparent: true,
            depthTest: true,
            depthWrite: false
        });
        this.useBoundedGlowBlending(this.headMaterial);

        this.particleHeads = new THREE.Points(this.headGeometry, this.headMaterial);
        this.particleHeads.frustumCulled = false;
        this.world.add(this.particleHeads);

        // Write only the tiny luminous core to depth. Transparent halos remain
        // soft, while close particles can now occlude distant clouds and tails—
        // a strong binocular depth cue that does not add visual busyness.
        this.depthCoreMaterial = new THREE.ShaderMaterial({
            uniforms: this.sharedUniforms,
            vertexShader: this.createFlowVertexShader(false),
            fragmentShader: `
                precision highp float;
                void main() {
                    if (length(gl_PointCoord - vec2(0.5)) > 0.115) discard;
                    gl_FragColor = vec4(1.0);
                }
            `,
            transparent: false,
            depthTest: true,
            depthWrite: true,
            colorWrite: false
        });
        this.particleDepthCores = new THREE.Points(this.headGeometry, this.depthCoreMaterial);
        this.particleDepthCores.frustumCulled = false;
        this.particleDepthCores.renderOrder = -2;
        this.world.add(this.particleDepthCores);

        const trailVertexCount = count * this.trailSegments;
        const trailPositions = new Float32Array(trailVertexCount * 3);
        const trailSeeds = new Float32Array(trailVertexCount * 3);
        const trailPhases = new Float32Array(trailVertexCount);
        const trailPaletteIndices = new Float32Array(trailVertexCount);
        const trailScales = new Float32Array(trailVertexCount);
        const trailHeroes = new Float32Array(trailVertexCount);
        const trailAmounts = new Float32Array(trailVertexCount);

        let v = 0;
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            for (let s = 0; s < this.trailSegments; s++) {
                const amount = s / (this.trailSegments - 1);
                const v3 = v * 3;
                trailSeeds[v3] = seeds[i3];
                trailSeeds[v3 + 1] = seeds[i3 + 1];
                trailSeeds[v3 + 2] = seeds[i3 + 2];
                trailPhases[v] = phases[i];
                trailPaletteIndices[v] = paletteIndices[i];
                trailScales[v] = scales[i];
                trailHeroes[v] = heroes[i];
                trailAmounts[v] = amount;
                v++;
            }
        }

        this.trailGeometry = new THREE.BufferGeometry();
        this.trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
        this.trailGeometry.setAttribute("aSeed", new THREE.BufferAttribute(trailSeeds, 3));
        this.trailGeometry.setAttribute("aPhase", new THREE.BufferAttribute(trailPhases, 1));
        this.trailGeometry.setAttribute("aPaletteIndex", new THREE.BufferAttribute(trailPaletteIndices, 1));
        this.trailGeometry.setAttribute("aScale", new THREE.BufferAttribute(trailScales, 1));
        this.trailGeometry.setAttribute("aHero", new THREE.BufferAttribute(trailHeroes, 1));
        this.trailGeometry.setAttribute("aTrail", new THREE.BufferAttribute(trailAmounts, 1));

        const createTrailMaterial = (widthScale, opacity, coreBoost) => this.useBoundedGlowBlending(new THREE.ShaderMaterial({
            // Preserve references to the shared animated uniforms while allowing
            // each visual layer to own its width/brightness treatment.
            uniforms: {
                ...this.sharedUniforms,
                uTrailWidthScale: { value: widthScale },
                uTrailOpacity: { value: opacity },
                uTrailCoreBoost: { value: coreBoost }
            },
            vertexShader: this.createFlowVertexShader(true),
            fragmentShader: this.createTrailFragmentShader(),
            transparent: true,
            depthTest: true,
            depthWrite: false
        }));

        // A broad chromatic atmosphere makes the trail readable at world scale;
        // a second head-sized layer supplies the hot, energetic plasma spine.
        this.trailHaloMaterial = createTrailMaterial(1.42, 0.1, 0.12);
        this.trailCoreMaterial = createTrailMaterial(1.0, 0.42, 0.68);

        this.particleTrailHalo = new THREE.Points(this.trailGeometry, this.trailHaloMaterial);
        this.particleTrailHalo.frustumCulled = false;
        this.world.add(this.particleTrailHalo);

        this.particleTrails = new THREE.Points(this.trailGeometry, this.trailCoreMaterial);
        this.particleTrails.frustumCulled = false;
        this.world.add(this.particleTrails);

        this.setActiveParticleCount(this.activeParticles);
        this.updatePalette(this.palette);
    }

    initNebulaClouds() {
        const cloudCount = 72;
        const layersPerCloud = 3;
        const verticesPerCloud = 6;
        const vertexCount = cloudCount * layersPerCloud * verticesPerCloud;
        const corners = new Float32Array(vertexCount * 3);
        const seeds = new Float32Array(vertexCount * 3);
        const phases = new Float32Array(vertexCount);
        const scales = new Float32Array(vertexCount);
        const paletteIndices = new Float32Array(vertexCount);
        const layers = new Float32Array(vertexCount);
        const cornerPattern = [
            [-1, -1], [1, -1], [-1, 1],
            [1, -1], [1, 1], [-1, 1]
        ];

        let v = 0;
        for (let i = 0; i < cloudCount; i++) {
            const seed = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
            const phase = Math.random();
            // Most clouds are substantial; a few become world-sized nebula banks.
            const scale = Math.pow(Math.random(), 0.58);
            const paletteIndex = Math.floor(Math.random() * 6);
            for (let layer = 0; layer < layersPerCloud; layer++) {
                for (let c = 0; c < verticesPerCloud; c++, v++) {
                    const v3 = v * 3;
                    corners[v3] = cornerPattern[c][0];
                    corners[v3 + 1] = cornerPattern[c][1];
                    corners[v3 + 2] = 0;
                    seeds[v3] = seed[0];
                    seeds[v3 + 1] = seed[1];
                    seeds[v3 + 2] = seed[2];
                    phases[v] = phase;
                    scales[v] = scale;
                    paletteIndices[v] = paletteIndex;
                    layers[v] = layer;
                }
            }
        }

        this.nebulaGeometry = new THREE.BufferGeometry();
        this.nebulaGeometry.setAttribute("position", new THREE.BufferAttribute(corners, 3));
        this.nebulaGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
        this.nebulaGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        this.nebulaGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
        this.nebulaGeometry.setAttribute("aPaletteIndex", new THREE.BufferAttribute(paletteIndices, 1));
        this.nebulaGeometry.setAttribute("aLayer", new THREE.BufferAttribute(layers, 1));

        this.nebulaMaterial = new THREE.ShaderMaterial({
            uniforms: this.sharedUniforms,
            vertexShader: `
                precision highp float;
                attribute vec3 aSeed;
                attribute float aPhase;
                attribute float aScale;
                attribute float aPaletteIndex;
                attribute float aLayer;
                uniform float uTime;
                uniform float uBass;
                uniform vec3 uPalette[6];
                varying vec2 vUv;
                varying vec3 vColor;
                varying float vAlpha;
                varying float vNoiseSeed;

                const float PI = 3.141592653589793;

                vec3 paletteColor(float indexValue) {
                    vec3 c = uPalette[0];
                    c = mix(c, uPalette[1], step(0.5, indexValue));
                    c = mix(c, uPalette[2], step(1.5, indexValue));
                    c = mix(c, uPalette[3], step(2.5, indexValue));
                    c = mix(c, uPalette[4], step(3.5, indexValue));
                    c = mix(c, uPalette[5], step(4.5, indexValue));
                    return pow(max(c, vec3(0.001)), vec3(0.68));
                }

                void main() {
                    float phase = aPhase * PI * 2.0;
                    float drift = uTime * 0.055;
                    float orbitRadius = 360.0 + abs(aSeed.x) * 390.0;
                    float z = mod((aSeed.z * 0.5 + 0.5) * 1500.0 + uTime * 2.2, 1500.0) - 750.0;
                    vec3 center = vec3(
                        cos(phase + drift * (0.24 + abs(aSeed.y) * 0.18)) * orbitRadius
                            + sin(drift * 0.7 + aSeed.z * 8.0) * 150.0,
                        sin(phase * 1.37 - drift * 0.19) * (240.0 + abs(aSeed.y) * 330.0)
                            + cos(drift * 0.43 + aSeed.x * 7.0) * 95.0,
                        z
                    );

                    // Three related sheets occupy different physical depths. In
                    // stereo they resolve as a soft cloud bank instead of one card.
                    float layerOffset = aLayer - 1.0;
                    float layerPhase = phase + aLayer * 2.17;
                    center.z += layerOffset * mix(52.0, 126.0, aScale);
                    center.xy += vec2(cos(layerPhase), sin(layerPhase * 1.31))
                        * layerOffset * mix(18.0, 54.0, aScale);

                    vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
                    float layerScale = mix(0.86, 1.12, fract(aScale * 3.73 + aLayer * 0.37));
                    float cloudSize = mix(135.0, 680.0, aScale) * layerScale
                        * (1.0 + min(0.24, uBass * 0.13));
                    vec4 mvPosition = mvCenter;
                    mvPosition.xy += position.xy * cloudSize;
                    gl_Position = projectionMatrix * mvPosition;

                    float breathe = pow(0.5 + 0.5 * sin(uTime * 0.105 + phase), 2.4);
                    float nearFade = smoothstep(130.0, 320.0, abs(mvCenter.z));
                    float farFade = smoothstep(920.0, 250.0, abs(mvCenter.z));
                    vAlpha = breathe * nearFade * farFade;
                    vUv = position.xy * 0.5 + 0.5;
                    vColor = paletteColor(aPaletteIndex);
                    vNoiseSeed = phase + aSeed.x * 3.1 + aSeed.y * 5.7;
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform float uTime;
                varying vec2 vUv;
                varying vec3 vColor;
                varying float vAlpha;
                varying float vNoiseSeed;

                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    float r = length(p);
                    if (r > 1.0) discard;

                    float body = exp(-r * r * 3.0);
                    float lobeA = exp(-dot(p - vec2(0.27, -0.13), p - vec2(0.27, -0.13)) * 8.0);
                    float lobeB = exp(-dot(p + vec2(0.31, 0.19), p + vec2(0.31, 0.19)) * 7.0);
                    float filaments = 0.62 + 0.38 * sin(
                        p.x * 13.0 + sin(p.y * 9.0 + uTime * 0.09 + vNoiseSeed) * 2.6
                    );
                    filaments *= 0.72 + 0.28 * cos(p.y * 15.0 - uTime * 0.07 + vNoiseSeed);
                    float density = (body * 0.62 + lobeA * 0.24 + lobeB * 0.2)
                        * mix(0.58, 1.0, filaments);
                    float edge = smoothstep(1.0, 0.22, r);
                    // Each sheet is lighter than the old single card; together
                    // they are slightly more visible while preserving highlights.
                    float alpha = density * edge * vAlpha * 0.072;
                    vec3 color = vColor * (0.64 + density * 0.58);
                    gl_FragColor = vec4(color * alpha, alpha);
                }
            `,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.useBoundedGlowBlending(this.nebulaMaterial);

        this.nebulaClouds = new THREE.Mesh(this.nebulaGeometry, this.nebulaMaterial);
        this.nebulaClouds.frustumCulled = false;
        // Clouds sit behind sharp heads and tails in the group render order.
        this.nebulaClouds.renderOrder = -1;
        this.world.add(this.nebulaClouds);
    }

    initDeepStars() {
        const count = 2600;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const radius = 520 + Math.random() * 620;
            const theta = Math.random() * Math.PI * 2;
            const u = Math.random() * 2 - 1;
            const planar = Math.sqrt(1 - u * u);
            positions[i3] = Math.cos(theta) * planar * radius;
            positions[i3 + 1] = u * radius;
            positions[i3 + 2] = Math.sin(theta) * planar * radius;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: "#a5b4fc",
            size: 0.95,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });
        this.deepStars = new THREE.Points(geometry, material);
        this.world.add(this.deepStars);
    }

    initInteraction() {
        const onDown = (x, y) => {
            this.isPointerDown = true;
            this.pointerMoved = false;
            this.pointerX = x;
            this.pointerY = y;
        };
        const onMove = (x, y) => {
            if (!this.isPointerDown) return;
            const dx = x - this.pointerX;
            const dy = y - this.pointerY;
            if (Math.abs(dx) + Math.abs(dy) > 2) this.pointerMoved = true;
            this.targetRotationY += dx * 0.0024;
            this.targetRotationX += dy * 0.0024;
            this.targetRotationX = Math.max(-1.15, Math.min(1.15, this.targetRotationX));
            this.pointerX = x;
            this.pointerY = y;
        };
        const onUp = () => {
            if (this.isPointerDown && !this.pointerMoved) {
                this.triggerGentleRipple();
            }
            this.isPointerDown = false;
        };

        this._onMouseDown = e => onDown(e.clientX, e.clientY);
        this._onMouseMove = e => onMove(e.clientX, e.clientY);
        this._onMouseUp = onUp;
        this._onTouchStart = e => {
            if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
        };
        this._onTouchMove = e => {
            if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
        };
        this._onTouchEnd = onUp;

        this.canvas.addEventListener("mousedown", this._onMouseDown);
        window.addEventListener("mousemove", this._onMouseMove);
        window.addEventListener("mouseup", this._onMouseUp);
        this.canvas.addEventListener("touchstart", this._onTouchStart, { passive: true });
        window.addEventListener("touchmove", this._onTouchMove, { passive: true });
        window.addEventListener("touchend", this._onTouchEnd);
    }

    setActiveParticleCount(count) {
        this.activeParticles = Math.max(1000, Math.min(this.maxParticles, Math.floor(count)));
        this.headGeometry.setDrawRange(0, this.activeParticles);
        // A minority of particles carry connected trails. Heads remain dense and
        // volumetric while the scene avoids collapsing into a uniform wire mesh.
        const trailedParticles = Math.max(620, Math.floor(this.activeParticles * 0.28));
        this.trailGeometry.setDrawRange(0, trailedParticles * this.trailSegments);
    }

    setThreeColor(target, source, fallback = "#ffffff") {
        if (typeof source !== "string") {
            target.set(fallback);
            return;
        }

        // Three r128's CSS parser only accepts integer HSL components. Eternal
        // Veil's generated palettes intentionally use fractional hue/lightness,
        // so parse those directly to preserve the actual palette without noisy
        // console warnings or stale colors.
        const hsl = source.trim().match(/^hsla?\(\s*([-+\d.]+)(?:deg)?\s*[, ]\s*([-+\d.]+)%\s*[, ]\s*([-+\d.]+)%/i);
        if (hsl) {
            const hue = ((Number(hsl[1]) % 360) + 360) % 360;
            const saturation = Math.max(0, Math.min(100, Number(hsl[2]))) / 100;
            const lightness = Math.max(0, Math.min(100, Number(hsl[3]))) / 100;
            target.setHSL(hue / 360, saturation, lightness);
            return;
        }

        const rgb = source.trim().match(/^rgba?\(\s*([-+\d.]+)\s*[, ]\s*([-+\d.]+)\s*[, ]\s*([-+\d.]+)/i);
        if (rgb) {
            target.setRGB(
                Math.max(0, Math.min(255, Number(rgb[1]))) / 255,
                Math.max(0, Math.min(255, Number(rgb[2]))) / 255,
                Math.max(0, Math.min(255, Number(rgb[3]))) / 255
            );
            return;
        }

        try {
            target.set(source);
        } catch (_) {
            target.set(fallback);
        }
    }

    updatePalette(newPalette) {
        if (!Array.isArray(newPalette) || newPalette.length === 0) return;
        this.palette = newPalette.slice(0, 6);
        for (let i = 0; i < 6; i++) {
            const source = this.palette[i % this.palette.length];
            this.setThreeColor(this.sharedUniforms.uPalette.value[i], source);
        }
        this.setThreeColor(this.scene.background, this.backgroundColor || "#020207", "#020207");
        if (this.scene.fog) this.scene.fog.color.copy(this.scene.background);
    }

    updateFromSettings() {
        const s = this.settings || {};
        const requestedSpeed = Math.max(0.0, Math.min(8.0, s.speed ?? 1.0));
        const inXR = this.renderer.xr.isPresenting;
        // Preserve the control's range while biasing native 3D toward a calmer,
        // more readable drift. Fast presets still accelerate, just less violently.
        const targetSpeed = requestedSpeed * (inXR ? 0.42 : 0.58);
        this.sharedUniforms.uSpeed.value = THREE.MathUtils.lerp(
            this.sharedUniforms.uSpeed.value,
            targetSpeed,
            0.045
        );
        // A larger headset-only volume gives each eye more spatial separation
        // and more time to track fly-bys without changing the desktop composition.
        const targetDepth = inXR ? 1450 : 1050;
        const targetRadius = inXR ? 320 : 260;
        this.sharedUniforms.uDepth.value = THREE.MathUtils.lerp(
            this.sharedUniforms.uDepth.value,
            targetDepth,
            0.035
        );
        this.sharedUniforms.uVolumeRadius.value = THREE.MathUtils.lerp(
            this.sharedUniforms.uVolumeRadius.value,
            targetRadius,
            0.035
        );
        this.sharedUniforms.uTurbulence.value = Math.max(0.0, Math.min(5.0, s.turbulence ?? 0.65));
        this.sharedUniforms.uOrganic.value = Math.max(0.0, Math.min(2.0, s.flowOrganic ?? 0.85));
        const effectModes = { ocean: 1, aurora: 2, orbitals: 3, lotus: 4 };
        this.sharedUniforms.uEffectMode.value = effectModes[s.particleShape] || 0;
        const lightingStyles = { glow: 0, reactive: 1, pearl: 2 };
        this.sharedUniforms.uLightingStyle.value = lightingStyles[s.particleLighting] || 0;
        // The flat renderer's 0.1–14 size range was too compressed in a world-scale
        // 3D volume. A curved mapping keeps the lower half controllable while the
        // upper end can create genuinely large VR particles. Approximate native
        // range: 1.5px–40px before distance, random scale, and music pulses.
        const baseSize = Math.max(0.1, Math.min(14.0, s.baseSize ?? 2.8));
        const sizePosition = (baseSize - 0.1) / 13.9;
        this.sharedUniforms.uPointSize.value = 1.5 + Math.pow(sizePosition, 1.5) * 38.5;
        // Larger particles need longer spatial separation between glow samples;
        // otherwise a dramatic tail compresses into one fuzzy blob.
        this.sharedUniforms.uTrailLength.value = 0.62 + sizePosition * 0.9;

        const density = Math.max(100, Math.min(8000, s.density ?? 1200));
        const densityPosition = (density - 100) / 7900;
        const baseCount = 2600 + densityPosition * (10500 - 2600);
        // Large sprites need spatial breathing room. Preserve their dramatic size
        // while reducing overlap instead of allowing a max-size/max-density scene
        // to collapse into a featureless white screen.
        const crowdingScale = 1.0 - 0.65 * Math.pow(sizePosition, 1.7);
        const desiredCount = 1900 + (baseCount - 1900) * crowdingScale;
        // Dynamically budget glow energy as sprites get larger and more numerous.
        // This keeps contrast in the busiest presets before bounded blending has
        // to do all of the highlight protection by itself.
        this.sharedUniforms.uGlowEnergy.value = Math.max(
            0.46,
            0.94 - densityPosition * 0.28 - sizePosition * 0.2
        );
        if (Math.abs(desiredCount - this.activeParticles) > 160) {
            this.setActiveParticleCount(desiredCount);
        }

        const bg = this.backgroundColor || "#020207";
        this.setThreeColor(this.scene.background, bg, "#020207");
        if (this.scene.fog) this.scene.fog.color.copy(this.scene.background);
    }

    triggerBurst() {
        this.burstStrength = Math.min(2.4, this.burstStrength + 1.1);
    }

    triggerVortex(_x, _y, _radius, strength = 18) {
        this.vortexStrength = Math.min(2.8, this.vortexStrength + strength / 16);
    }

    triggerShockwave(_x, _y, force = 55) {
        this.shockStrength = Math.min(2.8, this.shockStrength + force / 45);
        this.shockRadius = 20;
    }

    triggerGentleRipple() {
        this.burstStrength = Math.min(1.25, this.burstStrength + 0.2);
        this.vortexStrength = Math.min(0.9, this.vortexStrength + 0.1);
        this.shockStrength = Math.min(1.0, this.shockStrength + 0.18);
        this.shockRadius = 38;
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (!this.renderer.xr.isPresenting) {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        }
        this.renderer.setSize(w, h);
    }

    tick() {
        const frameDelta = Math.min(this.clock.getDelta(), 0.05);
        const delta = this.isPaused ? 0 : frameDelta;
        this.elapsed += delta;
        this.updateFromSettings();

        this.burstStrength *= Math.pow(0.035, delta);
        this.vortexStrength *= Math.pow(0.11, delta);
        this.shockStrength *= Math.pow(0.055, delta);
        this.shockRadius += delta * 175;
        if (this.shockRadius > 760) this.shockStrength = 0;

        const u = this.sharedUniforms;
        u.uTime.value = this.elapsed;
        u.uBass.value = Math.max(0, this.sizePulse || 0);
        u.uTreble.value = Math.max(0, this.trebleIntensity || 0);
        u.uBurst.value = this.burstStrength;
        u.uVortex.value = this.vortexStrength;
        u.uShock.value = this.shockStrength;
        u.uShockRadius.value = this.shockRadius;

        const inXR = this.renderer.xr.isPresenting;
        if (!inXR) {
            this.rotationX += (this.targetRotationX - this.rotationX) * 0.045;
            this.rotationY += (this.targetRotationY - this.rotationY) * 0.045;
            // A long, bounded orbital drift reveals depth without ever turning
            // the comfortable forward corridor away from the viewer.
            this.world.rotation.x = this.rotationX * 0.32
                + Math.sin(this.elapsed * 0.021 + 1.7) * 0.025;
            this.world.rotation.y = this.rotationY
                + Math.sin(this.elapsed * 0.028) * 0.11;
            this.world.rotation.z = Math.sin(this.elapsed * 0.013 + 0.6) * 0.005;
        } else {
            // Headset-safe ambient orbit: mostly yaw, tiny pitch, almost no roll.
            // Sine limits create smooth reversals instead of continuous spinning.
            const xrYaw = Math.sin(this.elapsed * 0.018) * 0.085;
            const xrPitch = Math.sin(this.elapsed * 0.012 + 1.7) * 0.026;
            const xrRoll = Math.sin(this.elapsed * 0.009 + 0.6) * 0.0045;
            this.world.rotation.x = THREE.MathUtils.lerp(this.world.rotation.x, xrPitch, 0.024);
            this.world.rotation.y = THREE.MathUtils.lerp(this.world.rotation.y, xrYaw, 0.024);
            this.world.rotation.z = THREE.MathUtils.lerp(this.world.rotation.z, xrRoll, 0.02);
            this.updateVRPanelInteraction();
        }

        this.deepStars.rotation.y = this.elapsed * 0.003;
        this.deepStars.rotation.x = Math.sin(this.elapsed * 0.025) * 0.04;
        this.renderer.render(this.scene, this.camera);
    }

    initXRControllers() {
        if (!this.renderer.xr.getController || this.xrControllers.length) return;
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1)
            ]);
            const material = new THREE.LineBasicMaterial({
                color: i === 0 ? "#67e8f9" : "#c084fc",
                transparent: true,
                opacity: 0.72
            });
            const ray = new THREE.Line(geometry, material);
            ray.scale.z = 18;
            ray.renderOrder = 1001;
            controller.add(ray);
            controller.userData.pointerRay = ray;
            controller.addEventListener("selectstart", () => {
                const hit = this.getVRPanelHit(controller);
                if (hit && this.activateVRControl(hit.action)) return;
                this.triggerGentleRipple();
            });
            controller.addEventListener("squeezestart", () => {
                this.setVRPanelVisible(!this.vrPanelGroup || !this.vrPanelGroup.visible);
            });
            this.scene.add(controller);
            this.xrControllers.push(controller);
        }
    }

    async startVR() {
        if (!navigator.xr) {
            CosmicLogger.error("WebXR is not supported on this device/browser.");
            return false;
        }
        try {
            const session = await navigator.xr.requestSession("immersive-vr", {
                optionalFeatures: ["local-floor", "bounded-floor"]
            });
            await this.renderer.xr.setSession(session);
            this.initXRControllers();
            this.initVRPanel();
            this.setVRPanelVisible(true);
            CosmicLogger.info("Immersive WebXR session started inside the Native Cosmic Flow Field.");
            if (typeof window.onVRSessionStart === "function") window.onVRSessionStart();

            session.addEventListener("end", () => {
                CosmicLogger.info("Native Cosmic Flow WebXR session ended.");
                const enterVrBtn = document.getElementById("enter-vr-btn");
                if (enterVrBtn) enterVrBtn.classList.remove("highlight");
                if (this.vrPanelGroup) this.vrPanelGroup.visible = false;
                if (typeof window.onVRSessionEnd === "function") window.onVRSessionEnd();
            }, { once: true });
            return true;
        } catch (error) {
            CosmicLogger.error("Native Cosmic Flow VR session request failed: " + error.message);
            return false;
        }
    }

    dispose() {
        this.renderer.setAnimationLoop(null);
        this.canvas.removeEventListener("mousedown", this._onMouseDown);
        window.removeEventListener("mousemove", this._onMouseMove);
        window.removeEventListener("mouseup", this._onMouseUp);
        this.canvas.removeEventListener("touchstart", this._onTouchStart);
        window.removeEventListener("touchmove", this._onTouchMove);
        window.removeEventListener("touchend", this._onTouchEnd);
        this.headGeometry.dispose();
        this.trailGeometry.dispose();
        this.headMaterial.dispose();
        this.depthCoreMaterial.dispose();
        this.trailHaloMaterial.dispose();
        this.trailCoreMaterial.dispose();
        this.nebulaGeometry.dispose();
        this.nebulaMaterial.dispose();
        this.deepStars.geometry.dispose();
        this.deepStars.material.dispose();
        if (this.vrPanelMesh) {
            this.vrPanelMesh.geometry.dispose();
            this.vrPanelMesh.material.dispose();
        }
        if (this.vrPanelTexture) this.vrPanelTexture.dispose();
        if (this.vrPanelGroup) this.scene.remove(this.vrPanelGroup);
        this.renderer.dispose();
    }
}

window.NativeFlowSimulation3D = NativeFlowSimulation3D;
