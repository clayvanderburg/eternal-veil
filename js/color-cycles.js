/**
 * ETERNAL VOID — Color Playlists & Themed Autopilot Cycles
 * 
 * Provides predefined curated color playlists and loop selectors
 * for Autopilot color transitions.
 */

(function(global) {
    'use strict';

    const ColorPlaylists = {
        cyberpunk: [
            ['#00f0ff', '#ff007f', '#9b00ff', '#ff00aa', '#00ffaa'], // Neon Cyber
            ['#ff0055', '#00ffcc', '#220066', '#ffea00', '#7a00ff'], // Tokyo Neon
            ['#03e9f4', '#e91e63', '#9c27b0', '#ffeb3b', '#4caf50'], // Grid run
            ['#18003c', '#ff007f', '#00f0ff', '#12002f', '#ff5e00']  // Synthwave
        ],
        seasons: [
            ['#8b0000', '#d2691e', '#ff8c00', '#ffae42', '#556b2f'], // Deep Autumn
            ['#ff7f50', '#ffb7c5', '#98ff98', '#ffdb58', '#4f7942'], // Spring Bloom
            ['#fffff0', '#e0ffff', '#b0c4de', '#4682b4', '#1c39bb'], // Frosty Winter
            ['#f2a65a', '#b33939', '#5c3d2e', '#ffb347', '#34495e']  // Forest Fall
        ],
        candy: [
            ['#ffb6c1', '#ffc0cb', '#e6e6fa', '#fff0f5', '#add8e6'], // Sweet Pastel
            ['#ff9999', '#ffcc99', '#ffff99', '#ccff99', '#99ccff'], // Lollipop
            ['#ffc0e8', '#ffd4a3', '#fffcb7', '#d8ffb7', '#b7f2ff'], // Cotton Candy
            ['#e8a7a1', '#f3d6c1', '#f7ecc9', '#c4e3cb', '#b8c9df']  // Macaron
        ],
        goth: [
            ['#1a0f1a', '#4a121a', '#781d24', '#0d0d0d', '#2b1055'], // Velvet Goth
            ['#101010', '#3b0007', '#5f0914', '#152238', '#4b0082'], // Gothic Night
            ['#181818', '#2e2e2e', '#500000', '#800020', '#1c1c1c'], // Blood obsidian
            ['#191919', '#3a1f5d', '#6f4a8e', '#222831', '#393e46']  // Shadow
        ],
        ocean: [
            ['#0077be', '#00a86b', '#20b2aa', '#40e0d0', '#e0f7fa'], // Aqua depth
            ['#004b49', '#007d7a', '#00b0ab', '#00e1db', '#7afff9'], // Seafoam
            ['#0f2027', '#203a43', '#2c5364', '#4ca1af', '#c4e0e5'], // Deep Blue Sea
            ['#1d2b64', '#f8cdda', '#24c6dc', '#514a9d', '#e0eafc']  // Coastal Breeze
        ],
        chakra: [
            ['#9400d3', '#4b0082', '#0000ff', '#00ff00', '#ffff00'], // Spiritual (Crown to Solar)
            ['#ff7f00', '#ff0000', '#ffc0cb', '#8a2be2', '#00ffff'], // Lower + heart
            ['#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4'], // Blue / purple energy
            ['#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107']  // Nature energy
        ],
        psychedelic: [
            ['#ff00ff', '#00ffff', '#ffff00', '#ff0000', '#00ff00'], // High Contrast RGBY
            ['#ff00aa', '#5500ff', '#00ffcc', '#bbff00', '#ff6600'], // Acid Trip
            ['#ff0055', '#ffea00', '#00ff55', '#0055ff', '#aa00ff'], // Neon Melt
            ['#ff00ff', '#00ffff', '#ffdd00', '#ff2200', '#00ffaa']  // Retro Psych
        ]
    };

    const ColorCycles = {
        playlists: ColorPlaylists,

        /**
         * Select the next palette from a given cycle theme name.
         * @param {string} themeName - Theme name (e.g. 'cyberpunk', 'goth') or 'custom'
         * @param {string[]} currentPalette - Currently active simulation palette (to avoid picking the exact same one)
         * @returns {string[]|null} Selected HEX palette array or null if random fallback requested
         */
        getNextPalette(themeName, currentPalette) {
            if (themeName === 'custom' || themeName === 'custom-sequential') {
                return this.getNextCustomPalette(currentPalette);
            }

            const list = this.playlists[themeName];
            if (!list || list.length === 0) {
                return null; // Return null to fall back to random generation
            }

            // Pick a palette that is different from current if possible
            let attempts = 0;
            let chosen = list[0];
            while (attempts < 6) {
                chosen = list[Math.floor(Math.random() * list.length)];
                if (currentPalette && currentPalette.length > 0 && chosen[0] !== currentPalette[0]) {
                    break;
                }
                attempts++;
            }
            return [...chosen];
        },

        /**
         * Fetch saved user swatches library and return the next loop item.
         * @param {string[]} currentPalette - Currently active palette
         * @returns {string[]|null} Selected palette array from My Theme Library or null if empty
         */
        getNextCustomPalette(currentPalette) {
            try {
                const lib = JSON.parse(localStorage.getItem("eternal_void_custom_palettes") || localStorage.getItem("eternal_veil_custom_palettes")) || [];
                if (lib.length === 0) {
                    return null; // Fallback to random if empty
                }

                let nextIdx = 0;
                if (currentPalette && currentPalette.length > 0) {
                    const currentFlat = currentPalette.map(c => c.toLowerCase()).sort().join(',');
                    const idx = lib.findIndex(item => {
                        const itemFlat = item.colors.map(c => c.toLowerCase()).sort().join(',');
                        return itemFlat === currentFlat;
                    });
                    if (idx !== -1) {
                        nextIdx = (idx + 1) % lib.length;
                    } else {
                        nextIdx = Math.floor(Math.random() * lib.length);
                    }
                } else {
                    nextIdx = Math.floor(Math.random() * lib.length);
                }

                const item = lib[nextIdx];
                return item ? [...item.colors] : null;
            } catch (e) {
                return null;
            }
        }
    };

    global.ColorCycles = ColorCycles;

})(window);
