// ---------------------------------------------------------------------------
// Network loading and projection
//
// network.json stores the real GTFS shapes in WGS84. Here they are projected
// once into a local metric frame that is bit-consistent with MapLibre's
// Mercator projection, resampled every ~2 m, and given arc-length queries.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MAP } from './config.js?v=20261105l';

const DEG = Math.PI / 180;

export class Route {
  constructor(def, frame) {
    this.id = def.id;
    this.name = def.name;
    this.long = def.long;
    this.color = def.color;
    this.textColor = def.textColor;
    this.from = def.from;
    this.to = def.to;
    this.length = def.length;
    this.outline = def.outline;
    this.def = def;
    this.S = frame.S;
    this.O = frame.O;

    const { project } = frame;
    const anchors = def.points.map(([lat, lon]) => project(lat, lon));
    const gtfsLength = def.points[def.points.length - 1][2];

    // Extend the guideway ~170 m past each terminus so a train can pull into
    // the scissors crossover and reverse without hanging off the end.
    const EXT = 170;
    const d0 = new THREE.Vector3().subVectors(anchors[0], anchors[1]).setY(0).normalize();
    const d1 = new THREE.Vector3()
      .subVectors(anchors[anchors.length - 1], anchors[anchors.length - 2])
      .setY(0)
      .normalize();
    const before = anchors[0].clone().addScaledVector(d0, EXT);
    const after = anchors[anchors.length - 1].clone().addScaledVector(d1, EXT);

    const curve = new THREE.CatmullRomCurve3([before, ...anchors, after], false, 'centripetal', 0.5);
    curve.arcLengthDivisions = Math.min(90000, anchors.length * 26);
    const length = curve.getLength();
    this.length = length;

    const step = 2;
    const count = Math.max(2, Math.round(length / step));
    const pts = curve.getSpacedPoints(count - 1);
    const ds = length / (count - 1);
    this.ds = ds;
    this.count = count;
    this.points = pts;
    this.extStart = EXT;

    const tangents = new Array(count);
    for (let i = 0; i < count; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(count - 1, i + 1)];
      tangents[i] = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    }
    this.tangents = tangents;

    // curvature (1/m), smoothed over ±12 m so the bank feel is not twitchy
    const raw = new Float32Array(count);
    const span = Math.max(3, Math.round(12 / ds));
    for (let i = span; i < count - span; i++) {
      const a = pts[i - span];
      const b = pts[i];
      const c = pts[i + span];
      const abx = b.x - a.x, abz = b.z - a.z;
      const bcx = c.x - b.x, bcz = c.z - b.z;
      const acx = c.x - a.x, acz = c.z - a.z;
      const area = Math.abs(abx * acz - abz * acx) * 0.5;
      const la = Math.hypot(abx, abz), lb = Math.hypot(bcx, bcz), lc = Math.hypot(acx, acz);
      raw[i] = area > 1e-9 ? (la * lb * lc) / (4 * area) : 0;
    }
    const smooth = new Float32Array(count);
    const win = span;
    for (let i = 0; i < count; i++) {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - win); j <= Math.min(count - 1, i + win); j++) { sum += raw[j]; n++; }
      smooth[i] = sum / n;
    }
    this.curvature = smooth;

    // stations, placed by GTFS chainage so they line up exactly with the trip
    // patterns (nearest-point snapping can drift a few metres on tight curves)
    const nearestIndex = (p) => {
      let best = Infinity;
      let bestI = 0;
      for (let i = 0; i < count; i += 1) {
        const q = pts[i];
        const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
        if (d < best) { best = d; bestI = i; }
      }
      return bestI;
    };
    const iStart = nearestIndex(anchors[0]);
    const iEnd = nearestIndex(anchors[anchors.length - 1]);
    this.sOffset = iStart * ds;
    this.scale = (iEnd * ds - this.sOffset) / gtfsLength;
    this.toPathS = (s) => this.sOffset + s * this.scale;

    this.stations = def.stations.map((st) => {
      const s = this.toPathS(st.s);
      const q = this.getPoint(s, new THREE.Vector3());
      return {
        ...st,
        s,
        x: q.x,
        z: q.z,
        index: Math.round(s / ds),
        lat: st.lat,
        lon: st.lon,
      };
    });
    this.stations.sort((a, b) => a.s - b.s);
    this.stations.forEach((s, i) => { s.order = i; });

    this.stationByChainage = this.stations.map((s) => s.s);

    // patterns: relative times, chainages mapped into the extended frame once
    this.patterns = def.patterns.map((p) => ({
      dir: p.dir,
      stops: p.stops.map((st) => ({
        st: st.st,
        s: this.toPathS(st.s),
        a: st.a,
        d: st.d,
      })),
    }));
    this.trips = def.trips;
    this.blocks = def.blocks;

    // Vertical humps let one corridor climb over the other at a shared
    // interchange. Filled in by markInterchanges() once every line is loaded.
    this.humps = [];
  }

  // Height offset of the guideway at chainage s.
  yAt(s) {
    let y = 0;
    for (const h of this.humps) {
      const d = Math.abs(s - h.s);
      if (d <= h.flat) y += h.height;
      else if (d < h.half) {
        const t = (d - h.flat) / (h.half - h.flat);
        y += h.height * 0.5 * (1 + Math.cos(Math.PI * t));
      }
    }
    return y;
  }

  // True while the line is on the raised deck over an interchange, where the
  // guideway is carried by the station structure instead of normal piers.
  isOverInterchange(s) {
    return this.humps.some((h) => Math.abs(s - h.s) < h.flat + 24);
  }

  indexForS(s) {
    const f = THREE.MathUtils.clamp(s / this.ds, 0, this.count - 1.0001);
    const i = Math.floor(f);
    return { i, f: f - i };
  }

  getPoint(s, target = new THREE.Vector3()) {
    const { i, f } = this.indexForS(s);
    return target.copy(this.points[i]).lerp(this.points[i + 1], f);
  }

  getTangent(s, target = new THREE.Vector3()) {
    const { i, f } = this.indexForS(s);
    return target.copy(this.tangents[i]).lerp(this.tangents[i + 1], f).normalize();
  }

  getCurvature(s) {
    const { i, f } = this.indexForS(s);
    return this.curvature[i] * (1 - f) + this.curvature[i + 1] * f;
  }

  headingAt(s) {
    const t = this.getTangent(s);
    // Local frame is x east, z north. MapLibre bearing is clockwise from
    // north, so heading = atan2(east, north).
    return Math.atan2(t.x, t.z) / DEG;
  }

  toLngLat(x, z) {
    return frameUnproject(this.O, this.S, x, z);
  }

  toGeoJSON() {
    return {
      type: 'Feature',
      properties: { id: this.id, color: this.color },
      geometry: { type: 'LineString', coordinates: this.outline },
    };
  }
}

function frameUnproject(O, S, x, z) {
  return new maplibregl.MercatorCoordinate(O.x + x * S, O.y - z * S).toLngLat();
}

// ---------------------------------------------------------------------------
// Interchange levels
//
// Ameerpet (Red × Blue) and M.G. Bus Station (Red × Green) are stacked
// interchanges in reality: Corridor I runs on the upper deck and the other
// corridor crosses underneath. The two lines here are independent polylines
// that happen to meet at the same lat/lon, so one of them is given a smooth
// vertical hump while the other stays at grade. The station builder then puts
// a tall hall on the upper corridor and a low one on the lower corridor.
// ---------------------------------------------------------------------------

const LINE_PRIORITY = { RED: 0, BLUE: 1, GREEN: 2 };

function markInterchanges(lines) {
  const groups = new Map();
  for (const line of lines) {
    for (const st of line.stations) {
      const key = `${st.lat.toFixed(5)},${st.lon.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ line, st });
    }
  }

  for (const group of groups.values()) {
    const unique = [...new Map(group.map((g) => [g.line.id, g])).values()];
    if (unique.length < 2) continue;
    unique.sort((a, b) => (LINE_PRIORITY[a.line.id] ?? 9) - (LINE_PRIORITY[b.line.id] ?? 9));
    const upper = unique[0];

    for (const { line, st } of unique) {
      st.interchange = true;
      st.level = line === upper.line ? 'upper' : 'lower';
    }
    // 8 m of separation gives the lower canopy comfortable headroom while
    // keeping the climb inside a plausible 3% metro gradient.
    const height = 8.0;
    upper.line.humps.push({ s: upper.st.s, height, flat: 84, half: 390 });
  }
}

export async function loadNetwork(onProgress = () => {}) {
  const res = await fetch('assets/data/network.json');
  if (!res.ok) throw new Error('network.json missing — run tools/build-network.mjs');
  const raw = await res.json();
  onProgress(0.12);

  const O = maplibregl.MercatorCoordinate.fromLngLat([MAP.origin.lng, MAP.origin.lat]);
  const north = maplibregl.MercatorCoordinate.fromLngLat([MAP.origin.lng, MAP.origin.lat + 0.001]);
  const S = Math.abs(north.y - O.y) / 111.32;

  const project = (lat, lon) => {
    const m = maplibregl.MercatorCoordinate.fromLngLat([lon, lat]);
    return new THREE.Vector3((m.x - O.x) / S, 0, -(m.y - O.y) / S);
  };

  const frame = { O, S, project };
  const lines = raw.lines.map((d) => new Route(d, frame));
  markInterchanges(lines);

  return {
    raw,
    meta: raw.meta,
    lines,
    byId: new Map(lines.map((l) => [l.id, l])),
    frame,
    // every station across the network, de-duplicated by name
    stations: (() => {
      const seen = new Map();
      for (const line of lines) {
        for (const st of line.stations) {
          const key = st.name.toLowerCase();
          if (!seen.has(key)) seen.set(key, { ...st, lines: [line.id] });
          else seen.get(key).lines.push(line.id);
        }
      }
      return [...seen.values()];
    })(),
  };
}
