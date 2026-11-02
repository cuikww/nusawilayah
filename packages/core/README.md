# @nusawilayah/core

Klien headless tanpa dependensi untuk data wilayah Indonesia (Kepmendagri No. 300.2.2-2430 Tahun 2025). Memuat data sesuai kebutuhan, menyimpannya di cache, menyediakan pencarian di browser tanpa server, dan state dropdown bertingkat untuk adapter framework apa pun. Untuk React, pakai [`@nusawilayah/react`](https://www.npmjs.com/package/@nusawilayah/react).

```sh
npm install @nusawilayah/core
```

```ts
import { createWilayah } from '@nusawilayah/core'

const w = createWilayah()            // data dari jsDelivr

await w.provinsi()                   // 38 provinsi
await w.children('51')               // kabupaten/kota di Bali
await w.resolve('51.03.01.1001')     // { provinsi, kabupaten, kecamatan, desa, kodePos } untuk form edit
await w.byPostalCode('80361')        // semua desa dengan kode pos ini
await w.search('denpasar sel')       // [{ wilayah, label: 'Denpasar Selatan, Kota Denpasar, Bali' }]
```

## Sumber data

```ts
createWilayah()                                   // CDN jsDelivr (default)
createWilayah({ baseUrl: '/wilayah' })            // self-host: salin node_modules/@nusawilayah/data/dist
createWilayah({ fetcher: (path) => myLoad(path) }) // API sendiri, bundle lokal, React Native
```

Fetcher kustom harus melempar error dengan `status: 404` untuk file yang tidak ada.

## Pencarian

Pencarian cocok awalan, tidak membedakan huruf besar/kecil, mengabaikan kata "kabupaten/kecamatan/desa", dan menerima kode pos 5 digit. Indeks provinsi sampai kecamatan selalu dipakai. Indeks desa dimuat per provinsi hanya jika relevan, yaitu bila induknya disebut ("seminyak kuta") atau provinsinya dibatasi lewat `{ provinsi: ['51'] }`.

## Dropdown bertingkat untuk framework lain

```ts
const cascade = w.createCascade({ levels: 4 })
cascade.subscribe((state) => render(state))   // state.levels[i]: { options, selected, loading, error }
await cascade.select('provinsi', '51')         // mengosongkan level di bawahnya lalu memuat kabupaten
await cascade.setValue('51.03.01.1001')        // isi semua level dari satu kode
cascade.retry('kabupaten')
```

ESM + CJS, tipe TypeScript disertakan, sekitar 3 KB gzip.

Dokumentasi lengkap: https://github.com/cuikww/nusawilayah · Lisensi MIT
