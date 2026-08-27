"use strict";
(() => {
    const STALL_MS = 6000;
    const host = document.querySelector('.player-section');
    const mount = document.getElementById('player-embed');
    if (!host || !mount)
        return;
    const section = host;
    if (TRACKS.length === 0) {
        section.hidden = true;
        return;
    }
    const pick = (selector) => section.querySelector(selector);
    const titleEl = pick('.player-title');
    const artistEl = pick('.player-artist');
    const toggleBtn = pick('[data-action="toggle"]');
    let controller = null;
    let slot = 0;
    let posMs = 0;
    let posAt = 0;
    let durMs = 0;
    let paused = true;
    let intent = false;
    let ended = false;
    let sawUpdate = false;
    const order = TRACKS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const swap = order[i];
        order[i] = order[j];
        order[j] = swap;
    }
    function current() {
        return order[slot];
    }
    function setPaused(value) {
        paused = value;
        toggleBtn.classList.toggle('is-playing', !value);
        toggleBtn.setAttribute('aria-label', value ? 'Play' : 'Pause');
    }
    function paintTrack() {
        titleEl.textContent = TRACKS[current()].title;
        artistEl.textContent = TRACKS[current()].artist;
    }
    function load(play) {
        posMs = 0;
        posAt = performance.now();
        durMs = 0;
        ended = false;
        sawUpdate = false;
        if (!controller)
            return;
        controller.loadUri('spotify:track:' + TRACKS[current()].id);
        if (play) {
            controller.play();
            setPaused(false);
        }
    }
    function advance() {
        slot = (slot + 1) % order.length;
        paintTrack();
        load(true);
    }
    toggleBtn.addEventListener('click', () => {
        intent = paused;
        if (controller)
            controller.togglePlay();
    });
    paintTrack();
    window.onSpotifyIframeApiReady = (api) => {
        api.createController(mount, { uri: 'spotify:track:' + TRACKS[current()].id, width: 300, height: 80 }, (embed) => {
            controller = embed;
            section.classList.add('is-ready');
            embed.addListener('playback_update', (payload) => {
                const data = payload.data;
                posMs = data.position;
                posAt = performance.now();
                durMs = data.duration;
                sawUpdate = true;
                setPaused(data.isPaused);
            });
        });
    };
    function frame() {
        const idle = performance.now() - posAt;
        const elapsed = paused ? posMs : posMs + idle;
        const finished = durMs > 0 && elapsed >= durMs - 150;
        const stalled = sawUpdate && idle > STALL_MS;
        if (intent && !ended && !paused && (finished || stalled)) {
            ended = true;
            advance();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
