# @nusawilayah/geo

> **Not published yet**: waits for the boundary data licence (see `@nusawilayah/geo-data`).

Headless maps of Indonesian regions, without dependencies (about 1 KB gzip): loads `@nusawilayah/geo-data` TopoJSON and projects it to SVG paths. Works with any framework, or none.

```ts
import { createGeo, project } from '@nusawilayah/geo'

const geo = createGeo({ baseUrl: '/geo' })      // folder with @nusawilayah/geo-data/dist
const features = await geo.load('kabupaten', '51') // the kabupaten/kota of Bali: [{ kode, nama, id, polygons }]
const map = project(features, { width: 800 })   // { viewBox, regions: [{ kode, nama, id, d, box }] }

svg.setAttribute('viewBox', map.viewBox)
svg.innerHTML = map.regions.map((r) => `<path id="${r.id}" d="${r.d}"><title>${r.nama}</title></path>`).join('')
```

Levels: `load('provinsi')` (all of Indonesia), `load('kabupaten', provinsi)`, `load('kecamatan', provinsi)`. The projection is Mercator, like web maps. Boundaries are illustrative, not legal boundaries (`DISCLAIMER`).
