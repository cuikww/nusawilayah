import { describe, expect, it, vi } from 'vitest';
import { createWilayah } from './index.ts';

const files: Record<string, unknown> = {
  'provinsi.json': [['51', 'Bali']],
  'kabupaten/51.json': [['51.03', 'Kabupaten Badung'], ['51.71', 'Kota Denpasar']],
  'desa/51.03.01.json': [['51.03.01.1001', 'Tuban', '80361'], ['51.03.01.2001', 'Pecatu', '80364']],
};
const fakeFetcher = () => vi.fn(async (path: string) => {
  if (!(path in files)) throw new Error('404 ' + path);
  return files[path];
});

describe('createWilayah', () => {
  it('loads provinsi and children with derived fields', async () => {
    const w = createWilayah({ fetcher: fakeFetcher() });
    expect(await w.provinsi()).toEqual([{ kode: '51', nama: 'Bali', level: 'provinsi' }]);
    expect(await w.children('51')).toEqual([
      { kode: '51.03', nama: 'Kabupaten Badung', level: 'kabupaten', induk: '51', tipe: 'kabupaten' },
      { kode: '51.71', nama: 'Kota Denpasar', level: 'kabupaten', induk: '51', tipe: 'kota' },
    ]);
    expect(await w.children('51.03.01')).toEqual([
      { kode: '51.03.01.1001', nama: 'Tuban', level: 'desa', induk: '51.03.01', tipe: 'kelurahan', kodePos: ['80361'] },
      { kode: '51.03.01.2001', nama: 'Pecatu', level: 'desa', induk: '51.03.01', tipe: 'desa', kodePos: ['80364'] },
    ]);
  });

  it('caches successful loads and retries failed ones', async () => {
    const fetcher = fakeFetcher();
    const w = createWilayah({ fetcher });
    await w.children('51');
    await w.children('51');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(w.children('52')).rejects.toThrow('404');
    await expect(w.children('52')).rejects.toThrow('404');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('rejects invalid kode before fetching (no path traversal)', async () => {
    const fetcher = fakeFetcher();
    const w = createWilayah({ fetcher });
    for (const bad of ['../51', '51.03.01.1001', '5', '51/03', '']) await expect(w.children(bad)).rejects.toThrow('invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses baseUrl with the default fetcher', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[["51","Bali"]]'));
    await createWilayah({ baseUrl: '/wilayah/' }).provinsi();
    expect(spy).toHaveBeenCalledWith('/wilayah/provinsi.json');
    spy.mockResolvedValue(new Response('', { status: 404 }));
    await expect(createWilayah({ baseUrl: '/x' }).children('51')).rejects.toThrow('HTTP 404');
    spy.mockRestore();
  });
});
