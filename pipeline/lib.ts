// Parse cahyadsn SQL dumps, validate, and split into per-parent JSON files.

export const EXPECTED = { provinsi: 38, kabupaten: 514, kecamatan: 7285, desa: 83762 };
export const LEVELS = ['provinsi', 'kabupaten', 'kecamatan', 'desa'] as const;
export type Level = (typeof LEVELS)[number];

// Kode length per level: 11 / 11.01 / 11.01.01 / 11.01.01.2001
const KODE = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;

/** Extract `('kode', 'value')` tuples from an INSERT dump. Handles SQL '' escaping. */
export function parseTuples(sql: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of sql.matchAll(/\('([0-9.]+)',\s*'((?:[^']|'')*)'\)/g)) {
    out.push([m[1], m[2].replaceAll("''", "'")]);
  }
  return out;
}

export function levelOf(kode: string): Level {
  return LEVELS[kode.split('.').length - 1];
}

export const parentOf = (kode: string) => kode.slice(0, kode.lastIndexOf('.'));

/** Returns a list of errors; empty means the data is releasable. */
export function validate(wilayah: [string, string][], kodepos: Map<string, string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const counts = { provinsi: 0, kabupaten: 0, kecamatan: 0, desa: 0 };

  for (const [kode, nama] of wilayah) {
    if (!KODE.test(kode)) { errors.push(`kode tidak valid: ${kode}`); continue; }
    if (seen.has(kode)) errors.push(`kode ganda: ${kode}`);
    seen.add(kode);
    if (!nama.trim()) errors.push(`nama kosong: ${kode}`);
    counts[levelOf(kode)]++;
  }
  for (const kode of seen) {
    if (kode.includes('.') && !seen.has(parentOf(kode))) errors.push(`wilayah yatim: ${kode}`);
    if (levelOf(kode) === 'desa' && !/^\d{5}$/.test(kodepos.get(kode) ?? '')) errors.push(`kode pos tidak ada/tidak valid: ${kode}`);
  }
  for (const k of kodepos.keys()) if (!seen.has(k)) errors.push(`kode pos untuk wilayah tak dikenal: ${k}`);
  for (const l of LEVELS) {
    if (counts[l] !== EXPECTED[l]) errors.push(`jumlah ${l} ${counts[l]}, seharusnya ${EXPECTED[l]}`);
  }
  return errors;
}

/**
 * Split into files keyed by output path. Rows are tuples to keep files small:
 * [kode, nama] for provinsi/kabupaten/kecamatan, [kode, nama, kodepos] for desa.
 * Level, induk, and tipe are derived from kode/nama by core.
 * Search indexes: search/nasional.json (provinsi..kecamatan) and search/{provinsi}.json (desa per provinsi).
 */
export function split(wilayah: [string, string][], kodepos: Map<string, string>) {
  const files = new Map<string, unknown>();
  const push = (path: string, row: unknown) => {
    if (!files.has(path)) files.set(path, []);
    (files.get(path) as unknown[]).push(row);
  };
  const byPos: Record<string, Record<string, [string, string][]>> = {};

  for (const [kode, nama] of [...wilayah].sort((a, b) => a[0].localeCompare(b[0]))) {
    const level = levelOf(kode);
    if (level === 'provinsi') { push('provinsi.json', [kode, nama]); push('search/nasional.json', [kode, nama]); continue; }
    if (level !== 'desa') {
      push(`${level}/${parentOf(kode)}.json`, [kode, nama]);
      push('search/nasional.json', [kode, nama]);
      continue;
    }
    const pos = kodepos.get(kode)!;
    push(`desa/${parentOf(kode)}.json`, [kode, nama, pos]);
    push(`search/${kode.slice(0, 2)}.json`, [kode, nama]);
    ((byPos[pos.slice(0, 2)] ??= {})[pos] ??= []).push([kode, nama]);
  }
  for (const [prefix, index] of Object.entries(byPos)) files.set(`kodepos/${prefix}.json`, index);
  return files;
}
