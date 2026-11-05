import { createWilayah } from '@nusawilayah/core';
import { labelsEn, labelsId, WilayahPicker, type Alamat } from '@nusawilayah/react';
import themeUrl from '@nusawilayah/react/style.css?url';
import { useState } from 'react';

// Self-hosted data next to the site, cached in IndexedDB so repeat visits work offline.
const client = createWilayah({ baseUrl: import.meta.env.BASE_URL, cache: 'indexeddb' });

const REPO = 'https://github.com/cuikww/nusawilayah';
const doc = (path: string) => `${REPO}/blob/main/${path}`;

const PROVINSI = { all: undefined, bali: ['51', '52', '53'], jawa: ['31', '32', '33', '34', '35', '36'] } as const;
const VALUES = { none: '', tuban: '51.03.01.1001', jakarta: '31.71.01' } as const;

interface Options {
  mode: 'cascade' | 'search';
  levels: number;
  english: boolean;
  provinsi: keyof typeof PROVINSI;
  value: keyof typeof VALUES;
  theme: boolean;
}

function code(o: Options) {
  const props = [
    o.mode === 'search' && 'mode="search"',
    o.levels !== 4 && `levels={${o.levels}}`,
    o.english && 'labels={labelsEn}',
    PROVINSI[o.provinsi] && `provinsi={${JSON.stringify(PROVINSI[o.provinsi])}}`,
    VALUES[o.value] && `defaultValue="${VALUES[o.value]}"`,
    'onChange={(alamat) => save(alamat)}',
  ].filter(Boolean);
  const imports = ['WilayahPicker', ...(o.english ? ['labelsEn'] : [])].join(', ');
  return [
    `import { ${imports} } from '@nusawilayah/react'`,
    ...(o.theme ? [`import '@nusawilayah/react/style.css' // optional theme`] : []),
    '',
    `<WilayahPicker ${props.join(' ')} />`,
  ].join('\n');
}

function Playground() {
  const [o, setO] = useState<Options>({ mode: 'cascade', levels: 4, english: false, provinsi: 'all', value: 'none', theme: true });
  const [alamat, setAlamat] = useState<Alamat>();
  const set = <K extends keyof Options>(k: K, v: Options[K]) => { setO({ ...o, [k]: v }); setAlamat(undefined); };
  const key = JSON.stringify(o); // remount on every option change, like a fresh page

  return (
    <section aria-labelledby="playground" className="card">
      <h2 id="playground">Playground</h2>
      <div className="playground">
        <form className="controls" onSubmit={(e) => e.preventDefault()} aria-label="Picker options">
          <fieldset>
            <legend>Mode</legend>
            {(['cascade', 'search'] as const).map((m) => (
              <label key={m} className="inline">
                <input type="radio" name="mode" checked={o.mode === m} onChange={() => set('mode', m)} /> {m}
              </label>
            ))}
          </fieldset>
          <label>
            Levels
            <select value={o.levels} onChange={(e) => set('levels', Number(e.target.value))}>
              <option value={1}>1: provinsi</option>
              <option value={2}>2: + kabupaten/kota</option>
              <option value={3}>3: + kecamatan</option>
              <option value={4}>4: + desa/kelurahan</option>
            </select>
          </label>
          <label>
            Provinces
            <select value={o.provinsi} onChange={(e) => set('provinsi', e.target.value as Options['provinsi'])}>
              <option value="all">All 38</option>
              <option value="bali">Bali and Nusa Tenggara</option>
              <option value="jawa">Java</option>
            </select>
          </label>
          <label>
            Initial value
            <select value={o.value} onChange={(e) => set('value', e.target.value as Options['value'])}>
              <option value="none">None</option>
              <option value="tuban">51.03.01.1001 (Tuban, Kuta)</option>
              <option value="jakarta">31.71.01 (Gambir, Jakarta Pusat)</option>
            </select>
          </label>
          <label className="inline">
            <input type="checkbox" checked={o.english} onChange={(e) => set('english', e.target.checked)} /> English labels
          </label>
          <label className="inline">
            <input type="checkbox" checked={o.theme} onChange={(e) => set('theme', e.target.checked)} /> Default theme
          </label>
        </form>

        <div className="preview">
          {o.theme && <link rel="stylesheet" href={themeUrl} />}
          <div lang={o.english ? 'en' : 'id'}>
            <WilayahPicker
              key={key}
              id="demo"
              client={client}
              mode={o.mode}
              levels={o.levels}
              labels={o.english ? labelsEn : labelsId}
              provinsi={PROVINSI[o.provinsi] && [...PROVINSI[o.provinsi]!]}
              defaultValue={VALUES[o.value] || undefined}
              onChange={setAlamat}
              name="alamat"
            />
          </div>
          <h3>onChange</h3>
          <pre data-testid="output" tabIndex={0}>{alamat ? JSON.stringify(alamat, null, 2) : 'Pick a region…'}</pre>
          <h3>Code</h3>
          <pre data-testid="code" tabIndex={0}>{code(o)}</pre>
        </div>
      </div>
    </section>
  );
}

const GUIDES = [
  { title: 'React', text: 'Props, forms, React Hook Form, your own UI kit, styling.', href: `${REPO}#quick-start-react` },
  { title: 'Any framework', text: 'Headless core: data, search, cascade state. Vue example.', href: `${REPO}#without-react-nusawilayahcore` },
  { title: 'SQLite and CSV', text: 'For PHP/Laravel, Flutter, Python, MySQL and PostgreSQL.', href: `${REPO}#other-languages-json-sqlite-csv` },
  { title: 'Migrating addresses', text: 'migrate() maps codes saved under the previous decree.', href: `${REPO}#migrating-saved-addresses` },
  { title: 'Data specification', text: 'File layout, schemas, kode rules and versions.', href: doc('docs/SPEC.md') },
  { title: 'Roadmap', text: 'Requirements and what is done.', href: doc('docs/PRD.md') },
];

export function App() {
  return (
    <>
      <header className="hero">
        <h1>nusawilayah</h1>
        <p className="lead">
          Indonesian region picker and region data: provinsi → kabupaten/kota → kecamatan → desa/kelurahan, with postal codes. Official
          data from <strong>Kepmendagri No. 300.2.2-2430 Tahun 2025</strong>: 38 provinces, 514 regencies/cities, 7,285 districts, 83,762
          villages.
        </p>
        <nav aria-label="Links" className="links">
          <a href={REPO}>GitHub</a>
          <a href="https://www.npmjs.com/package/@nusawilayah/react">npm</a>
          <a href={doc('docs/SPEC.md')}>Data spec</a>
          <a href={`${import.meta.env.BASE_URL}unduh.html`}>Download maps (SVG, PNG)</a>
        </nav>
      </header>
      <main>
        <section aria-labelledby="start" className="card">
          <h2 id="start">Quick start</h2>
          <pre tabIndex={0}>{`npm install @nusawilayah/react`}</pre>
          <pre tabIndex={0}>{`import { WilayahPicker } from '@nusawilayah/react'\n\n<WilayahPicker onChange={(alamat) => save(alamat)} />`}</pre>
          <p>No API key, no data to download: the data loads on demand, under 1 KB per step. About 5 KB of JavaScript (gzip).</p>
        </section>
        <Playground />
        <section aria-labelledby="guides">
          <h2 id="guides">Guides</h2>
          <ul className="guides">
            {GUIDES.map((g) => (
              <li key={g.title}>
                <a href={g.href}>
                  <strong>{g.title}</strong>
                  <span>{g.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer>
        MIT. Data © cahya dsn (MIT); region codes and names from Kepmendagri No. 300.2.2-2430 Tahun 2025. Postal codes are best-effort.
      </footer>
    </>
  );
}
