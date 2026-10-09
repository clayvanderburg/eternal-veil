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

## Always in sync with the live site

The preview runs from Studio's own copy of the site (`.studio/preview`, git-ignored), not from
this folder, so it never depends on which branch an agent has checked out here. In live mode
that copy follows GitHub `main` (checked every 20 seconds); if the live site moves on while
Studio is open, a "Reload Studio" notice appears and your drafts are kept.

## Reviewing new presets before they go live

New presets and music changes from Claude or Codex arrive as pull requests. **Previewing** at
the top lists every open pull request that touches presets, music cards or the song list.

1. Pick one. The preview runs that pull request's code; its new presets are marked ★ NEW and
   come first. "was" now means that pull request's version.
2. Tune and Save as usual (drafts are kept separately per pull request).
3. **Add N drafts to pull request #…** puts your tuning on that same pull request (it never
   force-pushes; if the PR changed meanwhile, reload and save again).
4. **Mark reviewed** adds the `studio-reviewed` label on GitHub. Merge when you're happy.

Pick **Live site** to go back to tuning what is already live.

## Music playlists tab

The site's built-in music: every visitor sees these playlists in the music player.

- Drop songs on the Songs box (or click it). MP3s are kept as they are; WAV, FLAC, OGG, M4A,
  AIFF and Opus are converted to 192 kbps MP3 with ffmpeg. New songs join the selected playlist.
- Rename a song by editing its title. ▶ previews it. ✕ removes it from the site (and every playlist).
- Playlists: New, Rename, Make first (the music button plays the first playlist), Delete,
  ▲/▼ to reorder songs, Add song to put an existing song in.
- Edits save as a draft automatically ("Music playlists" chip). Publish sends them with any
  scene drafts in the same pull request; songs go to `audio/library/`, the list to
  `js/music-catalog.js`. Uploads wait in `.studio/uploads/` (git-ignored) until then.
- Needs ffmpeg/ffprobe on PATH (or `FFMPEG_PATH` / `FFPROBE_PATH`).

Flow centres each scene on its preset values (with the personality's small variation), so
what you tune is what Flow shows. `STUDIO_DRY_RUN=1` exercises Save without pushing.
Requires the GitHub CLI signed in as the repository owner.
