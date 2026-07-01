// ==========================================================================
// ETERNAL VEIL - 3D WEBGL & WEBXR (VR) PHYSICS SIMULATION ENGINE
// Optimized for VR with fading particle history trails (star streaks)
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
        
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1500);
        this.camera.position.set(0, 0, 280);
        
        this.particles = [];
        this.particleCount = 3000; // doubled particle count for high density
        this.trailLength = 12; // number of trail history points per particle
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

    // 3D fluidic Curl Noise generator (lower frequency scale for long, elegant streams)
    getCurlNoise3D(x, y, z, time, scale = 0.0035) {
        const eps = 0.005;
        const t = time * 0.22;
        
        const n_x = this.getNoise3D(x * scale, y * scale, z * scale + t);
        const n_y = this.getNoise3D(x * scale + t, y * scale, z * scale);
        const n_z = this.getNoise3D(x * scale, y * scale + t, z * scale);
        
        const d_x = (this.getNoise3D((x + eps) * scale, y * scale, z * scale + t) - n_x) / eps;
        const d_y = (this.getNoise3D(x * scale + t, (y + eps) * scale, z * scale) - n_y) / eps;
        const d_z = (this.getNoise3D(x * scale, y * scale + t, (z + eps) * scale) - n_z) / eps;
        
        return {
            vx: (d_y - d_z) * 5.6, // doubled curl force for high extremity
            vy: (d_z - d_x) * 5.6,
            vz: (d_x - d_y) * 5.6
        };
    }

    initParticles() {
        const totalPoints = this.particleCount * this.trailLength;
        const positions = new Float32Array(totalPoints * 3);
        const colors = new Float32Array(totalPoints * 3);
        const sizes = new Float32Array(totalPoints);
        const alphas = new Float32Array(totalPoints);
        
        const paletteColors = this.palette.map(c => new THREE.Color(c));
        
        for (let i = 0; i < this.particleCount; i++) {
            // Spawn inside a tight, dense spherical bubble (half the space)
            const angle = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2.0 - 1.0);
            const r = Math.cbrt(Math.random()) * 110; // halved spawn radius
            
            const px = r * Math.sin(phi) * Math.cos(angle);
            const py = r * Math.sin(phi) * Math.sin(angle);
            const pz = r * Math.cos(phi);
            
            const colorIndex = Math.floor(Math.random() * paletteColors.length);
            
            this.particles.push({
                x: px,
                y: py,
                z: pz,
                vx: (Math.random() - 0.5) * 1.0,
                vy: (Math.random() - 0.5) * 1.0,
                vz: (Math.random() - 0.5) * 1.0,
                life: Math.random() * 100 + 40,
                maxLife: 140,
                sizeOffset: Math.random() - 0.5,
                colorIndex: colorIndex,
                history: [] // trail positions history
            });
            
            // Seed initial history
            for (let t = 0; t < this.trailLength; t++) {
                this.particles[i].history.push({ x: px, y: py, z: pz });
            }
            
            // Configure vertices in buffer (trail points)
            for (let t = 0; t < this.trailLength; t++) {
                const idx = i * this.trailLength + t;
                positions[idx * 3] = px;
                positions[idx * 3 + 1] = py;
                positions[idx * 3 + 2] = pz;
                
                const col = paletteColors[colorIndex];
                colors[idx * 3] = col.r;
                colors[idx * 3 + 1] = col.g;
                colors[idx * 3 + 2] = col.b;
                
                // Trail steps shrink and fade out along the tail
                const fadeFactor = 1.0 - (t / this.trailLength);
                sizes[idx] = fadeFactor;
                alphas[idx] = fadeFactor * 0.8;
            }
        }
        
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        
        // ShaderMaterial supporting dynamic alphachannels and depth perspective rendering
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointSize: { value: 4.5 },
                trebleGlow: { value: 0.0 }
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float pointSize;
                
                void main() {
                    vColor = color;
                    vAlpha = alpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // size attenuation makes nearby streaking trails look huge
                    gl_PointSize = size * pointSize * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                uniform float trebleGlow;
                
                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    // Smooth gaseous radial glow point shape
                    float shapeAlpha = smoothstep(0.5, 0.15, dist);
                    
                    // Multiply shape transparency by trail step transparency (vAlpha)
                    float finalAlpha = shapeAlpha * vAlpha;
                    
                    vec3 finalColor = vColor + (vec3(1.0) * trebleGlow * (0.5 - dist));
                    gl_FragColor = vec4(finalColor, finalAlpha * 0.95);
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
                
                // Update color for all trail step vertices
                for (let t = 0; t < this.trailLength; t++) {
                    const idx = i * this.trailLength + t;
                    colors[idx * 3] = col.r;
                    colors[idx * 3 + 1] = col.g;
                    colors[idx * 3 + 2] = col.b;
                }
            }
        }
        this.geometry.attributes.color.needsUpdate = true;
    }

    triggerBurst(x, y, count = 45) {
        // Explode particles outward from center
        for (let k = 0; k < count; k++) {
            const idx = Math.floor(Math.random() * this.particleCount);
            const p = this.particles[idx];
            if (p) {
                p.x = (Math.random() - 0.5) * 15;
                p.y = (Math.random() - 0.5) * 15;
                p.z = (Math.random() - 0.5) * 15;
                
                const angle = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2.0 - 1.0);
                const speed = 5.0 + Math.random() * 7.0;
                
                p.vx = Math.sin(phi) * Math.cos(angle) * speed;
                p.vy = Math.sin(phi) * Math.sin(angle) * speed;
                p.vz = Math.cos(phi) * speed;
                
                p.life = Math.random() * 45 + 30;
                p.history = [];
                for (let t = 0; t < this.trailLength; t++) {
                    p.history.push({ x: p.x, y: p.y, z: p.z });
                }
            }
        }
    }

    triggerShockwave(x, y, force = 55.0, speed = 10.5) {
        this.shockwaves.push({
            radius: 10,
            maxRadius: 360,
            speed: speed * 1.1,
            force: force * 1.2
        });
    }

    triggerVortex(x, y, radius = 280, strength = 16.0, life = 45) {
        this.vortices.push({
            x: 0,
            y: 0,
            z: 0,
            radius: radius * 1.1,
            strength: strength * 1.3,
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
        
        const positions = this.geometry.attributes.position.array;
        const sizes = this.geometry.attributes.size.array;
        const alphas = this.geometry.attributes.alpha.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particles[i];
            
            // 3D Curl Noise Field (Low frequency noise scale = long, elegant cosmic streams)
            const curl = this.getCurlNoise3D(p.x, p.y, p.z, this.globalTime * 0.22, 0.0035);
            const tVal = this.getNoise3D(p.x * 0.008, p.y * 0.008, p.z * 0.008 + this.globalTime * 0.06);
            
            // Low drag (0.975 speed retention) to stretch trails out into long flowing lines
            let targetVx = (curl.vx * organic + tVal * (1 - organic) * turb) * speed * 0.22;
            let targetVy = (curl.vy * organic + tVal * (1 - organic) * turb) * speed * 0.22;
            let targetVz = (curl.vz * organic + tVal * (1 - organic) * turb) * speed * 0.22;
            
            // Twice as responsive to noise flow velocities (0.17 instead of 0.085)
            p.vx = p.vx * 0.975 + targetVx * 0.17;
            p.vy = p.vy * 0.975 + targetVy * 0.17;
            p.vz = p.vz * 0.975 + targetVz * 0.17;
            
            // Apply physical vortices
            if (this.vortices.length > 0) {
                for (let k = 0; k < this.vortices.length; k++) {
                    const v = this.vortices[k];
                    const dx = p.x - v.x;
                    const dy = p.y - v.y;
                    const dz = p.z - v.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    if (distSq < v.radius * v.radius && distSq > 4) {
                        const dist = Math.sqrt(distSq);
                        const lifeRatio = v.life / v.maxLife;
                        const strength = (v.radius - dist) / v.radius * v.strength * lifeRatio;
                        
                        // Pull inward to center
                        p.vx -= (dx / dist) * strength * 0.25;
                        p.vy -= (dy / dist) * strength * 0.25;
                        p.vz -= (dz / dist) * strength * 0.25;
                        
                        // Rotational swirl around central Z-axis
                        p.vx += (-dy / dist) * strength * 1.5;
                        p.vy += (dx / dist) * strength * 1.5;
                    }
                }
            }
            
            // Apply physical shockwaves
            if (this.shockwaves.length > 0) {
                for (let k = 0; k < this.shockwaves.length; k++) {
                    const sw = this.shockwaves[k];
                    const dx = p.x;
                    const dy = p.y;
                    const dz = p.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    if (distSq > 9) {
                        const dist = Math.sqrt(distSq);
                        const ringWidth = 50;
                        if (Math.abs(dist - sw.radius) < ringWidth) {
                            const distFromWave = 1.0 - Math.abs(dist - sw.radius) / ringWidth;
                            const lifeFactor = 1.0 - sw.radius / sw.maxRadius;
                            const strength = distFromWave * lifeFactor * sw.force;
                            
                            p.vx += (dx / dist) * strength * 0.7;
                            p.vy += (dy / dist) * strength * 0.7;
                            p.vz += (dz / dist) * strength * 0.7;
                        }
                    }
                }
            }
            
            // Move Position
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            
            // Bounding boundary wrap-around box [-140, 140] (halved space for maximum density)
            // If a particle moves behind you, it wraps to the front, creating infinite stars streaking past your face
            const limit = 140;
            if (p.x > limit) { p.x = -limit; p.history = []; }
            else if (p.x < -limit) { p.x = limit; p.history = []; }
            
            if (p.y > limit) { p.y = -limit; p.history = []; }
            else if (p.y < -limit) { p.y = limit; p.history = []; }
            
            if (p.z > limit) { p.z = -limit; p.history = []; }
            else if (p.z < -limit) { p.z = limit; p.history = []; }
            
            // Update history array
            p.history.unshift({ x: p.x, y: p.y, z: p.z });
            if (p.history.length > this.trailLength) {
                p.history.pop();
            }
            
            // Calculate size/alpha base scaling
            const lifeRatio = Math.max(0.1, p.life / p.maxLife);
            const particleBaseSize = (baseSize + p.sizeOffset * sizeVar) * (1.0 + this.sizePulse * 0.85);
            
            // Fill historical trail points into GL float arrays
            for (let t = 0; t < this.trailLength; t++) {
                const idx = i * this.trailLength + t;
                const hist = p.history[t] || { x: p.x, y: p.y, z: p.z };
                
                positions[idx * 3] = hist.x;
                positions[idx * 3 + 1] = hist.y;
                positions[idx * 3 + 2] = hist.z;
                
                // Slower non-linear size and alpha decay to keep trail thick and visible
                const fadeFactor = 1.0 - (t / this.trailLength);
                const sizeFade = Math.sqrt(fadeFactor);
                const alphaFade = Math.pow(fadeFactor, 0.7);
                
                sizes[idx] = sizeFade * particleBaseSize;
                alphas[idx] = alphaFade * lifeRatio * 0.82;
            }
            
            p.life--;
            if (p.life <= 0) {
                p.life = Math.random() * 100 + 40;
            }
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
        
        // Pass treble frequency spikes to GL uniforms for flare glows
        this.material.uniforms.trebleGlow.value = this.trebleIntensity * 2.2;
        // Doubled pointSize factor (baseSize * 30.0) for twice-as-big neon ribbons
        this.material.uniforms.pointSize.value = baseSize * 30.0;
        
        // Adjust camera angle based on drag rotation
        this.rotationX += (this.targetRotationX - this.rotationX) * 0.05;
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.05;
        this.points.rotation.x = this.rotationX;
        this.points.rotation.y = this.rotationY;
        
        // Subtle autonomous rotation
        this.points.rotation.y += 0.001;
        
        // Sync background color
        const bgHex = document.getElementById("bg-color-picker") ? document.getElementById("bg-color-picker").value : "#050507";
        this.scene.background.set(bgHex);
        
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
