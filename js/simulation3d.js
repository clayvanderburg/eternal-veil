// ==========================================================================
// ETERNAL VEIL - 3D WEBGL & WEBXR (VR) SIMULATION DOME
// Projects the responsive 2D canvas visualizer onto a 3D Morphing Skybox (Sphere <-> Cube)
// Centered around the user for complete VR immersion
// ==========================================================================

class FlowSimulation3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Native WebXR support
        this.renderer.xr.enabled = true;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#050507");
        
        // Place camera at center (0,0,0) so the user stands inside the morphing dome
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 0, 0);
        
        this.settings = null;
        this.globalTime = 0;
        this.lastFrameTime = Date.now();
        
        // Interaction State (drag camera rotation)
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.isPointerDown = false;
        this.pointerX = 0;
        this.pointerY = 0;
        
        this.morphProgress = 0.0; // 0.0 = Sphere, 1.0 = Cube
        this.sizePulse = 0; // mapped to bass kick
        
        this.initInteraction();
        this.initDome();
        
        // Register globally
        window.sim3DInstance = this;
    }

    initDome() {
        // Create Canvas Texture from our live 2D flow canvas
        const canvas2D = document.getElementById("canvas");
        this.texture = new THREE.CanvasTexture(canvas2D);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        
        // Generate a highly subdivided Sphere Geometry as our base morphing envelope
        // Radius is 300 units to wrap comfortably around player
        this.geometry = new THREE.SphereGeometry(300, 64, 64);
        
        // Custom Shader Material that morphs vertices between a Sphere and a Cube
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: this.texture },
                morphProgress: { value: 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float morphProgress;
                
                void main() {
                    vUv = uv;
                    
                    // Sphere coordinate baseline
                    vec3 spherePos = normalize(position) * 300.0;
                    
                    // Project sphere coordinate onto flat cube faces
                    float maxCoord = max(max(abs(position.x), abs(position.y)), abs(position.z));
                    vec3 cubePos = (position / (maxCoord + 0.0001)) * 300.0;
                    
                    // Interpolate position based on morph progress
                    vec3 morphedPos = mix(spherePos, cubePos, morphProgress);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(morphedPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform sampler2D map;
                
                void main() {
                    // Sample live visualizer frames
                    vec4 texColor = texture2D(map, vUv);
                    
                    // Add subtle brightness boost to enhance glow inside VR headsets
                    gl_FragColor = texColor * 1.15;
                }
            `,
            side: THREE.BackSide, // Render on the inside faces so player looks out at it
            transparent: true,
            depthWrite: false
        });
        
        this.domeMesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.domeMesh);
    }

    initInteraction() {
        const handleDown = (x, y) => {
            this.isPointerDown = true;
            this.pointerX = x;
            this.pointerY = y;
        };

        const handleMove = (x, y) => {
            if (!this.isPointerDown) return;
            const dx = x - this.pointerX;
            const dy = y - this.pointerY;
            
            // Drag rotates the dome environment around the player
            this.targetRotationY += dx * 0.004;
            this.targetRotationX += dy * 0.004;
            
            this.pointerX = x;
            this.pointerY = y;
        };

        const handleUp = () => {
            this.isPointerDown = false;
        };

        this.canvas.addEventListener('mousedown', e => handleDown(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleUp);

        this.canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 1) handleDown(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('touchmove', e => {
            if (e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('touchend', handleUp);
    }

    // Unused but kept for interface compatibility
    updatePalette(newPalette) {}
    triggerBurst(x, y, count) {}
    triggerShockwave(x, y, force, speed) {}
    triggerVortex(x, y, radius, strength, life) {}

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    tick() {
        const now = Date.now();
        const delta = Math.min((now - this.lastFrameTime) / 1000, 0.05);
        this.lastFrameTime = now;
        
        this.globalTime += delta * 60;
        
        // Upload updated 2D Canvas pixels to WebGL texture
        this.texture.needsUpdate = true;
        
        // Morph progress drifts slowly over time + flares to cube on bass attacks
        let targetMorph = 0.5 + Math.sin(this.globalTime * 0.015) * 0.5;
        if (this.sizePulse > 0.4) {
            targetMorph = Math.min(1.0, targetMorph + this.sizePulse * 0.3);
        }
        
        this.morphProgress += (targetMorph - this.morphProgress) * 0.06;
        this.material.uniforms.morphProgress.value = this.morphProgress;
        
        // Rotate the dome matching user mouse drag
        this.rotationX += (this.targetRotationX - this.rotationX) * 0.05;
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.05;
        this.domeMesh.rotation.x = this.rotationX;
        this.domeMesh.rotation.y = this.rotationY;
        
        // Idle autonomous spin
        this.domeMesh.rotation.y += 0.0006;
        
        this.renderer.render(this.scene, this.camera);
    }
    
    async startVR() {
        if (!navigator.xr) {
            CosmicLogger.error("WebXR is not supported on this device/browser.");
            return;
        }
        
        try {
            const session = await navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['local-floor', 'bounded-floor']
            });
            
            this.renderer.xr.setSession(session);
            CosmicLogger.info("Immersive WebXR VR Session started inside the Flow Dome.");
            
            session.addEventListener('end', () => {
                CosmicLogger.info("WebXR Session ended.");
                const enterVrBtn = document.getElementById("enter-vr-btn");
                if (enterVrBtn) enterVrBtn.classList.remove("highlight");
            });
            
        } catch (e) {
            CosmicLogger.error("WebXR VR session request failed: " + e.message);
        }
    }
}

// Expose globally
window.FlowSimulation3D = FlowSimulation3D;
