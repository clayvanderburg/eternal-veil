const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = (condition, message) => {
    if (!condition) throw new Error(message);
};

const schema = read("js/state-schema.js");
const presets = read("js/presets.js");
const simulation = read("js/simulation.js");
const native3d = read("js/simulation3d-native.js");
const html = read("index.html");

check(schema.includes('"pipes"'), "pipes must be accepted by the state schema");
check(presets.includes("neonConduits") && presets.includes('particleShape: "pipes"'), "preset must select pipes");
check(simulation.includes("getPipeRoutePoint") && simulation.includes("updatePipeMotion"), "2D pipe motion is missing");
check(simulation.includes("turnedCorner") && simulation.includes("this.pipeSegment / 8"), "2D turns must draw through an exact elbow");
check(native3d.includes("pipes: 5") && native3d.includes("uEffectMode > 4.5"), "native 3D pipe mode is missing");
check(html.includes('value="pipes"') && html.includes("Neon Conduits"), "shape selector option is missing");

console.log("Neon Conduits integration checks passed.");
