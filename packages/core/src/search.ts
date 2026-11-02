// In-browser search over the national index (provinsi..kecamatan) plus per-provinsi desa indexes loaded on demand.
import type { Wilayah } from './index.ts';

export interface SearchOptions {
  /** Jumlah hasil maksimum. Default 10. */
  limit?: number;
  /** Level terdalam yang dicari: 1 = provinsi ... 4 = desa (default). */
  levels?: number;
  /** Batasi ke provinsi tertentu; indeks desa provinsi ini selalu dimuat. */
  provinsi?: string[];
}

export interface SearchResult {
  wilayah: Wilayah;
  /** Jalur lengkap untuk ditampilkan, mis. 'Kuta, Badung, Bali'. */
  label: string;
}

type Row = [kode: string, nama: string];
interface Entry { kode: string; nama: string; words: string[]; norm: string; bare: string }

// Words the PRD says to ignore in queries. "kota" is kept: it tells Kota Bogor from Kabupaten Bogor.
const STOP = new Set(['kabupaten', 'kab', 'kecamatan', 'kec', 'desa', 'kelurahan', 'kel', 'provinsi', 'prov']);
// ponytail: desa indexes for at most 3 provinsi per query; raise if users search villages without naming a parent.
const MAX_DESA_PROVINSI = 3;

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ'`’]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const display = (nama: string) => nama.replace(/^Kabupaten /, '');

const toEntry = ([kode, nama]: Row): Entry => {
  const norm = normalize(display(nama));
  return { kode, nama, norm, bare: norm.replace(/^kota /, ''), words: norm.split(' ') };
};

const hits = (token: string, words: string[]) => words.some((w) => w.startsWith(token));

export function createSearch(
  loadRaw: (path: string) => Promise<unknown>,
  toWilayah: (row: Row) => Wilayah,
  byPostalCode: (kodePos: string) => Promise<Wilayah[]>,
) {
  let nasional: Promise<{ entries: Entry[]; byKode: Map<string, Entry> }> | undefined;
  const desa = new Map<string, Promise<Entry[]>>();

  const loadNasional = () =>
    (nasional ??= loadRaw('search/nasional.json').then((rows) => {
      const entries = (rows as Row[]).map(toEntry);
      return { entries, byKode: new Map(entries.map((e) => [e.kode, e])) };
    })).catch((e) => { nasional = undefined; throw e; });

  const loadDesa = (prov: string) => {
    let p = desa.get(prov);
    if (!p) {
      p = loadRaw(`search/${prov}.json`).then((rows) => (rows as Row[]).map(toEntry));
      p.catch(() => desa.delete(prov));
      desa.set(prov, p);
    }
    return p;
  };

  return async function search(query: string, { limit = 10, levels = 4, provinsi }: SearchOptions = {}): Promise<SearchResult[]> {
    const { byKode, entries } = await loadNasional();
    const ancestors = (kode: string) => {
      const out: Entry[] = [];
      for (let k = kode; k.includes('.'); ) { k = k.slice(0, k.lastIndexOf('.')); out.push(byKode.get(k)!); }
      return out;
    };
    const label = (e: { kode: string; nama: string }) => [e, ...ancestors(e.kode)].map((x) => display(x.nama)).join(', ');

    const q = query.trim();
    if (/^\d{5}$/.test(q)) {
      if (levels < 4) return [];
      return (await byPostalCode(q)).slice(0, limit).map((w) => ({ wilayah: w, label: label(w) }));
    }

    const tokens = normalize(q).split(' ').filter((t) => t && !STOP.has(t));
    if (!tokens.length) return [];
    const joined = tokens.join(' ');
    const inScope = (kode: string) => !provinsi || provinsi.includes(kode.slice(0, 2));

    // A match: every token prefixes a word of the name or its parents, and at least one prefixes the name itself.
    const matches = (e: Entry) => {
      if (!tokens.some((t) => hits(t, e.words))) return false;
      const parentWords = ancestors(e.kode).flatMap((a) => a.words);
      return tokens.every((t) => hits(t, e.words) || hits(t, parentWords));
    };
    const score = (e: Entry) =>
      (e.norm === joined || e.bare === joined ? 0 : e.norm.startsWith(joined) || e.bare.startsWith(joined) ? 1 : 2) * 10 + e.kode.split('.').length;
    type Ranked = readonly [number, Entry];
    const cmp = (a: Ranked, b: Ranked) => a[0] - b[0] || a[1].nama.length - b[1].nama.length;
    const rank = (list: Entry[]) => list.map((e): Ranked => [score(e), e]).sort(cmp);

    const depth = (e: Entry) => e.kode.split('.').length;
    let found = rank(entries.filter((e) => depth(e) <= levels && inScope(e.kode) && matches(e)));

    if (levels >= 4) {
      // Provinsi whose desa index is worth loading: the scope, or where any token names a wilayah.
      const provs = provinsi ?? [
        ...new Set(rank(entries.filter((e) => tokens.some((t) => hits(t, e.words)))).map(([, e]) => e.kode.slice(0, 2))),
      ].slice(0, MAX_DESA_PROVINSI);
      const desaEntries = (await Promise.all(provs.map(loadDesa))).flat();
      found = [...found, ...rank(desaEntries.filter(matches))].sort(cmp);
    }

    return found.slice(0, limit).map(([, e]) => ({ wilayah: toWilayah([e.kode, e.nama]), label: label(e) }));
  };
}
