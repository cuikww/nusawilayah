import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { toCsv, toRecords, writeSqlite } from './export.ts';
import { parseTuples, split, validate } from './lib.ts';

describe('parseTuples', () => {
  it('reads both dumps and unescapes SQL quotes', () => {
    expect(parseTuples("VALUES\n('11','Aceh'),\n('11.01.02.2018','Pasi Kuala Ba''u');")).toEqual([
      ['11', 'Aceh'],
      ['11.01.02.2018', "Pasi Kuala Ba'u"],
    ]);
    expect(parseTuples("('11.01.01.2001', '23773'),")).toEqual([['11.01.01.2001', '23773']]);
  });
});

describe('validate', () => {
  const rows: [string, string][] = [['51', 'Bali'], ['51.03', 'Kabupaten Badung'], ['51.03.01', 'Kuta'], ['51.03.01.1001', 'Tuban']];
  const pos = new Map([['51.03.01.1001', '80361']]);
  const errs = (r = rows, p = pos) => validate(r, p).filter((e) => !e.startsWith('count'));

  it('passes clean data apart from national counts', () => {
    expect(errs()).toEqual([]);
    expect(validate(rows, pos)).toContain('count provinsi is 1, expected 38');
  });
  it('catches duplicates, orphans, bad kode, missing kode pos', () => {
    expect(errs([...rows, ['51', 'Bali']])).toContain('duplicate kode: 51');
    expect(errs([...rows, ['52.01', 'X']])).toContain('orphan (parent missing): 52.01');
    expect(errs([...rows, ['51.3', 'X']])).toContain('invalid kode: 51.3');
    expect(errs(rows, new Map())).toContain('missing or invalid postal code: 51.03.01.1001');
    expect(errs(rows, new Map([...pos, ['99.99.99.9999', '12345']]))).toContain('postal code for unknown wilayah: 99.99.99.9999');
  });
});

describe('split', () => {
  it('writes one file per parent plus kode pos index', () => {
    const files = split([['51', 'Bali'], ['51.03', 'Kabupaten Badung'], ['51.03.01', 'Kuta'], ['51.03.01.1001', 'Tuban']], new Map([['51.03.01.1001', '80361']]));
    expect(Object.fromEntries(files)).toEqual({
      'provinsi.json': [['51', 'Bali']],
      'kabupaten/51.json': [['51.03', 'Kabupaten Badung']],
      'kecamatan/51.03.json': [['51.03.01', 'Kuta']],
      'desa/51.03.01.json': [['51.03.01.1001', 'Tuban', '80361']],
      'search/nasional.json': [['51', 'Bali'], ['51.03', 'Kabupaten Badung'], ['51.03.01', 'Kuta']],
      'search/51.json': [['51.03.01.1001', 'Tuban']],
      'kodepos/80.json': { '80361': [['51.03.01.1001', 'Tuban']] },
    });
  });
});

describe('exports', () => {
  const rows: [string, string][] = [['51', 'Bali'], ['51.03', 'Kabupaten Badung'], ['51.03.01', 'Kuta'], ['51.03.01.1001', 'Tuban'], ['51.03.01.2099', 'Desa "Uji", Satu']];
  const pos = new Map([['51.03.01.1001', '80361'], ['51.03.01.2099', '80362']]);
  const records = toRecords(rows, pos);

  it('writes one CSV per level with level-specific columns and RFC 4180 quoting', () => {
    const csv = toCsv(records);
    expect(csv.get('csv/provinsi.csv')).toBe('kode,nama\n51,Bali\n');
    expect(csv.get('csv/kabupaten.csv')).toBe('kode,induk,nama,tipe\n51.03,51,Kabupaten Badung,kabupaten\n');
    expect(csv.get('csv/desa.csv')).toBe(
      'kode,induk,nama,tipe,kode_pos\n51.03.01.1001,51.03.01,Tuban,kelurahan,80361\n51.03.01.2099,51.03.01,"Desa ""Uji"", Satu",desa,80362\n',
    );
  });

  it('writes a queryable SQLite database', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'nw-')), 'test.sqlite');
    writeSqlite(file, records, { versi: '0.0.0' });
    const db = new DatabaseSync(file, { readOnly: true });
    expect(db.prepare('SELECT kode, nama FROM wilayah WHERE induk = ? ORDER BY kode').all('51.03.01')).toEqual([
      { kode: '51.03.01.1001', nama: 'Tuban' },
      { kode: '51.03.01.2099', nama: 'Desa "Uji", Satu' },
    ]);
    expect(db.prepare('SELECT level, tipe, induk FROM wilayah WHERE kode_pos = ?').get('80361')).toEqual({ level: 'desa', tipe: 'kelurahan', induk: '51.03.01' });
    expect(db.prepare("SELECT value FROM meta WHERE key = 'versi'").get()).toEqual({ value: '0.0.0' });
    db.close();
  });
});
