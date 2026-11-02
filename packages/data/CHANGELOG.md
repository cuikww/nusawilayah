# @nusawilayah/data

## 2025.2.4

### Patch Changes

- 0205b4d: Completes v0.1 and v0.2.

  - Core: `createWilayah({ cache: 'indexeddb' })` keeps loaded files in IndexedDB for 7 days (or any `Store`); `createCascade({ initialProvinsi })` starts from server-loaded provinsi; `cascade.setKodePos()` lets users correct the postal code.
  - React: `initialProvinsi` prop for server-rendered provinsi (Next.js App Router); the postal code field is editable; optional theme `@nusawilayah/react/style.css`; `useWilayah` returns `setKodePos`. Tested with React 18 and 19.
  - Data: `npx nusawilayah copy <folder>` copies the JSON data for self-hosting.

- 1f92d6c: Former names and code changes since the previous decree (Kepmendagri No. 100.1.1-6117 Tahun 2022).

  - Data: search indexes carry former names (`[kode, nama, ...formerNames]`), new `dist/changes.json`, SQLite tables `alias` and `perubahan`, and `alias.csv` / `perubahan.csv`. Existing files keep their shape.
  - Core: `search` matches former names and sets `alias` on the result; new `migrate(kode)` maps a saved kode to the current edition. `resolve` throws its not-found error with `status: 404`.
  - React: search results show the former name they matched (`labels.formerly`).

## 2025.2.3

### Patch Changes

- 714f8bc: Data: add `export/nusawilayah.sqlite` and `export/csv/{level}.csv`, specified in docs/SPEC.md. The JSON in `dist/` is unchanged.

  Core: domain rules split into their own module; new exports `displayName`, `formatPath`, `kodeOf`, `LoadError` and the `Fetcher` type. Error messages are now in English.

  React: split into single-purpose modules; `DefaultField` is now exported for wrapping. English README.

## 2025.2.2

### Patch Changes

- e4c480b: Tambah README di halaman npm setiap paket. Rilis ini juga menjadi rilis pertama lewat npm Trusted Publishing (dengan provenance).

## 2025.2.1

### Patch Changes

- 55dc91a: Tambah indeks pencarian: `search/nasional.json` (provinsi sampai kecamatan) dan `search/{provinsi}.json` (desa per provinsi). Data wilayah tidak berubah.
