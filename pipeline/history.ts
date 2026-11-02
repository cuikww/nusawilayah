// Compare older editions (cahyadsn db/archive) with the current data, per kode:
// old names become search aliases, and the diff to the previous edition becomes changes.json.
import { levelOf } from '../packages/core/src/wilayah.ts';

export type Rows = [kode: string, nama: string][];

/** Changes from the previous edition to the current one (docs/SPEC.md, changes.json). */
export interface Changes {
  dari: string;
  ke: string;
  /** Same kode, different name: [kode, namaLama, namaBaru]. */
  gantiNama: [string, string, string][];
  /** Kode gone, but the same name appears exactly once at the same level in the same provinsi: [kodeLama, kodeBaru, nama]. */
  pindah: [string, string, string][];
  /** Kode gone without a match: [kode, nama]. */
  dihapus: [string, string][];
  /** New kode that are not a move target: [kode, nama]. */
  baru: [string, string][];
}

/** Name identity across editions: archives use other casing and abbreviations ('KAB. ACEH SELATAN'). */
export const sameName = (a: string, b: string) => key(a) === key(b);
const key = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^(kab\.?|kabupaten)\s+/, '').replace(/[^a-z0-9]+/g, '');

/** 'KAB. ACEH SELATAN' → 'Kabupaten Aceh Selatan'; mixed-case names are kept as they are. */
export function tidyName(nama: string) {
  const n = nama.trim().replace(/\s+/g, ' ');
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/^Kab\.\s*/, 'Kabupaten ');
}

/** Old names per current kode, oldest first, without duplicates or the current name. */
export function aliases(current: Rows, archives: Rows[]): Map<string, string[]> {
  const now = new Map(current);
  const out = new Map<string, string[]>();
  for (const archive of archives) {
    for (const [kode, old] of archive) {
      const nama = now.get(kode);
      if (nama === undefined || sameName(nama, old)) continue;
      const list = out.get(kode) ?? [];
      if (!list.some((a) => sameName(a, old))) list.push(tidyName(old));
      out.set(kode, list);
    }
  }
  return out;
}

export function diff(previous: Rows, current: Rows, dari: string, ke: string): Changes {
  const before = new Map(previous);
  const now = new Map(current);
  const gantiNama: Changes['gantiNama'] = [];
  for (const [kode, old] of previous) {
    const nama = now.get(kode);
    if (nama !== undefined && !sameName(nama, old)) gantiNama.push([kode, tidyName(old), nama]);
  }

  const added = current.filter(([kode]) => !before.has(kode));
  const scope = (kode: string) => `${levelOf(kode)}:${kode.slice(0, 2)}`;
  const candidates = new Map<string, [string, string][]>(); // scope + name → added rows
  for (const row of added) {
    const k = `${scope(row[0])}:${key(row[1])}`;
    candidates.set(k, [...(candidates.get(k) ?? []), row]);
  }

  // ponytail: moves are matched by name within the provinsi; a move that also renamed shows as dihapus + baru.
  const pindah: Changes['pindah'] = [];
  const dihapus: Changes['dihapus'] = [];
  const moved = new Set<string>();
  for (const [kode, old] of previous) {
    if (now.has(kode)) continue;
    const match = candidates.get(`${scope(kode)}:${key(old)}`);
    if (match?.length === 1 && !moved.has(match[0][0])) {
      pindah.push([kode, match[0][0], match[0][1]]);
      moved.add(match[0][0]);
    } else {
      dihapus.push([kode, tidyName(old)]);
    }
  }
  const baru = added.filter(([kode]) => !moved.has(kode));
  const byKode = (a: string[], b: string[]) => a[0].localeCompare(b[0]);
  return { dari, ke, gantiNama: gantiNama.sort(byKode), pindah: pindah.sort(byKode), dihapus: dihapus.sort(byKode), baru: baru.sort(byKode) };
}
