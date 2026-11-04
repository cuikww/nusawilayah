# @nusawilayah/map-react

`<PetaIndonesia>`: an interactive SVG map of Indonesian regions, keyed by the same Kemendagri kode as `@nusawilayah/react`'s picker. About 2.5 KB gzip with `@nusawilayah/geo`.

```tsx
import { PetaIndonesia } from '@nusawilayah/map-react'

<PetaIndonesia />                                                  // all 38 provinsi
<PetaIndonesia level="kabupaten" provinsi="51" onSelect={(w) => setKode(w.kode)} />
<PetaIndonesia data={{ '51': 120, '32': 340 }} formatValue={(v) => `${v} orders`} />   // choropleth + legend
```

| Prop | Description |
| --- | --- |
| `level` | `provinsi` (default), `kabupaten` or `kecamatan` |
| `provinsi` | Provinsi kode for kabupaten/kecamatan maps |
| `data`, `colorScale`, `formatValue` | Choropleth values per kode; default five blues over the data's range |
| `value` | Selected kode (highlighted, `aria-pressed`) |
| `onSelect` | Click or Enter/Space on a region |
| `zoomTo` | Zoom to a region, or to all regions inside a kode (a kabupaten on a kecamatan map) |
| `client` | `createGeo({ baseUrl })` for self-hosted boundaries |
| `labels` | `petaLabelsId` (default) or `petaLabelsEn` |

Regions are focusable buttons with their name (and value) as label; each `<path>` has the id `prov-51`, `kab-51-03` or `kec-51-03-01` and `data-kode`, for CSS. The map shows a "not legal boundaries" disclaimer.

Sync with the picker: keep one kode in state, pass it to `<WilayahPicker value>` and derive `level`/`provinsi`/`value` of the map from it; `onSelect` sets it. A working example is in [apps/example-map](https://github.com/cuikww/nusawilayah/tree/main/apps/example-map).
