// Server component: loads the provinsi on the server (from the copied data), so the first HTML already has them.
import { AddressForm } from './AddressForm';
import { server } from './server';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [provinsi, params] = await Promise.all([server.provinsi(), searchParams]);
  return (
    <main>
      <h1>Alamat</h1>
      <AddressForm provinsi={provinsi} />
      {params.alamat && (
        <p data-testid="received">
          Server received: wilayah={params.alamat}, kodepos={params.alamat_kodepos}
        </p>
      )}
    </main>
  );
}
