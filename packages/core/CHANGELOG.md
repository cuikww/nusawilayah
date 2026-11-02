# @nusawilayah/core

## 0.3.0

### Minor Changes

- 714f8bc: Data: add `export/nusawilayah.sqlite` and `export/csv/{level}.csv`, specified in docs/SPEC.md. The JSON in `dist/` is unchanged.

  Core: domain rules split into their own module; new exports `displayName`, `formatPath`, `kodeOf`, `LoadError` and the `Fetcher` type. Error messages are now in English.

  React: split into single-purpose modules; `DefaultField` is now exported for wrapping. English README.

## 0.2.1

### Patch Changes

- e4c480b: Tambah README di halaman npm setiap paket. Rilis ini juga menjadi rilis pertama lewat npm Trusted Publishing (dengan provenance).

## 0.2.0

### Minor Changes

- 55dc91a: Mode pencarian: `client.search()` (cocok awalan, tanpa server, termasuk kode pos 5 digit) dan `<WilayahPicker mode="search">` dengan pola ARIA combobox. Hook `useWilayah` kini juga mengembalikan `setKode` dan `client`.

## 0.1.0

### Minor Changes

- 23b8d04: Rilis pertama: `createWilayah` (provinsi, children, resolve, byPostalCode, createCascade) dan `<WilayahPicker>` mode cascade + hook `useWilayah`.
