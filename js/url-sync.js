// ==========================================================================
// ETERNAL VOID - URL CONFIGURATION SYNCHRONIZER (SHARE SYSTEM)
// ==========================================================================

const UrlStateSync = {
    // Pack simulation settings and palette into a Base64 URL string
    generateShareUrl(sim, isAutopilot) {
        try {
            const state = {
                v: 1, // Schema version number
                s: parseFloat(sim.settings.speed.toFixed(2)),
                t: parseFloat(sim.settings.turbulence.toFixed(2)),
                d: parseInt(sim.settings.density),
                o: parseFloat(sim.settings.flowOrganic.toFixed(2)),
                dp: parseFloat(sim.settings.dissipation.toFixed(4)),
                z: parseFloat(sim.settings.zoom.toFixed(2)),
                sz: parseFloat(sim.settings.baseSize.toFixed(1)),
                sv: parseFloat(sim.settings.sizeVariation.toFixed(1)),
                st: parseFloat(sim.settings.stretch.toFixed(1)),
                in: parseFloat(sim.settings.interaction.toFixed(1)),
                mi: parseFloat(sim.settings.mouseInfluence.toFixed(1)),
                mm: sim.settings.mouseMode,
                ke: sim.settings.kaleidoscopeEnabled ? 1 : 0,
                ks: parseInt(sim.settings.kaleidoscopeSegments),
                rs: parseFloat(sim.settings.rotationSpeed.toFixed(2)),
                wb: parseFloat(sim.settings.wobble.toFixed(2)),
                
                // Psychedelic Drives
                pm: sim.settings.psychedelicMode ? 1 : 0,
                mb: sim.settings.morphingBg ? 1 : 0,
                sk: sim.settings.spinningKaleido ? 1 : 0,
                ps: sim.settings.particleShape,
                se: sim.settings.shockwavesEnabled ? 1 : 0,

                // Audio features
                be: sim.settings.bilateralEnabled ? 1 : 0,
                ae: sim.settings.asmrEnabled ? 1 : 0,

                p: sim.palette.map(c => parseColorToHex(c)), // array of Hex
                bg: parseColorToHex(sim.backgroundColor),
                sm: sim.isSolidMode ? 1 : 0,
                ap: isAutopilot ? 1 : 0
            };
            
            const json = JSON.stringify(state);
            // Safe cross-platform Base64 string encoder
            const encoded = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => {
                return String.fromCharCode(parseInt(p1, 16));
            }));
            
            // Generate full URL
            return `${window.location.origin}${window.location.pathname}#seed=${encoded}`;
        } catch (e) {
            console.error("[UrlSync] Encoding failed:", e);
            return null;
        }
    },

    // Unpack URL hash seed back into simulation settings
    parseUrlState() {
        const hash = window.location.hash;
        if (!hash || !hash.includes("seed=")) return null;
        
        try {
            const seedEncoded = hash.split("seed=")[1];
            if (!seedEncoded) return null;
            
            // Decodes Base64 safely
            const json = decodeURIComponent(atob(seedEncoded).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            const state = JSON.parse(json);
            
            // Map keys back to settings structure and pass through StateSchema sanitizer
            const rawObj = {
                v: state.v ?? 1,
                settings: {
                    speed: state.s,
                    turbulence: state.t,
                    density: state.d,
                    flowOrganic: state.o,
                    dissipation: state.dp,
                    zoom: state.z,
                    baseSize: state.sz,
                    sizeVariation: state.sv,
                    stretch: state.st,
                    interaction: state.in,
                    mouseInfluence: state.mi,
                    mouseMode: state.mm,
                    kaleidoscopeEnabled: state.ke === 1,
                    kaleidoscopeSegments: state.ks,
                    rotationSpeed: state.rs,
                    wobble: state.wb,
                    
                    // Psychedelic Drives
                    psychedelicMode: state.pm === 1,
                    morphingBg: state.mb === 1,
                    spinningKaleido: state.sk === 1,
                    particleShape: state.ps,
                    shockwavesEnabled: state.se !== 0, // default to true

                    // Audio additions
                    bilateralEnabled: state.be === 1,
                    asmrEnabled: state.ae === 1
                },
                palette: state.p,
                backgroundColor: state.bg,
                isSolidMode: state.sm === 1,
                autopilotEnabled: state.ap === 1
            };

            if (window.StateSchema) {
                return window.StateSchema.sanitize(rawObj);
            }
            return rawObj;
        } catch (e) {
            console.error("[UrlSync] Parsing state from URL hash failed:", e);
            return null;
        }
    }
};

// Bind to window global scope
window.UrlStateSync = UrlStateSync;
