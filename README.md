# nusawilayah

Pemilih wilayah Indonesia (provinsi → kabupaten/kota → kecamatan → desa/kelurahan + kode pos) dan peta, memakai data resmi **Kepmendagri No. 300.2.2-2430 Tahun 2025** (38 / 514 / 7.285 / 83.762).

> Status: pra-rilis (v0.1 dalam pengerjaan). Lihat PRD untuk roadmap.

## Paket

| Paket | Isi |
| --- | --- |
| `@nusawilayah/data` | Data wilayah + kode pos, JSON dipecah per wilayah induk (dibangun oleh `pipeline/`) |
| `@nusawilayah/core` | Klien headless: memuat data sesuai kebutuhan, cache |

```ts
import { createWilayah } from '@nusawilayah/core'

const w = createWilayah() // default: jsDelivr; atau { baseUrl: '/wilayah' } untuk self-host
await w.provinsi()          // 38 provinsi
await w.children('51')      // kabupaten/kota di Bali
await w.children('51.03.01') // desa/kelurahan di Kuta, dengan kodePos
```

## Pengembangan

```sh
pnpm install
pnpm build      # bangun core + jalankan pipeline data (gagal jika validasi gagal)
pnpm test
pnpm typecheck
```

Butuh Node 24+ (pipeline dijalankan langsung sebagai TypeScript). Sumber data dipin per commit di [pipeline/build.ts](pipeline/build.ts).

## Lisensi & atribusi

Kode: MIT. Data turunan: MIT, bersumber dari [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) dan [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos) (MIT, © cahya dsn). Kode dan nama wilayah berasal dari Kepmendagri No. 300.2.2-2430 Tahun 2025.
