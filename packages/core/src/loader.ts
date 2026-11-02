// Transport: turns a data path ('kabupaten/51.json') into parsed JSON, with an in-memory cache.

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

// ponytail: memory cache only; add IndexedDB (PRD F2.2) when repeat-visit load time matters.
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
