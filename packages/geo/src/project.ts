// Projects features to SVG paths (Mercator, fitted to a width). Indonesia spans the equator, so Mercator's
// distortion is small and the map matches web maps (Leaflet, MapLibre) that users already know.
import type { GeoFeature, Polygon } from './topojson.ts';

export interface Region {
  kode: string;
  nama: string;
  id: string;
  /** SVG path data in the map's coordinate space. */
  d: string;
  /** [x, y, width, height] of the region, for zooming to it. */
  box: [number, number, number, number];
}

export interface ProjectedMap {
  width: number;
  height: number;
  /** `0 0 width height` */
  viewBox: string;
  regions: Region[];
}

export interface ProjectOptions {
  /** Width of the coordinate space. Default 1000; the height follows the regions' shape. */
  width?: number;
  /** Empty space around the regions, in the same units. Default 0. */
  padding?: number;
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);

export function project(features: GeoFeature[], { width = 1000, padding = 0 }: ProjectOptions = {}): ProjectedMap {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const raw = features.map((f) =>
    f.polygons.map((p) =>
      p.map((ring) =>
        ring.map(([lng, lat]) => {
          const x = lng;
          const y = -mercatorY(lat); // SVG y grows downwards
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          return [x, y] as const;
        }),
      ),
    ),
  );
  const scale = (width - 2 * padding) / (maxX - minX || 1);
  const height = Math.round((maxY - minY) * scale + 2 * padding);
  const round = (n: number) => Math.round(n * 10) / 10;

  const regions = features.map((f, i): Region => {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    const d = raw[i]
      .map((polygon) =>
        polygon
          .map((ring) => {
            const pts = ring.map(([x, y]) => {
              const px = round((x - minX) * scale + padding);
              const py = round((y - minY) * scale + padding);
              if (px < bx0) bx0 = px; if (px > bx1) bx1 = px;
              if (py < by0) by0 = py; if (py > by1) by1 = py;
              return `${px} ${py}`;
            });
            return `M${pts.join('L')}Z`;
          })
          .join(''),
      )
      .join('');
    return { kode: f.kode, nama: f.nama, id: f.id, d, box: [bx0, by0, round(bx1 - bx0), round(by1 - by0)] };
  });
  return { width, height, viewBox: `0 0 ${width} ${height}`, regions };
}
