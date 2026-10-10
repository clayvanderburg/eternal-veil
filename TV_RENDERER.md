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

## Rules

- Presets keep their look: every ported preset gets a side-by-side canvas/GL check and
  goes live only through a Studio-reviewed PR (AGENTS.md).
- Measure on the device: Eternal Void Dev app + `adb reverse tcp:8831 tcp:8831`, DevTools
  protocol over `adb forward` (see the eternal-void-tv README and hub log 2026-10-09
  firetv-app).
