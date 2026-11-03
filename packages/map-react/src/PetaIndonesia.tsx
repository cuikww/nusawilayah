import { createGeo, DISCLAIMER, project, type GeoClient, type GeoLevel, type Region } from '@nusawilayah/geo';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

export interface PetaLabels {
  /** Accessible name of the map; `{level}` is replaced with the level. */
  title: string;
  loading: string;
  retry: string;
  noData: string;
  disclaimer: string;
}

export const petaLabelsId: PetaLabels = {
  title: 'Peta {level}',
  loading: 'Memuat peta…',
  retry: 'Coba lagi',
  noData: 'tidak ada data',
  disclaimer: DISCLAIMER,
};

export const petaLabelsEn: PetaLabels = {
  title: 'Map of {level}',
  loading: 'Loading map…',
  retry: 'Retry',
  noData: 'no data',
  disclaimer: 'Boundaries are illustrative, not legal boundaries. Official boundaries: Kemendagri and BIG.',
};

/** Five blues, light to dark: readable on white and distinguishable for common colour-vision deficiencies. */
export const BLUES = ['#deebf7', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];

/** Color for a value, given the data's range: five equal steps of `colors`. */
export const quantize = (colors: string[], min: number, max: number) => (value: number) =>
  colors[Math.min(colors.length - 1, Math.floor(((value - min) / (max - min || 1)) * colors.length))];

export interface PetaIndonesiaProps {
  /** `provinsi` shows all of Indonesia; `kabupaten`/`kecamatan` show one provinsi (`provinsi` prop). */
  level?: GeoLevel;
  /** Provinsi kode for kabupaten and kecamatan maps, e.g. '51'. */
  provinsi?: string;
  /** Choropleth values per kode, e.g. { '51.71': 120, '51.03': 340 }. */
  data?: Record<string, number>;
  /** Fill for a value. Default: five steps of BLUES over the data's range. */
  colorScale?: (value: number) => string;
  /** Formats values in tooltips and the legend. */
  formatValue?: (value: number) => string;
  /** Kode of the selected region (highlighted), e.g. the picker's value. */
  value?: string;
  /** Called when a region is clicked or activated with Enter/Space. */
  onSelect?: (region: { kode: string; nama: string }) => void;
  /** Kode to zoom to: a region of the map, or a parent of some (a kabupaten on a kecamatan map). */
  zoomTo?: string;
  /** Your own client (self-hosted geo-data, custom fetcher). Default: shared jsDelivr client. */
  client?: GeoClient;
  labels?: Partial<PetaLabels>;
  className?: string;
}

let sharedClient: GeoClient | undefined;

/** Interactive SVG map of Indonesian regions, keyed by Kemendagri kode. */
export function PetaIndonesia({
  level = 'provinsi', provinsi, data, colorScale, formatValue = String, value, onSelect, zoomTo, client, labels: overrides, className,
}: PetaIndonesiaProps) {
  const geo = client ?? (sharedClient ??= createGeo());
  const labels = { ...petaLabelsId, ...overrides };
  const [state, setState] = useState<{ key: string; regions?: ReturnType<typeof project>; error?: Error }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const key = `${level}:${provinsi ?? ''}`;

  useEffect(() => {
    let live = true; // drop a response for a map the user has already left
    geo.load(level, provinsi).then(
      (features) => live && setState({ key, regions: project(features) }),
      (error: Error) => live && setState({ key, error }),
    );
    return () => { live = false; };
  }, [geo, key, attempt]);

  const fill = useMemo(() => {
    if (colorScale) return colorScale;
    const values = Object.values(data ?? {});
    return quantize(BLUES, Math.min(...values), Math.max(...values));
  }, [data, colorScale]);

  const map = state.key === key ? state.regions : undefined;
  const error = state.key === key ? state.error : undefined;
  const title = labels.title.replace('{level}', level);

  // Zoom to a region, or to every region inside it (a kabupaten on a kecamatan map).
  const inZoom = (r: Region) => !zoomTo || r.kode === zoomTo || r.kode.startsWith(`${zoomTo}.`);
  const viewBox = useMemo(() => {
    const inside = zoomTo ? map?.regions.filter(inZoom) ?? [] : [];
    if (!map || !inside.length) return map?.viewBox;
    const x0 = Math.min(...inside.map((r) => r.box[0])), y0 = Math.min(...inside.map((r) => r.box[1]));
    const x1 = Math.max(...inside.map((r) => r.box[0] + r.box[2])), y1 = Math.max(...inside.map((r) => r.box[1] + r.box[3]));
    // Grow the box to the full map's aspect ratio, so zooming never changes the map's height on the page.
    const pad = Math.max(x1 - x0, y1 - y0) * 0.1;
    let w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
    const aspect = map.width / map.height;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    const round = (n: number) => Math.round(n * 10) / 10;
    return [(x0 + x1 - w) / 2, (y0 + y1 - h) / 2, w, h].map(round).join(' ');
  }, [map, zoomTo]);

  const select = (r: Region) => onSelect?.({ kode: r.kode, nama: r.nama });
  const onKey = (r: Region) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r); }
  };
  const label = (r: Region) => {
    const v = data?.[r.kode];
    return data ? `${r.nama}: ${v === undefined ? labels.noData : formatValue(v)}` : r.nama;
  };
  const values = Object.values(data ?? {});

  return (
    <figure className={className} data-nw-map={level} style={{ margin: 0 }}>
      {error ? (
        <p role="alert" data-nw-error>
          {error.message} <button type="button" onClick={() => setAttempt((a) => a + 1)}>{labels.retry}</button>
        </p>
      ) : !map ? (
        <p role="status" data-nw-status>{labels.loading}</p>
      ) : (
        <svg viewBox={viewBox} role="group" aria-label={title} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {map.regions.map((r) => {
            const v = data?.[r.kode];
            const selected = r.kode === value;
            return (
              <path
                key={r.kode}
                id={r.id}
                d={r.d}
                data-kode={r.kode}
                data-nw-region
                role={onSelect ? 'button' : 'img'}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={label(r)}
                aria-pressed={onSelect ? selected : undefined}
                fill={v !== undefined ? fill(v) : data ? '#e5e7eb' : selected ? '#0b57d0' : '#cbd5e1'}
                stroke={selected ? '#1a1a1a' : '#fff'}
                strokeWidth={selected ? 2 : 0.75}
                fillOpacity={inZoom(r) ? undefined : 0.35} // neighbours of the zoomed region fade out
                vectorEffect="non-scaling-stroke"
                style={onSelect ? { cursor: 'pointer', outline: 'none' } : undefined}
                onClick={() => select(r)}
                onKeyDown={onKey(r)}
              >
                <title>{label(r)}</title>
              </path>
            );
          })}
        </svg>
      )}
      {data && values.length > 0 && !colorScale && (
        <ul data-nw-legend aria-label="Legend" style={{ display: 'flex', gap: '0.75rem', listStyle: 'none', padding: 0, margin: '0.5rem 0 0', flexWrap: 'wrap', fontSize: '0.85em' }}>
          {BLUES.map((c, i) => {
            const min = Math.min(...values), step = (Math.max(...values) - min) / BLUES.length;
            return (
              <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span aria-hidden style={{ width: 14, height: 14, background: c, display: 'inline-block', border: '1px solid #767676' }} />
                {formatValue(Math.round(min + step * i))}–{formatValue(Math.round(min + step * (i + 1)))}
              </li>
            );
          })}
        </ul>
      )}
      <figcaption data-nw-disclaimer style={{ fontSize: '0.8em', marginTop: '0.5rem' }}>{labels.disclaimer}</figcaption>
    </figure>
  );
}
