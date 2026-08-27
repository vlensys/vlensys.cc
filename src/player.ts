interface SpotifyPlaybackData {
  isPaused: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
}

interface SpotifyEmbedController {
  addListener(event: string, cb: (payload: { data: SpotifyPlaybackData }) => void): void;
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  loadUri(uri: string): void;
}

interface SpotifyIFrameApi {
  createController(
    el: HTMLElement,
    options: { uri: string; width: string | number; height: string | number },
    cb: (controller: SpotifyEmbedController) => void
  ): void;
}

interface Window {
  onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
}

interface NowPlaying {
  playing: boolean;
  title: string;
  artist: string;
  spotifyId: string | null;
}

(() => {
  const STALL_MS = 6000;
  const POLL_MS = 20000;

  const host = document.querySelector<HTMLElement>('.player-section');
  const mount = document.getElementById('player-embed');
  if (!host || !mount) return;
  const section: HTMLElement = host;

  if (TRACKS.length === 0) {
    section.hidden = true;
    return;
  }

  const pick = <T extends HTMLElement>(selector: string): T =>
    section.querySelector(selector) as T;

  const titleEl = pick('.player-title');
  const artistEl = pick('.player-artist');
  const toggleBtn = pick<HTMLButtonElement>('[data-action="toggle"]');
  const embedEl = pick('.player-embed');
  const endpoint = section.dataset.nowPlaying ?? '';

  let controller: SpotifyEmbedController | null = null;
  let slot = 0;
  let posMs = 0;
  let posAt = 0;
  let durMs = 0;
  let paused = true;
  let intent = false;
  let ended = false;
  let sawUpdate = false;
  let live = false;
  let liveId = '';
  let queued: NowPlaying | null = null;

  const order = TRACKS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }

  function current(): number {
    return order[slot];
  }

  function setPaused(value: boolean): void {
    paused = value;
    toggleBtn.classList.toggle('is-playing', !value);
    toggleBtn.setAttribute('aria-label', value ? 'Play' : 'Pause');
    if (value && queued) apply(queued);
  }

  function enter(data: NowPlaying): void {
    queued = null;
    live = true;
    section.classList.add('is-live');
    section.classList.toggle('has-embed', data.spotifyId !== null);
    embedEl.setAttribute('aria-hidden', data.spotifyId === null ? 'true' : 'false');
    titleEl.textContent = data.title;
    artistEl.textContent = data.artist;
    if (data.spotifyId !== null && data.spotifyId !== liveId) {
      liveId = data.spotifyId;
      if (controller) controller.loadUri('spotify:track:' + liveId);
    }
  }

  function leave(): void {
    queued = null;
    if (!live) return;
    live = false;
    liveId = '';
    section.classList.remove('is-live', 'has-embed');
    embedEl.setAttribute('aria-hidden', 'true');
    paintTrack();
    load(false);
  }

  function apply(data: NowPlaying): void {
    if (!data.playing) {
      leave();
      return;
    }
    if (!live && !paused) {
      queued = data;
      return;
    }
    enter(data);
  }

  async function poll(): Promise<void> {
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) return;
      apply((await res.json()) as NowPlaying);
    } catch {
      return;
    }
  }

  function paintTrack(): void {
    titleEl.textContent = TRACKS[current()].title;
    artistEl.textContent = TRACKS[current()].artist;
  }

  function load(play: boolean): void {
    posMs = 0;
    posAt = performance.now();
    durMs = 0;
    ended = false;
    sawUpdate = false;
    if (!controller) return;
    controller.loadUri('spotify:track:' + TRACKS[current()].id);
    if (play) {
      controller.play();
      setPaused(false);
    }
  }

  function advance(): void {
    slot = (slot + 1) % order.length;
    paintTrack();
    load(true);
  }

  toggleBtn.addEventListener('click', () => {
    intent = paused;
    if (controller) controller.togglePlay();
  });

  paintTrack();

  window.onSpotifyIframeApiReady = (api) => {
    api.createController(
      mount as HTMLElement,
      { uri: 'spotify:track:' + TRACKS[current()].id, width: 300, height: 80 },
      (embed) => {
        controller = embed;
        section.classList.add('is-ready');
        if (live && liveId) embed.loadUri('spotify:track:' + liveId);
        embed.addListener('playback_update', (payload) => {
          const data = payload.data;
          posMs = data.position;
          posAt = performance.now();
          durMs = data.duration;
          sawUpdate = true;
          setPaused(data.isPaused);
        });
      }
    );
  };

  function frame(): void {
    const idle = performance.now() - posAt;
    const elapsed = paused ? posMs : posMs + idle;
    const finished = durMs > 0 && elapsed >= durMs - 150;
    const stalled = sawUpdate && idle > STALL_MS;
    if (!live && intent && !ended && !paused && (finished || stalled)) {
      ended = true;
      advance();
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  if (endpoint) {
    poll();
    window.setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) poll();
    });
  }
})();
