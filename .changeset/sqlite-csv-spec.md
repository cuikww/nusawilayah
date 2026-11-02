---
'@nusawilayah/data': patch
'@nusawilayah/core': minor
'@nusawilayah/react': minor
---

Data: add `export/nusawilayah.sqlite` and `export/csv/{level}.csv`, specified in docs/SPEC.md. The JSON in `dist/` is unchanged.

Core: domain rules split into their own module; new exports `displayName`, `formatPath`, `kodeOf`, `LoadError` and the `Fetcher` type. Error messages are now in English.

React: split into single-purpose modules; `DefaultField` is now exported for wrapping. English README.
