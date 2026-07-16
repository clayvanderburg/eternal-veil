// ==========================================================================
// ETERNAL VEIL - URL CONFIGURATION VALIDATOR & STATE SCHEMA
// Sanitizes, clamps, and secures Base64 state configurations loaded from URLs.
// Prevents out-of-bounds, infinite, or malformed parameters from crashing the app.
// ==========================================================================

const StateSchema = {
    // Valid mouse click/drag modes
    VALID_MOUSE_MODES: new Set(["burst", "attract", "repel", "vortex", "paint"]),

    // Valid particle rendering shapes
    VALID_PARTICLE_SHAPES: new Set([
        "ellipse", "drop", "ring", "aquatic", "acid", "nebula", "brush", "cluster",
        "ocean", "aurora", "orbitals", "lotus", "spiral", "pipes", "pipesTight", "pipesCathedral", "pipesShrine"
    ]),

    VALID_PARTICLE_LIGHTING: new Set(["glow", "reactive", "pearl"]),

    // Helper to sanitize numeric values within strict boundaries
    sanitizeNumber(value, fallback, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n) || isNaN(n)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, n));
    },

    // Helper to sanitize boolean flags
    sanitizeBoolean(value, fallback) {
        if (value === true || value === 1) return true;
        if (value === false || value === 0) return false;
        return fallback;
    },

    // Helper to validate and sanitize a single CSS hex color
    sanitizeHexColor(colorStr, fallback) {
        if (typeof colorStr !== "string") return fallback;
        const clean = colorStr.trim();
        // Match standard 3-digit or 6-digit hex color format (e.g. #fff, #6366f1)
        const hexRegex = /^#([A-Fa-f0-9]{3}){1,2}$/;
        if (hexRegex.test(clean)) {
            return clean;
        }
        return fallback;
    },

    // Helper to sanitize a complete color palette array
    sanitizePalette(paletteArray, fallback) {
        if (!Array.isArray(paletteArray) || paletteArray.length === 0) {
            return [...fallback];
        }
        // Limit palette size to 6 colors max to prevent performance degradation
        const cleanPalette = [];
        const limit = Math.min(6, paletteArray.length);
        
        for (let i = 0; i < limit; i++) {
            const color = paletteArray[i];
            const sanitizedColor = this.sanitizeHexColor(color, "#6366f1");
            cleanPalette.push(sanitizedColor);
        }

        // Return sanitized palette or default fallback if empty
        return cleanPalette.length > 0 ? cleanPalette : [...fallback];
    },

    // Core validation function
    sanitize(rawState) {
        if (!rawState || typeof rawState !== "object") {
            console.warn("[StateSchema] Loaded state was null or not an object. Falling back to default settings.");
            return null;
        }

        // Check schema version - version mismatch falls back safely
        if (rawState.v !== 1) {
            console.warn(`[StateSchema] Unsupported schema version: ${rawState.v}. Falling back to default settings.`);
            return null;
        }

        const sanitized = {
            settings: {
                // Physics Sliders
                speed: this.sanitizeNumber(rawState.settings?.speed, 1.0, 0.0, 8.0),
                turbulence: this.sanitizeNumber(rawState.settings?.turbulence, 0.65, 0.0, 5.0),
                density: Math.round(this.sanitizeNumber(rawState.settings?.density, 1200, 100, 8000)),
                flowOrganic: this.sanitizeNumber(rawState.settings?.flowOrganic, 0.85, 0.0, 2.0),
                dissipation: this.sanitizeNumber(rawState.settings?.dissipation, 0.012, 0.001, 0.12),
                zoom: this.sanitizeNumber(rawState.settings?.zoom, 1.0, 0.1, 7.0),

                // Particle Dynamics
                baseSize: this.sanitizeNumber(rawState.settings?.baseSize, 2.8, 0.1, 14.0),
                sizeVariation: this.sanitizeNumber(rawState.settings?.sizeVariation, 1.4, 0.0, 7.0),
                stretch: this.sanitizeNumber(rawState.settings?.stretch, 1.6, 0.0, 8.0),
                interaction: this.sanitizeNumber(rawState.settings?.interaction, 0.7, 0.0, 5.0),
                mouseInfluence: this.sanitizeNumber(rawState.settings?.mouseInfluence, 0.8, 0.0, 6.0),
                
                mouseMode: this.VALID_MOUSE_MODES.has(rawState.settings?.mouseMode) 
                    ? rawState.settings.mouseMode 
                    : "burst",

                // Kaleidoscope
                kaleidoscopeEnabled: this.sanitizeBoolean(rawState.settings?.kaleidoscopeEnabled, false),
                kaleidoscopeSegments: Math.round(this.sanitizeNumber(rawState.settings?.kaleidoscopeSegments, 6, 3, 12)),
                
                // Rotational Physics
                rotationSpeed: this.sanitizeNumber(rawState.settings?.rotationSpeed, 0.0, 0.0, 1.2),
                wobble: this.sanitizeNumber(rawState.settings?.wobble, 0.0, 0.0, 1.5),

                // Psychedelic Drives
                psychedelicMode: this.sanitizeBoolean(rawState.settings?.psychedelicMode, false),
                morphingBg: this.sanitizeBoolean(rawState.settings?.morphingBg, false),
                spinningKaleido: this.sanitizeBoolean(rawState.settings?.spinningKaleido, false),
                shockwavesEnabled: this.sanitizeBoolean(rawState.settings?.shockwavesEnabled, true),
                
                particleShape: this.VALID_PARTICLE_SHAPES.has(rawState.settings?.particleShape)
                    ? rawState.settings.particleShape
                    : "ellipse",
                particleLighting: this.VALID_PARTICLE_LIGHTING.has(rawState.settings?.particleLighting)
                    ? rawState.settings.particleLighting
                    : "glow",

                // Binaural & Audio
                bilateralEnabled: this.sanitizeBoolean(rawState.settings?.bilateralEnabled, false),
                asmrEnabled: this.sanitizeBoolean(rawState.settings?.asmrEnabled, false)
            },

            // Palette and Background colors
            palette: this.sanitizePalette(rawState.palette, ["#6366f1"]),
            backgroundColor: this.sanitizeHexColor(rawState.backgroundColor, "#050507"),
            isSolidMode: this.sanitizeBoolean(rawState.isSolidMode, false),
            autopilotEnabled: this.sanitizeBoolean(rawState.autopilotEnabled, true)
        };

        // Output warning toast indicators if raw fields differed significantly from sanitized results
        let wasClamped = false;
        if (rawState.settings) {
            const rawDensity = Number(rawState.settings.density);
            if (rawDensity > 8000 || rawDensity < 100) wasClamped = true;
            
            const rawSpeed = Number(rawState.settings.speed);
            if (rawSpeed > 8.0 || rawSpeed < 0.0) wasClamped = true;
        }

        if (wasClamped) {
            console.log("[StateSchema] Loaded URL seed values exceeded safe bounds. Clamped to safe thresholds.");
            sanitized.clampedWarning = true;
        }

        return sanitized;
    }
};

// Bind to window global scope
if (typeof window !== "undefined") {
    window.StateSchema = StateSchema;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = StateSchema;
}
