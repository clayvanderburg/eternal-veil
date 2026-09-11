// Deliberately composed alternatives. Existing geometry identifiers stay intact.
const PresetCompositions = {
    supports(shape) { return ['zenMandala', 'quantumLattice', 'gravityWell', 'fractalBloom'].includes(shape); },
    point(shape, lane, role, phase, time) {
        const tau = Math.PI * 2;
        if (shape === 'fractalBloom') {
            // Six recursive binary trees: each generation repeats the same
            // fork at a smaller scale. All particles share the branch skeleton.
            const arm = Math.min(5, Math.floor(lane * 6));
            const layer = Math.min(7, Math.floor(role * 8));
            const layerScale = layer < 6 ? 0.52 + layer * 0.10 : (layer === 6 ? 1.45 : 2.05);
            const level = Math.min(5, Math.floor((role * 8 - layer) * 6));
            const path = Math.floor((lane * 6 - arm) * 2 ** level);
            const travel = ((phase / tau + time * 0.18) % 1 + 1) % 1;
            let angle = arm * tau / 6 + layer * 0.3 + time * (layer % 2 ? -0.0375 : 0.0525);
            let x = Math.cos(angle) * 0.065, y = Math.sin(angle) * 0.065;
            let z = 0, branch;
            for (let d = 0; d <= level; d++) {
                if (d) {
                    const sign = (Math.floor(path / 2 ** (level - d)) % 2) * 2 - 1;
                    angle += sign * (0.72 + 0.13 * Math.sin(time * 0.24 + d * 0.55));
                }
                const length = 0.18 * 0.61 ** d;
                const fraction = d === level ? travel : 1;
                const bend = Math.sin(fraction * Math.PI) * length * 0.12 * Math.sin(time * 0.3 + d);
                if (d === level) branch = {x, y, dx: Math.cos(angle) * length, dy: Math.sin(angle) * length,
                    bx: -Math.sin(angle) * length * 0.12 * Math.sin(time * 0.3 + d),
                    by: Math.cos(angle) * length * 0.12 * Math.sin(time * 0.3 + d), travel, level};
                x += Math.cos(angle) * length * fraction - Math.sin(angle) * bend;
                y += Math.sin(angle) * length * fraction + Math.cos(angle) * bend;
                z += Math.sin(angle * 2 + time * 0.2) * length * fraction * 0.28;
            }
            for (const key of ['x', 'y', 'dx', 'dy', 'bx', 'by']) branch[key] *= layerScale;
            return {x: x * layerScale, y: y * layerScale, z: z + (layer - 2.5) * 0.035, branch, age: travel / 0.18, fade: Math.min(1, travel * 14, (1 - travel) * 14)};
        }
        if (shape === 'zenMandala') {
            const ring = Math.min(10, Math.floor(lane * 11));
            const baseRadius = ring < 3 ? 0.035 + ring * 0.025 : ring < 7 ? 0.12 + (ring - 3) * 0.095 : 0.54 * Math.pow(4 / 3, ring - 7);
            const angle = phase + time * (ring % 2 ? 0.32 : -0.26);
            const band = (lane * 11 - ring - 0.5) * Math.min(0.042, baseRadius * 0.22);
            const swell = 1 + 0.08 * Math.sin(time * 0.32 + ring * 0.7);
            const radius = (baseRadius + band) * swell * (1 + 0.26 * Math.cos(12 * (angle - time * 0.09)));
            return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: (ring - 5) * 0.035 };
        }
        if (shape === 'quantumLattice') {
            const outer = role >= 0.5;
            role = (role * 2) % 1;
            const scale = outer ? 2.4 : 1;
            const col = Math.min(17, Math.floor(lane * 18));
            const row = Math.min(11, Math.floor(role * 12));
            const travel = (time * 0.15 + phase / tau) % 1;
            const horizontal = Math.sin(phase * 3) > 0;
            const gx = col + (horizontal ? travel : 0);
            const gy = row + (horizontal ? 0 : travel);
            return { x: ((gx - 8.5) * 0.056 + Math.sin(gy * 0.6 + time * 0.3) * 0.035) * scale,
                y: ((gy - 5.5) * 0.068 + Math.cos(gx * 0.5 + time * 0.26) * 0.035) * scale,
                z: Math.sin(gx * 0.4 + gy * 0.35 + time * 0.4) * 0.09 + (outer ? -0.15 : 0), age: travel / 0.15, fade: Math.min(1, travel * 12, (1 - travel) * 12) };
        }
        if (shape === 'gravityWell') {
            const progress = ((role - time * 0.014) % 1 + 1) % 1;
            const radius = 0.075 + progress * 0.65;
            const arm = Math.floor(lane * 5);
            const angle = arm * tau / 5 + (lane * 5 - arm) * 0.5 + time * 0.3 + (1 - progress) * 10 + Math.sin(time * 0.24 + progress * 5) * 0.18;
            return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.78,
                z: -0.12 * (1 - progress), fade: Math.min(1, progress * 16, (1 - progress) * 16) };
        }
        return null;
    }
};
if (typeof window !== 'undefined') window.PresetCompositions = PresetCompositions;
if (typeof module !== 'undefined') module.exports = PresetCompositions;
