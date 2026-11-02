import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('cascade: Bali → Badung → Kuta → Tuban fills kode pos', async ({ page }) => {
  await page.goto('/');
  const s = page.locator('section', { has: page.getByRole('heading', { name: 'Mode cascade' }) });
  await s.getByLabel('Provinsi').selectOption('51');
  await s.getByLabel('Kabupaten/Kota').selectOption('51.03');
  await s.getByLabel('Kecamatan').selectOption({ label: 'Kuta' });
  await s.getByLabel('Desa/Kelurahan').selectOption({ label: 'Tuban' });
  await expect(s.getByLabel('Kode Pos')).toHaveValue('80361');
  await expect(page.getByTestId('out-cascade')).toHaveText('{"kode":"51.03.01.1001","kodePos":"80361"}');
  await expect(s.locator('input[type=hidden][name=alamat]')).toHaveValue('51.03.01.1001');
});

test('search: type, pick with keyboard, and kode pos lookup', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'Cari wilayah' });
  await box.fill('denpasar sel');
  await expect(page.getByRole('listbox').getByRole('option').first()).toHaveText('Denpasar Selatan, Kota Denpasar, Bali');
  await box.press('Enter');
  await expect(box).toHaveValue('Denpasar Selatan, Kota Denpasar, Bali');
  await expect(page.getByTestId('out-search')).toHaveText('{"kode":"51.71.01"}');

  await box.fill('80361');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(5);
  await page.getByRole('option', { name: 'Seminyak, Kuta, Badung, Bali' }).click();
  await expect(page.getByTestId('out-search')).toHaveText('{"kode":"51.03.01.1005","kodePos":"80361"}');
});

test('no accessibility violations (axe, WCAG 2.1 AA)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Cari wilayah' }).fill('kuta');
  await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
});
