// Framework-agnostic state for cascading dropdowns. Adapters (React, Vue) subscribe and render.
import type { WilayahClient } from './index.ts';
import { LEVELS, toAlamat, type Alamat, type Level, type Wilayah } from './wilayah.ts';

export interface LevelState {
  level: Level;
  options: Wilayah[];
  selected?: Wilayah;
  loading: boolean;
  error?: Error;
}

export interface CascadeState {
  levels: LevelState[];
  alamat: Alamat;
  /** Kode of the deepest selected level, e.g. '51.03.01.1001'. */
  kode?: string;
}

export interface CascadeOptions {
  /** Deepest level: 1 = provinsi ... 4 = desa (default). */
  levels?: number;
  /** Restrict the provinsi options, e.g. ['51', '52']. */
  provinsi?: string[];
}

type Client = Pick<WilayahClient, 'provinsi' | 'children'>;

export function createCascade(client: Client, { levels: n = 4, provinsi: only }: CascadeOptions = {}) {
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new Error(`nusawilayah: levels must be 1-4, got ${n}`);

  const empty = (level: Level): LevelState => ({ level, options: [], loading: false });
  let state: CascadeState = { levels: LEVELS.slice(0, n).map(empty), alamat: {} };
  const listeners = new Set<(s: CascadeState) => void>();
  const gen = Array<number>(n).fill(0); // bumped per level to drop stale responses
  const pending = Array<Promise<void>>(n).fill(Promise.resolve());
  let valueGen = 0;

  function update(fn: (levels: LevelState[]) => void) {
    const levels = state.levels.map((l) => ({ ...l }));
    fn(levels);
    const selected = levels.flatMap((l) => (l.selected ? [l.selected] : []));
    state = { levels, alamat: toAlamat(selected), kode: selected.at(-1)?.kode };
    for (const fn of listeners) fn(state);
  }

  function loadOptions(i: number): Promise<void> {
    const parent = i === 0 ? undefined : state.levels[i - 1].selected?.kode;
    if (i > 0 && !parent) return Promise.resolve();
    const token = ++gen[i];
    update((l) => { l[i].loading = true; l[i].error = undefined; });
    return (pending[i] = (async () => {
      try {
        let options = parent ? await client.children(parent) : await client.provinsi();
        if (!parent && only) options = options.filter((o) => only.includes(o.kode));
        if (token === gen[i]) update((l) => { l[i].options = options; l[i].loading = false; });
      } catch (e) {
        if (token === gen[i]) update((l) => { l[i].loading = false; l[i].error = e as Error; });
      }
    })());
  }

  const indexOf = (level: Level | number) => {
    const i = typeof level === 'number' ? level : LEVELS.indexOf(level);
    if (!(i >= 0 && i < n)) throw new Error(`nusawilayah: level out of range: ${level}`);
    return i;
  };

  /** Selects a wilayah at one level, clears the levels below and loads the next one. Resolves once it has loaded. */
  function choose(level: Level | number, kode?: string): Promise<void> {
    const i = indexOf(level);
    const selected = kode ? state.levels[i].options.find((o) => o.kode === kode) : undefined;
    if (kode && !selected) throw new Error(`nusawilayah: ${kode} is not an option at level ${LEVELS[i]}`);
    update((l) => {
      l[i].selected = selected;
      for (let j = i + 1; j < n; j++) { gen[j]++; l[j] = empty(l[j].level); }
    });
    return selected && i + 1 < n ? loadOptions(i + 1) : Promise.resolve();
  }

  /** Fills every level from one kode (edit forms). A kode deeper than `levels` is truncated; no kode clears the picker. */
  async function setValue(kode?: string): Promise<void> {
    const my = ++valueGen;
    if (!kode) return choose(0);
    const parts = kode.split('.').slice(0, n);
    await pending[0];
    for (let i = 0; i < parts.length; i++) {
      if (my !== valueGen) return; // superseded by a newer setValue
      const err = state.levels[i].error;
      if (err) throw err;
      await choose(i, parts.slice(0, i + 1).join('.'));
    }
  }

  const ready = loadOptions(0);

  return {
    getState: () => state,
    subscribe(fn: (s: CascadeState) => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    /** A user choice. Cancels a setValue still in progress. */
    select(level: Level | number, kode?: string) {
      valueGen++;
      return choose(level, kode);
    },
    setValue,
    /** Reloads the options of a level that failed. */
    retry: (level: Level | number) => loadOptions(indexOf(level)),
    /** Resolves once the first provinsi list has loaded (or failed). */
    ready,
  };
}

export type Cascade = ReturnType<typeof createCascade>;
