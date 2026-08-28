interface BackgroundState {
  windowStart: number;
  pool: string[];
  seen: string[];
  last: string;
}

(() => {
  const KEY = 'vlensys.bg';
  const WINDOW_MS = 3600000;
  const POOL_SIZE = 5;

  const host = document.querySelector<HTMLElement>('.column-bg');
  if (!host || !BACKGROUNDS.length) return;

  const empty = (): BackgroundState => ({ windowStart: 0, pool: [], seen: [], last: '' });

  const known = (list: unknown): string[] =>
    Array.isArray(list)
      ? list.filter((v): v is string => typeof v === 'string' && BACKGROUNDS.indexOf(v) !== -1)
      : [];

  function read(): BackgroundState {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<BackgroundState>;
      return {
        windowStart: typeof parsed.windowStart === 'number' ? parsed.windowStart : 0,
        pool: known(parsed.pool),
        seen: known(parsed.seen),
        last: typeof parsed.last === 'string' ? parsed.last : '',
      };
    } catch {
      return empty();
    }
  }

  function write(state: BackgroundState): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      return;
    }
  }

  function sample(list: string[]): string {
    return list[Math.floor(Math.random() * list.length)];
  }

  const state = read();
  const now = Date.now();

  if (!state.windowStart || now - state.windowStart >= WINDOW_MS) {
    state.windowStart = now;
    state.pool = [];
  }

  if (state.pool.length < POOL_SIZE) {
    let fresh = BACKGROUNDS.filter((b) => state.pool.indexOf(b) === -1 && state.seen.indexOf(b) === -1);
    if (!fresh.length) {
      state.seen = state.pool.slice();
      fresh = BACKGROUNDS.filter((b) => state.pool.indexOf(b) === -1);
    }
    if (fresh.length) {
      const added = sample(fresh);
      state.pool.push(added);
      state.seen.push(added);
    }
  }

  const rotation = state.pool.length > 1 ? state.pool.filter((b) => b !== state.last) : state.pool;
  const choice = sample(rotation.length ? rotation : state.pool);

  host.style.setProperty('--bg-image', 'url("' + choice + '")');
  state.last = choice;
  write(state);
})();
