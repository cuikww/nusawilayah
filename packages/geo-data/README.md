# @nusawilayah/geo-data

> **Not published yet.** The boundaries come from [cahyadsn/wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries) (MIT), but where the polygons themselves come from is still being confirmed ([cahyadsn/wilayah_boundaries#9](https://github.com/cahyadsn/wilayah_boundaries/issues/9)). If they derive from OpenStreetMap, this package will be released under ODbL.

Boundaries of Indonesia's provinsi (38), kabupaten/kota (514) and kecamatan (7,285), keyed by Kemendagri kode, as TopoJSON, GeoJSON and SVG. Built by `pipeline/geo.ts`, which checks that every boundary pairs with a kode in `@nusawilayah/data` and the other way round.

| File | Content | Gzip (max) |
| --- | --- | --- |
| `provinsi.{topo.json,geojson,svg}` | all 38 provinsi, simplified to 1 km | 53 KB TopoJSON |
| `kabupaten/{provinsi}.{topo.json,geojson,svg}` | the kabupaten/kota of one provinsi, 300 m | 15 KB |
| `kecamatan/{provinsi}.{topo.json,geojson,svg}` | the kecamatan of one provinsi, 150 m | 66 KB |
| `meta.json` | source, simplification, disclaimer | |

Every feature has the properties `kode`, `nama` and `id`. In the SVG files the `id` is on each `<path>`, so plain HTML can colour regions with CSS:

```css
#kab-51-03 { fill: #08519c; }   /* Kabupaten Badung */
```

GeoJSON reads directly in Leaflet, MapLibre, D3, ECharts, Highcharts and GeoPandas. For React, use `@nusawilayah/map-react`.

**Disclaimer:** boundaries are illustrative, not legal boundaries. Official boundaries are set by Kemendagri and Badan Informasi Geospasial (BIG). Desa boundaries are not included (187 MB raw, rarely needed).
