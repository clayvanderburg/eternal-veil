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
        this.trailSegments = 18;
        this.activeParticles = 7600;
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

        this.sharedUniforms = this.createSharedUniforms();
        this.initParticleField();
        this.initDeepStars();
        this.initInteraction();

        window.nativeSim3DInstance = this;
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
            uniform vec3 uPalette[6];

            varying vec3 vColor;
            varying float vAlpha;
            varying float vTrailAmount;

            const float PI = 3.141592653589793;

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

                return p;
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
                vTrailAmount = trailAmount;
                vColor = paletteColor(aPaletteIndex);

                ${isTrail ? `
                    gl_Position = projectionMatrix * mvPosition;
                    float perspective = 300.0 / max(10.0, -mvPosition.z);
                    float pulse = 1.0 + min(2.4, uBass * 1.8);
                    float headDiameter = clamp(uPointSize * aScale * perspective * pulse, 1.0, 144.0);
                    float taper = pow(max(0.0, 1.0 - aTrail), 1.12);
                    // The first glow sample exactly matches the particle diameter;
                    // subsequent overlapping samples taper into a soft plasma tail.
                    gl_PointSize = max(0.5, headDiameter * taper * uTrailWidthScale);
                ` : `
                    gl_Position = projectionMatrix * mvPosition;
                    float perspective = 300.0 / max(10.0, -mvPosition.z);
                    float pulse = 1.0 + min(2.4, uBass * 1.8);
                    // Allow the size control to produce everything from fine dust
                    // to large, soft energy orbs. The hardware point-size limit is
                    // still respected automatically by WebGL.
                    gl_PointSize = clamp(uPointSize * aScale * perspective * pulse, 1.0, 144.0);
                `}
            }
        `;
    }

    createHeadFragmentShader() {
        return `
            precision highp float;
            uniform float uTreble;
            uniform float uPointSize;
            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 d = gl_PointCoord - vec2(0.5);
                float r = length(d);
                if (r > 0.5) discard;

                float core = smoothstep(0.16, 0.0, r);
                float halo = smoothstep(0.5, 0.04, r);
                float sparkle = 1.0 + min(1.8, uTreble * 1.35);
                float largeSizeBalance = mix(1.0, 0.42, smoothstep(12.0, 36.0, uPointSize));
                vec3 color = vColor * (halo * 0.82 + core * 1.9)
                    * sparkle * mix(1.0, 0.72, 1.0 - largeSizeBalance);
                float alpha = (halo * 0.56 + core * 0.86) * vAlpha * largeSizeBalance;
                gl_FragColor = vec4(color, alpha);
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
            varying vec3 vColor;
            varying float vAlpha;
            varying float vTrailAmount;

            void main() {
                float tail = pow(1.0 - vTrailAmount, 1.45);
                vec2 d = gl_PointCoord - vec2(0.5);
                float radius = length(d);
                if (radius > 0.5) discard;
                float halo = smoothstep(0.5, 0.04, radius);
                float core = smoothstep(0.2, 0.0, radius);

                // Bright packets travel backward through the tail, giving the
                // stream visible internal motion even without external audio.
                float energyWave = 0.72 + 0.28 * pow(
                    0.5 + 0.5 * sin(uTime * 8.0 - vTrailAmount * 24.0),
                    3.0
                );
                float shimmer = (0.95 + min(1.0, uTreble * 0.62)) * energyWave;
                vec3 hotColor = mix(vColor, vec3(1.0), core * 0.08 * uTrailCoreBoost);
                vec3 glow = hotColor * shimmer * (0.86 + core * 0.32 * uTrailCoreBoost);
                // Large particles cover far more pixels. Temper only their energy,
                // not their width, so max-size trails stay readable without whiteout.
                float largeSizeBalance = mix(1.0, 0.18, smoothstep(12.0, 36.0, uPointSize));
                float alpha = tail * halo * vAlpha * uTrailOpacity * largeSizeBalance;
                gl_FragColor = vec4(glow, alpha);
            }
        `;
    }

    initParticleField() {
        const count = this.maxParticles;
        const seeds = new Float32Array(count * 3);
        const phases = new Float32Array(count);
        const paletteIndices = new Float32Array(count);
        const scales = new Float32Array(count);
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            seeds[i3] = Math.random() * 2 - 1;
            seeds[i3 + 1] = Math.random() * 2 - 1;
            seeds[i3 + 2] = Math.random() * 2 - 1;
            phases[i] = Math.random();
            paletteIndices[i] = Math.floor(Math.random() * 6);
            scales[i] = 0.55 + Math.pow(Math.random(), 2.0) * 2.8;
        }

        this.headGeometry = new THREE.BufferGeometry();
        this.headGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.headGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
        this.headGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        this.headGeometry.setAttribute("aPaletteIndex", new THREE.BufferAttribute(paletteIndices, 1));
        this.headGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

        this.headMaterial = new THREE.ShaderMaterial({
            uniforms: this.sharedUniforms,
            vertexShader: this.createFlowVertexShader(false),
            fragmentShader: this.createHeadFragmentShader(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
        });

        this.particleHeads = new THREE.Points(this.headGeometry, this.headMaterial);
        this.particleHeads.frustumCulled = false;
        this.world.add(this.particleHeads);

        const trailVertexCount = count * this.trailSegments;
        const trailPositions = new Float32Array(trailVertexCount * 3);
        const trailSeeds = new Float32Array(trailVertexCount * 3);
        const trailPhases = new Float32Array(trailVertexCount);
        const trailPaletteIndices = new Float32Array(trailVertexCount);
        const trailScales = new Float32Array(trailVertexCount);
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
        this.trailGeometry.setAttribute("aTrail", new THREE.BufferAttribute(trailAmounts, 1));

        const createTrailMaterial = (widthScale, opacity, coreBoost) => new THREE.ShaderMaterial({
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
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
        });

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
                this.triggerBurst(0, 0, 35);
                this.triggerShockwave(0, 0, 45, 9);
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
        const trailedParticles = Math.max(700, Math.floor(this.activeParticles * 0.32));
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
        this.sharedUniforms.uSpeed.value = Math.max(0.05, Math.min(4, s.speed ?? 1));
        this.sharedUniforms.uTurbulence.value = Math.max(0, Math.min(2.4, s.turbulence ?? 0.65));
        this.sharedUniforms.uOrganic.value = Math.max(0, Math.min(2, s.flowOrganic ?? 0.85));
        // The flat renderer's 0.5–7 size range was too compressed in a world-scale
        // 3D volume. A curved mapping keeps the lower half controllable while the
        // upper end can create genuinely large VR particles. Approximate native
        // range: 1.5px–40px before distance, random scale, and music pulses.
        const baseSize = Math.max(0.5, Math.min(7, s.baseSize ?? 2.8));
        const sizePosition = (baseSize - 0.5) / 6.5;
        this.sharedUniforms.uPointSize.value = 1.5 + Math.pow(sizePosition, 1.5) * 38.5;
        // Larger particles need longer spatial separation between glow samples;
        // otherwise a dramatic tail compresses into one fuzzy blob.
        this.sharedUniforms.uTrailLength.value = 0.62 + sizePosition * 0.9;

        const density = Math.max(200, Math.min(4000, s.density ?? 1200));
        const baseCount = 3400 + ((density - 200) / 3800) * (this.maxParticles - 3400);
        // Large sprites need spatial breathing room. Preserve their dramatic size
        // while reducing overlap instead of allowing a max-size/max-density scene
        // to collapse into a featureless white screen.
        const crowdingScale = 1.0 - 0.65 * Math.pow(sizePosition, 1.7);
        const desiredCount = 2200 + (baseCount - 2200) * crowdingScale;
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
        const delta = Math.min(this.clock.getDelta(), 0.05);
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
            this.world.rotation.x = this.rotationX * 0.32;
            this.world.rotation.y = this.rotationY + Math.sin(this.elapsed * 0.045) * 0.12;
        } else {
            // Keep the volume stable in world space for VR comfort.
            this.world.rotation.x *= 0.94;
            this.world.rotation.y *= 0.94;
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
            controller.add(ray);
            controller.addEventListener("selectstart", () => {
                this.triggerBurst();
                this.triggerVortex(0, 0, 300, 12, 45);
                this.triggerShockwave(0, 0, 48, 9);
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
            CosmicLogger.info("Immersive WebXR session started inside the Native Cosmic Flow Field.");
            if (typeof window.onVRSessionStart === "function") window.onVRSessionStart();

            session.addEventListener("end", () => {
                CosmicLogger.info("Native Cosmic Flow WebXR session ended.");
                const enterVrBtn = document.getElementById("enter-vr-btn");
                if (enterVrBtn) enterVrBtn.classList.remove("highlight");
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
        this.trailHaloMaterial.dispose();
        this.trailCoreMaterial.dispose();
        this.deepStars.geometry.dispose();
        this.deepStars.material.dispose();
        this.renderer.dispose();
    }
}

window.NativeFlowSimulation3D = NativeFlowSimulation3D;
