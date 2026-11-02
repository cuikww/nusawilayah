# @nusawilayah/data

Indonesian administrative regions with postal codes, following **Kepmendagri No. 300.2.2-2430 Tahun 2025**: 38 provinsi, 514 kabupaten/kota, 7,285 kecamatan and 83,762 desa/kelurahan. Published in three forms:

| Folder | Format | For |
| --- | --- | --- |
| `dist/` | JSON split per parent region (about 0.2 KB gzip per file) | Web apps, loaded on demand by [`@nusawilayah/core`](https://www.npmjs.com/package/@nusawilayah/core) |
| `export/nusawilayah.sqlite` | One SQLite database (9.3 MB) | Offline apps: Flutter, Android, iOS, Python, PHP |
| `export/csv/*.csv` | One CSV per level, plus `alias.csv` and `perubahan.csv` | Importing into MySQL, PostgreSQL, spreadsheets |

The full format is specified in [SPEC.md](https://github.com/cuikww/nusawilayah/blob/main/docs/SPEC.md).

## `dist/` layout

| File | Content | Row shape |
| --- | --- | --- |
| `meta.json` | version, legal basis, build date, counts, sources | |
| `provinsi.json` | 38 provinsi | `[kode, nama]` |
| `kabupaten/{provinsi}.json` | kabupaten/kota, e.g. `kabupaten/51.json` | `[kode, nama]` |
| `kecamatan/{kabupaten}.json` | e.g. `kecamatan/51.03.json` | `[kode, nama]` |
| `desa/{kecamatan}.json` | e.g. `desa/51.03.01.json` | `[kode, nama, kodePos]` |
| `kodepos/{2 digits}.json` | postal code index | `{ "80361": [[kode, nama], ...] }` |
| `search/nasional.json` | search index, provinsi to kecamatan | `[kode, nama, ...formerNames]` |
| `search/{provinsi}.json` | search index of the desa per provinsi | `[kode, nama, ...formerNames]` |
| `changes.json` | changes since the previous decree: renamed, moved, removed, new | see SPEC |

Kode is the dotted Kemendagri code: `51` (Bali), `51.03` (Badung), `51.03.01` (Kuta), `51.03.01.1001` (Tuban). For a desa, the first digit of the last segment gives its type: `1` kelurahan, `2` desa, `3` desa adat.

## SQLite and CSV

```sh
curl -LO https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/export/nusawilayah.sqlite
sqlite3 nusawilayah.sqlite "SELECT kode, nama FROM wilayah WHERE induk = '51'"
```

| kode | nama | level | induk | tipe | kode_pos |
| --- | --- | --- | --- | --- | --- |
| `51.03` | Kabupaten Badung | kabupaten | `51` | kabupaten | |
| `51.03.01.1001` | Tuban | desa | `51.03.01` | kelurahan | `80361` |

CSV columns: `provinsi.csv` `kode,nama` · `kabupaten.csv` `kode,induk,nama,tipe` · `kecamatan.csv` `kode,induk,nama` · `desa.csv` `kode,induk,nama,tipe,kode_pos` · `alias.csv` `kode,nama` · `perubahan.csv` `jenis,kode_lama,kode_baru,nama_lama,nama_baru`.

The SQLite database also has the tables `alias` (former names) and `perubahan` (changes since the previous decree, for migrating saved addresses).

## Self-hosting

```sh
npm install -D @nusawilayah/data
npx nusawilayah copy public/wilayah   # copies dist/ (JSON only)
```

## CDN

```
https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist/provinsi.json
https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/export/csv/desa.csv
```

## Versioning

`YEAR.REVISION.PATCH`, independent of the code packages. `2025.2.x` follows the second 2025 decree (No. 300.2.2-2430). A patch only adds files or fixes the build, never changes a kode or nama.

## License and attribution

MIT. Derived from [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) and [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos) (MIT, © cahya dsn). Region codes and names come from Kepmendagri No. 300.2.2-2430 Tahun 2025. Postal codes are best-effort and may be inaccurate for some villages.
