// Parse cahyadsn SQL dumps, validate, and split into per-parent JSON files.
// Kode rules (level, parent) come from core, so every output format agrees with the client.
import { KODE, LEVELS, levelOf, parentOf } from '../packages/core/src/wilayah.ts';

export const EXPECTED = { provinsi: 38, kabupaten: 514, kecamatan: 7285, desa: 83762 };

/** Extract `('kode', 'value')` tuples from an INSERT dump. Handles SQL '' escaping. */
export function parseTuples(sql: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of sql.matchAll(/\('([0-9.]+)',\s*'((?:[^']|'')*)'\)/g)) {
    out.push([m[1], m[2].replaceAll("''", "'")]);
  }
  return out;
}

/** Returns a list of errors; empty means the data is releasable. */
export function validate(wilayah: [string, string][], kodepos: Map<string, string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const counts = { provinsi: 0, kabupaten: 0, kecamatan: 0, desa: 0 };

  for (const [kode, nama] of wilayah) {
    if (!KODE.test(kode)) { errors.push(`invalid kode: ${kode}`); continue; }
    if (seen.has(kode)) errors.push(`duplicate kode: ${kode}`);
    seen.add(kode);
    if (!nama.trim()) errors.push(`empty nama: ${kode}`);
    counts[levelOf(kode)]++;
  }
  for (const kode of seen) {
    if (kode.includes('.') && !seen.has(parentOf(kode))) errors.push(`orphan (parent missing): ${kode}`);
    if (levelOf(kode) === 'desa' && !/^\d{5}$/.test(kodepos.get(kode) ?? '')) errors.push(`missing or invalid postal code: ${kode}`);
  }
  for (const k of kodepos.keys()) if (!seen.has(k)) errors.push(`postal code for unknown wilayah: ${k}`);
  for (const l of LEVELS) {
    if (counts[l] !== EXPECTED[l]) errors.push(`count ${l} is ${counts[l]}, expected ${EXPECTED[l]}`);
  }
  return errors;
}

/**
 * Split into files keyed by output path. Rows are tuples to keep files small:
 * [kode, nama] for provinsi/kabupaten/kecamatan, [kode, nama, kodepos] for desa.
 * Level, induk and tipe are derived from kode/nama by core (packages/core/src/wilayah.ts).
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
