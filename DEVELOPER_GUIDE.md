# ETERNAL VOID — Project Brief & Developer Guide

> **Last updated:** 2026-07-18 by Antigravity (+ Hermes handoff paths 2026-07-17 Naela)  
> **Live at:** [eternalvoid.io](https://eternalvoid.io) / [eternal-void.netlify.app](https://eternal-void.netlify.app)  
> **Repo:** `github.com/clayvanderburg/eternal-veil` → deploys to Netlify  
> **Owner:** Clay Vanderburg (MadKing)

---

## Multi-agent handoffs (Codex / Antigravity / Hermes / Grok)

| What | Where |
|------|--------|
| **Dated handoffs** | `Y:\grok-shared\agents-hub\log\` (or `\\BB8\grok-shared\agents-hub\log\`) |
| **Name pattern** | `YYYY-MM-DD-<agent>-eternal-veil-*.md` |
| **Project desk** | `Y:\grok-shared\agents-hub\projects\eternal-void\README.md` |
| **Rolling status** | `Y:\grok-shared\agents-hub\STATUS.md` |
| **Code root** | this folder (`…\scratch\eternal-veil`) |

**Hermes:** MCP filesystem is **read+write** on this code root and the full agents-hub at `//BB8/grok-shared/agents-hub` (not personal `me.md` / global MEMORY). Prefer UNC for hub writes — `Y:\` often Access Denied. After MCP reload (`/reload-mcp` or new chat), read newest `log/*eternal*` notes first, then write handoffs + STATUS updates the same as other agents.

After non-trivial work, leave a short log file so the next agent is not blind.

---

## What Is This?

**Eternal Void** is a browser-based generative particle art visualizer. It's a single-page app (pure HTML/CSS/JS, no build step) that renders an ambient, interactive cosmic simulation.

Key features:
- **WebGL particle simulation** — thousands of particles flowing in real-time
- **Autopilot engine** — smoothly morphs between visual states automatically
- **Style Presets** — curated full-configuration snapshots (60+ presets in `js/presets.js`)
- **Color Playlists** — themed color cycles (cyberpunk, ocean, chakra, etc. in `js/color-cycles.js`)
- **Music Reactivity** — optional real-time audio analysis that modulates the simulation
- **HUD** — on-hover overlay with live diagnostics, quick lock/favorite/ban controls
- **Meditation Mode** — slow, breathing-guided experience with special presets
- **Kaleidoscope / VR / 3D** modes (experimental)
- **My Theme Library** — user-saved custom color swatches
- **Cosmic History** — undo/redo navigation across simulation state changes

---

## File Map

```
eternal-veil/          ← project root (named before rebrand, don't rename the folder)
├── index.html         ← entire UI — all panels, HUD, controls live here
├── styles.css         ← all styling (2400+ lines, no framework)
├── js/
│   ├── app.js         ← central controller (~3800 lines) — state, events, Autopilot logic
│   ├── sim.js         ← WebGL particle simulation engine
│   ├── presets.js     ← StylePresets object (~660 lines), all 60+ presets defined here
│   ├── color-cycles.js← ColorCycles engine + playlist definitions (cyberpunk, seasons, etc.)
│   ├── state-schema.js← StateSchema validator — validates/clamps loaded configs
│   ├── sim3d.js       ← Optional 3D renderer
│   └── *.test.js      ← Jest unit tests
├── DEVELOPER_GUIDE.md ← this file
└── netlify.toml       ← custom domain + redirect config (eternalvoid.io)
```

---

## Key State Variables (app.js)

| Variable | Type | Purpose |
|---|---|---|
| `isAutopilot` | Boolean | Whether Autopilot engine is running |
| `flowPersonality` | String | `"serene"` / `"alive"` / `"wild"` — Autopilot aggression |
| `activeColorCycle` | String | Active color playlist key (e.g. `"cyberpunk"`, `"random"`) |
| `lastPresetKey` | String | Currently active preset key (null if released) |
| `favoritePresetKeys` | Set | User's starred presets (persisted to localStorage) |
| `excludedPresetKeys` | Set | User's banned presets — never auto-selected (persisted) |
| `sim.palette` | Array | Active 5-color hex palette, e.g. `["#ff00ff", ...]` |
| `sim.settings` | Object | All simulation parameters (speed, turbulence, density, etc.) |

---

## Core Functions (app.js)

| Function | Purpose |
|---|---|
| `toggleAutopilot(state)` | Enable/disable autopilot. Also syncs HUD lock icon. |
| `loadPreset(key)` | Smoothly morphs all parameters to a preset. Updates HUD. |
| `releaseActivePreset()` | Releases the active preset lock, returns to freeform flow. |
| `buildPresetCards()` | Re-renders the Presets sidebar. Respects favorites/excluded. |
| `updateActivePalette(palette)` | Updates colors + music-reactivity cache + HUD swatches. |
| `updateActiveSetting(key, val)` | Updates a sim parameter + music-reactivity cache. |
| `randomizeAllParameters()` | Autopilot drift — never picks excluded presets. |
| `startPaletteMorph(palette, ms)` | Smoothly morphs current colors to a new palette. |
| `updateHudPresetName(key)` | Updates HUD preset label and ban button state. |
| `updateHudColorSwatches(palette)` | Renders live color swatches in the HUD. |
| `setFlowPersonality(name)` | Sets Autopilot personality + updates HUD. |
| `showToast(msg)` | Displays a brief notification. |

---

## HUD Controls (on-hover overlay)

The HUD appears when the user moves their mouse over the canvas. It shows:

1. **PRESET row** — Active preset name + 3 buttons:
   - `⊘ Ban` — Exclude this preset from Autopilot. Red glow when active. Also appears in sidebar.
   - `★ Star` — Favorite the preset. Pushes it to top of sidebar. 
   - `🔓 Lock` — Freeze/unfreeze Autopilot.

2. **COLORS row** — 5 live color swatches (circles) + 2 buttons:
   - `★ Star` — Saves current 5 colors to "My Theme Library"
   - `🔓 Lock` — Toggles color cycling on/off independently from pattern Autopilot.

---

## Autopilot Architecture

The Autopilot runs two independent intervals:
- **Pattern interval** (`autopilotTimer`) — calls `randomizeAllParameters()` periodically
- **Color interval** (`autopilotColorTimer`) — cycles through the active color playlist

Both intervals are controlled by `startAutopilotIntervals()` / `stopAutopilotIntervals()`.

The color cycling checkbox (`autopilotColorToggle`) can be unchecked to freeze colors while keeping pattern morphing active.

---

## Preset Sorting (in sidebar)

Presets are sorted in this order:
1. **Favorited** (starred ★) → top
2. **Normal** → middle
3. **Excluded** (banned ⊘) → bottom, dimmed out

Excluded presets appear grayed out but can be un-banned. The Autopilot's random drift will never land on an excluded preset.

---

## Domain & Deployment

- **Primary:** `eternalvoid.io` (Cloudflare DNS → Netlify)
- **Legacy redirect:** `eternal-void.netlify.app` → `eternalvoid.io`
- **Deployment:** auto-deploys on push to `main` branch via Netlify
- **No build step** — it's raw HTML/CSS/JS, Netlify just serves static files

---

## Integration Checklist (Adding New Features)

### New Slider / Control
1. Add element to `index.html` with a unique ID
2. Register in `flowableOptions` in `setupFlowToggles()` in `app.js`
3. Add key mapping in `inputToKeyMap` for manual override detection
4. Bind listener using `bindSlider` or manually in `app.js`
5. **Always** update via `updateActiveSetting(key, value)` — never `sim.settings[key] = x` directly
6. Add to `randomizeAllParameters()` inside an `if (isFlowEnabled(key))` guard

### New Preset
- Add to `StylePresets` in `js/presets.js`
- Include all required fields: `name`, `desc`, `speed`, `turbulence`, `curl`, `density`, `dissipation`, `zoom`, `size`, `sizeVar`, `stretch`, `interaction`, `rotationSpeed`, `wobble`, `colors` (array of 6 hex strings), `particleShape`, `particleLighting`, `psychedelicMode`, `morphingBg`, `spinningKaleido`, `kaleidoscopeEnabled`, `bilateralEnabled`, `asmrEnabled`

### New Color Playlist
- Add to `window.ColorCycles.themes` in `js/color-cycles.js`
- Add a button in `index.html` with `data-cycle="yourKey"`
- Add a description entry in the `cycleDescriptions` map in `app.js`

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `eternalVoidHistory` | Config undo/redo history |
| `eternalVoidFavoritePresets` | Starred preset keys array |
| `eternalVoidExcludedPresets` | Banned preset keys array |
| `eternalVoidColorCycle` | Last active playlist key |
| `eternalVoidBreathingRhythm` | Meditation breathing rhythm |
| `eternalVoidSwatches` | Custom saved color swatches |

---

## Tests

Run with:
```powershell
node scratch/color_cycles_tests.js
node scratch/color_theory_tests.js
node scratch/meditation_mode_tests.js
node scratch/url_tests.js
```

All 4 test suites must pass before pushing. They run without a browser (pure Node.js).
