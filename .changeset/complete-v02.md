---
'@nusawilayah/core': minor
'@nusawilayah/react': minor
'@nusawilayah/data': patch
---

Completes v0.1 and v0.2.

- Core: `createWilayah({ cache: 'indexeddb' })` keeps loaded files in IndexedDB for 7 days (or any `Store`); `createCascade({ initialProvinsi })` starts from server-loaded provinsi; `cascade.setKodePos()` lets users correct the postal code.
- React: `initialProvinsi` prop for server-rendered provinsi (Next.js App Router); the postal code field is editable; optional theme `@nusawilayah/react/style.css`; `useWilayah` returns `setKodePos`. Tested with React 18 and 19.
- Data: `npx nusawilayah copy <folder>` copies the JSON data for self-hosting.
