# Preset integration contract

Established 2026-09-18. Applies to new presets, new geometry, and substantial revisions.
Read alongside DEVELOPER_GUIDE.md. Record evidence in the review/handoff, not just ticks.

## Creative freedom first

This is an integration checklist, not an art recipe. Asymmetry, stillness, energetic
motion, unusual materials, surprises, and deliberately limited controls are welcome.
Do not make every effect similar to pass. Do not expose every artistic constant as a
slider. Identify the few meaningful controls that let the effect vary without losing
its identity. An explicit artistic choice is different from a forgotten integration.

Experiments may have gaps if marked experimental. A release candidate needs either
evidence for each applicable item or a visible, agreed limitation. Never silently
replace a valued effect merely to make its name fit.

## 0. Tuning lab first (required for new presets — Clay, 2026-10-03)

Clay tunes presets himself. Build the lab before polishing, so tuning is one paste
instead of many "make it 10% faster" round trips.

- [ ] Ship `tools/<presetKey>-lab.html` that loads the **real** renderer
      (`<script src="../js/<module>.js">`), so the lab and the site can never drift.
      It is live at `https://eternalvoid.io/tools/<presetKey>-lab.html` after a push.
- [ ] The renderer exposes `DEFAULT_TUNING`, the live `tuning` object and
      `setTuning(values)` (clamped). Artistic constants worth tuning live there,
      not scattered through the code.
- [ ] Lab controls: every meaningful app setting the preset reads (same names and
      ranges as the app), every tuning value, a 6-colour palette (test a Flow-style
      `hsl()` palette too), a music test (bass hit, beat loop, treble level), an app
      camera preview (Veil Drift rotation/zoom, app kaleidoscope), quality, and
      pause/scrub when the effect evolves over time. Show FPS and render scale.
- [ ] "Copy settings" produces one JSON line: `{"preset","app","tuning","palette"}`.
      Pasting that line back into the lab loads it.
- [ ] When Clay pastes settings JSON: `app` → the preset entry in `js/presets.js`
      (re-centre its Random Config / authored Flow ranges around the new values),
      `tuning` → `DEFAULT_TUNING`, `palette` → preset `colors`. Re-run the gates,
      commit, and say what changed. Do not ask him to describe tweaks in words.
- Reference implementation: `tools/mandelbrot-lab.html` + `js/mandelbrot-dive.js`.
  A private claude.ai copy of a lab (module inlined) is optional, for phone use.

## 1. Identity and preservation

- [ ] State the intended visible shapes, motion, distinguishing feature, and atmosphere.
- [ ] Observe locally after old trails settle; description matches what actually happens.
- [ ] Preserve old identifiers for retained effects; new effects get new identifiers.
- [ ] Check favorites, exclusions, custom saves, shared links, history, and old-state loads.
- [ ] Preserve the user's accepted look; seek approval for a substantial creative rewrite.

## 2. Control and Flow contract

- [ ] List each meaningful aspect: e.g. count, spacing, width, lifetime, symmetry,
      travel speed, independent spin, cloud growth, or foreground/background balance.
- [ ] For each, record one of: user/Flow parameter, bounded autonomous variation,
      intentional fixed design choice, or unfinished integration. Explain fixed choices.
- [ ] For parameters record schema key, default, min/max, units, integer/continuous,
      renderer consumers, and dependencies. UI, schema, renderer clamps must agree.
- [ ] Distinguish total scene rotation from individual rotation, travel, and lifespan.
      A speed control must say what it controls; zero must not accidentally become one.
- [ ] Register the geometry in the actual Flow selection pool, not only the preset menu.
      Document personality eligibility and exclusions. Exercise selection, don't just grep.
- [ ] Set bounded, coherent Flow targets; prevent inheritance of incompatible extremes.
      Personality changes variation without erasing the effect's identity.
- [ ] Preserve Manual/locked values and exclusions; controls update existing particles,
      not only newly spawned ones. No hidden automatic changes to manual count settings.
- [ ] Test entering/leaving, interrupted morphs, minimum/maximum count, respawn, and
      switching from a radically different preset. Avoid immortal particles and stale roles.
- [ ] Verify save/share/load of new parameters and reasonable defaults for older saves.
- [ ] Verify new families are represented in other randomizers if those surfaces offer them;
      document intentional differences between random scene generation and ongoing Flow.

## 3. Music response card (required for each family)

Record actual implementation, not hoped-for behavior:

| Input | Visible response and controls | Limits / intentionally unaffected aspects |
|---|---|---|
| Bass / attacks | | |
| Midrange / sustained energy | | |
| Treble / attacks | | |
| Palette / mood | | |
| Silence / stop / restart | | |

- [ ] Label inherited generic response versus bespoke response. No bespoke behavior is
      mandatory if generic response suits the effect, but describe it honestly.
- [ ] Test toggles, gain, quiet and loud signals, sustained tones, rapid transients,
      silence, disconnect, and reconnect. Restore the user's baseline on stop.
- [ ] Bound brightness, size, motion, density, and burst spawning. Avoid whiteout and
      strobing. Respect Comfort mode and reduced 3D gain; no second loop may bypass them.
- [ ] Audio modulation is temporary; do not contaminate saved or morph target settings.
- [ ] Do not assume audio exists in every browser/VR capture route. Explain unavailable audio.
- [ ] No claims of treatment, guaranteed trance, or health benefit.
- [ ] Give the geometry a voice in `js/music-moods.js` (`DEFAULT_PROFILES`) so Clay can tune it by ear in
      `tools/music-lab.html`; when he pastes the lab line, `voices` becomes the new defaults for those shapes.

## 4. Rendering and performance

- [ ] Coverage matrix: 2D / parallax dome / native 3D / headset. Mark implemented,
      generic fallback, unsupported, or untested. Desktop 3D is not headset testing.
- [ ] Check resize, portrait/wide aspect ratios, full-screen, Veil Drift rotation and
      maximum zoom. No exposed rectangular canvas boundaries; composition survives cropping.
- [ ] Check center interest, layer order, tails, respawn seams, and cumulative brightness.
- [ ] Check representative low/high density and layered effects with/without audio;
      record hardware, viewport, mode, FPS/frame-time and observation duration.
- [ ] Bounded allocations, particle counts, and draw work; no per-frame runaway spawning.
      Quality adaptation should preserve the signature instead of stripping it away.

## 5. Evidence and handoff

- [ ] Run relevant regression suites plus behavioral tests for the changed integration.
- [ ] Do targeted visual checks for changed behavior; do not claim visuals from code alone.
- [ ] Record unchecked items, remaining defects, and creative decisions separately.
- [ ] Update the shared hub with files, tests, preview, commit/deployment status, next actions.
- [ ] Publish only with Clay's approval; a push is not a verified live deployment.

## Copyable family record

Name / stable ID / geometry:
Creative intent and preserved effect:
Controls and ranges:
Fixed or autonomous artistic choices and why:
Flow personalities / target envelope / exclusions:
Music response card:
Mode coverage and fallback behavior:
Compatibility and lifecycle checks:
Performance / visual evidence:
Known gaps, owner, next step:
Release status:
