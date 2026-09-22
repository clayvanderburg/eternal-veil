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

## Celtic Current integration record — 2026-09-22

**Identity and intent.** Stable preset/geometry ID: `celticCurrent`; display name:
**Celtic Current**. Two luminous Celtic weave fields use the same soft, tapered,
paint-daub visual language as Jade Currents. A smaller rear lattice and a larger
foreground lattice counter-rotate, breathe by roughly 30 percent, and wander
independently. Horizontal and perpendicular families create the overlaid knot grammar.
The render field is 1.9 viewport diagonals wide so rotation and breathing remain
full-bleed without exposing a rectangular edge.

**Meaningful controls.** Speed controls mark travel; Density controls band and mark
density; Particle Size controls the shared Jade-style mark scale; Rotation controls
counter-spin strength; Wobble controls each plane's independent orbital drift;
Velocity Stretch controls a slow flex of the weave diamonds (zero rests them); Trails
controls canvas persistence; Zoom remains the app-wide scene zoom; and the standard
palette controls all marks. Two planes, their contrasting base scales/opacity, matched
native Jade-mark opacity, particle geometry, perpendicular families, and asynchronous breath timing are deliberate
composition constants rather than extra UI knobs.

**Flow behavior.** The geometry is present in Serene, Alive, and Wild Flow and in the
one-shot Random Config pool. Its authored Flow envelope preserves recognizability:
speed .42-.62, density 1250-1800, size 4.2-5.4, trail dissipation .028-.042,
rotation .065-.105, wobble .08-.18, stretch .75-1.35, and restrained related values. Generic kaleidoscope,
psychedelic, morphing-background, and spinning-kaleidoscope extremes are disabled for
this protected composition. Standard manual locks, favorites, exclusions, custom
scenes, history, and shared-scene schema plumbing apply; `celticCurrent` was added to
the allowed saved-state geometry list without changing older identifiers.

**Music response card.** The existing shared audio layer provides bass size swells and
longer/brighter trail persistence; treble can pulse travel, wobble, rotation, and color;
palette mood follows the existing color-Flow rules. The renderer clamps these inputs so
the knot remains legible. It has no dedicated midrange behavior and no beat-controlled
change to its two-plane topology. Generic burst particles are not drawn by this dedicated
renderer, intentionally avoiding chaotic explosions. Stopping audio restores the normal
shared settings; no Celtic-specific audio state persists.

**Mode and device coverage.** The dedicated composition is implemented and visually
checked in desktop 2D and at a 390x844 phone viewport. The local in-app browser measured
about 28-30 FPS on the 1920x1080 high-resolution desktop canvas and about 35 FPS at the
phone viewport. Low/phone rendering increases mark spacing by 16 percent while preserving
both planes and the knot identity. No JavaScript errors appeared. The parallax dome can
use the normal 2D texture path, but native 3D has no dedicated interpretation and neither
mode was headset-tested; do not claim VR parity.

**Validation and release state.** Syntax, preset integration, Flow inventory, Flow visual
variety, save/share URL, renderer-transform, finite-geometry, dual-depth-plane, and mobile
workload assertions pass locally. The actual app preview was checked after old trails
settled. This integration remains local and uncommitted/unpublished pending Clay's approval.

**Visual parity correction.** The approved scratch preview assigned native opacity inside
each Jade mark, overriding its earlier layer alpha. The first integrated build multiplied
those values instead, making the marks unintentionally translucent. The app also applied
global Veil Drift zoom on top of the composition's two independent 30 percent zoom cycles,
which made the weave appear much less dense. Celtic Current now keeps native Jade opacity
and partially compensates for outer zoom inside its oversized field. Veil Drift rotation,
zoom and wander remain adjustable: net visible zoom follows roughly the square root of the
outer zoom rather than being cancelled, while substantially more weave detail stays onscreen.

**Tension refinement.** Each depth plane now slowly widens while narrowing vertically,
then eases back, on its own offset cycle. This changes the open diamond proportions
without adding marks or brightness. The existing Velocity Stretch control sets the
strength, including zero to turn the flex off; authored Flow varies it mildly.
