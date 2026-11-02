// Build @nusawilayah/data (dist/ for the JS client, export/ for SQLite + CSV) from pinned cahyadsn sources. Exits 1 without writing anything if a check fails.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { toCsv, toRecords, writeSqlite } from './export.ts';
import { EXPECTED, parseTuples, split, validate } from './lib.ts';

// Bump these commits to pick up a new data release.
const SOURCES = {
  wilayah: { repo: 'cahyadsn/wilayah', commit: '13f7b79b8e3fe066a6bab0302e9e3d797ee2f377', path: 'db/wilayah.sql' },
  kodepos: { repo: 'cahyadsn/wilayah_kodepos', commit: 'ba8497156c5cc9bcbfc527f7b8875d403eda2354', path: 'db/wilayah_kodepos.sql' },
};
const DASAR_HUKUM = 'Kepmendagri No. 300.2.2-2430 Tahun 2025';
const ATRIBUSI = 'Data © cahya dsn (MIT). Region codes and names from Kepmendagri No. 300.2.2-2430 Tahun 2025.';

const here = import.meta.dirname;
const cacheDir = join(here, '.cache');
const dataDir = join(here, '../packages/data');
const outDir = join(dataDir, 'dist');
const exportDir = join(dataDir, 'export');

async function source({ repo, commit, path }: (typeof SOURCES)[keyof typeof SOURCES]) {
  const file = join(cacheDir, `${repo.replace('/', '__')}@${commit}.sql`);
  if (!existsSync(file)) {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`);
    if (!res.ok) throw new Error(`failed to download ${repo}/${path}: HTTP ${res.status}`);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, await res.text());
  }
  return readFileSync(file, 'utf8');
}

const wilayah = parseTuples(await source(SOURCES.wilayah));
const kodepos = new Map(parseTuples(await source(SOURCES.kodepos)));

const errors = validate(wilayah, kodepos);
if (errors.length) {
  console.error(`Validation failed (${errors.length}):\n` + errors.slice(0, 50).join('\n'));
  process.exit(1);
}

const versi: string = JSON.parse(readFileSync(join(dataDir, 'package.json'), 'utf8')).version;
const sumber = Object.values(SOURCES).map((s) => `https://github.com/${s.repo}/blob/${s.commit}/${s.path}`);
const dibangun = new Date().toISOString();

const files: Map<string, unknown> = split(wilayah, kodepos);
files.set('meta.json', {
  versi,
  dasarHukum: DASAR_HUKUM,
  dibangun,
  jumlah: EXPECTED,
  sumber,
  atribusi: ATRIBUSI,
  format: { baris: '[kode, nama], desa level: [kode, nama, kodePos]', kodepos: '{ kodePos: [[kode, nama]] }' },
});

for (const dir of [outDir, exportDir]) rmSync(dir, { recursive: true, force: true });
const stats: Record<string, number[]> = {};
const write = (root: string, path: string, content: string) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  (stats[path.includes('/') ? path.split('/')[0] : path] ??= []).push(gzipSync(content).length);
};
for (const [path, data] of files) write(outDir, path, JSON.stringify(data));

const records = toRecords(wilayah, kodepos);
for (const [path, csv] of toCsv(records)) write(exportDir, path, csv);
const sqlite = join(exportDir, 'nusawilayah.sqlite');
writeSqlite(sqlite, records, { versi, dasar_hukum: DASAR_HUKUM, dibangun, sumber: sumber.join(' '), atribusi: ATRIBUSI });

const kb = (n: number) => (n / 1024).toFixed(2) + ' KB';
console.log(`${files.size} files → ${outDir}, SQLite + CSV → ${exportDir}`);
for (const [group, sizes] of Object.entries(stats)) {
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  console.log(`${group.padEnd(14)} ${String(sizes.length).padStart(5)} files  avg ${kb(avg)}  max ${kb(Math.max(...sizes))} (gzip)`);
}
console.log(`nusawilayah.sqlite        ${kb(statSync(sqlite).size)}`);
