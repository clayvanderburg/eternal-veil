// Two independently moving Celtic weave planes made from Jade-style paint marks.
// The full-screen field is intentionally oversized so rotation, breathing zoom,
// and wandering never expose a rectangular composition edge.
const CelticCurrents = (() => {
    const TAU = Math.PI * 2;
    const CELTIC_TURNS = 22.15;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function point(cy, band, strand, x, t, axisLength, amplitude, direction) {
        const span = Math.max(axisLength, 780);
        const turns = CELTIC_TURNS + band * 0.12;
        const k = turns * TAU / span;
        const phase = direction * t * 0.32 + band * 0.85;
        const drift = Math.sin(t * 0.24 + band * 1.6) * Math.min(17, axisLength * 0.022);
        const centerWave = amplitude * 0.34 * Math.sin(x * k * 0.43 - direction * t * 0.38 + band * 1.7);
        const livingAmp = amplitude * (1 + 0.16 * Math.sin(x * k * 0.27 + t * 0.43 + band));
        return cy + drift + centerWave + (strand ? 1 : -1) * livingAmp * Math.sin(x * k + phase);
    }

    function marks(ctx, config) {
        const {
            cy, band, strand, t, width, axisLength, amplitude, direction,
            spacing, palette, alpha, sizePulse
        } = config;
        const extent = axisLength + 200;
        const count = Math.ceil(extent / spacing);
        const velocity = direction * (62 + band * 5 + strand * 7) * 1.05;
        for (let n = 0; n < count; n++) {
            const x = -100 + ((n * spacing + t * velocity + band * 53 + strand * 81) % extent + extent) % extent;
            const seed = Math.sin(n * 12.9898 + band * 78.233 + strand * 39.346) * 43758.5453;
            const variation = seed - Math.floor(seed);
            const sideSeed = Math.sin(n * 31.183 + band * 19.17 + strand * 73.81) * 12515.873;
            const side = sideSeed - Math.floor(sideSeed);
            const drawSize = width * (0.48 + 0.5 * variation) * sizePulse;
            const strokeLen = Math.max(3, drawSize * 3.4);
            const strokeWidth = Math.max(1, drawSize * 1.1);
            const slope = (point(cy, band, strand, x + 3, t, axisLength, amplitude, direction)
                - point(cy, band, strand, x - 3, t, axisLength, amplitude, direction)) / 6;
            const normal = 1 / Math.hypot(1, slope);
            const y = point(cy, band, strand, x, t, axisLength, amplitude, direction)
                + (side - 0.5) * width * 1.1 * normal;
            const color = palette[(n + band + strand * 2) % palette.length] || '#5eead4';

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.atan(slope));
            ctx.fillStyle = color;
            // Exact Jade Current head and taper proportions. Canvas persistence
            // turns these overlapping marks into one coherent woven wake.
            ctx.globalAlpha = alpha * 0.11;
            ctx.beginPath(); ctx.ellipse(-strokeLen * 1.05, 0, strokeLen * 0.52, strokeWidth * 0.68, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = alpha * 0.055;
            ctx.beginPath(); ctx.ellipse(-strokeLen * 1.72, 0, strokeLen * 0.30, strokeWidth * 0.40, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = alpha * 0.28;
            ctx.beginPath(); ctx.ellipse(0, 0, strokeLen * 1.3, strokeWidth * 1.4, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = alpha * 0.85;
            ctx.beginPath(); ctx.ellipse(0, 0, strokeLen * 0.8, strokeWidth * 0.55, 0, 0, TAU); ctx.fill();
            ctx.restore();
        }
    }

    function drawFamily(ctx, config) {
        for (let band = 0; band < config.bandCount; band++) {
            const cy = config.gap * (band + 1);
            for (let strand = 0; strand < 2; strand++) marks(ctx, { ...config, cy, band, strand });
        }
    }

    function draw(ctx, width, height, seconds, settings, palette, outerSceneScale = 1) {
        const minDim = Math.min(width, height);
        const fieldSize = Math.hypot(width, height) * 1.9;
        const density = clamp(Number(settings.density) || 1500, 850, 2400);
        const rearBands = clamp(Math.round(density / 100), 10, 18);
        const frontBands = clamp(Math.round(rearBands / 2), 5, 9);
        const sizeScale = clamp((Number(settings.baseSize) || 4.8) / 4.8, 0.65, 1.6);
        const baseWidth = clamp(minDim * 0.018, 10, 24) * 0.48 * sizeScale;
        const speed = clamp((Number(settings.speed) || 0) / 0.5, 0, 3);
        const rotationStrength = clamp((Number(settings.rotationSpeed) || 0) / 0.08, 0, 2.4);
        const wanderStrength = clamp(0.55 + (Number(settings.wobble) || 0) * 5, 0.35, 1.8);
        // Velocity Stretch becomes the weave's tension control. Zero rests the
        // lattice; the normal value gives a visible but unhurried flex.
        const stretchSetting = Number(settings.stretch);
        const tension = 0.12 * clamp(Number.isFinite(stretchSetting) ? stretchSetting : 1, 0, 1.8);
        const densitySpacing = clamp(Math.sqrt(1500 / density), 0.78, 1.28);
        const qualitySpacing = (width < 700 || window.RenderQuality?.currentProfileKey === 'desktopLow') ? 1.16 : 1;
        const t = seconds * 2 * speed;
        // Veil Drift still visibly zooms the whole preset, but compensate for
        // half of that magnification inside this already layered composition.
        // Net zoom follows sqrt(outerSceneScale): adjustable, yet it no longer
        // throws most of the weave cells beyond the viewport.
        const zoomDensityCompensation = 1 / Math.sqrt(clamp(Number(outerSceneScale) || 1, 1, 3));
        const layers = [
            // The approved scratch preview's Jade marks ultimately rendered at
            // their native opacity. Keep that luminous weight here; depth comes
            // from scale, spacing, motion and overlap rather than washed-out ink.
            { scale: 0.62, alpha: 1, bands: rearBands, spacingScale: 1, angle: -Math.PI * 0.20,
                spin: 0.064, spinWave: 0.20, spinWaveRate: 0.11, direction: 1,
                breathCycle: 18.5, breathPhase: 0.25, driftPhase: 1.1 },
            { scale: 1.02, alpha: 1, bands: frontBands, spacingScale: 0.62 / 1.02, angle: Math.PI * 0.12,
                spin: 0.096, spinWave: 0.28, spinWaveRate: 0.164, direction: -1,
                breathCycle: 23.5, breathPhase: 2.35, driftPhase: 4.4 }
        ];

        for (let index = 0; index < layers.length; index++) {
            const layer = layers[index];
            const phase = seconds * TAU / layer.breathCycle + layer.breathPhase;
            const organicBreath = clamp((1 - Math.cos(phase)) * 0.5
                + Math.sin(phase * 0.47 + layer.driftPhase) * 0.055, 0, 1);
            const breathingScale = 1 + organicBreath * 0.30;
            // Offset, area-preserving tension cycles alter the diamond shapes
            // independently without changing particle count or trail opacity.
            const tensionWave = tension * (
                0.78 * Math.sin(seconds * (index ? 0.44 : 0.35) + layer.driftPhase)
                + 0.22 * Math.sin(seconds * (index ? 0.19 : 0.23) + layer.breathPhase)
            );
            const horizontalTension = 1 + tensionWave;
            const driftX = (Math.sin(seconds * (index ? 0.29 : 0.22) + layer.driftPhase)
                + 0.42 * Math.sin(seconds * (index ? 0.13 : 0.16) + layer.driftPhase * 1.7))
                * width * 0.032 * wanderStrength;
            const driftY = (Math.sin(seconds * (index ? 0.24 : 0.31) + layer.driftPhase * 0.7)
                + 0.46 * Math.cos(seconds * (index ? 0.11 : 0.14) + layer.driftPhase * 1.3))
                * height * 0.029 * wanderStrength;
            const rotation = layer.angle + layer.direction * rotationStrength
                * (seconds * layer.spin + Math.sin(seconds * layer.spinWaveRate + layer.driftPhase) * layer.spinWave);
            const gap = fieldSize / (layer.bands + 1);
            const amplitude = Math.min(gap * 0.154, (fieldSize / CELTIC_TURNS) * 0.28);
            const spacing = 72 * layer.spacingScale * densitySpacing * qualitySpacing;

            ctx.save();
            ctx.translate(width * 0.5 + driftX, height * 0.5 + driftY);
            ctx.rotate(rotation);
            const layerScale = layer.scale * breathingScale * zoomDensityCompensation;
            ctx.scale(layerScale * horizontalTension, layerScale / horizontalTension);
            ctx.translate(-fieldSize * 0.5, -fieldSize * 0.5);
            const common = { t, width: baseWidth, axisLength: fieldSize, amplitude, spacing,
                palette, alpha: layer.alpha, sizePulse: 1, bandCount: layer.bands, gap };
            drawFamily(ctx, { ...common, direction: 1 });
            ctx.save();
            ctx.translate(fieldSize, 0);
            ctx.rotate(Math.PI / 2);
            drawFamily(ctx, { ...common, direction: -1 });
            ctx.restore();
            ctx.restore();
        }
    }

    return { draw };
})();

window.CelticCurrents = CelticCurrents;
if (typeof module !== 'undefined' && module.exports) module.exports = CelticCurrents;
