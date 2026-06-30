// ==========================================================================
// ETERNAL VEIL - URL CONFIGURATION SYNCHRONIZER (SHARE SYSTEM)
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
            
            // Map keys back to settings structure
            return {
                settings: {
                    speed: state.s ?? 1.0,
                    turbulence: state.t ?? 0.65,
                    density: state.d ?? 1200,
                    flowOrganic: state.o ?? 0.85,
                    dissipation: state.dp ?? 0.012,
                    zoom: state.z ?? 1.0,
                    baseSize: state.sz ?? 2.8,
                    sizeVariation: state.sv ?? 1.4,
                    stretch: state.st ?? 1.6,
                    interaction: state.in ?? 0.7,
                    mouseInfluence: state.mi ?? 0.8,
                    mouseMode: state.mm ?? "burst",
                    kaleidoscopeEnabled: state.ke === 1,
                    kaleidoscopeSegments: state.ks ?? 6,
                    rotationSpeed: state.rs ?? 0.0,
                    wobble: state.wb ?? 0.0,
                    
                    // Psychedelic Drives
                    psychedelicMode: state.pm === 1,
                    morphingBg: state.mb === 1,
                    spinningKaleido: state.sk === 1,
                    particleShape: state.ps ?? "ellipse",
                    shockwavesEnabled: state.se !== 0, // default to true

                    // Audio additions
                    bilateralEnabled: state.be === 1,
                    asmrEnabled: state.ae === 1
                },
                palette: state.p ?? ["#6366f1"],
                backgroundColor: state.bg ?? "#050507",
                isSolidMode: state.sm === 1,
                autopilotEnabled: state.ap === 1
            };
        } catch (e) {
            console.error("[UrlSync] Parsing state from URL hash failed:", e);
            return null;
        }
    }
};

// Bind to window global scope
window.UrlStateSync = UrlStateSync;
