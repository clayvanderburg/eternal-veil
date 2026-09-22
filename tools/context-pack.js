#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const root = path.resolve(__dirname, "..");
const routes = JSON.parse(fs.readFileSync(path.join(root, "AGENT_CONTEXT_ROUTES.json"), "utf8"));
const requestedLane = process.argv[2] || "default";
const outIndex = process.argv.indexOf("--out");
const taskArgs = process.argv.slice(3, outIndex >= 0 ? outIndex : undefined);
const taskText = taskArgs.join(" ").toLowerCase();
const inferLane = task => {
  if (/\b(vr|3d|headset|webxr|dome)\b/.test(task)) return "3d-vr";
  if (/\b(deploy|publish|release|netlify|live)\b/.test(task)) return "deploy";
  if (/\b(music|audio|beat|bass|treble|visuali[sz]er)\b/.test(task)) return "music";
  if (/\b(preset|particle|flow|visual|animation|celtic|knot)\b/.test(task)) return "preset-2d";
  if (/\b(phone|mobile|touch|responsive|fps|performance)\b/.test(task)) return "mobile";
  return "default";
};
const lane = requestedLane === "auto" ? inferLane(taskText) : requestedLane;
const route = routes[lane];
if (!route) {
  console.error(`Unknown lane: ${lane}. Choose: ${Object.keys(routes).join(", ")}`);
  process.exit(2);
}
const outPath = outIndex >= 0 && process.argv[outIndex + 1]
  ? path.resolve(root, process.argv[outIndex + 1]) : null;
const run = command => {
  try { return cp.execSync(command, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (error) { return `(unavailable: ${String(error.status ?? "error")})`; }
};
const hub = "F:\\MadKing\\grok-shared\\agents-hub\\log";
let logs = [];
try {
  logs = fs.readdirSync(hub)
    .filter(name => /eternal-(veil|void)/i.test(name))
    .map(name => ({ name, mtime: fs.statSync(path.join(hub, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime).slice(0, 3).map(item => item.name);
} catch {}
const lines = [
  `# Eternal Void context packet: ${lane}`,
  "",
  `Generated: ${new Date().toISOString()}`,
  `Purpose: ${route.description}`,
  ...(requestedLane === "auto" ? [`Automatically routed from: ${taskText || "(empty task)"}`] : []),
  `Commit: ${run("git rev-parse --short HEAD")}`,
  "",
  "## Working tree",
  "```",
  run("git status --short") || "clean",
  "```",
  "",
  "## Read in this order",
  ...route.files.map((file, index) => `${index + 1}. ${file}`),
  "",
  "## Search once, record the result in the session evidence",
  ...(route.searches.length ? route.searches.map(term => `- ${term}`) : ["- No lane-specific searches"]),
  "",
  "## Relevant recent shared handoffs",
  ...(logs.length ? logs.map(name => `- ${name}`) : ["- Shared hub unavailable"]),
  "",
  "## Deterministic checks",
  ...route.checks.map(check => `- ${check}`),
  "",
  "## Evidence packet (fill during work)",
  "- Goal and accepted visual behavior:",
  "- Exact files and symbols inspected:",
  "- Confirmed findings:",
  "- Changes made:",
  "- Tests and visual/device checks:",
  "- Known limitations and next action:",
  "- Commit/deployment status:",
  ""
];
const result = lines.join("\n");
if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, result, "utf8");
  console.log(`Wrote ${path.relative(root, outPath)}`);
} else {
  process.stdout.write(result);
}
