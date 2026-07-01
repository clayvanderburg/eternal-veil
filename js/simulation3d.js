// ==========================================================================
// ETERNAL VEIL - 3D WEBGL & WEBXR (VR) PARALLAX FLOW DOME
// Projects the 2D canvas visualizer onto nested, shape-shifting skybox domes.
// Uses tiling, seam-dissolving shaders, and parallax rotations for deep VR volume.
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
        
        // Place camera at center (0,0,0) so the user is wrapped inside the parallax domes
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1200);
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
        this.initDomes();
        
        // Register globally
        window.sim3DInstance = this;
    }

    initDomes() {
        // Create Canvas Texture from our live 2D flow canvas
        const canvas2D = document.getElementById("canvas");
        this.texture = new THREE.CanvasTexture(canvas2D);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        
        // Allow texture repeating to tile coordinates horizontally (smaller, sharper patterns)
        this.texture.wrapS = THREE.RepeatWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Subdivided sphere geometry template
        const geoTemplate1 = new THREE.SphereGeometry(420, 64, 64); // Inner Dome (large)
        const geoTemplate2 = new THREE.SphereGeometry(460, 64, 64); // Outer Dome (nested layer)
        
        // Custom Shader Material that morphs, tiles, centers, and dissolves seams
        const shaderDefinition = {
            uniforms: {
                map: { value: this.texture },
                morphProgress: { value: 0.0 },
                radius: { value: 300.0 },
                opacity: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float morphProgress;
                uniform float radius;
                
                void main() {
                    vUv = uv;
                    
                    // Sphere coordinate baseline
                    vec3 spherePos = normalize(position) * radius;
                    
                    // Project sphere coordinate onto flat cube faces
                    float maxCoord = max(max(abs(position.x), abs(position.y)), abs(position.z));
                    vec3 cubePos = (position / (maxCoord + 0.0001)) * radius;
                    
                    // Interpolate position based on morph progress
                    vec3 morphedPos = mix(spherePos, cubePos, morphProgress);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(morphedPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform sampler2D map;
                uniform float opacity;
                
                void main() {
                    // 1. Shift UV horizontally by 0.5 so the center of the 2D canvas starts directly in front of the user's face (Z-axis)
                    // 2. Tile the texture 2 times horizontally (vUv.x * 2.0) to make the patterns smaller and sharper on the walls
                    vec2 shiftedUv = vec2(fract(vUv.x * 2.0 + 0.5), vUv.y);
                    
                    // Sample live visualizer frames
                    vec4 texColor = texture2D(map, shiftedUv);
                    
                    // 3. Seam fading math: Dissolve the wrap borders into the background black void so there are no seams
                    float edgeFadeX = smoothstep(0.0, 0.06, fract(vUv.x * 2.0)) * smoothstep(1.0, 0.94, fract(vUv.x * 2.0));
                    
                    // 4. Pole fading math: Dissolve the top/bottom polar pinch points to prevent rendering distortions
                    float edgeFadeY = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
                    
                    float edgeFade = edgeFadeX * edgeFadeY;
                    
                    // Apply fading factors and uniform opacity
                    gl_FragColor = texColor * edgeFade * opacity * 1.15;
                }
            `,
            side: THREE.BackSide, // Render on the inside faces so player is inside the volume
            transparent: true,
            depthWrite: false
        };

        // Create Dome 1: Inner Layer
        const material1 = new THREE.ShaderMaterial(JSON.parse(JSON.stringify(shaderDefinition)));
        material1.uniforms.map.value = this.texture;
        material1.uniforms.radius.value = 420.0;
        material1.uniforms.opacity.value = 1.0;
        this.material1 = material1;
        this.domeMesh1 = new THREE.Mesh(geoTemplate1, this.material1);
        this.scene.add(this.domeMesh1);

        // Create Dome 2: Outer Layer (rotated slightly for parallax slide)
        const material2 = new THREE.ShaderMaterial(JSON.parse(JSON.stringify(shaderDefinition)));
        material2.uniforms.map.value = this.texture;
        material2.uniforms.radius.value = 460.0;
        material2.uniforms.opacity.value = 0.45; // softer overlay
        this.material2 = material2;
        this.domeMesh2 = new THREE.Mesh(geoTemplate2, this.material2);
        this.domeMesh2.rotation.y = Math.PI / 4.0; // initial rotation offset
        this.scene.add(this.domeMesh2);
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
            
            // Drag rotates the entire space around the camera
            this.targetRotationY += dx * 0.003;
            this.targetRotationX += dy * 0.003;
            
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
        let targetMorph = 0.5 + Math.sin(this.globalTime * 0.012) * 0.5;
        if (this.sizePulse > 0.4) {
            targetMorph = Math.min(1.0, targetMorph + this.sizePulse * 0.25);
        }
        
        this.morphProgress += (targetMorph - this.morphProgress) * 0.05;
        
        // Update uniforms for both meshes
        this.material1.uniforms.morphProgress.value = this.morphProgress;
        this.material2.uniforms.morphProgress.value = this.morphProgress;
        
        // Smooth mouse drag rotations
        this.rotationX += (this.targetRotationX - this.rotationX) * 0.05;
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.05;
        
        // Inner dome: rotates slowly clockwise
        this.domeMesh1.rotation.x = this.rotationX;
        this.domeMesh1.rotation.y = this.rotationY + this.globalTime * 0.0004;
        
        // Outer dome: rotates in opposite direction (generating parallax depth slides)
        this.domeMesh2.rotation.x = -this.rotationX * 0.5;
        this.domeMesh2.rotation.y = -this.rotationY - this.globalTime * 0.0003;
        
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
            CosmicLogger.info("Immersive WebXR VR Session started inside the Parallax Flow Dome.");
            
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
