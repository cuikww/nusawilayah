// Maps a kode saved under the previous Kepmendagri edition to the current one, using dist/changes.json.
import { isNotFound, type Loader } from './loader.ts';
import { KODE, type Alamat } from './wilayah.ts';

export interface Migration {
  /**
   * `unchanged`: same kode and name. `renamed`: same kode, new name. `moved`: new kode (e.g. a new parent).
   * `removed`: the kode no longer exists. `unknown`: not a kode of the previous or current edition.
   */
  status: 'unchanged' | 'renamed' | 'moved' | 'removed' | 'unknown';
  /** Current kode. Absent when removed or unknown. */
  kode?: string;
  /** Name in the previous edition, for renamed, moved and removed. */
  namaLama?: string;
  /** Full current address of `kode`. */
  alamat?: Alamat;
}

interface Changes {
  gantiNama: [kode: string, namaLama: string, namaBaru: string][];
  pindah: [kodeLama: string, kodeBaru: string, nama: string][];
  dihapus: [kode: string, nama: string][];
}

export function createMigrate(loadRaw: Loader, resolve: (kode: string) => Promise<Alamat>) {
  let index: Promise<{ renamed: Map<string, string>; moved: Map<string, [string, string]>; removed: Map<string, string> }> | undefined;
  const load = () =>
    (index ??= loadRaw('changes.json').then((raw) => {
      const c = raw as Changes;
      return {
        renamed: new Map(c.gantiNama.map(([kode, lama]) => [kode, lama])),
        moved: new Map(c.pindah.map(([lama, baru, nama]) => [lama, [baru, nama]])),
        removed: new Map(c.dihapus.map(([kode, nama]) => [kode, nama])),
      };
    })).catch((e) => { index = undefined; throw e; });

  return async function migrate(kode: string): Promise<Migration> {
    if (!KODE.test(kode)) return { status: 'unknown' };
    const { renamed, moved, removed } = await load();

    const nama = removed.get(kode);
    if (nama !== undefined) return { status: 'removed', namaLama: nama };

    const move = moved.get(kode);
    const current = move ? move[0] : kode;
    let alamat: Alamat;
    try {
      alamat = await resolve(current);
    } catch (e) {
      if (isNotFound(e)) return { status: 'unknown' };
      throw e; // network errors are not "unknown"
    }
    if (move) return { status: 'moved', kode: current, namaLama: move[1], alamat };
    const lama = renamed.get(kode);
    if (lama !== undefined) return { status: 'renamed', kode, namaLama: lama, alamat };
    return { status: 'unchanged', kode, alamat };
  };
}
