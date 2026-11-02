#!/usr/bin/env node
// Copies the JSON data of this package (dist/) to a static folder, for self-hosting:
//   npx nusawilayah copy public/wilayah
// then: createWilayah({ baseUrl: '/wilayah' })
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const [command, target] = process.argv.slice(2);

if (command !== 'copy' || !target) {
  console.error('Usage: nusawilayah copy <folder>    e.g. nusawilayah copy public/wilayah');
  process.exit(1);
}
if (!existsSync(join(dist, 'meta.json'))) {
  console.error(`nusawilayah: no data found in ${dist}`);
  process.exit(1);
}

const dest = resolve(target);
cpSync(dist, dest, { recursive: true });
const { versi } = JSON.parse(readFileSync(join(dist, 'meta.json'), 'utf8'));
const count = readdirSync(dest, { recursive: true }).length;
const [webRoot, ...urlPath] = relative(process.cwd(), dest).split(/[\\/]/);
console.log(`Copied @nusawilayah/data ${versi} (${count} entries) to ${relative(process.cwd(), dest) || '.'}`);
if (urlPath.length) console.log(`If ${webRoot}/ is your web root: createWilayah({ baseUrl: '/${urlPath.join('/')}' })`);
