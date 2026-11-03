import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('map and picker stay in sync both ways', async ({ page }) => {
  await page.goto('/');
  const sync = page.locator('section', { has: page.getByRole('heading', { name: 'Picker + peta' }) });
  const map = sync.locator('[data-nw-map]');

  // click on the map → the picker follows, the map drills down
  await sync.getByRole('button', { name: 'Bali', exact: true }).click();
  await expect(sync.getByLabel('Provinsi', { exact: true })).toHaveValue('51');
  await expect(map).toHaveAttribute('data-nw-map', 'kabupaten');
  await expect(map.locator('[data-nw-region]')).toHaveCount(9);

  // keyboard on the map
  await map.locator('#kab-51-03').focus();
  await page.keyboard.press('Enter');
  await expect(sync.getByLabel('Kabupaten/Kota', { exact: true })).toHaveValue('51.03');
  await expect(map).toHaveAttribute('data-nw-map', 'kecamatan');
  await expect(map.locator('svg')).not.toHaveAttribute('viewBox', /^0 0 /); // zoomed to Badung

  // the picker → the map highlights the kecamatan
  await sync.getByLabel('Kecamatan', { exact: true }).selectOption({ label: 'Kuta' });
  await expect(map.locator('#kec-51-03-01')).toHaveAttribute('aria-pressed', 'true');

  await sync.getByRole('button', { name: 'Kembali ke Indonesia' }).click();
  await expect(map.locator('[data-nw-region]')).toHaveCount(38);
});

test('choropleth colours every provinsi and shows a legend', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Jumlah kabupaten/kota per provinsi' }) });
  await expect(section.locator('[data-nw-region]')).toHaveCount(38);
  await expect(section.getByRole('img', { name: 'Jawa Timur: 38' })).toBeVisible();
  await expect(section.locator('[data-nw-legend] li')).toHaveCount(5);
});

test('no accessibility violations (axe, WCAG 2.1 AA)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-nw-region]').first()).toBeAttached();
  await expect(page.locator('[data-nw-legend]')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target).join(', ')}`)).toEqual([]);
});
