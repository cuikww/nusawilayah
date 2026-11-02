import { createWilayah, LEVELS, type Alamat, type CascadeOptions, type Level, type LevelState, type Wilayah, type WilayahClient } from '@nusawilayah/core';
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useSyncExternalStore, type ComponentType, type Ref } from 'react';

export type { Alamat, Level, Wilayah } from '@nusawilayah/core';

export interface Labels extends Record<Level, string> {
  kodePos: string;
  loading: string;
  retry: string;
  /** Teks pilihan kosong per level; `{label}` diganti nama level. */
  placeholder: string;
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

  return { ...state, select, retry: cascade.retry };
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

export interface WilayahPickerProps extends UseWilayahOptions {
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

/** Dropdown bertingkat provinsi → kabupaten/kota → kecamatan → desa/kelurahan, plus kode pos. */
export const WilayahPicker = forwardRef<HTMLSelectElement, WilayahPickerProps>(function WilayahPicker(
  { name, required, disabled, placeholder, labels: labelOverrides, className, components, onBlur, id, ...options },
  ref,
) {
  const w = useWilayah(options);
  const autoId = useId();
  const base = id ?? autoId;
  const labels = { ...labelsId, ...labelOverrides };
  const Field = components?.Field ?? DefaultField;
  const showKodePos = w.levels.length === 4;

  return (
    <div className={className} data-nw-picker="">
      {w.levels.map((l: LevelState, i) => (
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
          selectRef={i === 0 ? ref : undefined}
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
