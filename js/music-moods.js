// ==========================================================================
// ETERNAL VOID - MUSIC MOODS
// One shared music signal (bass hit, midrange, treble, sustained energy, beat
// phase) plus a distinct "voice" for every preset family. Nothing here writes
// to saved settings: effects are multipliers/impulses applied per frame and they
// vanish the moment the signal stops (reset()).
// ==========================================================================
const MusicMoods = (() => {
    const TAU = Math.PI * 2;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

    const state = {
        active: false, gain: 1,
        bass: 0, mid: 0, treble: 0,     // 0..1 levels (treble is an attack envelope)
        energy: 0, drive: 0, build: 0,  // slow loudness, 0..1 sustained drive, rise above recent average
        beat: 0, beatId: 0,             // decaying beat pulse and a counter that ticks per beat
        phase: 0, lock: 0, bpm: 120,    // beat-locked sawtooth 0..1 (0 = on the beat), tempo confidence, tempo
        t: 0, flow: 0                   // frame clock and extra "seconds" of flow earned from music
    };

    let lastNow = 0, lastBeatAt = 0, period = 500, intervals = [], energyLong = 0, midMax = 0.2, lastLoud = 0;
    // Adaptive onset tracking: real music never drops to silence between kicks and the analyser smooths it,
    // so beats are found by bass rising above its own recent average rather than by a big frame-to-frame jump.
    let bassSlow = 0, bassFast = 0, bassDev = 0.05, bassPrev = 0, lastOver = 0;
    // Periodicity (tempo) tracker: a steady repeating bass pulse makes beat detection more sensitive
    // right where the next beat is due, while random bass notes and noise stay strict.
    const AC_N = 300, AC_MIN = 20, AC_MAX = 60;
    const acBuf = new Float32Array(AC_N);
    let acHead = 0, acCount = 0, acAccum = 0, acTick = 0, acConf = 0;
    function analysePeriodicity() {
        const x = new Float32Array(AC_N);
        for (let i = 0; i < AC_N; i++) x[i] = acBuf[(acHead + i) % AC_N];
        const corr = L => {
            let ab = 0, aa = 0, bb = 0;
            for (let i = L; i < AC_N; i++) { ab += x[i] * x[i - L]; aa += x[i] * x[i]; bb += x[i - L] * x[i - L]; }
            return aa > 1e-7 && bb > 1e-7 ? ab / Math.sqrt(aa * bb) : 0;
        };
        const r = [];
        let best = 0, bestL = 0;
        for (let L = AC_MIN; L <= AC_MAX; L++) { r[L] = corr(L); if (r[L] > best) { best = r[L]; bestL = L; } }
        acConf = best;
        if (best > 0.3 && bestL) {
            // Prefer the faster pulse when half the lag is nearly as strong (avoid locking to half-time).
            const h = Math.round(bestL / 2);
            if (h >= AC_MIN && r[h] >= best * 0.85) bestL = h;
            period = period * 0.5 + (bestL * 16.667) * 0.5;
            state.bpm = 60000 / period;
        }
    }

    // Voices. All values are bounded, modest multipliers; gain (Comfort / 3D) scales them all.
    //  kick   radial impulse on a beat (+ outward, - inward "gasp")   swirl  tangential push from midrange
    //  sway   side-to-side push from midrange                         rise   upward impulse on beat (- = downward)
    //  surge  speed multiplier from sustained energy and beats        pulse  size swell on beat
    //  bloom  size swell from sustained energy                        glow   brightness on beat
    //  lift   brightness from sustained energy                        twinkle per-particle shimmer from treble
    //  ripple beat-locked wave {amp, dir:'out'|'in'|'x'|'y', freq, to:'size'|'alpha'|'both'}
    //  hop / spin / orbit / advance: family-specific beat or energy reactions
    const DEFAULT_PROFILES = {
        lotus:            { kick: .55, pulse: .12, bloom: .10, glow: .18, lift: .10, surge: .15, ripple: { amp: .16, dir: 'out', freq: 1.2, to: 'size' } },
        nebulaSpark:      { kick: 1.3, swirl: .25, pulse: .15, bloom: .2, glow: .25, lift: .15, surge: .25, ripple: { amp: .18, dir: 'out', freq: .9, to: 'alpha' } },
        solarFlare:       { kick: 1.0, pulse: .18, glow: .3, lift: .2, surge: .3, ripple: { amp: .15, dir: 'out', freq: 1.1, to: 'alpha' } },
        jadeCurrents:     { sway: .5, swirl: .3, glow: .12, lift: .12, surge: .3, ripple: { amp: .22, dir: 'x', freq: 1.1, to: 'both' } },
        quantumDrift:     { hop: .10, kick: .7, pulse: .15, glow: .3, lift: .15, twinkle: .25, surge: .15, ripple: { amp: .12, dir: 'out', freq: 1.6, to: 'alpha' } },
        violetUndertow:   { swirl: .7, kick: -.5, pulse: .10, glow: .15, lift: .12, surge: .35 },
        prismDrift:       { spin: 1, kick: .6, pulse: .16, glow: .2, lift: .15, surge: .2, ripple: { amp: .14, dir: 'out', freq: 1.4, to: 'size' } },
        pendulumSpiral:   { advance: 1, kick: .5, pulse: .10, bloom: .12, glow: .15, surge: .2, ripple: { amp: .12, dir: 'out', freq: 1.0, to: 'alpha' } },
        spiral:           { advance: 1, kick: .4, swirl: .3, pulse: .10, glow: .15, lift: .12, surge: .2, ripple: { amp: .15, dir: 'out', freq: 1.0, to: 'both' } },
        tightTailVortex:  { kick: -.9, swirl: .6, glow: .2, lift: .12, surge: .4 },
        painterlyVortex:  { kick: -.6, swirl: .45, pulse: .12, bloom: .10, glow: .12, surge: .3 },
        aquatic:          { rise: .9, sway: .5, pulse: .22, bloom: .12, glow: .2, surge: .2, ripple: { amp: .15, dir: 'y', freq: 1.3, to: 'size' } },
        acid:             { rise: -.7, glow: .35, lift: .2, twinkle: .2, surge: .5 },
        ellipse:          { kick: .5, swirl: .2, pulse: .14, glow: .2, lift: .12, surge: .2, ripple: { amp: .18, dir: 'out', freq: 1.0, to: 'size' } },
        ring:             { kick: .4, pulse: .2, bloom: .12, glow: .2, lift: .1, surge: .2, ripple: { amp: .2, dir: 'out', freq: 1.5, to: 'both' } },
        nebula:           { pulse: .10, bloom: .25, glow: .2, lift: .25, twinkle: .45, surge: .25, ripple: { amp: .10, dir: 'out', freq: .8, to: 'alpha' } },
        brush:            { swirl: .5, sway: .3, pulse: .15, bloom: .15, glow: .1, surge: .3 },
        cluster:          { kick: -.8, pulse: .3, bloom: .12, glow: .25, lift: .12, surge: .2 },
        ocean:            { rise: .7, sway: .4, pulse: .10, bloom: .12, glow: .12, surge: .3, ripple: { amp: .15, dir: 'x', freq: 1.4, to: 'alpha' } },
        aurora:           { sway: .8, rise: .5, glow: .2, lift: .3, twinkle: .3, surge: .3, ripple: { amp: .22, dir: 'y', freq: 1.2, to: 'alpha' } },
        orbitals:         { orbit: 1, kick: .5, pulse: .14, glow: .2, lift: .12, surge: .2, ripple: { amp: .14, dir: 'out', freq: 1.2, to: 'alpha' } },
        // Circuit families flash like signals travelling the board.
        pipes:            { pulse: .10, glow: .45, lift: .2, ripple: { amp: .35, dir: 'x', freq: 1.5, to: 'alpha' } },
        pipesTight:       { pulse: .10, glow: .45, lift: .2, ripple: { amp: .35, dir: 'y', freq: 2.2, to: 'alpha' } },
        pipesCathedral:   { pulse: .12, bloom: .15, glow: .4, lift: .2, ripple: { amp: .35, dir: 'out', freq: 1.0, to: 'both' } },
        pipesShrine:      { pulse: .10, glow: .4, lift: .2, ripple: { amp: .35, dir: 'in', freq: 1.3, to: 'alpha' } },
        // Time-composed families (positions come from a clock, so surge speeds the clock).
        quantumLattice:   { pulse: .12, glow: .25, lift: .12, surge: .35, ripple: { amp: .2, dir: 'x', freq: 2.0, to: 'both' } },
        zenMandala:       { pulse: .15, bloom: .15, glow: .2, lift: .1, surge: .3, ripple: { amp: .2, dir: 'out', freq: .8, to: 'size' } },
        gravityWell:      { pulse: .10, glow: .3, lift: .2, surge: .4, ripple: { amp: .25, dir: 'in', freq: 1.2, to: 'alpha' } },
        fractalBloom:     { pulse: .18, bloom: .15, glow: .25, lift: .1, surge: .35, ripple: { amp: .22, dir: 'out', freq: 1.4, to: 'both' } },
        chromeRibbon:     { pulse: .08, glow: .15, lift: .10, surge: .3, ripple: { amp: .15, dir: 'x', freq: .9, to: 'alpha' } },
        // Own renderers: they read flowOffset()/beatSwell() instead of per-particle hooks.
        celticCurrent:    { surge: .35, module: true },
        celticKnotwork:   { surge: .3, module: true },
        // Fully bespoke music code already lives in these modules.
        cymaticResonance: { self: true, surge: 0 },
        mandelbrotDive:   { self: true, surge: 0 },
        molecularDance:   { self: true, surge: 0 },
        // Stellar Nursery (branch stellar-on-prod) has its own bass ring and star flare.
        stellarNursery:   { self: true, surge: 0 }
    };
    const FALLBACK = { pulse: .10, glow: .15, lift: .10, surge: .2 };
    const clone = o => JSON.parse(JSON.stringify(o));
    // Live voices (the Music Lab edits these; defaults stay in DEFAULT_PROFILES).
    const PROFILES = clone(DEFAULT_PROFILES);
    const profileFor = shape => PROFILES[shape] || FALLBACK;

    // Tunable numbers with hard limits. Everything the lab can change is bounded here, so a
    // pasted settings line can never push a voice outside what the runtime clamps allow.
    const PARAMS = [
        { key: 'kick',    min: -2,  max: 2,   step: .05, label: 'Beat kick',       hint: 'Radial shove on each beat. Positive pushes outward, negative pulls inward.' },
        { key: 'swirl',   min: 0,   max: 1.5, step: .05, label: 'Midrange swirl',  hint: 'Sideways spin driven by midrange.' },
        { key: 'sway',    min: 0,   max: 1.5, step: .05, label: 'Midrange sway',   hint: 'Left-right drift driven by midrange.' },
        { key: 'rise',    min: -1.5, max: 1.5, step: .05, label: 'Beat lift',      hint: 'Vertical shove on each beat. Positive up, negative down.' },
        { key: 'surge',   min: 0,   max: 1,   step: .01, label: 'Energy surge',    hint: 'Speed-up while the music is loud, plus a little on each beat.' },
        { key: 'pulse',   min: 0,   max: .6,  step: .01, label: 'Beat swell',      hint: 'Marks grow on each beat (on top of the app\'s own bass swell).' },
        { key: 'bloom',   min: 0,   max: .6,  step: .01, label: 'Energy bloom',    hint: 'Marks grow while the music is loud.' },
        { key: 'glow',    min: 0,   max: .8,  step: .01, label: 'Beat glow',       hint: 'Brightness flash on each beat.' },
        { key: 'lift',    min: 0,   max: .6,  step: .01, label: 'Energy brightness', hint: 'Brighter while the music is loud.' },
        { key: 'twinkle', min: 0,   max: 1,   step: .01, label: 'Treble twinkle',  hint: 'Per-mark shimmer on treble.' },
        { key: 'hop',     min: 0,   max: .4,  step: .01, label: 'Quantum jump chance', hint: 'Chance a mark jumps to a new node on a beat.', only: 'hop' },
        { key: 'spin',    min: 0,   max: 2,   step: .05, label: 'Spin-up',         hint: 'How much loudness and beats spin the facets.', only: 'spin' },
        { key: 'orbit',   min: 0,   max: 2,   step: .05, label: 'Orbit speed-up',  hint: 'How much loudness and beats speed the orbits.', only: 'orbit' },
        { key: 'advance', min: 0,   max: 2,   step: .05, label: 'Path surge',      hint: 'How far beats and loudness push marks along their path.', only: 'advance' },
        { key: 'ripple.amp',  min: 0,  max: .8, step: .01, label: 'Ripple strength', hint: 'Tempo-locked wave. Only shows while a beat is detected.' },
        { key: 'ripple.freq', min: .2, max: 4,  step: .05, label: 'Ripple spacing',  hint: 'Waves across the screen: higher = tighter rings or stripes.' }
    ];
    const CHOICES = {
        'ripple.dir': ['out', 'in', 'x', 'y'],
        'ripple.to': ['size', 'alpha', 'both']
    };
    const param = key => PARAMS.find(p => p.key === key);

    function setProfile(shape, values) {
        const prof = PROFILES[shape];
        if (!prof || !values || typeof values !== 'object') return null;
        const flat = {};
        for (const [k, v] of Object.entries(values)) {
            if (k === 'ripple' && v && typeof v === 'object') for (const [rk, rv] of Object.entries(v)) flat['ripple.' + rk] = rv;
            else flat[k] = v;
        }
        for (const [k, v] of Object.entries(flat)) {
            if (CHOICES[k]) {
                if (!CHOICES[k].includes(v)) continue;
                prof.ripple = prof.ripple || { amp: 0, dir: 'out', freq: 1, to: 'both' };
                prof.ripple[k.slice(7)] = v;
                continue;
            }
            const meta = param(k);
            const n = Number(v);
            if (!meta || !Number.isFinite(n)) continue;
            const value = Math.round(clamp(n, meta.min, meta.max) * 1e4) / 1e4;
            if (k.startsWith('ripple.')) {
                prof.ripple = prof.ripple || { amp: 0, dir: 'out', freq: 1, to: 'both' };
                prof.ripple[k.slice(7)] = value;
            } else prof[k] = value;
        }
        return prof;
    }
    const resetProfile = shape => { if (DEFAULT_PROFILES[shape]) PROFILES[shape] = clone(DEFAULT_PROFILES[shape]); };
    const flatten = prof => {
        const out = {};
        for (const [k, v] of Object.entries(prof || {})) {
            if (k === 'ripple' && v) for (const [rk, rv] of Object.entries(v)) out['ripple.' + rk] = rv;
            else if (typeof v === 'number') out[k] = v;
        }
        return out;
    };
    // Only what differs from the shipped defaults (what the lab copies).
    function exportChanges() {
        const out = {};
        for (const shape of Object.keys(PROFILES)) {
            const now = flatten(PROFILES[shape]), base = flatten(DEFAULT_PROFILES[shape]);
            const diff = {};
            for (const k of new Set([...Object.keys(now), ...Object.keys(base)])) {
                if (!param(k)) continue;
                if ((now[k] ?? 0) !== (base[k] ?? 0)) diff[k] = now[k] ?? 0;
            }
            const nowR = PROFILES[shape].ripple, baseR = DEFAULT_PROFILES[shape].ripple;
            for (const k of ['dir', 'to']) if ((nowR && nowR[k]) !== (baseR && baseR[k]) && nowR) diff['ripple.' + k] = nowR[k];
            if (Object.keys(diff).length) out[shape] = diff;
        }
        return out;
    }

    function median(list) {
        const s = [...list].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
    }

    function registerBeat(now, strength) {
        const gap = now - lastBeatAt;
        if (lastBeatAt && gap < 1500) {
            intervals.push(gap);
            if (intervals.length > 8) intervals.shift();
        } else if (gap >= 1500) {
            intervals.length = 0;
        }
        lastBeatAt = now;
        state.beat = Math.max(state.beat, strength);
        state.beatId++;
        state.lock = 1;
        if (intervals.length >= 3) {
            let p = median(intervals);
            while (p < 333) p *= 2;
            while (p > 1000) p /= 2;
            period = period * 0.7 + p * 0.3;
            state.bpm = 60000 / period;
        }
        // Soft phase lock: pull the sawtooth toward 0 on every beat.
        const err = state.phase < 0.5 ? state.phase : state.phase - 1;
        state.phase = (state.phase - err * 0.6 + 1) % 1;
    }

    // f: { now(ms), bass, treble (0..1 normalised levels), mid, level (raw 0..1 optional),
    //      bassAttack, trebleAttack, gain, bassOn, trebleOn }
    function feed(f) {
        const now = Number(f.now) || Date.now();
        const dt = lastNow ? clamp((now - lastNow) / 16.667, 0.25, 3) : 1;
        lastNow = now;
        state.active = true;
        state.gain = clamp(f.gain ?? 1, 0, 1.5);
        state.t += dt;
        const bassOn = f.bassOn !== false;
        const trebleOn = f.trebleOn !== false;

        const bass = clamp(f.bass, 0, 1);
        const trebleLevel = clamp(f.trebleLevel ?? f.treble, 0, 1);
        const midRaw = clamp(f.mid, 0, 1);
        midMax = Math.max(0.1, midRaw, midMax * 0.9995);
        const midN = clamp(midRaw / midMax, 0, 1);

        // Beats: a sharp bass attack (clean material) OR bass rising clearly above its own running average
        // (real, smoothed music). Short refractory period either way.
        // Work on a lightly smoothed bass so soft, slow-attack pulses (ambient, dub) still stand out from noise.
        bassFast += (bass - bassFast) * Math.min(1, 0.3 * dt);
        const rise = bassFast - bassPrev;
        bassPrev = bassFast;
        bassSlow += (bassFast - bassSlow) * Math.min(1, 0.05 * dt);
        const over = bassFast - bassSlow;
        bassDev += (Math.abs(over) - bassDev) * Math.min(1, 0.05 * dt);
        acAccum += dt * 16.667;
        while (acAccum >= 16.667) {
            acAccum -= 16.667;
            acBuf[acHead] = over; acHead = (acHead + 1) % AC_N;
            if (acCount < AC_N) acCount++;
            acTick++;
        }
        if (acTick >= 30 && acCount >= AC_N) { acTick = 0; analysePeriodicity(); }
        // When the bass is clearly periodic, accept softer onsets near where a beat is due.
        let due = 1;
        if (acConf > 0.3 && lastBeatAt) {
            const q = (now - lastBeatAt) / period;
            if (Math.abs(q - Math.max(1, Math.round(q))) < 0.22) due = 0.45;
        }
        const sharp = clamp(f.bassAttack, 0, 1) > 0.12 && bass > 0.3;
        const swell = over > Math.max(0.010, bassDev * 2.6 * due) && rise > 0.001 && over >= lastOver && bass > 0.2;
        lastOver = over;
        if (bassOn && (sharp || swell) && now - lastBeatAt > 220) {
            registerBeat(now, clamp(Math.max(f.bassAttack * 4, 0.6 + over * 3), 0.6, 1));
        }
        state.beat = bassOn ? state.beat * Math.pow(0.88, dt) : 0;
        if (state.beat < 0.01) state.beat = 0;
        state.phase = (state.phase + dt * 16.667 / period) % 1;
        if (now - lastBeatAt > 2500) state.lock *= Math.pow(0.97, dt);
        if (state.lock < 0.02) state.lock = 0;
        // A clearly periodic bass pulse keeps the tempo-locked ripple alive even when single beats are soft.
        if (bassOn && acConf > 0.3 && state.lock < 0.6) state.lock = 0.6;

        const loud = clamp(0.5 * bass + 0.3 * midN + 0.2 * trebleLevel, 0, 1);
        lastLoud = loud;
        state.energy += (loud - state.energy) * 0.04 * dt;
        energyLong += (state.energy - energyLong) * 0.004 * dt;
        state.drive = clamp((state.energy - 0.2) / 0.5, 0, 1);
        state.build = clamp((state.energy - energyLong) * 3.5, 0, 1);
        state.bass = bass;
        state.mid += (midN - state.mid) * 0.2 * dt;
        state.treble = trebleOn
            ? Math.max(state.treble * Math.pow(0.86, dt), clamp(f.trebleAttack, 0, 1) * 3.2)
            : 0;
        state.treble = clamp(state.treble, 0, 1);
        state.flow += dt / 60 * (state.drive * 0.5 + state.beat * 1.4) * state.gain;
    }

    function reset() {
        state.active = false;
        state.bass = state.mid = state.treble = 0;
        state.energy = state.drive = state.build = 0;
        state.beat = 0; state.lock = 0; state.phase = 0;
        intervals.length = 0; period = 500; state.bpm = 120;
        energyLong = 0; lastNow = 0; lastBeatAt = 0; midMax = 0.2;
        bassSlow = 0; bassFast = 0; bassDev = 0.05; bassPrev = 0; lastOver = 0;
        acBuf.fill(0); acHead = acCount = acTick = 0; acAccum = 0; acConf = 0;
        // flow and t keep their values so time never jumps backwards.
    }

    function speedMul(shape) {
        if (!state.active) return 1;
        const p = profileFor(shape);
        return 1 + clamp(((p.surge || 0) * (state.drive + state.beat * 0.6)) * state.gain, 0, 0.9);
    }

    const _steer = { vx: 0, vy: 0, speed: 1 };
    // Per-particle motion hook. Returns an additive target-velocity nudge and a speed multiplier.
    function steer(p, settings, t, scaleRef, dt = 1) {
        const shape = settings.particleShape;
        const prof = profileFor(shape);
        if (prof.module || prof.self) { _steer.vx = _steer.vy = 0; _steer.speed = 1; return _steer; }
        const g = state.gain;
        const beat = state.beat * g;
        const m = state.mid * (0.4 + 0.6 * state.drive) * g;
        const dx = p.x - p.w * 0.5, dy = p.y - p.h * 0.5;
        const d = Math.max(1, Math.hypot(dx, dy));
        let vx = 0, vy = 0;
        if (prof.kick && beat > 0.02) { vx += dx / d * prof.kick * beat; vy += dy / d * prof.kick * beat; }
        if (prof.swirl && m > 0.02) { vx += -dy / d * prof.swirl * m; vy += dx / d * prof.swirl * m; }
        if (prof.sway && m > 0.02) vx += Math.sin(state.t * 0.03 + p.effectPhase) * prof.sway * m;
        if (prof.rise) vy -= prof.rise * (beat + 0.3 * state.drive * g);

        if (prof.hop && p.mmBeat !== state.beatId) {
            p.mmBeat = state.beatId;
            if (state.beat > 0.3 && Math.random() < prof.hop * g) p.tunnelTimer = 1e6; // quantum jump on the beat
        }
        if (prof.spin) p.prismRot = (p.prismRot ?? 0) + (state.drive * 0.03 + beat * 0.12) * prof.spin * g * dt;
        if (prof.orbit) p.effectPhase += (state.drive * 0.6 + beat * 1.4) * 0.004 * prof.orbit * g * dt;
        if (prof.advance) {
            const step = (state.drive * 0.00022 + beat * 0.0010) * prof.advance * g * dt;
            if (shape === 'pendulumSpiral') { if (p.spiralProgress !== undefined) p.spiralProgress += step; }
            else p.effectRole = (p.effectRole + step) % 1;
        }
        // Hard ceiling so no combination of tuned values can fling marks around.
        const mag = Math.hypot(vx, vy);
        if (mag > 3.4) { vx *= 3.4 / mag; vy *= 3.4 / mag; }
        _steer.vx = vx * scaleRef;
        _steer.vy = vy * scaleRef;
        _steer.speed = speedMul(shape);
        return _steer;
    }

    const _look = { size: 1, alpha: 1 };
    // Per-particle draw hook. Returns bounded size and alpha multipliers.
    function look(p, settings) {
        const prof = profileFor(settings.particleShape);
        const g = state.gain;
        const beat = state.beat * g;
        const drive = state.drive * g;
        let s = 1 + beat * (prof.pulse || 0) + drive * (prof.bloom || 0);
        let a = 1 + beat * (prof.glow || 0) + drive * (prof.lift || 0);
        const r = prof.ripple;
        if (r && state.lock > 0.05) {
            let ph;
            if (r.dir === 'x') ph = state.phase - (p.x / p.w) * r.freq;
            else if (r.dir === 'y') ph = state.phase - (1 - p.y / p.h) * r.freq;
            else {
                const rad = Math.hypot(p.x - p.w * 0.5, p.y - p.h * 0.5) / (Math.min(p.w, p.h) * 0.7);
                ph = r.dir === 'in' ? state.phase + rad * r.freq : state.phase - rad * r.freq;
            }
            const wave = (Math.cos(TAU * ph) + 1) / 2;
            const amount = r.amp * state.lock * g * (0.4 + 0.6 * Math.max(state.drive, state.beat)) * wave * wave;
            if (r.to !== 'alpha') s += amount;
            if (r.to !== 'size') a += amount;
        }
        if (prof.twinkle && state.treble > 0.03) {
            a *= 1 + state.treble * g * prof.twinkle * Math.sin(p.effectPhase * 3 + state.t * 0.5);
        }
        _look.size = clamp(s, 0.85, 1.9);
        _look.alpha = clamp(a, 0.7, 1.5);
        return _look;
    }

    // For modules with their own renderer.
    const flowOffset = () => state.flow;
    const beatSwell = amount => state.active ? 1 + state.beat * state.gain * amount : 1;

    return { state, PROFILES, DEFAULT_PROFILES, PARAMS, CHOICES, profileFor, setProfile, resetProfile, exportChanges,
        feed, reset, steer, look, speedMul, flowOffset, beatSwell,
        get active() { return state.active; } };
})();

window.MusicMoods = MusicMoods;
if (typeof module !== 'undefined' && module.exports) module.exports = MusicMoods;
