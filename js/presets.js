// ==========================================================================
// ETERNAL VEIL - PRESET CONFIGURATIONS & COLOR PALETTES (UPGRADED EXTREMES)
// ==========================================================================

const StylePresets = {
    breathSanctuary: {
        name: "Breath Sanctuary",
        desc: "A spacious lotus field composed specifically for Meditation's inhale, hold, exhale, and rest cycle.",
        meditationPreset: true,
        speed: 0.30,
        turbulence: 0.08,
        curl: 0.98,
        density: 1050,
        dissipation: 0.016,
        zoom: 0.92,
        size: 4.2,
        sizeVar: 1.25,
        stretch: 0.72,
        interaction: 0.55,
        rotationSpeed: 0.025,
        wobble: 0.08,
        colors: ["#312e81", "#4f46e5", "#7c3aed", "#0f766e", "#5eead4", "#f0abfc"],
        particleShape: "lotus",
        particleLighting: "reactive",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: false,
        asmrEnabled: false
    },
    ethereal: {
        name: "Ethereal Aura",
        desc: "Slow-drifting, highly fading cosmic mist with indigo-violet whispers.",
        speed: 0.85,
        turbulence: 0.55,
        curl: 0.88,
        density: 1400,
        dissipation: 0.012,
        zoom: 0.80,
        size: 3.2,
        sizeVar: 1.6,
        stretch: 1.8,
        interaction: 0.5,
        rotationSpeed: 0.04,
        wobble: 0.10,
        colors: ["#6366f1", "#818cf8", "#a78bfa", "#c084fc", "#e9d5ff", "#c7d2fe"]
    },
    cosmic: {
        name: "Nebula Spark",
        desc: "Finer, high-density particle clouds replicating nebula formations.",
        speed: 1.25,
        turbulence: 0.90,
        curl: 0.92,
        density: 2500,
        dissipation: 0.007,
        zoom: 1.30,
        size: 1.5,
        sizeVar: 0.8,
        stretch: 1.4,
        interaction: 0.6,
        rotationSpeed: 0.08,
        wobble: 0.25,
        colors: ["#3b82f6", "#0ea5e9", "#7dd3fc", "#a855f7", "#e9d5ff", "#0284c7"]
    },
    supernova: {
        name: "Solar Flare",
        desc: "Fierce, energetic flame-like tendrils carrying massive force.",
        speed: 2.20,
        turbulence: 1.60,
        curl: 0.45,
        density: 1800,
        dissipation: 0.026,
        zoom: 0.60,
        size: 5.2,
        sizeVar: 2.5,
        stretch: 3.0,
        interaction: 1.6,
        rotationSpeed: 0.22,
        wobble: 0.65,
        colors: ["#ef4444", "#f97316", "#eab308", "#f43f5e", "#fda4af", "#fb923c"]
    },
    liquid: {
        name: "Liquid Chrome",
        desc: "Dense, viscous flowing ribbons with strong particle-to-particle repel.",
        speed: 0.60,
        turbulence: 0.35,
        curl: 0.98,
        density: 900,
        dissipation: 0.038,
        zoom: 0.95,
        size: 6.2,
        sizeVar: 2.0,
        stretch: 0.8,
        interaction: 2.4,
        rotationSpeed: 0.01,
        wobble: 0.05,
        colors: ["#14b8a6", "#06b6d4", "#22c55e", "#5eead4", "#bbf7d0", "#bae6fd"]
    },
    quantum: {
        name: "Quantum Grid",
        desc: "Rapidly mutating, short-lived microscopic particle nodes.",
        speed: 2.80,
        turbulence: 2.20,
        curl: 0.15,
        density: 3000,
        dissipation: 0.058,
        zoom: 2.80,
        size: 1.0,
        sizeVar: 0.3,
        stretch: 3.8,
        interaction: 0.1,
        rotationSpeed: 0.60,
        wobble: 1.20,
        colors: ["#ec4899", "#f472b6", "#fda4af", "#3b82f6", "#a855f7", "#ffffff"]
    },
    vortex: {
        name: "Black Hole Vortex",
        desc: "Extreme rotation speed drawing particles into a swirling central gravity sink.",
        speed: 1.60,
        turbulence: 0.40,
        curl: 0.95,
        density: 2000,
        dissipation: 0.015,
        zoom: 0.70,
        size: 2.4,
        sizeVar: 1.2,
        stretch: 2.2,
        interaction: 1.2,
        rotationSpeed: 1.10,
        wobble: 0.40,
        colors: ["#7c3aed", "#4f46e5", "#06b6d4", "#111827", "#312e81", "#1e1b4b"]
    },
    mandala: {
        name: "Mandala Zen",
        desc: "Hypnotic geometric symmetry using high axis mirroring and slow rotations.",
        speed: 0.50,
        turbulence: 0.20,
        curl: 0.90,
        density: 1200,
        dissipation: 0.022,
        zoom: 1.10,
        size: 3.5,
        sizeVar: 1.5,
        stretch: 0.5,
        interaction: 1.8,
        rotationSpeed: 0.15,
        wobble: 0.80,
        colors: ["#f43f5e", "#ec4899", "#eab308", "#10b981", "#06b6d4", "#a855f7"]
    },
    strings: {
        name: "Cosmic Strings",
        desc: "Extremely elongated flowing filaments tracing direct line streams.",
        speed: 2.50,
        turbulence: 0.60,
        curl: 0.85,
        density: 1500,
        dissipation: 0.008,
        zoom: 0.45,
        size: 1.8,
        sizeVar: 0.5,
        stretch: 4.0,
        interaction: 0.4,
        rotationSpeed: 0.03,
        wobble: 0.05,
        colors: ["#38bdf8", "#818cf8", "#c084fc", "#e2e8f0", "#a78bfa", "#22d3ee"]
    },
    hypno: {
        name: "Hypnotic Spiral",
        desc: "Six luminous arms breathe, rotate, and carry bright travelers through a deep spiral.",
        speed: 0.78,
        turbulence: 0.12,
        curl: 0.98,
        density: 1600,
        dissipation: 0.007,
        zoom: 0.70,
        size: 2.6,
        sizeVar: 0.9,
        stretch: 2.2,
        interaction: 1.2,
        rotationSpeed: 0.10,
        wobble: 0.28,
        colors: ["#7c3aed", "#c084fc", "#22d3ee", "#f0abfc", "#818cf8", "#ecfeff"],
        
        // Custom flags for new Psychedelic Drives
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        particleShape: "spiral",
        kaleidoscopeEnabled: false,
        
        // Custom audio extensions
        bilateralEnabled: true,
        asmrEnabled: true
    },
    aquatic: {
        name: "Aquatic Bubbles",
        desc: "Thick paint-stroke currents flowing rightward while glowing bubble rings rise leftward.",
        speed: 0.60,
        turbulence: 0.65,
        curl: 0.75,
        density: 1600,
        dissipation: 0.015,
        zoom: 0.85,
        size: 7.0,
        sizeVar: 3.5,
        stretch: 1.0,
        interaction: 1.2,
        rotationSpeed: 0.02,
        wobble: 0.20,
        colors: ["#0ea5e9", "#38bdf8", "#06b6d4", "#22d3ee", "#e0f2fe", "#0284c7"],
        particleShape: "aquatic",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: false,
        asmrEnabled: true
    },
    chakra: {
        name: "Chakra Alignment",
        desc: "Slow-breathing symmetrical mandala of emerald, indigo, and gold for focus.",
        speed: 0.40,
        turbulence: 0.15,
        curl: 0.95,
        density: 1200,
        dissipation: 0.014,
        zoom: 1.10,
        size: 3.8,
        sizeVar: 1.8,
        stretch: 0.6,
        interaction: 2.2,
        rotationSpeed: 0.04,
        wobble: 0.35,
        colors: ["#10b981", "#059669", "#4f46e5", "#6366f1", "#eab308", "#fef08a"],
        particleShape: "ellipse",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: true,
        kaleidoscopeSegments: 8,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    acid: {
        name: "Acid Rain",
        desc: "Torrential downpour of melting rainbow droplets shifting and warping dynamically.",
        speed: 1.80,
        turbulence: 0.95,
        curl: 0.55,
        density: 2000,
        dissipation: 0.035,
        zoom: 0.65,
        size: 4.5,
        sizeVar: 2.0,
        stretch: 3.5,
        interaction: 0.6,
        rotationSpeed: 0.05,
        wobble: 0.85,
        colors: ["#ff007f", "#39ff14", "#00ffff", "#ffff00", "#ff00ff", "#00ff00"],
        particleShape: "acid", // Custom physics check for falling acid rain
        psychedelicMode: true,
        morphingBg: true,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: false,
        asmrEnabled: true
    },
    fractal: {
        name: "Fractal Nebula",
        desc: "High-axis, hyper-active particle strings looping into complex geometric fractals.",
        speed: 2.40,
        turbulence: 1.50,
        curl: 0.60,
        density: 2500,
        dissipation: 0.009,
        zoom: 1.25,
        size: 1.6,
        sizeVar: 0.8,
        stretch: 3.5,
        interaction: 0.8,
        rotationSpeed: 0.75,
        wobble: 1.10,
        colors: ["#ec4899", "#f43f5e", "#0ea5e9", "#06b6d4", "#a855f7", "#ffffff"],
        particleShape: "ring",
        psychedelicMode: true,
        morphingBg: true,
        spinningKaleido: true,
        kaleidoscopeEnabled: true,
        kaleidoscopeSegments: 12,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    nebula: {
        name: "Cosmic Nebula",
        desc: "Twinkling foreground starlight floating over giant, slow-drifting background clouds of colored gas.",
        speed: 0.95,
        turbulence: 0.50,
        curl: 0.90,
        density: 1800,
        dissipation: 0.009,
        zoom: 0.80,
        size: 3.5,
        sizeVar: 1.5,
        stretch: 1.2,
        interaction: 0.8,
        rotationSpeed: 0.01,
        wobble: 0.15,
        colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#d8b4fe", "#bae6fd", "#ffffff"],
        particleShape: "nebula",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    oil: {
        name: "Impressionist Oil",
        desc: "Streaky, textured bristle oil brush strokes layering over each other in rich ochre, sienna, and warm forest hues.",
        speed: 0.85,
        turbulence: 0.70,
        curl: 0.80,
        density: 1400,
        dissipation: 0.015,
        zoom: 0.90,
        size: 8.0,
        sizeVar: 3.5,
        stretch: 2.2,
        interaction: 1.4,
        rotationSpeed: 0.02,
        wobble: 0.35,
        colors: ["#c2410c", "#ea580c", "#d97706", "#ca8a04", "#854d0e", "#15803d", "#f59e0b"],
        particleShape: "brush",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    cluster: {
        name: "Cosmic Organelles",
        desc: "Nested clusters of bubble membranes with 3D specular highlights floating in a slow, glowing fluid matrix.",
        speed: 0.70,
        turbulence: 0.45,
        curl: 0.88,
        density: 1200,
        dissipation: 0.012,
        zoom: 0.85,
        size: 7.5,
        sizeVar: 3.0,
        stretch: 1.0,
        interaction: 1.5,
        rotationSpeed: 0.02,
        wobble: 0.15,
        colors: ["#a855f7", "#ec4899", "#06b6d4", "#22d3ee", "#e0f2fe", "#fdf4ff", "#ffffff"],
        particleShape: "cluster",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    oceanRain: {
        name: "Rain Ocean",
        desc: "Thick layered waves roll across the lower world while fine rain falls beneath a few enormous luminous moons.",
        speed: 0.72,
        turbulence: 0.18,
        curl: 0.82,
        density: 1800,
        dissipation: 0.018,
        zoom: 0.90,
        size: 4.8,
        sizeVar: 2.1,
        stretch: 2.0,
        interaction: 0.35,
        rotationSpeed: 0.0,
        wobble: 0.08,
        colors: ["#0ea5e9", "#22d3ee", "#67e8f9", "#2563eb", "#a5f3fc", "#f0abfc"],
        particleShape: "ocean",
        particleLighting: "reactive",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    auroraCathedral: {
        name: "Aurora Cathedral",
        desc: "Tall translucent light curtains breathe in ordered columns with drifting stars between them.",
        speed: 0.52,
        turbulence: 0.20,
        curl: 0.90,
        density: 1450,
        dissipation: 0.014,
        zoom: 1.05,
        size: 5.6,
        sizeVar: 2.4,
        stretch: 1.2,
        interaction: 0.3,
        rotationSpeed: 0.0,
        wobble: 0.10,
        colors: ["#22c55e", "#2dd4bf", "#38bdf8", "#818cf8", "#c084fc", "#f0abfc"],
        particleShape: "aurora",
        particleLighting: "glow",
        psychedelicMode: false,
        morphingBg: true,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    celestialOrrery: {
        name: "Celestial Orrery",
        desc: "Clearly layered orbital paths carry pearls and moons around a slow radiant center.",
        speed: 0.62,
        turbulence: 0.10,
        curl: 0.96,
        density: 1050,
        dissipation: 0.010,
        zoom: 0.82,
        size: 3.4,
        sizeVar: 1.8,
        stretch: 1.4,
        interaction: 0.55,
        rotationSpeed: 0.0,
        wobble: 0.04,
        colors: ["#f59e0b", "#fef08a", "#38bdf8", "#818cf8", "#c084fc", "#f8fafc"],
        particleShape: "orbitals",
        particleLighting: "pearl",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    lotusPulse: {
        name: "Lotus Pulse",
        desc: "Ten curved luminous petals spin like a breathing pinwheel while the whole bloom slowly wanders.",
        speed: 0.46,
        turbulence: 0.08,
        curl: 0.98,
        density: 1350,
        dissipation: 0.013,
        zoom: 1.0,
        size: 3.8,
        sizeVar: 1.6,
        stretch: 2.0,
        interaction: 0.4,
        rotationSpeed: 0.08,
        wobble: 0.10,
        colors: ["#fb7185", "#f472b6", "#c084fc", "#818cf8", "#67e8f9", "#fde68a"],
        particleShape: "lotus",
        particleLighting: "reactive",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    neonConduits: {
        name: "Neon Conduits",
        desc: "Luminous energy pipes traverse a geometric labyrinth, snapping through deliberate 90° turns and glowing junctions.",
        speed: 0.48,
        turbulence: 0.0,
        curl: 1.0,
        density: 1450,
        dissipation: 0.009,
        zoom: 0.92,
        size: 3.6,
        sizeVar: 1.25,
        stretch: 2.8,
        interaction: 0.0,
        rotationSpeed: 0.0,
        wobble: 0.0,
        colors: ["#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#4ade80"],
        particleShape: "pipes",
        particleLighting: "reactive",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    circuitCity: {
        name: "Circuit City",
        desc: "A dense living motherboard of tiny neon routes, rapid data pulses, and tightly packed right-angle streets.",
        speed: 0.62,
        turbulence: 0.0,
        curl: 1.0,
        density: 2100,
        dissipation: 0.012,
        zoom: 1.08,
        size: 2.35,
        sizeVar: 0.72,
        stretch: 2.2,
        interaction: 0.0,
        rotationSpeed: 0.0,
        wobble: 0.0,
        colors: ["#00f5d4", "#00bbf9", "#9b5de5", "#f15bb5", "#fee440", "#7cff6b"],
        particleShape: "pipesTight",
        particleLighting: "reactive",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    conduitCathedral: {
        name: "Conduit Cathedral",
        desc: "Monumental luminous frames rise like impossible architecture while slow energy pilgrims cross their vast corners.",
        speed: 0.28,
        turbulence: 0.0,
        curl: 1.0,
        density: 820,
        dissipation: 0.006,
        zoom: 0.78,
        size: 5.8,
        sizeVar: 1.6,
        stretch: 3.4,
        interaction: 0.0,
        rotationSpeed: 0.0,
        wobble: 0.0,
        colors: ["#fef3c7", "#fbbf24", "#fb7185", "#c084fc", "#67e8f9", "#e0f2fe"],
        particleShape: "pipesCathedral",
        particleLighting: "pearl",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: false,
        bilateralEnabled: true,
        asmrEnabled: true
    },
    circuitShrine: {
        name: "Circuit Shrine",
        desc: "Nested square circuits breathe around a radiant center—part mandala, part machine-temple, all precise 90° motion.",
        speed: 0.38,
        turbulence: 0.0,
        curl: 1.0,
        density: 1350,
        dissipation: 0.008,
        zoom: 0.9,
        size: 3.9,
        sizeVar: 1.0,
        stretch: 2.8,
        interaction: 0.0,
        rotationSpeed: 0.0,
        wobble: 0.0,
        colors: ["#22d3ee", "#818cf8", "#d946ef", "#fb7185", "#facc15", "#ffffff"],
        particleShape: "pipesShrine",
        particleLighting: "reactive",
        psychedelicMode: false,
        morphingBg: false,
        spinningKaleido: false,
        kaleidoscopeEnabled: true,
        bilateralEnabled: true,
        asmrEnabled: true
    }
};

// Curated Palettes for Autopilot changes & Randomizer
const CuratedPalettes = [
    ["#f97316", "#fb923c", "#fed7aa", "#ef4444", "#f87171"],
    ["#8b5cf6", "#a78bfa", "#ddd6fe", "#d8b4fe", "#c084fc"],
    ["#14b8a6", "#5eead4", "#99f6e4", "#0ea5e9", "#7dd3fc"],
    ["#ef4444", "#f87171", "#eab308", "#fde047", "#fca5a5"],
    ["#22c55e", "#4ade80", "#bbf7d0", "#14b8a6", "#5eead4"],
    ["#ec4899", "#f472b6", "#3b82f6", "#60a5fa", "#ffffff"],
    ["#6366f1", "#818cf8", "#f43f5e", "#fda4af", "#ffedd5"],
    ["#a855f7", "#ec4899", "#ff007f", "#39ff14", "#00ffff", "#ffff00"] // Hyper-Neon Extreme
];

function generateHarmoniousPalette(personality = "alive") {
    const baseHue = Math.floor(Math.random() * 360);
    const mode = Math.random();
    
    let palette = [];
    if (personality === "serene") {
        const spread = 14 + Math.floor(Math.random() * 13);
        palette = [-2, -1, 0, 1, 2].map((step, index) =>
            `hsl(${(baseHue + step * spread + 360) % 360}, ${58 + index * 4}%, ${42 + index * 6}%)`
        );
    } else if (mode < (personality === "wild" ? 0.22 : 0.4)) {
        // Analogous (Harmonious neighbors)
        palette = [
            `hsl(${baseHue}, 95%, 55%)`,
            `hsl(${(baseHue + 20) % 360}, 90%, 60%)`,
            `hsl(${(baseHue + 40) % 360}, 85%, 65%)`,
            `hsl(${(baseHue - 20 + 360) % 360}, 90%, 50%)`,
            `hsl(${(baseHue - 40 + 360) % 360}, 80%, 45%)`
        ];
    } else if (mode < (personality === "wild" ? 0.48 : 0.72)) {
        // Complementary / Split Complementary
        const compHue = (baseHue + 180) % 360;
        palette = [
            `hsl(${baseHue}, 95%, 55%)`,
            `hsl(${(baseHue + 15) % 360}, 85%, 60%)`,
            `hsl(${(baseHue - 15 + 360) % 360}, 85%, 50%)`,
            `hsl(${compHue}, 90%, 55%)`,
            `hsl(${(compHue + 20) % 360}, 80%, 65%)`
        ];
    } else if (mode < (personality === "wild" ? 0.72 : 1.0)) {
        // Triadic (highly contrasting)
        const hue2 = (baseHue + 120) % 360;
        const hue3 = (baseHue + 240) % 360;
        palette = [
            `hsl(${baseHue}, 95%, 55%)`,
            `hsl(${baseHue}, 70%, 75%)`,
            `hsl(${hue2}, 90%, 55%)`,
            `hsl(${hue2}, 60%, 70%)`,
            `hsl(${hue3}, 90%, 60%)`
        ];
    } else {
        // Totally wild extreme random colors
        palette = [
            `hsl(${Math.random() * 360}, 100%, 50%)`,
            `hsl(${Math.random() * 360}, 100%, 55%)`,
            `hsl(${Math.random() * 360}, 100%, 60%)`,
            `hsl(${Math.random() * 360}, 100%, 65%)`,
            `hsl(${Math.random() * 360}, 100%, 50%)`
        ];
    }
    return palette;
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function parseColorToHex(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return "#ffffff";
    if (colorStr.startsWith('#')) return colorStr;
    if (colorStr.startsWith('hsl')) {
        // Preserve decimal/negative hues. The old digit-only parser split a hue
        // such as 123.45 into two fields, often reading 100% as lightness and
        // silently turning a generated palette color pure white.
        const match = colorStr.trim().match(
            /^hsla?\(\s*([-+\d.]+)(?:deg)?\s*[, ]\s*([-+\d.]+)%\s*[, ]\s*([-+\d.]+)%/i
        );
        if (match) {
            return hslToHex(Number(match[1]), Number(match[2]), Number(match[3]));
        }
    }
    return "#ffffff";
}
