(function () {
    'use strict';
    const defaults = { binaural: true, bilateral: true, carrier: 200, beat: 6, interval: 5, width: .8, volume: .3, tone: .35, texture: .6, sound: 'soft', movement: 'sweep', minutes: 0 };
    const ranges = { carrier: [80, 400], beat: [1, 40], interval: [2, 20], width: [0, 1], volume: [0, 1], tone: [0, 1], texture: [0, 1], minutes: [0, 120] };
    function sanitize(raw = {}) {
        const s = { ...defaults };
        for (const [k, limits] of Object.entries(ranges)) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) s[k] = Math.max(limits[0], Math.min(limits[1], raw[k]));
        for (const k of ['binaural', 'bilateral']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
        if (['soft', 'wind', 'deep'].includes(raw.sound)) s.sound = raw.sound;
        if (['sweep', 'alternate'].includes(raw.movement)) s.movement = raw.movement;
        return s;
    }
    class SpatialEngine {
        constructor(synth, settings = defaults) { this.synth = synth; this.settings = sanitize(settings); this.running = false; this.nodes = []; this.sources = []; this.generation = 0; }
        node(n, source = false) { this.nodes.push(n); if (source) this.sources.push(n); return n; }
        async start() {
            this.synth.init();
            const ctx = this.synth.ctx;
            if (!ctx) throw new Error('Audio is unavailable in this browser.');
            // Claim the source before resume so a later source selection cancels this start.
            this.synth.stopMusicReactivity();
            const request = ++this.generation;
            const sourceRequest = this.synth.sourceGeneration;
            await ctx.resume();
            if (request !== this.generation || sourceRequest !== this.synth.sourceGeneration) return false;
            this.release(); this.ctx = ctx;
            this.output = this.node(ctx.createGain()); this.output.gain.value = 0;
            this.tones = this.node(ctx.createGain());
            const merger = this.node(ctx.createChannelMerger(2));
            this.left = this.node(ctx.createOscillator(), true); this.right = this.node(ctx.createOscillator(), true);
            this.left.type = this.right.type = 'sine';
            this.left.frequency.value = this.settings.carrier; this.right.frequency.value = this.settings.carrier + this.settings.beat;
            // Separate mono inputs: carrier remains fixed; the beat is their exact difference.
            this.left.connect(merger, 0, 0); this.right.connect(merger, 0, 1);
            merger.connect(this.tones); this.tones.connect(this.output);
            this.texture = this.node(ctx.createGain()); this.pan = this.node(ctx.createStereoPanner());
            this.filter = this.node(ctx.createBiquadFilter()); this.filter.type = 'lowpass';
            this.texture.connect(this.pan); this.pan.connect(this.output);
            if (this.settings.sound === 'wind') {
                const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0);
                let last = 0;
                for (let i = 0; i < data.length; i++) { last = (last + .03 * (Math.random() * 2 - 1)) / 1.03; data[i] = last * 3; }
                const noise = this.node(ctx.createBufferSource(), true); noise.buffer = buffer; noise.loop = true; noise.connect(this.filter);
            } else {
                const pulse = this.node(ctx.createOscillator(), true); pulse.type = 'sine'; pulse.frequency.value = this.settings.sound === 'deep' ? 110 : 180; pulse.connect(this.filter);
            }
            this.filter.frequency.value = this.settings.sound === 'wind' ? 650 : 400;
            this.filter.connect(this.texture);
            this.running = true; this.started = ctx.currentTime; this.scheduled = this.started + .05; this.cycle = 0; this.lastCycle = this.previousCycle = null;
            this.apply(); this.sources.forEach(n => n.start());
            this.synth.attachSpatialAudio(this.output);
            this.schedule(); this.timer = setInterval(() => this.schedule(), 100);
            return true;
        }
        apply() {
            if (!this.running) return;
            const t = this.ctx.currentTime, s = this.settings;
            this.output.gain.setTargetAtTime(s.volume * .65, t, .12);
            this.left.frequency.setTargetAtTime(s.carrier, t, .06);
            this.right.frequency.setTargetAtTime(s.carrier + s.beat, t, .06);
            this.tones.gain.setTargetAtTime(s.binaural ? s.tone * .22 : 0, t, .1);
        }
        schedule() {
            if (!this.running) return;
            const now = this.ctx.currentTime, s = this.settings;
            if (s.minutes && now - this.started >= s.minutes * 60) { this.stop(); this.onEnd?.(); return; }
            // Schedule on the audio clock, with a short lookahead; recover without a burst after a suspended tab.
            if (this.scheduled < now) this.scheduled = now + .05;
            if (this.scheduled > now + .25) return;
            const t = this.scheduled, length = s.interval, side = this.cycle % 2 ? 1 : -1;
            const level = s.bilateral ? s.texture * (s.sound === 'wind' ? .6 : .25) : 0;
            this.pan.pan.setValueAtTime(side * s.width, t);
            if (s.movement === 'sweep') this.pan.pan.linearRampToValueAtTime(-side * s.width, t + length);
            this.texture.gain.setValueAtTime(0, t);
            this.texture.gain.linearRampToValueAtTime(level, t + Math.min(.3, length * .15));
            this.texture.gain.linearRampToValueAtTime(0, t + length * .9);
            this.previousCycle = this.lastCycle;
            this.lastCycle = { t, length, side, movement: s.movement, width: s.width };
            this.cycle++; this.scheduled = t + length;
        }
        position() {
            if (!this.running || !this.lastCycle || !this.settings.bilateral) return 0;
            const c = this.ctx.currentTime < this.lastCycle.t && this.previousCycle ? this.previousCycle : this.lastCycle, phase = Math.max(0, Math.min(1, (this.ctx.currentTime - c.t) / c.length));
            return c.side * c.width * (c.movement === 'sweep' ? 1 - 2 * phase : 1);
        }
        update(settings) {
            const before = this.settings;
            this.settings = sanitize(settings); this.apply();
            if (this.running && ['bilateral','texture','interval','width','movement'].some(k => before[k] !== this.settings[k])) {
                const now = this.ctx.currentTime;
                this.texture.gain.cancelAndHoldAtTime(now);
                this.texture.gain.linearRampToValueAtTime(0, now + .1);
                this.pan.pan.cancelAndHoldAtTime(now);
                this.scheduled = now + .15;
            }
        }
        release() {
            clearInterval(this.timer); this.timer = null;
            for (const n of this.sources) { try { n.stop(); } catch (_) {} }
            for (const n of this.nodes) { try { n.disconnect(); } catch (_) {} }
            this.nodes = []; this.sources = []; this.running = false;
        }
        stop(detach = true) {
            ++this.generation;
            this.release();
            if (detach && this.synth.visualizerMode === 'spatial') this.synth.stopMusicReactivity();
        }
    }
    class SpatialPlayer {
        constructor() {
            let saved; try { saved = JSON.parse(localStorage.getItem('eternalvoid.spatial.v1')); } catch (_) {}
            this.settings = sanitize(saved || {}); this.engine = new SpatialEngine(window.CosmicSynth, this.settings);
            this.panel = document.getElementById('spatial-player'); this.expanded = false;
            const slider = (key, label, min, max, step) => `<label class="spatial-control">${label}<output id="spatial-${key}-value"></output><input type="range" id="spatial-${key}" data-key="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}"></label>`;
            this.panel.innerHTML = `<div class="music-compact"><button class="music-art" data-action="source" aria-label="Choose music source">◉</button><div class="music-now"><span>Spatial Audio</span><small id="spatial-status" role="status">Ready · headphones recommended</small></div><button data-action="play" id="spatial-play" aria-label="Play spatial audio">▶</button><button data-action="stop" aria-label="Stop spatial audio">■</button><button data-action="expand" id="spatial-expand" aria-label="Expand spatial audio" aria-expanded="false" aria-controls="spatial-details">⌃</button></div>
            <div id="spatial-details" hidden><div class="spatial-path" aria-hidden="true"><span>L</span><div><i id="spatial-orb"></i></div><span>R</span></div>
            <p class="spatial-intro">A steady tone in each ear, with soft sounds moving across the space between them.</p>
            <div class="spatial-switches"><label><input type="checkbox" id="spatial-binaural" data-key="binaural"> Binaural tones</label><label><input type="checkbox" id="spatial-bilateral" data-key="bilateral"> Bilateral movement</label></div>
            <div class="spatial-grid">${slider('volume','Spatial volume',0,100,1)}${slider('interval','Movement interval',2,20,.5)}
            <label class="spatial-control">Sound<select id="spatial-sound" data-key="sound" aria-label="Spatial sound"><option value="soft">Soft pulse</option><option value="wind">Warm wind</option><option value="deep">Deep resonance</option></select></label>
            <label class="spatial-control">Movement<select id="spatial-movement" data-key="movement" aria-label="Spatial movement"><option value="sweep">Drifting sweep</option><option value="alternate">Alternating sides</option></select></label></div>
            <details class="spatial-advanced"><summary>Fine-tune the sound</summary><div class="spatial-grid">${slider('carrier','Carrier pitch',80,400,1)}${slider('beat','Beat difference',1,40,.5)}${slider('width','Stereo width',0,100,1)}${slider('tone','Binaural level',0,100,1)}${slider('texture','Bilateral level',0,100,1)}
            <label class="spatial-control">Sleep timer<select id="spatial-minutes" data-key="minutes" aria-label="Spatial sleep timer"><option value="0">Keep playing</option><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label></div><p id="spatial-frequencies"></p><button data-action="reset">Restore defaults</button></details>
            <div class="music-footer"><span>Settings saved in this browser</span><button data-action="source">Change source</button></div></div>`;
            this.panel.addEventListener('keydown', e => e.stopPropagation());
            this.panel.addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) this.action(b.dataset.action); });
            this.panel.querySelectorAll('[data-key]').forEach(input => {
                input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
                    const key = input.dataset.key;
                    this.settings[key] = input.type === 'checkbox' ? input.checked : ['sound','movement'].includes(key) ? input.value : +input.value / (['volume','width','tone','texture'].includes(key) ? 100 : 1);
                    this.engine.update(this.settings); this.save(); this.sync();
                    if (key === 'sound' && this.engine.running) this.restart();
                });
            });
            document.getElementById('music-source-spatial').onclick = () => { document.getElementById('music-source-dialog').close(); this.open(); };
            this.engine.onEnd = () => this.sync();
            window.addEventListener('cosmic-audio-source', e => {
                if (e.detail !== 'spatial') { this.engine.stop(false); this.sync(); if (e.detail !== 'none') this.panel.hidden = true; }
            });
            this.sync(); this.visualTimer = setInterval(() => { if (!this.panel.hidden) { document.getElementById('spatial-orb').style.left = `${50 + this.engine.position() * 44}%`; if (this.engine.running) this.syncStatus(); } }, 100);
        }
        save() { try { localStorage.setItem('eternalvoid.spatial.v1', JSON.stringify(this.settings)); } catch (_) {} }
        open() {
            window.CosmicSynth.setMute(true); window.CosmicSynth.stopMusicReactivity();
            window.VoidMusic?.audio.pause(); document.getElementById('music-player').hidden = true;
            this.panel.hidden = false; this.expand(true); this.sync(); document.getElementById('spatial-play').focus();
        }
        leave() { this.engine.stop(); this.panel.hidden = true; this.sync(); }
        expand(value) { this.expanded = value; document.getElementById('spatial-details').hidden = !value; this.panel.classList.toggle('expanded', value); const b = document.getElementById('spatial-expand'); b.setAttribute('aria-expanded', String(value)); b.setAttribute('aria-label', value ? 'Collapse spatial audio' : 'Expand spatial audio'); b.textContent = value ? '⌄' : '⌃'; }
        async restart() { this.engine.stop(); await this.play(); }
        async play() { try { await this.engine.start(); this.sync(); } catch (_) { this.engine.stop(); this.sync(); document.getElementById('spatial-status').textContent = 'Audio could not start. Try Play again.'; } }
        action(a) {
            if (a === 'play') { if (this.engine.running) { this.engine.stop(); this.sync(); } else this.play(); }
            if (a === 'stop') { this.engine.stop(); this.sync(); }
            if (a === 'expand') this.expand(!this.expanded);
            if (a === 'source') window.VoidMusic.openSources();
            if (a === 'reset') { this.settings = { ...defaults }; this.engine.update(this.settings); this.save(); this.sync(); if (this.engine.running) this.restart(); }
        }
        syncStatus() {
            const s = this.settings, remain = s.minutes && this.engine.running ? Math.max(0, Math.ceil(s.minutes * 60 - (this.engine.ctx.currentTime - this.engine.started))) : 0;
            document.getElementById('spatial-status').textContent = `${this.engine.running ? 'Playing' : 'Paused'} · ${s.binaural ? s.beat + ' Hz binaural' : 'Tones off'} · ${s.bilateral ? s.interval + 's movement' : 'Movement off'}${remain ? ' · ' + Math.floor(remain / 60) + ':' + String(remain % 60).padStart(2,'0') + ' left' : ''}`;
        }
        sync() {
            const s = this.settings;
            for (const input of this.panel.querySelectorAll('[data-key]')) { const key = input.dataset.key; if (input.type === 'checkbox') input.checked = s[key]; else input.value = s[key] * (['volume','width','tone','texture'].includes(key) ? 100 : 1) || (typeof s[key] === 'string' ? s[key] : 0); }
            for (const key of Object.keys(ranges)) { const out = document.getElementById(`spatial-${key}-value`); if (out) out.textContent = ['carrier','beat'].includes(key) ? s[key] + ' Hz' : key === 'interval' ? s[key] + ' sec' : Math.round(s[key] * 100) + '%'; }
            document.getElementById('spatial-frequencies').textContent = `Left ear ${s.carrier} Hz · Right ear ${s.carrier + s.beat} Hz. Headphones preserve the separation.`;
            const b = document.getElementById('spatial-play'); b.textContent = this.engine.running ? 'Ⅱ' : '▶'; b.setAttribute('aria-label', this.engine.running ? 'Pause spatial audio' : 'Play spatial audio'); this.syncStatus();
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { SpatialEngine, sanitize, defaults };
    if (typeof window !== 'undefined') window.SpatialAudio = { SpatialPlayer, SpatialEngine };
})();
