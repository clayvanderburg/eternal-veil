/**
 * ETERNAL VOID — Color Theory Engine (Paletton-style)
 * 
 * Provides pure mathematical functions to compute color harmonies
 * based on a base HSL (Hue, Saturation, Lightness) color.
 */

(function(global) {
    'use strict';

    const ColorTheory = {
        /**
         * Generate an array of 5 colors based on a color theory rule
         * @param {number} h - Hue (0 - 360)
         * @param {number} s - Saturation (0 - 100)
         * @param {number} l - Lightness (0 - 100)
         * @param {string} rule - 'mono', 'analogous', 'complementary', 'triad', 'tetrad'
         * @returns {string[]} Array of 5 HSL color strings
         */
        generateHarmony(h, s, l, rule) {
            // Normalize values just in case
            h = ((Math.round(h) % 360) + 360) % 360;
            s = Math.max(0, Math.min(100, Math.round(s)));
            l = Math.max(0, Math.min(100, Math.round(l)));

            switch (rule) {
                case 'mono':
                    return [
                        `hsl(${h}, ${Math.max(5, s - 35)}%, ${Math.min(95, l + 20)}%)`,
                        `hsl(${h}, ${Math.max(10, s - 15)}%, ${Math.min(90, l + 10)}%)`,
                        `hsl(${h}, ${s}%, ${l}%)`,
                        `hsl(${h}, ${Math.max(10, s - 10)}%, ${Math.max(10, l - 15)}%)`,
                        `hsl(${h}, ${Math.max(5, s - 30)}%, ${Math.max(5, l - 30)}%)`
                    ];

                case 'analogous': // Adjacent
                    return [
                        `hsl(${((h - 30) + 360) % 360}, ${s}%, ${Math.max(10, l - 5)}%)`,
                        `hsl(${((h - 15) + 360) % 360}, ${Math.max(10, s - 5)}%, ${l}%)`,
                        `hsl(${h}, ${s}%, ${l}%)`,
                        `hsl(${((h + 15) % 360)}, ${Math.max(10, s - 5)}%, ${l}%)`,
                        `hsl(${((h + 30) % 360)}, ${s}%, ${Math.min(95, l + 5)}%)`
                    ];

                case 'complementary':
                    const comp = (h + 180) % 360;
                    return [
                        `hsl(${h}, ${s}%, ${l}%)`,
                        `hsl(${((h + 15) % 360)}, ${Math.max(10, s - 10)}%, ${Math.min(95, l + 5)}%)`,
                        `hsl(${comp}, ${s}%, ${l}%)`,
                        `hsl(${((comp - 15) + 360) % 360}, ${Math.max(10, s - 5)}%, ${Math.max(10, l - 10)}%)`,
                        `hsl(${((comp + 15) % 360)}, ${Math.max(10, s - 5)}%, ${Math.min(95, l + 5)}%)`
                    ];

                case 'triad':
                    const triad1 = (h + 120) % 360;
                    const triad2 = (h + 240) % 360;
                    return [
                        `hsl(${h}, ${s}%, ${l}%)`,
                        `hsl(${h}, ${Math.max(10, s - 20)}%, ${Math.min(95, l + 15)}%)`,
                        `hsl(${triad1}, ${s}%, ${l}%)`,
                        `hsl(${triad1}, ${Math.max(10, s - 15)}%, ${Math.min(90, l + 10)}%)`,
                        `hsl(${triad2}, ${s}%, ${l}%)`
                    ];

                case 'tetrad':
                    const tet1 = (h + 60) % 360;
                    const tet2 = (h + 180) % 360;
                    const tet3 = (h + 240) % 360;
                    return [
                        `hsl(${h}, ${s}%, ${l}%)`,
                        `hsl(${tet1}, ${s}%, ${l}%)`,
                        `hsl(${tet2}, ${s}%, ${l}%)`,
                        `hsl(${tet3}, ${s}%, ${l}%)`,
                        `hsl(${tet1}, ${Math.max(10, s - 15)}%, ${Math.min(90, l + 10)}%)`
                    ];

                default:
                    // Fallback to basic mono variations
                    return [
                        `hsl(${h}, ${s}%, ${Math.min(95, l + 20)}%)`,
                        `hsl(${h}, ${s}%, ${Math.min(90, l + 10)}%)`,
                        `hsl(${h}, ${s}%, ${l}%)`,
                        `hsl(${h}, ${s}%, ${Math.max(10, l - 10)}%)`,
                        `hsl(${h}, ${s}%, ${Math.max(5, l - 20)}%)`
                    ];
            }
        },

        /**
         * Convert HSL color string or components to HEX format
         * @param {string|number} hOrStr - HSL string or Hue number
         * @param {number} [s] - Saturation
         * @param {number} [l] - Lightness
         * @returns {string} Hex color representation
         */
        hslToHex(hOrStr, s, l) {
            let h;
            if (typeof hOrStr === 'string') {
                const match = hOrStr.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i);
                if (!match) return '#ffffff';
                h = parseFloat(match[1]);
                s = parseFloat(match[2]);
                l = parseFloat(match[3]);
            } else {
                h = hOrStr;
            }

            l /= 100;
            const a = s * Math.min(l, 1 - l) / 100;
            const f = n => {
                const k = (n + h / 30) % 12;
                const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color).toString(16).padStart(2, '0');
            };
            return `#${f(0)}${f(8)}${f(4)}`;
        },

        /**
         * Convert HEX color string to HSL components
         * @param {string} hex - HEX color string
         * @returns {{h: number, s: number, l: number}} HSL values
         */
        hexToHsl(hex) {
            // Strip # if present
            hex = hex.replace(/^#/, '');
            
            // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
            if (hex.length === 3) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }
            
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h = 0;
            let s = 0;
            const l = (max + min) / 2;
            
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            
            return {
                h: Math.round(h * 360),
                s: Math.round(s * 100),
                l: Math.round(l * 100)
            };
        }
    };

    // Expose ColorTheory globally
    global.ColorTheory = ColorTheory;

})(window);
