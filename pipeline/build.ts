// Build @nusawilayah/data (dist/ for the JS client, export/ for SQLite + CSV) from pinned cahyadsn sources.
// Exits 1 without writing anything if a check fails.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { toCsv, toRecords, writeSqlite } from './export.ts';
import { aliases, diff } from './history.ts';
import { crosscheck, EXPECTED, parseCsv, parseTuples, split, validate } from './lib.ts';

interface Source { repo: string; commit: string; path: string }

// Bump these commits to pick up a new data release.
const SOURCES = {
  wilayah: { repo: 'cahyadsn/wilayah', commit: '13f7b79b8e3fe066a6bab0302e9e3d797ee2f377', path: 'db/wilayah.sql' },
  kodepos: { repo: 'cahyadsn/wilayah_kodepos', commit: 'ba8497156c5cc9bcbfc527f7b8875d403eda2354', path: 'db/wilayah_kodepos.sql' },
} satisfies Record<string, Source>;
// Older editions, oldest first. Their names become search aliases; the last one is the previous edition
// that changes.json compares against. wilayah_2023.sql holds Kepmendagri No. 100.1.1-6117 Tahun 2022.
const ARCHIVES = [
  { ...SOURCES.wilayah, path: 'db/archive/wilayah_2022.sql', dasarHukum: 'cahyadsn/wilayah archive wilayah_2022' },
  { ...SOURCES.wilayah, path: 'db/archive/wilayah_2023.sql', dasarHukum: 'Kepmendagri No. 100.1.1-6117 Tahun 2022' },
];
// Second source for a name cross-check (PRD: differences are reported, never fail the build).
const CROSSCHECK = { repo: 'fityannugroho/idn-area-data', commit: '6898b16904040ae94a6fc95d2db9b1f282b38367' };
const DASAR_HUKUM = 'Kepmendagri No. 300.2.2-2430 Tahun 2025';
const ATRIBUSI = 'Data © cahya dsn (MIT). Region codes and names from Kepmendagri No. 300.2.2-2430 Tahun 2025.';

const here = import.meta.dirname;
const cacheDir = join(here, '.cache');
const dataDir = join(here, '../packages/data');
const outDir = join(dataDir, 'dist');
const exportDir = join(dataDir, 'export');

async function source({ repo, commit, path }: Source) {
  const file = join(cacheDir, `${repo.replace('/', '__')}@${commit}__${path.split('/').pop()}`);
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

const second = new Map<string, string>();
for (const level of ['provinces', 'regencies', 'districts', 'villages']) {
  for (const row of parseCsv(await source({ ...CROSSCHECK, path: `data/${level}.csv` })).slice(1)) second.set(row[0], row.at(-1)!);
}
const crossDiffs = crosscheck(wilayah, second);

const archives = await Promise.all(ARCHIVES.map(async (a) => parseTuples(await source(a))));
const alias = aliases(wilayah, archives);
const previous = ARCHIVES[ARCHIVES.length - 1];
const changes = diff(archives[archives.length - 1], wilayah, previous.dasarHukum, DASAR_HUKUM);

const versi: string = JSON.parse(readFileSync(join(dataDir, 'package.json'), 'utf8')).version;
const sumber = [...Object.values(SOURCES), ...ARCHIVES].map((s) => `https://github.com/${s.repo}/blob/${s.commit}/${s.path}`);
const dibangun = new Date().toISOString();

const files: Map<string, unknown> = split(wilayah, kodepos, alias);
files.set('changes.json', changes);
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

const exportData = { records: toRecords(wilayah, kodepos), alias, changes };
for (const [path, csv] of toCsv(exportData)) write(exportDir, path, csv);
const sqlite = join(exportDir, 'nusawilayah.sqlite');
writeSqlite(sqlite, exportData, { versi, dasar_hukum: DASAR_HUKUM, dibangun, sumber: sumber.join(' '), atribusi: ATRIBUSI });

const kb = (n: number) => (n / 1024).toFixed(2) + ' KB';
console.log(`${files.size} files → ${outDir}, SQLite + CSV → ${exportDir}`);
for (const [group, sizes] of Object.entries(stats)) {
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  console.log(`${group.padEnd(14)} ${String(sizes.length).padStart(5)} files  avg ${kb(avg)}  max ${kb(Math.max(...sizes))} (gzip)`);
}
console.log(`nusawilayah.sqlite        ${kb(statSync(sqlite).size)}`);
console.log(`alias: ${[...alias.values()].flat().length} old names for ${alias.size} wilayah`);
const n = (k: 'gantiNama' | 'pindah' | 'dihapus' | 'baru') => changes[k].length;
console.log(`changes since ${changes.dari}: ${n('gantiNama')} renamed, ${n('pindah')} moved, ${n('dihapus')} removed, ${n('baru')} new`);
console.log(`names differing from ${CROSSCHECK.repo} (report only): ${crossDiffs.length}`);
for (const line of crossDiffs.slice(0, 100)) console.log(`  ${line}`);
