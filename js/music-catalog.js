/* Built-in music: every song the site ships and the playlists everyone sees.
   Eternal Void Studio (Music tab) rewrites the CATALOG block below; keep it plain JSON. */
(function (root) {
    'use strict';
    const CATALOG = {
  "tracks": [
    { "id": "blackwater-threshold", "title": "Blackwater Threshold", "duration": 238, "url": "audio/nocturnal/blackwater-threshold.mp3" },
    { "id": "undertow", "title": "Undertow", "duration": 234.2, "url": "audio/nocturnal/undertow.mp3" },
    { "id": "obsidian-veil", "title": "Obsidian Veil", "duration": 273, "url": "audio/nocturnal/obsidian-veil.mp3" },
    { "id": "slow-orbit", "title": "Slow Orbit", "duration": 239.56, "url": "audio/nocturnal/slow-orbit.mp3" },
    { "id": "below-the-signal", "title": "Below the Signal", "duration": 268, "url": "audio/nocturnal/below-the-signal.mp3" },
    { "id": "night-without-edges", "title": "Night Without Edges", "duration": 208.6, "url": "audio/nocturnal/night-without-edges.mp3" },
    { "id": "iron-chord", "title": "Iron Chord", "duration": 209.6, "url": "audio/library/iron-chord.mp3" },
    { "id": "circuit-break", "title": "Circuit Break", "duration": 209.32, "url": "audio/library/circuit-break.mp3" },
    { "id": "wake-of-ashes", "title": "Wake of Ashes", "duration": 209.6, "url": "audio/library/wake-of-ashes.mp3" },
    { "id": "hammerhand", "title": "Hammerhand", "duration": 209.6, "url": "audio/library/hammerhand.mp3" },
    { "id": "dark-drive", "title": "Dark Drive", "duration": 209.96, "url": "audio/library/dark-drive.mp3" },
    { "id": "silent-shock", "title": "Silent Shock", "duration": 209.64, "url": "audio/library/silent-shock.mp3" },
    { "id": "slow-night", "title": "Slow Night", "duration": 209.6, "url": "audio/library/slow-night.mp3" },
    { "id": "iron-pulse-slow-strike", "title": "Iron Pulse — Slow Strike", "duration": 209.92, "url": "audio/library/iron-pulse-slow-strike.mp3" },
    { "id": "last-voltage", "title": "Last Voltage", "duration": 209.6, "url": "audio/library/last-voltage.mp3" },
    { "id": "night-engine", "title": "Night Engine", "duration": 209.96, "url": "audio/library/night-engine.mp3" },
    { "id": "gravity-hammer", "title": "Gravity Hammer", "duration": 209.56, "url": "audio/library/gravity-hammer.mp3" },
    { "id": "acid-wake", "title": "Acid Wake", "duration": 210, "url": "audio/library/acid-wake.mp3" },
    { "id": "black-circuit", "title": "Black Circuit", "duration": 209.48, "url": "audio/library/black-circuit.mp3" },
    { "id": "iron-pulse", "title": "Iron Pulse", "duration": 209.64, "url": "audio/library/iron-pulse.mp3" }
  ],
  "playlists": [
    { "id": "void-walker", "name": "Void Walker", "tracks": ["iron-chord", "circuit-break", "wake-of-ashes", "hammerhand", "dark-drive", "silent-shock", "slow-night", "iron-pulse-slow-strike", "last-voltage", "night-engine", "gravity-hammer", "acid-wake", "black-circuit", "iron-pulse"] },
    { "id": "nocturnal", "name": "Nocturnal Drift", "tracks": ["blackwater-threshold", "undertow", "obsidian-veil", "slow-orbit", "below-the-signal", "night-without-edges"] }
  ]
};
    root.EternalMusicCatalog = CATALOG;
    if (typeof module !== 'undefined') module.exports = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
