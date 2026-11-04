import { describe, expect, it } from 'vitest';
import { isKota, matchNames, normName, similarity, withoutType } from './geolib.ts';

describe('normName', () => {
  it('spells out Roman numerals and abbreviations, and keeps "Kota" inside kecamatan names', () => {
    expect(normName('Kotabaru')).toBe(normName('Kota Baru'));
    expect(normName('Ilir Timur III')).toBe(normName('Ilir Timur Tiga'));
    expect(normName('P. Haruku')).toBe(normName('Pulau Haruku'));
    expect(normName(withoutType('Kabupaten Kep. Siau Tagulandang Biaro'))).toBe('kepulauansiautagulandangbiaro');
  });
  it('withoutType drops the kabupaten/kota prefix', () => {
    expect(withoutType('Kota Administrasi Jakarta Pusat')).toBe('Jakarta Pusat');
    expect(withoutType('Kabupaten Badung')).toBe('Badung');
  });
});

describe('similarity', () => {
  it('scores spelling variants high and different names low', () => {
    expect(similarity('bohorok', 'bahorok')).toBeGreaterThan(0.6);
    expect(similarity(normName('Ilir Barat II'), normName('Ilir Barat Satu'))).toBeLessThan(similarity(normName('Ilir Barat II'), normName('Ilir Barat Dua')));
    expect(similarity('kuta', 'kuta')).toBe(1);
  });
});

describe('matchNames', () => {
  const official: [string, string][] = [['13.05.01', 'Lubuak Aluang'], ['13.05.02', 'Batang Anai'], ['13.05.17', 'Anam Lingkuang']];
  it('pairs one to one, best first, and leaves dissimilar names unpaired', () => {
    const m = matchNames(
      [{ id: 'A', name: 'Lubuk Alung' }, { id: 'B', name: 'Batang Anai' }, { id: 'C', name: 'Batang Anai' }, { id: 'D', name: 'Sungai Limau' }],
      official,
      0.6,
    );
    expect(m.get('A')?.kode).toBe('13.05.01');
    expect(m.get('B')).toEqual({ kode: '13.05.02', score: 1 });
    expect(m.has('C')).toBe(false); // 13.05.02 is taken
    expect(m.has('D')).toBe(false);
  });
  it('accepts alternative names separated by a slash', () => {
    expect(matchNames([{ id: 'X', name: 'Konda/Kondaga' }], [['95.04.12', 'Kondaga']], 0.9).get('X')?.kode).toBe('95.04.12');
  });
});

it('isKota reads the kota digit in both code systems', () => {
  expect([isKota('ID3171'), isKota('31.71'), isKota('ID6302'), isKota('63.02')]).toEqual([true, true, false, false]);
});
