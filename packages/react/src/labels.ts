import type { Level } from '@nusawilayah/core';

/** Every visible text of the picker. Pass a partial object to `labels` to override some of them. */
export interface Labels extends Record<Level, string> {
  kodePos: string;
  loading: string;
  retry: string;
  /** Empty-option text per level; `{label}` is replaced with the level label. */
  placeholder: string;
  search: string;
  searchPlaceholder: string;
  noResults: string;
}

/** Indonesian labels (default). */
export const labelsId: Labels = {
  provinsi: 'Provinsi',
  kabupaten: 'Kabupaten/Kota',
  kecamatan: 'Kecamatan',
  desa: 'Desa/Kelurahan',
  kodePos: 'Kode Pos',
  loading: 'Memuat…',
  retry: 'Coba lagi',
  placeholder: 'Pilih {label}',
  search: 'Cari wilayah',
  searchPlaceholder: 'Ketik nama wilayah atau kode pos',
  noResults: 'Wilayah tidak ditemukan',
};

/** English labels. */
export const labelsEn: Labels = {
  provinsi: 'Province',
  kabupaten: 'Regency/City',
  kecamatan: 'District',
  desa: 'Village',
  kodePos: 'Postal code',
  loading: 'Loading…',
  retry: 'Retry',
  placeholder: 'Select {label}',
  search: 'Search region',
  searchPlaceholder: 'Type a region name or postal code',
  noResults: 'No region found',
};
