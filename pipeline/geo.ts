// Build @nusawilayah/geo-data from the BPS boundaries published by OCHA on HDX (cod-ab-idn, CC BY 3.0 IGO):
// TopoJSON, GeoJSON and SVG per level. Kode and names come from the built @nusawilayah/data (run build:data
// first). BPS codes differ from Kemendagri codes below the kabupaten, and units changed since 2020, so units are
// paired by name: every kabupaten must pair, kecamatan created after 2020 have no boundary and are listed in meta.json.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gzipSync } from 'node:zlib';
import mapshaper from 'mapshaper';
import { isKota, matchNames, withoutType, type Feature } from './geolib.ts';

const SOURCE = {
  name: 'Indonesia - Subnational Administrative Boundaries (COD-AB), v01',
  url: 'https://data.humdata.org/dataset/cod-ab-idn',
  attribution: 'BPS (Badan Pusat Statistik), OCHA ROAP; via HDX',
  license: 'CC BY 3.0 IGO',
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/igo/',
  validOn: '2020-04-01',
  file: 'idn_admin_boundaries.geojson.zip',
  sha256: 'd285a40f9fc4b726b1bda98ee833d52d23d94fe78b6a47c0a769d2e912ff0970',
  // HDX refuses scripted downloads, so CI gets the same file (checked by sha256) from this repo's release assets.
  mirror: 'https://github.com/cuikww/nusawilayah/releases/download/geo-source/idn_admin_boundaries.geojson.zip',
};
// Simplification tolerance per level in meters (PRD F4.2): coarse for all of Indonesia, finer when one province
// fills the view. A distance keeps detail even across provinces of very different sizes, unlike a share of points.
const SIMPLIFY = { provinsi: 1000, kabupaten: 300, kecamatan: 200 } as const;
type Level = keyof typeof SIMPLIFY;
// SVG/HTML id prefix per level (PRD F4.8): kab-51-03 can be styled with CSS.
const ID_PREFIX: Record<Level, string> = { provinsi: 'prov', kabupaten: 'kab', kecamatan: 'kec' };
// Largest file allowed per level, gzip TopoJSON (PRD: all of Indonesia at provinsi level under 150 KB).
const BUDGET_KB: Record<Level, number> = { provinsi: 150, kabupaten: 50, kecamatan: 100 };
// Lakes, reservoirs, forest and sea areas are units in the source but not regions (BPS codes ID1388, ID3399,
// ID1106888, ID1803555): left out, they show as holes.
const NOT_REGION = /^ID\d\d(88|99)$|(555|888|999)$/;
// Kabupaten renamed since 2020 (or spelt differently), by BPS code.
const RENAMED: Record<string, string> = { ID1206: 'Toba', ID6302: 'Kotabaru', ID7605: 'Pasangkayu', ID8101: 'Kepulauan Tanimbar' };
// Kecamatan names must be at least this similar (geolib similarity); lower pairs were wrong when reviewed.
const MIN_SIMILARITY = 0.6;
// Fail the build if fewer kecamatan than this have a boundary: catches a broken source or matching.
const MIN_KECAMATAN_COVERAGE = 0.95;

const here = import.meta.dirname;
const cacheDir = join(here, '.cache');
const dataDir = join(here, '../packages/data/dist');
const outDir = join(here, '../packages/geo-data/dist');

async function sourceZip() {
  const file = join(cacheDir, SOURCE.file);
  if (!existsSync(file)) {
    console.log(`downloading ${SOURCE.mirror}`);
    const res = await fetch(SOURCE.mirror);
    if (!res.ok || !res.body) throw new Error(`failed to download ${SOURCE.mirror}: HTTP ${res.status}. Or download ${SOURCE.file} from ${SOURCE.url} into ${cacheDir}`);
    mkdirSync(cacheDir, { recursive: true });
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file));
  }
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  if (hash.digest('hex') !== SOURCE.sha256) throw new Error(`${file} does not match the pinned sha256; delete it and run again`);
  return file;
}

interface Unit { pcode: string; name: string; kab: string; geometry: Feature['geometry'] }

/** One level of the source (2 kabupaten, 3 kecamatan), lightly simplified so the rest of the build stays fast. */
async function units(zip: string, adm: 2 | 3): Promise<Unit[]> {
  const name = `idn_admin${adm}.geojson`;
  if (!existsSync(join(cacheDir, name))) execFileSync('unzip', ['-o', '-q', zip, name, '-d', cacheDir]);
  const out = await mapshaper.applyCommands(
    `-i "${join(cacheDir, name)}" -filter-fields adm${adm}_pcode,adm${adm}_name,adm2_pcode -simplify interval=50 keep-shapes ` +
      `-o out.json format=geojson precision=0.00001`,
    {},
  );
  type Raw = { properties: Record<string, string>; geometry: Feature['geometry'] | null };
  return (JSON.parse(out['out.json']).features as Raw[])
    .filter((f) => f.geometry && !NOT_REGION.test(f.properties[`adm${adm}_pcode`]))
    .map((f) => ({ pcode: f.properties[`adm${adm}_pcode`], name: f.properties[`adm${adm}_name`], kab: f.properties.adm2_pcode, geometry: f.geometry! }));
}

const rows = (path: string): [string, string][] => JSON.parse(readFileSync(join(dataDir, path), 'utf8'));
if (!existsSync(join(dataDir, 'provinsi.json'))) throw new Error('build @nusawilayah/data first (pnpm --filter @nusawilayah/pipeline build:data)');
const provinsi = rows('provinsi.json');
const kabupaten = provinsi.flatMap(([p]) => rows(`kabupaten/${p}.json`));
const kecamatan = kabupaten.flatMap(([k]) => rows(`kecamatan/${k}.json`));
const names = new Map<Level, Map<string, string>>([['provinsi', new Map(provinsi)], ['kabupaten', new Map(kabupaten)], ['kecamatan', new Map(kecamatan)]]);

const zip = await sourceZip();
const [bpsKab, bpsKec] = [await units(zip, 2), await units(zip, 3)];
const errors: string[] = [];
const review: string[] = [];

// Kabupaten: kota with kota, kabupaten with kabupaten, so Kota Tegal never pairs with Kabupaten Tegal.
const kabOf = new Map<string, string>();
for (const kota of [true, false]) {
  const source = bpsKab.filter((u) => isKota(u.pcode) === kota).map((u) => ({ id: u.pcode, name: withoutType(RENAMED[u.pcode] ?? u.name) }));
  const official = kabupaten.filter(([k]) => isKota(k) === kota).map(([k, n]): [string, string] => [k, withoutType(n)]);
  for (const [pcode, m] of matchNames(source, official, 0.75)) {
    kabOf.set(pcode, m.kode);
    if (m.score < 1) review.push(`kabupaten ${pcode} ${bpsKab.find((u) => u.pcode === pcode)!.name} → ${m.kode} ${names.get('kabupaten')!.get(m.kode)} (${m.score.toFixed(2)})`);
  }
}
for (const u of bpsKab) if (!kabOf.has(u.pcode)) errors.push(`kabupaten: BPS ${u.pcode} ${u.name} pairs with no kode`);
const withBoundary = new Set(kabOf.values());
for (const [kode, nama] of kabupaten) if (!withBoundary.has(kode)) errors.push(`kabupaten: no boundary for ${kode} ${nama}`);

// Kecamatan: by name within their kabupaten.
const kecOf = new Map<string, string>();
const kecByKab = Map.groupBy(kecamatan, ([k]) => k.slice(0, 5));
for (const [bpsKabCode, list] of Map.groupBy(bpsKec, (u) => u.kab)) {
  const kab = kabOf.get(bpsKabCode);
  if (!kab) continue;
  for (const [pcode, m] of matchNames(list.map((u) => ({ id: u.pcode, name: u.name })), kecByKab.get(kab) ?? [], MIN_SIMILARITY)) {
    kecOf.set(pcode, m.kode);
    if (m.score < 0.8) review.push(`kecamatan ${pcode} ${list.find((u) => u.pcode === pcode)!.name} → ${m.kode} ${names.get('kecamatan')!.get(m.kode)} (${m.score.toFixed(2)})`);
  }
}
const kecWithBoundary = new Set(kecOf.values());
const tanpaBatas = kecamatan.filter(([k]) => !kecWithBoundary.has(k)).map(([k]) => k);
const coverage = kecWithBoundary.size / kecamatan.length;
if (coverage < MIN_KECAMATAN_COVERAGE) errors.push(`kecamatan: only ${(coverage * 100).toFixed(1)}% have a boundary (minimum ${MIN_KECAMATAN_COVERAGE * 100}%)`);

if (errors.length) {
  console.error(`Boundary check failed (${errors.length}):\n` + errors.slice(0, 50).join('\n'));
  process.exit(1);
}

const feature = (kode: string, geometry: Feature['geometry']): Feature => ({ type: 'Feature', kode, geometry });
const features: Record<Level, Feature[]> = {
  kabupaten: bpsKab.map((u) => feature(kabOf.get(u.pcode)!, u.geometry)),
  kecamatan: bpsKec.filter((u) => kecOf.has(u.pcode)).map((u) => feature(kecOf.get(u.pcode)!, u.geometry)),
  provinsi: [],
};
// Provinsi are the union of their kabupaten, so the four provinces created in Papua in 2022 come out right.
const dissolved = await mapshaper.applyCommands('-i in.json -dissolve prov -o out.json format=geojson', {
  'in.json': { type: 'FeatureCollection', features: features.kabupaten.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { prov: f.kode.slice(0, 2) } })) },
});
features.provinsi = (JSON.parse(dissolved['out.json']).features as { properties: { prov: string }; geometry: Feature['geometry'] }[]).map((f) => feature(f.properties.prov, f.geometry));

/** One map file set: all provinces, or one province's kabupaten or kecamatan. */
async function write(level: Level, name: string, list: Feature[]) {
  const collection = {
    type: 'FeatureCollection',
    features: list.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { kode: f.kode, nama: names.get(level)!.get(f.kode)!, id: `${ID_PREFIX[level]}-${f.kode.replaceAll('.', '-')}` } })),
  };
  const out = await mapshaper.applyCommands(
    // -clean must come first: run after -simplify it rebuilds the full-resolution arcs.
    `-i in.json name=wilayah -clean -simplify interval=${SIMPLIFY[level]} keep-shapes ` +
      `-o ${name}.topo.json format=topojson quantization=100000 ` +
      `-o ${name}.geojson format=geojson precision=0.0001 ` +
      `-o ${name}.svg format=svg id-field=id`,
    { 'in.json': collection },
  );
  for (const [file, content] of Object.entries(out)) {
    const path = join(outDir, level === 'provinsi' ? '' : level, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    const gz = gzipSync(content).length;
    (stats[`${level} ${file.split('.').slice(1).join('.')}`] ??= []).push(gz);
    if (file.endsWith('.topo.json') && gz > BUDGET_KB[level] * 1024) overBudget.push(`${level}/${file}: ${(gz / 1024).toFixed(1)} KB > ${BUDGET_KB[level]} KB`);
  }
}

rmSync(outDir, { recursive: true, force: true });
const stats: Record<string, number[]> = {};
const overBudget: string[] = [];
await write('provinsi', 'provinsi', features.provinsi);
for (const [p] of provinsi) {
  await write('kabupaten', p, features.kabupaten.filter((f) => f.kode.startsWith(`${p}.`)));
  await write('kecamatan', p, features.kecamatan.filter((f) => f.kode.startsWith(`${p}.`)));
}
writeFileSync(join(outDir, 'meta.json'), JSON.stringify({
  sumber: { nama: SOURCE.name, url: SOURCE.url, atribusi: SOURCE.attribution, lisensi: SOURCE.license, berlakuSejak: SOURCE.validOn },
  penyederhanaanMeter: SIMPLIFY,
  idPrefix: ID_PREFIX,
  jumlah: { provinsi: features.provinsi.length, kabupaten: features.kabupaten.length, kecamatan: features.kecamatan.length },
  // Kecamatan created after the source's date: their area is still drawn as part of the kecamatan they split from.
  kecamatanTanpaBatas: tanpaBatas,
  penafian: 'Batas wilayah adalah ilustrasi, bukan batas hukum. Batas resmi mengacu pada Kemendagri dan Badan Informasi Geospasial (BIG).',
}, null, 2));

const kb = (n: number) => (n / 1024).toFixed(1) + ' KB';
console.log(`geo → ${outDir}`);
console.log(`pairs to review (similar, not equal names):\n  ${review.join('\n  ')}`);
console.log(`kecamatan with a boundary: ${kecWithBoundary.size} of ${kecamatan.length} (${(coverage * 100).toFixed(1)}%)`);
for (const [group, sizes] of Object.entries(stats)) {
  console.log(`${group.padEnd(22)} ${String(sizes.length).padStart(3)} files  max ${kb(Math.max(...sizes))}  total ${kb(sizes.reduce((a, b) => a + b, 0))} (gzip)`);
}
if (overBudget.length) {
  console.error(`Size budget exceeded:\n${overBudget.join('\n')}`);
  process.exit(1);
}
