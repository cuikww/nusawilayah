// Transport: turns a data path ('kabupaten/51.json') into parsed JSON, with an in-memory cache and,
// optionally, a persistent one (IndexedDB) for repeat visits.

export type Fetcher = (path: string) => Promise<unknown>;
export type Loader = (path: string) => Promise<unknown>;

/** Error thrown for a failed load. `status` is the HTTP status (404 = no such file). */
export class LoadError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LoadError';
    this.status = status;
  }
}

export const isNotFound = (e: unknown) => (e as { status?: number } | null)?.status === 404;

export function httpFetcher(baseUrl: string): Fetcher {
  const base = baseUrl.replace(/\/$/, '');
  return async (path) => {
    const res = await fetch(`${base}/${path}`);
    if (!res.ok) throw new LoadError(`nusawilayah: failed to load ${path} (HTTP ${res.status})`, res.status);
    return res.json();
  };
}

/** Persistent key-value store for loaded files. `indexedDbStore()` in browsers; anything with get/set in tests. */
export interface Store {
  get(key: string): Promise<{ t: number; v: unknown } | undefined>;
  set(key: string, value: { t: number; v: unknown }): Promise<void>;
}

// ponytail: fixed 7-day expiry; data patches never change a kode or nama, so a week-old file is still correct.
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Serves files from `store` when fresh, else fetches and stores them. The store is only a cache:
 * if it fails (private mode, quota, no IndexedDB) the file is fetched as if there were no store.
 */
export function persistentFetcher(fetcher: Fetcher, store: Store, namespace: string): Fetcher {
  return async (path) => {
    const key = `${namespace}|${path}`;
    const hit = await store.get(key).catch(() => undefined);
    if (hit && Date.now() - hit.t < MAX_AGE) return hit.v;
    const v = await fetcher(path);
    store.set(key, { t: Date.now(), v }).catch(() => {});
    return v;
  };
}

/** IndexedDB-backed Store, or undefined where IndexedDB is unavailable (SSR, old browsers). */
export function indexedDbStore(name = 'nusawilayah'): Store | undefined {
  if (typeof indexedDB === 'undefined') return undefined;
  let db: Promise<IDBDatabase> | undefined;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const tx = d.transaction('files', mode);
          const req = fn(tx.objectStore('files'));
          tx.oncomplete = () => resolve(req.result);
          tx.onerror = () => reject(tx.error);
        }),
    );
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: (key, value) => run('readwrite', (s) => s.put(value, key)).then(() => {}),
  };
}

/** In-memory cache of every file loaded during this page's lifetime. */
export function cachedLoader(fetcher: Fetcher): Loader {
  const cache = new Map<string, Promise<unknown>>();
  return (path) => {
    let p = cache.get(path);
    if (!p) {
      p = Promise.resolve(fetcher(path));
      p.catch(() => cache.delete(path)); // failed loads stay retryable
      cache.set(path, p);
    }
    return p;
  };
}
