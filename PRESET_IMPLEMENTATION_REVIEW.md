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

## Celtic Knotwork — local experimental preset (2026-09-23)

**Intent and identity.** Preserve Celtic Current and add a separate, more ornamental
composition. This first pass uses multiple rounded-square two-strand braids and a
three-lobed center. Tapered paint marks travel in opposite directions on the two
strands. The earlier dark crossing capsules were removed completely. Rings flex,
counter-rotate, and respond to normal Veil Drift; density varies the ring count.

**Integration.** Stable new geometry ID `celticKnotwork` is in the preset menu,
particle-shape menu, saved-state schema, Random Config, and Serene/Alive/Wild Flow
profiles. The share-link shape index was appended after existing indices so older
compact links keep decoding. `scratch/celtic_knotwork_tests.js` covers finite geometry,
opposed moving currents, density tiers, and schema acceptance. The preset-2D work gate
passes. No live deploy or commit has been made for this experiment.

**Candid visual/performance review.** Local desktop preview is visibly more like a
layered luminous braid than the initial orbit-hoop draft, but it still reads as a
flowery radial pattern more than a traditional Celtic over-under knot. It lacks a
fully explicit alternating-over/under topology; this remains a creative follow-up.
After the tighter-braid revision, the local desktop HUD read 60 FPS in one check,
but this is only a momentary desktop observation, not a sustained benchmark or
phone result. The large-screen paint layer may look softer than native resolution.
Native 3D/VR was intentionally not built or tested for this 2D-first experiment.

**2026-09-23 refinement.** Each rounded-square path now carries three tightly
interlacing paint currents, with smaller-amplitude, higher-frequency crossings
inspired by Clay's sketch. Their moving marks travel at 3× the previous rate.
The three-lobed center and its small inner braid use similarly tight crossings
and the same palette choices as the surrounding rings. The local browser preview
shows the intended close braids; it still does not guarantee a textbook Celtic
over-under topology. The 2D gate passes, and this remains local/unpublished.

**Later visual correction.** Clay observed that the colored strands had merged
and the overall design had become concentric. The strands now separate more,
the path has a larger four-sided bend, and four offset loops cross the outer
field so the broad composition reads as a weave again. Desktop preview and
the 2D gate were checked; mobile, music, and actual headset behavior were not.

**Centered-shape pass and immediate rollback.** Clay liked the tapered particle
marks but found the offset field lopsided and its shapes vague. Four outer loops
were centered symmetrically, scattered ring offsets removed, and stroke
visibility raised. An additional attempt to shrink the loops and remove more
rings made the composition worse, so Clay asked for the preceding version and
those two final layout edits were reverted. The current preview is the larger
four-loop layout with its earlier ring count and unchanged tapered marks.

**Zoom-detail fix.** Clay spotted jagged particle edges at high Veil Drift zoom.
The approved layout and colors are unchanged. Curve guides and tapered traveling
marks now use denser path sampling, and the large-screen paint layer steps up
to higher resolution as zoom increases (with hysteresis to avoid frame-by-frame
resizing). Compositing requests high-quality image smoothing. A regression test
checks the zoomed layer gains more than 2× source pixels at desktop size; the
2D gate passes. Local desktop HUD read 60 FPS during one preview check, but
sustained high-zoom performance on weaker devices has not been measured.

**2026-09-24 movement pass.** After Clay approved the current composition, the
four large crossing loops gained offset, slow opening-and-closing motion, and
the inner rings gained a smaller independent pulse. Short, same-palette brush
glints now travel in opposite directions along the outer weave and fade smoothly.
The layout, tapered particles, and default preset settings were preserved.
Local desktop preview shows motion without obscuring the knot; the preset-2D
gate passes (10 checks). This is still local-only. Mobile frame rate, music
response, sustained performance, and native 3D/VR remain unverified.

**2026-09-24 coverage pass.** Clay found the four main loops hard to see and the
screen too empty. Their radius was reduced from 0.36 to 0.24 of the short screen
dimension and their center offset changed from 0.225 to 0.18; this keeps the
four-loop arrangement more fully on screen while opening their individual shapes.
The concentric rings now fill more of the previously wide gaps across all three
density tiers, and are drawn behind the large loops. No palette, speed, or
saved-state format changed. In the local desktop preview, the center is denser
and the pattern reaches beyond the edges; black negative space still separates
the braids intentionally. The preset-2D gate passes (10 checks), and one desktop
HUD spot check read 60 FPS. Phone, sustained FPS, and music remain untested.

**2026-09-24 release checklist.** Clay approved the denser four-loop version.
`celticKnotwork` is a new stable ID; Celtic Current and existing IDs remain intact.
The name and description match the observed 2D weave, though its crossings are
an artistic braid rather than a mathematically strict over-under knot. Density
controls the discrete ring tiers (renderer accepts 900–2400; authored Flow uses
1250–2050), base size changes paint-mark width, speed moves the travelers,
stretch flexes the strands, rotation speed turns the composition, and wobble
varies its shape. The larger-loop layout, three currents per path, and opposing
travel directions are intentional fixed identity choices. Serene, Alive, and
Wild Flow can select it; Random Config can too. Authored targets bound the
parameters so it does not inherit incompatible settings. Existing favorites,
exclusions, custom scenes, and compact/legacy share decoding remain on their
usual paths; the new share shape index is appended, not inserted.

Music response is inherited from the shared 2D pipeline, not a new audio
effect: bass attacks temporarily widen marks via base size; treble attacks
temporarily raise travel, flex, and rotation; Flow palette changes alter its
colors. There is no dedicated midrange behavior or separate knotwork burst.
Stopping audio restores baseline settings through the shared pipeline; actual
tab/device capture and disconnect/reconnect were not tested in this pass.
The new renderer regression exercises quiet/bass/treble parameter bounds and
finite draw work. Comfort Mode uses the existing reduced shared music gain.

Coverage: local desktop 2D visually checked after trails settled; local
390×844 phone-sized browser viewport visually checked (weave remains legible
and reaches the edges), then the viewport was restored. This is not a physical
phone FPS test. Parallax dome retains the generic 2D-texture route; native 3D
has no custom knotwork renderer and actual headset behavior is untested.
The 2D, music, and release gates pass; save/share compatibility and Flow
inventory have regression coverage. Sustained mobile/high-zoom frame time,
real music capture, fullscreen, and headset QA remain follow-up checks.

## Cymatic Resonance — local candidate preset (2026-09-24, Claude)

Built by Claude (Cowork) at Clay's request as an original preset. Local only:
not committed, not deployed. Awaiting Clay's visual approval.

**Name / stable ID / geometry:** Cymatic Resonance / preset key and particle shape
`cymaticResonance` / authored 2D renderer `js/cymatic-resonance.js`.

**Creative intent.** Glowing sand on an unseen vibrating plate (Chladni figures).
Grains shaken off the moving parts of a circular standing wave
`f = cos(nθ)cos(aR) − cos(mθ)cos(bR)` collect on its still (nodal) lines, so the
figure *emerges* from the sand rather than being drawn. Every ~22 s of clock time
the plate cross-fades to another resonant mode (3-, 4-, 5-, 6-, 7-, 8-fold) and the
whole field streams across the screen to re-form. Distinguishing feature versus
existing presets: emergent geometry from particle gathering, and a visible
re-formation between figures. Nothing existing was changed or renamed.

**Controls and ranges (existing keys only; no new schema keys).**

| Aspect | Setting | Renderer clamp | Preset / authored Flow | Notes |
|---|---|---|---|---|
| Grain count | `density` | 900–2400 → 9 grains each, × screen-area factor (0.45–1), 3,000–18,000 cap | 1600 / 1300–2200 | Phones get fewer grains; count updates live |
| Grain size | `baseSize` | 0.5–12 | 2.2 / 1.8–2.8 | Bass swell capped at 1.6× the resting size |
| Size spread | `sizeVariation` | 0–2 | 0.6 / 0.3–0.8 | Streak length variety |
| Settle pace + mode tempo | `speed` | 0–2 | 0.5 / 0.38–0.62 | 0 truly freezes grains and mode clock (tested) |
| Plate scale (bold ↔ fine lace) | `stretch` | 0–3 → scale 1.0–2.05 | 1.0 / 0.6–1.6 | |
| Loose-sand agitation | `turbulence` | 0–0.5 | 0.05 / 0.02–0.10 | |
| Line breathing | `wobble` | 0–0.8 | 0.14 / 0.08–0.20 | Wavenumbers breathe ±~10% |
| Scene rotation | `rotationSpeed` (shared) | shared | 0.03 / 0.015–0.05 | Whole-scene only; grains have no own spin |
| Trail length | `dissipation` (shared) | shared | 0.20 / 0.16–0.26 | Kept short so lines stay crisp under Veil Drift |

**Fixed / autonomous choices.** The mode sequence (7 curated modes, hold 16 s +
6 s smoothstep morph, in clock time) is autonomous and not exposed; it is the
preset's identity. Colour is assigned in slow outward-travelling radial bands of
the active palette. ~1.2%/s of grains respawn (30% near the centre, where lines
crowd) so the field stays alive and the centre stays solid. Grains slide along
their line (tangential jitter) so lines fill evenly rather than dotting.

**Flow.** Registered in Random Config (calm list), Serene/Alive/Wild Flow pool,
the protected authored-target list, and the authored target envelope above
(`flow_inventory_tests`, `flow_visual_variety_tests` exercise selection).
Kaleidoscope, psychedelic, morphing BG, spinning kaleido are off.

**Music response card.**

| Input | Visible response | Limits |
|---|---|---|
| Bass attacks | **Bespoke:** the shared baseSize swell is read as a plate strike; sand leaps (strength ∝ attack², bounded), shows as dim specks, resettles in ~1 s. Also inherited grain swell. | Swell capped 1.6×; strike velocity bounded; a >0.6 s swell is treated as a slider change, not a beat |
| Midrange / sustained | None bespoke (shared pipeline has no midrange channel) | — |
| Treble attacks | **Bespoke:** `trebleIntensity` raises glint rate (lighter palette tint) and loose-sand shimmer; inherited speed/stretch/wobble pulses | Glint rate ≤ 6%, alpha ≤ 0.9, never white |
| Palette / mood | Inherited Flow mood palette shift | — |
| Silence / stop | Shared pipeline restores baseline; no strikes, sand settles | Real capture/disconnect not tested |

Comfort Mode halves the shared pulses before they reach the renderer, so strikes
are weaker too; no second audio loop exists. Audio modulation never touches
saved/morph targets (only live settings via the shared pipeline).

**Mode coverage.** 2D: implemented and visually checked. Parallax dome / native
3D / headset: not built, not tested (3D overhaul pending, per Clay).

**Compatibility / lifecycle.** New shape appended to the compact share-link table
(index 33; old links unaffected; round trip verified). Schema accepts the shape.
Switching Chaotic Spiral → Cymatic → Jade Currents → Cymatic ran without errors;
re-entry after >1.5 s rescatters the sand so the figure re-forms (tested).
Resize rescales grains. Bad inputs (NaN time, empty palette, zero size) tested.

**Evidence.** `scratch/cymatic_resonance_tests.js` (8 groups: settling onto nodal
lines, density/phone bounds + cap, speed-0 freeze, mode cycle + cross-fade, bass
strike launch/resettle + swell cap, bounded treble, re-entry/resize/bad input,
manual size change honoured). preset-2d gate PASS (11), music PASS, release PASS.
Visual checks in headless Chromium (software rendering): 1280×720 through 3
mode changes, 390×844 phone, simulated bass strike, Veil Drift on and off.
Frame time: renderer JS ≈3.5 ms/frame at 9,600 grains (headless); whole-page
FPS in that software-rendered environment 30–45 vs Celtic Knotwork 26 in the same
environment. **Not** a real GPU, phone, or sustained measurement.

**Known gaps.** Veil Drift zoom/rotation smears grains into short streaks while
settling (intentional trails are short; lower dissipation gives a striking
"echo" look, higher gives crisp lines). Some grain clumping remains near the
centre. Real phone FPS, real audio capture, fullscreen, and 3D/VR untested.
The modes are artistic Chladni-style pairs, not physical plate eigenmodes.

**Release status:** Clay approved and pushed `76cef03` to live (2026-09-24).

**2026-09-24 revision (Clay feedback: shift constantly, fuller screen, Veil Drift zoom too far).**
- Mode schedule now hold 4 s (≈1 s settle + ≈3 s finished figure) then a 5 s morph: continuous re-forming.
- Plate scale `1.7 + 0.45·stretch` (was `1.0 + 0.35·stretch`): ~1.6× more lines. Grains `density × 12` (was 9), cap 22,000; colour bands 4.5 (was 3.2).
- Settled sand now streams along its line (`0.045·minDim·tempo` px/s); neighbouring lines flow in opposite directions.
- **Veil Drift zoom compensation:** the renderer receives `sceneScale` and draws the plate shrunk by `sceneScale^0.75` (residual on-screen zoom ≈ `sceneScale^0.25`, ~1.16× at 1.8×). Spawn/respawn region widens by the same factor and grain count rises (≤1.6×) so corners never empty; grain size scaled back.
- **Frame-time guard:** rolling frame interval > 26 ms sheds sand down to 45 % (in 250-grain steps); < 19 ms restores it. Preserves the figure, only thins lines.
- Tests: 10 groups (added zoom-compensation transform and frame-guard shed/restore). Headless software rendering: guard settled at 45 % and doubled FPS (9→18); real GPU/phone behaviour not measured.

