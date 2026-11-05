// ---------------------------------------------------------------------------
// Elevated guideway
//
// One merged U-girder per line, ballastless track slabs, four rails, tapered
// piers, OHE masts and the contact/messenger wires. Everything shares a small
// set of materials so a whole line is ~10 draw calls.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { makeConcrete, makeTrackbed, makeSteel } from './materials.js?v=20261105c';
import { mergeGeometries } from './geomutil.js?v=20261105c';

export const GAUGE = 1.435;
export const DECK_TOP = 10.4;
export const DECK_HALF = 5.3;
export const PARAPET_TOP = DECK_TOP + 1.18;
export const TRACK_OFFSET = 2.15;
export const RAIL_TOP = DECK_TOP + 0.2;

const UP = new THREE.Vector3(0, 1, 0);

export function sweep(route, profile, { yBase = 0, step = 2, vScale = 1 / 24, close = false } = {}) {
  const N = route.points.length;
  const prof = close ? [...profile, profile[0]] : profile;
  const segs = prof.length - 1;

  // cumulative arc length across the profile, for sane UVs
  const uLen = [0];
  for (let j = 1; j < prof.length; j++) {
    uLen.push(uLen[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  }
  const uTotal = Math.max(0.001, uLen[uLen.length - 1]);

  const pos = [];
  const uv = [];
  const ind = [];
  let k = 0;
  for (let i = 0; i < N; i += step) {
    const p = route.points[i];
    const t = route.tangents[i];
    const nx = t.z;
    const nz = -t.x;
    const s = i * route.ds;
    const lift = route.yAt ? route.yAt(s) : 0;
    for (let j = 0; j < prof.length; j++) {
      const [lat, y] = prof[j];
      pos.push(p.x + nx * lat, yBase + y + lift, p.z + nz * lat);
      uv.push(uLen[j] / uTotal, s * vScale);
    }
    if (k > 0) {
      const base = (k - 1) * prof.length;
      const cur = k * prof.length;
      for (let j = 0; j < segs; j++) {
        ind.push(base + j, cur + j, base + j + 1, base + j + 1, cur + j, cur + j + 1);
      }
    }
    k++;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.setIndex(ind);
  geom.computeVertexNormals();
  return geom;
}

function ribbon(route, latA, latB, y, { step = 2, vScale = 1 / 6, uRepeat = 1 } = {}) {
  const N = route.points.length;
  const pos = [];
  const uv = [];
  const ind = [];
  let k = 0;
  for (let i = 0; i < N; i += step) {
    const p = route.points[i];
    const t = route.tangents[i];
    const nx = t.z;
    const nz = -t.x;
    const s = i * route.ds;
    const lift = route.yAt ? route.yAt(s) : 0;
    pos.push(p.x + nx * latA, y + lift, p.z + nz * latA);
    pos.push(p.x + nx * latB, y + lift, p.z + nz * latB);
    uv.push(0, s * vScale * uRepeat, 1, s * vScale * uRepeat);
    if (k > 0) {
      const a = (k - 1) * 2;
      ind.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    k++;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.setIndex(ind);
  geom.computeVertexNormals();
  return geom;
}

export function buildGuideway(route, { anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = `guideway-${route.id}`;

  const concreteTex = makeConcrete(anisotropy);
  const trackTex = makeTrackbed(anisotropy);
  const steelTex = makeSteel(anisotropy);

  const concrete = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xd2cec1,
    roughness: 0.84,
    metalness: 0.02,
  });
  concrete.userData.castShadow = true;
  concrete.userData.receiveShadow = true;

  const concreteDark = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xb6b1a6,
    roughness: 0.9,
    metalness: 0.02,
  });
  concreteDark.userData.castShadow = true;
  concreteDark.userData.receiveShadow = true;

  const trackbed = new THREE.MeshStandardMaterial({
    map: trackTex,
    color: 0xd2d3cd,
    roughness: 0.97,
    metalness: 0.02,
  });
  trackbed.userData.receiveShadow = true;

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xc9cecd,
    metalness: 0.88,
    roughness: 0.24,
    envMapIntensity: 1.6,
  });
  railMat.userData.castShadow = true;

  const steel = new THREE.MeshStandardMaterial({
    map: steelTex,
    color: 0x6b7272,
    roughness: 0.54,
    metalness: 0.45,
  });
  steel.userData.castShadow = true;

  const W = DECK_HALF;
  const t = 0.46;

  // ---- U-girder -----------------------------------------------------------
  // profile runs left-bottom clockwise so every face ends up outward-facing
  const deckProfile = [
    [-W, -1.42],
    [-W, 1.18],
    [-W + t, 1.18],
    [-W + t, 0.02],
    [-0.58, 0.02],
    [-0.58, -0.12],
    [0.58, -0.12],
    [0.58, 0.02],
    [W - t, 0.02],
    [W - t, 1.18],
    [W, 1.18],
    [W, -1.42],
  ];
  const deck = new THREE.Mesh(
    sweep(route, deckProfile, { yBase: DECK_TOP, step: 2, vScale: 1 / 9, close: true }),
    concrete
  );
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // soffit ribs give the underside a sculpted girder look
  {
    const n = Math.floor(route.length / 24);
    const ribGeo = new THREE.BoxGeometry(W * 2 - 0.5, 0.5, 0.55);
    const ribs = new THREE.InstancedMesh(ribGeo, concreteDark, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const s = 12 + i * 24;
      const p = route.getPoint(s);
      const tg = route.getTangent(s);
      q.setFromEuler(new THREE.Euler(0, Math.atan2(tg.x, tg.z), 0));
      m.compose(new THREE.Vector3(p.x, DECK_TOP - 1.75 + route.yAt(s), p.z), q, one);
      ribs.setMatrixAt(i, m);
    }
    ribs.castShadow = true;
    group.add(ribs);
  }

  // ---- track slabs --------------------------------------------------------
  const slabs = new THREE.Group();
  for (const lat of [-TRACK_OFFSET, TRACK_OFFSET]) {
    const g = ribbon(route, lat - 1.75, lat + 1.75, DECK_TOP + 0.05, { step: 2, vScale: 1 / 6 });
    const mesh = new THREE.Mesh(g, trackbed);
    mesh.receiveShadow = true;
    slabs.add(mesh);
  }
  // centre drainage channel
  {
    const g = ribbon(route, -0.58, 0.58, DECK_TOP + 0.035, { step: 2, vScale: 1 / 6, uRepeat: 0.35 });
    const mesh = new THREE.Mesh(g, concreteDark);
    mesh.receiveShadow = true;
    slabs.add(mesh);
  }
  group.add(slabs);

  // ---- rails --------------------------------------------------------------
  const railProfile = [
    [-0.075, 0],
    [0.075, 0],
    [0.075, -0.03],
    [0.024, -0.05],
    [0.024, -0.13],
    [0.08, -0.15],
    [0.08, -0.2],
    [-0.08, -0.2],
    [-0.08, -0.15],
    [-0.024, -0.13],
    [-0.024, -0.05],
    [-0.075, -0.03],
  ];
  const railGeoms = [];
  for (const lat of [-TRACK_OFFSET, TRACK_OFFSET]) {
    for (const side of [-GAUGE / 2, GAUGE / 2]) {
      railGeoms.push(
        sweep(
          route,
          railProfile.map(([l, y]) => [l + lat + side, y]),
          { yBase: RAIL_TOP, step: 2, vScale: 1, close: true }
        )
      );
    }
  }
  const rails = new THREE.Mesh(mergeGeometries(railGeoms), railMat);
  rails.castShadow = true;
  rails.receiveShadow = true;
  group.add(rails);

  // ---- piers --------------------------------------------------------------
  {
    const spacing = 32;
    const slots = [];
    for (let s = 14; s < route.length - 10; s += spacing) {
      // The interchange station carries the raised deck on its own columns.
      if (route.isOverInterchange(s)) continue;
      slots.push(s);
    }
    const n = slots.length;
    const h = DECK_TOP - 1.42 - 0.55;
    const colGeo = new THREE.CylinderGeometry(0.72, 1.05, h, 14);
    colGeo.translate(0, h / 2, 0);
    const capGeo = new THREE.BoxGeometry(7.0, 0.62, 2.25);
    const footGeo = new THREE.CylinderGeometry(1.55, 1.9, 1.0, 16);
    footGeo.translate(0, 0.5, 0);

    const cols = new THREE.InstancedMesh(colGeo, concreteDark, n);
    const caps = new THREE.InstancedMesh(capGeo, concreteDark, n);
    const feet = new THREE.InstancedMesh(footGeo, concreteDark, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const sc = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const p = route.getPoint(s);
      const tg = route.getTangent(s);
      const lift = route.yAt(s);
      const stretch = (h + lift) / h;
      q.setFromEuler(new THREE.Euler(0, Math.atan2(tg.x, tg.z), 0));
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
      feet.setMatrixAt(i, m);
      sc.set(1, stretch, 1);
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, sc);
      cols.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p.x, DECK_TOP - 1.42 - 0.31 + lift, p.z), q, one);
      caps.setMatrixAt(i, m);
    }
    for (const x of [cols, caps, feet]) {
      x.castShadow = true;
      x.receiveShadow = true;
      group.add(x);
    }
  }

  // ---- OHE masts + wires --------------------------------------------------
  const mastSpacing = 48;
  const mastS = [];
  for (let s = 26; s < route.length - 10; s += mastSpacing) {
    if (route.stations.some((st) => Math.abs(st.s - s) < 74)) continue;
    mastS.push(s);
  }

  {
    const poleGeo = new THREE.CylinderGeometry(0.085, 0.115, 7.6, 8);
    poleGeo.translate(0, 3.8, 0);
    const armGeo = new THREE.BoxGeometry(2.55, 0.075, 0.075);
    armGeo.translate(-1.275, 0, 0);
    const braceGeo = new THREE.BoxGeometry(1.5, 0.05, 0.05);
    braceGeo.translate(-0.75, 0, 0);
    const poles = new THREE.InstancedMesh(poleGeo, steel, mastS.length * 2);
    const arms = new THREE.InstancedMesh(armGeo, steel, mastS.length * 2);
    const braces = new THREE.InstancedMesh(braceGeo, steel, mastS.length * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const s of mastS) {
      const p = route.getPoint(s);
      const tg = route.getTangent(s);
      const yaw = Math.atan2(tg.x, tg.z);
      for (const sgn of [-1, 1]) {
        const nx = tg.z;
        const nz = -tg.x;
        const x = p.x + nx * sgn * (W - 0.28);
        const z = p.z + nz * sgn * (W - 0.28);
        const lift = route.yAt(s);
        q.setFromEuler(new THREE.Euler(0, yaw, 0));
        m.compose(new THREE.Vector3(x, PARAPET_TOP + lift, z), q, one);
        poles.setMatrixAt(i, m);
        // arm reaches in over the track
        q.setFromEuler(new THREE.Euler(0, yaw + (sgn > 0 ? Math.PI : 0), 0));
        m.compose(new THREE.Vector3(x, PARAPET_TOP + 6.5 + lift, z), q, one);
        arms.setMatrixAt(i, m);
        q.setFromEuler(new THREE.Euler(0, yaw + (sgn > 0 ? Math.PI : 0), 0.5));
        m.compose(new THREE.Vector3(x, PARAPET_TOP + 5.7 + lift, z), q, one);
        braces.setMatrixAt(i, m);
        i++;
      }
    }
    for (const x of [poles, arms, braces]) {
      x.castShadow = true;
      group.add(x);
    }
  }

  // contact + messenger wires with droppers
  {
    const verts = [];
    const push = (x1, y1, z1, x2, y2, z2) => verts.push(x1, y1, z1, x2, y2, z2);
    const sag = 0.34;
    for (const sgn of [-1, 1]) {
      const lat = TRACK_OFFSET * sgn;
      for (let i = 0; i < mastS.length - 1; i++) {
        const s0 = mastS[i];
        const s1 = mastS[i + 1];
        const steps = 8;
        let prevC = null;
        let prevM = null;
        for (let k = 0; k <= steps; k++) {
          const s = s0 + ((s1 - s0) * k) / steps;
          const p = route.getPoint(s);
          const tg = route.getTangent(s);
          const nx = tg.z;
          const nz = -tg.x;
          const u = k / steps;
          const dip = Math.sin(u * Math.PI) * sag;
          const lift = route.yAt(s);
          const cy = PARAPET_TOP + 5.0 - dip * 0.25 + lift;
          const my = PARAPET_TOP + 6.1 - dip + lift;
          const c = [p.x + nx * lat, cy, p.z + nz * lat];
          const mm = [p.x + nx * lat, my, p.z + nz * lat];
          if (prevC) {
            push(...prevC, ...c);
            push(...prevM, ...mm);
          }
          if (k > 0 && k < steps) push(...c, ...mm);
          prevC = c;
          prevM = mm;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x23282a,
      transparent: true,
      opacity: 0.75,
    });
    group.add(new THREE.LineSegments(g, wireMat));
  }

  group.userData.materials = { concrete, concreteDark, trackbed, railMat, steel };
  return group;
}
