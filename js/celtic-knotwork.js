// A distinct Celtic knotwork composition: multiple moving currents braid
// around rounded-square paths and through a three-lobed center.
const CelticKnotwork = (() => {
    const TAU = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    let paintLayer = null;
    let paintContext = null;
    let paintFrame = 0;
    let paintScaleTier = 0;

    function strandOffset(wave, folds, phase, strand, angle) {
        if (strand === 0) return wave * 0.10 * Math.sin(folds * angle + phase * 0.7);
        return wave * Math.cos(folds * angle + phase + (strand - 1) * TAU / 3);
    }

    function traceRing(ctx, radius, wave, folds, phase, strand, start = 0, end = TAU) {
        const steps = Math.max(12, Math.ceil((end - start) * folds * 2.1));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const angle = start + (end - start) * i / steps;
            const r = radius + wave * 0.65 * Math.sin(4 * angle + phase * 0.35)
                + strandOffset(wave, folds, phase, strand, angle);
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            // A rounded-square contour gives the familiar four-sided knot
            // silhouette; the sinusoidal radial offset interlaces its strands.
            const square = 1 / Math.sqrt(Math.sqrt(cosine ** 4 + sine ** 4));
            const x = cosine * r * square;
            const y = sine * r * square;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
    }

    function strokeRibbon(ctx, color, width, alpha) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.67;
        ctx.lineWidth = width;
        ctx.stroke();
    }

    function pointOnStrand(radius, wave, folds, phase, strand, angle) {
        const r = radius + wave * 0.65 * Math.sin(4 * angle + phase * 0.35)
            + strandOffset(wave, folds, phase, strand, angle);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const square = 1 / Math.sqrt(Math.sqrt(cosine ** 4 + sine ** 4));
        return [cosine * r * square, sine * r * square];
    }

    function drawTravelers(ctx, radius, wave, folds, phase, strand, width, color, seconds, speed, index, pointAt = pointOnStrand) {
        const count = Math.max(6, Math.min(9, folds + 1));
        const direction = strand === 1 ? -1 : 1;
        const length = Math.min(0.36, Math.max(0.12, width * 19 / radius));
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.49;
        for (let particle = 0; particle < count; particle++) {
            const head = particle / count * TAU + direction * seconds * speed * (0.90 + index * 0.036);
            const left = [], right = [], points = [];
            const samples = Math.max(10, Math.min(26,
                Math.ceil(Math.max(length * folds * 2.8, length * radius / 5))));
            for (let step = 0; step <= samples; step++) {
                const fraction = step / samples;
                const angle = head - direction * length * fraction;
                points.push(pointAt(radius, wave, folds, phase, strand, angle));
            }
            for (let step = 0; step < points.length; step++) {
                const fraction = step / samples;
                const [x, y] = points[step];
                const [px, py] = points[Math.max(0, step - 1)];
                const [nx, ny] = points[Math.min(samples, step + 1)];
                const tangentLength = Math.hypot(nx - px, ny - py) || 1;
                const normalX = -(ny - py) / tangentLength;
                const normalY = (nx - px) / tangentLength;
                const taper = Math.sqrt(1 - fraction) * Math.min(1, (fraction + 0.12) * 5);
                const halfWidth = width * (0.78 + 0.12 * (particle % 3)) * taper;
                left.push([x + normalX * halfWidth, y + normalY * halfWidth]);
                right.push([x - normalX * halfWidth, y - normalY * halfWidth]);
            }
            ctx.beginPath();
            ctx.moveTo(left[0][0], left[0][1]);
            for (let step = 1; step < left.length; step++) ctx.lineTo(left[step][0], left[step][1]);
            for (let step = right.length - 1; step >= 0; step--) ctx.lineTo(right[step][0], right[step][1]);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawRing(ctx, radius, folds, phase, width, wave, palette, index, seconds, speed) {
        const colors = [palette[(index * 2) % palette.length], palette[(index * 2 + 2) % palette.length], palette[(index * 2 + 4) % palette.length]];
        for (let strand = 0; strand < 3; strand++) {
            traceRing(ctx, radius, wave, folds, phase, strand);
            strokeRibbon(ctx, colors[strand], width * (strand === 0 ? 0.74 : 0.52),
                strand === 0 ? 0.65 : 0.46);
            drawTravelers(ctx, radius, wave, folds, phase, strand, width * 0.88,
                colors[strand], seconds, speed, index);
        }
    }

    function drawWeaveGlints(ctx, radius, wave, folds, phase, width, palette, seconds, speed, loop) {
        // A few brighter brush marks travel through the four main knot loops.
        // They borrow the active palette and fade smoothly rather than flashing.
        for (let glint = 0; glint < 2; glint++) {
            const direction = glint ? -1 : 1;
            const center = loop * 0.72 + glint * Math.PI
                + direction * seconds * speed * 0.42;
            const strand = glint ? 1 : 2;
            ctx.beginPath();
            for (let sample = 0; sample <= 12; sample++) {
                const angle = center + (sample / 12 - 0.5) * 0.18;
                const [x, y] = pointOnStrand(radius, wave, folds, phase, strand, angle);
                if (sample === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            const color = palette[(loop * 2 + glint * 2) % palette.length];
            const glow = 0.5 + 0.5 * Math.sin(seconds * speed * 0.8 + loop + glint * 2);
            ctx.strokeStyle = color;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = width * 2.6;
            ctx.globalAlpha = 0.10 + glow * 0.07;
            ctx.stroke();
            ctx.lineWidth = width * 0.84;
            ctx.globalAlpha = 0.35 + glow * 0.24;
            ctx.stroke();
        }
    }

    function pointOnTrefoil(radius, wave, folds, phase, strand, angle) {
        const petal = radius * (0.81 + 0.28 * Math.cos(3 * angle));
        const weave = strandOffset(wave, folds, phase, strand, angle);
        const r = petal + weave;
        return [Math.cos(angle) * r, Math.sin(angle) * r];
    }

    function drawTriquetra(ctx, radius, width, palette, seconds, speed) {
        ctx.save();
        ctx.rotate(seconds * speed * 0.026);
        for (let strand = 0; strand < 3; strand++) {
            ctx.beginPath();
            const steps = 120;
            for (let i = 0; i <= steps; i++) {
                const angle = i / steps * TAU;
                const [x, y] = pointOnTrefoil(radius, radius * 0.035, 18,
                    seconds * speed * 0.08, strand, angle);
                if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            const color = palette[(strand * 2) % palette.length];
            strokeRibbon(ctx, color, width * 0.64, 0.75);
            drawTravelers(ctx, radius, radius * 0.035, 18,
                seconds * speed * 0.08, strand, width * 0.9,
                color, seconds, speed, strand, pointOnTrefoil);
        }
        // Small inner braid crosses the trefoil's inward lobes instead of
        // leaving a disconnected black hole at the exact center.
        drawRing(ctx, radius * 0.56, 12, seconds * speed * -0.10,
            width * 0.76, radius * 0.025, palette, 0, seconds, speed);
        ctx.restore();
    }

    function render(ctx, width, height, seconds, settings, palette, outerSceneScale = 1) {
        if (!palette?.length || !Number.isFinite(width) || !Number.isFinite(height)) return;
        const minDim = Math.min(width, height);
        const zoomCompensation = 1 / Math.sqrt(clamp(Number(outerSceneScale) || 1, 1, 3));
        const speed = clamp(Number(settings.speed) || 0, 0, 2);
        const rotation = clamp(Number(settings.rotationSpeed) || 0, 0, 0.4);
        const wobble = clamp(Number(settings.wobble) || 0, 0, 0.7);
        const stretch = clamp(Number(settings.stretch) || 0, 0, 3);
        const size = clamp(Number(settings.baseSize) || 4.2, 1, 10) / 4.2;
        const density = clamp(Number(settings.density) || 1600, 900, 2400);
        // The outer border stays present even at low density, keeping corners
        // alive under the app's large Veil Drift zoom and rotation.
        const ringIndices = density < 1550 ? [0, 1, 2, 3, 4, 6, 9, 12]
            : density < 1900 ? [0, 1, 2, 3, 4, 5, 6, 8, 10, 12]
                : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
        const field = Math.hypot(width, height) * 0.56;
        const breath = 1 + 0.055 * Math.sin(seconds * speed * 0.55);
        const baseWidth = clamp(minDim * 0.007, 4, 11) * size;
        const offsets = [0.05, 0.09, 0.14, 0.20, 0.27, 0.35, 0.44, 0.54, 0.65, 0.77, 0.90, 1.04, 1.20];
        const folds = [8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 18, 20];
        ctx.save();
        ctx.translate(width * 0.5, height * 0.5);
        ctx.scale(zoomCompensation * breath, zoomCompensation * breath);
        // Fill gaps behind the signature crossing loops, without hiding them.
        for (const index of ringIndices) {
            ctx.save();
            const sway = Math.sin(seconds * (0.16 + index * 0.026) + index * 1.7) * wobble * 0.10;
            const spin = seconds * (index % 2 ? -1 : 1) * rotation * (0.30 + index * 0.025);
            const radius = field * offsets[index];
            ctx.rotate(spin + sway + index * 0.25);
            const wave = Math.max(baseWidth * 0.8, radius * (0.052 + stretch * 0.004))
                * (1 + 0.12 * Math.sin(seconds * speed * 0.58 + index * 0.9));
            const widthHere = baseWidth * (0.75 + index * 0.14);
            drawRing(ctx, radius, folds[index], index * 1.35 + seconds * speed * (index % 2 ? -0.12 : 0.14),
                widthHere, wave, palette, index, seconds, speed);
            ctx.restore();
        }
        // Four overlapping loops give the composition a large-scale Celtic
        // weave, beyond the smaller braid carried by each individual path.
        for (let loop = 0; loop < 4; loop++) {
            ctx.save();
            const angle = loop * TAU / 4 + Math.PI / 4 + seconds * speed * 0.014;
            const reach = minDim * 0.18;
            ctx.translate(Math.cos(angle) * reach, Math.sin(angle) * reach);
            ctx.rotate(angle);
            const radius = minDim * 0.24;
            const phase = seconds * speed * 0.09;
            const wave = radius * (0.052 + stretch * 0.004)
                * (1 + 0.16 * Math.sin(seconds * speed * 0.75 + loop * 1.25));
            const width = baseWidth * 1.25;
            drawRing(ctx, radius, 10, phase,
                width, wave,
                palette, loop + 3, seconds, speed);
            drawWeaveGlints(ctx, radius, wave, 10, phase, width, palette, seconds, speed, loop);
            ctx.restore();
        }
        drawTriquetra(ctx, minDim * 0.135, baseWidth * 0.92, palette, seconds, speed);
        ctx.restore();
    }

    function draw(ctx, width, height, seconds, settings, palette, outerSceneScale = 1) {
        // The broad translucent brush marks are fill-rate heavy on large
        // displays. Paint at a controlled size, then composite once onto the
        // app's full-size canvas. Increase source detail at high Veil Drift zoom
        // so the enlarged tapered marks do not turn into jagged polygons.
        // Small phone canvases retain native detail.
        if (typeof document === "undefined" || width * height <= 700000) {
            render(ctx, width, height, seconds, settings, palette, outerSceneScale);
            return;
        }
        const sceneScale = clamp(Number(outerSceneScale) || 1, 1, 3);
        // Hysteresis avoids resizing the canvas every frame near a zoom tier.
        if (paintScaleTier === 0 && sceneScale > 1.55) paintScaleTier = 1;
        else if (paintScaleTier === 1 && sceneScale < 1.35) paintScaleTier = 0;
        else if (paintScaleTier === 1 && sceneScale > 2.30) paintScaleTier = 2;
        else if (paintScaleTier === 2 && sceneScale < 2.05) paintScaleTier = 1;
        const scale = Math.min([0.58, 0.74, 0.95][paintScaleTier],
            2400 / Math.max(width, height), Math.sqrt(2800000 / (width * height)));
        const layerWidth = Math.max(1, Math.round(width * scale));
        const layerHeight = Math.max(1, Math.round(height * scale));
        if (!paintLayer) {
            paintLayer = document.createElement("canvas");
            paintContext = paintLayer.getContext("2d", { alpha: true });
        }
        if (!paintContext) {
            render(ctx, width, height, seconds, settings, palette, outerSceneScale);
            return;
        }
        const resized = paintLayer.width !== layerWidth || paintLayer.height !== layerHeight;
        if (resized) {
            paintLayer.width = layerWidth;
            paintLayer.height = layerHeight;
        }
        if (resized || ++paintFrame % 2 === 0) {
            paintContext.clearRect(0, 0, layerWidth, layerHeight);
            render(paintContext, layerWidth, layerHeight, seconds, settings, palette, outerSceneScale);
        }
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(paintLayer, 0, 0, width, height);
        ctx.restore();
    }

    return { draw };
})();

window.CelticKnotwork = CelticKnotwork;
if (typeof module !== "undefined" && module.exports) module.exports = CelticKnotwork;
