# @nusawilayah/core

Headless, dependency-free client for Indonesian region data (Kepmendagri No. 300.2.2-2430 Tahun 2025). It loads data on demand, caches it, searches in the browser without a server, and holds cascading-dropdown state for any framework. About 3.5 KB gzipped. For React, use [`@nusawilayah/react`](https://www.npmjs.com/package/@nusawilayah/react).

```sh
npm install @nusawilayah/core
```

```ts
import { createWilayah } from '@nusawilayah/core'

const w = createWilayah()            // data from jsDelivr

await w.provinsi()                   // 38 provinsi: [{ kode: '11', nama: 'Aceh', level: 'provinsi' }, ...]
await w.children('51')               // kabupaten/kota in Bali
await w.resolve('51.03.01.1001')     // { provinsi, kabupaten, kecamatan, desa, kodePos } for edit forms
await w.byPostalCode('80361')        // every desa with this postal code
await w.search('denpasar sel')       // [{ wilayah, label: 'Denpasar Selatan, Kota Denpasar, Bali' }]
```

## Data source

```ts
createWilayah()                                    // jsDelivr CDN (default)
createWilayah({ baseUrl: '/wilayah' })             // self-hosted copy of node_modules/@nusawilayah/data/dist
createWilayah({ fetcher: (path) => myLoad(path) }) // your API, bundled data, React Native
```

A custom fetcher must throw an error with `status: 404` for a file that does not exist.

## Search

Prefix matching, case- and accent-insensitive. The words kabupaten/kecamatan/desa are ignored ("kota" is kept to tell Kota Bogor from Kabupaten Bogor), and a 5-digit query is treated as a postal code. The provinsi-to-kecamatan index is always used. A province's village index loads only when relevant: when a parent is named ("seminyak kuta") or the search is restricted with `{ provinsi: ['51'] }`.

```ts
await w.search('kuta', { levels: 3, provinsi: ['51'], limit: 5 })
```

## Cascading dropdowns for other frameworks

```ts
const cascade = w.createCascade({ levels: 4 })
cascade.subscribe((state) => render(state))   // state.levels[i]: { level, options, selected, loading, error }
await cascade.select('provinsi', '51')         // clears the levels below and loads the kabupaten
await cascade.setValue('51.03.01.1001')        // fills every level from one kode
cascade.retry('kabupaten')                     // after a network error
```

Stale responses are dropped when the user switches quickly, failed loads can be retried, and invalid codes are rejected before any request.

ESM + CJS with TypeScript types.

Full documentation: https://github.com/cuikww/nusawilayah · MIT License
