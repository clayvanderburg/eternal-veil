const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

function check(condition, message) {
    if (!condition) throw new Error(message);
}

check(html.includes('data-experience-mode="meditation"'), "Meditation mode control is missing");
check(html.includes('id="breathing-rhythm-select"'), "Breathing rhythm selector is missing");
check(html.includes('id="breathing-guide"'), "Breathing guide is missing");
check(html.includes("BETA"), "Beta product marker is missing");
check(app.includes("function setExperienceMode"), "Experience mode controller is missing");
check(app.includes("function processMeditationMode"), "Breathing runtime is missing");
check(app.includes('elements.hudMode.textContent = is3DMode ? "MEDITATE 3D"'), "3D Meditation HUD state is missing");
check(css.includes("body.meditation-mode.show-breathing-guide"), "Breathing guide visibility styling is missing");

console.log("Meditation mode and Beta identity integration checks passed.");
