# Eternal Void Studio

Local tuning tool for presets and their music reactions. It previews the real site and turns
your changes into a pull request, so nothing reaches eternalvoid.io until you merge it.

## Run

```
node tools/studio-server.mjs
```

Open http://127.0.0.1:8820/tools/studio.html (local only; the server refuses other hosts).

## Use

1. Pick a preset. The preview switches to it and holds your values while you drag.
2. Adjust Motion, Particles, Kaleidoscope, scene-specific settings and Colors. Speed and
   dissipation sliders are logarithmic for fine control at the slow end; type exact values
   in the boxes. Changed values turn amber and show the old value.
3. Music reaction edits the shared card for the preset's shape. Start music in the preview
   (Show site controls → ♫) to see it.
4. Save as pull request: the server writes only the changed values into a fresh copy of
   `origin/main`, commits on a `studio/…` branch, pushes it and opens a PR. Merge it on
   GitHub to publish. Your working folder is never edited.

Flow centres each scene on its preset values (with the personality's small variation), so
what you tune is what Flow shows. `STUDIO_DRY_RUN=1` exercises Save without pushing.
Requires the GitHub CLI signed in as the repository owner.
