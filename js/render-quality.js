// ==========================================================================
// ETERNAL VEIL - RENDER QUALITY CONTROLLER
// Defines explicit resolution, frame rate targets, and quality profiles
// for desktop 3D and VR headset modes.
// ==========================================================================

const RenderQuality = {
    PROFILES: {
        desktopLow: {
            width: 1024,
            height: 576,
            flowHz: 30,
            dpr: 1.0,
            label: "Desktop Low"
        },
        desktopBalanced: {
            width: 1536,
            height: 864,
            flowHz: 45,
            dpr: 1.0,
            label: "Desktop Balanced"
        },
        desktopHigh: {
            width: 1920,
            height: 1080,
            flowHz: 60,
            dpr: 1.0,
            label: "Desktop High"
        },
        vrBalanced: {
            width: 2048,
            height: 1024,
            flowHz: 45,
            dpr: 1.0,
            label: "VR Balanced (2:1)"
        },
        vrHigh: {
            width: 3072,
            height: 1536,
            flowHz: 45,
            dpr: 1.0,
            label: "VR High (2:1)"
        },
        vrUltra: {
            width: 4096,
            height: 2048,
            flowHz: 60,
            dpr: 1.0,
            label: "VR Ultra (2:1)"
        }
    },

    currentProfileKey: "desktopHigh",

    // Returns active profile parameters, falling back to desktopHigh if invalid
    getProfile(key) {
        const k = key || this.currentProfileKey;
        return this.PROFILES[k] || this.PROFILES.desktopHigh;
    }
};

// Expose globally
window.RenderQuality = RenderQuality;
if (typeof module !== "undefined" && module.exports) {
    module.exports = RenderQuality;
}
