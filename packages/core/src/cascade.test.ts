import { describe, expect, it, vi } from 'vitest';
import { createWilayah } from './index.ts';

const files: Record<string, unknown> = {
  'provinsi.json': [['51', 'Bali'], ['52', 'Nusa Tenggara Barat']],
  'kabupaten/51.json': [['51.03', 'Kabupaten Badung'], ['51.71', 'Kota Denpasar']],
  'kabupaten/52.json': [['52.01', 'Kabupaten Lombok Barat']],
  'kecamatan/51.03.json': [['51.03.01', 'Kuta']],
  'desa/51.03.01.json': [['51.03.01.1001', 'Tuban', '80361'], ['51.03.01.1002', 'Kuta', '80361']],
  'kodepos/80.json': { '80361': [['51.03.01.1001', 'Tuban'], ['51.03.01.1002', 'Kuta']] },
};
const notFound = (path: string) => Object.assign(new Error('404 ' + path), { status: 404 });
const client = (fetcher = async (path: string) => { if (!(path in files)) throw notFound(path); return files[path]; }) =>
  createWilayah({ fetcher });

describe('resolve', () => {
  it('fills every level from one kode', async () => {
    const a = await client().resolve('51.03.01.1001');
    expect([a.provinsi?.nama, a.kabupaten?.nama, a.kecamatan?.nama, a.desa?.nama, a.kodePos]).toEqual(['Bali', 'Kabupaten Badung', 'Kuta', 'Tuban', '80361']);
    expect(Object.keys(await client().resolve('51.03'))).toEqual(['provinsi', 'kabupaten']);
  });
  it('rejects unknown and malformed kode', async () => {
    await expect(client().resolve('51.99')).rejects.toThrow('not found: 51.99');
    await expect(client().resolve('51/03')).rejects.toThrow('invalid');
  });
});

describe('byPostalCode', () => {
  it('lists every desa sharing a kode pos', async () => {
    expect((await client().byPostalCode('80361')).map((w) => [w.nama, w.kodePos])).toEqual([['Tuban', ['80361']], ['Kuta', ['80361']]]);
    expect(await client().byPostalCode('80999')).toEqual([]);
    expect(await client().byPostalCode('11111')).toEqual([]); // prefix file 404
  });
  it('validates input and does not swallow network errors', async () => {
    await expect(client().byPostalCode('8036')).rejects.toThrow('invalid');
    await expect(client(async () => { throw new Error('offline'); }).byPostalCode('80361')).rejects.toThrow('offline');
  });
});

describe('createCascade', () => {
  it('loads children on select and clears levels below', async () => {
    const c = client().createCascade();
    await c.ready;
    expect(c.getState().levels[0].options.map((o) => o.kode)).toEqual(['51', '52']);
    await c.select('provinsi', '51');
    await c.select('kabupaten', '51.03');
    await c.select('kecamatan', '51.03.01');
    await c.select('desa', '51.03.01.1001');
    expect(c.getState().kode).toBe('51.03.01.1001');
    expect(c.getState().alamat.kodePos).toBe('80361');

    await c.select('provinsi', '52');
    const s = c.getState();
    expect(s.alamat).toEqual({ provinsi: expect.objectContaining({ kode: '52' }) });
    expect(s.levels.map((l) => l.options.length)).toEqual([2, 1, 0, 0]);
  });

  it('ignores a stale response when the user changes their mind', async () => {
    let releaseBali!: () => void;
    const c = client(async (path) => {
      if (path === 'kabupaten/51.json') await new Promise<void>((r) => (releaseBali = r));
      return files[path];
    }).createCascade();
    await c.ready;
    const slow = c.select(0, '51');
    await c.select(0, '52');
    releaseBali();
    await slow;
    expect(c.getState().levels[1].options.map((o) => o.kode)).toEqual(['52.01']);
  });

  it('setValue fills levels for edit forms, truncated to `levels`', async () => {
    const c = client().createCascade({ levels: 3 });
    await c.setValue('51.03.01.1001');
    expect(c.getState().kode).toBe('51.03.01');
    expect(c.getState().levels).toHaveLength(3);
    await c.setValue();
    expect(c.getState().alamat).toEqual({});
    await expect(c.setValue('51.99')).rejects.toThrow('is not an option');
  });

  it('a user select cancels an in-flight setValue', async () => {
    const c = client().createCascade();
    const p = c.setValue('51.03.01.1001');
    await c.ready;
    await c.select(0, '52');
    await p;
    expect(c.getState().kode).toBe('52');
  });

  it('filters provinsi, notifies subscribers, records errors and retries', async () => {
    let fail = true;
    const c = client(async (path) => {
      if (path === 'kabupaten/51.json' && fail) throw new Error('offline');
      return files[path];
    }).createCascade({ provinsi: ['51'] });
    const seen = vi.fn();
    const unsubscribe = c.subscribe(seen);
    await c.ready;
    expect(c.getState().levels[0].options.map((o) => o.kode)).toEqual(['51']);
    await c.select(0, '51');
    expect(c.getState().levels[1].error?.message).toBe('offline');
    fail = false;
    await c.retry('kabupaten');
    expect(c.getState().levels[1]).toMatchObject({ error: undefined, loading: false });
    expect(c.getState().levels[1].options).toHaveLength(2);
    expect(seen).toHaveBeenCalled();
    unsubscribe();
    expect(() => client().createCascade({ levels: 5 })).toThrow('levels must be 1-4');
    expect(() => c.select('desa', 'x')).toThrow('is not an option');
  });
});
