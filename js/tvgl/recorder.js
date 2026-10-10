// ==========================================================================
// ETERNAL VOID - TV RENDERER (WebGL2) - RECORDER ENGINE
// For the authored presets (Mandala Zen, Jade Currents, Black Hole Vortex,
// spirals, pipes, aurora, ocean, lotus...): run the ORIGINAL simulation
// (js/simulation.js FlowSimulation + Particle, js/preset-compositions.js)
// unchanged, but give it a recording canvas. Each circle, ellipse, line,
// curve and polygon it draws becomes a compact GPU primitive; the GPU then
// draws them all in order in one instanced pass, with the same trails,
// Veil Drift and kaleidoscope as the rest of the TV renderer. So every
// authored preset keeps its own motion and look, without a per-preset port.
//
// Supported canvas subset (what Particle.draw / drawAuthoredEffect use):
// save/restore, transforms, globalAlpha, fill/strokeStyle (colour strings),
// lineWidth/Cap/Join, paths (moveTo, lineTo, quadratic/bezier curves, arc,
// ellipse, rect, closePath), fill, stroke, fillRect, strokeRect. Anything
// else (gradients, images, shadows) is noted in `unsupported`.
// ==========================================================================
/* global TvGLCore, FlowSimulation */
(function (root) {
    "use strict";
    const TAU = Math.PI * 2;
    const MAX_PTS = 8;
    const PRIM_FLOATS = 24;   // p0..p7 (16), color (4), type, npts, width, cap
    const TYPE = { ellipse: 0, ring: 1, stroke: 2, fill: 3, chain: 4 };
    const CAP = { round: 0, butt: 1, square: 2 };

    // ---------------------------------------------------------------------
    // Colour strings -> premultiplied-ready [r, g, b, a]
    // ---------------------------------------------------------------------
    let probe = null;
    const colorCache = new Map();
    function hslRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)];
    }
    const HSL_RE = /^hsla?\(\s*([-\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i;
    const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i;
    // The formats the app writes (palette hex, hsl/hsla, rgba), parsed directly;
    // anything else goes through the browser's own parser.
    function fastParse(css) {
        if (css[0] === "#") {
            if (css.length === 7) { const n = parseInt(css.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; }
            if (css.length === 4) { const r = parseInt(css[1], 16), g = parseInt(css[2], 16), b = parseInt(css[3], 16); return [r * 17 / 255, g * 17 / 255, b * 17 / 255, 1]; }
            return null;
        }
        let m = HSL_RE.exec(css);
        if (m) {
            const rgb = hslRgb(+m[1], Math.min(1, m[2] / 100), Math.min(1, m[3] / 100));
            const a = m[4] === undefined ? 1 : (m[5] ? m[4] / 100 : +m[4]);
            return [rgb[0], rgb[1], rgb[2], Math.max(0, Math.min(1, a))];
        }
        m = RGB_RE.exec(css);
        if (m) {
            const a = m[4] === undefined ? 1 : (m[5] ? m[4] / 100 : +m[4]);
            return [m[1] / 255, m[2] / 255, m[3] / 255, Math.max(0, Math.min(1, a))];
        }
        return null;
    }
    function parseColor(css) {
        if (typeof css !== "string") return null;
        let c = colorCache.get(css);
        if (c) return c;
        c = fastParse(css.trim());
        if (c) {
            if (colorCache.size > 4000) colorCache.clear();
            colorCache.set(css, c);
            return c;
        }
        if (!probe) {
            const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
            probe = cv.getContext("2d");
        }
        probe.fillStyle = "#000";
        probe.fillStyle = css;
        const v = probe.fillStyle;
        if (v[0] === "#") {
            const n = parseInt(v.slice(1), 16);
            c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
        } else {
            const m = v.match(/rgba?\(([^)]+)\)/);
            const p = m ? m[1].split(",").map(Number) : [255, 255, 255];
            c = [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
        }
        if (colorCache.size > 4000) colorCache.clear();
        colorCache.set(css, c);
        return c;
    }

    // ---------------------------------------------------------------------
    // The recording canvas
    // ---------------------------------------------------------------------
    class Recorder {
        constructor() {
            this.canvas = null;
            this.cap = 8192;
            // direct / layer (kaleidoscope) x sharp / soft (big + faint: half resolution)
            this.buf = new Float32Array(this.cap * PRIM_FLOATS);
            this.layerBuf = new Float32Array(this.cap * PRIM_FLOATS);
            this.softBuf = new Float32Array(this.cap * PRIM_FLOATS);
            this.softLayerBuf = new Float32Array(this.cap * PRIM_FLOATS);
            this.unsupported = new Set();
            this.resetState();
            this.beginFrame();
        }

        resetState() {
            this.m = [1, 0, 0, 1, 0, 0];
            this.globalAlpha = 1;
            this.fillStyle = "#000";
            this.strokeStyle = "#000";
            this.lineWidth = 1;
            this.lineCap = "butt";
            this.lineJoin = "miter";
            this.globalCompositeOperation = "source-over";
            this.shadowBlur = 0;
            this.shadowColor = "transparent";
            this.imageSmoothingEnabled = true;
            this.filter = "none";
            this.stack = [];
            this.path = [];
        }

        beginFrame() {
            this.n = 0;
            this.layerN = 0;
            this.softN = 0;
            this.softLayerN = 0;
            this.inLayer = false;
            this.fade = null;          // { rgb, alpha } from the trail fillRect
            this.blackFix = false;
        }

        // --- state ---
        save() {
            this.stack.push([this.m.slice(), this.globalAlpha, this.fillStyle, this.strokeStyle, this.lineWidth,
                this.lineCap, this.lineJoin, this.globalCompositeOperation, this.shadowBlur, this.shadowColor]);
        }
        restore() {
            const s = this.stack.pop();
            if (!s) return;
            [this.m, this.globalAlpha, this.fillStyle, this.strokeStyle, this.lineWidth,
                this.lineCap, this.lineJoin, this.globalCompositeOperation, this.shadowBlur, this.shadowColor] = s;
        }
        setTransform(a, b, c, d, e, f) {
            if (typeof a === "object" && a) this.m = [a.a, a.b, a.c, a.d, a.e, a.f];
            else this.m = [a, b, c, d, e, f];
        }
        resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
        getTransform() { const m = this.m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }
        transform(a, b, c, d, e, f) {
            const m = this.m;
            this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d,
                m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
        }
        translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
        scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
        rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }

        px(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
        get scaleFactor() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
        get rotation() { return Math.atan2(this.m[1], this.m[0]); }

        // --- paths (stored in device pixels) ---
        beginPath() { this.path = []; }
        cur() {
            let sp = this.path[this.path.length - 1];
            if (!sp || sp.closed || sp.shape) { sp = { pts: [], closed: false, shape: null }; this.path.push(sp); }
            return sp;
        }
        moveTo(x, y) { this.path.push({ pts: [this.px(x, y)], closed: false, shape: null }); }
        lineTo(x, y) { this.cur().pts.push(this.px(x, y)); }
        closePath() {
            const sp = this.path[this.path.length - 1];
            if (sp && !sp.shape) { sp.closed = true; if (sp.pts.length) this.path.push({ pts: [sp.pts[0].slice()], closed: false, shape: null }); }
        }
        last() {
            const sp = this.path[this.path.length - 1];
            return sp && !sp.shape && sp.pts.length ? sp.pts[sp.pts.length - 1] : null;
        }
        quadraticCurveTo(cx, cy, x, y) {
            const p0 = this.last();
            const c = this.px(cx, cy), p1 = this.px(x, y);
            if (!p0) { this.moveTo(x, y); return; }
            const sp = this.cur();
            for (let i = 1; i <= 8; i++) {
                const t = i / 8, u = 1 - t;
                sp.pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
            }
        }
        bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
            const p0 = this.last();
            const a = this.px(c1x, c1y), b = this.px(c2x, c2y), p1 = this.px(x, y);
            if (!p0) { this.moveTo(x, y); return; }
            const sp = this.cur();
            for (let i = 1; i <= 10; i++) {
                const t = i / 10, u = 1 - t;
                sp.pts.push([u * u * u * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * p1[0],
                    u * u * u * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * p1[1]]);
            }
        }
        ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
            if (!(rx >= 0 && ry >= 0)) return;
            const full = Math.abs(a1 - a0) >= TAU - 1e-6;
            const sp = this.path[this.path.length - 1];
            if (full && (!sp || sp.shape || sp.closed || sp.pts.length === 0)) {
                const c = this.px(x, y), s = this.scaleFactor;
                if (sp && !sp.shape && sp.pts.length === 0) this.path.pop();
                this.path.push({ shape: "ellipse", cx: c[0], cy: c[1], rx: rx * s, ry: ry * s, rot: (rot || 0) + this.rotation, pts: [] });
                return;
            }
            // partial (or appended) arc: tessellate
            let sweep = a1 - a0;
            if (!ccw && sweep < 0) sweep = sweep % TAU + TAU;
            if (ccw && sweep > 0) sweep = sweep % TAU - TAU;
            if (Math.abs(sweep) > TAU) sweep = Math.sign(sweep) * TAU;
            const steps = Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
            const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
            const target = this.cur();
            for (let i = 0; i <= steps; i++) {
                const a = a0 + sweep * i / steps;
                const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
                target.pts.push(this.px(x + ex * cr - ey * sr, y + ex * sr + ey * cr));
            }
        }
        arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
        rect(x, y, w, h) {
            this.path.push({ pts: [this.px(x, y), this.px(x + w, y), this.px(x + w, y + h), this.px(x, y + h)], closed: true, shape: null });
        }

        // --- output ---
        push(type, pts, color, alpha, width, cap) {
            if (!color) return;
            const a = color[3] * alpha;
            if (a <= 0.001) return;
            // Big, faint shapes (glows, washes) go to the half-resolution pass.
            const size = type === TYPE.ellipse ? 2 * Math.min(pts[1][0], pts[1][1]) : width;
            const soft = a <= 0.3 && size >= 10;
            const key = (this.inLayer ? 1 : 0) + (soft ? 2 : 0);
            const bufName = ["buf", "layerBuf", "softBuf", "softLayerBuf"][key];
            const cntName = ["n", "layerN", "softN", "softLayerN"][key];
            const n = this[cntName];
            if (n >= this.cap) this.grow();
            const b = this[bufName], o = n * PRIM_FLOATS;
            for (let i = 0; i < 16; i++) b[o + i] = 0;
            for (let i = 0; i < pts.length && i < MAX_PTS; i++) { b[o + i * 2] = pts[i][0]; b[o + i * 2 + 1] = pts[i][1]; }
            b[o + 16] = color[0]; b[o + 17] = color[1]; b[o + 18] = color[2]; b[o + 19] = Math.min(1, a);
            b[o + 20] = type; b[o + 21] = Math.min(pts.length, MAX_PTS); b[o + 22] = width; b[o + 23] = cap;
            this[cntName]++;
        }
        grow() {
            this.cap *= 2;
            for (const k of ["buf", "layerBuf", "softBuf", "softLayerBuf"]) {
                const nb = new Float32Array(this.cap * PRIM_FLOATS); nb.set(this[k]); this[k] = nb;
            }
        }
        styleColor(style) {
            if (typeof style !== "string") { this.unsupported.add("gradient/pattern"); return null; }
            return parseColor(style);
        }
        noteState() {
            if (this.shadowBlur > 0) this.unsupported.add("shadowBlur");
            if (this.globalCompositeOperation !== "source-over" && this.globalCompositeOperation !== "difference") {
                this.unsupported.add("composite:" + this.globalCompositeOperation);
            }
        }

        fill() {
            this.noteState();
            const color = this.styleColor(this.fillStyle);
            for (const sp of this.path) {
                if (sp.shape === "ellipse") {
                    this.push(TYPE.ellipse, [[sp.cx, sp.cy], [sp.rx, sp.ry], [sp.rot, 0]], color, this.globalAlpha, 0, 0);
                } else if (sp.pts.length >= 3) {
                    if (sp.pts.length > MAX_PTS) {
                        // fan-split a long outline (eclipse rims): close enough for soft fills
                        const p = sp.pts;
                        for (let i = 1; i < p.length - 1; i += MAX_PTS - 2) {
                            this.push(TYPE.fill, [p[0], ...p.slice(i, i + MAX_PTS - 1)], color, this.globalAlpha, 0, 0);
                        }
                    } else {
                        this.push(TYPE.fill, sp.pts, color, this.globalAlpha, 0, 0);
                    }
                }
            }
        }

        stroke() {
            this.noteState();
            const color = this.styleColor(this.strokeStyle);
            const w = this.lineWidth * this.scaleFactor;
            const cap = CAP[this.lineCap] ?? 1;
            for (const sp of this.path) {
                if (sp.shape === "ellipse") {
                    if (Math.abs(sp.rx - sp.ry) < 1e-3) {
                        this.push(TYPE.ring, [[sp.cx, sp.cy], [sp.rx, 0]], color, this.globalAlpha, w, 0);
                        continue;
                    }
                    const pts = [];
                    const cr = Math.cos(sp.rot), sr = Math.sin(sp.rot);
                    for (let i = 0; i <= 32; i++) {
                        const a = TAU * i / 32, ex = Math.cos(a) * sp.rx, ey = Math.sin(a) * sp.ry;
                        pts.push([sp.cx + ex * cr - ey * sr, sp.cy + ex * sr + ey * cr]);
                    }
                    this.strokePolyline(pts, true, color, w, cap);
                } else if (sp.pts.length >= 2) {
                    this.strokePolyline(sp.closed ? [...sp.pts, sp.pts[0]] : sp.pts, sp.closed, color, w, cap);
                } else if (sp.pts.length === 1 && cap !== CAP.butt) {
                    this.push(TYPE.stroke, [sp.pts[0], sp.pts[0]], color, this.globalAlpha, w, cap);
                }
            }
        }

        // One tight primitive per segment (TYPE.chain). Each also carries its
        // neighbours and only keeps the pixels it is nearest to, so a
        // translucent stroke covers its joints once, like the canvas's.
        // Path ends get the cap; joints are round.
        strokePolyline(pts, closed, color, w, cap) {
            if (pts.length === 2) {
                // a single segment: tight oriented quad, caps at both ends
                this.push(TYPE.chain, [pts[0], pts[1], pts[0], pts[1]], color, this.globalAlpha, w, cap + 3 * cap + 300);
                return;
            }
            const n = pts.length - 1;
            for (let i = 0; i < n; i++) {
                const a = pts[i], b = pts[i + 1];
                const hasPrev = i > 0 || closed, hasNext = i < n - 1 || closed;
                const prev = i > 0 ? pts[i - 1] : (closed ? pts[n - 1] : a);
                const next = i < n - 1 ? pts[i + 2] : (closed ? pts[1] : b);
                // cap code: start cap (0..2) + 3 * end cap; 9 = no neighbour on that side
                const cs = hasPrev ? 0 : cap, ce = hasNext ? 0 : cap;
                this.push(TYPE.chain, [a, b, prev, next], color, this.globalAlpha, w,
                    cs + 3 * ce + (hasPrev ? 0 : 100) + (hasNext ? 0 : 200));
            }
        }

        fillRect(x, y, w, h) {
            const cv = this.canvas;
            const p0 = this.px(x, y), p1 = this.px(x + w, y + h);
            const covers = cv && Math.min(p0[0], p1[0]) <= 0.5 && Math.min(p0[1], p1[1]) <= 0.5
                && Math.max(p0[0], p1[0]) >= cv.width - 0.5 && Math.max(p0[1], p1[1]) >= cv.height - 0.5;
            if (covers) {
                if (this.globalCompositeOperation === "difference") { this.blackFix = true; return; }
                const c = this.styleColor(this.fillStyle) || [0, 0, 0, 1];
                this.fade = { rgb: [c[0], c[1], c[2]], alpha: Math.min(1, this.globalAlpha * c[3]) };
                return;
            }
            const save = this.path;
            this.path = [];
            this.rect(x, y, w, h);
            this.fill();
            this.path = save;
        }
        strokeRect(x, y, w, h) {
            const save = this.path;
            this.path = [];
            this.rect(x, y, w, h);
            this.stroke();
            this.path = save;
        }
        clearRect() {}
        drawImage() { this.unsupported.add("drawImage"); }
        createLinearGradient() { this.unsupported.add("gradient"); return { addColorStop() {} }; }
        createRadialGradient() { this.unsupported.add("gradient"); return { addColorStop() {} }; }
        setLineDash() {}
        measureText() { return { width: 0 }; }
        fillText() {}
    }

    // ---------------------------------------------------------------------
    // GPU primitives (device pixels)
    // ---------------------------------------------------------------------
    const PRIM_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;            // -1..1
layout(location=1) in vec4 a01;
layout(location=2) in vec4 a23;
layout(location=3) in vec4 a45;
layout(location=4) in vec4 a67;
layout(location=5) in vec4 col;
layout(location=6) in vec4 prm;               // type, npts, width, cap
uniform vec2 px;                              // target size in pixels
out vec2 pos;
flat out vec4 P0; flat out vec4 P1; flat out vec4 P2; flat out vec4 P3;
flat out vec4 C; flat out vec4 Q;
void main() {
    P0 = a01; P1 = a23; P2 = a45; P3 = a67; C = col; Q = prm;
    int type = int(prm.x + 0.5);
    int n = int(prm.y + 0.5);
    vec2 lo, hi;
    if (type == 4) {
        // oriented quad around one segment
        vec2 a = a01.xy, b = a01.zw;
        vec2 ab = b - a; float L = length(ab);
        vec2 dir = L > 1e-5 ? ab / L : vec2(1.0, 0.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        int code = int(prm.w + 0.5) % 100;
        bool square = (code % 3) == 2 || (code / 3) == 2;
        float hw = prm.z * 0.5;
        float ext = (square ? hw * 1.42 : hw) + 1.5;
        vec2 c = (a + b) * 0.5;
        pos = c + dir * corner.x * (L * 0.5 + ext) + nrm * corner.y * ext;
        gl_Position = vec4(pos.x / px.x * 2.0 - 1.0, 1.0 - pos.y / px.y * 2.0, 0.0, 1.0);
        return;
    }
    if (type == 0) {
        // oriented quad around the ellipse
        float cr = cos(a23.x), sr = sin(a23.x);
        vec2 e = corner * (a01.zw + 1.5);
        pos = a01.xy + vec2(cr * e.x - sr * e.y, sr * e.x + cr * e.y);
        gl_Position = vec4(pos.x / px.x * 2.0 - 1.0, 1.0 - pos.y / px.y * 2.0, 0.0, 1.0);
        return;
    }
    else if (type == 1) { float r = a01.z + prm.z * 0.5; lo = a01.xy - r; hi = a01.xy + r; }
    else {
        vec2 pts[8] = vec2[8](a01.xy, a01.zw, a23.xy, a23.zw, a45.xy, a45.zw, a67.xy, a67.zw);
        lo = pts[0]; hi = pts[0];
        for (int i = 1; i < 8; i++) { if (i >= n) break; lo = min(lo, pts[i]); hi = max(hi, pts[i]); }
        float pad = type == 2 ? prm.z * 0.75 : 0.0;
        lo -= pad; hi += pad;
    }
    lo -= 1.5; hi += 1.5;
    pos = mix(lo, hi, corner * 0.5 + 0.5);
    gl_Position = vec4(pos.x / px.x * 2.0 - 1.0, 1.0 - pos.y / px.y * 2.0, 0.0, 1.0);
}`;

    const PRIM_FS = `#version 300 es
precision highp float;
in vec2 pos;
flat in vec4 P0; flat in vec4 P1; flat in vec4 P2; flat in vec4 P3;
flat in vec4 C; flat in vec4 Q;
out vec4 frag;
float boxD(float u, float v, float e, float hw) {
    vec2 q = vec2(u - e, abs(v) - hw);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
// segment with a cap (0 round, 1 butt, 2 square) at its start and/or end
float segD(vec2 p, vec2 a, vec2 b, float hw, int c0, int c1) {
    vec2 ab = b - a; float L = length(ab);
    vec2 dir = L > 1e-5 ? ab / L : vec2(1.0, 0.0);
    vec2 ap = p - a;
    float u = dot(ap, dir), v = dot(ap, vec2(-dir.y, dir.x));
    if (u < 0.0 && c0 > 0) return boxD(-u, v, c0 == 2 ? hw : 0.0, hw);
    if (u > L && c1 > 0) return boxD(u - L, v, c1 == 2 ? hw : 0.0, hw);
    return length(p - (a + dir * clamp(u, 0.0, L))) - hw;
}
void main() {
    int type = int(Q.x + 0.5);
    int n = int(Q.y + 0.5);
    float d;
    if (type == 0) {
        vec2 q = pos - P0.xy;
        float cr = cos(P1.x), sr = sin(P1.x);
        q = vec2(cr * q.x + sr * q.y, -sr * q.x + cr * q.y);
        float e = length(q / max(P0.zw, vec2(1e-3)));
        d = (e - 1.0) / max(fwidth(e), 1e-4);
    } else if (type == 4) {
        int code = int(Q.w + 0.5);
        bool noPrev = code >= 100 && (code % 200) >= 100;
        bool noNext = code >= 200;
        int caps = code % 100;
        int cs = caps % 3, ce = caps / 3;
        float hw = Q.z * 0.5;
        d = segD(pos, P0.xy, P0.zw, hw, cs, ce);
        // leave pixels nearer a neighbouring segment to that segment
        if (!noPrev && segD(pos, P1.xy, P0.xy, hw, 0, 0) < d - 1e-4) discard;
        if (!noNext && segD(pos, P0.zw, P1.zw, hw, 0, 0) <= d) discard;
    } else if (type == 1) {
        d = abs(length(pos - P0.xy) - P0.z) - Q.z * 0.5;
    } else {
        vec2 pts[8] = vec2[8](P0.xy, P0.zw, P1.xy, P1.zw, P2.xy, P2.zw, P3.xy, P3.zw);
        if (type == 2) {
            int capCode = int(Q.w + 0.5);
            int cap = capCode % 10, where = capCode / 10;   // where: 0 both ends, 1 start only, 2 end only
            int cs = (where == 0 || where == 1) ? cap : 0;
            int ce = (where == 0 || where == 2) ? cap : 0;
            float hw = Q.z * 0.5;
            d = 1e9;
            if (n == 2 && distance(pts[0], pts[1]) < 1e-4) {     // a dot: round or square cap
                d = cap == 2 ? max(abs(pos.x - pts[0].x), abs(pos.y - pts[0].y)) - hw : length(pos - pts[0]) - hw;
            } else {
                for (int i = 0; i < 7; i++) {
                    if (i + 1 >= n) break;
                    d = min(d, segD(pos, pts[i], pts[i + 1], hw, i == 0 ? cs : 0, i + 2 == n ? ce : 0));
                }
            }
        } else {
            // polygon: even-odd inside test + distance to the outline
            bool inside = false;
            float e = 1e9;
            for (int i = 0; i < 8; i++) {
                if (i >= n) break;
                vec2 a = pts[i], b = pts[(i + 1) % n];
                if (i + 1 == n) b = pts[0];
                if ((a.y > pos.y) != (b.y > pos.y) && pos.x < (b.x - a.x) * (pos.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
                vec2 ab = b - a; float l2 = dot(ab, ab);
                float t = l2 > 1e-8 ? clamp(dot(pos - a, ab) / l2, 0.0, 1.0) : 0.0;
                e = min(e, length(pos - a - ab * t));
            }
            d = inside ? -e : e;
        }
    }
    float a = clamp(0.5 - d, 0.0, 1.0) * C.a;
    if (a <= 0.002) discard;
    frag = vec4(C.rgb * a, a);
}`;

    function compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("TVGL prim shader: " + gl.getShaderInfoLog(s));
        return s;
    }

    class PrimPass {
        constructor(gl) {
            this.gl = gl;
            const p = gl.createProgram();
            gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, PRIM_VS));
            gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, PRIM_FS));
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("TVGL prim link: " + gl.getProgramInfoLog(p));
            this.p = p;
            this.uPx = gl.getUniformLocation(p, "px");
            this.quad = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            this.inst = gl.createBuffer();
            this.instCap = 0;
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
            for (let a = 1; a <= 6; a++) {
                gl.enableVertexAttribArray(a);
                gl.vertexAttribPointer(a, 4, gl.FLOAT, false, PRIM_FLOATS * 4, (a - 1) * 16);
                gl.vertexAttribDivisor(a, 1);
            }
            gl.bindVertexArray(null);
        }
        draw(data, count, W, H) {
            if (!count) return;
            const gl = this.gl;
            const bytes = count * PRIM_FLOATS * 4;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
            if (bytes > this.instCap) { this.instCap = bytes * 2; gl.bufferData(gl.ARRAY_BUFFER, this.instCap, gl.DYNAMIC_DRAW); }
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * PRIM_FLOATS);
            gl.useProgram(this.p);
            gl.uniform2f(this.uPx, W, H);
            gl.bindVertexArray(this.vao);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        }
    }

    // ---------------------------------------------------------------------
    // Engine: the original FlowSimulation, recorded
    // ---------------------------------------------------------------------
    class RecEngine {
        constructor(gl, renderer) {
            this.gl = gl;
            this.renderer = renderer;
            this.prims = new PrimPass(gl);
            this.rec = new Recorder();
            this.axisClock = TvGLCore.makeAxisClock();
            this.bg = "#000000";
            this.sim = null;
            this.paused = false;
            this.lastPalette = "";
        }

        // The simulation reads a canvas, the window size and the colour picker.
        ensureSim(width, height, resolution) {
            const g = root;
            g.innerWidth = width;
            g.innerHeight = height;
            g.devicePixelRatio = resolution;
            const rec = this.rec;
            const fakeCanvas = { width: 0, height: 0, getContext: () => rec };
            rec.canvas = fakeCanvas;
            const picker = this.picker || (this.picker = { value: this.bg });
            const doc = g.document || (g.document = {});
            if (!doc.__tvglStub) {
                const base = doc.getElementById ? doc.getElementById.bind(doc) : () => null;
                doc.getElementById = id => id === "__tvgl_canvas" ? fakeCanvas : id === "bg-color-picker" ? picker : base(id);
                doc.__tvglStub = true;
            }
            if (!this.sim) {
                const sim = new FlowSimulation("__tvgl_canvas");
                sim.maxStepSeconds = 0.06;    // keep full speed at 25 fps
                sim.maxStepDt = 3.6;
                // Kaleidoscope: the layer is recorded separately and mirrored on the GPU.
                sim.drawKaleidoscoped = (draw) => {
                    if (sim.settings.kaleidoscopeEnabled && Math.floor(sim.settings.kaleidoscopeSegments || 6) >= 3) {
                        rec.inLayer = true;
                        rec.save();
                        try { draw(rec); } finally { rec.restore(); rec.inLayer = false; }
                    } else {
                        draw(rec);
                    }
                };
                this.sim = sim;
            } else {
                this.sim.resize(width, height, resolution);
            }
            fakeCanvas.width = Math.round(width * resolution);
            fakeCanvas.height = Math.round(height * resolution);
            return this.sim;
        }

        resize(width, height, resolution) {
            this.width = width; this.height = height; this.resolution = resolution;
            this.renderer.resize(Math.round(width * resolution), Math.round(height * resolution));
            this.ensureSim(width, height, resolution);
        }

        setSettings(s) {
            const sim = this.sim;
            if (!sim) return;
            const before = sim.settings.density;
            Object.assign(sim.settings, s);
            if (s.density !== undefined && s.density !== before) sim.updateDensity();
        }
        setPaletteCss(colors) {
            if (!this.sim || !colors) return;
            const key = colors.join("|");
            if (key === this.lastPalette) return;
            this.lastPalette = key;
            this.sim.updatePalette(colors.slice());
        }
        setBackgroundCss(css) { this.bg = css; if (this.picker) this.picker.value = css; }
        setParticleScale(v) { if (this.sim) this.sim.setParticleScale(v); }
        addShockwave(...a) { this.sim && this.sim.triggerShockwave(...a); }
        addVortex(...a) { this.sim && this.sim.triggerVortex(...a); }
        get count() { return this.sim ? this.sim.particles.length : 0; }

        frame(nowMs) {
            const sim = this.sim;
            if (!sim || this.paused) return this.count;
            const rec = this.rec;
            rec.beginFrame();
            rec.resetState();
            rec.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);   // FlowSimulation.initCanvas
            sim.tick();
            const W = this.renderer.W, H = this.renderer.H;
            let kaleido = null;
            if (rec.layerN + rec.softLayerN > 0) {
                const axis = this.axisClock(sim.settings.spinningKaleido === true, nowMs / 1000);
                kaleido = TvGLCore.kaleidoMesh(W, H, sim.settings, axis);
            } else {
                this.axisClock(sim.settings.spinningKaleido === true, nowMs / 1000);
            }
            this.renderer.drawRecorded(this.prims, rec, kaleido);
            return this.count;
        }
    }

    // Soft (big, faint) primitives at half resolution, laid over, then sharp.
    function drawSet(r, prims, target, softBuf, softN, buf, n) {
        const gl = r.gl, W = r.W, H = r.H;
        if (softN > 0) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, r.clouds.fb);
            gl.viewport(0, 0, Math.max(1, W >> 1), Math.max(1, H >> 1));
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            prims.draw(softBuf, softN, W, H);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
            gl.viewport(0, 0, W, H);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.useProgram(r.copy.p);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, r.clouds.tex);
            gl.uniform1i(r.copy.u.src, 0);
            gl.bindVertexArray(r.quadVAO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, W, H);
        prims.draw(buf, n, W, H);
    }

    // Renderer pass for recorded frames: fade, layer (+ mirror), direct, present.
    TvGLCore.Renderer.prototype.drawRecorded = function (prims, rec, kaleido) {
        const gl = this.gl, W = this.W, H = this.H;
        const src = this.trails[this.cur], dst = this.trails[1 - this.cur];
        gl.viewport(0, 0, W, H);
        gl.bindVertexArray(this.quadVAO);
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        gl.disable(gl.BLEND);
        const fade = rec.fade || { rgb: [0, 0, 0], alpha: 0.012 };
        gl.useProgram(this.fade.p);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(this.fade.u.prev, 0);
        gl.uniform3fv(this.fade.u.bg, fade.rgb);
        gl.uniform1f(this.fade.u.amount, fade.alpha);
        gl.uniform1f(this.fade.u.blackBg, rec.blackFix ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        const layerCount = rec.layerN + rec.softLayerN;
        if (layerCount > 0 && kaleido && kaleido.length) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.layer.fb);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            drawSet(this, prims, this.layer.fb, rec.softLayerBuf, rec.softLayerN, rec.layerBuf, rec.layerN);
            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.useProgram(this.mesh.p);
            gl.uniform2f(this.mesh.u.px, W, H);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layer.tex);
            gl.uniform1i(this.mesh.u.src, 0);
            gl.bindVertexArray(this.meshVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuf);
            gl.bufferData(gl.ARRAY_BUFFER, kaleido, gl.STREAM_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, kaleido.length / 4);
        } else if (layerCount > 0) {
            drawSet(this, prims, dst.fb, rec.softLayerBuf, rec.softLayerN, rec.layerBuf, rec.layerN);
        }
        drawSet(this, prims, dst.fb, rec.softBuf, rec.softN, rec.buf, rec.n);

        gl.disable(gl.BLEND);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(this.copy.p);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dst.tex);
        gl.uniform1i(this.copy.u.src, 0);
        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.cur = 1 - this.cur;
    };

    // Authored scenes the recorder draws (Particle-based, canvas subset only).
    // The module scenes (Celtic, Molecular, Cymatic, Stellar, Chrome, Mandelbrot)
    // use gradients/images and stay 2D for now; Supernova's 66 eclipses too.
    const RECORDED_SHAPES = new Set([
        "ocean", "aurora", "orbitals", "lotus", "spiral", "pendulumSpiral", "tightTailVortex", "painterlyVortex",
        "pipes", "pipesTight", "pipesCathedral", "pipesShrine", "jadeCurrents", "quantumDrift", "prismDrift",
        "nebulaSpark", "violetUndertow", "zenMandala", "quantumLattice", "gravityWell", "fractalBloom"
    ]);

    root.TvGLRecorder = { Recorder, RecEngine, PrimPass, parseColor, RECORDED_SHAPES, TYPE, CAP, PRIM_FLOATS };
})(typeof self !== "undefined" ? self : globalThis);
