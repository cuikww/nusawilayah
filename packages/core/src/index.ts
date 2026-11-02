// Public entry: createWilayah() wires the loader, the data queries, search and the cascade together.
import { createCascade, type CascadeOptions } from './cascade.ts';
import { cachedLoader, httpFetcher, isNotFound, type Fetcher } from './loader.ts';
import { createSearch } from './search.ts';
import { KODE, LEVELS, PARENT_KODE, toAlamat, toWilayah, type Alamat, type Row, type Wilayah } from './wilayah.ts';

export { LEVELS, displayName, formatPath, kodeOf } from './wilayah.ts';
export { LoadError } from './loader.ts';
export type { Alamat, Level, Wilayah } from './wilayah.ts';
export type { Fetcher } from './loader.ts';
export type { Cascade, CascadeOptions, CascadeState, LevelState } from './cascade.ts';
export type { SearchOptions, SearchResult } from './search.ts';

export interface WilayahOptions {
  /** URL or path of the `dist` folder of @nusawilayah/data. Default: jsDelivr. */
  baseUrl?: string;
  /**
   * Replaces how files are loaded (own API, bundled data, React Native). Receives a relative path such as
   * `kabupaten/51.json`. For a missing file, throw an error with `status: 404`.
   */
  fetcher?: Fetcher;
}

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist';

export function createWilayah({ baseUrl = DEFAULT_BASE_URL, fetcher }: WilayahOptions = {}) {
  const loadRaw = cachedLoader(fetcher ?? httpFetcher(baseUrl));
  const load = (path: string) => loadRaw(path).then((rows) => (rows as Row[]).map(toWilayah));

  /** All 38 provinsi. */
  const provinsi = () => load('provinsi.json');

  /** Direct children of a wilayah: children('51') → kabupaten/kota in Bali. */
  const children = (kode: string) => {
    // Validated before use in a URL, so a kode can never become a path like '../x'.
    if (!PARENT_KODE.test(kode)) return Promise.reject(new Error(`nusawilayah: invalid parent kode: ${kode}`));
    return load(`${LEVELS[kode.split('.').length]}/${kode}.json`);
  };

  /** Every level of an address from one kode (for edit forms): resolve('51.03.01.1001'). */
  async function resolve(kode: string): Promise<Alamat> {
    if (!KODE.test(kode)) throw new Error(`nusawilayah: invalid kode: ${kode}`);
    const parts = kode.split('.');
    const path: Wilayah[] = [];
    for (let i = 1; i <= parts.length; i++) {
      const k = parts.slice(0, i).join('.');
      const list = i === 1 ? await provinsi() : await children(parts.slice(0, i - 1).join('.'));
      const w = list.find((x) => x.kode === k);
      if (!w) throw new Error(`nusawilayah: wilayah not found: ${k}`);
      path.push(w);
    }
    return toAlamat(path);
  }

  /** Every desa/kelurahan with this postal code. One postal code can cover many desa. */
  async function byPostalCode(kodePos: string): Promise<Wilayah[]> {
    if (!/^\d{5}$/.test(kodePos)) throw new Error(`nusawilayah: invalid postal code: ${kodePos}`);
    let index: Record<string, Row[]>;
    try {
      index = (await loadRaw(`kodepos/${kodePos.slice(0, 2)}.json`)) as Record<string, Row[]>;
    } catch (e) {
      if (isNotFound(e)) return []; // no file for this prefix = no such postal code; network errors still throw
      throw e;
    }
    return (index[kodePos] ?? []).map(([kode, nama]) => toWilayah([kode, nama, kodePos]));
  }

  /** Search by name (prefix match, no server) or by 5-digit postal code: search('denpasar sel'). */
  const search = createSearch(loadRaw, byPostalCode);

  const client = {
    provinsi,
    children,
    resolve,
    byPostalCode,
    search,
    /** Headless state for cascading dropdowns, for framework adapters. */
    createCascade: (opts?: CascadeOptions) => createCascade(client, opts),
  };
  return client;
}

export type WilayahClient = ReturnType<typeof createWilayah>;
