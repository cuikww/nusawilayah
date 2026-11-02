export type Level = 'provinsi' | 'kabupaten' | 'kecamatan' | 'desa';

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
  /** Ganti cara memuat file (API sendiri, bundle lokal, React Native). Menerima path relatif mis. `kabupaten/51.json`. */
  fetcher?: (path: string) => Promise<unknown>;
}

export const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist';

const LEVELS: Level[] = ['provinsi', 'kabupaten', 'kecamatan', 'desa'];
const PARENT_KODE = /^\d{2}(\.\d{2}(\.\d{2})?)?$/;

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
      if (!res.ok) throw new Error(`nusawilayah: gagal memuat ${path} (HTTP ${res.status})`);
      return res.json();
    });

  // ponytail: memory cache only; IndexedDB cache (F2.2) when repeat-visit loads matter.
  const cache = new Map<string, Promise<Wilayah[]>>();
  const load = (path: string) => {
    let p = cache.get(path);
    if (!p) {
      p = Promise.resolve(fetchJson(path)).then((rows) => (rows as Row[]).map(toWilayah));
      p.catch(() => cache.delete(path)); // failed loads can be retried
      cache.set(path, p);
    }
    return p;
  };

  return {
    provinsi: () => load('provinsi.json'),
    /** Anak wilayah langsung: children('51') → kabupaten/kota di Bali. */
    children(kode: string) {
      if (!PARENT_KODE.test(kode)) return Promise.reject(new Error(`nusawilayah: kode induk tidak valid: ${kode}`));
      return load(`${LEVELS[kode.split('.').length]}/${kode}.json`);
    },
  };
}

export type WilayahClient = ReturnType<typeof createWilayah>;
