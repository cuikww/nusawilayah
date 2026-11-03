// Decodes the TopoJSON written by the pipeline (quantized, delta-encoded arcs) into GeoJSON-like features.

type Position = [lng: number, lat: number];
export type Ring = Position[];
export type Polygon = Ring[];

export interface Geometry {
  type: 'Polygon' | 'MultiPolygon';
  arcs: number[][] | number[][][];
  properties?: { kode: string; nama: string; id: string };
}

export interface Topology {
  type: 'Topology';
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: [number, number][][];
  objects: Record<string, { type: 'GeometryCollection'; geometries: Geometry[] }>;
}

/** One region: its Kemendagri kode, name, CSS id (kab-51-03) and polygons in [lng, lat]. */
export interface GeoFeature {
  kode: string;
  nama: string;
  id: string;
  polygons: Polygon[];
}

export function featuresOf(topology: Topology): GeoFeature[] {
  const { transform } = topology;
  const arcs = topology.arcs.map((arc) => {
    if (!transform) return arc as Position[];
    const { scale: [sx, sy], translate: [tx, ty] } = transform;
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]): Position => [(x += dx) * sx + tx, (y += dy) * sy + ty]);
  });
  // A negative index ~i means arc i reversed. Consecutive arcs share their joining point, so it is skipped.
  const ring = (indexes: number[]): Ring =>
    indexes.flatMap((i, n) => {
      const arc = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
      return n === 0 ? arc : arc.slice(1);
    });
  const polygon = (rings: number[][]): Polygon => rings.map(ring);

  const [collection] = Object.values(topology.objects);
  return collection.geometries.flatMap((g) => {
    if (!g.properties || !g.arcs) return [];
    const polygons = g.type === 'Polygon' ? [polygon(g.arcs as number[][])] : (g.arcs as number[][][]).map(polygon);
    return [{ ...g.properties, polygons }];
  });
}
