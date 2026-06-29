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
            this.startWindModulator();
            
            this.initialized = true;
            console.log("[BinauralSynth] Binaural Beat & Wind Engine initialized.");
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
        
        if (this.panLeft && this.panRight) {
            this.panLeft.pan.value = -1.0; // Left ear
            this.panRight.pan.value = 1.0; // Right ear
            
            this.oscLeft.connect(this.panLeft);
            this.oscRight.connect(this.panRight);
            
            this.panLeft.connect(this.masterGain);
            this.panRight.connect(this.masterGain);
        } else {
            // Fallback for browsers lacking StereoPanner node
            this.oscLeft.connect(this.masterGain);
            this.oscRight.connect(this.masterGain);
        }
        
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

    // Slowly swept lowpass frequency cutoff for ocean-like waves wind simulation
    startWindModulator() {
        const mod = () => {
            if (this.initialized && !this.isMuted) {
                const now = this.ctx.currentTime;
                // Modulation sweep between 75Hz and 180Hz
                const angle = now * 0.05; // very slow wave rate
                const freq = 120.0 + Math.sin(angle) * 45.0;
                
                this.noiseFilter.frequency.setValueAtTime(freq, now);
                
                // Modulate wind gain slightly too for dynamic volume shifts
                const windVol = 0.04 + Math.cos(angle * 1.5) * 0.025;
                this.noiseGain.gain.setValueAtTime(windVol, now);
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
            if (!state) this.init(); // lazy init
            return;
        }
        
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        const now = this.ctx.currentTime;
        if (state) {
            this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        } else {
            this.masterGain.gain.setValueAtTime(0.0001, now);
            this.masterGain.gain.exponentialRampToValueAtTime(this.volume, now + 0.3);
        }
    }

    // Set Master volume level (0 to 1)
    setVolume(value) {
        this.volume = value;
        if (this.initialized && !this.isMuted) {
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.1);
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

    // Retrieve visualizer data for HUD Equalizer bounces
    getVisualizerData() {
        if (!this.initialized || this.isMuted) return null;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    // Cleanup resources
    dispose() {
        clearTimeout(this.windModTimer);
        
        if (this.initialized) {
            try {
                this.oscLeft.stop();
                this.oscRight.stop();
                this.noiseSource.stop();
                this.ctx.close();
            } catch(e) {}
        }
    }
}

// Bind globally using standard interface
window.CosmicSynth = new BinauralBeatEngine();
