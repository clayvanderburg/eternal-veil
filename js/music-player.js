(function () {
    'use strict';
    const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const icons = {
        play: icon('<path d="m9 5 11 7-11 7z"/>'), pause: icon('<path d="M8 5v14M16 5v14"/>'),
        prev: icon('<path d="M5 5v14m14-14L8 12l11 7z"/>'), next: icon('<path d="M19 5v14M5 5l11 7-11 7z"/>'),
        star: icon('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'),
        ban: icon('<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>'),
        expand: icon('<path d="m6 14 6-6 6 6"/>'), close: icon('<path d="m6 6 12 12M6 18 18 6"/>')
    };
    const el = (tag, props = {}, text) => { const n = document.createElement(tag); Object.entries(props).forEach(([k, v]) => n.setAttribute(k, v)); if (text !== undefined) n.textContent = text; return n; };
    const time = s => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
    class MusicPlayer {
        constructor(options) {
            this.options = options;
            let storage; try { storage = window.localStorage; } catch (_) { storage = null; }
            this.library = new MusicLibrary(storage);
            this.audio = new Audio(); this.audio.preload = 'metadata';
            this.playlist = 'nocturnal'; this.current = null; this.generation = 0; this.expanded = false;
            this.audio.volume = this.library.settings.volume;
            this.panel = document.getElementById('music-player');
            this.dialog = document.getElementById('music-source-dialog');
            this.panel.innerHTML = `
                <div class="music-compact">
                    <button class="music-art" data-action="sources" aria-label="Choose music source">♫</button>
                    <div class="music-now"><span id="music-now-title">Nocturnal Drift</span><small id="music-now-detail">Choose a track</small></div>
                    <button data-action="previous" aria-label="Previous track">${icons.prev}</button>
                    <button data-action="play" id="music-play" aria-label="Play music">${icons.play}</button>
                    <button data-action="next" aria-label="Next track">${icons.next}</button>
                    <button data-action="expand" id="music-expand" aria-label="Expand music player" aria-expanded="false" aria-controls="music-details">${icons.expand}</button>
                </div>
                <div id="music-details" hidden>
                    <div class="music-timeline"><span id="music-elapsed">0:00</span><input id="music-seek" aria-label="Track position" type="range" min="0" max="100" value="0" step="0.1"><span id="music-duration">0:00</span></div>
                    <div class="music-settings"><label>Volume <input id="music-volume" aria-label="Music volume" type="range" min="0" max="100" value="75"></label><button data-action="shuffle" id="music-shuffle" aria-pressed="false">Shuffle</button><button data-action="repeat" id="music-repeat">Repeat all</button><button data-action="favorite" id="music-favorite" aria-label="Favorite current track">${icons.star}</button><button data-action="banish" id="music-banish" aria-label="Banish current track">${icons.ban}</button></div>
                    <div class="music-library-head"><label>Playlist<select id="music-playlists" aria-label="Music playlist"></select></label><button data-action="create">New playlist</button></div>
                    <form id="music-create-form" class="music-inline-form" hidden><input id="music-new-name" aria-label="New playlist name" placeholder="Name your playlist" maxlength="60" required><button type="submit">Create</button><button type="button" data-action="cancel-create">Cancel</button></form>
                    <div id="music-custom-tools" hidden><label>Add a song <select id="music-add-song" aria-label="Song to add"></select></label><button data-action="add-song">Add</button><button data-action="rename">Rename</button><button data-action="delete">Delete playlist</button></div>
                    <form id="music-rename-form" class="music-inline-form" hidden><input id="music-rename-name" aria-label="Playlist name" maxlength="60" required><button type="submit">Save name</button></form>
                    <div class="music-library-filters"><input id="music-search" aria-label="Search songs" placeholder="Find a song…"><label><input id="music-show-banished" type="checkbox"> Banished</label></div>
                    <div id="music-track-list" class="music-track-list" aria-label="Songs"></div>
                    <div class="music-footer"><span>Saved on this device</span><button data-action="sources">Change source</button><button data-action="stop">Stop music</button></div>
                </div>`;
            this.audio.hidden = true;
            this.audio.setAttribute('aria-label', 'Playlist audio');
            this.panel.append(this.audio);
            this.panel.addEventListener('click', e => { const b = e.target.closest('button[data-action]'); if (b) this.action(b.dataset.action, b.dataset.track); });
            this.panel.addEventListener('keydown', e => e.stopPropagation());
            this.dialog.addEventListener('keydown', e => e.stopPropagation());
            document.getElementById('music-close-source').onclick = () => this.dialog.close();
            document.getElementById('music-source-playlist').onclick = () => { this.dialog.close(); this.panel.hidden = false; this.expand(true); this.render(); document.getElementById('music-playlists').focus(); };
            document.getElementById('music-source-device').onclick = () => {
                this.dialog.close();
                if (window.CosmicSynth.visualizerMode !== 'system') this.options.device();
                this.panel.hidden = true;
            };
            document.getElementById('music-source-off').onclick = () => { this.stop(); this.dialog.close(); };
            this.dialog.addEventListener('click', e => { if (e.target === this.dialog) { const r = this.dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.dialog.close(); } });
            document.getElementById('music-playlists').onchange = e => {
                const playing = !this.audio.paused;
                ++this.generation; this.audio.pause(); this.current = null;
                this.playlist = e.target.value; this.render();
                if (playing) this.start(this.library.playable(this.playlist)[0]);
            };
            document.getElementById('music-search').oninput = () => this.renderTracks();
            document.getElementById('music-show-banished').onchange = () => this.renderTracks();
            document.getElementById('music-volume').value = this.library.settings.volume * 100;
            document.getElementById('music-volume').oninput = e => { this.audio.volume = +e.target.value / 100; this.library.settings.volume = this.audio.volume; this.persist(); };
            document.getElementById('music-seek').oninput = e => { if (Number.isFinite(this.audio.duration)) this.audio.currentTime = this.audio.duration * +e.target.value / 100; };
            document.getElementById('music-create-form').onsubmit = e => {
                e.preventDefault(); const p = this.library.create(document.getElementById('music-new-name').value);
                if (!p) return this.message('Enter a name. You can save up to 50 playlists.');
                this.audio.pause(); this.current = null;
                this.playlist = p.id; e.target.hidden = true; this.persist(); this.render(); this.message('Playlist created. Add songs below.');
            };
            document.getElementById('music-rename-form').onsubmit = e => {
                e.preventDefault(); const p = this.library.custom.find(p => p.id === this.playlist);
                const name = document.getElementById('music-rename-name').value.trim();
                if (p && name) p.name = name; e.target.hidden = true; this.persist(); this.render();
            };
            ['play', 'pause', 'loadedmetadata', 'timeupdate', 'ended'].forEach(type => this.audio.addEventListener(type, () => this.sync()));
            this.audio.addEventListener('ended', () => {
                if (this.library.settings.repeat === 'one' && !this.library.banished.has(this.current)) this.start(this.current);
                else this.skip(1, true);
            });
            this.audio.addEventListener('error', () => { this.audio.pause(); this.message('This track could not load. Try another song.'); });
            window.addEventListener('cosmic-audio-source', e => {
                if (e.detail !== 'playlist') { this.generation++; this.audio.pause(); }
                this.sync();
            });
            this.render();
        }
        message(text) { this.options.toast(text); }
        persist() { if (!this.library.save()) this.message('Listening works, but this browser could not save your music library.'); }
        openSources() {
            const mode = window.CosmicSynth.visualizerMode;
            document.getElementById('music-source-status').textContent = mode === 'playlist' ? (this.audio.paused ? 'Playlist paused' : `Playing ${this.library.track(this.current)?.title || 'music'}`) : mode === 'system' ? 'Listening to device audio' : mode === 'mic' ? 'Listening to your microphone' : mode === 'upload' ? 'Playing an audio file' : 'Choose what moves the scene';
            if (!this.dialog.open) this.dialog.showModal();
        }
        expand(value) {
            this.expanded = value;
            document.getElementById('music-details').hidden = !value;
            this.panel.classList.toggle('expanded', value);
            const b = document.getElementById('music-expand'); b.setAttribute('aria-expanded', value); b.setAttribute('aria-label', value ? 'Collapse music player' : 'Expand music player');
        }
        async start(id) {
            if (!id || this.library.banished.has(id)) { this.audio.pause(); this.sync(); return this.message('No playable songs in this playlist. Add songs or restore a banished song.'); }
            const track = this.library.track(id); if (!track) return;
            this.audio.pause();
            // Source selection cancels pending capture or prior playback before attaching.
            const synth = window.CosmicSynth;
            try {
                if (synth.visualizerMode !== 'playlist' || synth.playlistAudio !== this.audio) synth.attachPlaylistAudio(this.audio);
            } catch (_) { this.message('Audio is unavailable in this browser.'); return; }
            const generation = ++this.generation;
            this.current = id; this.audio.src = track.url; this.panel.hidden = false;
            this.options.playlist?.(); this.render();
            try {
                await synth.ctx.resume();
                if (generation !== this.generation || synth.visualizerMode !== 'playlist') return;
                await this.audio.play();
                if (generation !== this.generation) return;
                this.sync();
            } catch (error) {
                if (generation !== this.generation) return;
                this.sync(); this.message(error.name === 'NotAllowedError' ? 'Press play to start the music.' : 'Music could not start. Try another track.');
            }
        }
        async toggle() {
            if (!this.audio.paused) { this.audio.pause(); return; }
            if (!this.current || !this.library.playable(this.playlist).includes(this.current) || window.CosmicSynth.visualizerMode !== 'playlist') return this.start(this.library.playable(this.playlist)[0]);
            const generation = this.generation;
            try { await window.CosmicSynth.ctx.resume(); if (generation === this.generation) await this.audio.play(); }
            catch (_) { this.message('Press play again to resume music.'); }
        }
        skip(direction, ended = false) {
            const ids = this.library.playable(this.playlist);
            if (!ids.length) { this.audio.pause(); this.sync(); return this.message('This playlist has no playable songs.'); }
            if (direction < 0 && this.audio.currentTime > 3 && ids.includes(this.current)) { this.audio.currentTime = 0; return; }
            let index = ids.indexOf(this.current);
            if (this.library.settings.shuffle && ids.length > 1) {
                const candidates = ids.filter(id => id !== this.current); return this.start(candidates[Math.floor(Math.random() * candidates.length)]);
            }
            if (ended && index === ids.length - 1 && this.library.settings.repeat === 'off') { this.audio.pause(); this.sync(); return; }
            if (index < 0) {
                const full = this.library.trackIds(this.playlist), old = full.indexOf(this.current);
                const ordered = direction > 0 ? full.slice(old + 1).concat(full.slice(0, old + 1)) : full.slice(0, old).reverse().concat(full.slice(old).reverse());
                return this.start(ordered.find(id => ids.includes(id)) || ids[0]);
            }
            index = (index + direction + ids.length) % ids.length;
            this.start(ids[index]);
        }
        stop() { ++this.generation; this.audio.pause(); window.CosmicSynth.stopMusicReactivity(); this.panel.hidden = true; this.sync(); this.options.stopped?.(); }
        action(action, id) {
            const trackId = id || this.current;
            if (action === 'play') return this.toggle();
            if (action === 'previous' || action === 'next') return this.skip(action === 'next' ? 1 : -1);
            if (action === 'track') return this.start(id);
            if (action === 'sources') return this.openSources();
            if (action === 'expand') return this.expand(!this.expanded);
            if (action === 'stop') return this.stop();
            if (action === 'create') { document.getElementById('music-create-form').hidden = false; document.getElementById('music-new-name').focus(); return; }
            if (action === 'cancel-create') { document.getElementById('music-create-form').hidden = true; return; }
            if (action === 'rename') { document.getElementById('music-rename-form').hidden = false; document.getElementById('music-rename-name').value = this.library.custom.find(p => p.id === this.playlist)?.name || ''; document.getElementById('music-rename-name').focus(); return; }
            if (action === 'delete') {
                const p = this.library.custom.find(p => p.id === this.playlist); if (!p) return;
                if (!window.confirm(`Delete “${p.name}”? The songs stay in your library.`)) return;
                this.library.custom = this.library.custom.filter(p => p.id !== this.playlist); this.playlist = 'nocturnal';
            }
            if (action === 'shuffle') this.library.settings.shuffle = !this.library.settings.shuffle;
            if (action === 'repeat') this.library.settings.repeat = ({ all: 'one', one: 'off', off: 'all' })[this.library.settings.repeat];
            if (action === 'favorite') this.library.favorite(trackId);
            if (action === 'banish') { this.library.banish(trackId); if (trackId === this.current && this.library.banished.has(trackId)) this.skip(1); }
            if (action === 'add-song') this.library.add(this.playlist, document.getElementById('music-add-song').value);
            if (action === 'remove') { this.library.remove(this.playlist, id); if (id === this.current && !this.audio.paused) this.skip(1); }
            if (action === 'up' || action === 'down') this.library.move(this.playlist, id, action === 'up' ? -1 : 1);
            this.persist(); this.render();
        }
        sync() {
            const track = this.library.track(this.current), playing = !this.audio.paused && !this.audio.ended && window.CosmicSynth.visualizerMode === 'playlist';
            document.getElementById('music-now-title').textContent = track?.title || this.library.playlists().find(p => p.id === this.playlist)?.name || 'Music';
            document.getElementById('music-now-detail').textContent = track ? `${playing ? 'Playing' : 'Paused'} · ${this.library.playlists().find(p => p.id === this.playlist)?.name || 'Music'}` : 'Choose a track';
            const b = document.getElementById('music-play'); b.innerHTML = playing ? icons.pause : icons.play; b.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
            const duration = track ? (Number.isFinite(this.audio.duration) ? this.audio.duration : track.duration) : 0;
            document.getElementById('music-elapsed').textContent = time(track ? this.audio.currentTime : 0);
            document.getElementById('music-duration').textContent = time(duration);
            const seek = document.getElementById('music-seek'); seek.disabled = !this.current || !Number.isFinite(this.audio.duration);
            if (document.activeElement !== seek) seek.value = track && duration ? this.audio.currentTime / duration * 100 : 0;
            const favorite = document.getElementById('music-favorite'); favorite.disabled = !track; favorite.setAttribute('aria-pressed', this.library.favorites.has(this.current));
            document.getElementById('music-banish').disabled = !track;
            const quick = document.getElementById('music-react-quick-btn'); quick.classList.toggle('music-react-active', playing || window.CosmicSynth.visualizerMode === 'system');
            quick.setAttribute('data-tooltip', 'Choose music or device audio');
        }
        render() {
            const select = document.getElementById('music-playlists'); select.replaceChildren(...this.library.playlists().map(p => el('option', { value: p.id }, p.name))); select.value = this.playlist;
            const custom = this.library.custom.find(p => p.id === this.playlist); document.getElementById('music-custom-tools').hidden = !custom;
            const add = document.getElementById('music-add-song'); add.replaceChildren(...this.library.tracks.filter(t => !custom?.tracks.includes(t.id)).map(t => el('option', { value: t.id }, t.title))); add.disabled = !add.options.length;
            document.getElementById('music-shuffle').setAttribute('aria-pressed', this.library.settings.shuffle);
            document.getElementById('music-repeat').textContent = `Repeat ${this.library.settings.repeat}`;
            this.renderTracks(); this.sync();
        }
        renderTracks() {
            const list = document.getElementById('music-track-list'), query = document.getElementById('music-search').value.toLowerCase(), bannedOnly = document.getElementById('music-show-banished').checked;
            const ids = bannedOnly ? [...this.library.banished] : this.library.playable(this.playlist);
            const tracks = ids.map(id => this.library.track(id)).filter(t => t.title.toLowerCase().includes(query));
            list.replaceChildren();
            if (!tracks.length) { list.append(el('p', { class: 'music-empty' }, bannedOnly ? 'No banished songs.' : query ? 'No songs match your search.' : 'Nothing here yet. Add songs or favorite a track.')); return; }
            const isCustom = this.library.custom.some(p => p.id === this.playlist);
            tracks.forEach((t, index) => {
                const row = el('div', { class: `music-track${t.id === this.current ? ' current' : ''}` });
                const play = el('button', { 'data-action': 'track', 'data-track': t.id, class: 'music-track-name', 'aria-label': `Play ${t.title}` }, t.title);
                if (this.library.banished.has(t.id)) play.disabled = true;
                row.append(play, el('small', {}, time(t.duration)));
                const button = (action, label, markup) => { const b = el('button', { 'data-action': action, 'data-track': t.id, 'aria-label': `${label} ${t.title}`, title: label }); b.innerHTML = markup; row.append(b); return b; };
                if (isCustom && !bannedOnly) {
                    button('up', 'Move up', '↑').disabled = index === 0;
                    button('down', 'Move down', '↓').disabled = index === tracks.length - 1;
                    button('remove', 'Remove from playlist', icons.close);
                }
                const star = button('favorite', 'Favorite', icons.star); star.setAttribute('aria-pressed', this.library.favorites.has(t.id));
                button('banish', bannedOnly ? 'Restore' : 'Banish', bannedOnly ? 'Restore' : icons.ban);
                list.append(row);
            });
        }
    }
    window.EternalMusicPlayer = { init: options => window.VoidMusic = new MusicPlayer(options) };
})();
