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

## 2026-11-02 — v0.1: cascade + React

**Cascade di core, React hanya adapter.** `createCascade()` menyimpan state (pilihan, opsi, loading, error per level) dan memberi `subscribe`. React membacanya lewat `useSyncExternalStore`. Adapter Vue nanti cukup menulis ulang lapisan tipis ini.

**Race condition ditangani di core.** Respons yang terlambat dari pilihan lama dibuang, sehingga pengguna yang cepat berganti provinsi tidak melihat kabupaten yang salah. Pilihan pengguna juga membatalkan `setValue` yang masih berjalan.

**`byPostalCode` mengembalikan `[]` hanya untuk 404.** Error jaringan tetap dilempar dan tidak disembunyikan. Fetcher kustom harus melempar error dengan `status: 404` untuk file yang tidak ada.

**Dropdown memakai `<select>` native secara default.** Aksesibilitas dan mobile langsung beres tanpa kode ARIA tambahan. UI lain dipasang lewat `components.Field`. Tidak ada CSS bawaan.

**Hidden input untuk form HTML:** `{name}` = kode terdalam, `{name}_kodepos` = kode pos.

**Kode pos hanya ditampilkan (read-only)** dari data desa. Input kode pos yang mengisi wilayah balik (F3.3 arah sebaliknya) memakai `byPostalCode` dan menyusul di UI.

**Ukuran bundle terukur:** core 2,2 KB + react 1,7 KB gzip (target < 15 KB).

**Klien bersama.** Semua `<WilayahPicker>` tanpa prop `client` memakai satu klien, sehingga cache dibagi.

**Rilis:** Changesets + GitHub Actions, provenance npm. Versi pertama kode 0.1.0. Data mulai di 2025.2.0 (format `TAHUN.REVISI.patch`).

## Belum dikerjakan

- core: `search` + indeks pencarian (mode search, v0.2), cache IndexedDB
- React: mode search, input kode pos → wilayah, render provinsi dari server (RSC)
- CLI `npx nusawilayah copy`
- keluaran SQLite/CSV, `changes.json`, SPEC.md
- uji di browser sungguhan (Playwright + aplikasi contoh) dan waktu muat di HP kelas menengah
