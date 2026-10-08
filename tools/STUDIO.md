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
   "was …" always shows what is live on eternalvoid.io (GitHub `main`).
2. Adjust Motion, Particles, Kaleidoscope (including Flow chance and segment range),
   scene-specific settings and Colors. Each value Flow varies has a cyan Flow line: auto
   (preset ± personality variation) or an exact range. ↺ resets one value to live.
3. Music reaction edits the shared card for the preset's shape. Start music in the preview
   (Show site controls → ♫) to see it.
4. Save keeps the preset as a draft (stored in this browser; survives reloads). Repeat for
   as many presets as you like; drafts show as chips (click to reopen, × to discard).
5. Publish sends every draft as ONE pull request (written into a fresh copy of `origin/main`
   on a `studio/…` branch). Ask Claude to merge it; merging publishes. Published-but-not-
   merged changes stay visible as "waiting to be merged" until the live site has them.

Flow centres each scene on its preset values (with the personality's small variation), so
what you tune is what Flow shows. `STUDIO_DRY_RUN=1` exercises Save without pushing.
Requires the GitHub CLI signed in as the repository owner.
