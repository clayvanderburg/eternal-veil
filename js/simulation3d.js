// ==========================================================================
// ETERNAL VEIL - 3D WEBGL & WEBXR (VR) PHYSICS SIMULATION ENGINE
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
        
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);
        this.camera.position.set(0, 0, 320);
        
        this.particles = [];
        this.particleCount = 2000;
        this.settings = null;
        this.palette = ["#6366f1", "#818cf8", "#a78bfa", "#c084fc"];
        
        this.globalTime = 0;
        this.lastFrameTime = Date.now();
        this.vortices = [];
        this.shockwaves = [];
        
        // Interaction State (drag camera rotation)
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.isPointerDown = false;
        this.pointerX = 0;
        this.pointerY = 0;
        
        // Sound modulators
        this.sizePulse = 0;
        this.trebleIntensity = 0;
        
        this.initInteraction();
        this.initParticles();
        
        // Register globally
        window.sim3DInstance = this;
    }

    // Standard 3D noise function mapped onto our optimized 2D simplex noise
    getNoise3D(x, y, z) {
        return simplexNoise(x, y + z) * 0.5 + simplexNoise(x + z, y) * 0.5;
    }

    // 3D fluidic Curl Noise generator
    getCurlNoise3D(x, y, z, time, scale = 0.008) {
        const eps = 0.002;
        const t = time * 0.28;
        
        const n_x = this.getNoise3D(x * scale, y * scale, z * scale + t);
        const n_y = this.getNoise3D(x * scale + t, y * scale, z * scale);
        const n_z = this.getNoise3D(x * scale, y * scale + t, z * scale);
        
        const d_x = (this.getNoise3D((x + eps) * scale, y * scale, z * scale + t) - n_x) / eps;
        const d_y = (this.getNoise3D(x * scale + t, (y + eps) * scale, z * scale) - n_y) / eps;
        const d_z = (this.getNoise3D(x * scale, y * scale + t, (z + eps) * scale) - n_z) / eps;
        
        return {
            vx: (d_y - d_z) * 1.6,
            vy: (d_z - d_x) * 1.6,
            vz: (d_x - d_y) * 1.6
        };
    }

    initParticles() {
        // Build positions, colors, and sizes Float32Arrays for Three.js points
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        
        const paletteColors = this.palette.map(c => new THREE.Color(c));
        
        for (let i = 0; i < this.particleCount; i++) {
            // Spawn inside a 3D spherical bubble
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = Math.cbrt(Math.random()) * 260; // sphere radius
            
            const px = r * Math.sin(phi) * Math.cos(theta);
            const py = r * Math.sin(phi) * Math.sin(theta);
            const pz = r * Math.cos(phi);
            
            positions[i * 3] = px;
            positions[i * 3 + 1] = py;
            positions[i * 3 + 2] = pz;
            
            // Initial velocity state
            this.particles.push({
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                vz: (Math.random() - 0.5) * 1.5,
                life: Math.random() * 90 + 30,
                maxLife: 120,
                sizeOffset: Math.random() - 0.5,
                colorIndex: Math.floor(Math.random() * paletteColors.length)
            });
            
            const col = paletteColors[this.particles[i].colorIndex];
            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
            
            sizes[i] = 1.0;
        }
        
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // ShaderMaterial for premium glowing spherical 3D points
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointSize: { value: 3.5 },
                trebleGlow: { value: 0.0 }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float pointSize;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // size attenuation (depth perspective sizing)
                    gl_PointSize = size * pointSize * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                uniform float trebleGlow;
                
                void main() {
                    // Draw soft round radial glow point instead of flat webgl quads
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float alpha = smoothstep(0.5, 0.15, dist);
                    
                    // Treble transient flares up the core brightness (neon glow effect)
                    vec3 finalColor = vColor + (vec3(1.0) * trebleGlow * (0.5 - dist));
                    gl_FragColor = vec4(finalColor, alpha * 0.9);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
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
            
            // Drag rotates the scene
            this.targetRotationY += dx * 0.005;
            this.targetRotationX += dy * 0.005;
            
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

    updatePalette(newPalette) {
        this.palette = newPalette;
        if (!this.geometry) return;
        
        const colors = this.geometry.attributes.color.array;
        const paletteColors = newPalette.map(c => new THREE.Color(c));
        
        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particles[i];
            if (p) {
                p.colorIndex = Math.floor(Math.random() * paletteColors.length);
                const col = paletteColors[p.colorIndex];
                colors[i * 3] = col.r;
                colors[i * 3 + 1] = col.g;
                colors[i * 3 + 2] = col.b;
            }
        }
        this.geometry.attributes.color.needsUpdate = true;
    }

    triggerBurst(x, y, count = 35) {
        // Spawn burst particles at 3D center
        const positions = this.geometry.attributes.position.array;
        
        for (let k = 0; k < count; k++) {
            const idx = Math.floor(Math.random() * this.particleCount);
            const p = this.particles[idx];
            if (p) {
                // Reset position to center with offset
                positions[idx * 3] = (Math.random() - 0.5) * 20;
                positions[idx * 3 + 1] = (Math.random() - 0.5) * 20;
                positions[idx * 3 + 2] = (Math.random() - 0.5) * 20;
                
                const angle = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2.0 - 1.0);
                const speed = 4.0 + Math.random() * 5.0;
                
                p.vx = Math.sin(phi) * Math.cos(angle) * speed;
                p.vy = Math.sin(phi) * Math.sin(angle) * speed;
                p.vz = Math.cos(phi) * speed;
                
                p.life = Math.random() * 40 + 25;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
    }

    triggerShockwave(x, y, force = 55.0, speed = 10.5) {
        // 3D physical expanding sphere wave
        this.shockwaves.push({
            radius: 5,
            maxRadius: 280,
            speed: speed,
            force: force
        });
    }

    triggerVortex(x, y, radius = 280, strength = 16.0, life = 45) {
        // 3D center spinning vortex
        this.vortices.push({
            x: 0,
            y: 0,
            z: 0,
            radius: radius,
            strength: strength,
            life: life,
            maxLife: life
        });
    }

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
        
        const speed = this.settings ? this.settings.speed : 1.0;
        const organic = this.settings ? (this.settings.flowOrganic ?? 0.85) : 0.85;
        const turb = this.settings ? (this.settings.turbulence ?? 0.65) : 0.65;
        const baseSize = this.settings ? this.settings.baseSize : 2.8;
        const sizeVar = this.settings ? this.settings.sizeVariation : 1.4;
        
        this.globalTime += delta * 60;
        
        // Decay vortices
        for (let i = this.vortices.length - 1; i >= 0; i--) {
            this.vortices[i].life--;
            if (this.vortices[i].life <= 0) {
                this.vortices.splice(i, 1);
            }
        }
        
        // Update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed;
            if (sw.radius >= sw.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }
        
        // Physics update on particles
        const positions = this.geometry.attributes.position.array;
        const sizes = this.geometry.attributes.size.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particles[i];
            const px = positions[i * 3];
            const py = positions[i * 3 + 1];
            const pz = positions[i * 3 + 2];
            
            // 3D Curl Noise Field
            const curl = this.getCurlNoise3D(px, py, pz, this.globalTime * 0.28, 0.005);
            const tVal = this.getNoise3D(px * 0.01, py * 0.01, pz * 0.01 + this.globalTime * 0.08);
            
            let targetVx = (curl.vx * organic + tVal * (1 - organic) * turb) * speed * 0.24;
            let targetVy = (curl.vy * organic + tVal * (1 - organic) * turb) * speed * 0.24;
            let targetVz = (curl.vz * organic + tVal * (1 - organic) * turb) * speed * 0.24;
            
            p.vx = p.vx * 0.88 + targetVx * 0.6;
            p.vy = p.vy * 0.88 + targetVy * 0.6;
            p.vz = p.vz * 0.88 + targetVz * 0.6;
            
            // Apply Vortices (swirling pull to center + helical rotation)
            if (this.vortices.length > 0) {
                for (let k = 0; k < this.vortices.length; k++) {
                    const v = this.vortices[k];
                    // distance from center (0,0,0)
                    const distSq = px*px + py*py + pz*pz;
                    if (distSq < v.radius * v.radius && distSq > 4) {
                        const dist = Math.sqrt(distSq);
                        const lifeRatio = v.life / v.maxLife;
                        const strength = (v.radius - dist) / v.radius * v.strength * lifeRatio;
                        
                        // Pull to center
                        p.vx -= (px / dist) * strength * 0.5;
                        p.vy -= (py / dist) * strength * 0.5;
                        p.vz -= (pz / dist) * strength * 0.5;
                        
                        // Spin vortex around Z/Y axis
                        p.vx += (-py / dist) * strength * 1.8;
                        p.vy += (px / dist) * strength * 1.8;
                    }
                }
            }
            
            // Apply physical shockwaves
            if (this.shockwaves.length > 0) {
                for (let k = 0; k < this.shockwaves.length; k++) {
                    const sw = this.shockwaves[k];
                    const distSq = px*px + py*py + pz*pz;
                    if (distSq > 9) {
                        const dist = Math.sqrt(distSq);
                        const ringWidth = 40;
                        if (Math.abs(dist - sw.radius) < ringWidth) {
                            const distFromWave = 1.0 - Math.abs(dist - sw.radius) / ringWidth;
                            const lifeFactor = 1.0 - sw.radius / sw.maxRadius;
                            const strength = distFromWave * lifeFactor * sw.force;
                            
                            p.vx += (px / dist) * strength * 0.8;
                            p.vy += (py / dist) * strength * 0.8;
                            p.vz += (pz / dist) * strength * 0.8;
                        }
                    }
                }
            }
            
            // Move Position
            positions[i * 3] += p.vx;
            positions[i * 3 + 1] += p.vy;
            positions[i * 3 + 2] += p.vz;
            
            // Round/Spherical boundary reset
            const distanceCenter = Math.sqrt(positions[i * 3]**2 + positions[i * 3 + 1]**2 + positions[i * 3 + 2]**2);
            if (distanceCenter > 300) {
                // Re-spawn near center
                positions[i * 3] = (Math.random() - 0.5) * 80;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
                p.vx = (Math.random() - 0.5) * 1.0;
                p.vy = (Math.random() - 0.5) * 1.0;
                p.vz = (Math.random() - 0.5) * 1.0;
                p.life = Math.random() * 90 + 30;
            }
            
            // Rhythmic Size swell mapping
            sizes[i] = (baseSize + p.sizeOffset * sizeVar) * (1.0 + this.sizePulse * 0.95);
            
            p.life--;
            if (p.life <= 0) {
                p.life = Math.random() * 90 + 30;
            }
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        
        // Pass treble transient to fragment shader glow uniform
        this.material.uniforms.trebleGlow.value = this.trebleIntensity * 1.8;
        this.material.uniforms.pointSize.value = baseSize * 1.1;
        
        // Smoothly rotate the scene to match user drag interaction
        this.rotationX += (this.targetRotationX - this.rotationX) * 0.05;
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.05;
        this.points.rotation.x = this.rotationX;
        this.points.rotation.y = this.rotationY;
        
        // Autonomous subtle idle drift rotation
        this.points.rotation.y += 0.0015;
        
        // Sync background color dynamically
        const bgHex = document.getElementById("bg-color-picker") ? document.getElementById("bg-color-picker").value : "#050507";
        this.scene.background.set(bgHex);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // VR Session triggers
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
            CosmicLogger.info("Immersive WebXR VR Session started.");
            
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
