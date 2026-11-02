import { createCascade, LEVELS, type CascadeOptions } from './cascade.ts';

export { LEVELS };
export type { Cascade, CascadeOptions, CascadeState, LevelState } from './cascade.ts';

export type Level = 'provinsi' | 'kabupaten' | 'kecamatan' | 'desa';

export interface Alamat {
  provinsi?: Wilayah;
  kabupaten?: Wilayah;
  kecamatan?: Wilayah;
  desa?: Wilayah;
  kodePos?: string;
}

export interface Wilayah {
  kode: string; // '51.03.01.1001'
  nama: string; // 'Tuban'
  level: Level;
  tipe?: 'kabupaten' | 'kota' | 'desa' | 'kelurahan';
  induk?: string; // kode wilayah di atasnya
  kodePos?: string[]; // hanya level desa
}

export interface WilayahOptions {
  /** URL atau path folder `dist` dari @nusawilayah/data. */
  baseUrl?: string;
  /**
   * Ganti cara memuat file (API sendiri, bundle lokal, React Native). Menerima path relatif mis. `kabupaten/51.json`.
   * Untuk file yang tidak ada, lempar error dengan `status: 404`.
   */
  fetcher?: (path: string) => Promise<unknown>;
}

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist';

const PARENT_KODE = /^\d{2}(\.\d{2}(\.\d{2})?)?$/;
const KODE = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;

type Row = [kode: string, nama: string, kodePos?: string];

function toWilayah([kode, nama, kodePos]: Row): Wilayah {
  const parts = kode.split('.');
  const level = LEVELS[parts.length - 1];
  const w: Wilayah = { kode, nama, level };
  if (parts.length > 1) w.induk = parts.slice(0, -1).join('.');
  if (level === 'kabupaten') w.tipe = nama.startsWith('Kota ') ? 'kota' : 'kabupaten';
  if (level === 'desa') w.tipe = parts[3][0] === '1' ? 'kelurahan' : 'desa';
  if (kodePos) w.kodePos = [kodePos];
  return w;
}

export function createWilayah({ baseUrl = DEFAULT_BASE_URL, fetcher }: WilayahOptions = {}) {
  const fetchJson =
    fetcher ??
    (async (path: string) => {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/${path}`);
      if (!res.ok) throw Object.assign(new Error(`nusawilayah: gagal memuat ${path} (HTTP ${res.status})`), { status: res.status });
      return res.json();
    });

  // ponytail: memory cache only; IndexedDB cache (F2.2) when repeat-visit loads matter.
  const cache = new Map<string, Promise<unknown>>();
  const loadRaw = (path: string) => {
    let p = cache.get(path);
    if (!p) {
      p = Promise.resolve(fetchJson(path));
      p.catch(() => cache.delete(path)); // failed loads can be retried
      cache.set(path, p);
    }
    return p;
  };
  const load = (path: string) => loadRaw(path).then((rows) => (rows as Row[]).map(toWilayah));

  const provinsi = () => load('provinsi.json');
  /** Anak wilayah langsung: children('51') → kabupaten/kota di Bali. */
  const children = (kode: string) => {
    if (!PARENT_KODE.test(kode)) return Promise.reject(new Error(`nusawilayah: kode induk tidak valid: ${kode}`));
    return load(`${LEVELS[kode.split('.').length]}/${kode}.json`);
  };

  /** Isi semua level dari satu kode (untuk form edit): resolve('51.03.01.1001'). */
  async function resolve(kode: string): Promise<Alamat> {
    if (!KODE.test(kode)) throw new Error(`nusawilayah: kode tidak valid: ${kode}`);
    const parts = kode.split('.');
    const alamat: Alamat = {};
    for (let i = 0; i < parts.length; i++) {
      const k = parts.slice(0, i + 1).join('.');
      const list = i === 0 ? await provinsi() : await children(parts.slice(0, i).join('.'));
      const w = list.find((x) => x.kode === k);
      if (!w) throw new Error(`nusawilayah: wilayah tidak ditemukan: ${k}`);
      alamat[LEVELS[i]] = w;
    }
    if (alamat.desa?.kodePos) alamat.kodePos = alamat.desa.kodePos[0];
    return alamat;
  }

  /** Desa/kelurahan dengan kode pos tertentu. Satu kode pos bisa mencakup banyak desa. */
  async function byPostalCode(kodePos: string): Promise<Wilayah[]> {
    if (!/^\d{5}$/.test(kodePos)) throw new Error(`nusawilayah: kode pos tidak valid: ${kodePos}`);
    let index: Record<string, Row[]>;
    try {
      index = (await loadRaw(`kodepos/${kodePos.slice(0, 2)}.json`)) as Record<string, Row[]>;
    } catch (e) {
      if ((e as { status?: number }).status === 404) return []; // no file for this prefix = no such kode pos
      throw e;
    }
    return (index[kodePos] ?? []).map(([kode, nama]) => toWilayah([kode, nama, kodePos]));
  }

  const client = { provinsi, children, resolve, byPostalCode, createCascade: (opts?: CascadeOptions) => createCascade(client, opts) };
  return client;
}

export type WilayahClient = ReturnType<typeof createWilayah>;
