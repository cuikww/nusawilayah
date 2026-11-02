import { formatPath, type Alamat, type Level } from '@nusawilayah/core';
import { forwardRef, useId, type ComponentType, type Ref } from 'react';
import { DefaultField, type FieldProps } from './DefaultField.tsx';
import { labelsId, type Labels } from './labels.ts';
import { SearchField } from './SearchField.tsx';
import { useWilayah, type UseWilayahOptions } from './useWilayah.ts';

export interface WilayahPickerProps extends UseWilayahOptions {
  /** `cascade`: one dropdown per level (default). `search`: one search box that also accepts postal codes. */
  mode?: 'cascade' | 'search';
  /** Hidden inputs for plain HTML forms: `{name}` holds the deepest kode, `{name}_kodepos` the postal code. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Placeholder per level; overrides `labels.placeholder`. */
  placeholder?: Partial<Record<Level, string>>;
  labels?: Partial<Labels>;
  className?: string;
  /** Replace the built-in field with your own UI component (shadcn/ui, MUI, ...). */
  components?: { Field?: ComponentType<FieldProps> };
  onBlur?: () => void;
  id?: string;
}

/** 'Tuban, Kuta, Badung, Bali' */
const alamatLabel = (a: Alamat) => formatPath([a.desa, a.kecamatan, a.kabupaten, a.provinsi].filter((w) => w !== undefined));

const logError = (e: unknown) => console.error('nusawilayah:', e);

/** Region picker: provinsi → kabupaten/kota → kecamatan → desa/kelurahan, plus postal code. */
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
          onPick={(kode) => void w.setKode(kode).catch(logError)}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          inputRef={ref as Ref<HTMLInputElement>}
        />
      )}
      {mode === 'cascade' && w.levels.map((l, i) => (
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
          <input
            id={`${base}-kodepos`}
            value={w.alamat.kodePos ?? ''}
            onChange={(e) => w.setKodePos(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onBlur={onBlur}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="\d{5}"
            maxLength={5}
          />
        </div>
      )}
      {name && <input type="hidden" name={name} value={w.kode ?? ''} />}
      {name && showKodePos && <input type="hidden" name={`${name}_kodepos`} value={w.alamat.kodePos ?? ''} />}
    </div>
  );
});
