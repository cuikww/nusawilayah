import { createGeo, type Topology } from '@nusawilayah/geo';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PetaIndonesia, petaLabelsEn, quantize } from './index.ts';

const square = (kode: string, nama: string, x: number): Topology['objects'][string]['geometries'][number] => ({
  type: 'Polygon', arcs: [[x]], properties: { kode, nama, id: `kab-${kode.replace('.', '-')}` },
});
const topology: Topology = {
  type: 'Topology',
  arcs: [
    [[115, -8], [115.5, -8], [115.5, -8.5], [115, -8.5], [115, -8]],
    [[116, -8], [116.5, -8], [116.5, -8.5], [116, -8.5], [116, -8]],
  ],
  objects: { wilayah: { type: 'GeometryCollection', geometries: [square('51.03', 'Badung', 0), square('51.71', 'Kota Denpasar', 1)] } },
};
const client = (fail = false) => createGeo({ fetcher: vi.fn(async () => { if (fail) throw new Error('offline'); return topology; }) });

afterEach(cleanup);

// The unzoomed map's size: project() fits to width 1000.
const project1000 = (svg: SVGSVGElement) => {
  const regions = [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d')!.match(/[\d.]+/g)!.map(Number));
  const ys = regions.flatMap((r) => r.filter((_, i) => i % 2));
  return { w: 1000, h: Math.max(...ys) };
};

describe('PetaIndonesia', () => {
  it('renders one region per kode with CSS ids and the disclaimer', async () => {
    const { container } = render(<PetaIndonesia level="kabupaten" provinsi="51" client={client()} />);
    await waitFor(() => expect(container.querySelectorAll('[data-nw-region]')).toHaveLength(2));
    expect(container.querySelector('#kab-51-03')?.getAttribute('data-kode')).toBe('51.03');
    expect(screen.getByRole('group', { name: 'Peta kabupaten' })).toBeTruthy();
    expect(screen.getByText(/bukan batas hukum/)).toBeTruthy();
  });

  it('selects a region by click and keyboard, and marks the value', async () => {
    const onSelect = vi.fn();
    render(<PetaIndonesia level="kabupaten" provinsi="51" client={client()} value="51.71" onSelect={onSelect} />);
    const badung = await screen.findByRole('button', { name: 'Badung' });
    fireEvent.click(badung);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Kota Denpasar' }), { key: 'Enter' });
    expect(onSelect.mock.calls).toEqual([[{ kode: '51.03', nama: 'Badung' }], [{ kode: '51.71', nama: 'Kota Denpasar' }]]);
    expect(screen.getByRole('button', { name: 'Kota Denpasar' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('colours a choropleth, labels values and shows a legend', async () => {
    const { container } = render(
      <PetaIndonesia level="kabupaten" provinsi="51" client={client()} data={{ '51.03': 340, '51.71': 120 }} labels={petaLabelsEn} formatValue={(v) => `${v} orders`} />,
    );
    await waitFor(() => expect(container.querySelectorAll('[data-nw-region]')).toHaveLength(2));
    expect(container.querySelector('#kab-51-03')?.getAttribute('fill')).toBe('#08519c'); // the max
    expect(container.querySelector('#kab-51-71')?.getAttribute('fill')).toBe('#deebf7'); // the min
    expect(screen.getByRole('img', { name: 'Badung: 340 orders' })).toBeTruthy();
    expect(container.querySelectorAll('[data-nw-legend] li')).toHaveLength(5);
  });

  it('zooms to a region', async () => {
    const { container, rerender } = render(<PetaIndonesia level="kabupaten" provinsi="51" client={client()} zoomTo="51.71" />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    const svg = container.querySelector('svg')!;
    const [x, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const full = project1000(svg);
    expect(x + w / 2).toBeGreaterThan(800); // centred on the eastern square
    expect(w / h).toBeCloseTo(full.w / full.h, 1); // same aspect ratio as the whole map: the page height never jumps
    expect(container.querySelector('#kab-51-03')?.getAttribute('fill-opacity')).toBe('0.35'); // neighbours fade
    expect(container.querySelector('#kab-51-71')?.hasAttribute('fill-opacity')).toBe(false);
    rerender(<PetaIndonesia level="kabupaten" provinsi="51" client={client()} zoomTo="51" />); // a parent: both squares
    await waitFor(() => expect(Number(container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2])).toBeGreaterThan(1000));
  });

  it('shows a load error with a working retry', async () => {
    let fail = true;
    const geo = createGeo({ fetcher: async () => { if (fail) throw new Error('offline'); return topology; } });
    render(<PetaIndonesia client={geo} />);
    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    fail = false;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' })); });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('quantize splits the range into equal steps', () => {
    const q = quantize(['a', 'b', 'c'], 0, 30);
    expect([0, 9, 10, 29, 30].map(q)).toEqual(['a', 'a', 'b', 'c', 'c']);
  });
});
