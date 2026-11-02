// Build @nusawilayah/geo-data from pinned cahyadsn/wilayah_boundaries: TopoJSON, GeoJSON and SVG per level.
// Kode and names come from the built @nusawilayah/data (run build:data first); every boundary must pair with
// a kode there and the other way round, or this exits 1 without writing anything.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import mapshaper from 'mapshaper';
import { pairing, parseBoundaries, type Feature } from './geolib.ts';

const SOURCE = { repo: 'cahyadsn/wilayah_boundaries', commit: '2c0d8c791af7ca55ee06d17b8f34813e8e6bf1b1' };
// Share of points kept per level (PRD F4.2): coarse for all of Indonesia, finer when one province fills the view.
const SIMPLIFY = { provinsi: '5%', kabupaten: '15%', kecamatan: '15%' } as const;
type Level = keyof typeof SIMPLIFY;

const here = import.meta.dirname;
const cacheDir = join(here, '.cache');
const dataDir = join(here, '../packages/data/dist');
const outDir = join(here, '../packages/geo-data/dist');

async function source(path: string) {
  const file = join(cacheDir, `${SOURCE.repo.replace('/', '__')}@${SOURCE.commit}__${path.split('/').pop()}`);
  if (!existsSync(file)) {
    const res = await fetch(`https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.commit}/db/${path}`);
    if (!res.ok) throw new Error(`failed to download ${SOURCE.repo}/db/${path}: HTTP ${res.status}`);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, await res.text());
  }
  return readFileSync(file, 'utf8');
}

const rows = (path: string): [string, string][] => JSON.parse(readFileSync(join(dataDir, path), 'utf8'));
if (!existsSync(join(dataDir, 'provinsi.json'))) throw new Error('build @nusawilayah/data first (pnpm --filter @nusawilayah/pipeline build:data)');
const provinsi = rows('provinsi.json');
const official = new Map<Level, Map<string, string>>([
  ['provinsi', new Map(provinsi)],
  ['kabupaten', new Map(provinsi.flatMap(([p]) => rows(`kabupaten/${p}.json`)))],
]);
official.set('kecamatan', new Map([...official.get('kabupaten')!.keys()].flatMap((k) => rows(`kecamatan/${k}.json`))));

const features: Record<Level, Feature[]> = { provinsi: [], kabupaten: [], kecamatan: [] };
for (let i = 1; i <= 8; i++) features.provinsi.push(...parseBoundaries(await source(`prov/wilayah_boundaries_prov_${i}.sql`)));
for (const [p] of provinsi) {
  features.kabupaten.push(...parseBoundaries(await source(`kab/wilayah_boundaries_kab_${p}.sql`)));
  features.kecamatan.push(...parseBoundaries(await source(`kec/wilayah_boundaries_kec_${p}.sql`)));
}

const errors = (Object.keys(SIMPLIFY) as Level[]).flatMap((level) => pairing(level, features[level], official.get(level)!));
if (errors.length) {
  console.error(`Boundary check failed (${errors.length}):\n` + errors.slice(0, 50).join('\n'));
  process.exit(1);
}

/** One map file set: all provinces, or one province's kabupaten or kecamatan. */
async function write(level: Level, name: string, list: Feature[]) {
  const names = official.get(level)!;
  const collection = {
    type: 'FeatureCollection',
    features: list.map((f) => ({ ...f, properties: { kode: f.kode, nama: names.get(f.kode)!, id: `${level.slice(0, 4)}-${f.kode.replaceAll('.', '-')}` } })),
  };
  const out = await mapshaper.applyCommands(
    `-i in.json name=wilayah -simplify ${SIMPLIFY[level]} keep-shapes -clean ` +
      `-o ${name}.topo.json format=topojson quantization=100000 ` +
      `-o ${name}.geojson format=geojson precision=0.0001 ` +
      `-o ${name}.svg format=svg id-field=id`,
    { 'in.json': collection },
  );
  for (const [file, content] of Object.entries(out)) {
    const path = join(outDir, level === 'provinsi' ? '' : level, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content as string);
    (stats[`${level} ${file.split('.').slice(1).join('.')}`] ??= []).push(gzipSync(content as string).length);
  }
}

rmSync(outDir, { recursive: true, force: true });
const stats: Record<string, number[]> = {};
await write('provinsi', 'provinsi', features.provinsi);
for (const [p] of provinsi) {
  await write('kabupaten', p, features.kabupaten.filter((f) => f.kode.startsWith(`${p}.`)));
  await write('kecamatan', p, features.kecamatan.filter((f) => f.kode.startsWith(`${p}.`)));
}
writeFileSync(join(outDir, 'meta.json'), JSON.stringify({
  sumber: `https://github.com/${SOURCE.repo}/tree/${SOURCE.commit}/db`,
  penyederhanaan: SIMPLIFY,
  penafian: 'Batas wilayah adalah ilustrasi, bukan batas hukum. Batas resmi mengacu pada Kemendagri dan Badan Informasi Geospasial (BIG).',
}, null, 2));

const kb = (n: number) => (n / 1024).toFixed(1) + ' KB';
console.log(`geo → ${outDir}`);
for (const [group, sizes] of Object.entries(stats)) {
  console.log(`${group.padEnd(22)} ${String(sizes.length).padStart(3)} files  max ${kb(Math.max(...sizes))}  total ${kb(sizes.reduce((a, b) => a + b, 0))} (gzip)`);
}
