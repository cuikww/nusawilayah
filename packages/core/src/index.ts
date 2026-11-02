// Public entry: createWilayah() wires the loader, the data queries, search, migration and the cascade together.
import { createCascade, type CascadeOptions } from './cascade.ts';
import { cachedLoader, httpFetcher, indexedDbStore, isNotFound, LoadError, persistentFetcher, type Fetcher, type Store } from './loader.ts';
import { createMigrate } from './migrate.ts';
import { createSearch } from './search.ts';
import { KODE, LEVELS, PARENT_KODE, toAlamat, toWilayah, type Alamat, type Row, type Wilayah } from './wilayah.ts';

export { LEVELS, displayName, formatPath, kodeOf } from './wilayah.ts';
export { LoadError } from './loader.ts';
export type { Alamat, Level, Wilayah } from './wilayah.ts';
export type { Fetcher, Store } from './loader.ts';
export type { Cascade, CascadeOptions, CascadeState, LevelState } from './cascade.ts';
export type { SearchOptions, SearchResult } from './search.ts';
export type { Migration } from './migrate.ts';

export interface WilayahOptions {
  /** URL or path of the `dist` folder of @nusawilayah/data. Default: jsDelivr. */
  baseUrl?: string;
  /**
   * Replaces how files are loaded (own API, bundled data, React Native). Receives a relative path such as
   * `kabupaten/51.json`. For a missing file, throw an error with `status: 404`.
   */
  fetcher?: Fetcher;
  /**
   * `memory` (default): files are cached for the page's lifetime. `indexeddb`: also kept in IndexedDB for 7 days,
   * so repeat visits load without the network. A custom `Store` works too (tests, React Native AsyncStorage).
   */
  cache?: 'memory' | 'indexeddb' | Store;
}

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist';

export function createWilayah({ baseUrl = DEFAULT_BASE_URL, fetcher, cache = 'memory' }: WilayahOptions = {}) {
  const store = cache === 'memory' ? undefined : cache === 'indexeddb' ? indexedDbStore() : cache;
  const source = fetcher ?? httpFetcher(baseUrl);
  // Files of different data sources must not mix, so the persistent cache is namespaced by baseUrl.
  const loadRaw = cachedLoader(store ? persistentFetcher(source, store, fetcher ? 'custom' : baseUrl) : source);
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
      if (!w) throw new LoadError(`nusawilayah: wilayah not found: ${k}`, 404);
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

  /**
   * Maps a kode saved under the previous edition (Kepmendagri No. 100.1.1-6117 Tahun 2022) to the current one:
   * migrate('72.01.09.2012') → { status: 'moved', kode: '72.01.24.2007', alamat }.
   */
  const migrate = createMigrate(loadRaw, resolve);

  const client = {
    provinsi,
    children,
    resolve,
    byPostalCode,
    search,
    migrate,
    /** Headless state for cascading dropdowns, for framework adapters. */
    createCascade: (opts?: CascadeOptions) => createCascade(client, opts),
  };
  return client;
}

export type WilayahClient = ReturnType<typeof createWilayah>;
