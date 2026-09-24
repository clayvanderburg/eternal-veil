# Eternal Veil / Void — project status

**Updated:** 2026-09-24
**Path:** `C:\Users\MadKing\.gemini\antigravity\scratch\eternal-veil`  
**Live:** https://eternalvoid.io  

## What it is

Browser-based immersive visual / meditation / music-reactive experience (2D + 3D paths, presets, color systems, VR-related experiments).

## Working now

- 2026-09-24 Celtic Knotwork release: separate 2D knot preset with denser
  four-loop composition, bounded Flow/Random Config, save/share compatibility,
  and inherited music reactivity. Clay approved the local preview. Desktop
  and phone-sized browser views were checked; physical phone, real audio capture,
  and headset performance are still follow-up validation.
- 2026-09-22 share-link release: compact, self-contained scene links (`#scene=`)
  replace long new `#seed=` links; old shared links still load. Round-trip and
  malformed-link tests added. Clay approved publication to the live site.
- 2026-09-22 Flow UI release: pattern/color intervals mirrored into the hover HUD,
  defaults shortened to 15s/18s, and timer dragging no longer triggers immediate shifts.
  Signature Effects now show only for Chaotic Spiral or Solar Flare in 2D; other
  geometry-specific controls still need a later applicability audit.
- 2026-09-22 Celtic Current release: two independent full-bleed woven
  Jade-style depth planes, authored Flow/Random Config ranges, save/share schema support,
  music-response documentation, desktop/phone visual checks, and focused regression tests.
  See `PRESET_IMPLEMENTATION_REVIEW.md` for integration and mode limitations.
- 2026-09-22 agent efficiency harness: `AGENT_ROUTING.md`, machine-readable context
  lanes, reusable evidence packets, and deterministic lane/release gates. No Jev API
  dependency; agents load only the relevant 2D/music/mobile/deploy/3D context.
- 2026-09-18 Codex integration release: restored six new Flow families, bounded targets,
  live eclipse controls, manual spiral count, zero-speed and music-state fixes.
  Review/checklist: `PRESET_IMPLEMENTATION_REVIEW.md`, `PRESET_INTEGRATION_CHECKLIST.md`.
- Clay's priority: phone-friendly 2D and music response first. Defer the broad native
  3D/VR overhaul; only inexpensive basic adaptations are optional. No new 3D work in
  this release. Deployment verification is recorded in the shared release log.

- Core app + simulation modules under `js/`  
- Developer guide: `DEVELOPER_GUIDE.md`  
- Scratch tests under `scratch/`  
- Multi-agent history in agents-hub logs  
- Clay 2D preset audit (Grok, 2026-09-18): remaining audited presets published with Jade / Quantum / Prism kept

## Agent notes

- Kept presets:
  - `liquid` (Jade Currents)
  - `quantum` (Quantum Drift)
  - `mandala` (Prism Drift)
- Published audit presets:
  - Breath Sanctuary: slower petal travel, two opposing hero orbs
  - Ethereal Aura: speed 0.20, size/sizeVar 2.5, 6-fold kaleidoscope
  - Nebula Spark: curl sparks plus blooming clouds
  - Solar Flare: eclipsed suns with chaotic wavy rims (count/size are Flow knobs)
  - Violet Undertow: original curl plus a secondary wavy spiral
  - Cosmic Strings: denser, longer, thinner, 8-fold kaleidoscope
  - Chaotic Spiral (was Hypnotic Spiral): full-screen main coil plus 4–8 extra particle coils that drift around it
- Autopilot pauses on preset select. Speed slider `[0.00, 4.00]` step `0.01`.
- Signature Effects sliders (Flow/Man): Mini Spirals, Spiral Extent, Wander Mix, Eclipse Count, Eclipse Size.
- Top-center Flow Status Banner & Inspector: Appears whenever parameters are in Manual mode. Displays manual count, expandable inspector popover with individual `✕` and `Man | Flow` toggles per setting, and a primary "BACK TO FLOW" button that resets all settings, clears preset lock, and engages Autopilot.
- `node_modules/` and `chrome-profile/` are local — don’t treat as source of truth for handoffs.

## Next

Follow hub `STATUS.md` for what’s hot; coordinate via agents-hub.

- 2026-09-23 development history: Celtic Knotwork was integrated as a new 2D preset
  and Flow geometry without changing Celtic Current. Clay's tight-braid sketch
  prompted three close currents per path, 3× moving-mark speed, and a center
  that shares the outer palette. A further visual correction reopened the braid
  and added four offset crossing loops to restore the broad Celtic pattern.
  Tests pass and one desktop HUD check read 60 FPS;
  sustained/mobile performance and traditional over-under topology remain
  follow-up review items.
  A later zoom-detail pass increased curve sampling and adaptively
  raised paint resolution during close-ups; its regression check and 2D gate pass.
  See `PRESET_IMPLEMENTATION_REVIEW.md` for the exact state and limits.
