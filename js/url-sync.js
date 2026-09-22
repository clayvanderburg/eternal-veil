// ==========================================================================
// ETERNAL VOID - URL CONFIGURATION SYNCHRONIZER (SHARE SYSTEM)
// ==========================================================================

const UrlStateSync = {
    // Keep these wire-format tables stable: changing their order would change old scenes.
    shapes: ["ellipse", "drop", "ring", "aquatic", "acid", "nebula", "brush", "cluster",
        "ocean", "aurora", "orbitals", "lotus", "spiral", "pendulumSpiral", "tightTailVortex",
        "painterlyVortex", "pipes", "pipesTight", "pipesCathedral", "pipesShrine", "zenMandala",
        "quantumLattice", "gravityWell", "fractalBloom", "chromeRibbon", "jadeCurrents",
        "celticCurrent", "quantumDrift", "prismDrift", "nebulaSpark", "solarFlare", "violetUndertow"],
    mouseModes: ["burst", "attract", "repel", "vortex", "paint"],
    lightingModes: ["glow", "reactive", "pearl", "metal"],
    binauralModes: ["delta", "theta", "alpha", "beta", "gamma"],

    // V2 packs the same fields as the legacy JSON link into about 60 bytes.
    packState(state) {
        const bytes = [];
        const byte = value => bytes.push(Math.max(0, Math.min(255, Math.round(value) || 0)));
        const word = value => { const n = Math.max(0, Math.min(65535, Math.round(value) || 0)); byte(n >> 8); byte(n & 255); };
        const choice = (table, value) => { const index = table.indexOf(value); byte(index < 0 ? 0 : index); };
        const color = value => {
            const hex = String(value || "#000000").replace(/^#/, "");
            const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
            for (let i = 0; i < 6; i += 2) byte(parseInt(full.slice(i, i + 2), 16));
        };
        byte(2);
        word(state.s * 100); word(state.t * 100); word(state.d); word(state.o * 100);
        word(state.dp * 10000); word(state.z * 100);
        byte(state.sz * 10); byte(state.sv * 10); byte(state.st * 10);
        byte(state.in * 10); byte(state.mi * 10); byte(state.ks);
        word(state.rs * 100); word(state.wb * 100);
        choice(this.mouseModes, state.mm); choice(this.shapes, state.ps);
        choice(this.lightingModes, state.pl); choice(this.binauralModes, state.bm);
        const flags = [state.ke, state.pm, state.mb, state.sk, state.se, state.be,
            state.ae, state.sm, state.ap, state.vm, state.vs === "dome"];
        word(flags.reduce((bits, on, index) => bits | ((on ? 1 : 0) << index), 0));
        byte(state.p.length);
        state.p.forEach(color);
        color(state.bg);
        return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },

    unpackState(encoded) {
        if (!/^[A-Za-z0-9_-]{40,160}$/.test(encoded)) return null;
        const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
        let offset = 0;
        const byte = () => { if (offset >= bytes.length) throw new Error("Truncated scene"); return bytes[offset++]; };
        const word = () => (byte() << 8) | byte();
        const choice = table => { const value = table[byte()]; if (!value) throw new Error("Invalid scene choice"); return value; };
        const color = () => `#${Array.from({ length: 3 }, () => byte().toString(16).padStart(2, "0")).join("")}`;
        if (byte() !== 2) return null;
        const state = { v: 1 };
        state.s = word() / 100; state.t = word() / 100; state.d = word(); state.o = word() / 100;
        state.dp = word() / 10000; state.z = word() / 100;
        state.sz = byte() / 10; state.sv = byte() / 10; state.st = byte() / 10;
        state.in = byte() / 10; state.mi = byte() / 10; state.ks = byte();
        state.rs = word() / 100; state.wb = word() / 100;
        state.mm = choice(this.mouseModes); state.ps = choice(this.shapes);
        state.pl = choice(this.lightingModes); state.bm = choice(this.binauralModes);
        const flags = word();
        ["ke", "pm", "mb", "sk", "se", "be", "ae", "sm", "ap", "vm"].forEach((key, index) => {
            state[key] = (flags >> index) & 1;
        });
        state.vs = flags & (1 << 10) ? "dome" : "native";
        const count = byte();
        if (count < 1 || count > 6 || bytes.length !== offset + count * 3 + 3) return null;
        state.p = Array.from({ length: count }, color);
        state.bg = color();
        return state;
    },

    // Pack simulation settings and palette into a compact, self-contained URL.
    generateShareUrl(sim, isAutopilot, presentation = {}) {
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
                pl: sim.settings.particleLighting || "glow",
                se: sim.settings.shockwavesEnabled ? 1 : 0,

                // Audio features
                be: sim.settings.bilateralEnabled ? 1 : 0,
                ae: sim.settings.asmrEnabled ? 1 : 0,
                bm: sim.settings.binauralMode || "theta",

                p: sim.palette.map(c => parseColorToHex(c)), // array of Hex
                bg: parseColorToHex(sim.backgroundColor),
                sm: sim.isSolidMode ? 1 : 0,
                ap: isAutopilot ? 1 : 0,
                vm: presentation.is3DMode ? 1 : 0,
                vs: presentation.style === "dome" ? "dome" : "native"
            };
            
            return `${window.location.origin}${window.location.pathname}#scene=${this.packState(state)}`;
        } catch (e) {
            console.error("[UrlSync] Encoding failed:", e);
            return null;
        }
    },

    // Unpack URL hash seed back into simulation settings
    parseUrlState() {
        const hash = window.location.hash;
        if (!hash || (!hash.startsWith("#seed=") && !hash.startsWith("#scene="))) return null;
        
        try {
            let state;
            if (hash.startsWith("#scene=")) {
                state = this.unpackState(hash.slice(7));
            } else {
                const seedEncoded = hash.slice(6);
                if (!seedEncoded) return null;
                const json = decodeURIComponent(atob(seedEncoded).split('').map(c =>
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                state = JSON.parse(json);
            }
            if (!state) return null;
            
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
                    particleLighting: state.pl,
                    shockwavesEnabled: state.se !== 0, // default to true

                    // Audio additions
                    bilateralEnabled: state.be === 1,
                    asmrEnabled: state.ae === 1,
                    binauralMode: state.bm
                },
                palette: state.p,
                backgroundColor: state.bg,
                isSolidMode: state.sm === 1,
                autopilotEnabled: state.ap === 1,
                presentation: {
                    is3DMode: state.vm === 1,
                    style: state.vs === "dome" ? "dome" : "native"
                }
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
