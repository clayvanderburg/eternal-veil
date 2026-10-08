# Visual Playlists

Ordered preset playlists that play on their own, optionally paired with one or two
color playlists. Built for long viewing and for recording composed videos.

Code: `js/visual-playlists.js` (model, playback, UI), `playlists.css`, and a small
bridge in `js/app.js` (`applyPlaylistScene`, the `VisualPlaylists.init` host, and
`takeover` hooks). Tests: `scratch/visual_playlists_tests.js` (in the release gate).

## Where it lives

- **Cosmic Console → Playlists**: create, rename, duplicate, delete; add presets from
  Favorites or All (swatch previews); reorder with ↑/↓ or drag (desktop); ⧉ repeats an
  entry right after itself (intentional repeat); × removes. Excluded presets cannot be
  added, and entries excluded later are shown dimmed and skipped.
- **Compact bar** (bottom-left; bottom of the screen on phones, above the control row and
  above a collapsed music player): playlist, position, current → next, color playlist,
  Prev / Play-Pause / Next / Repeat / Shuffle / Stop, progress. It appears only while a
  playlist session exists, and fades with the existing idle fade and Hide controls.
- Saved in this browser (`localStorage` key `eternalVoidVisualPlaylists`), like favorites
  and saved scenes. A first visit seeds the demo; deleting it is respected ("Restore demo").

## Playback modes

| Mode | What happens |
|------|--------------|
| **Flow within playlist** | Moves only through the playlist. Each preset arrives near its own values; while it holds, its settings re-roll every `clamp(hold/2, 10 s, 40 s)` around those values. The spread follows the Flow personality (Serene ±12 %, Alive ±20 %, Wild ±28 %, weighted per setting: zoom ×0.3, dissipation ×0.4, density ≤ +10 %). Zero stays zero; shape, lighting and kaleidoscope segments never change. |
| **Preset sequence** | Each preset's exact saved values, held steady until the next transition. |

Timing is two sliders: **Each preset stays** (10 s–10 min) and **Transition takes**
(2–60 s), with a plain summary ("holds 45 s, then glides 10 s… One pass: 7 min 20 s").
Advanced → per-preset hold overrides. Repeat: Loop / Repeat one / Play once (ends and
holds the last preset). Shuffle reshuffles each pass and avoids back-to-back repeats and
re-opening a pass with the preset that just ended.

## Colors

- **Preset colors**: each preset's original palette fades in with its transition.
- **Color playlists**: one or two of the existing color playlists (Cyberpunk, Seasons,
  Candy Pop, Goth/Shadow, Ocean Calm, Chakra/Aura, Psychedelic, My Library). With two:
  **Alternate** (one palette from each in turn) or **Combine** (all palettes pooled and
  shuffled into one rotation). Own clock: **Change colors every** and **Color fade**,
  independent of preset timing. An empty source (e.g. an empty My Library) falls back to
  the other playlist or to preset colors. The Colors tab and its library are unchanged.

## Transitions

Numeric settings (speed, curl, density, dissipation, zoom, size, stretch, rotation,
wobble, and preset-specific fields like spirals and eclipses) glide over the whole
transition with the existing smootherstep morph. Shape, lighting, kaleidoscope and the
optional switches cannot be interpolated, so they switch once, at 45 % of the transition,
under a **trail dissolve**: the outgoing frame is held in the canvas and released on a
smooth curve, only where the scene's own trails would otherwise erase it too fast. Its
length covers the incoming scene's trail build-up, so the switch doesn't dim. It is drawn
into the canvas, so recordings include it. Any numeric preset field the simulation knows
by name is carried too (e.g. future `vortexHole`).

Measured (headless Chrome, mean frame luminance sampled every 100 ms): no black frames
and no overshoot above the incoming scene's own level. Liquid Chrome → Cosmic Nebula
went from 109 to a settled 62, never below 51.

## Manual takeover, Comfort Mode, exclusions

- Picking a preset, turning on Flow (toggle or HUD lock), the dice, config history or a
  saved scene **pauses** the playlist. A toast and an amber bar say what took over
  ("Solar Flare took over. Resume to continue at Cosmic Nebula."). Resume glides back
  into the current entry. Stop restores Flow if it was on before Play.
- Playing a playlist turns Flow (autopilot) off quietly. Slider tweaks last until the
  next preset.
- **Comfort Mode**: transitions ≥ 6 s, color fades ≥ 6 s, color changes ≥ 15 s, the app's
  Comfort caps on speed, density, size, stretch, rotation and wobble, and no color
  inversion, morphing background or spinning kaleidoscope.
- **Excluded presets** are skipped, including ones excluded mid-play.

## Recording

- Recordings and captures contain only the canvas: no controls, bar or toasts.
- The canvas renders at the window's size × device pixel ratio (e.g. 1170 × 2532 on a
  390 × 844 @3× phone). Portrait output comes from a portrait window or device rendering
  natively. Nothing is cropped from landscape and enlarged. The Playlists tab shows the
  live canvas size.
- **Limitation, unchanged:** the built-in recorder (`js/exporter.js`) captures 30 fps
  WebM and **stops at 60 s**. Long playlist videos currently need an external canvas or
  window recorder (e.g. OBS) with controls hidden. Lifting the cap safely (chunked
  writes, memory, bitrate, fps choice, file size) is separate work.

## Demo: "Night Voyage"

Cosmic Nebula → Nebula Spark → Stellar Nursery → Aurora Cathedral → Celtic Current →
Mandala Zen → Chaotic Spiral → Lotus Pulse, then loop. Flow within playlist, 45 s hold,
10 s glide (7 min 20 s per pass), **Ocean Calm** colors every 40 s with a 15 s fade.

Why it works:
- **Structure alternates field and centre**, so each glide hands one structure to a
  related one. Diffuse cloud becomes sparks, then filaments with newborn stars, then
  drifting curtains, then braided currents. The slowest scene, the Mandala Zen bloom, is
  the centrepiece. It unwinds into Chaotic Spiral and settles into Lotus Pulse's soft
  vortex, whose dark field opens back into the cloud when the loop closes.
- **Calm scenes only**: no color inversion and no flashing.
- **One color world**: Ocean Calm's four palettes (aqua, seafoam, deep blue, coastal
  breeze) read well on every scene.
- **Offset clocks**: colors change every 40 s against a 55 s preset cycle, so palette
  fades drift across scenes instead of landing on every geometry switch.

Second color playlists tested against this sequence and rejected:
- **Chakra/Aura**: its root and sacral reds turned the nebula crimson.
- **Cyberpunk**: its yellows made confetti frames on Celtic Current and Aurora.
- **Candy Pop**: its pastels accumulate to grey on low-dissipation nebula scenes.

Prism Drift was replaced by Chaotic Spiral, which is stronger at that point.

## Known limitations

- Previews are palette swatches, not rendered thumbnails.
- Drag reordering is desktop-only; ↑/↓ work everywhere.
- The geometry switch reveals the new scene's own camera framing (Rain Ocean rocks
  instead of rotating). The dissolve softens this but does not morph framing.
- Playlists play in the 2D view only. Preset audio flags (bilateral/ASMR) are not
  changed by playlists.
- Playback time advances only while the tab is visible and the simulation is not paused.
- With the music player expanded on a phone, it covers the bar (by design: the bar
  returns when the player is collapsed).
