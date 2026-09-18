# Preset visual audit — September 9, 2026

Status: IN PROGRESS. Nothing published. Preserve existing preset IDs and visuals.

### Six-layer refinement

Superseded by Clay's subsequent request: eight layers now, adding larger scales1.45/2.05 beyond prior six. Rotation alone +50% in CPU/native; travel speed remains.78 after previous +30% request. Density3600 retained, not increased again. Cache fractal-bloom-6. Math/syntax tests pass; full native/headset validation still pending.

Reloaded 2D visual verification: richer overlapping branches, 35 FPS sample at3470 particles. Performance regression relative to three-layer60FPS remains open. Native changes pass syntax but this six-layer native revision is not visually rechecked yet.

Clay requested three additional Fractal Nebula layers and 20% faster motion. Now six layers, alternating directions, scales .52 through 1.02, keeping the prior overall footprint. Target density doubled to3600 to preserve particles per layer. Preset speed .5 to .6; native fractal clock made proportional to speed to deliver the same 20% increase (other native effects untouched). Native depth spacing halved to avoid doubling the depth envelope. Cache tags fractal-bloom-4. Local only.

## September 11: Fractal Nebula split and resumed visual tuning

Clay requested breathtaking, mind-melting psychedelic beauty with a hypnotic feel; avoid equating that with frantic motion or promising trance induction. Original `fractal` is preserved unchanged numerically as **Prismatic Lace**, described as a rainbow micro-ring kaleidoscopic textile. New `fractalNebula` uses `fractalBloom`, native mode 14, with schema and geometry-menu entries. Inventory now 32 presets.

First implementation was blocked from browser testing by usage approval; access restored on user request. Initial 2D visual: chunky outer twigs, sparse trunks, 37 FPS sample. Rebalanced particles across branch generations, tapered twig thickness, and replaced repeated recursive tail calculations with reuse of the current branch skeleton. Then added three scaled counter-rotating layers (six arms per layer, six binary-tree generations). Count remains 1800 target; 1735 observed. Clear curved branching ribbons in violet/magenta/cyan, black gaps and evolving overlaps. Latest 2D HUD sample 60 FPS. Native desktop shows the layered branching form with beads/thinner tails, 60 FPS and no captured console errors. This is NOT equivalent material quality, headset validation, or creative approval. Dome untested for this preset.

Current cache: compositions, presets and native `fractal-bloom-3`; simulation `fractal-bloom-2`; schema `fractal-bloom-1`. Tests include finite/bounded samples, original fractal ID/settings retention, and branch-head/tail endpoint agreement; composition, URL/schema, foundation, kaleidoscope and syntax checks pass. No publish. Next: Clay reviews this visual direction, then Liquid Chrome split and continued native/dome audit. Do not call the whole audit finished.

## September 11: centered kaleidoscope and cached reflections

Clay approved the richer revisions as much better and authorized the next alignment investigation. Confirmed a missing translate(-cx,-cy) after the radial rotation/reflection: particles use absolute coordinates, so copies were offset. Added the missing translation; retained existing paths, IDs, counts, trail lengths, base pass and 1200-particle mirror cap. Existing saved settings benefit from this renderer bug fix, rather than requiring new preset IDs.

Visual check of the initial correction: Circuit Shrine now visibly centers its layered stepped symmetry, 60 FPS sample. Chakra Alignment reveals central emerald/indigo/gold symmetry but dropped to a 15 FPS sample with the corrected copies in view. Added a reusable DPR-sized transparent canvas: draw the mirror population once and blit each transformed copy. Chakra then sampled 55 FPS with 1157 particles, same count as the 15 FPS observation. This is an isolated comparison, not a benchmark. No captured console errors. Cache tag `kaleido-center-2`.

Fractal Nebula observed after centering but before buffer optimization: central radial motif with dense rainbow micro-rings, 60 FPS sample. Still not clear recursive geometry; original split/identity work remains open. Native 3D is untouched; dome inherits the source canvas but has not been visually rechecked for this patch. No headset test.

New `scratch/kaleidoscope_center_tests.js` exercises the actual reflection block with affine transforms for landscape/portrait/square sizes, spin on/off, outer scale/translation preservation, radius preservation and one source draw per mirrored particle. Passing, along with conduit continuity, meditation, foundation, URL/schema and syntax checks. Initial test harness needed CRLF normalization; fixed and rerun. No live publishing.

Remaining rendering limitations: existing spin affects copies but not the original base pass, mirror population caps differ from very dense base passes, and the cached source covers canvas bounds (offscreen marks are clipped). This patch fixes centering/performance without silently redesigning all kaleidoscope behavior. Check large-particle/rotated-edge cases in broader regression work.

## Creative correction — September 10

Clay rejected the first replacement batch and cleaned conduits as too boring. Earlier technical/visual checks below are not creative acceptance. Current iteration restores abundance: many nested conduit lanes with slow dimension changes, broader painterly counter-rotating mandala bands, traveling lattice streams with wave distortion, and five concentrated vortex currents instead of a uniformly populated disk. Same preset IDs and particle counts. Black cleanup and respawn continuity retained. Initial 2D Neon Conduits and Mandala Zen observations show much richer layers at 60 FPS samples. Current cache tag: living-presets-1. Nothing published; Clay's visual approval still required.

## Verified baseline

### September 11 creative-revision verification

- Latest renderer/compositions cache tags: `living-presets-2` (presets descriptions remain `living-presets-1`). Supersedes the first-batch appearance reports below; this is still awaiting Clay's creative approval.
- Quantum Grid in 2D now has explicit curved tails sampled over up to 2.6 simulation seconds, clamped to each cell traversal's age. Observed saturated pink/blue curved horizontal and vertical strands forming a loose waving fabric, rather than the previous isolated dots. Added regression coverage for finite, continuous tail samples at cell recycling boundaries.
- Native desktop checks: Quantum Grid is a rippling lattice of traveling beads; Mandala Zen has layered counter-rotating twelve-petal bands; Black Hole Vortex has multiple concentrated curved streams and a visible dark opening. No captured console errors. Native vortex HUD sample 60 FPS. Native trails are still thinner and more bead-like than the painterly 2D versions: not equivalent visual acceptance and not headset-tested.
- Circuit City 2D: many colorful overlapping compact stepped circuits, black separation between groups; 60 FPS sample. Conduit Cathedral: large layered vertical frames with traveling square heads and luminous junctions; 60 FPS. Circuit Shrine: abundant nested stepped tracks with rotated kaleidoscopic copies; 60 FPS. Shrine retains the existing off-center mirror layout, so its centered-description/mirror audit is still open. These are observations, not user approval.
- Continuity, composition math (including new tail-boundary test), conduit integration, URL/schema, foundation and black-decay checks pass. Both simulation files pass syntax checks. Diff whitespace check passes with only existing line-ending warnings.
- Local only. No commit, push or deploy. Broader inventory audit remains incomplete. Next: Clay reviews this richer direction; then continue remaining identity splits, mirror layout investigation, original native/dome inventory and headset validation.

- Authoritative checkout: `C:\Users\MadKing\.gemini\antigravity\scratch\eternal-veil`.
- Local HEAD and GitHub main both `584b299` on this date. Hub's `131ac98` headline is inconsistent; do not use it as deployment evidence.
- Initial worktree has untracked AGENTS.md, CLAUDE.md, PROJECT_STATUS.md; preserve these user/agent files.
- 28 presets, not the 60+ claimed in DEVELOPER_GUIDE.md.
- Preview restarted on http://127.0.0.1:8767/ (loopback only).
- Read project instructions, developer guide, F: hub protocol/handoff, and workspace ETERNAL_VEIL_PRODUCT_VISION_ROADMAP.md.

## Method and acceptance

Select full presets explicitly, stop Autopilot, allow parameter/palette transitions and old trails to settle. Observe successive animation frames. Check 2D, native 3D and dome separately. Desktop rendering does not verify a headset. No headset connected during initial inspection.

For each row record appearance, verdict, implementation and validation. Pending means not visually audited; source inspection alone is not a visual verdict. No rename or split is final until its relevant visual checks are complete.

| ID | Original name | Observations / verdict | 2D | Native 3D | Dome | Changes / remaining |
|---|---|---|---|---|---|---|
| breathSanctuary | Breath Sanctuary | In Meditate, centered blue/chakra-colored radial bloom follows the breathing guide; sparse fine streaks during Rest. No large bouncing circles observed. Flow-only selection previously wandered, as intended by mode condition. | Meditate Rest observed, 60 FPS sample; full cycle pending | Pending | Pending | Preserve; evaluate visibility through full cycle |
| ethereal | Ethereal Aura | Lavender/indigo wandering ribbons with persistent trails, not diffuse mist. Refine description. HUD 60 FPS sampled. | Initial settled observation | Pending | Pending | None |
| cosmic | Nebula Spark | Dense blue/lilac fine scribbled filaments; no distinct nebular formation. Similar to Cosmic Strings. HUD 54 sampled. | Initial settled observation | Pending | Pending | None |
| supernova | Solar Flare | Broad orange/pink/yellow curling streaks; fiery palette reads well, no actual solar source. Energetic. HUD 60 sampled. | Initial settled observation | Pending | Pending | Refine rather than literal astronomy |
| liquid | Liquid Chrome | Teal/green soft daubs with curling tails, not metallic. Candidate rename Jade Currents and create silver/reflective variant. HUD 60 sampled. | Initial settled observation | Pending | Pending | None |
| quantum | Quantum Grid | Settled view shows fine pink/blue/white wandering squiggles, no grid. Candidate split: preserve as Quantum Drift, author a real grid separately. | Initial observation | Pending | Pending | No changes yet |
| vortex | Black Hole Vortex | Purple/cyan loose curving threads across screen; no central gravity sink. Candidate split: Violet Undertow plus actual central vortex. HUD 60 sampled. | Initial settled observation | Pending | Pending | None |
| mandala | Mandala Zen | Multicolor daubs wandering without mirrored symmetry. Candidate split: Prism Drift plus real symmetrical mandala. | Initial settled observation | Pending | Pending | None |
| strings | Cosmic Strings | Dense thin blue/lilac tangled filaments; strings yes, direct streams no. Refine description. HUD 52 sampled. | Initial settled observation | Pending | Pending | None |
| hypno | Hypnotic Spiral | Recognizable luminous coil, large peripheral pendulum orbs. Thin diagonal streaks and beaded coil visible; two-orb claim too exact for stochastic population. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep concept, review trail artifacts |
| astralTangle | Astral Tangle | Dense overlapping cyan/lilac/pink threads with a circular swirl; name fits, six separate threads not readable. | Initial settled observation, 60 FPS sample | Pending | Pending | Refine description, preserve energetic tangle |
| tightTailVortex | Tight Tail Vortex | Thick green curving comet tracks circle central opening and extend beyond edges. Some bead texture remains. Strong identity. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep |
| paintedDepthSpiral | Painted Depth Spiral | Teal/emerald broad tapered brush ribbons overlap in clear vortex. Size/opacity layering gives depth impression. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep |
| aquatic | Aquatic Bubbles | Broad blue brush currents plus clear bubble rings. Very dense, but recognizable water palette and bubbles. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep; potential density polish |
| chakra | Chakra Alignment | Emerald/gold/indigo daubs, no clear central symmetry despite kaleidoscope enabled. Inspect mirror transform before deciding rename/split. | Initial settled observation | Pending | Pending | None |
| acid | Acid Rain | Dense vertically falling colored bead trails; hue changes visible. Name fits stylized rain. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep |
| fractal | Fractal Nebula | Very dense multicolor micro-rings fill screen like animated textile/static. No readable recursive form. | Initial settled observation | Pending | Pending | Candidate split; verify mirror bug |
| nebula | Cosmic Nebula | Giant colored fog patches and tiny bright stars. Identity fits, but gray/white overlap dominates and reduces contrast. | Initial settled observation, 43 FPS sample | Pending | Pending | Brightness/performance follow-up |
| oil | Impressionist Oil | Warm orange/ochre brush daubs with green accents. Painterly, although bristle texture is subdued by dense layering. | Initial settled observation, 60 FPS sample | Pending | Pending | Refine wording, preserve |
| cluster | Cosmic Organelles | Pink/cyan/white rounded capsules and trails; internal small dots visible on some heads, membranes not very readable. | Initial settled observation, 60 FPS sample | Pending | Pending | Refine description; investigate detail scale |
| oceanRain | Rain Ocean | Distinct lower wave band, thin falling rain, huge moons in dark sky. Strong match. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep |
| auroraCathedral | Aurora Cathedral | Tall pastel green/blue/pink curtains rise across screen. Clear match, dense brightness leaves little dark sky. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep; refine star claim |
| celestialOrrery | Celestial Orrery | Pearls/moons trace flattened central orbits. Clear orbit theme, many small overlapping tracks make it busy; no central sun. | Initial settled observation, 60 FPS sample | Pending | Pending | Refine radiant-center claim |
| lotusPulse | Lotus Pulse | Large rotating petal-wheel, off-center wandering bloom, peripheral orbs. Recognizable flower/vortex. | Initial settled observation, 60 FPS sample | Pending | Pending | Keep |
| neonConduits | Neon Conduits | Six stepped neon loops, glowing junctions. Original had unintended diagonal chords and respawn streaks. Local continuity fix removes chords. | Settled before/after, 60 FPS sample | Pending | Pending | Preserve name/effect; fixed route continuity |
| circuitCity | Circuit City | Fifteen compact stepped circuits in a regular array; distinct denser scale. Same original diagonal artifact. | Settled original, 60 FPS sample | Pending | Pending | Shared continuity fix; visual retest pending |
| conduitCathedral | Conduit Cathedral | Three tall monumental stepped frames, brighter and slower-looking than City. Same diagonal artifact. | Settled original, 60 FPS sample | Pending | Pending | Shared continuity fix; visual retest pending |
| circuitShrine | Circuit Shrine | Nested stepped circuits with kaleidoscopic offscreen copies, not simple squares. Original diagonal chords made it tangled. | Settled original, 60 FPS sample | Pending | Pending | Shared continuity fix; wording/mirror review remains |
| quantumGrid (new) | Quantum Grid | Ordered rows/columns of softly orbiting nodes; native view has small clusters at each node and a shallow ripple. | Settled, enlarged after first check | Settled desktop, 60 FPS sample | Pending | Native composition moved in front of camera; no headset check |
| mandalaZen (new) | Mandala Zen | Four centered twelve-lobed rosettes with slow rotation. Native version clearly preserves motif with luminous beads and layered depth. | Settled, enlarged after first check | Settled desktop, 60 FPS sample | Pending | Keep separate from preserved Prism Drift |
| blackHoleVortex (new) | Black Hole Vortex | Purple/cyan curves converge around an empty central aperture. Native framing now shows the full readable vortex rather than an oversized hole. | Settled, 60 FPS sample | Settled desktop, 60 FPS sample | Pending | Inward math checked; longer full-cycle visual watch remains |

## Known audit hazards

- Flow geometry-only selection is different from loading a complete preset.
- Transition frames can contain the preceding geometry; do not classify these as the new effect.
- UI automatically hides with inactivity; use current UI state before clicking.
- Existing user preview storage contains custom scenes/favorites; do not clear it.
- Developer guide has outdated file names and counts. Source and actual runtime win.
- Native shader currently maps only ocean/aurora/orbitals/lotus/pipes variants/spiral/pendulumSpiral. Other shapes use generic mode 0. This is source evidence of missing dedicated render paths, not a headset verdict.
- FPS figures above are isolated HUD samples, not benchmark averages.

## Implementation checkpoint

Three separate replacements added with new IDs: quantumGrid/quantumLattice, mandalaZen/zenMandala, blackHoleVortex/gravityWell. Preserved original quantum, mandala, vortex numeric settings and IDs; renamed those originals Quantum Drift, Prism Drift, Violet Undertow. New compositions have explicit native GPU modes 11/12/13 and URL schema/geometry-menu entries. Pending visual verification; do not publish yet.

Description-only refinements: Ethereal Aura, Nebula Spark, Solar Flare, Cosmic Strings, Hypnotic Spiral, Astral Tangle. No visual parameter changes to these originals.

Tests: existing foundation, URL/schema, color cycles, color theory, meditation, conduits, VR panel suites passed. New mathematical checks cover finite coordinates, bounded positions, twelvefold symmetry, inward motion, stable legacy IDs/values. These are not substitutes for visual acceptance.

## September 10 resumed checkpoint

- Description-only refinements also made to Impressionist Oil, Cosmic Organelles, Aurora Cathedral, Celestial Orrery. These are grounded in the 2D observations above; full cross-mode acceptance remains open.
- New conduit continuity tests exercise all four variants through 600 frames each, including repeated speed changes and respawns. Passing. Visual Neon Conduits after fix shows clean right angles without diagonal chords.
- Black-background-only cleanup subtracts one 8-bit code value after normal fading to remove permanent gray ghost trails. Colored backgrounds and Solid mode are untouched. Mathematical decay test passes. Settled Neon Conduits visually confirms clean black without the previous gray silhouettes and diagonal chords; 60 FPS sample. Broader device/performance coverage remains pending. This does not claim to solve all cloud overbrightness.
- Browser initially reused cached renderer code despite reload. Cache tags advanced to preset-audit-2; after refresh native mandala, grid, vortex all render recognizably. Verify loaded script versions when retesting.
- Latest foundation, URL/schema, meditation, VR panel, color cycle and color theory checks pass. No live publish or commit.
- New Black Hole Vortex dome check: enlarged curved streaks wrap around the viewer, but the central opening is not visible in the default forward view. Dome is a different, abstract presentation, not equivalent composition preservation. Native desktop framing is verified.

## Batch-one report for Clay

### What worked well
Rain Ocean is the clearest example of a name delivering its promise: rolling lower waves, falling rain, and enormous moons. The two recent painterly/comet vortices, Lotus Pulse, Aquatic Bubbles, and the four conduit variants have recognizable identities worth protecting. No original preset was deleted.

### What changed
The old Quantum Grid was loose wandering threads, so it is now Quantum Drift. The old Mandala Zen was colorful free-moving daubs, so it is now Prism Drift. The old Black Hole Vortex had no central sink, so it is now Violet Undertow. All three retain their original saved identifiers and settings.

Three separate presets now fulfill those original names: a visible node lattice, a four-ring rosette, and an inward-flowing vortex with a central opening. They have been visually checked in 2D and desktop native 3D. They still need full-cycle, alternate-palette, and headset acceptance.

Ten descriptions were rewritten to describe visible behavior rather than promise invisible features: Ethereal Aura, Nebula Spark, Solar Flare, Cosmic Strings, Hypnotic Spiral, Astral Tangle, Impressionist Oil, Cosmic Organelles, Aurora Cathedral, Celestial Orrery.

The conduit family had unintended diagonal streaks caused by speed changes and respawning; those causes are fixed. Neon Conduits has been visually rechecked, and the other variants have mathematical regression coverage but await the same visual follow-through. A black-background cleanup also removes lingering gray ghosts; it was visibly verified in Neon Conduits at a 60 FPS sample. Low-end/mobile performance and colored-background behavior still need broader checks.

### What is NOT finished
This is not the final comprehensive audit. All 28 originals have at least an initial 2D observation, but most original native 3D/dome rows remain untested. Breath Sanctuary was checked in Meditate through Rest and Exhale: centered breathing bloom, no large bouncing accents, changing chakra palette; full-cycle tracking remains open. Liquid Chrome, Chakra Alignment, and Fractal Nebula still need concept/renderer work. The kaleidoscope transform and native fallback geometry are important next investigations. No actual headset was available.

### Preview
http://127.0.0.1:8767/ — the three added presets are at the bottom of the Presets list. This is local only. Nothing has been committed, pushed, or published.

## September 18 — Veil Drift zoom/rotation composition pass (local, unpublished)

The released Veil Drift now rotates and breathes in as far as +75%, which magnifies intentional and unintentional empty centers. Explicit 2D preset selections were observed in the local browser after transitions settled, including changing zoom phases. This is not a native 3D, dome, or headset audit. The old inventory above predates several later releases; use the current Presets UI/source for names.

| Preset | Observed under 2D Veil Drift | Local action / verdict |
|---|---|---|
| Liquid Chrome | The broad metallic ribbons left an oversized dark aperture at zoom. | Three progressively smaller metallic folds now continue inward, preserving the 8–24 main-ribbon Flow range. Visually checked after reload: detailed central knot and outer silhouette. High-density sample displayed 18 FPS once; performance remains a concern, not a benchmark result. |
| Rain Ocean | The lower wave band could rotate out of the central crop, leaving rain, dark sky, and huge moons. | Redistributed some existing wave particles into a quieter midground band. Reduced moon frequency and scale slightly, and changed this directional world's camera rotation to a gentle ±27.5° rock instead of a full revolution, preserving its sea/sky horizon. Settled desktop view checked after reload; remains worth reviewing through more palettes and Flow densities. |
| Tight Tail Vortex | Outer-biased seeding produced a large empty aperture at the zoom peak. | Seed radii now distribute more particles toward smaller orbits and ease singularity repulsion. Visually checked after reload: inward comet tracks reach toward a compact opening while keeping full-screen outer swirl. |
| Painted Depth Spiral | Similar outer-biased seed left a sparse center. | Same inward population strategy, tuned independently. Settled desktop check shows inner brush currents approaching a smaller dark opening. |
| Celestial Orrery | Orbit tracers and moons already pass through the center; does not read as an empty donut. | Preserve. One desktop view checked, not full palette/device coverage. |
| Mandala Zen | Eleven rosettes already include delicate inner layers; small central aperture is framed by dense petals at zoom. | Preserve. Two zoom phases checked in desktop 2D. |
| Black Hole Vortex | Dark gravitational center is the visual concept. | Deliberately preserve its void rather than applying generic center fill. Earlier desktop observations in this audit; no new full-cycle check. |

This is a targeted first pass, **not** a claim that all 32 presets and every Flow permutation have been checked. Next: sweep the remaining named presets across the 15-second zoom cycle, test high/low density and colors, and investigate Liquid Chrome's heavy-frame cases. Tests: Chrome ribbon geometry/count, foundation, Flow inventory, authored composition mathematics, and simulation syntax passed. No live push requested.

## September 18 — Flow symmetry frequency (local, unpublished)

Clay requested more naturally occurring kaleidoscope and spinning mandala moments. Flow previously gave Mandala Zen one uniform geometry slot, while kaleidoscope and its spinning axis were independently and very rarely enabled. Mandala Zen now has three weighted slots in Serene and four in Alive/Wild; every other geometry remains selectable, consecutive repeats are avoided, and excluded presets are removed from the candidate pool. On eligible general particle geometries, kaleidoscope is deliberately sampled per shift (24% Serene, 38% Alive, 46% Wild), and a selected kaleidoscope can spin (55%, 72%, 80% respectively). Directional and self-authored scenes retain their own composition. Manual locks and Comfort Mode remain authoritative. Flow caps the particle target and segment count during mirrored scenes to mitigate rendering cost.

The local browser's 5-second QA cycle naturally selected Mandala Zen repeatedly and produced a `drop` scene with kaleidoscope and spin both enabled. The interval was restored to 20 seconds afterward. This confirms selection behavior, not full visual or hardware acceptance. Occasional low-FPS warnings appeared during rapid cycling, including on authored scenes; diagnose with settled, representative scenes before publishing. Tests: new 10,000-shift-per-personality selection coverage, excluded-Mandala regression, Flow inventory, kaleidoscope math, and syntax passed. No live push requested.

## September 18 — geometric kaleidoscope follow-up (local, unpublished)

Clay noted that grids and circuits can look especially good with kaleidoscope/mandala axes. The first Flow symmetry set had inadvertently excluded these. Added Quantum Grid plus Circuit City, Conduit Cathedral, and Circuit Shrine as curated eligible geometries. On their Flow turns, kaleidoscope is sampled at least 58% of the time (unless Comfort Mode or a manual lock says otherwise), with 4/5/6/8 folds to avoid overloading detailed line work. Their authored density is not reduced to the generic mirrored-particle target, since that could break line continuity. Softer kaleidoscope geometry now samples 4/5/6/7/8/10 folds. The normal neon conduit remains unmirrored to keep its free-traversing identity.

Reference direction: [Desmos three rotating axes](https://www.desmos.com/calculator/rnsccfmhk8) and [Zen Math Art video](https://www.youtube.com/watch?v=roWrlXIjDek). The Desmos graph demonstrates varying rotational-speed and axis-length ratios, producing evolving multi-petal line mandalas. That is **not yet implemented** as independent multi-axis geometry; current work varies the existing kaleidoscope fold count around preserved source compositions. A separate, deliberately authored ratio-driven composition is the next creative step, rather than stacking more full-frame reflections over dense circuits.

Local 5-second Flow QA observed Conduit Cathedral with both kaleidoscope and spin selected automatically. It was not held long enough for an aesthetic/performance acceptance judgment; an additional 45-second sample did not land on another geometric kaleidoscope. The preview interval was restored to 20 seconds. Tests: Flow selection/exclusions, geometric eligibility guards, kaleidoscope math, foundation, and syntax pass. Low-FPS warnings during fast cycling persist in multiple patterns (not isolated to geometric symmetry); investigate before release. No commit/push/live change.
