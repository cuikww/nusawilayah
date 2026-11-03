import { describe, expect, it } from 'vitest';
import { pairing, parseBoundaries } from './geolib.ts';

const sql = `INSERT INTO wilayah_boundaries(kode,nama,lat,lng,path) VALUES
	('51.01','Kabupaten Jembrana',-8.31,114.68,'[[[-8.1,114.4],[-8.2,114.5],[-8.3,114.4],[-8.1,114.4]]]'),
	('51.03','Kabupaten Ba''dung',-8.58,115.18,'[[[[-8.8,115.1],[-8.9,115.2],[-8.7,115.2],[-8.8,115.1]]],[[[-8.6,115.3],[-8.65,115.35],[-8.6,115.4],[-8.6,115.3]]]]');`;

describe('parseBoundaries', () => {
  it('reads Polygon and MultiPolygon rows and swaps [lat, lng] to GeoJSON [lng, lat]', () => {
    const [jembrana, badung] = parseBoundaries(sql);
    expect(jembrana).toEqual({
      type: 'Feature',
      kode: '51.01',
      geometry: { type: 'Polygon', coordinates: [[[114.4, -8.1], [114.5, -8.2], [114.4, -8.3], [114.4, -8.1]]] },
    });
    expect(badung.kode).toBe('51.03'); // escaped quote in the name does not break the row
    expect(badung.geometry.type).toBe('MultiPolygon');
    expect(badung.geometry.coordinates[1]).toEqual([[[115.3, -8.6], [115.35, -8.65], [115.4, -8.6], [115.3, -8.6]]]);
  });
});

describe('pairing', () => {
  const official = new Map([['51.01', 'Kabupaten Jembrana'], ['51.02', 'Kabupaten Tabanan'], ['51.03', 'Kabupaten Badung']]);
  it('reports missing, unknown and duplicate boundaries', () => {
    const features = parseBoundaries(sql);
    expect(pairing('kabupaten', features, official)).toEqual(['kabupaten: no boundary for 51.02 Kabupaten Tabanan']);
    expect(pairing('kabupaten', [...features, features[0], { ...features[0], kode: '99.01' }], official)).toEqual([
      'kabupaten: duplicate boundary 51.01',
      'kabupaten: boundary 99.01 has no kode in the data',
      'kabupaten: no boundary for 51.02 Kabupaten Tabanan',
    ]);
  });
});
