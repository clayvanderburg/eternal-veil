const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const check = (condition, message) => {
    if (!condition) throw new Error(message);
};

const html = read("index.html");
const app = read("js/app.js");
const presets = read("js/presets.js");
const schema = read("js/state-schema.js");
const simulation = read("js/simulation.js");
const native3d = read("js/simulation3d-native.js");
const styles = read("styles.css");
const combined = `${html}\n${app}\n${styles}`.toLowerCase();

check(!combined.includes("spotify"), "retired Spotify UI or logic remains");
check(html.includes("enter-comfort-btn") && html.includes("comfort-mode-toggle"), "Comfort Mode entry or control is missing");
for (const personality of ["serene", "alive", "wild"]) {
    check(html.includes(`data-personality="${personality}"`), `${personality} personality control is missing`);
}
check(app.includes("effectivePersonality") && app.includes("sereneFields") && app.includes("wildFields"), "personality-specific Flow ranges are missing");
check(app.includes("chooseNextFlowPattern") && app.includes('shape !== currentShape'), "pattern interval must guarantee a different Flow geometry");
check(app.includes("sereneCaps") && app.includes('speed: [0.1, 0.9'), "Serene must enforce a genuinely calm ceiling");
check(html.includes("feature-3d-button") && styles.includes("feature3DOrbit"), "3D feature beacon is missing");
check(html.includes("Chooses a visibly different pattern every interval"), "pattern interval behavior is not explained in the UI");
check(app.includes("favoritePresetKeys") && app.includes("releaseActivePreset") && app.includes("getPresetSignatureKeys"), "preset favorites or lock/release behavior is missing");
check(presets.includes('particleShape: "spiral"'), "Hypnotic Spiral does not select authored geometry");
check(schema.includes('"spiral"'), "Spiral is not accepted by shared-state validation");
check(simulation.includes('shape === "spiral"') && simulation.includes('"lotus", "spiral"'), "2D Spiral motion or rendering is missing");
check(native3d.includes("spiral: 9") && native3d.includes("uEffectMode > 8.5"), "native 3D Spiral mode is missing");
check(html.includes("foundation-batch-1"), "first-batch assets are not cache-busted together");

console.log("Foundation batch integration checks passed.");
