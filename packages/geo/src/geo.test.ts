import { describe, expect, it, vi } from 'vitest';
import { createGeo, featuresOf, project, type Topology } from './index.ts';

// Two unit squares sharing one edge (arc 1), quantized like the pipeline's output.
const topology: Topology = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [100, -10] },
  arcs: [
    [[1, 0], [-1, 0], [0, 1], [1, 0]], // (101,-10) (100,-10) (100,-9) (101,-9)
    [[1, 0], [0, 1]], // shared edge (101,-10) → (101,-9)
    [[1, 1], [1, 0], [0, -1], [-1, 0]], // (101,-9) (102,-9) (102,-10) (101,-10)
  ],
  objects: {
    wilayah: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0, ~1]], properties: { kode: '51.01', nama: 'Barat', id: 'kab-51-01' } },
        { type: 'MultiPolygon', arcs: [[[1, 2]]], properties: { kode: '51.02', nama: 'Timur', id: 'kab-51-02' } },
      ],
    },
  },
};

describe('featuresOf', () => {
  it('decodes delta-encoded arcs, reversed arcs and shared points', () => {
    const [barat, timur] = featuresOf(topology);
    expect(barat).toEqual({
      kode: '51.01', nama: 'Barat', id: 'kab-51-01',
      polygons: [[[[101, -10], [100, -10], [100, -9], [101, -9], [101, -10]]]],
    });
    expect(timur.polygons).toEqual([[[[101, -10], [101, -9], [102, -9], [102, -10], [101, -10]]]]);
  });
});

describe('project', () => {
  it('fits regions to the width with north up and returns each box', () => {
    const map = project(featuresOf(topology), { width: 200 });
    expect(map.width).toBe(200);
    expect(map.height).toBeGreaterThan(98); // 1° lat ≈ 1° lng near the equator
    expect(map.height).toBeLessThan(102);
    const [barat, timur] = map.regions;
    expect(barat.d.startsWith('M100 ')).toBe(true); // lng 101 is the middle of 100..102
    expect(barat.box[0]).toBe(0);
    expect(timur.box[0]).toBe(100);
    expect(barat.box[1]).toBe(0); // -9° is further north than -10°: its y is 0
  });
});

describe('createGeo', () => {
  it('loads one file per map, caches it and validates the provinsi', async () => {
    const fetcher = vi.fn(async () => topology);
    const geo = createGeo({ fetcher });
    expect(await geo.load('kabupaten', '51')).toHaveLength(2);
    await geo.load('kabupaten', '51');
    expect(fetcher.mock.calls).toEqual([['kabupaten/51.topo.json']]);
    await geo.load('provinsi');
    expect(fetcher).toHaveBeenLastCalledWith('provinsi.topo.json');
    await expect(geo.load('kecamatan', '../x')).rejects.toThrow('need a provinsi kode');
  });
});
