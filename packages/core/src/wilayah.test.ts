import { describe, expect, it } from 'vitest';
import { formatPath, kodeOf, parentOf, toAlamat, toWilayah } from './wilayah.ts';

describe('domain rules', () => {
  it('derives level, induk and tipe from kode and nama', () => {
    expect(toWilayah(['51', 'Bali'])).toEqual({ kode: '51', nama: 'Bali', level: 'provinsi' });
    expect(toWilayah(['51.71', 'Kota Denpasar']).tipe).toBe('kota');
    expect(toWilayah(['51.03', 'Kabupaten Badung'])).toMatchObject({ level: 'kabupaten', induk: '51', tipe: 'kabupaten' });
    expect(toWilayah(['51.03.01', 'Kuta'])).toEqual({ kode: '51.03.01', nama: 'Kuta', level: 'kecamatan', induk: '51.03' });
    expect(toWilayah(['51.03.01.1001', 'Tuban', '80361'])).toEqual({
      kode: '51.03.01.1001', nama: 'Tuban', level: 'desa', induk: '51.03.01', tipe: 'kelurahan', kodePos: ['80361'],
    });
    expect(toWilayah(['51.03.06.2001', 'Cemagi']).tipe).toBe('desa');
    expect(toWilayah(['94.01.01.3001', 'Adat']).tipe).toBe('desa');
    expect(parentOf('51')).toBe('');
  });

  it('builds an Alamat and formats it', () => {
    const path = [toWilayah(['51', 'Bali']), toWilayah(['51.03', 'Kabupaten Badung']), toWilayah(['51.03.01', 'Kuta']), toWilayah(['51.03.01.1001', 'Tuban', '80361'])];
    const alamat = toAlamat(path);
    expect(alamat.kodePos).toBe('80361');
    expect(kodeOf(alamat)).toBe('51.03.01.1001');
    expect(formatPath(path.reverse())).toBe('Tuban, Kuta, Badung, Bali');
  });
});
