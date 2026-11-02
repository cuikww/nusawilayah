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

## 2026-11-02 — v0.2: mode pencarian

**Indeks pencarian dua lapis.** Lapis pertama `search/nasional.json` (provinsi sampai kecamatan, 7.837 entri) selalu dimuat. Lapis kedua `search/{provinsi}.json` (desa) rata-rata 17 KB dan terbesar 59 KB gzip. Indeks desa hanya dimuat untuk provinsi yang relevan: yang dibatasi lewat `provinsi`, atau maksimal 3 provinsi teratas yang namanya cocok dengan salah satu kata kueri. Akibatnya, desa yang dicari tanpa menyebut induknya ("seminyak" saja) tidak ditemukan, sedangkan "seminyak kuta" atau "seminyak bali" ditemukan.

**Aturan cocok:** setiap kata kueri harus menjadi awalan dari salah satu kata di nama wilayah atau nama induknya, dan minimal satu kata cocok dengan nama wilayah itu sendiri. Kata "kabupaten/kab/kecamatan/kec/desa/kelurahan/kel/provinsi/prov" diabaikan. Kata "kota" tidak diabaikan karena membedakan Kota Bogor dari Kabupaten Bogor. Huruf besar/kecil, aksen, dan apostrof diabaikan ("bau" cocok dengan "Ba'u").

**Peringkat:** nama yang persis sama dengan kueri lebih dulu ("Kota X" dianggap persis untuk "x"), lalu yang diawali kueri, lalu level yang lebih tinggi, lalu nama yang lebih pendek.

**Kode pos di kolom pencarian.** Lima digit diperlakukan sebagai kode pos. Ini memenuhi F3.3 arah balik: jika satu kode pos mencakup beberapa desa, pengguna memilih dari daftar.

**Label tampilan** membuang awalan "Kabupaten " ("Kuta, Badung, Bali") tapi mempertahankan "Kota " supaya tidak ambigu.

**Combobox ARIA 1.2** untuk mode search: input `role=combobox`, `listbox`/`option`, `aria-activedescendant`, `role=status` untuk "tidak ditemukan". Diuji axe (WCAG 2.1 AA) di Chrome sungguhan: 0 pelanggaran.

**Uji browser:** `apps/example-vite` (data self-host lewat `publicDir`) + Playwright memakai Chrome yang terpasang (`channel: 'chrome'`), dijalankan di CI.

**Ukuran bundle v0.2:** core 3,3 KB + react 3,0 KB gzip (target < 15 KB).

**Versi data `2025.2.1`:** penambahan indeks pencarian adalah patch, karena data wilayah tidak berubah. URL CDN `@2025.2` otomatis mengikuti.

## 2026-11-02 — Rilis lewat Trusted Publishing

**Temuan:** rilis 0.1.0 dan 0.2.0 terbit memakai token `NPM_TOKEN`, tanpa provenance, meskipun `publishConfig.provenance: true`. Pertukaran token OIDC dilakukan oleh npm CLI (≥ 11.5.1), dan `pnpm publish` diam-diam memakai token kalau token tersedia.

**Keputusan:** workflow Release dipecah. changesets/action hanya membuat PR versi, lalu step terpisah menjalankan `pnpm release` dengan npm terbaru, `id-token: write`, `NPM_CONFIG_PROVENANCE=true`, dan **tanpa token sama sekali**. Kalau trusted publisher belum diatur di npm, publish gagal dengan jelas, tidak diam-diam memakai token.

**Terverifikasi** di rilis core/react 0.2.1 dan data 2025.2.2: ketiganya terbit lewat trusted publisher GitHub dengan provenance. Token npm sudah tidak dipakai, dan publishing access setiap paket menolak token.

## Belum dikerjakan

- core: cache IndexedDB, alias nama lama di pencarian
- React: render provinsi dari server (RSC)
- CLI `npx nusawilayah copy`
- keluaran SQLite/CSV, `changes.json`, SPEC.md
- waktu muat di HP kelas menengah
