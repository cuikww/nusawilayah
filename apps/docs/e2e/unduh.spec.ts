import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Boundaries come from jsDelivr in production; tests serve the locally built @nusawilayah/geo-data instead.
const GEO = new URL('../../../packages/geo-data/dist/', import.meta.url);
test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@nusawilayah/geo-data@*/dist/**', async (route) => {
    const path = new URL(route.request().url()).pathname.split('/dist/')[1];
    await route.fulfill({ contentType: 'application/json', body: await readFile(new URL(path, GEO)) });
  });
});

test('search a kabupaten, style it, download SVG with the attribution, then PNG', async ({ page }) => {
  await page.goto('/unduh.html');
  await expect(page.getByTestId('preview').locator('#prov-52')).toBeAttached();

  await page.getByRole('combobox', { name: 'Cari wilayah' }).fill('lombok barat');
  await page.getByRole('listbox').getByRole('option', { name: 'Lombok Barat, Nusa Tenggara Barat' }).click();
  await expect(page).toHaveURL(/wilayah=52\.01/);
  await expect(page.getByTestId('preview').locator('svg > title')).toHaveText('Kabupaten Lombok Barat');
  await expect(page.getByTestId('preview').locator('[data-kode]')).toHaveCount(1);

  await page.getByRole('radio', { name: 'Rinci' }).check();
  await page.getByRole('radio', { name: 'Hutan' }).check();
  await page.getByLabel('Nama wilayah').check();
  await expect(page.getByTestId('preview').locator('[data-kode^="52.01."]').first()).toHaveAttribute('fill', '#cfe3c8');
  await expect(page.getByTestId('preview').locator('text', { hasText: 'Gerung' })).toBeAttached();

  const svg = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh SVG' }).click();
  const file = await svg;
  expect(file.suggestedFilename()).toBe('peta-kabupaten-lombok-barat-per-kecamatan.svg');
  const text = await readFile(await file.path(), 'utf8');
  expect(text).toContain('BPS (2020) via HDX, CC BY 3.0 IGO');

  const png = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh PNG' }).click();
  const bytes = await readFile(await (await png).path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});

test('clicking the map goes into a region; breadcrumbs go back', async ({ page }) => {
  await page.goto('/unduh.html?wilayah=51&tampilan=isi');
  await page.getByTestId('preview').locator('#kab-51-03').click({ force: true });
  await expect(page.getByRole('navigation', { name: 'Posisi wilayah' })).toContainText('Kabupaten Badung');
  await page.getByRole('button', { name: 'Indonesia' }).click();
  await expect(page.getByTestId('preview').locator('[data-kode]')).toHaveCount(38);
});

test('download page: no accessibility violations (axe, WCAG 2.1 AA)', async ({ page }) => {
  await page.goto('/unduh.html?wilayah=52.01');
  await expect(page.getByTestId('preview').locator('> svg')).toBeAttached();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
});

test('one island: Lombok out of NTB, its five kabupaten/kota and nothing from Sumbawa; no credit text unless asked', async ({ page }) => {
  await page.goto('/unduh.html?wilayah=52&tampilan=pulau');
  const preview = page.getByTestId('preview');
  await expect(preview.locator('[data-kode^="pulau-"]').first()).toBeAttached();
  const lombok = page.getByLabel(/^Pulau \(/).locator('option', { hasText: 'Lombok Timur, Lombok Tengah' });
  await page.getByLabel(/^Pulau \(/).selectOption(await lombok.getAttribute('value'));
  await expect(page).toHaveURL(/pulau=\d+/);
  await expect(preview.locator('[data-kode]')).toHaveCount(5);
  await expect(preview.locator('[data-kode="52.71"]')).toBeAttached();
  await expect(preview.locator('[data-kode="52.04"]')).toHaveCount(0);
  await expect(preview.locator('svg > text')).toHaveCount(0);
  await page.getByLabel('Keterangan sumber').check();
  await expect(preview.locator('svg > text')).toHaveText('Batas wilayah: BPS (2020) via HDX, CC BY 3.0 IGO');
  const svg = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh SVG' }).click();
  expect((await svg).suggestedFilename()).toBe('peta-pulau-lombok-timur.svg');
});
