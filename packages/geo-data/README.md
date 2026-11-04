# @nusawilayah/geo-data

Boundaries of Indonesia's provinsi (38), kabupaten/kota (514) and kecamatan, keyed by Kemendagri kode, as TopoJSON, GeoJSON and SVG. From the BPS boundaries published by OCHA on [HDX](https://data.humdata.org/dataset/cod-ab-idn) (**CC BY 3.0 IGO**, see [LICENSE](LICENSE)), paired with the kode and names of `@nusawilayah/data` (Kepmendagri 2025) by `pipeline/geo.ts`.

**Coverage.** The source is valid on 1 April 2020. Every provinsi and kabupaten/kota has a boundary: the four provinces created in Papua in 2022 are built from their kabupaten. About 96% of kecamatan (6,987 of 7,285) have one; kecamatan created after 2020 (mostly in Papua) are still drawn inside the kecamatan they split from, and are listed in `meta.json` (`kecamatanTanpaBatas`).

| File | Content | Gzip (max) |
| --- | --- | --- |
| `provinsi.{topo.json,geojson,svg}` | all 38 provinsi, simplified to 1 km | 61 KB TopoJSON |
| `kabupaten/{provinsi}.{topo.json,geojson,svg}` | the kabupaten/kota of one provinsi, 300 m | 24 KB |
| `kecamatan/{provinsi}.{topo.json,geojson,svg}` | the kecamatan of one provinsi, 200 m | 98 KB |
| `meta.json` | source and licence, simplification, kecamatan without a boundary, disclaimer | |

Every feature has the properties `kode`, `nama` and `id`. In the SVG files the `id` is on each `<path>`, so plain HTML can colour regions with CSS:

```css
#kab-51-03 { fill: #08519c; }   /* Kabupaten Badung */
```

GeoJSON reads directly in Leaflet, MapLibre, D3, ECharts, Highcharts and GeoPandas. For React, use `@nusawilayah/map-react`.

**Attribution:** when you show these boundaries, credit "Batas wilayah: BPS (2020) via HDX, CC BY 3.0 IGO" (`<PetaIndonesia>` does). **Disclaimer:** boundaries are illustrative, not legal boundaries. Official boundaries are set by Kemendagri and Badan Informasi Geospasial (BIG). Desa boundaries are not included (650 MB raw, rarely needed).
