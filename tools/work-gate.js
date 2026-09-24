#!/usr/bin/env node
"use strict";

const cp = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const lane = process.argv[2] || "preset-2d";
const suites = {
  "preset-2d": [
    "node --check js/app.js", "node --check js/simulation.js",
    "node scratch/preset_integration_tests.js", "node scratch/preset_audit_tests.js",
    "node scratch/flow_inventory_tests.js", "node scratch/flow_visual_variety_tests.js",
    "node scratch/preset_compositions_tests.js", "node scratch/celtic_knotwork_tests.js", "node scratch/cymatic_resonance_tests.js", "node scratch/url_tests.js",
    "node scratch/share_link_tests.js"
  ],
  music: [
    "node --check js/app.js", "node --check js/simulation.js",
    "node scratch/preset_integration_tests.js", "node scratch/url_tests.js"
  ],
  mobile: [
    "node --check js/app.js", "node --check js/simulation.js",
    "node scratch/url_tests.js", "node scratch/preset_integration_tests.js"
  ],
  release: [
    "node tools/work-gate.js preset-2d", "node scratch/color_cycles_tests.js",
    "node scratch/color_theory_tests.js", "node scratch/meditation_mode_tests.js"
  ]
};
if (!suites[lane]) {
  console.error(`Unknown gate: ${lane}. Choose: ${Object.keys(suites).join(", ")}`);
  process.exit(2);
}
for (const command of suites[lane]) {
  process.stdout.write(`\n[gate:${lane}] ${command}\n`);
  const result = cp.spawnSync(command, { cwd: root, shell: true, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[gate:${lane}] FAILED: ${command}`);
    process.exit(result.status || 1);
  }
}
console.log(`\n[gate:${lane}] PASS (${suites[lane].length} checks)`);
