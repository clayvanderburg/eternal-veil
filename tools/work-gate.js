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
    "node scratch/preset_compositions_tests.js", "node scratch/celtic_knotwork_tests.js", "node scratch/cymatic_resonance_tests.js", "node scratch/mandelbrot_dive_tests.js", "node scratch/molecular_dance_tests.js", "node scratch/stellar_nursery_tests.js", "node scratch/kaleidoscope_center_tests.js", "node scratch/particle_sprites_tests.js", "node scratch/music_moods_tests.js", "node scratch/music_lab_tests.js", "node scratch/url_tests.js", "node scratch/studio_tests.mjs", "node scratch/tools_menu_tests.mjs",
    "node scratch/share_link_tests.js", "node scratch/share_scene_hud_tests.js"
  ],
  music: [
    "node --check js/spatial-audio.js", "node scratch/spatial_audio_tests.js",
    "node --check js/music-player.js", "node --check js/music-library.js", "node scratch/music_library_tests.js", "node scratch/music_source_tests.js", "node scratch/speaker_align_tests.js", "node --check js/music-catalog.js", "node scratch/studio_music_tests.mjs", "node scratch/studio_review_tests.mjs", "node scratch/studio_notes_tests.mjs",
    "node --check js/app.js", "node --check js/simulation.js",
    "node scratch/preset_integration_tests.js", "node scratch/music_moods_tests.js", "node scratch/music_lab_tests.js", "node scratch/url_tests.js"
  ],
  mobile: [
    "node scratch/ui_fade_tests.js", "node scratch/device_mode_tests.js", "node scratch/tvgl_core_tests.js",
    "node --check js/app.js", "node --check js/simulation.js",
    "node scratch/url_tests.js", "node scratch/studio_tests.mjs", "node scratch/tools_menu_tests.mjs", "node scratch/preset_integration_tests.js"
  ],
  release: [
    "node scratch/ui_fade_tests.js", "node scratch/device_mode_tests.js", "node scratch/tvgl_core_tests.js",
    "node tools/work-gate.js preset-2d", "node --check js/music-player.js", "node --check js/music-library.js", "node scratch/music_library_tests.js", "node scratch/music_source_tests.js", "node scratch/color_cycles_tests.js",
    "node scratch/color_theory_tests.js", "node scratch/meditation_mode_tests.js",
    "node --check js/feedback.js", "node scratch/feedback_tests.js", "node scratch/support_interest_tests.js",
    "node --check js/visual-playlists.js", "node scratch/visual_playlists_tests.js", "node scratch/social_links_tests.js"
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
