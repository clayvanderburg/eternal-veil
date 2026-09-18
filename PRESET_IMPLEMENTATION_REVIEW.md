# Preset integration review — 2026-09-18

Baseline: main 6177ba46595b0d6713e58ead5b3f29d7e05a3d9a.
Scope: recent Antigravity/Grok preset changes and their shared Flow/audio pathways.
Code and behavioral-test review, not a new exhaustive visual audit. No headset or
live audio listening test performed. Changes are local; no deployment authorized.

## Fixed locally

1. **Six new geometries missing from Flow.** Jade Currents, Quantum Drift, Prism Drift,
   Nebula Spark, Solar Flare, and Violet Undertow existed in preset/schema/rendering
   but not the ongoing Flow selector. All now enter Alive/Wild; Jade/Prism/Violet also
   enter Serene. The more energetic three stay outside Serene intentionally.
2. **Unbounded inherited settings.** New families now receive targets around their
   authored preset values: +/-12% Serene, +/-20% Alive, +/-28% Wild for defined numerical
   visual parameters. Density is integral; drag is capped. Manual controls are respected.
   These are initial engineering envelopes, not visually approved final tuning.
3. **Solar Flare live controls.** Size changes now resize existing suns. Changing count
   initializes promoted suns, restores finite lifetimes on demotion, and remaps stale
   flare host indices. Leaving Solar Flare no longer carries immortal sun lifetimes.
4. **Spiral controls.** Wander Mix now uses the exposed .05–.40 interval with matching
   family proportions, instead of silently limiting it. Mini-spiral count no longer
   oscillates behind the user's manual setting; Flow can still morph its parameter.
5. **Zero-speed fallbacks.** Replaced speed truthiness defaults that changed zero into
   one, including individual prism spin. This does NOT make Speed a universal pause:
   independent ambient clocks and baseline travel terms remain in some effects.
6. **Music trail baseline.** Enabling bass no longer changes .002 dissipation into .004
   during silence, which had shortened Cosmic Strings' long trails.
7. **Music state and 3D override.** Stop restores both canvas transforms, clears native
   pulse fields and transient envelopes. Bass/treble native pulse fields respect toggles.
   Removed the second 3D-loop raw-audio assignment that overwrote reduced/gated pulses.

## Current control inventory

All six new shapes have schema enum entries and existing selection/save plumbing.
Shared controls include speed, size/variation, stretch, density, turbulence, curl,
trails, rotation and wobble, with usefulness varying by renderer/geometry.
Solar Flare additionally has eclipseCount 12–90 and eclipseSize .45–1.6.
Chaotic Spiral has miniSpiralCount 4–8, spiralExtent .45–.98 and wanderMix .05–.40.
These five signature controls already had UI/schema/Flow wiring; their runtime
semantics needed the fixes above. Existing tests cover schema generally, not a browser
round-trip of every new scene; that remains a release check.

**Not yet all meaningful aspects are independently configurable.** Cloud proportion,
cloud lifecycle timing, flare fraction, wave structure, and some spoke/shape composition
constants remain authored in code. This review does not turn them all into controls.
The next design pass should choose a small useful subset, especially Nebula Spark
cloud amount/growth timing and Solar Flare flare activity, with coherent ranges. Fixed
constants should be intentional and documented, not treated as automatically complete.

## Music response inventory (source-derived, not visually/audio verified)

Shared layer: bass attacks swell particle size and extend trails; treble attacks alter
speed/turbulence and selected wobble/stretch/rotation. Generic curl particles may also
spark and change trajectory. Optional palette mood changes depend on color Flow state.
Authored trajectories can override generic movement, so identical inputs do not imply
identical visible responses. No dedicated per-family midrange mapping was established.

| Family | Existing musical connection | Important limitation / follow-up |
|---|---|---|
| Ethereal Aura | Generic size/trail/motion modulation within kaleidoscope | Check cumulative mirrored brightness |
| Nebula Spark | Sparks inherit curl response; rendered cloud size uses particle sizing | Cloud ignition/lifetime is autonomous, not a beat-triggered explosion |
| Solar Flare | Ember/flare particles inherit shared modulation | Eclipse radius uses its own size control, not the bass size pulse |
| Jade Currents | Shared particle sizing/trails and partially shared motion | Background wave structure is authored, not frequency-band driven |
| Quantum Drift | Shared size/trails and movement inputs | No explicit per-spoke or midrange musical behavior |
| Prism Drift | Shared size and speed influences, including individual rotation | No dedicated beat-to-facet or depth mapping |
| Violet Undertow | Shared sizing/trails; mixed authored/curl paths | Wavy spiral structure is not a dedicated musical channel |
| Cosmic Strings | Shared particle response and long trails; corrected silence baseline | Test eight-fold brightness under strong audio |
| Breath Sanctuary | Shared response layered with meditation modulation | Needs quiet/strong-input checks to preserve calmness |
| Chaotic Spiral | Shared size/trails; authored spiral/host movement | Audio does not directly control mini-host count or extent |

## Remaining integration risks / next work

- **Native 3D parity gap:** six new family identifiers fall back to native effect mode 0.
  Their distinctive 2D features and signature controls do not have dedicated shader
  implementations. Dome uses the 2D image, not a true volumetric version. Do not describe
  these as fully verified native/VR presets. Decide intentional interpretations separately.
- **Other randomization surface:** ongoing Flow was repaired here. One-shot random-scene
  generation has its own configuration path and needs a separate inventory alignment.
- **Audio timing:** envelopes are frame-decayed, and music/morph ordering can interact;
  compare response at different frame rates and during long transitions before redesign.
- **Comfort response:** remaining physical 2D burst/force paths deserve explicit gain
  and safety verification, not just numeric size checks.
- **Controls versus artistic constants:** complete family records from the checklist;
  don't claim every hardcoded feature is now Flow-randomized.
- **Visual/performance evidence:** targeted browser checks, representative audio, FPS,
  and actual Quest testing remain undone in this review. No claim of visual approval.

## Validation

Passed syntax checks for app.js and simulation.js and these nine Node suites:
preset_integration_tests, preset_audit_tests, flow_inventory_tests,
flow_visual_variety_tests, preset_compositions_tests, color_cycles_tests,
color_theory_tests, meditation_mode_tests, url_tests (all under scratch/).

New behavioral coverage executes actual particle lifecycle updates and family-target
code: live sun sizing, count promotion/demotion, valid host/lifetime, leaving solar,
zero-speed prism spin, manual host-count stability, bounded numeric targets, manual
size preservation, and silent bass baseline. Flow sampling exercises actual selection
and asserts the new geometries occur. Statistical frequency checks are not FPS tests.

Preview: http://127.0.0.1:8767/ (refresh the existing local server).
Follow PRESET_INTEGRATION_CHECKLIST.md for all subsequent family changes.
