// In-browser search over the national index (provinsi..kecamatan) plus per-provinsi desa indexes loaded on demand.
import type { Loader } from './loader.ts';
import { displayName, formatPath, toWilayah, type Wilayah } from './wilayah.ts';

export interface SearchOptions {
  /** Maximum number of results. Default 10. */
  limit?: number;
  /** Deepest level searched: 1 = provinsi ... 4 = desa (default). */
  levels?: number;
  /** Restrict to these provinsi; their desa indexes are always loaded. */
  provinsi?: string[];
}

export interface SearchResult {
  wilayah: Wilayah;
  /** Full path for display, e.g. 'Kuta, Badung, Bali'. */
  label: string;
  /** Set when the query matched a former name of the wilayah rather than its current name. */
  alias?: string;
}

/** Search index row: the current name followed by former names. */
type Row = [kode: string, nama: string, ...alias: string[]];
/** One searchable name: forms[0] is the current name, the rest are former names. */
interface Form { text: string; norm: string; bare: string; words: string[] }
interface Entry { kode: string; nama: string; forms: Form[]; allWords: string[] }

// Level words are ignored in queries (PRD). "kota" is kept: it tells Kota Bogor from Kabupaten Bogor.
const STOP = new Set(['kabupaten', 'kab', 'kecamatan', 'kec', 'desa', 'kelurahan', 'kel', 'provinsi', 'prov']);
// ponytail: desa indexes for at most 3 provinsi per query; raise if users search villages without naming a parent.
const MAX_DESA_PROVINSI = 3;

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ'`’]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const toForm = (text: string): Form => {
  const norm = normalize(displayName(text));
  return { text, norm, bare: norm.replace(/^kota /, ''), words: norm.split(' ') };
};

const toEntry = ([kode, nama, ...alias]: Row): Entry => {
  const forms = [nama, ...alias].map(toForm);
  return { kode, nama, forms, allWords: forms.flatMap((f) => f.words) };
};

const hits = (token: string, words: string[]) => words.some((w) => w.startsWith(token));

export function createSearch(
  loadRaw: Loader,
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
    const label = (e: { kode: string; nama: string }) => formatPath([e, ...ancestors(e.kode)]);

    const q = query.trim();
    if (/^\d{5}$/.test(q)) {
      if (levels < 4) return [];
      return (await byPostalCode(q)).slice(0, limit).map((w) => ({ wilayah: w, label: label(w) }));
    }

    const tokens = normalize(q).split(' ').filter((t) => t && !STOP.has(t));
    if (!tokens.length) return [];
    const joined = tokens.join(' ');
    const inScope = (kode: string) => !provinsi || provinsi.includes(kode.slice(0, 2));

    const depth = (e: Entry) => e.kode.split('.').length;
    const score = (f: Form, e: Entry) =>
      (f.norm === joined || f.bare === joined ? 0 : f.norm.startsWith(joined) || f.bare.startsWith(joined) ? 1 : 2) * 10 + depth(e);

    // A name matches when every token prefixes a word of that name or of the parents (current or former names),
    // and at least one token prefixes the name itself. The best-scoring matching name wins; ties go to the current name.
    type Ranked = readonly [score: number, entry: Entry, form: number];
    const best = (e: Entry): Ranked | undefined => {
      let parentWords: string[] | undefined;
      let top: Ranked | undefined;
      e.forms.forEach((f, i) => {
        if (!tokens.some((t) => hits(t, f.words))) return;
        parentWords ??= ancestors(e.kode).flatMap((a) => a.allWords);
        if (!tokens.every((t) => hits(t, f.words) || hits(t, parentWords!))) return;
        const s = score(f, e);
        if (!top || s < top[0]) top = [s, e, i];
      });
      return top;
    };
    const cmp = (a: Ranked, b: Ranked) => a[0] - b[0] || a[2] - b[2] || a[1].nama.length - b[1].nama.length;
    const rank = (list: Entry[]) => list.map(best).filter((r): r is Ranked => r !== undefined).sort(cmp);

    let found = rank(entries.filter((e) => depth(e) <= levels && inScope(e.kode)));

    if (levels >= 4) {
      // Provinsi whose desa index is worth loading: the scope, or where any token names a wilayah.
      const provs = provinsi ?? [
        ...new Set(
          entries
            .flatMap((e) => (tokens.some((t) => hits(t, e.allWords)) ? [[score(e.forms[0], e), e] as const] : []))
            .sort((a, b) => a[0] - b[0])
            .map(([, e]) => e.kode.slice(0, 2)),
        ),
      ].slice(0, MAX_DESA_PROVINSI);
      const desaEntries = (await Promise.all(provs.map(loadDesa))).flat();
      found = [...found, ...rank(desaEntries)].sort(cmp);
    }

    return found.slice(0, limit).map(([, e, form]) => {
      const result: SearchResult = { wilayah: toWilayah([e.kode, e.nama]), label: label(e) };
      if (form > 0) result.alias = e.forms[form].text;
      return result;
    });
  };
}
