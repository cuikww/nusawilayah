import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const cli = join(import.meta.dirname, 'nusawilayah.mjs');

test('copy writes the JSON data to the target folder', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'nw-cli-'));
  const out = execFileSync(process.execPath, [cli, 'copy', 'public/wilayah'], { cwd, encoding: 'utf8' });
  assert.match(out, /Copied @nusawilayah\/data/);
  assert.match(out, /baseUrl: '\/wilayah'/);
  assert.equal(JSON.parse(readFileSync(join(cwd, 'public/wilayah/provinsi.json'), 'utf8')).length, 38);
  assert.ok(existsSync(join(cwd, 'public/wilayah/desa/51.03.01.json')));
  assert.ok(!existsSync(join(cwd, 'public/wilayah/export')), 'SQLite/CSV are not copied');
});

test('prints usage for a missing folder', () => {
  assert.throws(() => execFileSync(process.execPath, [cli, 'copy'], { stdio: 'pipe' }), /Usage/);
});
