// "Unduh Peta": pick any provinsi, kabupaten/kota or kecamatan, style it, download SVG, PNG or GeoJSON. For people who do not code.
import { createWilayah, type Alamat, type Wilayah } from '@nusawilayah/core';
import { createGeo } from '@nusawilayah/geo';
import { WilayahPicker } from '@nusawilayah/react';
import '@nusawilayah/react/style.css';
import { StrictMode, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { CREDIT, loadScene, slug, THEMES, toGeoJson, toPng, toSvg, type Scene, type Style, type View } from './peta.ts';
import './site.css';
import './unduh.css';

const wilayah = createWilayah({ baseUrl: import.meta.env.BASE_URL, cache: 'indexeddb' });
const geo = createGeo(); // published boundaries on jsDelivr

const KODE = /^\d{2}(\.\d{2}){0,2}$/;
const CHILD = ['provinsi', 'kabupaten/kota', 'kecamatan'];
const VIEWS: { value: View; label: string; hint: string }[] = [
  { value: 'sendiri', label: 'Utuh', hint: 'Bentuk wilayahnya saja' },
  { value: 'konteks', label: 'Disorot', hint: 'Disorot di antara tetangganya' },
  { value: 'isi', label: 'Rinci', hint: 'Dibagi per sub-wilayah' },
  { value: 'pulau', label: 'Pulau', hint: 'Satu pulau saja, pilih di peta atau di daftar' },
];
const SIZES = [
  { scale: 1, label: 'Sedang' },
  { scale: 2, label: 'Besar' },
  { scale: 4, label: 'Poster' },
];

function fromUrl() {
  const q = new URLSearchParams(location.search);
  const kode = q.get('wilayah') ?? '';
  const view = VIEWS.find((v) => v.value === q.get('tampilan'))?.value ?? 'sendiri';
  const pulau = Number(q.get('pulau') ?? NaN);
  return { kode: KODE.test(kode) ? kode : '', view, pulau: Number.isInteger(pulau) ? pulau : undefined };
}

function save(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Unduh() {
  const [kode, setKode] = useState(() => fromUrl().kode);
  const [view, setView] = useState<View>(() => fromUrl().view);
  // the chosen island belongs to the region it was chosen in
  const [island, setIsland] = useState(() => ({ kode: fromUrl().kode, i: fromUrl().pulau }));
  const [theme, setTheme] = useState(0);
  const [style, setStyle] = useState<Style>({ ...THEMES[0], strokeWidth: 1, multi: false, labels: false, title: false, credit: false });
  const [scale, setScale] = useState(2);
  const [path, setPath] = useState<Wilayah[]>([]);
  const [children, setChildren] = useState<Wilayah[]>([]);
  const [scene, setScene] = useState<{ key: string; scene?: Scene; error?: string }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState('');

  const level = kode ? kode.split('.').length : 0;
  const shownView: View = level === 0 ? (view === 'pulau' ? 'pulau' : 'isi') : level === 3 && view === 'isi' ? 'sendiri' : view;
  const pulau = shownView === 'pulau' && island.kode === kode ? island.i : undefined;
  const key = `${kode}:${shownView}:${pulau ?? ''}`;

  useEffect(() => {
    const q = new URLSearchParams({ ...(kode && { wilayah: kode }), ...(view !== 'sendiri' && { tampilan: view }), ...(pulau !== undefined && { pulau: String(pulau) }) });
    history.replaceState(null, '', q.size ? `?${q}` : location.pathname);
    let live = true;
    (kode ? wilayah.resolve(kode) : Promise.resolve({})).then(
      (a: Alamat) => live && setPath([a.provinsi, a.kabupaten, a.kecamatan].filter((w) => w !== undefined)),
      () => live && setPath([]),
    );
    (level === 0 ? wilayah.provinsi() : level < 3 ? wilayah.children(kode) : Promise.resolve([])).then(
      (list) => live && setChildren(list),
      () => live && setChildren([]),
    );
    return () => { live = false; };
  }, [kode, view, level, pulau]);

  useEffect(() => {
    let live = true;
    loadScene(geo, kode, shownView, pulau).then(
      (s) => live && setScene({ key, scene: s }),
      (e: Error) => live && setScene({ key, error: e.message }),
    );
    return () => { live = false; };
  }, [key, attempt]);

  const current = scene.key === key ? scene : undefined;
  const islands = current?.scene?.islands;
  const chosen = pulau === undefined ? undefined : islands?.[pulau];
  const region = !kode ? 'Indonesia' : path.at(-1)?.kode === kode ? path.at(-1)!.nama : ''; // '' until the names have loaded
  const name = chosen ? `Pulau ${chosen.nama}` : region;
  const parents = (chosen ? [...path] : path.slice(0, -1)).reverse().map((w) => w.nama).concat('Indonesia').join(', ');
  const subtitle = chosen ? parents : !kode ? 'Peta provinsi' : shownView === 'isi' ? `Peta ${CHILD[level]} · ${parents}` : parents;
  // choosing an island: every island its own colour, so they are told apart
  const shown = shownView === 'pulau' && !chosen ? { ...style, multi: true } : style;
  const picture = useMemo(() => (current?.scene && name ? toSvg(current.scene, shown, name, subtitle) : undefined), [current, shown, name, subtitle]);
  const file = chosen
    ? `peta-pulau-${slug(chosen.nama.split(',')[0])}`
    : `peta-${slug(name)}${shownView === 'isi' && kode ? `-per-${slug(CHILD[level])}` : ''}`;

  const flash = (text: string) => { setToast(text); setTimeout(() => setToast(''), 2500); };
  const set = (patch: Partial<Style>) => setStyle((s) => ({ ...s, ...patch }));
  const pickTheme = (i: number) => { setTheme(i); set({ ...THEMES[i], bg: style.bg === null ? null : THEMES[i].bg }); };
  const pickIsland = (i: number | undefined) => setIsland({ kode, i });
  const onMapClick = (e: MouseEvent) => {
    const k = (e.target as Element).closest('[data-kode]')?.getAttribute('data-kode');
    if (k?.startsWith('pulau-')) pickIsland(Number(k.slice(6)));
    else if (k && k !== kode && shownView !== 'pulau') setKode(k);
  };

  async function download(kind: 'svg' | 'png' | 'geojson') {
    if (!picture || !current?.scene) return;
    try {
      if (kind === 'svg') save(new Blob([picture.svg], { type: 'image/svg+xml' }), `${file}.svg`);
      if (kind === 'geojson') save(new Blob([toGeoJson(current.scene)], { type: 'application/geo+json' }), `${file}.geojson`);
      if (kind === 'png') save(await toPng(picture, scale), `${file}.png`);
      flash(`${file}.${kind} diunduh`);
    } catch (e) {
      flash(`Gagal: ${(e as Error).message}`);
    }
  }

  async function copyCredit() {
    try {
      await navigator.clipboard.writeText(CREDIT);
      flash('Keterangan sumber disalin');
    } catch {
      flash('Browser menolak akses clipboard');
    }
  }

  async function copySvg() {
    if (!picture) return;
    try {
      await navigator.clipboard.writeText(picture.svg);
      flash('SVG disalin, tempel di Figma, Canva, atau Inkscape');
    } catch {
      flash('Browser menolak akses clipboard');
    }
  }

  return (
    <>
      <header className="u-top">
        <a href={import.meta.env.BASE_URL} className="u-brand">nusawilayah</a>
        <div>
          <h1>Unduh Peta Wilayah Indonesia</h1>
          <p>Gratis, tanpa daftar. Pilih provinsi, kabupaten/kota, atau kecamatan, atur warnanya, lalu unduh sebagai SVG, PNG, atau GeoJSON.</p>
        </div>
      </header>

      <main className="u-layout">
        <aside className="u-panel" aria-label="Pengaturan peta">
          <section className="u-card">
            <h2><span className="u-step">1</span> Cari wilayah</h2>
            <WilayahPicker id="cari" mode="search" levels={3} client={wilayah} value={kode || null}
              onChange={(a) => setKode((a.kecamatan ?? a.kabupaten ?? a.provinsi)?.kode ?? '')} />
            <nav aria-label="Posisi wilayah" className="u-crumbs">
              <button type="button" onClick={() => setKode('')} aria-current={!kode ? 'page' : undefined}>Indonesia</button>
              {path.map((w) => (
                <span key={w.kode}>
                  <span aria-hidden>›</span>
                  <button type="button" onClick={() => setKode(w.kode)} aria-current={w.kode === kode ? 'page' : undefined}>{w.nama}</button>
                </span>
              ))}
            </nav>
            {children.length > 0 && (
              <details className="u-children">
                <summary>Jelajahi {children.length} {CHILD[level]}</summary>
                <ul>
                  {children.map((c) => (
                    <li key={c.kode}><button type="button" onClick={() => setKode(c.kode)}>{c.nama}</button></li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="u-card">
              <h2><span className="u-step">2</span> Tampilan</h2>
              <div className="u-segment" role="radiogroup" aria-label="Tampilan">
                {VIEWS.filter((v) => (level === 0 ? v.value === 'isi' || v.value === 'pulau' : level < 3 || v.value !== 'isi')).map((v) => (
                  <label key={v.value} title={v.hint}>
                    <input type="radio" name="view" checked={shownView === v.value} onChange={() => setView(v.value)} />
                    <span>{v.label}</span>
                  </label>
                ))}
              </div>
              <p className="u-hint">{VIEWS.find((v) => v.value === shownView)!.hint}{shownView === 'isi' ? ` (${CHILD[level]})` : ''}.</p>
              {shownView === 'pulau' && islands && (
                <label className="u-size u-island">
                  Pulau ({islands.length})
                  <select value={pulau ?? ''} onChange={(e) => pickIsland(e.target.value === '' ? undefined : Number(e.target.value))}>
                    <option value="">Semua pulau, pilih satu</option>
                    {islands.map((p, i) => (
                      <option key={i} value={i}>{p.nama} · {p.area.toLocaleString('id-ID', { maximumFractionDigits: p.area < 10 ? 1 : 0 })} km²</option>
                    ))}
                  </select>
                </label>
              )}
            </section>

          <section className="u-card">
            <h2><span className="u-step">3</span> Warna</h2>
            <div className="u-themes" role="radiogroup" aria-label="Tema warna">
              {THEMES.map((t, i) => (
                <label key={t.name} className="u-theme">
                  <input type="radio" name="theme" checked={theme === i} onChange={() => pickTheme(i)} />
                  <span className="u-swatch" style={{ background: t.bg ?? undefined }} aria-hidden>
                    <i style={{ background: t.fill }} /><i style={{ background: t.highlight }} /><i style={{ background: t.palette[0] }} /><i style={{ background: t.palette[3] }} />
                  </span>
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
            <div className="u-toggles">
              <label><input type="checkbox" checked={style.multi} onChange={(e) => set({ multi: e.target.checked })} /> Warna-warni</label>
              <label><input type="checkbox" checked={style.labels} onChange={(e) => set({ labels: e.target.checked })} /> Nama wilayah</label>
              <label><input type="checkbox" checked={style.title} onChange={(e) => set({ title: e.target.checked })} /> Judul</label>
              <label><input type="checkbox" checked={style.bg === null} onChange={(e) => set({ bg: e.target.checked ? null : THEMES[theme].bg })} /> Latar transparan</label>
              <label><input type="checkbox" checked={style.credit} onChange={(e) => set({ credit: e.target.checked })} /> Keterangan sumber</label>
            </div>
            <details className="u-custom">
              <summary>Atur warna sendiri</summary>
              <div className="u-colors">
                {([['fill', 'Isi'], ['highlight', 'Sorotan'], ['stroke', 'Garis batas'], ['text', 'Teks'], ['bg', 'Latar']] as const).map(([k, label]) => (
                  <label key={k}>
                    <input type="color" value={style[k] ?? '#ffffff'} onChange={(e) => set({ [k]: e.target.value } as Partial<Style>)} />
                    {label}
                  </label>
                ))}
              </div>
              <label className="u-range">
                Tebal garis batas: {style.strokeWidth}
                <input type="range" min={0} max={4} step={0.5} value={style.strokeWidth} onChange={(e) => set({ strokeWidth: Number(e.target.value) })} />
              </label>
            </details>
          </section>

          <section className="u-card">
            <h2><span className="u-step">4</span> Unduh</h2>
            <label className="u-size">
              Ukuran PNG
              <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                {SIZES.map((s) => (
                  <option key={s.scale} value={s.scale}>{s.label}{picture ? ` (${Math.round(picture.width * s.scale)} × ${Math.round(picture.height * s.scale)} px)` : ''}</option>
                ))}
              </select>
            </label>
            <div className="u-buttons">
              <button type="button" className="u-primary" disabled={!picture} onClick={() => void download('png')}>Unduh PNG</button>
              <button type="button" disabled={!picture} onClick={() => void download('svg')}>Unduh SVG</button>
              <button type="button" disabled={!picture} onClick={() => void download('geojson')}>GeoJSON</button>
              <button type="button" disabled={!picture} onClick={() => void copySvg()}>Salin SVG</button>
            </div>
            <p className="u-hint">PNG untuk Word, slide, dan media sosial. SVG tetap tajam di ukuran berapa pun dan bisa diedit di Figma, Canva, atau Inkscape. GeoJSON untuk QGIS.</p>
          </section>
        </aside>

        <section className="u-stage" aria-label="Pratinjau">
          <div className={`u-canvas${style.bg === null ? ' u-transparent' : ''}`}>
            {current?.error ? (
              <p role="alert">Peta gagal dimuat: {current.error} <button type="button" onClick={() => setAttempt((a) => a + 1)}>Coba lagi</button></p>
            ) : picture ? (
              <div role="img" aria-label={`Pratinjau peta ${name}`} data-testid="preview" onClick={onMapClick} dangerouslySetInnerHTML={{ __html: picture.svg }} />
            ) : (
              <p role="status" className="u-loading">Memuat peta…</p>
            )}
          </div>
          {current?.scene?.notice && <p className="u-notice">{current.scene.notice}</p>}
          <p className="u-hint">
            {shownView === 'pulau' ? (chosen ? '' : 'Klik pulau di peta untuk memilihnya. ') : level < 3 ? 'Klik wilayah di peta untuk masuk ke dalamnya. ' : ''}
            Saat membagikan peta ini, cantumkan sumbernya (lisensi CC BY 3.0 IGO): <q>{CREDIT}</q>{' '}
            <button type="button" className="u-link" onClick={() => void copyCredit()}>Salin</button>
          </p>
          {chosen && <button type="button" className="u-back" onClick={() => pickIsland(undefined)}>← Semua pulau</button>}
        </section>
      </main>
      <div className="u-toast" role="status" aria-live="polite">{toast}</div>
      <footer>
        Batas wilayah: BPS (2020) via <a href="https://data.humdata.org/dataset/cod-ab-idn">HDX</a>, CC BY 3.0 IGO. Ilustrasi, bukan batas hukum; batas resmi mengacu pada Kemendagri dan BIG. Kode dan nama wilayah: Kepmendagri No. 300.2.2-2430 Tahun 2025.
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Unduh />
  </StrictMode>,
);
