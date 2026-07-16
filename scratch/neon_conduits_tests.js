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
for (const variant of ["pipesTight", "pipesCathedral", "pipesShrine"]) {
    check(schema.includes(`"${variant}"`), `${variant} must be accepted by the state schema`);
    check(presets.includes(`particleShape: "${variant}"`), `${variant} preset is missing`);
    check(html.includes(`value="${variant}"`), `${variant} selector option is missing`);
    check(native3d.includes(`${variant}:`), `${variant} native 3D mode is missing`);
}
check(simulation.includes('shape.startsWith("pipes")'), "conduit variants must share the authored pipe renderer");
check(native3d.includes("isTight") && native3d.includes("isCathedral") && native3d.includes("isShrine"), "distinct 3D conduit geometries are missing");

console.log("Neon Conduits family integration checks passed.");
