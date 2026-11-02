// Regenerates the README screenshots: PREVIEW=1 pnpm --filter example-vite e2e preview
import { expect, test } from '@playwright/test';

const out = (name: string) => `../../docs/images/${name}.png`;

test.skip(!process.env.PREVIEW, 'set PREVIEW=1 to regenerate docs/images');
test.use({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 });

test('cascade preview', async ({ page }) => {
  await page.goto('/');
  const s = page.locator('section', { has: page.getByRole('heading', { name: 'Mode cascade' }) });
  await s.getByLabel('Provinsi').selectOption('51');
  await s.getByLabel('Kabupaten/Kota').selectOption('51.03');
  await s.getByLabel('Kecamatan').selectOption({ label: 'Kuta' });
  await s.getByLabel('Desa/Kelurahan').selectOption({ label: 'Tuban' });
  await expect(s.getByLabel('Kode Pos')).toHaveValue('80361');
  await s.screenshot({ path: out('cascade') });
});

test('search preview', async ({ page }) => {
  await page.goto('/');
  const s = page.locator('section', { has: page.getByRole('heading', { name: 'Mode search' }) });
  await s.getByRole('combobox').fill('denpasar');
  await expect(s.getByRole('option').first()).toBeVisible();
  await s.screenshot({ path: out('search') });
});
