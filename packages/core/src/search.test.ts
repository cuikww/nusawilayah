import { describe, expect, it, vi } from 'vitest';
import { createWilayah } from './index.ts';
import { normalize } from './search.ts';

const files: Record<string, unknown> = {
  'search/nasional.json': [
    ['32', 'Jawa Barat'], ['32.01', 'Kabupaten Bogor'], ['32.71', 'Kota Bogor'], ['32.71.01', 'Bogor Selatan'],
    ['51', 'Bali'], ['51.03', 'Kabupaten Badung'], ['51.03.01', 'Kuta'], ['51.03.02', 'Kuta Selatan'],
    ['51.71', 'Kota Denpasar'], ['51.71.01', 'Denpasar Selatan'], ['51.03.06', 'Mengwi', 'Mengui Lama'],
  ],
  'search/51.json': [['51.03.01.1001', 'Tuban'], ['51.03.01.1005', 'Seminyak'], ['51.03.01.1002', 'Kuta']],
  'search/32.json': [['32.71.01.1001', "Ba'u"]],
  'kodepos/80.json': { '80361': [['51.03.01.1001', 'Tuban']] },
};
const make = () => {
  const fetcher = vi.fn(async (path: string) => {
    if (!(path in files)) throw Object.assign(new Error('404'), { status: 404 });
    return files[path];
  });
  return { w: createWilayah({ fetcher }), fetcher };
};
const labels = async (q: string, opts?: object) => (await make().w.search(q, opts)).map((r) => r.label);

describe('search', () => {
  it('prefix-matches names, ignores level words and case, shows the full path', async () => {
    expect(await labels('denpasar sel')).toEqual(['Denpasar Selatan, Kota Denpasar, Bali']);
    expect(await labels('KAB. Badung')).toEqual(['Badung, Bali']);
    expect((await labels('kuta')).slice(0, 2)).toEqual(['Kuta, Badung, Bali', 'Kuta, Kuta, Badung, Bali']);
  });

  it('ranks exact names first and treats "Kota X" as an exact match for "x"', async () => {
    expect((await labels('bogor')).slice(0, 2).sort()).toEqual(['Bogor, Jawa Barat', 'Kota Bogor, Jawa Barat']);
    expect(await labels('kota bogor')).toEqual(['Kota Bogor, Jawa Barat', 'Bogor Selatan, Kota Bogor, Jawa Barat']);
  });

  it('finds desa through a parent named in the query, loading only that provinsi', async () => {
    const { w, fetcher } = make();
    expect((await w.search('seminyak kuta')).map((r) => r.label)).toEqual(['Seminyak, Kuta, Badung, Bali']);
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['search/nasional.json', 'search/51.json']);
    expect((await w.search('seminyak kuta'))[0].wilayah).toMatchObject({ kode: '51.03.01.1005', level: 'desa', tipe: 'kelurahan' });
    expect(fetcher).toHaveBeenCalledTimes(2); // cached
  });

  it('honours levels, provinsi scope, limit, and apostrophes', async () => {
    expect(await labels('kuta', { levels: 3 })).not.toContain('Kuta, Kuta, Badung, Bali');
    expect(await labels('selatan', { provinsi: ['32'] })).toEqual(['Bogor Selatan, Kota Bogor, Jawa Barat']);
    expect(await labels('kuta', { limit: 1 })).toHaveLength(1);
    expect(await labels('bau', { provinsi: ['32'] })).toEqual(["Ba'u, Bogor Selatan, Kota Bogor, Jawa Barat"]);
    expect(await labels('kecamatan')).toEqual([]);
    expect(await labels('xyz')).toEqual([]);
  });

  it('matches former names and says which one matched', async () => {
    const [r] = await make().w.search('mengui');
    expect(r).toMatchObject({ label: 'Mengwi, Badung, Bali', alias: 'Mengui Lama', wilayah: { kode: '51.03.06', nama: 'Mengwi' } });
    expect((await make().w.search('mengwi'))[0].alias).toBeUndefined();
  });

  it('treats 5 digits as a kode pos', async () => {
    expect(await labels('80361')).toEqual(['Tuban, Kuta, Badung, Bali']);
    expect(await labels('80361', { levels: 3 })).toEqual([]);
  });

  it('normalizes accents, punctuation and apostrophes', () => {
    expect(normalize("  Ba'u-Kéc.  ")).toBe('bau kec');
  });
});
