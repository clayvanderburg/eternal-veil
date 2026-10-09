// Mandelbrot Dive: an endless GPU zoom into the Mandelbrot set.
// Each dive heads for a hidden mini-Mandelbrot (a periodic "nucleus") through
// spiral and seahorse regions, ~10^10–10^14 deep, using single-precision
// perturbation against an embedded high-precision reference orbit. The final
// mini-Mandelbrot lines up with the full set, which then becomes the start of
// the next dive, so the zoom never visibly resets. Rendered as luminous
// palette filaments (distance estimate) over a softly flowing colour field.
const MandelbrotDive = (() => {
    const TAU = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const finite = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    // Artistic tunables. Mandelbrot Lab edits these live; the preset uses
    // these defaults. Each is multiplied with the matching app setting where
    // one exists (speed, baseSize, density, stretch, wobble).
    const DEFAULT_TUNING = {
        zoomRate: 0.92,       // nats of zoom per second at speed 0.5 (0.92 ≈ 2.5× deeper each second)
        holdSeconds: 0.3,     // pause on each mini-Mandelbrot
        fadeSeconds: 1.1,     // cross-fade into the next dive
        centerSettle: 0.22,   // fraction of a dive spent sliding the target to screen centre
        spinTurns: 0,         // extra full turns per dive (on top of aligning the mini upright)
        swayDegrees: 10,      // gentle rotational sway amplitude (× wobble setting / 0.14)
        glowWidth: 1.0,       // filament glow width in render pixels (× baseSize / 2.4)
        glowGain: 1.0,        // filament brightness
        fieldLevel: 0.28,     // brightness of the colour field outside the set (× stretch)
        bandDensity: 1.0,     // colour bands (× density / 1600)
        colorFlow: 0.12,      // palette cycles per second through the bands
        interiorGlow: 0.0,    // faint palette tint inside the set (0 = black)
        detail: 2.35,         // iteration budget multiplier
        resolution: 1.0,      // render scale vs screen (the frame guard can lower it)
        bassGlow: 1.0,        // bass swell → filament width/brightness response
        trebleFlow: 1.0,      // treble → colour-flow speed response
        // Trippy layers (0 = off)
        warp: 0.6,            // liquid screen-space distortion
        bassWarp: 1.0,        // bass → extra warp wobble
        beatSurge: 0.6,       // bass → lurch the dive forward
        ripple: 0.99,         // colour rings pulsing outward from the centre
        stalks: 0.38,         // orbit-trap "stalks" glowing through the colour bands
        trebleShimmer: 0.6,   // treble → filament sparkle
        enterFade: 1.8        // seconds to fade in over the previous effect
    };
    const tuning = { ...DEFAULT_TUNING };

    const TARGETS = [
        { name: "Triple Spiral", period: 79, nucleus: [-0.04524074114132558, 0.986816220411137], size: 1.0346466551988628e-10, angle: -2.5536912804589176,
          orbit: "AAAAAAAAAABbTjm9/Z98PxEtgr9fxGU/leU7Pq24Vr+aDze/QtMtP+KZpTu52IA8+TY6vWiqfD+wNoK/u6ZlP/VWPT7rnla/YMI2v+BBLT/O+tA7DuenPDLcOr0fsXw/2DyCv7yRZT/XUT4+SIpWv4iINr9h4Cw/u57pO5kRwzyeazu9PbZ8P31Bgr+Sf2U/vB8/Pvh1Vr9RUza/sJEsP87K+DtNENo86Pg7vXq6fD9FRYK/v21lPxXdPz4/X1a/ixs2v+RKLD/CYwA8ng3wPF2SPL0Wvnw/Y0iCv3paZT8ImkA+NUNWv93aNb9UBiw/PHQAPHmOAz2ZRz29/sB8P71Kgr/XQ2U/emJBPosdVr/ziDW/rMArP1GK9Tt6nBA9gS4+varCfD+4S4K/MCdlP6w/Qj645lW/Wxg1v/d4Kz8Z3dU742QgPZVpP718wXw/o0mCv2oAZT9kM0M+VpBVv/FwNL8VNCs/PMCNOwJ7ND2PLkG9+bh8P+c/gr9QyWQ//x5EPlz9VL+KZTO/GgorPz36ELregk49d7dDvVWcfD+2IYK/+XtkPz9cRD4v9FO/fqcxv1NWKz8PEz68sSZtPUV8Rr3zR3w/XsyBv7ksZD86J0E+xSJSvzP2Lr/IWS0/QDwWvTbIej1rJkO9pHl7P/IDgb+QqWQ/IwIxPuJTUL8Sdy2/H5o0P8Geq73q9fs87mogvSpOez9f8YC/w/BoP4T7ED4MsFi/tdw9vwdEPz+OvVq9CqL4vXv+ab3F8X8/SFGFv85hXz+Va44+9bJUv+d+KL9WSwY/offmPe6vlz74XPa9q92GP+MJkr//ujs/gP03P5m/L78=" },
        { name: "Double Hook", period: 116, nucleus: [-0.7746806106268828, 0.1374168856038217], size: 9.269215372287844e-14, angle: 1.0177090631705854,
          orbit: "AAAAAAAAAAB4UUa/A7cMPo0TRr5Lm5q90TI+v/6eKj7yOoC+dKHhvS1eOb9aOUU+my6TvvzmEL4fSja/BwZgPk6Job5JUzK+d5k0vwk9fT7PIq2+cJZYvld/NL8QmY8+eWK2vpgihL5a4ja/7n6kPiAvvL7cq6S+UTc+vwdovz7RhLm+ohXWvjR3Ub81gOE+iSyZvutUFb/vQYO/+A75PszSJD3bN1y/s6vBv+mkiz2YR8E/6yWNvawVwD831pC9aHS8P6pFmb0XlrE/ZuWpvYpXkj/W/r29XBoGPzIDmb2wfwG/Vj5yPcO0Bb/J4549ngYCv+vpZj0IFwW/RSWkPYbFAr+Gg1098EMEv1JGqD3ItQO/ZBhXPaZCA7/Pw6o908sEv22hVD0/HwK/fiGrPU/3Bb927FY9AesAv4z1qD2sIwe/ioRePXx4/74g96M9OjkIv2Sbaz3nWv2+zQ6cPc0eCb/293094rb7vsVlkT3Buwm/X3eKPRrF+r4nb4Q9H/oJv4Kzlz3Gtvq+6c5rPU7ICb/Q9aU9pa/7vm+STT0SGgm/N2C0PdfB/b6ddDA96+gHv5j5wT3ldQC/n+8WPVo0Br+0sM09sYsCv9OJAz3iAgS/QlrWPWsMBb93cPE8fmQBv3Sw2j1O1ge/AnLxPFnt/L5nX9k9u7oKvyhVBT0g0va+3izRPQF/Db9wgh89a//wvgxEwT0d4Q+/zvpGPbod7L70mKk9MaERv6cCej1F2+i+GjWLPbmMEr+rzpo9OsbnvjVgUD0/hRK/8Rm7PWUw6b5UgwY93X0Rv4sq3D0ULu2+smp5PBJxD79xi/w9/6zzvsZrSroKVQy/sHcNPlSO/L4bHma8RBQIv1znGj6h1wO/rbq/vPqOAr+EZiU+x2kKv+Du37x0WPe+1vsqPru1Eb9k6MO8Jw/nvnCXKD7THhm/3Dk3vJyH1b74aRo+9pwfv8KwPjz9q8W+2bT7Pd8GJL+BJS49Q167vlPZqT2EyyW/vB2dPWfmuL7E1xs9Vk0lv1sm4T2CWb2+OFeVu4JPI7+wKhA+QWzGvpfjLL1SUyC/TDcuPlSk0r4G/5q9VnQcv1x7TD6O0eG+XXLavZJuF7+tD20+cez0vkO+C74WgRC/tjSJPlsiB79UFCm+9fYFv+ubnz6zFxm/42BBvqzK575QALo+vKIzvw8cRL5aUKO+yvfPPkeCVr8pQvm9bfGyvZXJrj7PMmK/BkGfPQ==" },
        { name: "Eastern Filigree", period: 201, nucleus: [0.28693188157883576, 0.014286711128279611], size: 9.204815877859124e-14, angle: 0.5163012722381509,
          orbit: "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" },
        { name: "Fern Gate", period: 201, nucleus: [-0.2184745135211499, 0.7595604932412681], size: 8.077046809764328e-10, angle: -2.455077022294769,
          orbit: "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" },
        { name: "Tendril Crown", period: 197, nucleus: [0.36024044343777434, 0.6413130610647609], size: 3.025649817151624e-14, angle: -0.21791158316659778,
          orbit: "AAAAAAAAAABvcbg+GC0kP9A9oT0gO40/ydlZvzynUD/yFtc+cPE+v1mVoLx6zW88uYe4Pn0HJD/B/6I9uDSNP5u0Wb9PIVE//QnVPnSEP79Tede8N42ZPBGeuD557CM/ElWkPSMyjT9kolm/nX5RP+Ka0z5VBUC/wVEBvbqQrjySuLg+6dQjP92SpT0fMo0/7ZtZvz/WUT/RZdI+vI9Av21GFr0tU70829u4PvW9Iz+146Y9IDWNP1eiWb8eNFI/lUfRPtw5Qb9loS29atrGPLsPuT45piM/d2yoPSM9jT+pvVm/E6NSP7Q30D55I0K/y6ZKvevAyDyQY7k+LY4jP/dUqj05T40/aQNav9kvUz89Vc8+B4ZDv/Yfcr25U7o8ofe5Pt18Iz91s6w9PHiNP+2rWr8S5VM/Iz3PPqfRRb8XlZW9fiqBPBEMuz4mliM/ntauPb7ZjT/2T1y/jZ1UP9x50j6Fxkm/qWy8vbvm27sHwbw+BX4kPz+Qqj3Vuo4/7U9gv1e5Uz9IU+M+dNtOvwKww71fFpy9wiS6PpvnJz9m8X49vSGPPzvkYr+0z0c/6FsJP+gBPr8bK8c9g+Uevgz1sD4lcxw/LYXZPQIpiD9dkkK/5AVeP6UyPj61US2/6k6CvUGVxz7Ablk+LnoXP6siYj0kgWQ/oevdvjZoPT+2YTc6Lp2GuIBxuD4WLSQ/Dj6hPSU7jT/d2Vm/T6dQP/cW1z6v8T6/6KCgvC6/bzzDh7g+fAckP+X/oj27NI0/qbRZv1ohUT8ICtU+nYQ/v1OA17z9h5k8Gp64PnnsIz8rVaQ9JjKNP3CiWb+kflE/85rTPncFQL97VAG9s4uuPJu4uD7q1CM/75KlPSIyjT/6m1m/RdZRP+pl0j7dj0C/1EgWvYBNvTzl27g+9r0jP8Ljpj0jNY0/Z6JZvyM0Uj+8R9E+/zlBv6GjLb0v08Y8xw+5PjymIz94bKg9Jz2NP769Wb8Vo1I/9jfQPqAjQr/FqEq9qbbIPJ5juT4zjiM/3lSqPUBPjT+JA1q/1C9TP7hVzz4yhkO/AiFyvaxDujyx97k+7HwjPxCzrD1GeI0/HKxav/nkUz8XPs8+y9FFv8KTlb1JD4E8Egy7PkeWIz9P1a49ytmNPzVQXL80nVQ/2nvSPlTGSb+6Y7y9t5vcu5TAvD5EfiQ/Z4yqPci6jj/ET2C/QLhTP1NW4z5I2U6/F4nDvZganL29Iro+9+YnPxnzfj3YII8/NuBiv7jPRz/EVAk/qfs9v/M3xz1KoB6+aACxPgN2HD+IiNk9eC2IP0OlQr+tCF4/O5I+Prp2Lb//mIO9/DjHPpoTWj7xXxc/witlPb2mZD8bZ96+H8M9P0XnDLojiy67i3C4PkgtJD9ROaE96DqNP+nYWb/tpVA/OxjXPsjtPr+Z1Z+8iVRwPCGHuD6UByQ/GP2iPZA0jT/4s1m/hiBRP2MK1T4Vgj+/agLXvO7CmTyNnbg+huwjPw5TpD39MY0/yKFZvwJ+UT/KmtM+UANAv+ghAb1myK48C7i4Pu7UIz8pkaU99TGNPz+bWb+51VE/NmXSPryNQL9BGha9Spa9PEHbuD7uvSM/P+KmPew0jT98oVm/pjNSPzVG0T6oN0G/InUtvUg1xzz9Drk+HqYjP2ZrqD3cPI0/drxZv7CiUj/lNNA+2SBCv055Sr1wSck8lWK5PuSNIz8DVao9z06NP5MBWr+5L1M/Zk/PPsiCQ7+C9nG9jTa7PF/2uT4lfCM/J7esPZJ3jT/qqFq/3uVTPzYwzz4HzkW/KpKVveHHgjwjC7s+RpQjPxXnrj3C2I0/Q0tcv8ehVD+jW9I+/MVJv0vJvL1axc+77cW8PrR5JD8Uy6o90bqOP59OYL+8yVM/dhjjPgb2Tr9s2MW9sFabvZVGuj6A7Sc/dzp/Pfoujz/hHmO/N91HP9SuCT9wdT6/LpbEPfbCIr63ObA+TF0cP95V2D0+6Ic/FodBv92ZXT+oyjo+xt4qv3DzVL0Qrcs+g5tRPkiWGT8m2yw9lg1jP1Vn2b4IVzc/ZWjiPBKlBz3PRbg+D6UkP2vvmz1QWI0/83Rav2w5Tz9izN0+Cn49vw==" }
    ];

    function decodeOrbit(base64) {
        let bytes;
        if (typeof atob === "function") {
            const binary = atob(base64);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } else {
            bytes = Uint8Array.from(Buffer.from(base64, "base64"));
        }
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    }
    for (const target of TARGETS) {
        target.data = decodeOrbit(target.orbit);
        target.depth = Math.log(1 / target.size);           // nats from overview to mini
        target.miniRe = target.size * Math.cos(target.angle); // complex mini scale s
        target.miniIm = target.size * Math.sin(target.angle);
    }

    const state = {
        clock: 0, lastSeconds: null, dive: 0, restSize: null, swellTime: 0, pulse: 0, colorPhase: 0,
        budget: 1, frameAverage: 16.7, lastFrameAt: null, gl: null, glFailed: false, snapshot: null,
        snapshotReady: false, cpu: null,
        enterAt: null, warpTime: 0, treble: 0
    };

    // ---------- schedule (pure; unit-tested) ----------
    function diveLength(target) {
        return target.depth / tuning.zoomRate + tuning.holdSeconds;
    }
    // Returns the view for clock time (seconds at speed 0.5), plus a fade weight
    // and previous-dive index while cross-fading.
    function viewAt(clock, wobble = 0.14) {
        let index = 0;
        let local = Math.max(0, clock);
        // Walk forward through dives; bounded because each dive lasts ≥ holdSeconds.
        for (let guard = 0; guard < 10000; guard++) {
            const length = diveLength(TARGETS[index % TARGETS.length]);
            if (local < length) break;
            local -= length;
            index++;
        }
        const target = TARGETS[index % TARGETS.length];
        const nats = Math.min(target.depth, local * tuning.zoomRate);
        const progress = nats / target.depth;
        const scale = 1.6 * Math.exp(-nats);
        const swayAmount = tuning.swayDegrees * Math.PI / 180 * clamp(wobble / 0.14, 0, 4);
        const sway = swayAmount * Math.sin(progress * TAU * 1.5) * (1 - progress);
        const theta = target.angle * progress + tuning.spinTurns * TAU * progress + sway;
        // Slide the dive target from where it sits in the overview to screen centre.
        const settleSpan = Math.max(0.01, tuning.centerSettle);
        const u = clamp(progress / settleSpan, 0, 1);
        const keep = 1 - u * u * (3 - 2 * u);
        // Final centre T = nucleus + s·(−0.5): the mini's own "overview" centre.
        const tRe = -0.5 * target.miniRe, tIm = -0.5 * target.miniIm;       // T − nucleus
        const o0Re = (target.nucleus[0] + tRe + 0.5) / 1.6;                 // (T − (−0.5)) / 1.6
        const o0Im = (target.nucleus[1] + tIm) / 1.6;
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const oRe = o0Re * keep, oIm = o0Im * keep;
        // centre − nucleus = (T − nucleus) − o·scale·e^{iθ}
        const offRe = tRe - scale * (oRe * cos - oIm * sin);
        const offIm = tIm - scale * (oRe * sin + oIm * cos);
        const fadeIn = index === 0 && clock < tuning.fadeSeconds ? 1 : clamp(local / Math.max(0.05, tuning.fadeSeconds), 0, 1);
        return { index: index % TARGETS.length, target, nats, progress, scale, theta, offRe, offIm, fade: fadeIn, local };
    }

    function iterationBudget(view) {
        // The halo around the final mini-Mandelbrot escapes slowly (tens of
        // periods); spend those iterations only in the last stretch of a dive.
        const late = Math.pow(view.progress, 6);
        const base = 220 + 42 * view.nats + 26 * view.target.period * late;
        return Math.round(clamp(base * tuning.detail, 64, 6000));
    }

    // ---------- WebGL renderer ----------
    const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D orbit;
uniform int period;
uniform int maxIter;
uniform vec2 resolution;
uniform vec2 offset;      // view centre − nucleus
uniform vec2 axis;        // scale·e^{iθ} per half-min-dimension
uniform float pixel;      // c-units per render pixel
uniform vec3 palette[6];
uniform int paletteSize;
uniform float bandDensity;
uniform float colorPhase;
uniform float glowWidth;
uniform float glowGain;
uniform float fieldLevel;
uniform float interiorGlow;
uniform float kaleido;
uniform float kaleidoSpin;
uniform float kaleidoRings;
uniform float warp;
uniform float warpTime;
uniform float ripple;
uniform float stalks;
uniform float shimmer;
out vec4 color;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec3 paletteAt(float u) {
    float n = float(paletteSize);
    float x = mod(u, n);
    int i = int(floor(x));
    int j = i + 1 >= paletteSize ? 0 : i + 1;
    vec3 a = palette[0], b = palette[0];
    for (int k = 0; k < 6; k++) { if (k == i) a = palette[k]; if (k == j) b = palette[k]; }
    float f = fract(x);
    return mix(a, b, f * f * (3.0 - 2.0 * f));
}
vec2 Z(int m) { return texelFetch(orbit, ivec2(m, 0), 0).xy; }
void main() {
    float halfMin = 0.5 * min(resolution.x, resolution.y);
    vec2 p = (gl_FragCoord.xy - 0.5 * resolution) / halfMin;
    float radius0 = length(p);
    if (kaleido >= 2.5) {
        // Fold the screen into mirrored wedges: the dive becomes a mandala.
        float wedge = 6.2831853 / kaleido;
        // Axes Rings: concentric tiers, each with its own sweep (same radii and speeds as
        // kaleidoRingAxis / kaleidoRingRadius in js/simulation.js).
        float spin = kaleidoSpin;
        if (kaleidoRings > 1.5) {
            float ringBase = 0.5 * (resolution.x + resolution.y) / min(resolution.x, resolution.y); // ((w + h) / 4) / (min / 2)
            float ring = min(kaleidoRings - 1.0, floor(radius0 / ringBase * kaleidoRings));
            spin *= (mod(ring, 2.0) > 0.5 ? -1.0 : 1.0) * (1.0 + 0.35 * ring);
        }
        float a = mod(atan(p.y, p.x) + spin + 0.5 * wedge, wedge) - 0.5 * wedge;
        a = abs(a);
        p = radius0 * vec2(cos(a), sin(a));
    }
    if (warp > 0.0) {
        // Liquid breathing distortion in screen space.
        p += warp * 0.06 * vec2(sin(p.y * 3.1 + warpTime) + 0.5 * sin(p.y * 7.3 - warpTime * 1.7),
                                sin(p.x * 2.7 - warpTime * 1.3) + 0.5 * sin(p.x * 6.1 + warpTime * 2.1));
    }
    vec2 dc = offset + cmul(p, axis);
    float trap = 1e9;
    vec2 d = vec2(0.0);
    vec2 dzs = vec2(0.0);   // derivative in pixel units (avoids float overflow when deep)
    int m = 0;
    float escaped = -1.0;
    vec2 z = vec2(0.0);
    for (int n = 0; n < 6000; n++) {
        if (n >= maxIter) break;
        vec2 zm = Z(m);
        z = zm + d;
        dzs = 2.0 * cmul(z, dzs) + vec2(pixel, 0.0);
        d = cmul(2.0 * zm + d, d) + dc;
        m++;
        if (m >= period) m = 0;
        z = Z(m) + d;
        trap = min(trap, min(abs(z.x), abs(z.y)));   // Pickover stalks
        float r2 = dot(z, z);
        if (r2 > 65536.0) { escaped = float(n); break; }
        if (r2 < dot(d, d)) { d = z; m = 0; }   // rebase (Zhuoran): keeps deep pixels glitch-free
    }
    if (escaped < 0.0) {
        color = vec4(paletteAt(colorPhase) * interiorGlow, 1.0);
        return;
    }
    float r = length(z);
    float smoothIter = escaped + 1.0 - log2(max(1.0001, log(r)));
    float de = 0.5 * r * log(r) / max(1e-30, length(dzs));   // distance in render pixels
    float glow = exp(-de / max(0.2, glowWidth));
    float u = log(smoothIter + 1.0) * 2.2 * bandDensity + colorPhase
        + ripple * 0.9 * sin(radius0 * 9.0 - warpTime * 2.2);
    vec3 base = paletteAt(u);
    float near = exp(-de / (glowWidth * 14.0 + 1.0));
    float field = fieldLevel * (0.45 + 0.55 * near);
    // Stay in palette: dense filament regions saturate to the band colour,
    // with only a whisper of white at the very core, so deep zooms never wash out.
    float sparkle = shimmer > 0.0 ? shimmer * step(0.93, fract(sin(dot(floor(gl_FragCoord.xy * 0.5), vec2(12.9898, 78.233)) + warpTime * 3.0) * 43758.5453)) : 0.0;
    float light = field + glow * glowGain * (1.0 - 0.55 * field) * (1.0 + sparkle);
    vec3 rgb = base * light + vec3(0.05) * glow * glow * glowGain;
    if (stalks > 0.0) {
        // Thin, sharp stalks; dimmed where the field is already bright so
        // strong settings add structure instead of washing the frame out.
        float stalk = exp(-trap * 160.0) * stalks;
        rgb += paletteAt(u + 2.5) * stalk * 0.55 * (1.0 - 0.5 * min(1.0, fieldLevel));
    }
    color = vec4(min(rgb, vec3(1.0)), 1.0);
}`;

    function createGL() {
        if (state.gl || state.glFailed || typeof document === "undefined") return state.gl;
        try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
            if (!gl) throw new Error("WebGL2 unavailable");
            const compile = (type, source) => {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
                return shader;
            };
            const program = gl.createProgram();
            gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const textures = TARGETS.map(target => {
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                const texels = new Float32Array(target.period * 2);
                texels.set(target.data);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, target.period, 1, 0, gl.RG, gl.FLOAT, texels);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                return texture;
            });
            const names = ["orbit", "period", "maxIter", "resolution", "offset", "axis", "pixel", "palette", "paletteSize",
                "bandDensity", "colorPhase", "glowWidth", "glowGain", "fieldLevel", "interiorGlow",
                "kaleido", "kaleidoSpin", "kaleidoRings", "warp", "warpTime", "ripple", "stalks", "shimmer"];
            const uniforms = {};
            for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
            const position = gl.getAttribLocation(program, "position");
            canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); state.gl = null; });
            state.gl = { canvas, gl, program, buffer, textures, uniforms, position };
        } catch (error) {
            state.glFailed = true;
            state.gl = null;
            if (typeof console !== "undefined") console.warn("[MandelbrotDive] GPU renderer unavailable; using CPU preview.", error?.message || error);
        }
        return state.gl;
    }

    // Palettes arrive as "#rgb", "#rrggbb", "rgb(...)" or "hsl(...)" (Flow's
    // generated palettes use hsl). Returns [r, g, b] in 0–255, or null.
    function parseColor(value) {
        const text = String(value || "").trim().toLowerCase();
        let m = /^#?([0-9a-f]{6})$/.exec(text);
        if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
        m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
        if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
        m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
        if (m) return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
        m = /^hsla?\(\s*([-\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(text);
        if (m) {
            const h = ((+m[1] % 360) + 360) % 360, s = Math.min(100, +m[2]) / 100, l = Math.min(100, +m[3]) / 100;
            const a = s * Math.min(l, 1 - l);
            const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
            return [f(0), f(8), f(4)];
        }
        return null;
    }

    const paletteCache = { key: "", values: new Float32Array(18), size: 1 };
    function paletteUniform(palette) {
        const key = palette.join(",");
        if (key === paletteCache.key) return paletteCache;
        paletteCache.key = key;
        const colors = palette.slice(0, 6);
        paletteCache.size = Math.max(1, colors.length);
        colors.forEach((hex, i) => {
            const rgb = parseColor(hex) || [136, 136, 255];
            paletteCache.values[i * 3] = rgb[0] / 255;
            paletteCache.values[i * 3 + 1] = rgb[1] / 255;
            paletteCache.values[i * 3 + 2] = rgb[2] / 255;
        });
        return paletteCache;
    }

    // Kaleidoscope follows the app's own kaleidoscope setting (toggle or Flow),
    // mirrored inside the shader instead of the app's particle mirror pass.
    function kaleidoSegments(settings) {
        if (!settings || !settings.kaleidoscopeEnabled) return 0;
        const segments = Math.floor(clamp(finite(settings.kaleidoscopeSegments, 6), 3, 16));
        return segments >= 3 ? segments : 0;
    }

    function looks(settings) {
        const size = clamp(finite(settings.baseSize, 2.4), 0.5, 12);
        const rest = state.restSize ?? size;
        const swell = clamp(state.pulse * tuning.bassGlow, 0, 0.6);
        return {
            glowWidth: tuning.glowWidth * clamp(rest / 2.4, 0.3, 4) * (1 + swell),
            glowGain: tuning.glowGain * (1 + swell * 0.5),
            fieldLevel: tuning.fieldLevel * clamp(finite(settings.stretch, 1), 0, 3),
            bandDensity: tuning.bandDensity * clamp(finite(settings.density, 1600), 300, 3000) / 1600,
            interiorGlow: tuning.interiorGlow,
            warp: clamp(tuning.warp * (1 + swell * 2.5 * tuning.bassWarp), 0, 4),
            shimmer: clamp(tuning.trebleShimmer * state.treble, 0, 1.5)
        };
    }

    function renderGL(view, width, height, settings, palette) {
        const renderer = createGL();
        if (!renderer) return null;
        const { canvas, gl, program, buffer, textures, uniforms, position } = renderer;
        const scale = clamp(tuning.resolution * state.budget, 0.15, 1);
        const w = Math.max(8, Math.round(Math.min(width * scale, 1600)));
        const h = Math.max(8, Math.round(height * w / width));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[view.index]);
        const colors = paletteUniform(palette);
        const look = looks(settings);
        const halfMin = 0.5 * Math.min(w, h);
        gl.uniform1i(uniforms.orbit, 0);
        gl.uniform1i(uniforms.period, view.target.period);
        gl.uniform1i(uniforms.maxIter, iterationBudget(view));
        gl.uniform2f(uniforms.resolution, w, h);
        gl.uniform2f(uniforms.offset, view.offRe, view.offIm);
        gl.uniform2f(uniforms.axis, view.scale * Math.cos(view.theta), view.scale * Math.sin(view.theta));
        gl.uniform1f(uniforms.pixel, view.scale / halfMin);
        gl.uniform3fv(uniforms.palette, colors.values);
        gl.uniform1i(uniforms.paletteSize, colors.size);
        gl.uniform1f(uniforms.bandDensity, look.bandDensity);
        gl.uniform1f(uniforms.colorPhase, state.colorPhase);
        gl.uniform1f(uniforms.glowWidth, look.glowWidth);
        gl.uniform1f(uniforms.glowGain, look.glowGain);
        gl.uniform1f(uniforms.fieldLevel, look.fieldLevel);
        gl.uniform1f(uniforms.interiorGlow, look.interiorGlow);
        gl.uniform1f(uniforms.kaleido, kaleidoSegments(settings));
        gl.uniform1f(uniforms.kaleidoSpin, settings.spinningKaleido ? state.warpTime * 0.12 : 0);
        gl.uniform1f(uniforms.kaleidoRings, Math.max(1, Math.min(5, Math.floor(finite(settings.kaleidoAxesRings, 1)))));
        gl.uniform1f(uniforms.warp, look.warp);
        gl.uniform1f(uniforms.warpTime, state.warpTime);
        gl.uniform1f(uniforms.ripple, tuning.ripple);
        gl.uniform1f(uniforms.stalks, tuning.stalks);
        gl.uniform1f(uniforms.shimmer, look.shimmer);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return canvas;
    }

    // ---------- CPU fallback (also used by tests) ----------
    // Plain double-precision iteration: exact to ~1e-13, small and slow, but it
    // keeps the preset alive without WebGL2 and lets Node verify the maths.
    function samplePixel(view, px, py, maxIter) {
        const cRe = view.target.nucleus[0] + view.offRe + (px * view.scale * Math.cos(view.theta) - py * view.scale * Math.sin(view.theta));
        const cIm = view.target.nucleus[1] + view.offIm + (px * view.scale * Math.sin(view.theta) + py * view.scale * Math.cos(view.theta));
        let x = 0, y = 0;
        for (let n = 0; n < maxIter; n++) {
            const xx = x * x - y * y + cRe;
            y = 2 * x * y + cIm;
            x = xx;
            const r2 = x * x + y * y;
            if (r2 > 65536) return n + 1 - Math.log2(Math.log(Math.sqrt(r2)));
        }
        return -1;
    }

    function renderCPU(view, width, height, settings, palette) {
        if (typeof document === "undefined") return null;
        if (!state.cpu) {
            const canvas = document.createElement("canvas");
            state.cpu = { canvas, ctx: canvas.getContext("2d"), row: 0 };
        }
        const cpu = state.cpu;
        const w = 128, h = Math.max(8, Math.round(128 * height / width));
        if (cpu.canvas.width !== w || cpu.canvas.height !== h) {
            cpu.canvas.width = w; cpu.canvas.height = h; cpu.image = cpu.ctx.createImageData(w, h); cpu.row = 0;
        }
        const colors = paletteUniform(palette);
        const look = looks(settings);
        const maxIter = Math.min(900, iterationBudget(view));
        const halfMin = 0.5 * Math.min(w, h);
        const rows = Math.ceil(h / 3);
        for (let r = 0; r < rows; r++, cpu.row = (cpu.row + 1) % h) {
            const y = cpu.row;
            for (let x = 0; x < w; x++) {
                const value = samplePixel(view, (x - w / 2) / halfMin, (h / 2 - y) / halfMin, maxIter);
                const i = (y * w + x) * 4;
                if (value < 0) { cpu.image.data[i] = cpu.image.data[i + 1] = cpu.image.data[i + 2] = 0; }
                else {
                    const u = Math.log(value + 1) * 2.2 * look.bandDensity + state.colorPhase;
                    const k = ((Math.floor(u) % colors.size) + colors.size) % colors.size;
                    const level = Math.min(1, look.fieldLevel + 0.5);
                    cpu.image.data[i] = colors.values[k * 3] * 255 * level;
                    cpu.image.data[i + 1] = colors.values[k * 3 + 1] * 255 * level;
                    cpu.image.data[i + 2] = colors.values[k * 3 + 2] * 255 * level;
                }
                cpu.image.data[i + 3] = 255;
            }
        }
        cpu.ctx.putImageData(cpu.image, 0, 0);
        return cpu.canvas;
    }

    // ---------- per-frame ----------
    function measureFrame() {
        if (typeof performance === "undefined" || typeof performance.now !== "function") return;
        const now = performance.now();
        const interval = state.lastFrameAt === null ? 16.7 : now - state.lastFrameAt;
        state.lastFrameAt = now;
        if (interval <= 0 || interval > 250) return;
        state.frameAverage += (interval - state.frameAverage) * 0.05;
        // Lower render resolution first; the dive, colours and timing are unchanged.
        if (state.frameAverage > 24) state.budget = Math.max(0.4, state.budget - 0.006);
        else if (state.frameAverage < 18) state.budget = Math.min(1, state.budget + 0.003);
    }

    function advance(settings, seconds) {
        let dt = state.lastSeconds === null ? 0 : seconds - state.lastSeconds;
        if (state.lastSeconds !== null && (dt > 1.5 || dt < -0.5)) dt = 0;  // re-entry: resume, don't jump
        dt = clamp(dt, 0, 0.1);
        state.lastSeconds = seconds;
        const speed = clamp(finite(settings.speed, 0.5), 0, 2);
        const tempo = speed / 0.5;
        state.clock += dt * tempo;
        // Bass: shared pipeline swells baseSize on attacks (same detector as Cymatic Resonance).
        const size = clamp(finite(settings.baseSize, 2.4), 0.5, 12);
        if (state.restSize === null || size < state.restSize) state.restSize = size;
        const swell = size / Math.max(0.1, state.restSize) - 1;
        state.swellTime = swell > 0.18 ? state.swellTime + dt : 0;
        if (state.swellTime > 0.6) { state.restSize = size; state.swellTime = 0; }
        else if (swell > 0 && swell < 0.18) state.restSize += (size - state.restSize) * Math.min(1, dt * 0.8);
        state.pulse = Math.max(swell > 0.12 ? swell : 0, state.pulse * Math.pow(0.02, dt));
        const treble = clamp(finite(settings.trebleIntensity, 0), 0, 1.5);
        state.treble = treble;
        state.colorPhase += dt * tempo * tuning.colorFlow * (1 + treble * 1.5 * tuning.trebleFlow) * 6;
        state.warpTime += dt * (0.6 + 0.4 * tempo);
        // Beat surge: bass pulses push the dive forward, so the zoom rides the music.
        state.clock += dt * clamp(state.pulse, 0, 0.6) * tuning.beatSurge * 4 * (tempo > 0 ? 1 : 0);
        return viewAt(state.clock, clamp(finite(settings.wobble, 0.14), 0, 1));
    }

    function draw(ctx, width, height, seconds, settings, palette) {
        if (!palette?.length || !Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return;
        measureFrame();
        const nowMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        // Arrival = app time passed while another effect was showing (or first
        // draw). A paused app or a slow frame does not advance app time this
        // much, so neither restarts the dive.
        const appTime = finite(seconds, 0);
        if (state.lastSeconds === null || appTime - state.lastSeconds > 0.5 || appTime < state.lastSeconds - 0.5) enter(nowMs);
        const view = advance(settings, appTime);
        const entry = state.enterAt === null ? 1 : clamp((nowMs - state.enterAt) / 1000 / Math.max(0.05, tuning.enterFade), 0, 1);
        if (entry >= 1) state.enterAt = null;
        const image = renderGL(view, width, height, settings, palette) || renderCPU(view, width, height, settings, palette);
        if (!image) return;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        // Cross-fade from the held mini-Mandelbrot into the next dive's full set.
        const eased = entry * entry * (3 - 2 * entry);
        if (view.fade < 1 && state.snapshotReady && state.snapshot) {
            ctx.globalAlpha = eased;
            ctx.drawImage(state.snapshot, 0, 0, width, height);
            ctx.globalAlpha = view.fade * eased;
        } else {
            // Entering from another effect: fade in over its lingering trails.
            ctx.globalAlpha = eased;
        }
        ctx.drawImage(image, 0, 0, width, height);
        ctx.restore();
        // Keep a copy of the final held frame for the next cross-fade.
        if (view.nats >= view.target.depth && typeof document !== "undefined") {
            if (!state.snapshot) state.snapshot = document.createElement("canvas");
            if (state.snapshot.width !== image.width || state.snapshot.height !== image.height) {
                state.snapshot.width = image.width; state.snapshot.height = image.height;
            }
            state.snapshot.getContext("2d").drawImage(image, 0, 0);
            state.snapshotReady = true;
        }
    }

    // Arriving from another effect (or after a pause): start the next dive from
    // the full set and fade in, rather than cutting in mid-dive.
    function enter(nowMs) {
        let start = 0, index = 0;
        const current = viewAt(state.clock);
        for (; index <= current.index; index++) start += diveLength(TARGETS[index]);
        if (state.lastSeconds === null && state.clock === 0) start = 0;
        state.clock = start + Math.min(0.2, tuning.fadeSeconds);
        state.snapshotReady = false;
        state.enterAt = nowMs;
    }

    function reset() {
        Object.assign(state, { clock: 0, lastSeconds: null, restSize: null, swellTime: 0, pulse: 0, colorPhase: 0,
            budget: 1, frameAverage: 16.7, lastFrameAt: null, snapshotReady: false, enterAt: null,
            warpTime: 0, treble: 0 });
    }
    function setTuning(values) {
        for (const key of Object.keys(DEFAULT_TUNING)) {
            if (values && Number.isFinite(Number(values[key]))) tuning[key] = Number(values[key]);
        }
        tuning.zoomRate = clamp(tuning.zoomRate, 0.05, 6);
        tuning.holdSeconds = clamp(tuning.holdSeconds, 0, 20);
        tuning.fadeSeconds = clamp(tuning.fadeSeconds, 0.05, 10);
        tuning.detail = clamp(tuning.detail, 0.2, 3);
        tuning.resolution = clamp(tuning.resolution, 0.15, 1);
        tuning.warp = clamp(tuning.warp, 0, 3);
        tuning.enterFade = clamp(tuning.enterFade, 0.05, 8);
        return { ...tuning };
    }
    function seek(clock) { state.clock = Math.max(0, finite(clock, 0)); state.snapshotReady = false; }
    function inspect() {
        return { clock: state.clock, budget: state.budget, gpu: !!state.gl, pulse: state.pulse, colorPhase: state.colorPhase,
            view: viewAt(state.clock), targets: TARGETS.map(t => ({ name: t.name, period: t.period, depth: t.depth })) };
    }

    function replayEntry() { state.lastSeconds = null; }

    return { draw, reset, setTuning, seek, inspect, replayEntry, kaleidoSegments, parseColor, paletteUniform, viewAt, samplePixel, iterationBudget, diveLength,
        DEFAULT_TUNING, TARGETS, tuning };
})();

if (typeof window !== "undefined") window.MandelbrotDive = MandelbrotDive;
if (typeof module !== "undefined" && module.exports) module.exports = MandelbrotDive;
