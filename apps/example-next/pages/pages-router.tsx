// The same form under the Pages Router: provinsi from getServerSideProps instead of a server component.
import type { Wilayah } from '@nusawilayah/core';
import type { GetServerSideProps } from 'next';
import { AddressForm } from '../app/AddressForm';
import { server } from '../app/server';

interface Props { provinsi: Wilayah[]; alamat: string | null; kodepos: string | null }

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => ({
  props: { provinsi: await server.provinsi(), alamat: (query.alamat as string) ?? null, kodepos: (query.alamat_kodepos as string) ?? null },
});

export default function Page({ provinsi, alamat, kodepos }: Props) {
  return (
    <main>
      <h1>Alamat</h1>
      <AddressForm provinsi={provinsi} />
      {alamat && <p data-testid="received">Server received: wilayah={alamat}, kodepos={kodepos}</p>}
    </main>
  );
}
