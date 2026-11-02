import { createWilayah, kodeOf, type Alamat, type CascadeOptions, type Level, type WilayahClient } from '@nusawilayah/core';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

export interface UseWilayahOptions extends CascadeOptions {
  /** Your own core client (self-hosted baseUrl, custom fetcher). Default: one shared jsDelivr client. */
  client?: WilayahClient;
  /** Initial kode (uncontrolled), e.g. from a saved address. */
  defaultValue?: string;
  /** Controlled value: a kode or an Alamat. `null` or `''` clears the picker. */
  value?: string | Alamat | null;
  onChange?: (alamat: Alamat) => void;
}

let sharedClient: WilayahClient | undefined; // one cache for every picker on the page

const toKode = (v: string | Alamat | null | undefined) => (typeof v === 'string' ? v || undefined : v ? kodeOf(v) : undefined);

/** Headless hook: render the cascading dropdowns with your own UI components. */
export function useWilayah({ client, levels = 4, provinsi, initialProvinsi, defaultValue, value, onChange }: UseWilayahOptions = {}) {
  const c = client ?? (sharedClient ??= createWilayah());
  // provinsiKey stands in for the array, so a new array literal on every render doesn't reset the picker
  const provinsiKey = provinsi?.join(',');
  // initialProvinsi only seeds a new cascade, like defaultValue
  const cascade = useMemo(() => c.createCascade({ levels, provinsi, initialProvinsi }), [c, levels, provinsiKey]);
  const state = useSyncExternalStore(cascade.subscribe, cascade.getState, cascade.getState);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const controlled = value !== undefined;
  const target = controlled ? toKode(value) : defaultValue;
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

  /** Fills every level from one kode (e.g. a search result), then calls onChange. */
  const setKode = useCallback(
    async (kode: string) => {
      await cascade.setValue(kode);
      onChangeRef.current?.(cascade.getState().alamat);
    },
    [cascade],
  );

  /** Overrides the postal code (users can correct it), then calls onChange. */
  const setKodePos = useCallback(
    (kodePos: string) => {
      cascade.setKodePos(kodePos);
      onChangeRef.current?.(cascade.getState().alamat);
    },
    [cascade],
  );

  return { ...state, select, setKode, setKodePos, retry: cascade.retry, client: c };
}
