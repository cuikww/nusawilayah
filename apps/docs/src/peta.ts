// Download page logic: which boundaries one map shows, and the SVG/PNG/GeoJSON files made from them. No React here.
import { project, type GeoClient, type GeoFeature, type Region } from '@nusawilayah/geo';

/** `sendiri`: the region alone. `konteks`: highlighted among its neighbours. `isi`: split into its sub-regions. */
export type View = 'sendiri' | 'konteks' | 'isi';

export interface Scene {
  features: GeoFeature[];
  highlight: Set<string>;
  /** Set when the region has no boundary of its own (kecamatan created after 2020). */
  notice?: string;
}

/** The boundaries of one map: '' is Indonesia, '52' a provinsi, '52.01' a kabupaten, '52.01.01' a kecamatan. */
export async function loadScene(geo: GeoClient, kode: string, view: View): Promise<Scene> {
  const parts = kode ? kode.split('.') : [];
  const [prov] = parts;
  const kab = parts.slice(0, 2).join('.');
  const only = (fs: GeoFeature[]) => fs.filter((f) => f.kode === kode);
  const within = (fs: GeoFeature[], parent: string) => fs.filter((f) => f.kode.startsWith(`${parent}.`));
  const none = new Set<string>();
  const mark = new Set([kode]);

  if (parts.length === 0) return { features: await geo.load('provinsi'), highlight: none };
  if (parts.length === 1) {
    if (view === 'isi') return { features: await geo.load('kabupaten', prov), highlight: none };
    const all = await geo.load('provinsi');
    return view === 'konteks' ? { features: all, highlight: mark } : { features: only(all), highlight: mark };
  }
  if (parts.length === 2) {
    if (view === 'isi') return { features: within(await geo.load('kecamatan', prov), kab), highlight: none };
    const all = await geo.load('kabupaten', prov);
    return view === 'konteks' ? { features: all, highlight: mark } : { features: only(all), highlight: mark };
  }
  const siblings = within(await geo.load('kecamatan', prov), kab);
  if (!siblings.some((f) => f.kode === kode)) {
    return { features: siblings, highlight: none, notice: 'Kecamatan ini belum punya batas sendiri (pemekaran setelah 2020), jadi yang tampil adalah kecamatan lain di kabupatennya.' };
  }
  return view === 'konteks' ? { features: siblings, highlight: mark } : { features: only(siblings), highlight: mark };
}

export interface Style {
  /** null: transparent background. */
  bg: string | null;
  fill: string;
  highlight: string;
  stroke: string;
  text: string;
  strokeWidth: number;
  /** Colour regions from `palette`, neighbours differently, instead of one `fill`. */
  multi: boolean;
  palette: string[];
  labels: boolean;
  title: boolean;
}

export interface Theme extends Omit<Style, 'strokeWidth' | 'multi' | 'labels' | 'title'> { name: string }

export const THEMES: Theme[] = [
  { name: 'Nusantara', bg: '#f4f8fb', fill: '#d5e3ee', highlight: '#0b57d0', stroke: '#ffffff', text: '#0f2742', palette: ['#7fb3d5', '#76c7c0', '#f7c873', '#f19c79', '#a29bfe', '#9ad08f'] },
  { name: 'Hutan', bg: '#f3f7f1', fill: '#cfe3c8', highlight: '#2d6a4f', stroke: '#ffffff', text: '#1b3a2b', palette: ['#95d5b2', '#74c69d', '#b7e4c7', '#52b788', '#d8f3dc', '#40916c'] },
  { name: 'Senja', bg: '#fff7f0', fill: '#fbd9c4', highlight: '#e85d04', stroke: '#ffffff', text: '#5a2a0c', palette: ['#ffb4a2', '#e5989b', '#ffcdb2', '#f4a261', '#e9c46a', '#f28482'] },
  { name: 'Merah Putih', bg: '#ffffff', fill: '#f2f2f2', highlight: '#ce1126', stroke: '#c4c4c4', text: '#3a0a0f', palette: ['#f7c5cc', '#ef8a98', '#fde2e4', '#e5383b', '#ffd6da', '#ba181b'] },
  { name: 'Pastel', bg: '#fdfcff', fill: '#e9e4f5', highlight: '#7c3aed', stroke: '#ffffff', text: '#2e1065', palette: ['#ffd6e0', '#c1e7e3', '#fff1b6', '#d7c6f5', '#c9e4ff', '#ffdfba'] },
  { name: 'Malam', bg: '#0f172a', fill: '#334155', highlight: '#38bdf8', stroke: '#0f172a', text: '#e2e8f0', palette: ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'] },
  { name: 'Monokrom', bg: '#ffffff', fill: '#e5e5e5', highlight: '#262626', stroke: '#ffffff', text: '#171717', palette: ['#d4d4d4', '#a3a3a3', '#e5e5e5', '#737373', '#bdbdbd', '#8a8a8a'] },
];

/** Required by the boundary licence (CC BY 3.0 IGO): printed on every file. */
export const CREDIT = 'Batas wilayah: BPS (2020) via HDX, CC BY 3.0 IGO · ilustrasi, bukan batas hukum · nusawilayah';

const overlap = (a: Region, b: Region) =>
  a.box[0] <= b.box[0] + b.box[2] && b.box[0] <= a.box[0] + a.box[2] && a.box[1] <= b.box[1] + b.box[3] && b.box[1] <= a.box[1] + a.box[3];

/**
 * A palette colour per region, different from every region whose box touches it where the palette allows.
 * ponytail: bounding boxes stand in for real adjacency (over-cautious, never misses a neighbour); O(n²), n ≤ a few hundred.
 */
export function colorize(regions: Region[], palette: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const done: Region[] = [];
  for (const r of [...regions].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])) {
    const used = new Map<string, number>();
    for (const o of done) if (overlap(o, r)) used.set(out.get(o.kode)!, (used.get(out.get(o.kode)!) ?? 0) + 1);
    const color = palette.find((c) => !used.has(c)) ?? palette.reduce((a, b) => ((used.get(a) ?? 0) <= (used.get(b) ?? 0) ? a : b));
    out.set(r.kode, color);
    done.push(r);
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' } as const)[c as '&']};`);
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Picture { svg: string; width: number; height: number }

/** The map as a standalone SVG: what the preview shows is exactly what is downloaded. */
export function toSvg(scene: Scene, style: Style, title: string, subtitle: string): Picture {
  const MAX = 1000;
  const map = project(scene.features, { width: MAX });
  // The part of the map shown: everything, or the highlighted region with some of its neighbours around it.
  const focus = map.regions.filter((r) => scene.highlight.has(r.kode));
  let [cx, cy, cw, ch] = [0, 0, map.width, map.height];
  if (focus.length && focus.length < map.regions.length) {
    const x0 = Math.min(...focus.map((r) => r.box[0])), y0 = Math.min(...focus.map((r) => r.box[1]));
    const x1 = Math.max(...focus.map((r) => r.box[0] + r.box[2])), y1 = Math.max(...focus.map((r) => r.box[1] + r.box[3]));
    const m = Math.max(x1 - x0, y1 - y0) * 0.35;
    [cx, cy, cw, ch] = [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
  }
  const k = Math.min(MAX / cw, MAX / ch); // map units → picture units; tall regions fit a square
  const [iw, ih] = [cw * k, ch * k];
  const pad = 32;
  const top = style.title ? 96 : pad;
  const width = Math.round(Math.max(iw, 640) + 2 * pad);
  const height = Math.round(top + ih + 48);
  const inView = (r: Region) => r.box[0] < cx + cw && r.box[0] + r.box[2] > cx && r.box[1] < cy + ch && r.box[1] + r.box[3] > cy;
  const regions = map.regions.filter(inView);

  const colors = style.multi ? colorize(regions, style.palette) : undefined;
  const fillOf = (r: Region) => (scene.highlight.has(r.kode) ? style.highlight : colors?.get(r.kode) ?? style.fill);
  // highlighted regions last, so their outline is drawn on top of their neighbours'
  const ordered = [...regions].sort((a, b) => Number(scene.highlight.has(a.kode)) - Number(scene.highlight.has(b.kode)));
  const paths = ordered.map((r) => `<path id="${r.id}" data-kode="${r.kode}" fill="${fillOf(r)}" d="${r.d}"><title>${esc(r.nama)}</title></path>`);

  // ponytail: labels sit at the centre of the bounding box, which can fall outside a curved region; polylabel if it bothers anyone
  const labels = style.labels
    ? regions.flatMap((r) => {
        const name = r.nama.replace(/^Kabupaten /, '');
        const size = Math.min(18, ((r.box[2] * k) / name.length) * 1.7); // in picture units
        if (size < 6) return [];
        const lit = scene.highlight.has(r.kode);
        return [`<text x="${r1(r.box[0] + r.box[2] / 2)}" y="${r1(r.box[1] + r.box[3] / 2)}" font-size="${r1(size / k)}" stroke="${lit ? style.highlight : style.bg ?? style.fill}" fill="${lit ? style.bg ?? '#ffffff' : style.text}">${esc(name)}</text>`];
      })
    : [];

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">`,
    `<title>${esc(title)}</title>`,
    style.bg ? `<rect width="${width}" height="${height}" fill="${style.bg}"/>` : '',
    style.title ? `<text x="${width / 2}" y="52" text-anchor="middle" font-size="30" font-weight="700" fill="${style.text}">${esc(title)}</text>` : '',
    style.title ? `<text x="${width / 2}" y="78" text-anchor="middle" font-size="15" fill="${style.text}" fill-opacity="0.7">${esc(subtitle)}</text>` : '',
    `<svg x="${r1((width - iw) / 2)}" y="${top}" width="${r1(iw)}" height="${r1(ih)}" viewBox="${[cx, cy, cw, ch].map(r1).join(' ')}">`,
    `<g stroke="${style.strokeWidth ? style.stroke : 'none'}" stroke-width="${r1(style.strokeWidth / k * 100) / 100}" stroke-linejoin="round">${paths.join('')}</g>`,
    labels.length ? `<g text-anchor="middle" dominant-baseline="central" font-weight="600" stroke-width="${r1(3 / k * 100) / 100}" paint-order="stroke" stroke-linejoin="round">${labels.join('')}</g>` : '',
    '</svg>',
    `<text x="${width / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="${style.text}" fill-opacity="0.65">${esc(CREDIT)}</text>`,
    '</svg>',
  ].join('');
  return { svg, width, height };
}

/** Draws the SVG on a canvas, `scale` times its size. */
export async function toPng({ svg, width, height }: Picture, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('PNG gagal dibuat'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Longitude/latitude boundaries for QGIS and other GIS tools. */
export const toGeoJson = (scene: Scene) =>
  JSON.stringify({
    type: 'FeatureCollection',
    attribution: CREDIT,
    features: scene.features.map((f) => ({ type: 'Feature', properties: { kode: f.kode, nama: f.nama }, geometry: { type: 'MultiPolygon', coordinates: f.polygons } })),
  });

/** 'Kabupaten Lombok Barat' → 'kabupaten-lombok-barat' */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
