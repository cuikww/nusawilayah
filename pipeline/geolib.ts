// Pair BPS boundary units (HDX cod-ab-idn) with Kemendagri kode by name. Pure functions, no I/O.

type Coords = number[] | Coords[];

export interface Feature {
  type: 'Feature';
  kode: string;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Coords };
}

const ROMAN: Record<string, string> = { i: 'satu', ii: 'dua', iii: 'tiga', iv: 'empat', v: 'lima', vi: 'enam', vii: 'tujuh', viii: 'delapan', ix: 'sembilan', x: 'sepuluh' };
const ABBREV: Record<string, string> = { p: 'pulau', pp: 'pulaupulau', kep: 'kepulauan', gn: 'gunung', kp: 'kampung' };

/** Lowercase letters and digits only, with Roman numerals and abbreviations spelled out. */
export function normName(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => ROMAN[w] ?? ABBREV[w] ?? w)
    .join('');
}

/** Dice coefficient of the letter pairs of two normalized names: 1 is equal, 0 is nothing in common. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) pairs.set(a.slice(i, i + 2), (pairs.get(a.slice(i, i + 2)) ?? 0) + 1);
  let shared = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const n = pairs.get(b.slice(i, i + 2));
    if (n) { shared++; pairs.set(b.slice(i, i + 2), n - 1); }
  }
  return (2 * shared) / (a.length + b.length - 2 || 1);
}

export interface Match { kode: string; score: number }

/**
 * Pairs source units with official [kode, nama] one to one: the most similar pairs first, none below `min`.
 * A source name may list alternatives separated by slashes ("Mubarni / Arfu").
 */
export function matchNames(source: { id: string; name: string }[], official: [string, string][], min: number): Map<string, Match> {
  const candidates: [number, string, string][] = [];
  for (const { id, name } of source) {
    const names = [name, ...name.split(/[/\\]/)].map(normName);
    for (const [kode, nama] of official) {
      const score = Math.max(...names.map((n) => similarity(n, normName(nama))));
      if (score >= min) candidates.push([score, id, kode]);
    }
  }
  candidates.sort((a, b) => b[0] - a[0]);
  const out = new Map<string, Match>();
  const taken = new Set<string>();
  for (const [score, id, kode] of candidates) {
    if (out.has(id) || taken.has(kode)) continue;
    out.set(id, { kode, score });
    taken.add(kode);
  }
  return out;
}

/** A kabupaten/kota name without its type: BPS writes "Jakarta Pusat", Kemendagri "Kota Administrasi Jakarta Pusat". */
export const withoutType = (name: string) => name.replace(/^(kabupaten|kota)\s+(administrasi\s+)?/i, '');

/** Kota have 71..99 as their second segment, in both BPS (ID3171) and Kemendagri (31.71) codes. */
export const isKota = (code: string) => code.replace(/\D/g, '')[2] === '7';
