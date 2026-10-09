/* Device-local preferences; the catalog contains only finished audio assets. */
(function (root) {
    'use strict';
    // Songs and built-in playlists come from js/music-catalog.js (edited in Eternal Void Studio).
    const CATALOG = root.EternalMusicCatalog || (typeof require === 'function' ? require('./music-catalog.js') : { tracks: [], playlists: [] });
    const TRACKS = CATALOG.tracks.map(t => ({ id: t.id, title: t.title, duration: t.duration, url: t.url }));
    const TRACK_IDS = new Set(TRACKS.map(t => t.id));
    const BUILT_IN = CATALOG.playlists
        .filter(p => p && /^[a-z0-9-]+$/.test(p.id) && p.id !== 'favorites' && !p.id.startsWith('custom-'))
        .map(p => ({ id: p.id, name: String(p.name || 'Untitled'), tracks: (p.tracks || []).filter(id => TRACK_IDS.has(id)) }));
    const STORAGE_KEY = 'eternalvoid.music.v1';
    class MusicLibrary {
        constructor(storage) {
            this.storage = storage;
            this.tracks = TRACKS;
            this.ids = new Set(TRACKS.map(t => t.id));
            this.favorites = new Set();
            this.banished = new Set();
            this.custom = [];
            this.settings = { volume: .75, shuffle: false, repeat: 'all' };
            try {
                const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
                if (saved && typeof saved === 'object') {
                    this.favorites = new Set(this.cleanIds(saved.favorites));
                    this.banished = new Set(this.cleanIds(saved.banished));
                    this.banished.forEach(id => this.favorites.delete(id));
                    const used = new Set();
                    this.custom = (Array.isArray(saved.custom) ? saved.custom : []).slice(0, 50)
                        .filter(p => p && typeof p.id === 'string' && /^custom-[a-z0-9-]+$/.test(p.id) && !used.has(p.id) && used.add(p.id))
                        .map(p => ({ id: p.id, name: String(p.name || 'Untitled').slice(0, 60), tracks: this.cleanIds(p.tracks) }));
                    const s = saved.settings || {};
                    if (Number.isFinite(s.volume)) this.settings.volume = Math.min(1, Math.max(0, s.volume));
                    this.settings.shuffle = s.shuffle === true;
                    if (['off', 'all', 'one'].includes(s.repeat)) this.settings.repeat = s.repeat;
                }
            } catch (_) { /* An unavailable store must not prevent listening. */ }
        }
        cleanIds(ids) { return [...new Set((Array.isArray(ids) ? ids : []).filter(id => this.ids.has(id)))]; }
        save() {
            try {
                this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, favorites: [...this.favorites], banished: [...this.banished], custom: this.custom, settings: this.settings }));
                return true;
            } catch (_) { return false; }
        }
        playlists() { return [...BUILT_IN.map(({ id, name }) => ({ id, name })), { id: 'favorites', name: 'Favorites' }, ...this.custom]; }
        get defaultPlaylist() { return BUILT_IN[0]?.id || 'favorites'; }
        track(id) { return TRACKS.find(t => t.id === id); }
        trackIds(id) {
            const builtIn = BUILT_IN.find(p => p.id === id);
            if (builtIn) return builtIn.tracks.slice();
            if (id === 'favorites') return [...this.favorites];
            return this.custom.find(p => p.id === id)?.tracks.slice() || [];
        }
        playable(id) { return this.trackIds(id).filter(t => !this.banished.has(t)); }
        favorite(id) {
            if (!this.ids.has(id)) return;
            if (this.favorites.has(id)) this.favorites.delete(id);
            else { this.favorites.add(id); this.banished.delete(id); }
        }
        banish(id) {
            if (!this.ids.has(id)) return;
            if (this.banished.has(id)) this.banished.delete(id);
            else { this.banished.add(id); this.favorites.delete(id); }
        }
        create(name) {
            name = String(name).trim().slice(0, 60);
            if (!name || this.custom.length >= 50) return null;
            const p = { id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name, tracks: [] };
            this.custom.push(p); return p;
        }
        add(playlist, track) {
            const p = this.custom.find(p => p.id === playlist);
            if (p && this.ids.has(track) && !p.tracks.includes(track)) p.tracks.push(track);
        }
        remove(playlist, track) {
            const p = this.custom.find(p => p.id === playlist);
            if (p) p.tracks = p.tracks.filter(id => id !== track);
        }
        move(playlist, track, direction) {
            const p = this.custom.find(p => p.id === playlist);
            if (!p) return;
            const i = p.tracks.indexOf(track), j = i + direction;
            if (i >= 0 && j >= 0 && j < p.tracks.length) [p.tracks[i], p.tracks[j]] = [p.tracks[j], p.tracks[i]];
        }
    }
    root.MusicLibrary = MusicLibrary;
    if (typeof module !== 'undefined') module.exports = MusicLibrary;
})(typeof window !== 'undefined' ? window : globalThis);
