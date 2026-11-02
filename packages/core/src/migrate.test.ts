import { describe, expect, it } from 'vitest';
import { createWilayah } from './index.ts';

const files: Record<string, unknown> = {
  'provinsi.json': [['72', 'Sulawesi Tengah']],
  'kabupaten/72.json': [['72.01', 'Kabupaten Banggai']],
  'kecamatan/72.01.json': [['72.01.09', 'Toili'], ['72.01.24', 'Toili Jaya']],
  'desa/72.01.09.json': [['72.01.09.2001', 'Sentral Sari', '94765']],
  'desa/72.01.24.json': [['72.01.24.2007', 'Tohitisari', '94765']],
  'changes.json': {
    dari: 'lama',
    ke: 'baru',
    gantiNama: [['72.01.09.2001', 'Sentralsari', 'Sentral Sari']],
    pindah: [['72.01.09.2012', '72.01.24.2007', 'Tohitisari']],
    dihapus: [['72.01.09.2099', 'Hilang']],
    baru: [['72.01.24', 'Toili Jaya']],
  },
};
const client = (offline = false) =>
  createWilayah({
    fetcher: async (path) => {
      if (offline) throw new Error('offline');
      if (!(path in files)) throw Object.assign(new Error('404'), { status: 404 });
      return files[path];
    },
  });

describe('migrate', () => {
  it('follows moves to the new kode and returns the current address', async () => {
    const m = await client().migrate('72.01.09.2012');
    expect(m).toMatchObject({ status: 'moved', kode: '72.01.24.2007', namaLama: 'Tohitisari' });
    expect(m.alamat?.kecamatan?.nama).toBe('Toili Jaya');
  });

  it('reports renamed, unchanged, removed and unknown kode', async () => {
    const w = client();
    expect(await w.migrate('72.01.09.2001')).toMatchObject({ status: 'renamed', kode: '72.01.09.2001', namaLama: 'Sentralsari' });
    expect(await w.migrate('72.01.24.2007')).toMatchObject({ status: 'unchanged', kode: '72.01.24.2007' });
    expect(await w.migrate('72.01.09.2099')).toEqual({ status: 'removed', namaLama: 'Hilang' });
    expect(await w.migrate('72.01.09.2098')).toEqual({ status: 'unknown' });
    expect(await w.migrate('99.01')).toEqual({ status: 'unknown' });
    expect(await w.migrate('../x')).toEqual({ status: 'unknown' });
  });

  it('throws network errors instead of reporting unknown', async () => {
    await expect(client(true).migrate('72.01')).rejects.toThrow('offline');
  });
});
