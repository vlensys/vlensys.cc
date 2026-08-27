interface Env {
  LASTFM_API_KEY: string;
  LASTFM_USER: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  ALLOWED_ORIGIN: string;
  RATE_LIMITER: RateLimit;
}

interface LastfmTrack {
  name?: string;
  artist?: { '#text'?: string };
  '@attr'?: { nowplaying?: string };
}

interface LastfmResponse {
  recenttracks?: { track?: LastfmTrack | LastfmTrack[] };
}

interface SpotifyTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SpotifySearchResponse {
  tracks?: { items?: { id?: string }[] };
}

interface NowPlaying {
  playing: boolean;
  title: string;
  artist: string;
  spotifyId: string | null;
}

const IDLE: NowPlaying = { playing: false, title: '', artist: '', spotifyId: null };

const PATHS = new Set(['/', '/now-playing']);

const HARDENING: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

let token = '';
let tokenExpiry = 0;

async function spotifyToken(env: Env): Promise<string> {
  const now = Date.now();
  if (token && now < tokenExpiry) return token;
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return '';
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + btoa(env.SPOTIFY_CLIENT_ID + ':' + env.SPOTIFY_CLIENT_SECRET),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return '';
  const data = (await res.json()) as SpotifyTokenResponse;
  if (!data.access_token) return '';
  token = data.access_token;
  tokenExpiry = now + (data.expires_in ?? 3600) * 1000 - 60000;
  return token;
}

async function findSpotifyId(env: Env, title: string, artist: string): Promise<string | null> {
  const auth = await spotifyToken(env);
  if (!auth) return null;
  const queries = ['track:"' + title + '" artist:"' + artist + '"', title + ' ' + artist];
  for (const query of queries) {
    const url = 'https://api.spotify.com/v1/search?type=track&limit=1&q=' + encodeURIComponent(query);
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + auth } });
    if (res.status === 401) {
      token = '';
      tokenExpiry = 0;
      continue;
    }
    if (!res.ok) continue;
    const data = (await res.json()) as SpotifySearchResponse;
    const id = data.tracks?.items?.[0]?.id;
    if (id) return id;
  }
  return null;
}

async function readNowPlaying(env: Env): Promise<NowPlaying> {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'user.getrecenttracks');
  url.searchParams.set('user', env.LASTFM_USER);
  url.searchParams.set('api_key', env.LASTFM_API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString());
  if (!res.ok) return IDLE;
  const data = (await res.json()) as LastfmResponse;
  const raw = data.recenttracks?.track;
  const track = Array.isArray(raw) ? raw[0] : raw;
  if (!track || track['@attr']?.nowplaying !== 'true') return IDLE;
  const title = track.name ?? '';
  const artist = track.artist?.['#text'] ?? '';
  if (!title || !artist) return IDLE;
  return { playing: true, title, artist, spotifyId: await findSpotifyId(env, title, artist) };
}

function allowOrigin(request: Request, env: Env): string {
  const allowed = (env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.length === 0 || allowed.includes('*')) return '*';
  const origin = request.headers.get('origin') ?? '';
  return allowed.includes(origin) ? origin : allowed[0];
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const base: Record<string, string> = {
      'access-control-allow-origin': allowOrigin(request, env),
      'access-control-allow-methods': 'GET, OPTIONS',
      vary: 'origin',
      ...HARDENING,
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: base });
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: base });

    const url = new URL(request.url);
    if (!PATHS.has(url.pathname)) return new Response(null, { status: 404, headers: base });

    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return new Response(null, { status: 429, headers: { ...base, 'retry-after': '60' } });
    }

    const cache = caches.default;
    const key = new Request(url.origin + '/now-playing');
    const hit = await cache.match(key);
    const body = hit ? await hit.text() : JSON.stringify(await readNowPlaying(env));

    if (!hit) {
      ctx.waitUntil(
        cache.put(
          key,
          new Response(body, {
            headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=20' },
          })
        )
      );
    }

    return new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...base },
    });
  },
};
