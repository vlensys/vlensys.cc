const REPO = 'cat-milk/Anime-Girls-Holding-Programming-Books';
const BRANCH = 'master';
const CACHE_DIR = '.bgcache';
const OUT_DIR = 'bg';
const MANIFEST = 'src/backgrounds.ts';
const COUNT = 30;
const MAX_LIGHTNESS = 0.45;
const MAX_EDGE = 900;
const QUALITY = 72;
const CONCURRENCY = 8;
const MIN_DISTANCE = 12;

const BLOCKED = new Set([
  'go-yaoyorozu-momo-holding-go-programming-language',
]);

interface TreeEntry {
  path: string;
  type: string;
}

interface Candidate {
  path: string;
  cached: string;
  saturation: number;
  lightness: number;
  aspect: number;
  hash: bigint;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function slug(path: string): string {
  const base = path.replace(/\.[^.]+$/, '');
  return base
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

async function magick(args: string[]): Promise<string> {
  const cmd = new Deno.Command('magick', { args, stdout: 'piped', stderr: 'piped' });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  return new TextDecoder().decode(stdout).trim();
}

async function listImages(): Promise<string[]> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`);
  if (!res.ok) throw new Error(`tree fetch failed: ${res.status}`);
  const data = await res.json() as { tree: TreeEntry[] };
  return data.tree
    .filter((e) => e.type === 'blob' && /\.(png|jpe?g|webp)$/i.test(e.path))
    .map((e) => e.path);
}

async function download(path: string): Promise<string | null> {
  const ext = path.slice(path.lastIndexOf('.'));
  const target = `${CACHE_DIR}/${slug(path)}${ext}`;
  try {
    await Deno.stat(target);
    return target;
  } catch {
    void 0;
  }
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  await Deno.writeFile(target, new Uint8Array(await res.arrayBuffer()));
  return target;
}

async function magickRaw(args: string[]): Promise<Uint8Array> {
  const cmd = new Deno.Command('magick', { args, stdout: 'piped', stderr: 'piped' });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  return stdout;
}

async function fingerprint(cached: string): Promise<bigint> {
  const px = await magickRaw([
    `${cached}[0]`,
    '-resize', '9x8!',
    '-colorspace', 'Gray',
    '-depth', '8',
    'gray:-',
  ]);
  if (px.length < 72) throw new Error('short fingerprint');
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const bit = px[y * 9 + x] < px[y * 9 + x + 1] ? 1n : 0n;
      hash = (hash << 1n) | bit;
    }
  }
  return hash;
}

function distance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

async function measure(path: string, cached: string): Promise<Candidate | null> {
  try {
    const out = await magick([
      `${cached}[0]`,
      '-resize', '200x200',
      '-colorspace', 'HSL',
      '-format', '%[fx:mean.g] %[fx:mean.b] %[fx:w] %[fx:h]',
      'info:',
    ]);
    const [s, l, w, h] = out.split(/\s+/).map(Number);
    if (!isFinite(s) || !isFinite(l) || !w || !h) return null;
    const hash = await fingerprint(cached);
    return { path, cached, saturation: Math.min(Math.max(s, 0), 1), lightness: l, aspect: w / h, hash };
  } catch {
    return null;
  }
}

function score(c: Candidate): number {
  const landscape = c.aspect > 1.15 ? 0.08 : 0;
  return c.lightness + c.saturation * 0.15 + landscape;
}

async function encode(c: Candidate): Promise<string> {
  const name = `${slug(c.path)}.webp`;
  await magick([
    `${c.cached}[0]`,
    '-resize', `${MAX_EDGE}x${MAX_EDGE}>`,
    '-strip',
    '-quality', String(QUALITY),
    `${OUT_DIR}/${name}`,
  ]);
  return `${OUT_DIR}/${name}`;
}

await Deno.mkdir(CACHE_DIR, { recursive: true });
await Deno.mkdir(OUT_DIR, { recursive: true });

const paths = await listImages();
console.log(`found ${paths.length} images in ${REPO}`);

const cached = await pool(paths, CONCURRENCY, async (p) => ({ path: p, file: await download(p) }));
const usable = cached.filter((c): c is { path: string; file: string } => c.file !== null);
console.log(`downloaded ${usable.length}`);

const measured = await pool(usable, CONCURRENCY, (c) => measure(c.path, c.file));
const candidates = measured.filter((c): c is Candidate => c !== null);
console.log(`measured ${candidates.length}`);

const allowed = candidates.filter((c) => !BLOCKED.has(slug(c.path)));
const dark = allowed.filter((c) => c.lightness < MAX_LIGHTNESS);
const ranked = (dark.length >= COUNT ? dark : allowed).sort((a, b) => score(a) - score(b));

const picked: Candidate[] = [];
let duplicates = 0;
for (const c of ranked) {
  if (picked.length >= COUNT) break;
  if (picked.some((p) => distance(p.hash, c.hash) < MIN_DISTANCE)) {
    duplicates++;
    continue;
  }
  picked.push(c);
}
if (picked.length < COUNT) throw new Error(`only ${picked.length} distinct images passed the filters`);
console.log(`selected ${picked.length} (lightness ${picked[0].lightness.toFixed(2)}-${picked[picked.length - 1].lightness.toFixed(2)}, skipped ${duplicates} near-duplicates)`);

for (const f of Deno.readDirSync(OUT_DIR)) {
  if (f.isFile) Deno.removeSync(`${OUT_DIR}/${f.name}`);
}

const files = await pool(picked, CONCURRENCY, encode);
files.sort();

const body = files.map((f) => `  '${f}',`).join('\n');
await Deno.writeTextFile(MANIFEST, `const BACKGROUNDS: string[] = [\n${body}\n];\n`);
console.log(`wrote ${MANIFEST} and ${files.length} files to ${OUT_DIR}/`);
