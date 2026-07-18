// ==========================================================================
// ETERNAL VOID - RENDER QUALITY CONTROLLER
// Defines resolution, frame rate targets, and adaptive quality profiles
// for desktop 3D and VR headset modes. Decouples simulation ticks from renders.
// ==========================================================================

const RenderQuality = {
    PROFILES: {
        desktopLow: {
            width: 1024,
            height: 576,
            flowHz: 30,
            dpr: 1.0,
            label: "Desktop Low"
        },
        desktopBalanced: {
            width: 1536,
            height: 864,
            flowHz: 45,
            dpr: 1.0,
            label: "Desktop Balanced"
        },
        desktopHigh: {
            width: 1920,
            height: 1080,
            flowHz: 60,
            dpr: 1.0,
            label: "Desktop High"
        },
        vrBalanced: {
            width: 2048,
            height: 1024,
            flowHz: 45,
            dpr: 1.0,
            label: "VR Balanced (2:1)"
        },
        vrHigh: {
            width: 3072,
            height: 1536,
            flowHz: 45,
            dpr: 1.0,
            label: "VR High (2:1)"
        },
        vrUltra: {
            width: 4096,
            height: 2048,
            flowHz: 60,
            dpr: 1.0,
            label: "VR Ultra (2:1)"
        }
    },

    currentProfileKey: "desktopHigh",

    // Performance metrics
    averageFrameInterval: 16.6, // EWMA in ms
    flowMsAvg: 0.0,            // CPU time spent in particle simulation
    canvasDrawMsAvg: 0.0,       // CPU time spent rendering WebGL scene
    
    // Hysteresis & Cooldown parameters
    downgradeStreak: 0,
    lastTierChangeTime: 0,
    cooldownMs: 5000,
    stableHeadroomStartTime: 0,

    getProfile(key) {
        const k = key || this.currentProfileKey;
        return this.PROFILES[k] || this.PROFILES.desktopHigh;
    },

    // Track performance metrics via Exponentially Weighted Moving Average (EWMA)
    sampleFrame(frameDuration, flowMs, canvasMs) {
        this.averageFrameInterval = this.averageFrameInterval * 0.95 + frameDuration * 0.05;
        if (flowMs !== undefined) {
            this.flowMsAvg = this.flowMsAvg * 0.95 + flowMs * 0.05;
        }
        if (canvasMs !== undefined) {
            this.canvasDrawMsAvg = this.canvasDrawMsAvg * 0.95 + canvasMs * 0.05;
        }
        
        // Evaluate if quality changes are required
        this.evaluateQuality();
    },

    evaluateQuality() {
        const now = performance.now();
        if (now - this.lastTierChangeTime < this.cooldownMs) {
            return; // In quality tier transition cooldown
        }
        
        const activeProfile = this.getProfile();
        const targetInterval = 1000 / (activeProfile.flowHz || 60);
        
        // Budget miss: if average frame latency is 4ms higher than the target rate threshold
        const isBudgetMiss = this.averageFrameInterval > (targetInterval + 4.0);
        
        if (isBudgetMiss) {
            this.stableHeadroomStartTime = 0;
            this.downgradeStreak++;
            if (this.downgradeStreak >= 45) { // sustained budget miss for ~1 second (45 samples)
                this.downgradeQuality();
            }
        } else {
            this.downgradeStreak = 0;
            if (this.stableHeadroomStartTime === 0) {
                this.stableHeadroomStartTime = now;
            } else if (now - this.stableHeadroomStartTime > 10000) { // 10 seconds of stable headroom
                this.upgradeQuality();
            }
        }
    },

    downgradeQuality() {
        const sequence = ["vrUltra", "vrHigh", "vrBalanced", "desktopHigh", "desktopBalanced", "desktopLow"];
        const curIdx = sequence.indexOf(this.currentProfileKey);
        
        if (curIdx !== -1 && curIdx < sequence.length - 1) {
            const nextKey = sequence[curIdx + 1];
            
            // VR Safety: do not automatically drop into desktop profiles if active in VR mode
            const inVR = window.sim3D && window.sim3D.renderer.xr.isPresenting;
            if (inVR && nextKey.startsWith("desktop")) {
                return; // Stays at vrBalanced (our lowest VR tier) to prevent screen shape stretching
            }
            
            this.changeProfile(nextKey, "Performance pressure / sustained budget miss");
        }
    },

    upgradeQuality() {
        const sequence = ["vrUltra", "vrHigh", "vrBalanced", "desktopHigh", "desktopBalanced", "desktopLow"];
        const curIdx = sequence.indexOf(this.currentProfileKey);
        
        if (curIdx > 0) {
            const nextKey = sequence[curIdx - 1];
            
            // Only upgrade to VR profiles if actually presenting inside VR
            const inVR = window.sim3D && window.sim3D.renderer.xr.isPresenting;
            const targetIsVr = nextKey.startsWith("vr");
            if (targetIsVr && !inVR) {
                return; // Maintain desktopHigh as highest desktop profile
            }
            
            this.changeProfile(nextKey, "Stable frame times / visual clarity headroom");
        }
    },

    changeProfile(newKey, reason) {
        this.currentProfileKey = newKey;
        this.lastTierChangeTime = performance.now();
        this.downgradeStreak = 0;
        this.stableHeadroomStartTime = 0;
        
        const profile = this.getProfile();
        console.log(`[RenderQuality] Quality Tier shifted to: ${profile.label}. Reason: ${reason}`);
        if (window.CosmicLogger) {
            window.CosmicLogger.info(`Quality Tier shifted to: ${profile.label} (${profile.width}x${profile.height} @ ${profile.flowHz}Hz).`);
        }
        
        // Apply resize to visualizer immediately
        if (window.sim) {
            window.sim.resize(profile.width, profile.height, 1.0);
        }
    }
};

// Expose globally
window.RenderQuality = RenderQuality;
if (typeof module !== "undefined" && module.exports) {
    module.exports = RenderQuality;
}
