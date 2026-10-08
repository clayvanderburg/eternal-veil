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
    { "id": "night-without-edges", "title": "Night Without Edges", "duration": 208.6, "url": "audio/nocturnal/night-without-edges.mp3" }
  ],
  "playlists": [
    { "id": "nocturnal", "name": "Nocturnal Drift", "tracks": ["blackwater-threshold", "undertow", "obsidian-veil", "slow-orbit", "below-the-signal", "night-without-edges"] }
  ]
};
    root.EternalMusicCatalog = CATALOG;
    if (typeof module !== 'undefined') module.exports = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
