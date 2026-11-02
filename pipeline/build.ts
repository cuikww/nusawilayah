// Build @nusawilayah/data/dist from pinned cahyadsn sources. Fails (exit 1) without writing if any check fails.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { EXPECTED, parseTuples, split, validate } from './lib.ts';

// Bump these commits to pick up a new data release.
const SOURCES = {
  wilayah: { repo: 'cahyadsn/wilayah', commit: '13f7b79b8e3fe066a6bab0302e9e3d797ee2f377', path: 'db/wilayah.sql' },
  kodepos: { repo: 'cahyadsn/wilayah_kodepos', commit: 'ba8497156c5cc9bcbfc527f7b8875d403eda2354', path: 'db/wilayah_kodepos.sql' },
};
const DASAR_HUKUM = 'Kepmendagri No. 300.2.2-2430 Tahun 2025';

const here = import.meta.dirname;
const cacheDir = join(here, '.cache');
const outDir = join(here, '../packages/data/dist');

async function source({ repo, commit, path }: (typeof SOURCES)[keyof typeof SOURCES]) {
  const file = join(cacheDir, `${repo.replace('/', '__')}@${commit}.sql`);
  if (!existsSync(file)) {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`);
    if (!res.ok) throw new Error(`gagal mengunduh ${repo}/${path}: HTTP ${res.status}`);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, await res.text());
  }
  return readFileSync(file, 'utf8');
}

const wilayah = parseTuples(await source(SOURCES.wilayah));
const kodepos = new Map(parseTuples(await source(SOURCES.kodepos)));

const errors = validate(wilayah, kodepos);
if (errors.length) {
  console.error(`Validasi gagal (${errors.length}):\n` + errors.slice(0, 50).join('\n'));
  process.exit(1);
}

const files = split(wilayah, kodepos);
files.set('meta.json', {
  dasarHukum: DASAR_HUKUM,
  dibangun: new Date().toISOString(),
  jumlah: EXPECTED,
  sumber: Object.values(SOURCES).map((s) => `https://github.com/${s.repo}/blob/${s.commit}/${s.path}`),
  atribusi: 'Data © cahya dsn (MIT). Kode & nama wilayah dari Kepmendagri.',
  format: { baris: '[kode, nama] — level desa: [kode, nama, kodePos]', kodepos: '{ kodePos: [[kode, nama]] }' },
});

rmSync(outDir, { recursive: true, force: true });
const stats: Record<string, number[]> = {};
for (const [path, data] of files) {
  const file = join(outDir, path);
  mkdirSync(dirname(file), { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(file, json);
  (stats[path.includes('/') ? path.split('/')[0] : path] ??= []).push(gzipSync(json).length);
}

const kb = (n: number) => (n / 1024).toFixed(2) + ' KB';
console.log(`${files.size} file → ${outDir}`);
for (const [group, sizes] of Object.entries(stats)) {
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  console.log(`${group.padEnd(14)} ${String(sizes.length).padStart(5)} file  rata-rata ${kb(avg)}  terbesar ${kb(Math.max(...sizes))} (gzip)`);
}
