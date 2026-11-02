'use client';
import { createWilayah, type Wilayah } from '@nusawilayah/core';
import { WilayahPicker } from '@nusawilayah/react';

// Data copied to public/wilayah by `nusawilayah copy` (see package.json), served by Next itself.
const client = createWilayah({ baseUrl: '/wilayah', cache: 'indexeddb' });

export function AddressForm({ provinsi }: { provinsi: Wilayah[] }) {
  return (
    <form method="get">
      <WilayahPicker client={client} initialProvinsi={provinsi} name="alamat" required />
      <button type="submit" style={{ marginTop: '1rem', minHeight: 44 }}>Simpan</button>
    </form>
  );
}
