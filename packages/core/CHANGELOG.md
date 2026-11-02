# @nusawilayah/core

## 0.2.1

### Patch Changes

- e4c480b: Tambah README di halaman npm setiap paket. Rilis ini juga menjadi rilis pertama lewat npm Trusted Publishing (dengan provenance).

## 0.2.0

### Minor Changes

- 55dc91a: Mode pencarian: `client.search()` (cocok awalan, tanpa server, termasuk kode pos 5 digit) dan `<WilayahPicker mode="search">` dengan pola ARIA combobox. Hook `useWilayah` kini juga mengembalikan `setKode` dan `client`.

## 0.1.0

### Minor Changes

- 23b8d04: Rilis pertama: `createWilayah` (provinsi, children, resolve, byPostalCode, createCascade) dan `<WilayahPicker>` mode cascade + hook `useWilayah`.
