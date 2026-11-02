import { createWilayah, LEVELS, type Alamat, type CascadeOptions, type Level, type LevelState, type SearchOptions, type SearchResult, type Wilayah, type WilayahClient } from '@nusawilayah/core';
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type Ref } from 'react';

export type { Alamat, Level, SearchResult, Wilayah } from '@nusawilayah/core';

export interface Labels extends Record<Level, string> {
  kodePos: string;
  loading: string;
  retry: string;
  /** Teks pilihan kosong per level; `{label}` diganti nama level. */
  placeholder: string;
  search: string;
  searchPlaceholder: string;
  noResults: string;
}

export const labelsId: Labels = {
  provinsi: 'Provinsi',
  kabupaten: 'Kabupaten/Kota',
  kecamatan: 'Kecamatan',
  desa: 'Desa/Kelurahan',
  kodePos: 'Kode Pos',
  loading: 'Memuat…',
  retry: 'Coba lagi',
  placeholder: 'Pilih {label}',
  search: 'Cari wilayah',
  searchPlaceholder: 'Ketik nama wilayah atau kode pos',
  noResults: 'Wilayah tidak ditemukan',
};

export const labelsEn: Labels = {
  provinsi: 'Province',
  kabupaten: 'Regency/City',
  kecamatan: 'District',
  desa: 'Village',
  kodePos: 'Postal code',
  loading: 'Loading…',
  retry: 'Retry',
  placeholder: 'Select {label}',
  search: 'Search region',
  searchPlaceholder: 'Type a region name or postal code',
  noResults: 'No region found',
};

export interface UseWilayahOptions extends CascadeOptions {
  /** Klien core sendiri (baseUrl self-host, fetcher kustom). Default: CDN jsDelivr. */
  client?: WilayahClient;
  /** Kode atau Alamat awal (uncontrolled), mis. dari data tersimpan. */
  defaultValue?: string;
  /** Controlled: kode atau Alamat. `null`/`''` mengosongkan. */
  value?: string | Alamat | null;
  onChange?: (alamat: Alamat) => void;
}

let sharedClient: WilayahClient | undefined; // one cache for every picker on the page

const kodeOf = (v: string | Alamat | null | undefined) =>
  typeof v === 'string' ? v || undefined : (v?.desa ?? v?.kecamatan ?? v?.kabupaten ?? v?.provinsi)?.kode;

/** Hook headless: pakai untuk merender dropdown dengan komponen UI sendiri. */
export function useWilayah({ client, levels = 4, provinsi, defaultValue, value, onChange }: UseWilayahOptions = {}) {
  const c = client ?? (sharedClient ??= createWilayah());
  const provinsiKey = provinsi?.join(',');
  // provinsiKey stands in for the array so a new array literal each render doesn't reset the picker
  const cascade = useMemo(() => c.createCascade({ levels, provinsi }), [c, levels, provinsiKey]);
  const state = useSyncExternalStore(cascade.subscribe, cascade.getState, cascade.getState);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const controlled = value !== undefined;
  const target = controlled ? kodeOf(value) : defaultValue;
  useEffect(() => {
    if ((controlled || target) && target !== cascade.getState().kode) {
      cascade.setValue(target).catch((e) => console.error('nusawilayah:', e));
    }
    // defaultValue only applies when the cascade is (re)created; value applies whenever it changes
  }, [cascade, controlled ? target : undefined]);

  const select = useCallback(
    (level: Level | number, kode?: string) => {
      const p = cascade.select(level, kode);
      onChangeRef.current?.(cascade.getState().alamat);
      return p;
    },
    [cascade],
  );

  /** Isi semua level dari satu kode (mis. hasil pencarian), lalu panggil onChange. */
  const setKode = useCallback(
    async (kode: string) => {
      await cascade.setValue(kode);
      onChangeRef.current?.(cascade.getState().alamat);
    },
    [cascade],
  );

  return { ...state, select, setKode, retry: cascade.retry, client: c };
}

/** Props untuk mengganti satu field (label + dropdown + status) dengan komponen UI sendiri. */
export interface FieldProps {
  id: string;
  level: Level;
  label: string;
  placeholder: string;
  options: Wilayah[];
  /** Kode terpilih, '' jika kosong. */
  value: string;
  onChange: (kode: string | undefined) => void;
  onBlur?: () => void;
  disabled: boolean;
  required?: boolean;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  labels: Labels;
  selectRef?: Ref<HTMLSelectElement>;
}

function DefaultField(p: FieldProps) {
  const errorId = `${p.id}-error`;
  return (
    <div data-nw-field={p.level}>
      <label htmlFor={p.id}>{p.label}</label>
      <select
        id={p.id}
        ref={p.selectRef}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value || undefined)}
        onBlur={p.onBlur}
        disabled={p.disabled}
        required={p.required}
        aria-busy={p.loading || undefined}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={p.error ? errorId : undefined}
      >
        <option value="">{p.loading ? p.labels.loading : p.placeholder}</option>
        {p.options.map((o) => (
          <option key={o.kode} value={o.kode}>{o.nama}</option>
        ))}
      </select>
      {p.error && (
        <span id={errorId} role="alert" data-nw-error>
          {p.error.message}{' '}
          <button type="button" onClick={p.onRetry}>{p.labels.retry}</button>
        </span>
      )}
    </div>
  );
}

const display = (w?: Wilayah) => w?.nama.replace(/^Kabupaten /, '');
const alamatLabel = (a: Alamat) => [a.desa, a.kecamatan, a.kabupaten, a.provinsi].map(display).filter(Boolean).join(', ');

interface SearchFieldProps {
  id: string;
  client: WilayahClient;
  options: SearchOptions;
  labels: Labels;
  /** Label of the current value, shown when the user is not typing. */
  current: string;
  onPick: (kode: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/** ARIA 1.2 combobox: one text input + listbox of results. */
function SearchField({ id, client, options, labels, current, onPick, onBlur, disabled, required, inputRef }: SearchFieldProps) {
  const [query, setQuery] = useState<string | null>(null); // null = not editing, show `current`
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const latest = useRef(0);
  const listId = `${id}-list`;

  const run = (q: string) => {
    const my = ++latest.current;
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setError(undefined);
    client.search(q, options).then(
      (r) => { if (my === latest.current) { setResults(r); setActive(r.length ? 0 : -1); setLoading(false); } },
      (e) => { if (my === latest.current) { setError(e); setLoading(false); } },
    );
  };
  const pick = (r: SearchResult) => {
    setQuery(null);
    setOpen(false);
    onPick(r.wilayah.kode);
  };
  const close = () => { setOpen(false); setQuery(null); };

  const showList = open && query !== null && query.trim() !== '' && !loading && !error;
  return (
    <div data-nw-field="search">
      <label htmlFor={id}>{labels.search}</label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-busy={loading || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder={labels.searchPlaceholder}
        value={query ?? current}
        disabled={disabled}
        required={required}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); run(e.target.value); }}
        onBlur={() => { close(); onBlur?.(); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!showList) { setOpen(true); return; }
            const d = e.key === 'ArrowDown' ? 1 : -1;
            setActive((a) => (results.length ? (a + d + results.length) % results.length : -1));
          } else if (e.key === 'Enter' && showList && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === 'Escape') {
            close();
          }
        }}
      />
      <ul id={listId} role="listbox" aria-label={labels.search} hidden={!showList || !results.length}>
        {results.map((r, i) => (
          <li
            key={r.wilayah.kode}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            data-nw-active={i === active || undefined}
            onMouseDown={(e) => { e.preventDefault(); pick(r); }} // before input blur
            onMouseEnter={() => setActive(i)}
          >
            {r.label}
          </li>
        ))}
      </ul>
      <div role="status" data-nw-status>
        {loading ? labels.loading : showList && !results.length ? labels.noResults : ''}
      </div>
      {error && (
        <span id={`${id}-error`} role="alert" data-nw-error>
          {error.message}{' '}
          <button type="button" onClick={() => run(query ?? '')}>{labels.retry}</button>
        </span>
      )}
    </div>
  );
}

export interface WilayahPickerProps extends UseWilayahOptions {
  /** `cascade`: satu dropdown per level (default). `search`: satu kolom pencarian, termasuk kode pos. */
  mode?: 'cascade' | 'search';
  /** Nama hidden input: `{name}` berisi kode terdalam, `{name}_kodepos` berisi kode pos. Untuk form HTML biasa. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Placeholder per level, menimpa `labels.placeholder`. */
  placeholder?: Partial<Record<Level, string>>;
  labels?: Partial<Labels>;
  className?: string;
  /** Ganti field bawaan dengan komponen UI sendiri (shadcn/ui, MUI, ...). */
  components?: { Field?: ComponentType<FieldProps> };
  onBlur?: () => void;
  id?: string;
}

/** Pemilih wilayah provinsi → kabupaten/kota → kecamatan → desa/kelurahan, plus kode pos. */
export const WilayahPicker = forwardRef<HTMLSelectElement | HTMLInputElement, WilayahPickerProps>(function WilayahPicker(
  { mode = 'cascade', name, required, disabled, placeholder, labels: labelOverrides, className, components, onBlur, id, ...options },
  ref,
) {
  const w = useWilayah(options);
  const autoId = useId();
  const base = id ?? autoId;
  const labels = { ...labelsId, ...labelOverrides };
  const Field = components?.Field ?? DefaultField;
  const showKodePos = w.levels.length === 4;

  return (
    <div className={className} data-nw-picker={mode}>
      {mode === 'search' && (
        <SearchField
          id={`${base}-search`}
          client={w.client}
          options={{ levels: w.levels.length, provinsi: options.provinsi }}
          labels={labels}
          current={alamatLabel(w.alamat)}
          onPick={(kode) => void w.setKode(kode).catch((e) => console.error('nusawilayah:', e))}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          inputRef={ref as Ref<HTMLInputElement>}
        />
      )}
      {mode === 'cascade' && w.levels.map((l: LevelState, i) => (
        <Field
          key={l.level}
          id={`${base}-${l.level}`}
          level={l.level}
          label={labels[l.level]}
          placeholder={placeholder?.[l.level] ?? labels.placeholder.replace('{label}', labels[l.level])}
          options={l.options}
          value={l.selected?.kode ?? ''}
          onChange={(kode) => void w.select(i, kode)}
          onBlur={onBlur}
          disabled={!!disabled || l.loading || (i > 0 && !w.levels[i - 1].selected)}
          required={required}
          loading={l.loading}
          error={l.error}
          onRetry={() => void w.retry(i)}
          labels={labels}
          selectRef={i === 0 ? (ref as Ref<HTMLSelectElement>) : undefined}
        />
      ))}
      {showKodePos && (
        <div data-nw-field="kodePos">
          <label htmlFor={`${base}-kodepos`}>{labels.kodePos}</label>
          <input id={`${base}-kodepos`} value={w.alamat.kodePos ?? ''} readOnly />
        </div>
      )}
      {name && <input type="hidden" name={name} value={w.kode ?? ''} />}
      {name && showKodePos && <input type="hidden" name={`${name}_kodepos`} value={w.alamat.kodePos ?? ''} />}
    </div>
  );
});

export { LEVELS };
