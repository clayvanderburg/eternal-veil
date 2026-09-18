# Eternal Veil / Void — project status

**Updated:** 2026-09-18  
**Path:** `C:\Users\MadKing\.gemini\antigravity\scratch\eternal-veil`  
**Live:** https://eternalvoid.io  

## What it is

Browser-based immersive visual / meditation / music-reactive experience (2D + 3D paths, presets, color systems, VR-related experiments).

## Working now

- Core app + simulation modules under `js/`  
- Developer guide: `DEVELOPER_GUIDE.md`  
- Scratch tests under `scratch/` (all 8 test suites passing 100%)  
- Multi-agent history in agents-hub logs  
- Presets overhauled according to Clay's audit: calibrated speeds, independent prism rotation, nebula cloud lifecycles, eclipsed sun coronas & solar flares, and opposing hero orbs

## Agent notes

- Presets audited and tuned with zero freestyling:
  - `breathSanctuary` (lotus): 2 opposing hero orbs rocking in unison along perimeter, petals 50% slower.
  - `ethereal`: natural flow, no custom shape, speed 0.20, size 2.5, 6-segment kaleidoscope.
  - `cosmic` (Nebula Spark): clouds cycle through small/dense/dark -> bright explosion spark -> disperse & fade, alongside fine curling sparks.
  - `supernova` (Solar Flare): constellation of 6 eclipsed suns (black discs with fiery coronas) + flares bursting off them.
  - `liquid` (Jade Currents): transverse wave ribbons with calligraphic brushstrokes.
  - `quantum` (Quantum Drift): probability cloud nodes with entanglement lines.
  - `mandala` (Prism Drift): crystalline diamonds & triangles with independent random rotation.
  - `vortex` (Violet Undertow): primary deep undertow vortex + secondary vibrant electric wavy spiral.
  - `strings` (Cosmic Strings): natural curl flow with extreme stretch (6.5), low dissipation, high density, and 8-segment kaleidoscope.
  - `hypno` (Hypnotic Spiral): dual pendulums swinging along tightly bounded 8-turn spiral.
- Autopilot paused automatically when selecting a preset during audit.
- Global speed slider range updated to [0.00, 4.00] with step 0.01 for micro-slow adjustments.
- `node_modules/` and `chrome-profile/` are local — don’t treat as source of truth for handoffs.

## Next

Follow hub `STATUS.md` for what’s hot; coordinate via agents-hub.
