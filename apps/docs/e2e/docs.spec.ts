import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('playground: options change the picker, output and code', async ({ page }) => {
  await page.goto('/');
  const demo = page.locator('[data-nw-picker]');
  await demo.getByLabel('Provinsi').selectOption('51');
  await demo.getByLabel('Kabupaten/Kota').selectOption('51.03');
  await expect(page.getByTestId('output')).toContainText('"nama": "Kabupaten Badung"');

  await page.getByLabel('English labels').check();
  await page.getByRole('radio', { name: 'search' }).check();
  await expect(page.getByTestId('code')).toContainText('<WilayahPicker mode="search" labels={labelsEn}');
  await page.getByRole('combobox', { name: 'Search region' }).fill('johan pahwalan');
  await expect(page.getByRole('listbox').getByRole('option').first()).toHaveText('Johan Pahlawan, Aceh Barat, Aceh (formerly Johan Pahwalan)');
});

test('repeat visits load from IndexedDB without the network', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-nw-picker]').getByLabel('Provinsi').locator('option[value="51"]')).toBeAttached();
  await page.waitForTimeout(300); // let the IndexedDB write finish
  let dataRequests = 0;
  await page.route('**/provinsi.json', (route) => { dataRequests++; return route.abort(); });
  await page.reload();
  await expect(page.locator('[data-nw-picker]').getByLabel('Provinsi').locator('option[value="51"]')).toBeAttached();
  expect(dataRequests).toBe(0);
});

test('no accessibility violations (axe, WCAG 2.1 AA)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-nw-picker]').getByLabel('Provinsi').locator('option[value="51"]')).toBeAttached();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
});
