# nusawilayah data specification

This document defines the data published in [`@nusawilayah/data`](https://www.npmjs.com/package/@nusawilayah/data): file layout, JSON schemas, the SQLite schema, the CSV format, kode rules and versioning. Ports to other languages (PHP/Laravel, Flutter, Python, ...) should follow it so they stay consistent with the JavaScript packages.

Spec version: **1** (data `2025.2.3` and later). The JSON layout of `dist/` has not changed since `2025.2.0`.

## 1. Source and coverage

| | |
| --- | --- |
| Legal basis | Kepmendagri No. 300.2.2-2430 Tahun 2025 |
| Provinsi | 38 |
| Kabupaten/kota | 514 |
| Kecamatan | 7,285 |
| Desa/kelurahan | 83,762, every one with a postal code |
| Upstream | [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) and [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos), pinned per commit (see `meta.json`) |

A release is only published if every check passes: exact counts per level, unique kode, every kode well-formed, every wilayah has a parent, every desa has a valid postal code, and no postal code points to an unknown wilayah.

## 2. Glossary

The data keeps the Indonesian terms, because they are the official names and have no exact English equivalent.

| Term | Meaning |
| --- | --- |
| `wilayah` | region (any level) |
| `provinsi` | province (level 1) |
| `kabupaten` / `kota` | regency / city (level 2) |
| `kecamatan` | district (level 3) |
| `desa` / `kelurahan` | village / urban village (level 4) |
| `kode` | the Kemendagri region code |
| `nama` | official name |
| `induk` | parent kode |
| `tipe` | subtype within a level (kabupaten/kota, desa/kelurahan) |
| `kode pos` | postal code |
| `alamat` | address |

## 3. Kode format

A kode is the dotted Kemendagri code. Its number of segments is its level.

| Level | Pattern | Example | Name |
| --- | --- | --- | --- |
| 1 `provinsi` | `NN` | `51` | Bali |
| 2 `kabupaten` | `NN.NN` | `51.03` | Kabupaten Badung |
| 3 `kecamatan` | `NN.NN.NN` | `51.03.01` | Kuta |
| 4 `desa` | `NN.NN.NN.NNNN` | `51.03.01.1001` | Tuban |

Full pattern: `^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$`. Always store kode as **text**: `51.10` is not the number `51.1`.

### Derived fields

These fields are not stored in the JSON files. Every consumer derives them with the same rules (the reference implementation is [`packages/core/src/wilayah.ts`](../packages/core/src/wilayah.ts)). SQLite and CSV already contain them.

| Field | Rule |
| --- | --- |
| `level` | number of segments: 1 `provinsi`, 2 `kabupaten`, 3 `kecamatan`, 4 `desa` |
| `induk` | kode without its last segment; none for a provinsi |
| `tipe` (level 2) | `kota` if `nama` starts with `"Kota "`, else `kabupaten` |
| `tipe` (level 4) | first digit of the last segment: `1` → `kelurahan`, `2` → `desa`, `3` (desa adat, Papua) → `desa` |

### Names

`nama` is the official name, including the `Kabupaten ` or `Kota ` prefix at level 2. For display, the JavaScript packages drop `Kabupaten ` but keep `Kota ` so that Kota Bogor and Kabupaten Bogor stay distinct: `Tuban, Kuta, Badung, Bali`.

## 4. JSON files (`dist/`)

All files are UTF-8 JSON without whitespace. Rows are positional arrays (tuples) instead of objects to keep files small; most files are under 1 KB gzipped.

| Path | Content | Shape |
| --- | --- | --- |
| `meta.json` | version, legal basis, build time, counts, sources | object, see below |
| `provinsi.json` | all provinsi | `Row[]` |
| `kabupaten/{provinsi}.json` | kabupaten/kota of a provinsi, e.g. `kabupaten/51.json` | `Row[]` |
| `kecamatan/{kabupaten}.json` | kecamatan of a kabupaten, e.g. `kecamatan/51.03.json` | `Row[]` |
| `desa/{kecamatan}.json` | desa of a kecamatan, e.g. `desa/51.03.01.json` | `DesaRow[]` |
| `kodepos/{NN}.json` | postal code index by the first two digits, e.g. `kodepos/80.json` | `{ [kodePos]: Row[] }` |
| `search/nasional.json` | search index, provinsi to kecamatan | `Row[]` |
| `search/{provinsi}.json` | search index of the desa of one provinsi | `Row[]` |

```ts
type Row = [kode: string, nama: string]
type DesaRow = [kode: string, nama: string, kodePos: string]
```

Rows are sorted by kode. A file that does not exist means "no such parent" (or, for `kodepos/`, "no postal code with this prefix"): clients should treat HTTP 404 as an empty result, not as an error.

Examples:

```jsonc
// provinsi.json
[["11","Aceh"],["12","Sumatera Utara"], ... ,["51","Bali"], ...]

// kabupaten/51.json
[["51.01","Kabupaten Jembrana"],["51.02","Kabupaten Tabanan"],["51.03","Kabupaten Badung"], ... ,["51.71","Kota Denpasar"]]

// desa/51.03.01.json
[["51.03.01.1001","Tuban","80361"],["51.03.01.1002","Kuta","80361"], ...]

// kodepos/80.json
{ "80361": [["51.03.01.1001","Tuban"],["51.03.01.1002","Kuta"], ...], ... }
```

### `meta.json`

```json
{
  "versi": "2025.2.3",
  "dasarHukum": "Kepmendagri No. 300.2.2-2430 Tahun 2025",
  "dibangun": "2026-11-02T08:01:37.294Z",
  "jumlah": { "provinsi": 38, "kabupaten": 514, "kecamatan": 7285, "desa": 83762 },
  "sumber": ["https://github.com/cahyadsn/wilayah/blob/<commit>/db/wilayah.sql", "..."],
  "atribusi": "Data © cahya dsn (MIT). ...",
  "format": { "baris": "...", "kodepos": "..." }
}
```

## 5. SQLite (`export/nusawilayah.sqlite`)

One file with every wilayah and its postal code, for offline apps (Android/iOS, Flutter, desktop, Python, PHP).

```sql
CREATE TABLE wilayah (
  kode     TEXT PRIMARY KEY,
  nama     TEXT NOT NULL,
  level    TEXT NOT NULL CHECK (level IN ('provinsi', 'kabupaten', 'kecamatan', 'desa')),
  induk    TEXT REFERENCES wilayah (kode),
  tipe     TEXT CHECK (tipe IN ('kabupaten', 'kota', 'desa', 'kelurahan')),
  kode_pos TEXT
) WITHOUT ROWID;
CREATE INDEX wilayah_induk ON wilayah (induk);
CREATE INDEX wilayah_kode_pos ON wilayah (kode_pos);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- `induk` is `NULL` for provinsi. `tipe` is `NULL` for provinsi and kecamatan. `kode_pos` is set for desa only.
- `meta` keys: `versi`, `dasar_hukum`, `dibangun`, `sumber` (space-separated URLs), `atribusi`.
- Requires SQLite 3.8.2 or later (`WITHOUT ROWID`), which every supported Android and iOS version has.

Common queries:

```sql
-- dropdown options
SELECT kode, nama FROM wilayah WHERE level = 'provinsi' ORDER BY nama;
SELECT kode, nama FROM wilayah WHERE induk = '51' ORDER BY nama;

-- desa for a postal code
SELECT kode, nama, induk FROM wilayah WHERE kode_pos = '80361';

-- full address from one kode, deepest first
WITH RECURSIVE path(kode, nama, level, induk) AS (
  SELECT kode, nama, level, induk FROM wilayah WHERE kode = '51.03.01.1001'
  UNION ALL
  SELECT w.kode, w.nama, w.level, w.induk FROM wilayah w JOIN path p ON w.kode = p.induk
)
SELECT level, kode, nama FROM path;

-- name search
SELECT kode, nama, level FROM wilayah WHERE nama LIKE '%denpasar%' ORDER BY length(kode);
```

## 6. CSV (`export/csv/{level}.csv`)

One file per level, for importing into MySQL, PostgreSQL or a spreadsheet.

| File | Columns |
| --- | --- |
| `provinsi.csv` | `kode,nama` |
| `kabupaten.csv` | `kode,induk,nama,tipe` |
| `kecamatan.csv` | `kode,induk,nama` |
| `desa.csv` | `kode,induk,nama,tipe,kode_pos` |

- UTF-8 without BOM, LF line endings, one header row, rows sorted by kode.
- RFC 4180 quoting: a field is quoted only if it contains a comma, double quote or newline; quotes inside are doubled.
- Import every column as text. Spreadsheet apps turn `51.10` into the number `51.1` unless the column is set to text.

```csv
kode,induk,nama,tipe,kode_pos
51.03.01.1001,51.03.01,Tuban,kelurahan,80361
```

## 7. Versioning

The data package uses `YEAR.REVISION.PATCH`, independent of the code packages:

- `YEAR.REVISION` names the Kepmendagri edition. `2025.2` is the second 2025 decree (No. 300.2.2-2430).
- `PATCH` adds files or fixes the build without changing any kode or nama. A pinned `@2025.2` URL is therefore always safe to follow.

A new decree means a new `YEAR.REVISION`. Kode can then be added, removed, renamed or moved to another parent; a `changes.json` listing those changes is planned so that stored addresses can be migrated.

## 8. URLs

Every file is served by jsDelivr from npm:

```
https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist/provinsi.json
https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/dist/kabupaten/51.json
https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/export/nusawilayah.sqlite
https://cdn.jsdelivr.net/npm/@nusawilayah/data@2025.2/export/csv/desa.csv
```

Pin a full version (e.g. `@2025.2.3`) for reproducible builds.

## 9. License and attribution

MIT. Derived from [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) and [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos) (MIT, © cahya dsn). Region codes and names come from Kepmendagri No. 300.2.2-2430 Tahun 2025. Postal codes are best-effort and may be inaccurate for some desa.
