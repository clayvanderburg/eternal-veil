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
    { "id": "iron-pulse", "title": "Iron Pulse", "duration": 209.64, "url": "audio/library/iron-pulse.mp3" },
    { "id": "sir-linken", "title": "Sir Linken", "duration": 179.76, "url": "audio/library/sir-linken.mp3" },
    { "id": "quest-accepted", "title": "Quest Accepted", "duration": 179.16, "url": "audio/library/quest-accepted.mp3" },
    { "id": "princesss-call", "title": "Princess's Call", "duration": 179.6, "url": "audio/library/princesss-call.mp3" },
    { "id": "journey-begins", "title": "Journey Begins", "duration": 179.84, "url": "audio/library/journey-begins.mp3" },
    { "id": "hero-awakens", "title": "Hero Awakens", "duration": 179.6, "url": "audio/library/hero-awakens.mp3" },
    { "id": "hope-leaves", "title": "Hope leaves", "duration": 180.4, "url": "audio/library/hope-leaves.mp3" },
    { "id": "halp-us", "title": "Halp us!", "duration": 178.8, "url": "audio/library/halp-us.mp3" },
    { "id": "im-being-oppressed", "title": "I'm being oppressed", "duration": 178.88, "url": "audio/library/im-being-oppressed.mp3" },
    { "id": "gloom-of-the-kingdom", "title": "Gloom of the Kingdom", "duration": 179.6, "url": "audio/library/gloom-of-the-kingdom.mp3" },
    { "id": "gannondorf", "title": "Gannondorf", "duration": 179.96, "url": "audio/library/gannondorf.mp3" },
    { "id": "darkness-invades", "title": "Darkness Invades", "duration": 179.6, "url": "audio/library/darkness-invades.mp3" },
    { "id": "waiting-for-the-hero", "title": "Waiting for the Hero", "duration": 179.64, "url": "audio/library/waiting-for-the-hero.mp3" },
    { "id": "holding-on", "title": "Holding On", "duration": 178.76, "url": "audio/library/holding-on.mp3" },
    { "id": "hopes-return", "title": "Hope's Return", "duration": 179.76, "url": "audio/library/hopes-return.mp3" },
    { "id": "sword-in-the-stone", "title": "Sword in the Stone", "duration": 179.64, "url": "audio/library/sword-in-the-stone.mp3" },
    { "id": "master-sword-awakens", "title": "Master Sword Awakens", "duration": 178.8, "url": "audio/library/master-sword-awakens.mp3" },
    { "id": "victory-will-be-mine", "title": "Victory Will Be Mine", "duration": 179.08, "url": "audio/library/victory-will-be-mine.mp3" },
    { "id": "realm-rescued", "title": "Realm Rescued", "duration": 179.44, "url": "audio/library/realm-rescued.mp3" },
    { "id": "final-triumph", "title": "Final Triumph", "duration": 179.4, "url": "audio/library/final-triumph.mp3" },
    { "id": "awaken", "title": "Awaken", "duration": 179.56, "url": "audio/library/awaken.mp3" }
  ],
  "playlists": [
    { "id": "void-walker", "name": "Void Walker", "tracks": ["iron-chord", "circuit-break", "wake-of-ashes", "hammerhand", "dark-drive", "silent-shock", "slow-night", "iron-pulse-slow-strike", "last-voltage", "night-engine", "gravity-hammer", "acid-wake", "black-circuit", "iron-pulse"] },
    { "id": "nocturnal", "name": "Nocturnal Drift", "tracks": ["blackwater-threshold", "undertow", "obsidian-veil", "slow-orbit", "below-the-signal", "night-without-edges"] },
    { "id": "a-heros-journey", "name": "A Hero's Journey", "tracks": ["darkness-invades", "princesss-call", "im-being-oppressed", "gloom-of-the-kingdom", "waiting-for-the-hero", "hope-leaves", "awaken", "hero-awakens", "sir-linken", "halp-us", "quest-accepted", "journey-begins", "gannondorf", "holding-on", "hopes-return", "sword-in-the-stone", "master-sword-awakens", "victory-will-be-mine", "realm-rescued", "final-triumph"] }
  ]
};
    root.EternalMusicCatalog = CATALOG;
    if (typeof module !== 'undefined') module.exports = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
