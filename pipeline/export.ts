// Non-JS outputs of the same validated data: one SQLite database and CSV files (docs/SPEC.md).
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LEVELS, levelOf, parentOf, tipeOf, type Level } from '../packages/core/src/wilayah.ts';
import type { Changes } from './history.ts';

/** One wilayah with every derived field, as stored in SQLite and CSV. */
export interface WilayahRecord {
  kode: string;
  nama: string;
  level: Level;
  induk: string | null;
  tipe: string | null;
  kodePos: string | null;
}

export interface ExportData {
  records: WilayahRecord[];
  /** Old names per kode. */
  alias: Map<string, string[]>;
  changes: Changes;
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

/** One flat row per change: [jenis, kode_lama, kode_baru, nama_lama, nama_baru]. */
export function changeRows(c: Changes): (string | null)[][] {
  return [
    ...c.gantiNama.map(([kode, lama, baru]) => ['ganti_nama', kode, kode, lama, baru]),
    ...c.pindah.map(([lama, baru, nama]) => ['pindah', lama, baru, nama, nama]),
    ...c.dihapus.map(([kode, nama]) => ['dihapus', kode, null, nama, null]),
    ...c.baru.map(([kode, nama]) => ['baru', null, kode, null, nama]),
  ];
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
const csv = (head: string[], rows: unknown[][]) => [head, ...rows].map((r) => r.map(field).join(',')).join('\n') + '\n';

/** `csv/*.csv` → file content (UTF-8, LF line endings, header row): one file per level, plus alias and perubahan. */
export function toCsv({ records, alias, changes }: ExportData) {
  const files = new Map<string, string>();
  for (const level of LEVELS) {
    const cols = CSV_COLUMNS[level];
    const rows = records.filter((r) => r.level === level).map((r) => cols.map((c) => r[c]));
    files.set(`csv/${level}.csv`, csv(cols.map(header), rows));
  }
  files.set('csv/alias.csv', csv(['kode', 'nama'], [...alias].flatMap(([kode, names]) => names.map((n) => [kode, n]))));
  files.set('csv/perubahan.csv', csv(['jenis', 'kode_lama', 'kode_baru', 'nama_lama', 'nama_baru'], changeRows(changes)));
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
CREATE TABLE alias (
  kode TEXT NOT NULL REFERENCES wilayah (kode),
  nama TEXT NOT NULL,
  PRIMARY KEY (kode, nama)
) WITHOUT ROWID;
CREATE TABLE perubahan (
  jenis     TEXT NOT NULL CHECK (jenis IN ('ganti_nama', 'pindah', 'dihapus', 'baru')),
  kode_lama TEXT,
  kode_baru TEXT,
  nama_lama TEXT,
  nama_baru TEXT
);
CREATE INDEX perubahan_kode_lama ON perubahan (kode_lama);
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

/** Writes a fresh SQLite database to `file` (replacing any existing one). */
export function writeSqlite(file: string, { records, alias, changes }: ExportData, meta: Record<string, string>) {
  rmSync(file, { force: true });
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(SQLITE_SCHEMA);
    db.exec('BEGIN');
    const insert = db.prepare('INSERT INTO wilayah (kode, nama, level, induk, tipe, kode_pos) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of records) insert.run(r.kode, r.nama, r.level, r.induk, r.tipe, r.kodePos);
    const addAlias = db.prepare('INSERT INTO alias (kode, nama) VALUES (?, ?)');
    for (const [kode, names] of alias) for (const n of names) addAlias.run(kode, n);
    const addChange = db.prepare('INSERT INTO perubahan (jenis, kode_lama, kode_baru, nama_lama, nama_baru) VALUES (?, ?, ?, ?, ?)');
    for (const row of changeRows(changes)) addChange.run(...row);
    const setMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(meta)) setMeta.run(k, v);
    db.exec('COMMIT');
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}
