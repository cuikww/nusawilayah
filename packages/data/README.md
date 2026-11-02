# @nusawilayah/data

Data wilayah administrasi Indonesia dan kode pos menurut **Kepmendagri No. 300.2.2-2430 Tahun 2025**: 38 provinsi, 514 kabupaten/kota, 7.285 kecamatan, dan 83.762 desa/kelurahan. Data dipecah per wilayah induk dalam file JSON kecil (rata-rata 0,2 KB gzip). Paket ini dipakai oleh [`@nusawilayah/core`](https://www.npmjs.com/package/@nusawilayah/core), tapi juga bisa dibaca langsung dari bahasa apa pun.

## Tata letak `dist/`

| File | Isi | Bentuk baris |
| --- | --- | --- |
| `meta.json` | dasar hukum, tanggal build, jumlah per level, sumber | |
| `provinsi.json` | 38 provinsi | `[kode, nama]` |
| `kabupaten/{provinsi}.json` | kabupaten/kota, mis. `kabupaten/51.json` | `[kode, nama]` |
| `kecamatan/{kabupaten}.json` | mis. `kecamatan/51.03.json` | `[kode, nama]` |
| `desa/{kecamatan}.json` | mis. `desa/51.03.01.json` | `[kode, nama, kodePos]` |
| `kodepos/{2 digit}.json` | indeks balik kode pos | `{ "80361": [[kode, nama], ...] }` |
| `search/nasional.json` | indeks pencarian provinsi sampai kecamatan | `[kode, nama]` |
| `search/{provinsi}.json` | indeks pencarian desa per provinsi | `[kode, nama]` |

Kode memakai format Kemendagri bertitik: `51` (Bali), `51.03` (Badung), `51.03.01` (Kuta), `51.03.01.1001` (Tuban). Untuk desa, digit pertama segmen ke-4 menunjukkan tipenya: `1` kelurahan, `2` desa, `3` desa adat.

CDN: `https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist/provinsi.json`

## Versi

Versi paket ini memakai format `TAHUN.REVISI.patch`, terpisah dari versi kode. `2025.2.x` mengikuti Kepmendagri 2025 revisi kedua (No. 300.2.2-2430). Patch hanya menambah file atau memperbaiki, tanpa mengubah kode wilayah.

## Lisensi & atribusi

Lisensi MIT. Bersumber dari [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) dan [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos) (MIT, © cahya dsn). Kode dan nama wilayah berasal dari Kepmendagri No. 300.2.2-2430 Tahun 2025. Kode pos adalah saran dan bisa tidak akurat untuk sebagian desa.
