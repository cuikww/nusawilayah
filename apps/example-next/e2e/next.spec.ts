import { expect, test } from '@playwright/test';

// App Router (server component) and Pages Router (getServerSideProps) render the same form.
for (const [router, path] of [['App Router', '/'], ['Pages Router', '/pages-router']]) {
  test.describe(router, () => {
    test('server-renders the provinsi options (initialProvinsi)', async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect(html).toContain('<option value="51">Bali</option>');
      expect(html).toContain('<option value="96">Papua Barat Daya</option>');
    });

    test('picks an address, corrects the kode pos and submits a plain form', async ({ page }) => {
      await page.goto(path);
      await page.getByLabel('Provinsi').selectOption('51');
      await page.getByLabel('Kabupaten/Kota').selectOption('51.03');
      await page.getByLabel('Kecamatan').selectOption({ label: 'Kuta' });
      await page.getByLabel('Desa/Kelurahan').selectOption({ label: 'Tuban' });
      await expect(page.getByLabel('Kode Pos')).toHaveValue('80361');
      await page.getByLabel('Kode Pos').fill('80362');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await expect(page.getByTestId('received')).toHaveText('Server received: wilayah=51.03.01.1001, kodepos=80362');
    });
  });
}
