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

- Kept presets with new custom shapes:
  - `liquid` (Jade Currents): transverse wave ribbons with calligraphic brushstrokes (`jadeCurrents`).
  - `quantum` (Quantum Drift): probability cloud nodes with entanglement lines (`quantumDrift`).
  - `mandala` (Prism Drift): crystalline diamonds & triangles with independent random rotation (`prismDrift`).
- Rolled back all other audited presets (`breathSanctuary`, `ethereal`, `cosmic`, `supernova`, `vortex`, `strings`, `hypno`) to baseline `0d324d2` parameters and simulation code.
- Autopilot paused automatically when selecting a preset during audit.
- Global speed slider range updated to [0.00, 4.00] with step 0.01 for micro-slow adjustments.
- All core test suites in `scratch/` passing 100%.
- `node_modules/` and `chrome-profile/` are local — don’t treat as source of truth for handoffs.

## Next

Follow hub `STATUS.md` for what’s hot; coordinate via agents-hub.
