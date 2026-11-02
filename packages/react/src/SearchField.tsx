import type { SearchOptions, SearchResult, WilayahClient } from '@nusawilayah/core';
import { useRef, useState, type Ref } from 'react';
import type { Labels } from './labels.ts';

export interface SearchFieldProps {
  id: string;
  client: WilayahClient;
  options: SearchOptions;
  labels: Labels;
  /** Label of the current value, shown while the user is not typing. */
  current: string;
  onPick: (kode: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/** ARIA 1.2 combobox: one text input plus a listbox of results. */
export function SearchField({ id, client, options, labels, current, onPick, onBlur, disabled, required, inputRef }: SearchFieldProps) {
  const [query, setQuery] = useState<string | null>(null); // null = not editing, show `current`
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const latest = useRef(0); // drops responses of queries the user has already typed past
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
            onMouseDown={(e) => { e.preventDefault(); pick(r); }} // fires before the input's blur
            onMouseEnter={() => setActive(i)}
          >
            {r.label}
            {r.alias && <span data-nw-alias> ({labels.formerly.replace('{nama}', r.alias)})</span>}
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
