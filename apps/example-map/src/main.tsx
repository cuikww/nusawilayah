import { createWilayah } from '@nusawilayah/core';
import { createGeo } from '@nusawilayah/geo';
import { PetaIndonesia } from '@nusawilayah/map-react';
import { WilayahPicker, type Alamat } from '@nusawilayah/react';
import '@nusawilayah/react/style.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const wilayah = createWilayah({ baseUrl: '/data' });
const geo = createGeo({ baseUrl: '/geo' });

/** Picker and map share one kode: picking in either one updates the other (PRD F4.5). */
function PickerAndMap() {
  const [kode, setKode] = useState<string | null>(null);
  const parts = kode?.split('.') ?? [];
  const prov = parts[0];
  // Indonesia → the kabupaten of the chosen provinsi → its kecamatan, zoomed to the chosen kabupaten
  const level = parts.length === 0 ? 'provinsi' : parts.length === 1 ? 'kabupaten' : 'kecamatan';
  const shown = level === 'provinsi' ? undefined : level === 'kabupaten' ? undefined : parts.slice(0, 3).join('.');

  return (
    <section aria-labelledby="sync">
      <h2 id="sync">Picker + peta</h2>
      <div className="layout">
        <div>
          <WilayahPicker value={kode} onChange={(a: Alamat) => setKode((a.desa ?? a.kecamatan ?? a.kabupaten ?? a.provinsi)?.kode ?? null)} client={wilayah} />
          {kode && <button type="button" onClick={() => setKode(null)}>Kembali ke Indonesia</button>}
        </div>
        <PetaIndonesia
          client={geo}
          level={level}
          provinsi={prov}
          value={level === 'kecamatan' ? shown : undefined}
          zoomTo={level === 'kecamatan' ? parts.slice(0, 2).join('.') : undefined}
          onSelect={(r) => setKode(r.kode)}
        />
      </div>
    </section>
  );
}

/** Choropleth: number of kabupaten/kota per provinsi, from the region data itself. */
function Choropleth() {
  const [data, setData] = useState<Record<string, number>>();
  useEffect(() => {
    wilayah.provinsi().then(async (list) => {
      const counts = await Promise.all(list.map(async (p) => [p.kode, (await wilayah.children(p.kode)).length] as const));
      setData(Object.fromEntries(counts));
    });
  }, []);
  return (
    <section aria-labelledby="choropleth">
      <h2 id="choropleth">Jumlah kabupaten/kota per provinsi</h2>
      {data && <PetaIndonesia client={geo} data={data} formatValue={(v) => `${v}`} />}
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <h1>nusawilayah: peta</h1>
      <PickerAndMap />
      <Choropleth />
    </main>
  </StrictMode>,
);
