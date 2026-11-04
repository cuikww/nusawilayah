// Public entry: createGeo() loads boundary files of @nusawilayah/geo-data; project() turns them into SVG paths.
import { featuresOf, type GeoFeature, type Topology } from './topojson.ts';

export { featuresOf } from './topojson.ts';
export { project } from './project.ts';
export type { GeoFeature, Topology } from './topojson.ts';
export type { ProjectedMap, ProjectOptions, Region } from './project.ts';

/** Map levels with boundaries. Desa boundaries are not published (too large, rarely needed). */
export type GeoLevel = 'provinsi' | 'kabupaten' | 'kecamatan';

export interface GeoOptions {
  /** URL or path of the `dist` folder of @nusawilayah/geo-data. */
  baseUrl?: string;
  /** Replaces how files are loaded; receives e.g. `kabupaten/51.topo.json`. */
  fetcher?: (path: string) => Promise<unknown>;
}

export const DEFAULT_GEO_BASE_URL = 'https://cdn.jsdelivr.net/npm/@nusawilayah/geo-data@2025.2/dist';

/** Shown under every map: the boundary licence (CC BY 3.0 IGO) requires the attribution. */
export const DISCLAIMER = 'Batas wilayah: BPS (2020) via HDX, CC BY 3.0 IGO. Ilustrasi, bukan batas hukum; batas resmi mengacu pada Kemendagri dan BIG.';

export function createGeo({ baseUrl = DEFAULT_GEO_BASE_URL, fetcher }: GeoOptions = {}) {
  const base = baseUrl.replace(/\/$/, '');
  const fetchJson =
    fetcher ??
    (async (path: string) => {
      const res = await fetch(`${base}/${path}`);
      if (!res.ok) throw Object.assign(new Error(`nusawilayah: failed to load ${path} (HTTP ${res.status})`), { status: res.status });
      return res.json();
    });
  const cache = new Map<string, Promise<GeoFeature[]>>();

  /**
   * Boundaries of one map: all provinsi of Indonesia, or the kabupaten/kecamatan of one provinsi:
   * load('provinsi'), load('kabupaten', '51').
   */
  function load(level: GeoLevel, provinsi?: string): Promise<GeoFeature[]> {
    if (level !== 'provinsi' && !/^\d{2}$/.test(provinsi ?? '')) {
      return Promise.reject(new Error(`nusawilayah: ${level} maps need a provinsi kode like '51', got ${provinsi}`));
    }
    const path = level === 'provinsi' ? 'provinsi.topo.json' : `${level}/${provinsi}.topo.json`;
    let p = cache.get(path);
    if (!p) {
      p = Promise.resolve(fetchJson(path)).then((t) => featuresOf(t as Topology));
      p.catch(() => cache.delete(path)); // failed loads stay retryable
      cache.set(path, p);
    }
    return p;
  }

  return { load };
}

export type GeoClient = ReturnType<typeof createGeo>;
