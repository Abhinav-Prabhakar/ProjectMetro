import * as THREE from 'three';
import { MAP } from './config.js?v=20261107c';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Loads the Blue Line geometry (OpenStreetMap relation 8297688) and turns it
 * into a smooth, arc-length parametrised path in a local metric frame that is
 * exactly consistent with MapLibre's Mercator projection.
 */
export async function loadRoute() {
  const res = await fetch('assets/data/blue-line.json');
  const raw = await res.json();

  const O = maplibregl.MercatorCoordinate.fromLngLat([MAP.origin.lng, MAP.origin.lat]);
  // Mercator units per ground metre at the origin latitude (Mercator is conformal).
  const north = maplibregl.MercatorCoordinate.fromLngLat([MAP.origin.lng, MAP.origin.lat + 0.001]);
  const S = Math.abs(north.y - O.y) / 111.32;

  const project = (lat, lng) => {
    const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat]);
    return new THREE.Vector3((m.x - O.x) / S, 0, -(m.y - O.y) / S);
  };
  const unproject = (x, z) =>
    new maplibregl.MercatorCoordinate(O.x + x * S, O.y - z * S).toLngLat();

  const anchors = raw.coords.map(([lat, lng]) => project(lat, lng));
  // Extend both ends so the 3-car set can stand fully on the guideway at the
  // terminal stations (OSM relations start/end on the station centreline).
  const EXT = 130;
  const first = anchors[0];
  const second = anchors[Math.min(2, anchors.length - 1)];
  const before = first.clone().addScaledVector(
    new THREE.Vector3().subVectors(first, second).normalize(),
    EXT
  );
  const last = anchors[anchors.length - 1];
  const prev = anchors[Math.max(0, anchors.length - 3)];
  const after = last.clone().addScaledVector(
    new THREE.Vector3().subVectors(last, prev).normalize(),
    EXT
  );
  const pathAnchors = [before, ...anchors, after];
  const curve = new THREE.CatmullRomCurve3(pathAnchors, false, 'centripetal', 0.5);
  curve.arcLengthDivisions = 30000;
  const length = curve.getLength();
  const count = Math.max(2, Math.round(length / 1.2));
  const points = curve.getSpacedPoints(count - 1);
  const ds = length / (count - 1);

  const tangents = new Array(count);
  for (let i = 0; i < count; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(count - 1, i + 1)];
    tangents[i] = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  }

  // curvature (1/m), smoothed
  const curv = new Float32Array(count);
  const span = 8;
  for (let i = span; i < count - span; i++) {
    const a = points[i - span];
    const b = points[i];
    const c = points[i + span];
    const ab = new THREE.Vector3().subVectors(b, a);
    const bc = new THREE.Vector3().subVectors(c, b);
    const ac = new THREE.Vector3().subVectors(c, a);
    const area = new THREE.Vector3().crossVectors(ab, ac).length() * 0.5;
    const la = ab.length();
    const lb = bc.length();
    const lc = ac.length();
    const R = area > 1e-6 ? (la * lb * lc) / (4 * area) : 1e7;
    curv[i] = 1 / R;
  }
  const smooth = new Float32Array(count);
  const win = 14;
  for (let i = 0; i < count; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(count - 1, i + win); j++) {
      sum += curv[j];
      n++;
    }
    smooth[i] = sum / n;
  }

  // snap stations onto the smoothed path
  const stations = raw.stations.map((st) => {
    const p = project(st.lat, st.lon);
    let best = Infinity;
    let bestI = 0;
    for (let i = 0; i < count; i += 2) {
      const q = points[i];
      const d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
      if (d < best) {
        best = d;
        bestI = i;
      }
    }
    const index = bestI;
    return {
      ...st,
      s: index * ds,
      x: points[index].x,
      z: points[index].z,
      index,
    };
  });
  stations.sort((a, b) => a.s - b.s);

  const indexForS = (s) => {
    const f = THREE.MathUtils.clamp(s / ds, 0, count - 1.0001);
    const i = Math.floor(f);
    return { i, f: f - i };
  };

  const getPoint = (s, target = new THREE.Vector3()) => {
    const { i, f } = indexForS(s);
    return target.copy(points[i]).lerp(points[i + 1], f);
  };
  const getTangent = (s, target = new THREE.Vector3()) => {
    const { i, f } = indexForS(s);
    return target.copy(tangents[i]).lerp(tangents[i + 1], f).normalize();
  };
  const getCurvature = (s) => {
    const { i, f } = indexForS(s);
    return smooth[i] * (1 - f) + smooth[i + 1] * f;
  };
  const headingAt = (s) => {
    const t = getTangent(s);
    return (Math.atan2(t.x, t.z) * 180) / Math.PI;
  };

  return {
    raw,
    points,
    tangents,
    ds,
    length,
    stations,
    S,
    O,
    project,
    unproject,
    getPoint,
    getTangent,
    getCurvature,
    headingAt,
    toLngLat: (x, z) => unproject(x, z),
    toGeoJSON: () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: raw.coords.map(([lat, lng]) => [lng, lat]),
      },
    }),
  };
}
