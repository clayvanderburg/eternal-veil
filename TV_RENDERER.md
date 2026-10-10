# TV renderer (WebGL) — plan

Goal: Eternal Void as a product on TVs (Fire TV, Android/Google TV, LG webOS, Samsung Tizen)
with the full look: native resolution, full particle counts, every scene in Flow.
The 2D canvas renderer can't do that on TV hardware; a GPU renderer can.

## Evidence (Fire TV Stick 4K Max, PowerVR GE9215, 1080p @ 50 Hz, Amazon WebView 138)

| | 2D canvas (today) | WebGL spike (`tools/tv-gl-spike.html`) |
|---|---|---|
| Particles at a steady 25 fps, native 1920×1080 | ~300–600 | **5,000** (kaleidoscope on) |
| 3,000 particles + kaleidoscope | — | 50 fps (display max) |
| Kaleidoscope | ~6 screens of blending per frame | mirrored triangles: ~free |
| JS per frame | most of the frame (one canvas call per shape) | 4–9 ms (physics only) |

Why the canvas loses: every particle is several JS→canvas calls (ellipse/fill/save/restore)
on a 32-bit Cortex-A55 core, and the kaleidoscope blends ~6 full screens. Tried and
rejected inside the canvas renderer: disc-sprite stamping (2× slower), wedge clipping (slower).
What remains after moving to WebGL is JS physics, which grows with particle count; that moves
to a worker (the Stick has 4 cores; the page uses one).

## Architecture

- `js/tvgl/` — new renderer, separate from the 2D `js/simulation.js` (which stays the
  desktop/phone renderer until the GL one matches it everywhere).
- **State as typed arrays** (x, y, vx, vy, life, size, colour index…) so the same
  physics can run on the main thread or in a worker.
- **Worker + OffscreenCanvas**: physics *and* WebGL rendering run in a worker; the main
  thread keeps UI, music analysis and Flow decisions and sends settings changes as
  messages. Fallback: same code on the main thread where OffscreenCanvas/WebGL2 is missing.
- **Passes**: trail fade (ping-pong framebuffers, time-corrected like today) → instanced
  particles (one draw per shape family; shape in the fragment shader) → authored effects →
  kaleidoscope as a mirrored mesh (rings, folds, spin = more triangles, still cheap) →
  present.
- Frame pacing and the quality governor from `js/device-mode.js` carry over; with the
  GPU renderer they should rarely need to step down.

## Phases (each verified on the Stick with the soak/bench scripts and reviewed by Clay)

1. **Core**: worker + OffscreenCanvas, typed-array physics ported from `Particle.update`,
   trails, default `ellipse` particle, kaleidoscope mesh (single ring). Side-by-side page:
   canvas vs GL for the same preset/seed.
2. **Particle shapes**: drop, ring, brush, star/sprite shapes (`js/particle-sprites.js`),
   lit orbs, glow modes; per-preset look checks in Studio.
3. **Authored effects** (`drawAuthoredEffect`: mandala zen, circuits, conduits, lotus…).
4. **Module scenes**, one at a time: Mandelbrot (already GL), Stellar Nursery, Molecular
   Dance, Celtic Current/Knotwork, Cymatic Resonance, Liquid Chrome, Supernova, Fractal
   Nebula — these come back into TV Flow as each one passes.
5. **Switch-over**: TV uses `js/tvgl/`; the TV Flow skip list empties. Later, phones and
   desktop can opt in (battery/heat win), only after Studio side-by-side review.
6. **Platforms**: Fire TV (done), Android/Google TV (same APK, leanback), LG webOS (IPK of
   the same web app), Samsung Tizen (.wgt). Store submissions.

## Status

**Phase 1 (core) — done. Clay approved the look on the TV (2026-10-09: "much better"), and it
is wired into TV mode** (`js/tvgl/tv-mode.js`, loaded by device-mode.js on TV only): scenes whose
shape is in `TvGLCore.SUPPORTED_SHAPES` draw on the GPU; everything else stays 2D, with a
0.7 s cross-fade at each switch. In Flow, most scenes use other shapes, so Phase 2 is where most
of the gain is.
`js/tvgl/core.js` (physics port, renderer, pacer), `js/tvgl/worker.js` (OffscreenCanvas
worker), `js/tvgl/host.js` (page API, page fallback), `tools/tvgl-compare.html`
(side by side / GL only / 2D only). `scratch/tvgl_core_tests.js` (in the release and mobile
gates) checks the ports against `js/simulation.js`: noise, curl and kaleidoscope rules are
identical, flow physics follows `Particle.update` step for step, and the kaleidoscope mesh maps
screen → scene like the stamped slices.

Full screen on the Stick at native 1920×1080, 100% of each preset's particles:

| Preset | 2D canvas | GL (worker) | GL work/frame |
|---|---|---|---|
| Ethereal Aura (1,036) | 19 fps | 25 fps steady | 3 ms |
| Cosmic Strings (2,590) | 8 fps | 25 fps steady | 17–19 ms |
| Chakra Alignment (888) | 22 fps | 25 fps steady | 7 ms |

Known differences: the GL engine allows a 3.6/60 s step (the 2D renderer caps at 2/60 s, so
at 25 fps 2D motion and trail fade run ~17% slow, and much slower when 2D drops to 8 fps).
Not yet in GL: MusicMoods steering and treble sparkles, mouse/paint forces, meditation scaling.

## Rules

- Presets keep their look: every ported preset gets a side-by-side canvas/GL check and
  goes live only through a Studio-reviewed PR (AGENTS.md).
- Measure on the device: Eternal Void Dev app + `adb reverse tcp:8831 tcp:8831`, DevTools
  protocol over `adb forward` (see the eternal-void-tv README and hub log 2026-10-09
  firetv-app).
