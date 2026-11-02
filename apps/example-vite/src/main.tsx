import { createWilayah } from '@nusawilayah/core';
import { WilayahPicker, type Alamat } from '@nusawilayah/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

const client = createWilayah({ baseUrl: '/' });

function Demo({ mode }: { mode: 'cascade' | 'search' }) {
  const [alamat, setAlamat] = useState<Alamat>();
  return (
    <section aria-labelledby={`h-${mode}`}>
      <h2 id={`h-${mode}`}>Mode {mode}</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <WilayahPicker id={mode} mode={mode} client={client} name="alamat" onChange={setAlamat} />
      </form>
      <pre data-testid={`out-${mode}`}>{alamat ? JSON.stringify({ kode: (alamat.desa ?? alamat.kecamatan ?? alamat.kabupaten ?? alamat.provinsi)?.kode, kodePos: alamat.kodePos }) : '—'}</pre>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <h1>nusawilayah</h1>
      <Demo mode="cascade" />
      <Demo mode="search" />
    </main>
  </StrictMode>,
);
