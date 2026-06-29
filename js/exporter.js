// ==========================================================================
// ETERNAL VEIL - SCREEN CAPTURE & VIDEO RECORDING MODULE
// ==========================================================================

class MediaExporter {
    constructor(simulationInstance) {
        this.sim = simulationInstance;
        this.canvas = simulationInstance.canvas;
        
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        this.recordTimer = null;
        this.recordDuration = 0;
        
        this.btn = document.getElementById("record-flow-btn");
        this.btnText = document.getElementById("record-btn-text");
    }

    // Capture single high-res PNG image
    captureSnapshot() {
        try {
            // Draw one clean frame to ensure canvas buffer is full
            this.sim.tick();
            
            const dataUrl = this.canvas.toDataURL("image/png");
            
            const link = document.createElement("a");
            link.download = `eternal-veil-glow-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast("Snapshot saved to Downloads");
        } catch (e) {
            console.error("[Exporter] Screenshot capture failed:", e);
            this.showToast("Snapshot failed - security block");
        }
    }

    // Start canvas screen recording
    startRecording() {
        if (this.isRecording) return;
        
        this.recordedChunks = [];
        
        try {
            // 1. Capture Canvas Video Stream (at 30 FPS)
            const videoStream = this.canvas.captureStream(30);
            let combinedStream = videoStream;
            
            // 2. Mix in Synthesizer Audio Stream if active
            const synth = window.CosmicSynth;
            if (synth && synth.initialized && !synth.isMuted && synth.ctx) {
                // Create a destination node in the Web Audio context to pipe data
                if (!synth.recordDestination) {
                    synth.recordDestination = synth.ctx.createMediaStreamDestination();
                    synth.masterGain.connect(synth.recordDestination);
                }
                
                const audioTracks = synth.recordDestination.stream.getAudioTracks();
                if (audioTracks.length > 0) {
                    // Merge video and audio tracks
                    combinedStream = new MediaStream([
                        ...videoStream.getVideoTracks(),
                        ...audioTracks
                    ]);
                    console.log("[Exporter] Audio tracks successfully mixed into video stream.");
                }
            }
            
            // 3. Determine supported MIME type
            let options = { mimeType: "video/webm;codecs=vp9" };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: "video/webm;codecs=vp8" };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: "video/webm" };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options = {}; // browser default fallback
                    }
                }
            }
            
            // 4. Initialize MediaRecorder
            this.mediaRecorder = new MediaRecorder(combinedStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.saveVideo();
            };
            
            // Start recording in chunks of 200ms
            this.mediaRecorder.start(200);
            
            this.isRecording = true;
            this.recordDuration = 0;
            this.btn.classList.add("recording");
            
            // Start UI clock timer
            this.btnText.textContent = "Recording (0s)...";
            this.recordTimer = setInterval(() => {
                this.recordDuration++;
                this.btnText.textContent = `Recording (${this.recordDuration}s)...`;
                
                // Safety limit: auto stop at 60 seconds
                if (this.recordDuration >= 60) {
                    this.stopRecording();
                }
            }, 1000);
            
            this.showToast("Recording started");
        } catch (e) {
            console.error("[Exporter] Video recording failed to start:", e);
            this.showToast("Recording failed to start");
            this.resetRecordBtnState();
        }
    }

    // Stop recording and save buffer
    stopRecording() {
        if (!this.isRecording) return;
        
        clearInterval(this.recordTimer);
        
        try {
            this.mediaRecorder.stop();
        } catch (e) {
            console.error("[Exporter] Error stopping recorder:", e);
        }
        
        this.isRecording = false;
        this.resetRecordBtnState();
        this.showToast("Processing cosmic capture...");
    }

    resetRecordBtnState() {
        this.btn.classList.remove("recording");
        this.btnText.textContent = "Record Flow Video";
    }

    // Save compiled file to disk
    saveVideo() {
        if (this.recordedChunks.length === 0) return;
        
        try {
            const blob = new Blob(this.recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.download = `eternal-veil-render-${Date.now()}.webm`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Release memory URL reference
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
            
            this.showToast("Recording saved successfully!");
        } catch (e) {
            console.error("[Exporter] Failed to compile video blob:", e);
            this.showToast("Failed to compile video file");
        }
    }

    // Helper toast notifier
    showToast(message) {
        const toast = document.getElementById("toast-notify");
        if (toast) {
            toast.textContent = message;
            toast.classList.remove("toast-hidden");
            
            clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                toast.classList.add("toast-hidden");
            }, 2500);
        }
    }
}

// Bind globally once instantiated
window.MediaExporter = MediaExporter;
