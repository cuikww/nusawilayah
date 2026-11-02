# nusawilayah

Pemilih wilayah Indonesia (provinsi → kabupaten/kota → kecamatan → desa/kelurahan + kode pos) dan peta, memakai data resmi **Kepmendagri No. 300.2.2-2430 Tahun 2025** (38 / 514 / 7.285 / 83.762).

> Status: v0.1 (mode cascade). Mode pencarian menyusul di v0.2, peta di v0.3.

## Pakai di React

```sh
npm install @nusawilayah/react
```

```tsx
import { WilayahPicker } from '@nusawilayah/react'

<WilayahPicker onChange={(alamat) => save(alamat)} />
```

`onChange` menerima `Alamat`: `{ provinsi, kabupaten, kecamatan, desa, kodePos }`, dan setiap level berisi `{ kode, nama, level, tipe?, induk? }`.

| Prop | Kegunaan |
| --- | --- |
| `levels` | 1 (provinsi) sampai 4 (desa, default) |
| `defaultValue` / `value` | kode tersimpan untuk form edit, mis. `'51.03.01.1001'`; `value` juga menerima `Alamat` |
| `name` | hidden input untuk form HTML biasa: `{name}` = kode terdalam, `{name}_kodepos` = kode pos |
| `provinsi` | batasi pilihan, mis. `['51', '52']` |
| `required`, `disabled`, `placeholder`, `labels` | label bawaan Bahasa Indonesia; `labelsEn` untuk Inggris |
| `components={{ Field }}` | ganti field bawaan dengan komponen UI sendiri (shadcn/ui, MUI) |
| `client` | klien core sendiri (self-host / fetcher kustom) |

Tanpa gaya bawaan. Atur tampilan lewat `className` dan atribut `data-nw-field`/`data-nw-error`.

React Hook Form:

```tsx
<Controller name="alamat" control={control} render={({ field }) => <WilayahPicker {...field} />} />
```

Hook headless untuk UI buatan sendiri:

```ts
const { levels, select, retry, alamat } = useWilayah({ defaultValue: '51.03.01.1001' })
```

## Pakai tanpa React (`@nusawilayah/core`)

```ts
import { createWilayah } from '@nusawilayah/core'

const w = createWilayah()           // default: jsDelivr
await w.provinsi()                  // 38 provinsi
await w.children('51')              // kabupaten/kota di Bali
await w.resolve('51.03.01.1001')    // Alamat lengkap untuk form edit
await w.byPostalCode('80361')       // semua desa dengan kode pos ini
const cascade = w.createCascade()   // state dropdown bertingkat untuk adapter framework lain
```

## Sumber data

- **CDN (default):** data diambil dari jsDelivr `@nusawilayah/data@2025.2`.
- **Self-host:** salin `node_modules/@nusawilayah/data/dist` ke folder statis (mis. `public/wilayah`), lalu `createWilayah({ baseUrl: '/wilayah' })`.
- **Fetch kustom:** `createWilayah({ fetcher: (path) => ... })`, untuk API sendiri, bundle lokal, atau React Native. Untuk file yang tidak ada, lempar error dengan `status: 404`.

| Paket | Isi |
| --- | --- |
| `@nusawilayah/data` | Data wilayah + kode pos, JSON dipecah per wilayah induk (versi `TAHUN.REVISI`) |
| `@nusawilayah/core` | Klien headless tanpa dependensi |
| `@nusawilayah/react` | `<WilayahPicker>` dan `useWilayah` |

## Pengembangan

```sh
pnpm install
pnpm build      # bangun core + jalankan pipeline data (gagal jika validasi gagal)
pnpm test
pnpm typecheck
```

Rilis memakai [Changesets](https://github.com/changesets/changesets): tambahkan changeset dengan `pnpm changeset`. Workflow Release lalu membuka PR "Version Packages", dan paket dipublish ke npm saat PR itu di-merge (butuh secret `NPM_TOKEN`).

Butuh Node 24+ (pipeline dijalankan langsung sebagai TypeScript). Sumber data dipin per commit di [pipeline/build.ts](pipeline/build.ts).

## Lisensi & atribusi

Kode: MIT. Data turunan: MIT, bersumber dari [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) dan [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos) (MIT, © cahya dsn). Kode dan nama wilayah berasal dari Kepmendagri No. 300.2.2-2430 Tahun 2025.
