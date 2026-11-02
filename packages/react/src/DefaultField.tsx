import type { Level, Wilayah } from '@nusawilayah/core';
import type { Ref } from 'react';
import type { Labels } from './labels.ts';

/** Props of one cascade field (label + dropdown + status). Implement them to plug in your own UI kit. */
export interface FieldProps {
  id: string;
  level: Level;
  label: string;
  placeholder: string;
  options: Wilayah[];
  /** Selected kode, '' when empty. */
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

/** Native <select>: accessible and mobile-friendly without extra ARIA. */
export function DefaultField(p: FieldProps) {
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
