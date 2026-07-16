// ==========================================================================
// ETERNAL VEIL - CORE PHYSICS & PARTICLE SIMULATION ENGINE
// ==========================================================================

// --- SIMPLEX NOISE ALGORITHM (Fast 2D Implementation) ---
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

const grad3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1]
];

const p_table = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,
    20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,
    230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,
    169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,
    147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,
    44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,
    104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
    192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,
    24,72,243,141,128,195,78,66,215,61,156,180
];

const perm = new Array(512);
for (let i = 0; i < 256; i++) {
    perm[i] = perm[i + 256] = p_table[i];
}

function dot(g, x, y) {
    return g[0] * x + g[1] * y;
}

function simplexNoise(xin, yin) {
    let n0, n1, n2;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else { t0 *= t0; n0 = t0 * t0 * dot(grad3[gi0], x0, y0); }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else { t1 *= t1; n1 = t1 * t1 * dot(grad3[gi1], x1, y1); }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else { t2 *= t2; n2 = t2 * t2 * dot(grad3[gi2], x2, y2); }

    return 70.0 * (n0 + n1 + n2);
}

// Curl Noise Generator (Fluid-like swirls)
function getCurlNoise(x, y, time, scale = 0.008) {
    const eps = 0.001;
    const t = time * 0.4;

    const n1 = simplexNoise(x * scale, y * scale + t);
    const n2 = simplexNoise(x * scale + t, y * scale);

    // Divide by (eps * scale) to compute the correct noise-space derivative
    const dx = (simplexNoise((x + eps) * scale, y * scale + t) - n1) / (eps * scale);
    const dy = (simplexNoise(x * scale + t, (y + eps) * scale) - n2) / (eps * scale);

    return {
        vx: dy * 1.8,
        vy: -dx * 1.8
    };
}


// --- PARTICLE CLASS ---
class Particle {
    constructor(w, h, palette) {
        this.w = w;
        this.h = h;
        this.palette = palette;
        this.viewportScale = 1.0;
        this.isBurst = false;
        this.dead = false;
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * this.w;
        this.y = Math.random() * this.h;
        this.lastX = this.x;
        this.lastY = this.y;
        this.perpX = 0;
        this.perpY = 0;
        this.lastPerpX = 0;
        this.lastPerpY = 0;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        
        this.life = initial ? Math.random() * 80 + 40 : Math.random() * 60 + 80;
        this.maxLife = this.life;
        this.dead = false;
        
        // Cache random offset to avoid Math.random() in hot rendering loop
        this.randomSizeOffset = Math.random() - 0.5;
        
        // Randomly assign particle category for Aquatic Flow preset splits (60% paint strokes, 40% bubble rings)
        this.aquaticType = Math.random() > 0.4 ? "paint" : "bubble";
        
        // Randomly assign particle category for Nebula preset splits (75% twinkling stars, 25% background cloud blobs)
        this.nebulaType = Math.random() > 0.25 ? "star" : "cloud";

        // Stable authored-composition seeds. They are reconfigured when entering
        // a structured effect so particles form a scene instead of random soup.
        this.activeEffectShape = null;
        this.effectRole = Math.random();
        this.effectLane = Math.random();
        this.effectPhase = Math.random() * Math.PI * 2;
        
        this.color = this.pickColor();
    }

    pickColor() {
        if (!this.palette || this.palette.length === 0) return "#ffffff";
        this.colorIndex = Math.floor(Math.random() * this.palette.length);
        return this.palette[this.colorIndex];
    }

    getPipeRoutePoint(progress) {
        const wrapped = ((progress % 1) + 1) % 1;
        const variant = this.activeEffectShape || "pipes";
        let routeCount = 6;
        if (variant === "pipesTight") routeCount = 15;
        else if (variant === "pipesCathedral") routeCount = 3;
        else if (variant === "pipesShrine") routeCount = 8;
        const route = Math.min(routeCount - 1, Math.floor(this.effectLane * routeCount));
        let centerX, centerY, halfW, halfH;
        if (variant === "pipesTight") {
            const column = route % 5;
            const row = Math.floor(route / 5);
            centerX = this.w * (0.10 + column * 0.20 + (row % 2 ? 0.012 : -0.012));
            centerY = this.h * (0.17 + row * 0.33);
            halfW = this.w * (0.044 + (route % 3) * 0.006);
            halfH = this.h * (0.058 + ((route + 1) % 3) * 0.007);
        } else if (variant === "pipesCathedral") {
            centerX = this.w * (0.18 + route * 0.32);
            centerY = this.h * 0.50;
            halfW = this.w * (0.13 + (route === 1 ? 0.025 : 0));
            halfH = this.h * (0.32 + (route % 2) * 0.07);
        } else if (variant === "pipesShrine") {
            const scale = 0.055 + route * 0.038;
            centerX = this.w * 0.5;
            centerY = this.h * 0.5;
            halfW = this.w * scale;
            halfH = this.h * scale * 0.78;
        } else {
            const column = route % 3;
            const row = Math.floor(route / 3);
            centerX = this.w * (0.18 + column * 0.32 + (row ? -0.025 : 0.025));
            centerY = this.h * (0.27 + row * 0.46);
            halfW = this.w * (0.095 + (route % 2) * 0.022);
            halfH = this.h * (0.105 + ((route + 1) % 3) * 0.018);
        }
        const segmentFloat = wrapped * 8;
        const segment = Math.min(7, Math.floor(segmentFloat));
        const u = segmentFloat - segment;

        let ax = -halfW, ay = -halfH, bx = 0, by = -halfH;
        switch (segment) {
            case 1: ax = 0; ay = -halfH; bx = 0; by = -halfH * 0.34; break;
            case 2: ax = 0; ay = -halfH * 0.34; bx = halfW; by = -halfH * 0.34; break;
            case 3: ax = halfW; ay = -halfH * 0.34; bx = halfW; by = halfH; break;
            case 4: ax = halfW; ay = halfH; bx = 0; by = halfH; break;
            case 5: ax = 0; ay = halfH; bx = 0; by = halfH * 0.34; break;
            case 6: ax = 0; ay = halfH * 0.34; bx = -halfW; by = halfH * 0.34; break;
            case 7: ax = -halfW; ay = halfH * 0.34; bx = -halfW; by = -halfH; break;
        }

        return {
            x: centerX + ax + (bx - ax) * u,
            y: centerY + ay + (by - ay) * u,
            segment,
            segmentT: u
        };
    }

    updatePipeMotion(settings, globalTime, dt) {
        this.lastX = this.x;
        this.lastY = this.y;
        this.lastPipeSegment = this.pipeSegment;

        const junctionThreshold = this.activeEffectShape === "pipesTight" ? 0.985
            : this.activeEffectShape === "pipesCathedral" ? 0.94
            : this.activeEffectShape === "pipesShrine" ? 0.972
            : 0.965;
        const isJunction = this.effectRole >= junctionThreshold;
        const phase = this.effectPhase / (Math.PI * 2);
        const progress = isJunction
            ? Math.floor(phase * 8) / 8
            : phase + globalTime * 0.00115 * (0.72 + (settings.speed || 1) * 0.72 + this.effectRole * 0.18);
        const point = this.getPipeRoutePoint(progress);
        this.x = point.x;
        this.y = point.y;
        this.pipeSegment = point.segment;
        this.pipeSegmentT = point.segmentT;
        this.vx = (this.x - this.lastX) / Math.max(0.001, dt);
        this.vy = (this.y - this.lastY) / Math.max(0.001, dt);

        const headingAngle = Math.atan2(this.vy, this.vx);
        this.perpX = -Math.sin(headingAngle);
        this.perpY = Math.cos(headingAngle);

        this.life -= dt;
        if (this.life <= 0) {
            if (this.isBurst) this.dead = true;
            else this.reset();
        }
    }

    configureAuthoredEffect(shape, globalTime = 0) {
        this.activeEffectShape = shape;
        this.effectRole = Math.random();
        this.effectLane = Math.random();
        this.effectPhase = Math.random() * Math.PI * 2;

        if (shape === "ocean") {
            if (this.effectRole < 0.70) {
                this.x = Math.random() * this.w;
                this.y = this.h * (0.58 + this.effectLane * 0.36);
            } else if (this.effectRole < 0.995) {
                this.x = Math.random() * this.w;
                this.y = Math.random() * this.h;
            } else {
                this.x = Math.random() * this.w;
                this.y = this.h * (0.10 + this.effectLane * 0.34);
            }
        } else if (shape === "aurora") {
            this.x = this.w * (0.04 + this.effectLane * 0.92);
            this.y = Math.random() * this.h;
        } else if (shape === "orbitals") {
            const radius = Math.min(this.w, this.h) * (0.08 + this.effectLane * 0.44);
            const angle = this.effectPhase + globalTime * (0.004 + this.effectRole * 0.006);
            this.x = this.w * 0.5 + Math.cos(angle) * radius;
            this.y = this.h * 0.5 + Math.sin(angle) * radius * 0.68;
        } else if (shape === "lotus") {
            const petal = Math.floor(this.effectLane * 10);
            const angle = petal * Math.PI * 0.2 + (this.effectRole - 0.5) * 0.24;
            const radius = Math.min(this.w, this.h) * (0.08 + this.effectRole * 0.40);
            this.x = this.w * 0.5 + Math.cos(angle) * radius;
            this.y = this.h * 0.52 + Math.sin(angle) * radius;
        } else if (shape === "spiral") {
            const arm = Math.floor(this.effectLane * 6);
            const progress = (this.effectRole + globalTime * 0.0007) % 1;
            const radius = Math.min(this.w, this.h) * (0.035 + progress * 0.47);
            const angle = arm * Math.PI / 3 + progress * Math.PI * 5.2 + globalTime * 0.003;
            this.x = this.w * 0.5 + Math.cos(angle) * radius;
            this.y = this.h * 0.5 + Math.sin(angle) * radius;
        } else if (shape.startsWith("pipes")) {
            const phase = this.effectPhase / (Math.PI * 2);
            const threshold = shape === "pipesTight" ? 0.985 : shape === "pipesCathedral" ? 0.94 : shape === "pipesShrine" ? 0.972 : 0.965;
            const progress = this.effectRole >= threshold ? Math.floor(phase * 8) / 8 : phase;
            const point = this.getPipeRoutePoint(progress);
            this.x = point.x;
            this.y = point.y;
            this.pipeSegment = point.segment;
            this.lastPipeSegment = point.segment;
            this.pipeSegmentT = point.segmentT;
        }

        this.lastX = this.x;
        this.lastY = this.y;
        this.vx = 0;
        this.vy = 0;
    }

    update(settings, globalTime, mouse, customForces, shockwaves, vortices, dt = 1.0) {
        // Calculate viewport scale reference (based on 1600px desktop width)
        const scaleRef = Math.max(0.4, this.viewportScale || 1.0);
        
        // Get natural flow forces (Curl vs Turbulence)
        const zoom = settings.zoom || 1.0;
        const speed = settings.speed || 1.0;
        const flowFreq = 0.007 / zoom;
        const organic = settings.flowOrganic ?? 0.85;
        const turb = settings.turbulence ?? 0.65;
        const authoredShapes = ["ocean", "aurora", "orbitals", "lotus", "spiral", "pipes", "pipesTight", "pipesCathedral", "pipesShrine"];
        if (authoredShapes.includes(settings.particleShape)) {
            if (this.activeEffectShape !== settings.particleShape) {
                this.configureAuthoredEffect(settings.particleShape, globalTime);
            }
        } else {
            this.activeEffectShape = null;
        }

        if (settings.particleShape.startsWith("pipes")) {
            this.updatePipeMotion(settings, globalTime, dt);
            return;
        }

        // Calculate curl at scaled virtual coordinates to make swirls size-invariant
        const curl = getCurlNoise(this.x / scaleRef, this.y / scaleRef, globalTime * 0.35, flowFreq);
        // Calculate standard noise turbulence
        const tVal = simplexNoise((this.x / scaleRef) * 0.015, (this.y / scaleRef) * 0.015 + globalTime * 0.1);
        
        // Base flow targets scaled by music reactivity when active (trebleIntensity / sizePulse)
        // If trebleIntensity is active (>0.01), it forces particle trajectories to sync with musical transients.
        const speedBoost = 1.0 + (settings.trebleIntensity || 0) * 1.5;
        const turbBoost = 1.0 + (settings.trebleIntensity || 0) * 1.2;
        
        let targetVx = (curl.vx * organic + tVal * (1 - organic) * (turb * turbBoost)) * (speed * speedBoost) * 0.26 * scaleRef;
        let targetVy = (curl.vy * organic + tVal * (1 - organic) * (turb * turbBoost)) * (speed * speedBoost) * 0.26 * scaleRef;

        // Music overrides particle motion direction: heavy beats push particles to slide or swell randomly
        if (settings.trebleIntensity > 0.1) {
            // Apply slight turbulence offset or directional wind matching the current treble intensity
            const windAngle = globalTime * 0.05 + this.effectPhase;
            targetVx += Math.cos(windAngle) * (settings.trebleIntensity * 1.6) * scaleRef;
            targetVy += Math.sin(windAngle) * (settings.trebleIntensity * 1.6) * scaleRef;
        }

        if (settings.particleShape === "ocean") {
            if (this.effectRole < 0.70) {
                const targetY = this.h * (0.58 + this.effectLane * 0.36)
                    + Math.sin(this.x * 0.012 + globalTime * 0.035 + this.effectPhase)
                        * this.h * (0.012 + this.effectLane * 0.018);
                targetVx = (0.28 + this.effectLane * 0.32) * speed * scaleRef;
                targetVy = (targetY - this.y) * 0.018;
            } else if (this.effectRole < 0.995) {
                targetVx = Math.sin(globalTime * 0.025 + this.effectPhase) * 0.045 * scaleRef;
                targetVy = (0.48 + this.effectLane * 0.72) * speed * scaleRef;
            } else {
                const targetY = this.h * (0.10 + this.effectLane * 0.34);
                targetVx = (0.018 + this.effectLane * 0.024) * speed * scaleRef;
                targetVy = (targetY - this.y) * 0.01
                    + Math.sin(globalTime * 0.008 + this.effectPhase) * 0.012 * scaleRef;
            }
        } else if (settings.particleShape === "aurora") {
            const targetX = this.w * (0.04 + this.effectLane * 0.92)
                + Math.sin(globalTime * 0.012 + this.effectPhase + this.y * 0.004)
                    * this.w * (0.025 + this.effectRole * 0.035);
            targetVx = (targetX - this.x) * 0.012;
            targetVy = -(0.12 + this.effectRole * 0.26) * speed * scaleRef;
        } else if (settings.particleShape === "orbitals") {
            const radius = Math.min(this.w, this.h) * (0.08 + this.effectLane * 0.44);
            const angle = this.effectPhase + globalTime * (0.004 + this.effectRole * 0.006) * speed;
            const targetX = this.w * 0.5 + Math.cos(angle) * radius;
            const targetY = this.h * 0.5 + Math.sin(angle) * radius * 0.68;
            targetVx = (targetX - this.x) * 0.028;
            targetVy = (targetY - this.y) * 0.028;
        } else if (settings.particleShape === "lotus") {
            const petal = Math.floor(this.effectLane * 10);
            const breathe = 0.86 + Math.sin(globalTime * 0.012 + this.effectPhase) * 0.14;
            const petalAngle = petal * Math.PI * 0.2
                + (this.effectRole - 0.5) * 0.26
                + Math.sin(globalTime * 0.006) * 0.08;
            const radius = Math.min(this.w, this.h)
                * (0.07 + this.effectRole * 0.42) * breathe;
            const targetX = this.w * 0.5 + Math.cos(petalAngle) * radius;
            const targetY = this.h * 0.52 + Math.sin(petalAngle) * radius;
            targetVx = (targetX - this.x) * 0.032;
            targetVy = (targetY - this.y) * 0.032;
        } else if (settings.particleShape === "spiral") {
            const arm = Math.floor(this.effectLane * 6);
            const travelerSpeed = 0.00055 + speed * 0.00034;
            const progress = (this.effectRole + globalTime * travelerSpeed) % 1;
            const breathe = 0.95 + Math.sin(globalTime * 0.007 + arm) * 0.05;
            const radius = Math.min(this.w, this.h) * (0.035 + progress * 0.47) * breathe;
            const angle = arm * Math.PI / 3 + progress * Math.PI * 5.2
                + globalTime * (0.0022 + (settings.rotationSpeed || 0) * 0.018);
            const targetX = this.w * 0.5 + Math.cos(angle) * radius;
            const targetY = this.h * 0.5 + Math.sin(angle) * radius;
            targetVx = (targetX - this.x) * 0.08;
            targetVy = (targetY - this.y) * 0.08;
        }
        
        // Inject Aquatic Flow split velocity physics overrides
        if (settings.particleShape === "aquatic") {
            if (this.aquaticType === "paint") {
                // Paint daubs slide horizontal-rightward with wavy vertical sway
                targetVx += 0.8 * speed * scaleRef;
                targetVy += Math.sin(globalTime * 0.025 + this.x * 0.004) * 0.32 * speed * scaleRef;
            } else {
                // Bubbles drift leftward and float upwards (buoyancy) with horizontal weaving bob
                targetVx -= 0.45 * speed * scaleRef;
                targetVy -= (0.8 + Math.abs(this.randomSizeOffset) * 0.5) * speed * scaleRef;
                targetVx += Math.cos(globalTime * 0.035 + this.y * 0.006) * 0.36 * speed * scaleRef;
            }
        }
        
        // Inject Acid Rain physics overrides (steady downward gravity + wavy horizontal wind warp)
        if (settings.particleShape === "acid") {
            targetVy += 1.35 * speed * scaleRef;
            targetVx += Math.sin(globalTime * 0.04 + this.y * 0.012) * 0.75 * speed * scaleRef;
        }
        
        // Inject Cosmic Nebula physics overrides (clouds drift at 10% speed, stars drift at 33% speed)
        if (settings.particleShape === "nebula") {
            if (this.nebulaType === "cloud") {
                targetVx *= 0.10;
                targetVy *= 0.10;
            } else {
                targetVx *= 0.33;
                targetVy *= 0.33;
            }
        }

        // Apply drag/friction using time-corrected exponential decay
        const drag = settings.drag !== undefined ? settings.drag : 0.90;
        const dragFactor = Math.pow(drag, dt);
        // Add force directly to enable rapid acceleration and beautiful long trailing lines
        this.vx = this.vx * dragFactor + targetVx * 0.58 * dt;
        this.vy = this.vy * dragFactor + targetVy * 0.58 * dt;

        // Apply mouse interaction fields
        if (mouse && mouse.active && settings.mouseInfluence > 0.05) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            const radius = 200 * scaleRef; // Proportional interaction radius

            if (distSq < radius * radius && distSq > 4) {
                const dist = Math.sqrt(distSq);
                const strength = (radius - dist) / radius * settings.mouseInfluence * scaleRef * dt;

                switch (settings.mouseMode) {
                    case "attract":
                        this.vx -= (dx / dist) * strength * 2.2;
                        this.vy -= (dy / dist) * strength * 2.2;
                        break;
                    case "repel":
                        this.vx += (dx / dist) * strength * 2.5;
                        this.vy += (dy / dist) * strength * 2.5;
                        break;
                    case "vortex":
                        // Tangent force vector
                        this.vx += (-dy / dist) * strength * 2.8;
                        this.vy += (dx / dist) * strength * 2.8;
                        break;
                }
            }
        }

        // Apply custom painted force vector fields (decaying force line nodes)
        if (customForces && customForces.length > 0) {
            const range = 64 * scaleRef; // Proportional brush radius
            for (let i = 0; i < customForces.length; i++) {
                const force = customForces[i];
                const dx = this.x - force.x;
                const dy = this.y - force.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < range * range && distSq > 1) {
                    const dist = Math.sqrt(distSq);
                    const forceFactor = (range - dist) / range * (force.life / force.maxLife);
                    
                    // Add painted velocity vectors onto particle direction
                    this.vx += force.vx * forceFactor * 0.8 * scaleRef * dt;
                    this.vy += force.vy * forceFactor * 0.8 * scaleRef * dt;
                }
            }
        }

        // Apply Swarm particle-to-particle repulsion
        if (settings.interaction > 0.05) {
            // Check repulsion against 3 random active particles (approximate local repulsion grid)
            const checkCount = 3;
            const minDist = (20 + settings.interaction * 6) * scaleRef;
            for (let k = 0; k < checkCount; k++) {
                if (window.particleArray && window.particleArray.length > 1) {
                    const other = window.particleArray[Math.floor(Math.random() * window.particleArray.length)];
                    if (other && other !== this) {
                        const dx = this.x - other.x;
                        const dy = this.y - other.y;
                        const distSq = dx * dx + dy * dy;
                        
                        if (distSq < minDist * minDist && distSq > 0.1) {
                            const dist = Math.sqrt(distSq);
                            const force = (minDist - dist) / minDist * settings.interaction * 0.6 * scaleRef * dt;
                            this.vx += (dx / dist) * force;
                            this.vy += (dy / dist) * force;
                        }
                    }
                }
            }
        }

        // Apply beat-reactive vortices (swirling force pulls to center and spins)
        if (vortices && vortices.length > 0) {
            for (let i = 0; i < vortices.length; i++) {
                const v = vortices[i];
                const dx = this.x - v.x;
                const dy = this.y - v.y;
                const distSq = dx * dx + dy * dy;
                const radius = v.radius * scaleRef;
                if (distSq < radius * radius && distSq > 4) {
                    const dist = Math.sqrt(distSq);
                    const lifeRatio = v.life / v.maxLife;
                    const strength = (radius - dist) / radius * v.strength * lifeRatio * scaleRef * dt;
                    
                    // Pull to center
                    this.vx -= (dx / dist) * strength * 0.45;
                    this.vy -= (dy / dist) * strength * 0.45;
                    
                    // Tangent spin vector
                    this.vx += (-dy / dist) * strength * 1.5;
                    this.vy += (dx / dist) * strength * 1.5;
                }
            }
        }

        // Apply expanding shockwaves pushing particles outwards
        if (shockwaves && shockwaves.length > 0) {
            for (let i = 0; i < shockwaves.length; i++) {
                const sw = shockwaves[i];
                const dx = this.x - sw.x;
                const dy = this.y - sw.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > 16) {
                    const dist = Math.sqrt(distSq);
                    // Force is active only near the shockwave expanding wavefront ring
                    const ringWidth = 35 * scaleRef;
                    if (Math.abs(dist - sw.radius) < ringWidth) {
                        const distFromWave = 1.0 - Math.abs(dist - sw.radius) / ringWidth;
                        const lifeFactor = 1.0 - sw.radius / sw.maxRadius;
                        const strength = distFromWave * lifeFactor * sw.force * scaleRef * dt;
                        
                        this.vx += (dx / dist) * strength * 0.65;
                        this.vy += (dy / dist) * strength * 0.65;
                    }
                }
            }
        }

        // Spawn sparks on treble transient attack
        if (settings.trebleIntensity > 0.05 && Math.random() < settings.trebleIntensity * 0.22) {
            if (window.simInstance && window.simInstance.sparkles.length < 350) {
                // Spawn sparkle moving slightly backward relative to particle velocity
                window.simInstance.sparkles.push(new Sparkle(
                    this.x, 
                    this.y, 
                    this.vx * -0.2, 
                    this.vy * -0.2, 
                    this.color
                ));
            }
        }

        // Continuous rainbow cycling in psychedelic mode
        if (settings.psychedelicMode) {
            const hue = (globalTime * 1.8 + (this.x + this.y) * 0.1) % 360;
            this.color = `hsla(${hue}, 98%, 62%, 0.85)`;
        }

        // Move position using time-scaled velocity
        this.lastX = this.x;
        this.lastY = this.y;
        this.lastPerpX = this.perpX || 0;
        this.lastPerpY = this.perpY || 0;
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Calculate new perpendicular unit vector based on current velocity heading
        const headingAngle = Math.atan2(this.vy, this.vx);
        this.perpX = -Math.sin(headingAngle);
        this.perpY = Math.cos(headingAngle);
        
        if (this.lastPerpX === 0 && this.lastPerpY === 0) {
            this.lastPerpX = this.perpX;
            this.lastPerpY = this.perpY;
        }

        // Wrap around boundaries
        let wrapped = false;
        if (this.x < 0) { this.x = this.w; this.vx *= 0.5; wrapped = true; }
        else if (this.x > this.w) { this.x = 0; this.vx *= 0.5; wrapped = true; }
        
        if (this.y < 0) { this.y = this.h; this.vy *= 0.5; wrapped = true; }
        else if (this.y > this.h) { this.y = 0; this.vy *= 0.5; wrapped = true; }
        
        if (wrapped) {
            this.lastX = this.x;
            this.lastY = this.y;
            this.lastPerpX = this.perpX;
            this.lastPerpY = this.perpY;
        }

        // Age
        this.life -= dt;
        if (this.life <= 0) {
            if (this.isBurst) {
                this.dead = true;
            } else {
                this.reset();
            }
        }
    }

    drawLitOrb(ctx, radius, alpha, settings) {
        const lighting = settings.particleLighting || "glow";
        const time = Date.now() * 0.00008;
        const lightX = Math.cos(time + this.effectPhase);
        const lightY = Math.sin(time * 0.73 + this.effectPhase);
        const accent = this.palette?.[(this.colorIndex + 1) % this.palette.length] || this.color;

        ctx.save();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha * (lighting === "glow" ? 0.42 : 0.78);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (lighting === "glow") {
            ctx.strokeStyle = accent;
            ctx.globalAlpha = alpha * 0.42;
            ctx.lineWidth = Math.max(1, radius * 0.12);
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius * 0.86, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // A slowly moving environment light and opposing shadow create a
            // readable sphere without the old fixed white sticker highlight.
            ctx.fillStyle = "#020617";
            ctx.globalAlpha = alpha * (lighting === "pearl" ? 0.22 : 0.34);
            ctx.beginPath();
            ctx.arc(
                this.x - lightX * radius * 0.22,
                this.y - lightY * radius * 0.22,
                radius * 0.94,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.fillStyle = accent;
            ctx.globalAlpha = alpha * (lighting === "pearl" ? 0.58 : 0.72);
            ctx.beginPath();
            ctx.arc(
                this.x + lightX * radius * 0.36,
                this.y + lightY * radius * 0.36,
                radius * (lighting === "pearl" ? 0.19 : 0.14),
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.strokeStyle = accent;
            ctx.globalAlpha = alpha * (lighting === "pearl" ? 0.72 : 0.34);
            ctx.lineWidth = Math.max(1, radius * (lighting === "pearl" ? 0.12 : 0.06));
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius * 0.91, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawAuthoredEffect(ctx, settings, drawSize, drawAlpha) {
        const shape = settings.particleShape;
        if (shape === "ocean") {
            if (this.effectRole < 0.70) {
                ctx.strokeStyle = this.color;
                ctx.lineCap = "round";
                ctx.globalAlpha = drawAlpha * 0.18;
                ctx.lineWidth = Math.max(2, drawSize * (3.0 + this.effectLane * 2.6));
                ctx.beginPath();
                ctx.moveTo(this.lastX, this.lastY);
                ctx.lineTo(this.x, this.y);
                ctx.stroke();
                ctx.globalAlpha = drawAlpha * 0.82;
                ctx.lineWidth = Math.max(0.8, drawSize * (0.48 + this.effectLane * 0.42));
                ctx.beginPath();
                ctx.moveTo(this.lastX, this.lastY);
                ctx.lineTo(this.x, this.y);
                ctx.stroke();
            } else if (this.effectRole < 0.995) {
                const rainLength = Math.max(4, drawSize * 2.4 + Math.abs(this.vy) * 3.5);
                ctx.strokeStyle = this.color;
                ctx.lineCap = "round";
                ctx.globalAlpha = drawAlpha * 0.58;
                ctx.lineWidth = Math.max(0.45, drawSize * 0.18);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - rainLength);
                ctx.lineTo(this.x + this.vx * 0.8, this.y);
                ctx.stroke();
            } else {
                this.drawLitOrb(ctx, drawSize * (11 + this.effectLane * 13), drawAlpha * 0.82, settings);
            }
            return true;
        }

        if (shape === "aurora") {
            if (this.effectRole < 0.92) {
                const curtainHeight = drawSize * (9 + this.effectLane * 18);
                const bend = Math.sin(Date.now() * 0.00012 + this.effectPhase) * drawSize * 2.2;
                ctx.strokeStyle = this.color;
                ctx.lineCap = "round";
                ctx.globalAlpha = drawAlpha * 0.10;
                ctx.lineWidth = Math.max(2, drawSize * (3.2 + this.effectLane * 2.0));
                ctx.beginPath();
                ctx.moveTo(this.x - bend, this.y - curtainHeight);
                ctx.quadraticCurveTo(this.x + bend, this.y, this.x - bend * 0.35, this.y + curtainHeight);
                ctx.stroke();
                ctx.globalAlpha = drawAlpha * 0.48;
                ctx.lineWidth = Math.max(0.7, drawSize * 0.38);
                ctx.stroke();
            } else {
                this.drawLitOrb(ctx, drawSize * 0.55, drawAlpha * 0.9, settings);
            }
            return true;
        }

        if (shape === "orbitals") {
            if (this.effectRole > 0.994) {
                this.drawLitOrb(ctx, drawSize * (7 + this.effectLane * 7), drawAlpha, settings);
            } else {
                ctx.strokeStyle = this.color;
                ctx.lineCap = "round";
                ctx.globalAlpha = drawAlpha * 0.28;
                ctx.lineWidth = Math.max(0.8, drawSize * 0.48);
                ctx.beginPath();
                ctx.moveTo(this.lastX, this.lastY);
                ctx.lineTo(this.x, this.y);
                ctx.stroke();
                ctx.globalAlpha = drawAlpha * 0.8;
                ctx.lineWidth = Math.max(0.5, drawSize * 0.18);
                ctx.beginPath();
                ctx.arc(this.x, this.y, drawSize * 0.72, 0, Math.PI * 2);
                ctx.stroke();
            }
            return true;
        }

        if (shape === "lotus") {
            if (this.effectRole > 0.995) {
                this.drawLitOrb(ctx, drawSize * 6.5, drawAlpha, settings);
            } else {
                const angle = Math.atan2(this.y - this.h * 0.52, this.x - this.w * 0.5);
                ctx.fillStyle = this.color;
                ctx.globalAlpha = drawAlpha * 0.22;
                ctx.beginPath();
                ctx.ellipse(this.x, this.y, drawSize * 3.8, drawSize * 1.15, angle, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = drawAlpha * 0.72;
                ctx.beginPath();
                ctx.ellipse(this.x, this.y, drawSize * 1.8, drawSize * 0.42, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            return true;
        }

        if (shape === "spiral") {
            const hero = this.effectRole > 0.992;
            if (hero) {
                this.drawLitOrb(ctx, drawSize * (4.5 + this.effectLane * 5.5), drawAlpha * 0.9, settings);
            } else {
                ctx.strokeStyle = this.color;
                ctx.lineCap = "round";
                ctx.globalAlpha = drawAlpha * 0.16;
                ctx.lineWidth = Math.max(2, drawSize * 2.8);
                ctx.beginPath();
                ctx.moveTo(this.lastX, this.lastY);
                ctx.lineTo(this.x, this.y);
                ctx.stroke();
                ctx.globalAlpha = drawAlpha * 0.88;
                ctx.lineWidth = Math.max(0.65, drawSize * 0.46);
                ctx.stroke();
                if (this.effectRole > 0.96) {
                    ctx.globalAlpha = drawAlpha * 0.7;
                    ctx.lineWidth = Math.max(0.8, drawSize * 0.25);
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, drawSize * 1.4, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            return true;
        }

        if (shape.startsWith("pipes")) {
            if (this.effectRole >= 0.965) {
                if (this.effectRole > 0.997) {
                    this.drawLitOrb(ctx, drawSize * 6.2, drawAlpha * 0.86, settings);
                } else {
                    const radius = Math.max(2.4, drawSize * (1.65 + this.effectLane * 0.8));
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.fillStyle = this.color;
                    ctx.globalAlpha = drawAlpha * 0.20;
                    ctx.fillRect(-radius * 1.55, -radius * 1.55, radius * 3.1, radius * 3.1);
                    ctx.globalAlpha = drawAlpha * 0.88;
                    ctx.lineWidth = Math.max(0.8, drawSize * 0.32);
                    ctx.strokeStyle = this.color;
                    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
                    ctx.globalAlpha = drawAlpha * 0.72;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            } else {
                const turnedCorner = this.pipeSegment !== this.lastPipeSegment
                    ? this.getPipeRoutePoint(this.pipeSegment / 8)
                    : null;
                const tracePipeStep = () => {
                    ctx.beginPath();
                    ctx.moveTo(this.lastX, this.lastY);
                    if (turnedCorner) ctx.lineTo(turnedCorner.x, turnedCorner.y);
                    ctx.lineTo(this.x, this.y);
                    ctx.stroke();
                };
                ctx.strokeStyle = this.color;
                ctx.lineCap = "square";
                ctx.lineJoin = "miter";
                ctx.globalAlpha = drawAlpha * 0.14;
                ctx.lineWidth = Math.max(3, drawSize * 3.8);
                tracePipeStep();

                ctx.globalAlpha = drawAlpha * 0.94;
                ctx.lineWidth = Math.max(0.9, drawSize * 0.62);
                tracePipeStep();

                const atCorner = this.pipeSegment !== this.lastPipeSegment || this.pipeSegmentT < 0.045;
                if (atCorner) {
                    ctx.globalAlpha = drawAlpha * 0.82;
                    ctx.lineWidth = Math.max(0.8, drawSize * 0.28);
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, Math.max(1.5, drawSize * 1.15), 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            return true;
        }

        return false;
    }

    draw(ctx, settings) {
        const lifeRatio = Math.max(0.1, this.life / this.maxLife);
        
        // Calculate viewport scale reference
        const scaleRef = Math.max(0.4, this.viewportScale || 1.0);
        
        // Dynamic transparency fades based on age and particle preset styles
        const alpha = lifeRatio * 0.78;
        const stretch = settings.stretch ?? 1.6;
        let shape = settings.particleShape || "ellipse";
        
        // Base sizes scaled proportionally to screen width (using cached randomSizeOffset to save CPU)
        const size = Math.max(0.4, (settings.baseSize + this.randomSizeOffset * settings.sizeVariation) * (0.6 + lifeRatio * 0.5)) * scaleRef;
        
        let drawSize = size;
        let drawAlpha = alpha;

        if (this.drawAuthoredEffect(ctx, settings, drawSize, drawAlpha)) {
            return;
        }
        
        if (shape === "aquatic") {
            shape = this.aquaticType === "paint" ? "brush" : "ring";
        } else if (shape === "acid") {
            shape = "drop";
        } else if (shape === "nebula") {
            if (this.nebulaType === "cloud") {
                shape = "ellipse";
                drawSize = size * 13.75; // clouds half as big again (13.75x base size)
                drawAlpha = alpha * 0.012; // 50% more transparent (0.012 instead of 0.024)
            } else {
                shape = "drop";
                drawSize = size * 0.35; // make foreground stars tiny
                // Star twinkling flicker frequency modulation (using Date.now() to avoid undefined globalTime references)
                this.twinkleOffset = this.twinkleOffset || Math.random() * 100;
                const timeSec = Date.now() * 0.001;
                const flicker = 0.10 + Math.sin(timeSec * 16.0 + this.twinkleOffset) * 0.90; // highly twinkly/blinky
                drawAlpha = alpha * flicker * 0.95;
            }
        }
        
        // Calculate rotation angle matching velocity direction
        const angle = Math.atan2(this.vy, this.vx);
        const velocityMagnitude = Math.min(2.5, Math.sqrt(this.vx * this.vx + this.vy * this.vy));
        const dynamicStretch = 1.0 + velocityMagnitude * 0.05 * stretch;

        if (shape === "ellipse") {
            ctx.fillStyle = this.color;
            
            // 1. Soft Outer gaseous Halo
            ctx.globalAlpha = drawAlpha * 0.35;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, drawSize * (2.4 + stretch * 0.3), drawSize * (1.1 + dynamicStretch * 0.15), angle, 0, Math.PI * 2);
            ctx.fill();

            // 2. Main directional body
            ctx.globalAlpha = drawAlpha * 0.9;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, drawSize * (1.7 + stretch * 0.25), drawSize * (0.65 + dynamicStretch * 0.18), angle, 0, Math.PI * 2);
            ctx.fill();

            // 3. Inner brighter core (highlight, offset along velocity angle)
            ctx.globalAlpha = drawAlpha * 0.75;
            const coreOffset = drawSize * 0.1;
            const coreX = this.x + Math.cos(angle) * coreOffset;
            const coreY = this.y + Math.sin(angle) * coreOffset;
            ctx.beginPath();
            ctx.ellipse(coreX, coreY, drawSize * (0.7 + stretch * 0.1), drawSize * (0.38 + dynamicStretch * 0.08), angle, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "drop") {
            if ((settings.particleLighting || "glow") !== "glow") {
                this.drawLitOrb(ctx, drawSize * 1.5, drawAlpha * 0.95, settings);
                return;
            }
            ctx.fillStyle = this.color;
            ctx.globalAlpha = drawAlpha * 0.9;
            ctx.beginPath();
            ctx.arc(this.x, this.y, drawSize * 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Subtle inner light reflection node (offset rotated relative to heading)
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = drawAlpha * 0.6;
            
            const localDx = -drawSize * 0.25;
            const localDy = -drawSize * 0.25;
            const rx = localDx * Math.cos(angle) - localDy * Math.sin(angle);
            const ry = localDx * Math.sin(angle) + localDy * Math.cos(angle);
            
            ctx.beginPath();
            ctx.arc(this.x + rx, this.y + ry, drawSize * 0.45, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "ring") {
            // Optimized double-stroke glowing vector rings (eliminates shadowBlur CPU rendering block)
            ctx.strokeStyle = this.color;
            
            // 1. Thick diffuse glow base stroke
            ctx.globalAlpha = drawAlpha * 0.25;
            ctx.lineWidth = drawSize * 1.35;
            ctx.beginPath();
            ctx.arc(this.x, this.y, drawSize * (1.3 + dynamicStretch * 0.2), 0, Math.PI * 2);
            ctx.stroke();
            
            // 2. Sharp center core ring
            ctx.globalAlpha = drawAlpha * 0.85;
            ctx.lineWidth = drawSize * 0.45;
            ctx.beginPath();
            ctx.arc(this.x, this.y, drawSize * (1.3 + dynamicStretch * 0.2), 0, Math.PI * 2);
            ctx.stroke();
        } else if (shape === "brush") {
            ctx.strokeStyle = this.color;
            ctx.lineCap = "round";
            
            // Multiply drawSize by 4.2 to make the oil brush strokes 5x larger and thicker overall (preventing tiny zipper dashes)
            const brushSize = drawSize * 4.2;
            
            // 1. Draw a broad, semi-transparent base paint stroke under-layer to fill the "ruts" between bristles with soft pigment
            ctx.lineWidth = brushSize * 1.5;
            ctx.globalAlpha = drawAlpha * 0.38;
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
            
            // 2. Draw 4 distinct parallel line segments (bristles) on top, using cached orientation to avoid zipper gaps
            const bristleOffsets = [-0.60, -0.20, 0.20, 0.60];
            const px = this.perpX || 0;
            const py = this.perpY || 0;
            const lpx = this.lastPerpX || px;
            const lpy = this.lastPerpY || py;
            
            for (let i = 0; i < bristleOffsets.length; i++) {
                // Photoshop-style Jitter: Add subtle frame-to-frame randomized noise to spacing, width, and alpha
                // to break up clean digital lines and simulate dry-brush drag & canvas friction
                const jitterPos = (Math.random() - 0.5) * brushSize * 0.07;
                const lastOffsetPerp = bristleOffsets[i] * brushSize * 1.35 + jitterPos;
                const offsetPerp = bristleOffsets[i] * brushSize * 1.35 + jitterPos;
                
                // Continuous connection math: start of frame t connects precisely to end of frame t-1
                const lastBx = this.lastX + lpx * lastOffsetPerp;
                const lastBy = this.lastY + lpy * lastOffsetPerp;
                const bx = this.x + px * offsetPerp;
                const by = this.y + py * offsetPerp;
                
                // Width Jitter: Thicken/thin the bristles dynamically
                const jitterWidth = (Math.random() - 0.5) * brushSize * 0.08;
                ctx.lineWidth = Math.max(0.5, brushSize * 0.46 * (0.90 - Math.abs(bristleOffsets[i]) * 0.45) + jitterWidth);
                
                // Alpha Jitter: Create subtle gaps/fades in pigment transfer
                const jitterAlpha = (Math.random() - 0.5) * 0.08;
                ctx.globalAlpha = Math.max(0.18, drawAlpha * 0.88 * (1.0 - Math.abs(bristleOffsets[i]) * 0.30) + jitterAlpha);
                
                ctx.beginPath();
                ctx.moveTo(lastBx, lastBy);
                ctx.lineTo(bx, by);
                ctx.stroke();
            }
        } else if (shape === "cluster") {
            ctx.fillStyle = this.color;
            
            // 1. Big background circle (50-80% transparent base)
            const baseRad = drawSize * 1.5;
            ctx.globalAlpha = drawAlpha * 0.58;
            ctx.beginPath();
            ctx.arc(this.x, this.y, baseRad, 0, Math.PI * 2);
            ctx.fill();
            
            // 2. Nested smaller circles with varying sizes and opacities
            // Circle A: Central core bubble
            ctx.globalAlpha = drawAlpha * 0.76;
            ctx.beginPath();
            ctx.arc(this.x, this.y, drawSize * 0.72, 0, Math.PI * 2);
            ctx.fill();
            
            // Circle B: Offset top-left, small and faint
            ctx.globalAlpha = drawAlpha * 0.35;
            ctx.beginPath();
            ctx.arc(this.x - drawSize * 0.55, this.y - drawSize * 0.55, drawSize * 0.45, 0, Math.PI * 2);
            ctx.fill();
            
            // Circle C: Offset bottom-right, medium and brighter
            ctx.globalAlpha = drawAlpha * 0.62;
            ctx.beginPath();
            ctx.arc(this.x + drawSize * 0.5, this.y + drawSize * 0.45, drawSize * 0.58, 0, Math.PI * 2);
            ctx.fill();
            
            // Circle D: moving palette-tinted reflection; no fixed white sticker.
            const lightTime = Date.now() * 0.00008 + this.effectPhase;
            const lightX = Math.cos(lightTime);
            const lightY = Math.sin(lightTime * 0.73);
            ctx.fillStyle = this.palette?.[(this.colorIndex + 1) % this.palette.length] || this.color;
            ctx.globalAlpha = drawAlpha * ((settings.particleLighting || "glow") === "glow" ? 0.42 : 0.72);
            ctx.beginPath();
            ctx.arc(
                this.x + lightX * drawSize * 0.48,
                this.y + lightY * drawSize * 0.48,
                drawSize * 0.22,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
}


// --- SPARKLE CLASS FOR HIGH FREQUENCY SNAPS ---
class Sparkle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx + (Math.random() - 0.5) * 1.5;
        this.vy = vy + (Math.random() - 0.5) * 1.5;
        this.life = Math.random() * 18 + 8;
        this.maxLife = this.life;
        this.color = color;
        this.size = Math.random() * 1.3 + 0.6;
    }
    update(dt = 1.0) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= Math.pow(0.93, dt);
        this.vy *= Math.pow(0.93, dt);
        this.life -= dt;
    }
    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha * 0.75;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- MAIN SIMULATION WRAPPER ---
class FlowSimulation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.dpr = window.devicePixelRatio || 1;
        
        // Viewport scale factor (derived relative to standard 1600px desktop width)
        this.viewportScale = Math.min(2.0, Math.max(0.42, this.width / 1600));
        
        this.particles = [];
        this.customForces = []; // Drawn vectors field paint
        
        this.sparkles = [];
        this.vortices = [];
        window.simInstance = this;
        
        this.globalTime = 0;
        this.globalRotation = 0;
        this.lastFrameTime = Date.now();
        
        this.isPaused = false;
        
        // Dynamic configs
        this.settings = {
            speed: 1.0,
            density: 1200,
            turbulence: 0.65,
            flowOrganic: 0.85,
            dissipation: 0.012,
            zoom: 1.0,
            baseSize: 2.8,
            sizeVariation: 1.4,
            stretch: 1.6,
            interaction: 0.7,
            mouseInfluence: 0.8,
            mouseMode: "burst", // burst, attract, repel, vortex, paint
            kaleidoscopeEnabled: false,
            kaleidoscopeSegments: 6,
            rotationSpeed: 0.0,
            wobble: 0.0,
            
            // Psychedelic Mode additions
            psychedelicMode: false,
            morphingBg: false,
            spinningKaleido: false,
            particleShape: "ellipse",
            particleLighting: "glow",
            shockwavesEnabled: true,
            
            // Audio additions
            bilateralEnabled: false,
            asmrEnabled: false
        };
        
        this.palette = ["#6366f1", "#818cf8", "#a78bfa", "#c084fc"];
        this.backgroundColor = "#050507";
        this.isSolidMode = false;
        
        this.mouse = { x: this.width / 2, y: this.height / 2, active: false };
        this.shockwaves = []; // Shockwave ripple state
        
        this.initCanvas();
        this.spawnParticles();
    }

    initCanvas() {
        const d = this.dpr;
        this.canvas.width = Math.floor(this.width * d);
        this.canvas.height = Math.floor(this.height * d);
        this.ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    resize(newWidth, newHeight, customDpr) {
        const oldWidth = this.width;
        const oldHeight = this.height;

        this.width = newWidth;
        this.height = newHeight;
        this.viewportScale = Math.min(2.0, Math.max(0.42, this.width / 1600));
        
        if (customDpr !== undefined) {
            this.dpr = customDpr;
        } else {
            this.dpr = window.devicePixelRatio || 1.0;
        }

        this.initCanvas();
        
        // Calculate scale ratios
        const sx = oldWidth > 0 ? (newWidth / oldWidth) : 1.0;
        const sy = oldHeight > 0 ? (newHeight / oldHeight) : 1.0;

        // Scale existing particle states rather than resetting them
        this.particles.forEach(p => {
            p.w = this.width;
            p.h = this.height;
            p.viewportScale = this.viewportScale;
            if (sx !== 1.0 || sy !== 1.0) {
                p.x *= sx;
                p.lastX *= sx;
                p.vx *= sx;
                p.y *= sy;
                p.lastY *= sy;
                p.vy *= sy;
            }
        });

        // Scale custom force fields
        if (this.customForces && (sx !== 1.0 || sy !== 1.0)) {
            this.customForces.forEach(f => {
                f.x *= sx;
                f.y *= sy;
                f.vx *= sx;
                f.vy *= sy;
            });
        }

        // Scale vortices
        if (this.vortices && (sx !== 1.0 || sy !== 1.0)) {
            this.vortices.forEach(v => {
                v.x *= sx;
                v.y *= sy;
                v.radius *= sx;
            });
        }

        // Scale shockwaves
        if (this.shockwaves && (sx !== 1.0 || sy !== 1.0)) {
            this.shockwaves.forEach(s => {
                s.x *= sx;
                s.y *= sy;
                s.radius *= sx;
                s.maxRadius *= sx;
                s.speed *= sx;
            });
        }
    }

    spawnParticles() {
        this.particles = [];
        // Scale particle count slightly based on screen width so mobile isn't overloaded
        const scaleRef = Math.max(0.42, this.viewportScale || 1.0);
        const count = Math.round(this.settings.density * (0.35 + scaleRef * 0.65));
        for (let i = 0; i < count; i++) {
            const p = new Particle(this.width, this.height, this.palette);
            p.viewportScale = this.viewportScale;
            this.particles.push(p);
        }
        // Expose particles array globally for swarming loops
        window.particleArray = this.particles;
    }

    updateDensity() {
        const scaleRef = Math.max(0.42, this.viewportScale || 1.0);
        const target = Math.round(this.settings.density * (0.35 + scaleRef * 0.65));
        while (this.particles.length < target) {
            const p = new Particle(this.width, this.height, this.palette);
            p.viewportScale = this.viewportScale;
            this.particles.push(p);
        }
        while (this.particles.length > target) {
            this.particles.pop();
        }
    }

    updatePalette(newPalette) {
        this.palette = newPalette;
        this.particles.forEach(p => {
            p.palette = newPalette;
            // Morph current color smoothly
            p.color = p.pickColor();
        });
    }

    triggerBurst(x, y, count = 10) {
        const maxLimit = this.settings.density * 1.5; // caps absolute overheads
        if (this.particles.length >= maxLimit) return;
        
        const countToSpawn = Math.min(count, Math.max(0, maxLimit - this.particles.length));
        for (let i = 0; i < countToSpawn; i++) {
            const p = new Particle(this.width, this.height, this.palette);
            p.viewportScale = this.viewportScale;
            p.isBurst = true;
            p.x = x + (Math.random() - 0.5) * 8;
            p.y = y + (Math.random() - 0.5) * 8;
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 2.0 + Math.random() * 3.5;
            p.vx = Math.cos(angle) * velocity;
            p.vy = Math.sin(angle) * velocity;
            p.life = 25 + Math.random() * 20;
            p.maxLife = p.life;
            p.size = (this.settings.baseSize * 0.7) + Math.random() * 1.5;
            
            this.particles.push(p);
        }
    }

    triggerShockwave(x, y, force = 18.0, speed = 5.5) {
        this.shockwaves.push({
            x: x,
            y: y,
            radius: 5,
            maxRadius: Math.max(this.width, this.height) * 0.55,
            speed: speed,
            force: force
        });
    }

    triggerVortex(x, y, radius = 300, strength = 15.0, life = 45) {
        this.vortices.push({
            x: x,
            y: y,
            radius: radius,
            strength: strength,
            life: life,
            maxLife: life
        });
    }

    addCustomForce(x, y, vx, vy) {
        // Add painted vector trace
        this.customForces.push({
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            life: 45, // decays after 45 frames
            maxLife: 45
        });

        // Limit custom forces grid size
        if (this.customForces.length > 250) {
            this.customForces.shift();
        }
    }

    tick() {
        if (this.isPaused) return;

        // Delta time calculator
        const now = Date.now();
        const delta = Math.min((now - this.lastFrameTime) / 1000, 0.05); // cap at 50ms (20fps min)
        this.lastFrameTime = now;
        const dt = Math.min(delta * 60, 2.0); // normalized step, 1.0 at 60 FPS
        this.globalTime += delta * 60; // normalized speed steps

        // Update painted custom force field lifetimes
        for (let i = this.customForces.length - 1; i >= 0; i--) {
            this.customForces[i].life -= dt;
            if (this.customForces[i].life <= 0) {
                this.customForces.splice(i, 1);
            }
        }

        // Update click shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed * dt;
            if (sw.radius >= sw.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }

        // Update beat-reactive vortices
        for (let i = this.vortices.length - 1; i >= 0; i--) {
            const v = this.vortices[i];
            v.life -= dt;
            if (v.life <= 0) {
                this.vortices.splice(i, 1);
            }
        }

        // Morph background color slowly if morphingBg is enabled
        if (this.settings.morphingBg) {
            const bgHue = (this.globalTime * 0.08) % 360;
            this.backgroundColor = `hsl(${bgHue}, 28%, 3.5%)`;
        } else {
            const bgHex = document.getElementById("bg-color-picker") ? document.getElementById("bg-color-picker").value : "#050507";
            this.backgroundColor = bgHex;
        }

        this.ctx.save();

        if (this.isSolidMode) {
            // Draw clean solid background
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            // Fading trail effect (time-corrected trail dissipation)
            this.ctx.fillStyle = this.backgroundColor;
            // Approximate time-corrected alpha decay: alpha = 1 - (1 - dissipation)^dt
            const dissipationFactor = 1.0 - Math.pow(1.0 - this.settings.dissipation, dt);
            this.ctx.globalAlpha = Math.max(0.001, Math.min(1.0, dissipationFactor));
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.globalAlpha = 1.0;

            // Apply global scene rotation & wobble
            if (this.settings.rotationSpeed > 0.005) {
                const wobbleAmount = this.settings.wobble * 0.03;
                const wobbleVal = Math.sin(this.globalTime * 0.05) * wobbleAmount;
                
                this.globalRotation += ((this.settings.rotationSpeed * 0.004) + wobbleVal * 0.002) * dt;
                
                const cx = this.width / 2;
                const cy = this.height / 2;

                // Adjust scale so rotated bounds never clip screen corners (leaving black edges)
                const absCos = Math.abs(Math.cos(this.globalRotation));
                const absSin = Math.abs(Math.sin(this.globalRotation));
                const neededScale = Math.max(
                    (this.width * absCos + this.height * absSin) / this.width,
                    (this.width * absSin + this.height * absCos) / this.height
                ) * 1.02;

                this.ctx.translate(cx, cy);
                this.ctx.scale(neededScale, neededScale);
                this.ctx.rotate(this.globalRotation);
                this.ctx.translate(-cx, -cy);
            }

            // Draw Core particles
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                p.update(this.settings, this.globalTime, this.mouse, this.customForces, this.shockwaves, this.vortices, dt);
                p.draw(this.ctx, this.settings);
            }

            // Update & Draw sparkles
            for (let i = this.sparkles.length - 1; i >= 0; i--) {
                const s = this.sparkles[i];
                s.update(dt);
                s.draw(this.ctx);
                if (s.life <= 0) {
                    this.sparkles.splice(i, 1);
                }
            }

            // Clean up temporary burst particles that have completed their lifespan
            // keeping particle array aligned with target density.
            for (let i = this.particles.length - 1; i >= 0; i--) {
                if (this.particles[i].isBurst && this.particles[i].dead) {
                    this.particles.splice(i, 1);
                }
            }
            const targetCount = this.settings.density;
            if (this.particles.length > targetCount) {
                // If we are still over the target density limit, trim recycled particles
                for (let i = this.particles.length - 1; i >= targetCount; i--) {
                    if (this.particles[i].life <= 0 || !this.particles[i].isBurst) {
                        this.particles.splice(i, 1);
                    }
                }
            }

            // Expanding shockwaves are physical forces only (no white lines drawn)

            // Apply Kaleidoscope mirror reflection quadrant symmetry
            if (this.settings.kaleidoscopeEnabled) {
                const cx = this.width / 2;
                const cy = this.height / 2;
                const segments = Math.max(3, Math.floor(this.settings.kaleidoscopeSegments));
                const angleSegment = (Math.PI * 2) / segments;
                const spinAngle = this.settings.spinningKaleido ? this.globalTime * 0.002 : 0;

                // Reflect particle renders across radial quadrants
                for (let seg = 1; seg < segments; seg++) {
                    this.ctx.save();
                    this.ctx.translate(cx, cy);
                    this.ctx.rotate(angleSegment * seg + spinAngle);
                    
                    if (seg % 2 === 1) {
                        this.ctx.scale(-1, 1); // mirror reflection
                    }

                    // Render particles in mirrored section
                    for (let i = 0; i < Math.min(this.particles.length, 1200); i++) {
                        this.particles[i].draw(this.ctx, this.settings);
                    }

                    // Mirrored shockwaves are physical forces only

                    this.ctx.restore();
                }
            }
        }

        this.ctx.restore();
    }
}

// Expose simulation globally
window.FlowSimulation = FlowSimulation;
if (typeof module !== "undefined" && module.exports) {
    module.exports = FlowSimulation;
}
