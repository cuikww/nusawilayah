// Domain model: what a kode means. Pure functions, no I/O. The data pipeline imports this file too,
// so the JSON, SQLite and CSV outputs all derive level/induk/tipe with the same rules (see docs/SPEC.md).

export type Level = 'provinsi' | 'kabupaten' | 'kecamatan' | 'desa';

export const LEVELS: readonly Level[] = ['provinsi', 'kabupaten', 'kecamatan', 'desa'];

export interface Wilayah {
  /** Kemendagri code, e.g. '51.03.01.1001'. Its segment count is the level. */
  kode: string;
  /** Official name, e.g. 'Tuban' or 'Kabupaten Badung'. */
  nama: string;
  level: Level;
  /** Kabupaten vs kota at level 2, desa vs kelurahan at level 4. */
  tipe?: 'kabupaten' | 'kota' | 'desa' | 'kelurahan';
  /** Kode of the parent wilayah. Absent for provinsi. */
  induk?: string;
  /** Postal codes. Desa level only. */
  kodePos?: string[];
}

/** A full address, one entry per selected level. */
export interface Alamat {
  provinsi?: Wilayah;
  kabupaten?: Wilayah;
  kecamatan?: Wilayah;
  desa?: Wilayah;
  /** Postal code of the selected desa. */
  kodePos?: string;
}

/** A data row as stored in the JSON files: `[kode, nama]`, or `[kode, nama, kodePos]` at desa level. */
export type Row = [kode: string, nama: string, kodePos?: string];

/** Any kode: '51', '51.03', '51.03.01' or '51.03.01.1001'. */
export const KODE = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;
/** A kode that can have children (provinsi, kabupaten, kecamatan). */
export const PARENT_KODE = /^\d{2}(\.\d{2}(\.\d{2})?)?$/;

export const levelOf = (kode: string): Level => LEVELS[kode.split('.').length - 1];

/** Parent kode, or '' for a provinsi. */
export const parentOf = (kode: string) => kode.slice(0, Math.max(0, kode.lastIndexOf('.')));

export function tipeOf(kode: string, nama: string): Wilayah['tipe'] {
  switch (levelOf(kode)) {
    case 'kabupaten':
      return nama.startsWith('Kota ') ? 'kota' : 'kabupaten';
    case 'desa':
      // First digit of the last segment: 1 = kelurahan, 2 = desa, 3 = desa adat (Papua), reported as desa.
      return kode.slice(-4, -3) === '1' ? 'kelurahan' : 'desa';
    default:
      return undefined;
  }
}

export function toWilayah([kode, nama, kodePos]: Row): Wilayah {
  const w: Wilayah = { kode, nama, level: levelOf(kode) };
  const induk = parentOf(kode);
  const tipe = tipeOf(kode, nama);
  if (induk) w.induk = induk;
  if (tipe) w.tipe = tipe;
  if (kodePos) w.kodePos = [kodePos];
  return w;
}

/** Builds an Alamat from the selected wilayah of each level, top-down. */
export function toAlamat(selected: Iterable<Wilayah>): Alamat {
  const alamat: Alamat = {};
  for (const w of selected) alamat[w.level] = w;
  if (alamat.desa?.kodePos) alamat.kodePos = alamat.desa.kodePos[0];
  return alamat;
}

/** The deepest selected kode of an Alamat. */
export const kodeOf = (a: Alamat) => (a.desa ?? a.kecamatan ?? a.kabupaten ?? a.provinsi)?.kode;

/** Name for display: drops the 'Kabupaten ' prefix but keeps 'Kota ' so Kota Bogor and Bogor stay distinct. */
export const displayName = (nama: string) => nama.replace(/^Kabupaten /, '');

/** 'Tuban, Kuta, Badung, Bali': a wilayah followed by its ancestors, deepest first. */
export const formatPath = (wilayah: { nama: string }[]) => wilayah.map((w) => displayName(w.nama)).join(', ');
