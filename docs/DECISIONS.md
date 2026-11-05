# Technical decisions

Decisions made during implementation, complementing the [PRD](PRD.md). Newest sections last.

## 2026-11-02: Initial setup (week 1)

**Package names.** `nusawilayah` and the `@nusawilayah` scope were unused on npm and GitHub (checked 2026-11-02).

**Legal basis: Kepmendagri No. 300.2.2-2430 Tahun 2025.** The header of `db/wilayah.sql` in cahyadsn/wilayah still says 300.2.2-2138, but that repository's README states 2430, and the counts per level match the 2430 summary (38 / 514 / 7,285 / 83,762). We use 2430.

**Sources pinned per commit.** `pipeline/build.ts` downloads the SQL from a specific commit, not a branch, so builds are reproducible. A new data release = bump the commit and rebuild.

**Data files use tuples, not objects.** Rows are `[kode, nama]`, and `[kode, nama, kodePos]` at desa level. `level`, `induk` and `tipe` are derived:
- level: number of kode segments
- induk: kode without its last segment
- kabupaten/kota type: name starts with `Kota ` → `kota`, else `kabupaten`
- desa/kelurahan type: first digit of the 4th segment `1` → `kelurahan`, `2` → `desa`, `3` (desa adat, Papua) → `desa`

Names are stored as official names, including the "Kabupaten"/"Kota" prefix.

**Measured sizes (gzip):** kabupaten files average 0.18 KB / max 0.36 KB; kecamatan 0.18 / 0.45 KB; desa (with postal codes) 0.17 / 0.85 KB. The < 1 KB per step target is met.

**Postal code index per 2-digit prefix** (`kodepos/80.json`): average 8 KB, max 34 KB gzip. Heavier than a step file, but only loaded for a postal code lookup. Split per 3 digits if it proves slow.

**No transpiler for the pipeline.** Node 24 runs TypeScript directly (type stripping), so no tsx/ts-node. Requires Node ≥ 24.

**Core cache: memory only for now.** Failed loads are not cached, so they can be retried (PRD F3.6). IndexedDB cache (F2.2) later.

**Kode validated in core.** `children()` rejects a kode that does not match the pattern before fetching, so a kode can never become a path like `../x`.

## 2026-11-02: v0.1, cascade + React

**Cascade state lives in core; React is only an adapter.** `createCascade()` holds selection, options, loading and error per level and offers `subscribe`. React reads it with `useSyncExternalStore`. A Vue adapter only needs to rewrite this thin layer.

**Race conditions handled in core.** Late responses for an old selection are dropped, so a user switching provinces quickly never sees the wrong kabupaten. A user selection also cancels a `setValue` still in progress.

**`byPostalCode` returns `[]` only on 404.** Network errors are thrown, not hidden. A custom fetcher must throw an error with `status: 404` for a missing file.

**Native `<select>` by default.** Accessibility and mobile work without extra ARIA code. Other UIs plug in through `components.Field`. No bundled CSS.

**Hidden inputs for HTML forms:** `{name}` = deepest kode, `{name}_kodepos` = postal code.

**Postal code is read-only**, taken from the desa data. Reverse lookup (postal code → wilayah, F3.3) uses `byPostalCode`, exposed in search mode.

**Measured bundle size:** core 2.2 KB + react 1.7 KB gzip (target < 15 KB).

**Shared client.** Every `<WilayahPicker>` without a `client` prop uses one client, so the cache is shared.

**Releases:** Changesets + GitHub Actions, npm provenance. Code starts at 0.1.0. Data starts at 2025.2.0 (`YEAR.REVISION.patch`).

## 2026-11-02: v0.2, search mode

**Two-tier search index.** Tier one, `search/nasional.json` (provinsi to kecamatan, 7,837 entries), is always loaded. Tier two, `search/{provinsi}.json` (desa), averages 17 KB and is at most 59 KB gzip. Desa indexes load only for relevant provinces: those set with `provinsi`, or at most the top 3 provinces whose names match a query word. So a village searched without naming a parent ("seminyak" alone) is not found, while "seminyak kuta" or "seminyak bali" is.

**Matching rule:** every query word must prefix a word of the wilayah name or of its parents' names, and at least one must match the wilayah itself. The words kabupaten/kab/kecamatan/kec/desa/kelurahan/kel/provinsi/prov are ignored. "kota" is kept because it tells Kota Bogor from Kabupaten Bogor. Case, accents and apostrophes are ignored ("bau" matches "Ba'u").

**Ranking:** exact name first ("Kota X" counts as exact for "x"), then names starting with the query, then higher levels, then shorter names.

**Postal codes in the search box.** Five digits are treated as a postal code. This covers the reverse direction of F3.3: when one postal code covers several desa, the user picks from the list.

**Display labels** drop the "Kabupaten " prefix ("Kuta, Badung, Bali") but keep "Kota " to stay unambiguous.

**ARIA 1.2 combobox** for search mode: input `role=combobox`, `listbox`/`option`, `aria-activedescendant`, `role=status` for "no results". Tested with axe (WCAG 2.1 AA) in real Chrome: 0 violations.

**Browser tests:** `apps/example-vite` (data self-hosted via `publicDir`) + Playwright using the installed Chrome (`channel: 'chrome'`), run in CI.

**Bundle size v0.2:** core 3.3 KB + react 3.0 KB gzip (target < 15 KB).

**Data version `2025.2.1`:** adding search indexes is a patch, because no region data changed. The `@2025.2` CDN URL follows automatically.

## 2026-11-02: Releases through Trusted Publishing

**Finding:** releases 0.1.0 and 0.2.0 were published with the `NPM_TOKEN` token and without provenance, despite `publishConfig.provenance: true`. The OIDC token exchange is done by the npm CLI (≥ 11.5.1), and `pnpm publish` silently uses a token when one is present.

**Decision:** the Release workflow is split. changesets/action only opens the version PR; a separate step runs `pnpm release` with the latest npm, `id-token: write`, `NPM_CONFIG_PROVENANCE=true` and **no token at all**. If the trusted publisher is not configured on npm, publishing fails loudly instead of falling back to a token.

**Verified** on core/react 0.2.1 and data 2025.2.2: all three were published by the GitHub trusted publisher with provenance. npm tokens are no longer used, and each package's publishing access disallows tokens.

## 2026-11-02: SQLite, CSV and SPEC.md (PRD F5.1–F5.3)

**One SQLite table, not one per level.** `wilayah(kode, nama, level, induk, tipe, kode_pos)` with indexes on `induk` and `kode_pos`. Every dropdown is `WHERE induk = ?`, a postal code lookup is `WHERE kode_pos = ?`, and a full address is one recursive CTE. `WITHOUT ROWID` saves about 0.4 MB (9.3 MB total, 1.8 MB gzip) and needs SQLite ≥ 3.8.2, which every supported Android/iOS version has.

**CSV per level with only the columns that level uses** (F5.2), UTF-8 without BOM, LF, RFC 4180 quoting only where needed. A BOM helps Excel but breaks `LOAD DATA` and `COPY`; database import is the main use case.

**Built with `node:sqlite`.** Node 24 ships SQLite, so the pipeline still has no runtime dependencies.

**SQLite and CSV live in `export/`, not `dist/`.** Self-hosters copy `dist/` to their public folder; they should not ship 13 MB of exports with it. Both folders are in the npm package, so jsDelivr serves the exports at stable URLs (`@2025.2/export/nusawilayah.sqlite`) without a separate download host. The npm tarball grows from 2.3 MB to 4.9 MB, which only affects those who install `@nusawilayah/data` directly (the JS client loads from the CDN).

**One source of domain rules.** `packages/core/src/wilayah.ts` (level, induk, tipe, display name) is imported by both the core client and the pipeline, so JSON, SQLite and CSV can never disagree on how a kode is interpreted. The file is pure TypeScript without TS-only syntax, so Node can run it directly.

**Core split by responsibility:** `wilayah.ts` domain rules, `loader.ts` transport + cache, `search.ts`, `cascade.ts`, and `index.ts` wiring them together. The React package is split the same way: `labels`, `useWilayah`, `DefaultField`, `SearchField`, `WilayahPicker`.

**English for code, errors and docs.** UI labels stay Indonesian by default (`labelsEn` exists), and the data keeps the official Indonesian terms (`kode`, `nama`, `provinsi`, ...), explained in the SPEC glossary.

## 2026-11-02: Former names and changes.json (PRD F1.2, F2.5, data change risk)

**Source: cahyadsn `db/archive`, compared per kode.** As the PRD planned, former names come from the 2022 and 2023 archives in the same repo, pinned to the same commit. `wilayah_2023.sql` is Kepmendagri No. 100.1.1-6117 Tahun 2022 (per its header) and is the previous edition for `changes.json`. The 2016-2020 archives are older Permendagri editions and are left out; 2016 also uses another dump format.

**Name identity:** lowercase, no accents, punctuation or spaces, no leading `Kab.`/`Kabupaten`. Without it, every archive kabupaten (`KAB. ACEH SELATAN`) would count as renamed. Real renames found: 776 since the previous edition (mostly spelling, e.g. Pasi Raja → Pasie Raja, STM Hilir → Sinembah Tanjung Muda Hilir), 1,438 former names in total.

**Moves are matched by name within the provinsi and level, and only when the match is unique** (90 since the previous edition, mostly villages moved to a new kecamatan). A move that also changed the name is reported as removed + new; guessing would be worse than asking the user again.

**Aliases only in the search indexes** (`[kode, nama, ...formerNames]`), not in the per-step files: only search needs them, and older clients ignore extra tuple elements, so data `2025.2.4` stays a patch. Search tries every name of an entry, scores the best one, and prefers the current name on a tie. `SearchResult.alias` says which former name matched, and the React picker shows it ("dulu Johan Pahwalan").

**`migrate(kode)` in core** loads `changes.json` (27 KB gzip) on first use only. It returns `unknown` for a kode in neither edition and rethrows network errors, so an outage is never mistaken for a removed address. `resolve` now throws its "not found" error with `status: 404` so callers can tell it apart from network errors.

**SQLite and CSV get `alias` and `perubahan`** so non-JS users can search former names and migrate in SQL.

## 2026-11-02: Completing v0.1 and v0.2 (PRD roadmap, Gate 2)

**IndexedDB cache (F2.2)** is a `Store` (get/set) behind the existing fetcher, opt-in with `cache: 'indexeddb'`. Entries expire after 7 days (data patches never change a kode or nama, so a week-old file is still correct) and are namespaced by `baseUrl` so different data sources never mix. The store is only a cache: if IndexedDB fails or is missing (private mode, SSR), the client fetches as before. Tested in real Chrome by blocking the data requests on a reload.

**Server-rendered provinsi (F3.8)** via `initialProvinsi`: the cascade starts with those options and never fetches level 1, so `useSyncExternalStore`'s server snapshot already contains them. Verified in a Next.js production build: the HTML contains all 38 `<option>`s.

**Postal code is editable** (PRD risk: inaccurate postal codes). `cascade.setKodePos` overrides the derived value until the selection changes; the React field strips non-digits and caps at 5.

**Optional theme** `@nusawilayah/react/style.css`, scoped to `[data-nw-picker]` and driven by `--nw-*` variables. The component stays unstyled unless it is imported (`sideEffects: ["*.css"]` keeps bundlers from dropping it).

**`npx nusawilayah copy <folder>`** is a bin of `@nusawilayah/data`, not a separate `nusawilayah` package: it copies the exact installed data version, and a new unscoped package could not be published through Trusted Publishing without a token first. `npx nusawilayah` therefore needs `@nusawilayah/data` installed; otherwise npx would look up an unrelated `nusawilayah` package on npm. Reserving that name on npm is worth doing.

**size-limit (Gate 2)** with gzip, as the PRD measures: core 3.3 KB, react alone 2.5 KB, `import { WilayahPicker }` with core 5.3 KB (limit 15 KB).

**React 18** is tested in CI by installing React 18 into the react package as the last CI step, instead of a second copy of the test setup.

**Docs + playground** in `apps/docs` (Vite), deployed to GitHub Pages by the Docs workflow with the data self-hosted next to the site, so the playground always shows the repo's data. It replaces a separate Storybook for now.

**`apps/example-next`** (App Router, production build in e2e) covers server rendering, `nusawilayah copy` as a build step, and a plain `<form method="get">` submit.

**Measured on a simulated mid-range phone** (4x CPU slowdown, 4G with 150 ms latency, Next.js production build): provinsi visible at first paint (0.6 s from navigation, network-bound), hydrated at 2.4 s (mostly the Next.js runtime), next dropdown 0.4 s over the network and 24 ms from cache. The PRD's "< 100 ms to the provinsi dropdown" is met only in the sense that server rendering adds no wait after first paint; from navigation start it is bound by the network.

## 2026-11-02: Monthly data check

**`.github/workflows/data-update.yml`** runs on the 1st of each month (and on demand). For each pinned source it compares the file's blob SHA at the pinned commit with the latest commit touching that file, not the commit SHAs: the pinned commit is usually the repo HEAD at the time, newer than the last commit touching the file, so comparing commits would open empty PRs. On a change it bumps the commit in `pipeline/build.ts`, runs the pipeline (integrity checks fail the run instead of opening a PR with bad data), and opens or updates one PR on `data/update-sources` with a `@nusawilayah/data` patch changeset and the build output. `dist/` and `export/` stay build outputs, so the PR is only those two files. PRs opened with `GITHUB_TOKEN` do not trigger CI; close and reopen the PR to run it.

Checked on 2 November 2026: both pinned sources hold the same file contents as upstream's latest, so there is no data update yet.

## 2026-11-03: v0.3 maps, unreleased until gate 3

**Built on kyky's boundary pipeline** (`pipeline/geolib.ts`, `pipeline/geo.ts`): parses cahyadsn/wilayah_boundaries, swaps [lat, lng] to GeoJSON order, and fails unless every boundary pairs with a kode in the region data and the other way round. It passes for all 38 / 514 / 7,285. The repo now has provinsi boundaries (`db/prov/`), so the PRD's "dissolve kabupaten into provinsi" step is not needed.

**`-clean` before `-simplify`.** In mapshaper, `-clean` after `-simplify` rebuilds the arcs at full resolution, which is why the first run produced a 299 KB provinsi map. Simplification is a distance per level (1 km / 300 m / 150 m) rather than a share of points, so detail is even across provinces of very different sizes: provinsi map 53 KB, largest kabupaten file 15 KB, largest kecamatan file 66 KB (gzip TopoJSON). The pipeline fails when a file exceeds its budget (150 / 50 / 100 KB).

**One `@nusawilayah/geo-data` package instead of geo-provinsi/geo-kabupaten/geo-kecamatan.** Clients load one file per map from the CDN anyway, so splitting the npm package only helps self-hosters save disk; one package is simpler to version alongside `@nusawilayah/data`.

**`@nusawilayah/geo` has no dependencies** (1.1 KB gzip): TopoJSON decoding and a fitted Mercator projection are about 100 lines, smaller than topojson-client + d3-geo. Mercator because Indonesia spans the equator (little distortion) and it matches web maps.

**`<PetaIndonesia>`** (map-react + geo: 2.5 KB gzip) renders each region as a `<path>` with `role="button"`, its name (and value) as label, `aria-pressed` for the selected kode, and Enter/Space; axe reports 0 violations. `zoomTo` accepts a parent kode (a kabupaten on a kecamatan map) and keeps the full map's aspect ratio, so zooming never changes the map's height on the page. The choropleth uses five blues with a legend.

**Picker ↔ map sync is not a feature of either package**: the app keeps one kode and derives both from it (`apps/example-map`). The map stays independent of the picker and of React-free uses.

**Unreleased until gate 3** (resolved 2026-11-04, below; published 2026-11-05, the first versions by hand without provenance, later ones through Trusted Publishing). geo-data, geo and map-react are `private`, and `apps/example-map` is not deployed (the docs site has no map): publishing the boundaries in any form would be distributing them before their origin and licence are known ([cahyadsn/wilayah_boundaries#9](https://github.com/cahyadsn/wilayah_boundaries/issues/9)). When it is answered: set the licence (ODbL if OSM-derived), remove `private`, add the packages to Trusted Publishing, and add the map to the docs site.

## 2026-11-04: map boundaries from BPS via HDX (gate 3)

**cahyadsn/wilayah_boundaries cannot be published.** Asked in [#9](https://github.com/cahyadsn/wilayah_boundaries/issues/9), the owner answered that the polygons are mixed: partly from Dukcapil, BIG and OpenStreetMap, partly traced from Google Maps, and that they may be used freely. That permission covers only his own work: data traced from Google Maps may not be redistributed under any licence, and the OSM parts would need ODbL. Since nobody knows which polygon comes from where, none of it is safe to publish.

**Source: HDX cod-ab-idn (BPS, OCHA ROAP), CC BY 3.0 IGO.** Free for commercial use with attribution, so `@nusawilayah/geo-data` is CC BY 3.0 IGO while the code stays MIT; `DISCLAIMER` (shown under every map) carries the attribution. OpenStreetMap was the alternative: current, but ODbL share-alike for the whole data package and of uneven completeness for kecamatan. The two cannot be mixed. BIG's own boundaries would be the most official, but their terms of use are unclear.

**Pairing by name.** BPS codes equal Kemendagri codes only at provinsi level, and the source is from 2020: kabupaten are paired by name within their type (kota with kota, so Kota Tegal never pairs with Kabupaten Tegal), with four renames written out; kecamatan by name within their kabupaten, one to one, best first, with a similarity of at least 0.6 after spelling out Roman numerals and abbreviations (`pipeline/geolib.ts`). All 514 kabupaten pair; 6,987 of 7,285 kecamatan (95.9%) do, the rest were created after 2020 and are listed in `meta.json`. The build prints every non-exact pair for review and fails below 95% coverage. Provinsi are dissolved from kabupaten, which gives the 2022 Papua provinces. Lakes, reservoirs and sea units (BPS codes `..88`, `..99`, `...888`, `...555`) are dropped.

**Kecamatan simplified to 200 m** (was 150 m): the BPS lines are more detailed, and at 150 m Jawa Barat and Jawa Timur exceeded the 100 KB budget. Sizes now: provinsi 61 KB, kabupaten up to 24 KB, kecamatan up to 98 KB (gzip TopoJSON).

**Source file pinned by sha256.** HDX refuses scripted downloads, so the 456 MB `idn_admin_boundaries.geojson.zip` is mirrored as a release asset of this repo (tag `geo-source`, allowed by the licence) for CI; a local copy in `pipeline/.cache` is used first.

## Not done yet

- Gate 1: use the picker in a real project
- lint and Storybook in CI, Lighthouse score
- the map on the docs site, and SVG/PNG downloads of one region for people who do not code
