# Keputusan teknis

Catatan keputusan yang diambil saat implementasi, sebagai pelengkap PRD.

## 2026-11-02 — Setup awal (minggu 1)

**Nama paket.** `nusawilayah` dan scope `@nusawilayah` belum dipakai di npm maupun GitHub (dicek 2026-11-02). Org npm dan GitHub perlu diamankan oleh pemilik proyek.

**Dasar hukum data: Kepmendagri No. 300.2.2-2430 Tahun 2025.** Header `db/wilayah.sql` di cahyadsn/wilayah masih menulis 300.2.2-2138, tetapi README repo tersebut menyatakan 2430, dan jumlah per level cocok dengan rekap 2430 (38 / 514 / 7.285 / 83.762). Yang dipakai: 2430.

**Sumber dipin per commit.** `pipeline/build.ts` mengunduh SQL dari commit tertentu, bukan dari branch, supaya build bisa diulang. Rilis data baru = ganti commit, lalu jalankan build.

**Format file data: tuple, bukan objek.** Baris disimpan sebagai `[kode, nama]`, dan level desa sebagai `[kode, nama, kodePos]`. `level`, `induk`, dan `tipe` diturunkan oleh core:
- level: jumlah segmen kode
- induk: kode tanpa segmen terakhir
- tipe kabupaten/kota: nama diawali `Kota ` → `kota`, selain itu `kabupaten`
- tipe desa/kelurahan: digit pertama segmen ke-4 `1` → `kelurahan`, `2` → `desa`, `3` (desa adat, Papua) → `desa`

Nama disimpan sesuai nama resmi, termasuk awalan "Kabupaten"/"Kota".

**Ukuran terukur (gzip):** kabupaten rata-rata 0,18 KB / terbesar 0,36 KB; kecamatan 0,18 / 0,45 KB; desa (termasuk kode pos) 0,17 / 0,85 KB. Target < 1 KB per langkah tercapai.

**Indeks kode pos per 2 digit awalan** (`kodepos/80.json`): rata-rata 8 KB, terbesar 34 KB gzip. Ini lebih berat dari file per langkah, tetapi hanya dimuat saat lookup kode pos. Akan dipecah per 3 digit jika terbukti lambat.

**Pipeline tanpa transpiler.** Node 24 menjalankan TypeScript langsung (type stripping), jadi tidak perlu tsx/ts-node. Syarat: Node ≥ 24.

**Cache core: hanya memori untuk saat ini.** Gagal muat tidak disimpan di cache, sehingga bisa dicoba lagi (mendukung F3.6). Cache IndexedDB (F2.2) menyusul.

**Validasi kode di core.** `children()` menolak kode yang tidak sesuai pola sebelum fetch, untuk mencegah path traversal di URL.

## Belum dikerjakan

- core: `resolve`, `search`, `byPostalCode`, `createCascade`, cache IndexedDB
- `@nusawilayah/react`
- keluaran SQLite/CSV, `changes.json`, SPEC.md
- pengukuran waktu muat di HP kelas menengah
