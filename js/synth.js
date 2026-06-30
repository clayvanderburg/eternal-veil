// ==========================================================================
// ETERNAL VEIL - BINAURAL BEATS & COSMIC WIND GENERATOR (REPLACEMENT ENGINE)
// ==========================================================================

class BinauralBeatEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        
        // Output Nodes
        this.masterGain = null;
        this.analyser = null;
        
        // Binaural Beat Oscillators
        this.oscLeft = null;
        this.oscRight = null;
        this.panLeft = null;
        this.panRight = null;
        
        // Cosmic Wind Noise Nodes
        this.noiseSource = null;
        this.noiseFilter = null;
        this.noiseGain = null;
        
        // Frequency parameters
        this.baseFreq = 110.0;    // Deep A2 tone
        this.beatFreq = 6.0;      // 6Hz (Theta wave)
        this.binauralMode = "theta"; // theta, delta, alpha, beta, gamma
        
        // Base note frequencies corresponding to palette hue mappings
        this.rootNotes = [82.41, 98.00, 110.00, 123.47, 146.83, 164.81]; // E2, G2, A2, B2, D3, E3
        
        this.isMuted = true;
        this.volume = 0.4;
        
        // Scheduling timers
        this.windModTimer = null;
        
        // Upgraded features: Bilateral Synth and ASMR
        this.bilateralEnabled = false;
        this.asmrEnabled = false;
        
        // Channel Mixer Volumes (0 to 1)
        this.droneVolume = 0.36;       // start 36% (20% louder than 30%)
        this.bilateralVolume = 0.75;   // start 75%
        this.asmrVolume = 0.50;        // start 50%
        
        // Bilateral Nodes & Timers
        this.bilateralTimer = null;
        this.lastBilateralPan = -0.8;
        this.bilateralGain = null;
        this.bilateralPan = null;
        
        // ASMR timers
        this.asmrTimer = null;

        // Music Visualizer additions
        this.visualizerMode = "none"; // "none", "mic", "system", "upload"
        this.musicAnalyser = null;
        this.micStream = null;
        this.micSource = null;
        this.systemStream = null;
        this.systemSource = null;
        this.uploadedAudio = null;
        this.uploadedSource = null;
        this.uploadedGain = null;
    }

    // Initialize AudioContext upon user action
    init() {
        if (this.initialized) return;
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            
            // Master Output setup
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.isMuted ? 0.0001 : this.volume;
            
            // Analyser for HUD wave
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 32;
            
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
            
            // Start generators
            this.setupBinauralOscillators();
            this.setupCosmicWind();
            this.startBilateralLoop();
            this.startWindModulator();
            this.startAsmrLoop();
            
            this.initialized = true;
            console.log("[BinauralSynth] Binaural Beat, Bilateral, & ASMR Engine initialized.");
        } catch (e) {
            console.error("[BinauralSynth] Context initialization failed:", e);
        }
    }

    // Setup Panned Left and Right Oscillators creating the binaural beat
    setupBinauralOscillators() {
        this.oscLeft = this.ctx.createOscillator();
        this.oscRight = this.ctx.createOscillator();
        
        this.panLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        this.panRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        
        this.oscLeft.type = 'sine';
        this.oscRight.type = 'sine';
        
        this.oscLeft.frequency.value = this.baseFreq; // e.g. 110Hz left ear
        this.oscRight.frequency.value = this.baseFreq + this.beatFreq; // e.g. 116Hz right ear
        
        // Attenuate continuous carrier hum to a comfortable background level
        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.value = this.droneVolume * 0.2; 
        
        if (this.panLeft && this.panRight) {
            this.panLeft.pan.value = -1.0; // Left ear
            this.panRight.pan.value = 1.0; // Right ear
            
            this.oscLeft.connect(this.panLeft);
            this.oscRight.connect(this.panRight);
            
            this.panLeft.connect(this.droneGain);
            this.panRight.connect(this.droneGain);
        } else {
            this.oscLeft.connect(this.droneGain);
            this.oscRight.connect(this.droneGain);
        }
        
        this.droneGain.connect(this.masterGain);
        
        this.oscLeft.start(0);
        this.oscRight.start(0);
    }

    // Setup cosmic pink-noise wind simulation via random audio buffer
    setupCosmicWind() {
        const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds of noise buffer loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Pinkish / brown noise distribution approximation (low pass filtered)
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2.0 - 1.0;
            // First-order filter for brownian low-pass noise feel
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Gain boost
        }
        
        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = buffer;
        this.noiseSource.loop = true;
        
        this.noiseFilter = this.ctx.createBiquadFilter();
        this.noiseFilter.type = 'lowpass';
        this.noiseFilter.frequency.value = 95.0; // Deep rumble wind
        this.noiseFilter.Q.value = 1.0;
        
        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.value = 0.06; // soft volume level
        
        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);
        
        this.noiseSource.start(0);
    }

    // Steady, deliberate loop that triggers a deep resonant "dong" chime
    startBilateralLoop() {
        const scheduleNext = () => {
            if (this.initialized) {
                if (this.bilateralEnabled && !this.isMuted && this.visualizerMode === "none") {
                    this.triggerBilateralDong();
                }
            }
            // Trigger a single pleasant dong chime every 3 seconds
            this.bilateralTimer = setTimeout(scheduleNext, 3000);
        };
        scheduleNext();
    }

    // Trigger a single pleasant meditative bell chime that shifts stereo panning over its resonance
    triggerBilateralDong() {
        const t = this.ctx.currentTime;
        const duration = 8.5; // long breathing decay

        // Alternate starting pan side to move back and forth
        this.lastBilateralPan = -this.lastBilateralPan;
        const startPan = this.lastBilateralPan;
        const endPan = -startPan;

        const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const gainNode = this.ctx.createGain();

        // Volume Envelope: soft attack, long pleasant decay
        gainNode.gain.setValueAtTime(0.0001, t);
        const maxDongVolume = this.bilateralVolume * 0.35; // scalable and louder!
        gainNode.gain.linearRampToValueAtTime(maxDongVolume, t + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        if (panNode) {
            panNode.pan.setValueAtTime(startPan, t);
            // Slowly sweep the pan to the opposite ear over the chime's tail
            panNode.pan.linearRampToValueAtTime(endPan, t + 6.5);
            
            gainNode.connect(panNode);
            panNode.connect(this.masterGain);
        } else {
            gainNode.connect(this.masterGain);
        }

        // Multi-frequency additive synthesis to construct a deep singing bowl "dong"
        // Root pitch (deep sine), Perfect Fifth harmonic (triangle), Double Octave harmonic (sine)
        const rootFreq = this.baseFreq;
        const harmonics = [
            { type: 'sine', freq: rootFreq, gain: 1.0 },
            { type: 'triangle', freq: rootFreq * 1.5, gain: 0.35 },
            { type: 'sine', freq: rootFreq * 2.0, gain: 0.12 }
        ];

        harmonics.forEach(h => {
            const osc = this.ctx.createOscillator();
            osc.type = h.type;
            osc.frequency.value = h.freq;

            const oscGain = this.ctx.createGain();
            oscGain.gain.value = h.gain;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 550.0; // keep it warm and warm

            osc.connect(filter);
            filter.connect(oscGain);
            oscGain.connect(gainNode);

            osc.start(t);
            osc.stop(t + duration);
        });
    }

    // Slowly swept lowpass frequency cutoff for ocean-like waves wind simulation
    startWindModulator() {
        const mod = () => {
            if (this.initialized) {
                const now = this.ctx.currentTime;
                
                // Only sweep wind if not muted
                if (!this.isMuted) {
                    // Modulation sweep between 75Hz and 180Hz
                    const angle = now * 0.05; // very slow wave rate
                    const freq = 120.0 + Math.sin(angle) * 45.0;
                    this.noiseFilter.frequency.setValueAtTime(freq, now);
                    
                    // Modulate wind gain slightly too for dynamic volume shifts
                    const windVol = 0.04 + Math.cos(angle * 1.5) * 0.025;
                    this.noiseGain.gain.setValueAtTime(windVol, now);
                }
            }
            this.windModTimer = setTimeout(mod, 100);
        };
        mod();
    }

    // Modulate beat settings in real-time from active simulation speed & colors
    modulate(speed, turbulence, colorHues) {
        if (!this.initialized) return;
        
        const now = this.ctx.currentTime;
        
        // 1. Calculate target center frequency depending on selected binaural brainwave band
        let centerFreq = 6.0;
        switch (this.binauralMode) {
            case "delta": centerFreq = 2.5; break; // Deep sleep / healing
            case "theta": centerFreq = 6.0; break; // Meditation / astral
            case "alpha": centerFreq = 10.0; break; // Relaxation / focus
            case "beta":  centerFreq = 18.0; break; // Analytical / alertness
            case "gamma": centerFreq = 40.0; break; // Peak cognitive binding
        }

        // Add speed-reactive drift (+/- 15% of band frequency) to make audio live-responsive to flow acceleration
        this.beatFreq = centerFreq + (speed - 1.0) * (centerFreq * 0.15);
        
        // 2. Map palette colors to base pitch frequencies
        if (colorHues && colorHues.length > 0) {
            const avgHue = colorHues.reduce((a, b) => a + b, 0) / colorHues.length;
            const noteIdx = Math.floor((avgHue / 360) * this.rootNotes.length) % this.rootNotes.length;
            
            const targetBase = this.rootNotes[noteIdx];
            if (Math.abs(this.baseFreq - targetBase) > 0.1) {
                this.baseFreq = targetBase;
                
                // Glide frequency values slowly to avoid audible pops
                this.oscLeft.frequency.exponentialRampToValueAtTime(this.baseFreq, now + 2.0);
                this.oscRight.frequency.exponentialRampToValueAtTime(this.baseFreq + this.beatFreq, now + 2.0);
            }
        } else {
            this.oscRight.frequency.setValueAtTime(this.baseFreq + this.beatFreq, now);
        }
        
        // 3. Map turbulence to wind filter resonance (makes waves sound hissier/windier)
        const qVal = 0.5 + (turbulence * 1.5);
        this.noiseFilter.Q.setValueAtTime(qVal, now);
    }

    // Mute / Unmute controls
    setMute(state) {
        this.isMuted = state;
        
        if (!this.initialized) {
            if (!state) {
                this.init();
            } else {
                return;
            }
        }
        
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        const now = this.ctx.currentTime;
        if (state) {
            this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
        } else {
            this.masterGain.gain.setValueAtTime(0.0001, now);
            // If music visualizer is active, keep ambient synth volume at 0.0001 (muted)
            const targetVol = (this.visualizerMode !== "none") ? 0.0001 : this.volume;
            this.masterGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
            
            // Trigger welcoming singing bowl chime immediately if bilateral rhythm is enabled & visualizer inactive
            if (this.bilateralEnabled && this.visualizerMode === "none") {
                setTimeout(() => {
                    if (this.initialized && !this.isMuted && this.bilateralEnabled && this.visualizerMode === "none") {
                        this.triggerBilateralDong();
                    }
                }, 180);
            }
        }
    }

    // Set Master volume level (0 to 1)
    setVolume(value) {
        this.volume = value;
        if (this.initialized && !this.isMuted) {
            // Keep master gain muted if visualizer mode is running
            const targetVol = (this.visualizerMode !== "none") ? 0.0001 : this.volume;
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.1);
        }
    }

    setDroneVolume(value) {
        this.droneVolume = value;
        if (this.initialized && this.droneGain) {
            const now = this.ctx.currentTime;
            this.droneGain.gain.setTargetAtTime(this.droneVolume * 0.2, now, 0.1);
        }
    }

    setBilateralVolume(value) {
        this.bilateralVolume = value;
        if (this.initialized && !this.isMuted && this.bilateralEnabled) {
            // Trigger instant dong preview when adjusting the slider so the user hears the new volume immediately
            this.triggerBilateralDong();
        }
    }

    setAsmrVolume(value) {
        this.asmrVolume = value;
        if (this.initialized && !this.isMuted && this.asmrEnabled) {
            // Trigger instant ASMR preview when adjusting the slider so the user hears the new volume immediately
            this.triggerAsmrTingle();
        }
    }

    // Set active binaural brainwave band and trigger immediate oscillator updates
    setBinauralMode(mode) {
        this.binauralMode = mode;
        if (this.initialized) {
            const now = this.ctx.currentTime;
            let centerFreq = 6.0;
            switch (this.binauralMode) {
                case "delta": centerFreq = 2.5; break;
                case "theta": centerFreq = 6.0; break;
                case "alpha": centerFreq = 10.0; break;
                case "beta":  centerFreq = 18.0; break;
                case "gamma": centerFreq = 40.0; break;
            }
            this.beatFreq = centerFreq;
            this.oscRight.frequency.setValueAtTime(this.baseFreq + this.beatFreq, now);
        }
    }

    // Rhythmic ASMR triggering loop with randomized organic intervals
    startAsmrLoop() {
        const scheduleNext = () => {
            if (this.initialized) {
                if (this.asmrEnabled && !this.isMuted && this.visualizerMode === "none") {
                    this.triggerAsmrTingle();
                }
            }
            // Trigger pings/sparks at organic intervals (300ms to 1200ms)
            const nextDelay = 300 + Math.random() * 900;
            this.asmrTimer = setTimeout(scheduleNext, nextDelay);
        };
        scheduleNext();
    }

    // Generate highly realistic, spatialized 8D ASMR microphone taps and scratching brushes
    triggerAsmrTingle() {
        const t = this.ctx.currentTime;
        const type = Math.random() > 0.5 ? "tap" : "scratch";
        
        // Setup start and end panning for sweeping 8D audio directionality
        const startPan = Math.random() * 1.8 - 0.9;
        const endPan = startPan + (Math.random() > 0.5 ? 0.3 : -0.3);
        const clampedEndPan = Math.max(-1.0, Math.min(1.0, endPan));
        
        const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, t);
        
        if (panNode) {
            panNode.pan.setValueAtTime(startPan, t);
            panNode.pan.linearRampToValueAtTime(clampedEndPan, t + 0.35);
            
            gainNode.connect(panNode);
            panNode.connect(this.masterGain);
        } else {
            gainNode.connect(this.masterGain);
        }
        
        if (type === "tap") {
            // ASMR Microphone Tap: Low frequency thud + transient noise click
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(70, t + 0.08); // quick pitch sweep
            
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 180; // keep it warm
            
            osc.connect(lp);
            lp.connect(gainNode);
            
            // Generate transient noise click (microphone physical contact click)
            const clickBufSize = this.ctx.sampleRate * 0.015;
            const clickBuffer = this.ctx.createBuffer(1, clickBufSize, this.ctx.sampleRate);
            const clickData = clickBuffer.getChannelData(0);
            for (let i = 0; i < clickBufSize; i++) {
                clickData[i] = (Math.random() * 2.0 - 1.0) * 0.75;
            }
            const clickSource = this.ctx.createBufferSource();
            clickSource.buffer = clickBuffer;
            
            const clickFilter = this.ctx.createBiquadFilter();
            clickFilter.type = 'bandpass';
            clickFilter.frequency.value = 1800; // mid-range wood/plastic touch
            clickFilter.Q.value = 2.0;
            
            const clickGain = this.ctx.createGain();
            clickGain.gain.value = 0.08;
            
            clickSource.connect(clickFilter);
            clickFilter.connect(clickGain);
            clickGain.connect(gainNode);
            
            // Envelope: instant touch, quick decay
            const duration = 0.12;
            gainNode.gain.setValueAtTime(0.0001, t);
            gainNode.gain.linearRampToValueAtTime(this.asmrVolume * 0.24, t + 0.005);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            
            osc.start(t);
            osc.stop(t + duration);
            clickSource.start(t);
        } else {
            // ASMR Microphone Scratch: Finger brushing grill (crackle-modulated noise)
            const bufSize = this.ctx.sampleRate * 0.22; // 220ms scrape
            const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufSize; i++) {
                const white = Math.random() * 2.0 - 1.0;
                // Modulation to create physical crackling/rubbing texture
                const crackle = Math.sin(i * 0.008) > 0.35 ? 1.0 : 0.2;
                data[i] = white * crackle * 0.45;
            }
            
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1300; // mid-high frequency brush scrape
            filter.Q.value = 1.6;
            
            source.connect(filter);
            filter.connect(gainNode);
            
            // Envelope: swell in and out like a hand swipe
            const duration = 0.22;
            gainNode.gain.setValueAtTime(0.0001, t);
            gainNode.gain.linearRampToValueAtTime(this.asmrVolume * 0.20, t + 0.04);
            gainNode.gain.linearRampToValueAtTime(this.asmrVolume * 0.10, t + 0.14);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            
            source.start(t);
            source.stop(t + duration);
        }
    }

    setBilateralEnabled(state) {
        this.bilateralEnabled = state;
        // Triggers a preview dong immediately if turned on
        if (state && this.initialized && !this.isMuted) {
            this.triggerBilateralDong();
        }
    }

    setAsmrEnabled(state) {
        this.asmrEnabled = state;
    }

    // Retrieve visualizer data for HUD Equalizer bounces (falls back to music visualizer if active)
    getVisualizerData() {
        if (!this.initialized || this.isMuted) return null;
        
        const activeAnalyser = (this.visualizerMode !== "none" && this.musicAnalyser) ? this.musicAnalyser : this.analyser;
        const dataArray = new Uint8Array(activeAnalyser.frequencyBinCount);
        activeAnalyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    // Initialize the music visualizer analysis node
    setupMusicAnalyser() {
        // Double check AudioContext state
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (!this.musicAnalyser) {
            this.musicAnalyser = this.ctx.createAnalyser();
            this.musicAnalyser.fftSize = 256; // 128 frequency bands
        }
    }

    // Query bass and treble normalized levels
    getMusicAnalysis() {
        if (!this.musicAnalyser || this.visualizerMode === "none" || this.isMuted) return null;
        const dataArray = new Uint8Array(this.musicAnalyser.frequencyBinCount);
        this.musicAnalyser.getByteFrequencyData(dataArray);
        
        // Analyze bass (bins 0 to 4)
        let bassSum = 0;
        const bassBins = 4;
        for (let i = 0; i < bassBins; i++) {
            bassSum += dataArray[i];
        }
        const bassVal = bassSum / bassBins / 255; // 0.0 to 1.0
        
        // Analyze treble/mids (bins 10 to 30)
        let trebleSum = 0;
        const trebleBins = 20;
        const startTreble = 10;
        for (let i = startTreble; i < startTreble + trebleBins; i++) {
            trebleSum += dataArray[i];
        }
        const trebleVal = trebleSum / trebleBins / 255; // 0.0 to 1.0
        
        return { bass: bassVal, treble: trebleVal };
    }

    // Helper to glide master ambient sound gain smoothly
    glideMasterGain(targetVal) {
        if (this.initialized) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
            this.masterGain.gain.linearRampToValueAtTime(targetVal, now + 0.35);
        }
    }

    // Toggle capture of ambient mic audio
    async toggleMicReactivity() {
        if (this.visualizerMode === "mic") {
            this.stopMusicReactivity();
            return false;
        }
        
        this.stopMusicReactivity();
        this.setupMusicAnalyser();
        
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micSource = this.ctx.createMediaStreamSource(this.micStream);
            // Route ONLY to analyser to avoid creating a nasty feedback screech loop!
            this.micSource.connect(this.musicAnalyser);
            this.visualizerMode = "mic";
            
            // Auto mute binaural carrier/ASMR/bilateral tones
            this.glideMasterGain(0.0001);
            
            console.log("[BinauralSynth] Microphone reactivity active.");
            return true;
        } catch (e) {
            console.error("[BinauralSynth] Mic access denied:", e);
            throw e;
        }
    }

    // Hook into system/device audio output stream (uses displayMedia capture)
    async toggleSystemAudioReactivity() {
        if (this.visualizerMode === "system") {
            this.stopMusicReactivity();
            return false;
        }
        
        this.stopMusicReactivity();
        this.setupMusicAnalyser();
        
        try {
            // Request display media capture with audio track
            this.systemStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: 1,
                    height: 1,
                    frameRate: 1
                },
                audio: true
            });
            
            // Discard the video track instantly to release resources
            this.systemStream.getVideoTracks().forEach(track => track.stop());
            
            const audioTracks = this.systemStream.getAudioTracks();
            if (audioTracks.length === 0) {
                this.systemStream.getTracks().forEach(t => t.stop());
                this.systemStream = null;
                throw new Error("No system audio track captured. Ensure 'Share system audio' is checked!");
            }
            
            // Create a clean audio-only MediaStream for the AudioContext source
            const cleanStream = new MediaStream([audioTracks[0]]);
            this.systemSource = this.ctx.createMediaStreamSource(cleanStream);
            // Route ONLY to analyser silently (user is already hearing Spotify directly!)
            this.systemSource.connect(this.musicAnalyser);
            this.visualizerMode = "system";
            
            // Auto mute binaural carrier/ASMR/bilateral tones
            this.glideMasterGain(0.0001);
            
            console.log("[BinauralSynth] System audio reactivity active.");
            return true;
        } catch (e) {
            console.error("[BinauralSynth] System audio capture failed/denied:", e);
            throw e;
        }
    }

    // Route and play uploaded audio files
    playUploadedFile(file) {
        this.stopMusicReactivity();
        this.setupMusicAnalyser();
        
        const fileUrl = URL.createObjectURL(file);
        this.uploadedAudio = new Audio(fileUrl);
        this.uploadedAudio.loop = true;
        
        this.uploadedSource = this.ctx.createMediaElementSource(this.uploadedAudio);
        this.uploadedGain = this.ctx.createGain();
        this.uploadedGain.gain.value = 0.75; // default comfortable visualizer volume
        
        // Source -> Analyser -> Volume Gain -> Speakers
        this.uploadedSource.connect(this.musicAnalyser);
        this.musicAnalyser.connect(this.uploadedGain);
        this.uploadedGain.connect(this.ctx.destination);
        
        this.uploadedAudio.play();
        this.visualizerMode = "upload";
        
        // Auto mute binaural carrier/ASMR/bilateral tones
        this.glideMasterGain(0.0001);
        
        console.log("[BinauralSynth] Playing uploaded track.");
    }

    // Stop all active music visualizer tasks and restore defaults
    stopMusicReactivity() {
        this.visualizerMode = "none";
        
        // Restore binaural carrier/ASMR/bilateral tones if not master muted
        if (this.initialized && !this.isMuted) {
            this.glideMasterGain(this.volume);
        }
        
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }
        if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
        }
        if (this.systemStream) {
            this.systemStream.getTracks().forEach(track => track.stop());
            this.systemStream = null;
        }
        if (this.systemSource) {
            this.systemSource.disconnect();
            this.systemSource = null;
        }
        if (this.uploadedAudio) {
            this.uploadedAudio.pause();
            this.uploadedAudio = null;
        }
        if (this.uploadedSource) {
            this.uploadedSource.disconnect();
            this.uploadedSource = null;
        }
        if (this.uploadedGain) {
            this.uploadedGain.disconnect();
            this.uploadedGain = null;
        }
    }

    // Cleanup resources
    dispose() {
        clearTimeout(this.windModTimer);
        clearTimeout(this.asmrTimer);
        this.stopMusicReactivity();
        
        if (this.initialized) {
            try {
                this.oscLeft.stop();
                this.oscRight.stop();
                this.noiseSource.stop();
                if (this.bilateralOsc) this.bilateralOsc.stop();
                this.ctx.close();
            } catch(e) {}
        }
    }
}

// Bind globally using standard interface
window.CosmicSynth = new BinauralBeatEngine();
