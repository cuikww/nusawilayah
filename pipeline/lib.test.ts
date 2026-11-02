import { describe, expect, it } from 'vitest';
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
  const errs = (r = rows, p = pos) => validate(r, p).filter((e) => !e.startsWith('jumlah'));

  it('passes clean data apart from national counts', () => {
    expect(errs()).toEqual([]);
    expect(validate(rows, pos)).toContain('jumlah provinsi 1, seharusnya 38');
  });
  it('catches duplicates, orphans, bad kode, missing kode pos', () => {
    expect(errs([...rows, ['51', 'Bali']])).toContain('kode ganda: 51');
    expect(errs([...rows, ['52.01', 'X']])).toContain('wilayah yatim: 52.01');
    expect(errs([...rows, ['51.3', 'X']])).toContain('kode tidak valid: 51.3');
    expect(errs(rows, new Map())).toContain('kode pos tidak ada/tidak valid: 51.03.01.1001');
    expect(errs(rows, new Map([...pos, ['99.99.99.9999', '12345']]))).toContain('kode pos untuk wilayah tak dikenal: 99.99.99.9999');
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
