// Non-JS outputs of the same validated data: one SQLite database and one CSV per level (docs/SPEC.md).
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LEVELS, levelOf, parentOf, tipeOf, type Level } from '../packages/core/src/wilayah.ts';

/** One wilayah with every derived field, as stored in SQLite and CSV. */
export interface WilayahRecord {
  kode: string;
  nama: string;
  level: Level;
  induk: string | null;
  tipe: string | null;
  kodePos: string | null;
}

export function toRecords(wilayah: [string, string][], kodepos: Map<string, string>): WilayahRecord[] {
  return [...wilayah]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kode, nama]) => ({
      kode,
      nama,
      level: levelOf(kode),
      induk: parentOf(kode) || null,
      tipe: tipeOf(kode, nama) ?? null,
      kodePos: kodepos.get(kode) ?? null,
    }));
}

// Columns per level: only the ones that carry data at that level.
const CSV_COLUMNS: Record<Level, (keyof WilayahRecord)[]> = {
  provinsi: ['kode', 'nama'],
  kabupaten: ['kode', 'induk', 'nama', 'tipe'],
  kecamatan: ['kode', 'induk', 'nama'],
  desa: ['kode', 'induk', 'nama', 'tipe', 'kodePos'],
};
const header = (col: string) => (col === 'kodePos' ? 'kode_pos' : col);

/** RFC 4180 field: quoted only when it contains a comma, quote or newline. */
const field = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** `csv/{level}.csv` → file content (UTF-8, LF line endings, header row). */
export function toCsv(records: WilayahRecord[]) {
  const files = new Map<string, string>();
  for (const level of LEVELS) {
    const cols = CSV_COLUMNS[level];
    const lines = [cols.map(header).join(',')];
    for (const r of records) if (r.level === level) lines.push(cols.map((c) => field(r[c])).join(','));
    files.set(`csv/${level}.csv`, lines.join('\n') + '\n');
  }
  return files;
}

export const SQLITE_SCHEMA = `
CREATE TABLE wilayah (
  kode     TEXT PRIMARY KEY,
  nama     TEXT NOT NULL,
  level    TEXT NOT NULL CHECK (level IN ('provinsi', 'kabupaten', 'kecamatan', 'desa')),
  induk    TEXT REFERENCES wilayah (kode),
  tipe     TEXT CHECK (tipe IN ('kabupaten', 'kota', 'desa', 'kelurahan')),
  kode_pos TEXT
) WITHOUT ROWID;
CREATE INDEX wilayah_induk ON wilayah (induk);
CREATE INDEX wilayah_kode_pos ON wilayah (kode_pos);
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

/** Writes a fresh SQLite database to `file` (replacing any existing one). */
export function writeSqlite(file: string, records: WilayahRecord[], meta: Record<string, string>) {
  rmSync(file, { force: true });
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(SQLITE_SCHEMA);
    db.exec('BEGIN');
    const insert = db.prepare('INSERT INTO wilayah (kode, nama, level, induk, tipe, kode_pos) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of records) insert.run(r.kode, r.nama, r.level, r.induk, r.tipe, r.kodePos);
    const setMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(meta)) setMeta.run(k, v);
    db.exec('COMMIT');
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}
