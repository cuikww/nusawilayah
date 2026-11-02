// Load-time measurement on a simulated mid-range phone (PRD metrics). Not a pass/fail gate:
//   PERF=1 pnpm --filter example-next e2e perf
import { expect, test } from '@playwright/test';

test.skip(!process.env.PERF, 'set PERF=1 to measure');

test('mid-range phone: 4x CPU slowdown, 4G (150 ms RTT, 1.6 Mbps)', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 });

  await page.goto('/');
  const provinsi = page.getByLabel('Provinsi');
  await expect(provinsi.locator('option[value="51"]')).toBeAttached();
  const paint = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1);
  // Provinsi options are in the server HTML, so they are visible at first paint; usable once hydrated.
  const hydrated = await page.evaluate(async () => {
    while (!Object.keys(document.querySelector('select')!).some((k) => k.startsWith('__react'))) await new Promise((r) => setTimeout(r, 5));
    return performance.now();
  });

  // Measured inside the page: change event → option rendered, without test-runner round trips.
  const time = (value: string, expected: string) =>
    page.evaluate(
      ([value, expected]) =>
        new Promise<number>((resolve) => {
          const [prov, kab] = document.querySelectorAll('select');
          const start = performance.now();
          const done = () => kab.querySelector(`option[value="${expected}"]`) && (observer.disconnect(), resolve(performance.now() - start));
          const observer = new MutationObserver(done);
          observer.observe(kab, { childList: true });
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
          setter.call(prov, value);
          prov.dispatchEvent(new Event('change', { bubbles: true }));
        }),
      [value, expected],
    );
  const firstLoad = await time('51', '51.03');
  await time('52', '52.01');
  const cached = await time('51', '51.03');

  const r = (n: number) => `${Math.round(n)} ms`;
  console.log(`first contentful paint (provinsi visible, server-rendered): ${r(paint)}`);
  console.log(`hydrated (dropdown usable): ${r(hydrated)}`);
  console.log(`next dropdown filled, network: ${r(firstLoad)}`);
  console.log(`next dropdown filled, cached: ${r(cached)}`);
});
