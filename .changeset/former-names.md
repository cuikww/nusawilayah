---
'@nusawilayah/data': patch
'@nusawilayah/core': minor
'@nusawilayah/react': minor
---

Former names and code changes since the previous decree (Kepmendagri No. 100.1.1-6117 Tahun 2022).

- Data: search indexes carry former names (`[kode, nama, ...formerNames]`), new `dist/changes.json`, SQLite tables `alias` and `perubahan`, and `alias.csv` / `perubahan.csv`. Existing files keep their shape.
- Core: `search` matches former names and sets `alias` on the result; new `migrate(kode)` maps a saved kode to the current edition. `resolve` throws its not-found error with `status: 404`.
- React: search results show the former name they matched (`labels.formerly`).
