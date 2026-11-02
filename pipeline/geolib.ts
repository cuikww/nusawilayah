// Parse cahyadsn boundary dumps and check that they pair with the region data. Pure functions, no I/O.

type Coords = number[] | Coords[];

export interface Feature {
  type: 'Feature';
  kode: string;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Coords };
}

/**
 * Rows `('kode','nama',lat,lng,'path')` where path is a JSON (Multi)Polygon in [lat, lng] order; GeoJSON wants
 * [lng, lat], so every pair is swapped. The upstream lat/lng centroid and name are not used.
 */
export function parseBoundaries(sql: string): Feature[] {
  const swap = (c: Coords): Coords => (typeof c[0] === 'number' ? [c[1] as number, c[0]] : (c as Coords[]).map(swap));
  const depth = (c: Coords | number): number => (typeof c === 'number' ? 0 : 1 + depth(c[0]));
  const out: Feature[] = [];
  for (const m of sql.matchAll(/\('([0-9.]+)',\s*'(?:[^']|'')*',\s*-?[\d.]+,\s*-?[\d.]+,\s*'(\[[^']*\])'\)/g)) {
    const coordinates = swap(JSON.parse(m[2]));
    out.push({ type: 'Feature', kode: m[1], geometry: { type: depth(coordinates) === 4 ? 'MultiPolygon' : 'Polygon', coordinates } });
  }
  return out;
}

/** Errors for boundaries without a kode in the data, data kode without a boundary, and duplicates. */
export function pairing(level: string, features: Feature[], official: Map<string, string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const { kode } of features) {
    if (seen.has(kode)) errors.push(`${level}: duplicate boundary ${kode}`);
    seen.add(kode);
    if (!official.has(kode)) errors.push(`${level}: boundary ${kode} has no kode in the data`);
  }
  for (const [kode, nama] of official) if (!seen.has(kode)) errors.push(`${level}: no boundary for ${kode} ${nama}`);
  return errors;
}
