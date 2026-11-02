# @nusawilayah/data

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
