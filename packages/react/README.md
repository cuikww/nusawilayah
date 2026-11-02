# @nusawilayah/react

Pemilih wilayah Indonesia untuk React: provinsi → kabupaten/kota → kecamatan → desa/kelurahan, plus kode pos. Datanya mengikuti **Kepmendagri No. 300.2.2-2430 Tahun 2025** (38 provinsi, 514 kabupaten/kota, 7.285 kecamatan, 83.762 desa/kelurahan).

```sh
npm install @nusawilayah/react
```

```tsx
import { WilayahPicker } from '@nusawilayah/react'

// 4 dropdown bertingkat
<WilayahPicker onChange={(alamat) => save(alamat)} />

// satu kolom pencarian: "denpasar sel", "seminyak kuta", atau kode pos "80361"
<WilayahPicker mode="search" onChange={(alamat) => save(alamat)} />
```

`onChange` menerima `{ provinsi, kabupaten, kecamatan, desa, kodePos }`. Setiap level berisi `{ kode, nama, level, tipe?, induk? }`, mis. `{ kode: '51.03.01.1001', nama: 'Tuban', ... }`.

## Props

| Prop | Kegunaan |
| --- | --- |
| `mode` | `cascade` (default) atau `search` |
| `levels` | 1 (provinsi) sampai 4 (desa, default) |
| `defaultValue` / `value` | kode tersimpan untuk form edit, mis. `'51.03.01.1001'`; `value` juga menerima objek Alamat |
| `onChange` | dipanggil dengan Alamat setiap pilihan berubah |
| `name` | hidden input untuk form HTML: `{name}` = kode terdalam, `{name}_kodepos` = kode pos |
| `provinsi` | batasi pilihan, mis. `['51', '52']` |
| `required`, `disabled`, `placeholder` | seperti input biasa |
| `labels` | label bawaan Bahasa Indonesia; `labelsEn` untuk Inggris |
| `components={{ Field }}` | ganti field dropdown dengan komponen UI sendiri (shadcn/ui, MUI) |
| `client` | klien `@nusawilayah/core` sendiri (self-host / fetcher kustom) |

## React Hook Form

```tsx
<Controller name="alamat" control={control} render={({ field }) => <WilayahPicker {...field} />} />
```

## Hook headless

```tsx
const { levels, select, setKode, retry, alamat } = useWilayah({ defaultValue: '51.03.01.1001' })
```

## Gaya

Komponen ini tidak membawa CSS. Atur tampilan lewat `className` dan atribut `data-nw-field`, `data-nw-error`, `data-nw-active`. Dropdown memakai `<select>` native, dan mode pencarian memakai pola ARIA combobox (diuji axe untuk WCAG 2.1 AA).

## Sumber data

Secara default data dimuat sesuai kebutuhan dari jsDelivr (`@nusawilayah/data`), kurang dari 1 KB per langkah. Untuk self-host, salin `node_modules/@nusawilayah/data/dist` ke folder statis lalu berikan `client={createWilayah({ baseUrl: '/wilayah' })}`.

Mendukung React 18 dan 19. Komponen ini ditandai `"use client"` untuk Next.js App Router.

Dokumentasi lengkap: https://github.com/cuikww/nusawilayah · Lisensi MIT
