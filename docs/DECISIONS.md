# Technical decisions

Decisions made during implementation, complementing the PRD. Newest sections last.

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

## Not done yet

- core: IndexedDB cache, old-name aliases in search
- React: server-rendered provinsi (RSC)
- CLI `npx nusawilayah copy`
- `changes.json` between data releases
- load time on a mid-range phone
