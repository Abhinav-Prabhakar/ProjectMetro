// ---------------------------------------------------------------------------
// Elevated stations
//
// Modelled on the real HMRL stations: a 140 m side-platform box under a
// curved steel canopy with a translucent ridge, blue name fascia, tactile
// platform edge, benches, PIDS, route boards, and stair / lift cores dropping
// to the concourse.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import {
  makeConcrete,
  makePlatformTile,
  makeTactile,
  makeSteel,
  makeRoofPanel,
  makeSignTexture,
} from './materials.js?v=20261108a';
import { mergeGeometries } from './geomutil.js?v=20261108a';
import { DECK_TOP } from './infrastructure.js?v=20261108a';

const HALF_LEN = 72;
const PLATFORM_IN = 3.72;
const PLATFORM_OUT = 8.05;
const PLATFORM_Y = 0.95;

function scaleUV(geom, su, sv) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geom;
}

function box(sx, sy, sz, x, y, z) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

function tiledTop(w, d, x, y, z, u = 1, v = 1) {
  const g = new THREE.PlaneGeometry(w, d, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  scaleUV(g, u, v);
  return g;
}

function canopyYAt(x, halfW, eave, apex) {
  const t = Math.min(1, Math.abs(x) / halfW);
  return apex - (apex - eave) * Math.pow(t, 1.6);
}

// One longitudinal ribbon of the segmented canopy. The canopy is built as
// alternating metal and glazed strips, so the skylights are real openings in
// the roof rather than a painted band.
function canopyBand(x0, x1, halfW, eave, apex, z0, z1, { stepsX = 2, stepsZ = 12, u = 1, v = 1, lift = 0 } = {}) {
  const pos = [];
  const uv = [];
  const ind = [];
  for (let iz = 0; iz <= stepsZ; iz++) {
    const z = z0 + ((z1 - z0) * iz) / stepsZ;
    for (let ix = 0; ix <= stepsX; ix++) {
      const x = x0 + ((x1 - x0) * ix) / stepsX;
      pos.push(x, canopyYAt(x, halfW, eave, apex) + lift, z);
      uv.push(((x - x0) / (x1 - x0)) * u, (iz / stepsZ) * v);
    }
  }
  for (let iz = 0; iz < stepsZ; iz++) {
    for (let ix = 0; ix < stepsX; ix++) {
      const a = iz * (stepsX + 1) + ix;
      const b = a + 1;
      const c = a + stepsX + 1;
      const d = c + 1;
      ind.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  // Winding is reversed so the top face is front-facing in the map's
  // projection; put the generated normals back outward so the sun, sky and
  // environment all see a roof.
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) {
    nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  }
  nor.needsUpdate = true;
  return g;
}

function strut(ax, ay, az, bx, by, bz, w = 0.14) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.BoxGeometry(w, w, len);
  const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  return g;
}

export function makeStationMaterials(line, anisotropy = 8) {
  const concreteTex = makeConcrete(anisotropy);
  const tileTex = makePlatformTile(anisotropy);
  const tactileTex = makeTactile(anisotropy);
  const steelTex = makeSteel(anisotropy);
  const roofTex = makeRoofPanel(anisotropy);

  const concrete = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xdad5c7,
    roughness: 0.82,
    metalness: 0.02,
  });
  const concreteDark = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xb1aca1,
    roughness: 0.88,
    metalness: 0.02,
  });
  const tile = new THREE.MeshStandardMaterial({
    map: tileTex,
    color: 0xc3c7ca,
    roughness: 0.5,
    metalness: 0.06,
    envMapIntensity: 1.05,
  });
  const tactile = new THREE.MeshStandardMaterial({
    map: tactileTex,
    color: 0xe0c15c,
    roughness: 0.72,
    metalness: 0.02,
  });
  const steel = new THREE.MeshStandardMaterial({
    map: steelTex,
    color: 0xa9b1b1,
    roughness: 0.46,
    metalness: 0.42,
    envMapIntensity: 1.25,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x33393c,
    roughness: 0.58,
    metalness: 0.32,
  });
  const roof = new THREE.MeshStandardMaterial({
    map: roofTex,
    color: 0xf2f4f1,
    roughness: 0.58,
    metalness: 0.08,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe6f0,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    transmission: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(line.color),
    roughness: 0.42,
    metalness: 0.15,
  });
  // Enamel cladding on the stair / lift cores. The real stations pick out these
  // volumes in a deep green, which reads well against the grey canopy.
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x22664f,
    roughness: 0.44,
    metalness: 0.18,
    envMapIntensity: 0.9,
  });
  // Deep-blue enamel on the fascia: the band the station name sits on. On the
  // real stations it is the brightest, most seen piece of the building.
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: 0x0c2c57,
    roughness: 0.48,
    metalness: 0.1,
    envMapIntensity: 0.7,
  });
  // Pure light emitters. Additive so they bloom against the dark and can be
  // switched off completely in daylight without touching their geometry.
  const glow = new THREE.MeshBasicMaterial({
    color: 0xffe2b4,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f12,
    emissive: 0x2b6f9e,
    emissiveIntensity: 0.5,
    roughness: 0.35,
  });
  roof.userData.castShadow = true;
  concrete.userData.castShadow = true;
  concrete.userData.receiveShadow = true;

  return {
    concrete, concreteDark, tile, tactile, steel, darkSteel, roof, glass, line: lineMat, accent: accentMat, fascia: fasciaMat, glow, screenMat,
    night: { glow, screenMat, glass },
  };
}

export function buildStation(route, st, mats, index = 0, { low = false } = {}) {
  const group = new THREE.Group();
  group.name = `station-${route.id}-${st.order}`;

  const concrete = [];
  const concreteDark = [];
  const tile = [];
  const tactile = [];
  const steel = [];
  const dark = [];
  const roof = [];
  const glass = [];
  const line = [];
  const accent = [];
  const fascia = [];
  const glow = [];
  const screen = [];

  const half = HALF_LEN;

  // ---- platform decks -----------------------------------------------------
  for (const sgn of [-1, 1]) {
    const inner = sgn * PLATFORM_IN;
    const outer = sgn * PLATFORM_OUT;
    const cx = (inner + outer) / 2;
    const w = Math.abs(outer - inner);
    // structural slab
    concrete.push(box(w, PLATFORM_Y, half * 2, cx, PLATFORM_Y / 2, 0));
    // tiled finish
    tile.push(
      tiledTop(w, half * 2, cx, PLATFORM_Y + 0.005, 0, w / 1.2, (half * 2) / 1.2)
    );
    // platform edge wall facing the track
    concrete.push(box(0.22, PLATFORM_Y + 0.12, half * 2, inner - sgn * 0.11, (PLATFORM_Y + 0.12) / 2, 0));

    // tactile strip + yellow safety line
    tactile.push(
      tiledTop(0.42, half * 2, inner + sgn * 0.55, PLATFORM_Y + 0.02, 0, 1, (half * 2) / 0.42)
    );
    tactile.push(tiledTop(0.1, half * 2, inner + sgn * 1.02, PLATFORM_Y + 0.02, 0, 1, 1));

    // platform-edge glass balustrade at the outer side
    glass.push(box(0.04, 1.0, half * 2 - 8, outer - sgn * 0.1, PLATFORM_Y + 0.62, 0));
    steel.push(box(0.07, 0.07, half * 2 - 8, outer - sgn * 0.1, PLATFORM_Y + 1.14, 0));

    // ---- stair / lift cores at both ends ---------------------------------
    for (const zs of [-1, 1]) {
      const z = zs * (half - 15);
      // enclosure
      glass.push(box(2.5, 2.9, 4.2, sgn * 7.0, PLATFORM_Y + 1.6, z));
      steel.push(box(2.62, 0.1, 4.32, sgn * 7.0, PLATFORM_Y + 3.1, z));
      for (const [dx, dz] of [[-1.25, -2.05], [1.25, -2.05], [-1.25, 2.05], [1.25, 2.05]]) {
        steel.push(box(0.09, 2.95, 0.09, sgn * 7.0 + dx, PLATFORM_Y + 1.55, z + dz));
      }
      // shaft down to the concourse
      concrete.push(box(2.9, 4.6, 4.6, sgn * 7.0, -1.3, z));
      // lift tower above the canopy line
      concrete.push(box(2.2, 3.4, 2.4, sgn * 6.2, PLATFORM_Y + 4.6, z + 2.6));
    }
  }

  // ---- concourse / mezzanine below ---------------------------------------
  concrete.push(box(17.6, 0.45, 34, 0, -5.2, 0));
  for (const sgn of [-1, 1]) {
    for (const z of [-14, 0, 14]) {
      concrete.push(box(0.9, 5.0, 0.9, sgn * 7.6, -2.75, z));
    }
  }
  // stair flights through the concourse
  for (const sgn of [-1, 1]) {
    for (const zs of [-1, 1]) {
      const g = new THREE.BoxGeometry(2.0, 0.22, 12);
      g.rotateX(0.38);
      g.translate(sgn * 7.0, -1.4, zs * (half - 22));
      concreteDark.push(g);
    }
  }

  // ---- canopy -------------------------------------------------------------
  // HMRL's newer stations are a shallow segmented canopy: metal deck panels
  // crossing between long glazed skylight strips, carried on a single row of
  // median piers with V-shaped cantilever arms. That is a very different
  // silhouette from the old white barrel vault, and it is what the reference
  // photographs actually show.
  const halfW = PLATFORM_OUT + (low ? 0.5 : 1.7);
  const eave = PLATFORM_Y + (low ? 3.0 : 4.9);
  const apex = eave + (low ? 0.6 : 1.45);
  const bands = low
    ? [[-1, -0.4, 0], [-0.4, -0.16, 1], [-0.16, 0.16, 0], [0.16, 0.4, 1], [0.4, 1, 0]]
    : [
        [-1, -0.88, 0], [-0.88, -0.72, 1], [-0.72, -0.12, 0],
        [-0.12, 0.12, 1], [0.12, 0.72, 0], [0.72, 0.88, 1], [0.88, 1, 0],
      ];
  const stepsZ = low ? 8 : 14;
  for (const [f0, f1, glazed] of bands) {
    const g = canopyBand(f0 * halfW, f1 * halfW, halfW, eave, apex, -half, half, {
      stepsX: 2,
      stepsZ,
      u: Math.max(1, Math.round((f1 - f0) * 4)),
      v: low ? 12 : 24,
    });
    if (glazed) {
      glass.push(g);
      // A soft warm ribbon just beneath each skylight: invisible by day, and
      // at night it reads as platform lighting glowing through the roof.
      glow.push(canopyBand(f0 * halfW, f1 * halfW, halfW, eave, apex, -half, half, {
        stepsX: 1,
        stepsZ: 2,
        u: 1,
        v: 1,
        lift: -0.18,
      }));
    } else roof.push(g);
  }

  // Long glazing bars / purlins on every band edge, visible from underneath.
  for (const f of bands.map(([f0]) => f0).concat([1])) {
    const x = f * halfW;
    const y = canopyYAt(x, halfW, eave, apex);
    steel.push(box(0.09, 0.1, half * 2, x, y - 0.05, 0));
  }

  // Transverse ribs give the canopy its folded-plate rhythm.
  const ribStep = low ? 14 : 8;
  const xs = bands.map(([f0]) => f0).concat([1]);
  for (let z = -half + 2; z <= half - 2; z += ribStep) {
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i] * halfW;
      const xb = xs[i + 1] * halfW;
      const ya = canopyYAt(xa, halfW, eave, apex) - 0.12;
      const yb = canopyYAt(xb, halfW, eave, apex) - 0.12;
      steel.push(strut(xa, ya, z, xb, yb, z, low ? 0.09 : 0.12));
    }
  }
  // central spine under the crown, tying the ribs together
  steel.push(box(0.2, 0.26, half * 2 - 1, 0, apex - 0.28, 0));

  // Matching battens on top of the deck. They break the big roof plane into
  // bays, which is what makes the canopy read as folded metal from the air.
  for (let z = -half + 2; z <= half - 2; z += ribStep) {
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i] * halfW;
      const xb = xs[i + 1] * halfW;
      const ya = canopyYAt(xa, halfW, eave, apex) + 0.035;
      const yb = canopyYAt(xb, halfW, eave, apex) + 0.035;
      steel.push(strut(xa, ya, z, xb, yb, z, low ? 0.06 : 0.085));
    }
  }

  // eaves gutters and a warm exterior light line along each edge
  for (const sgn of [-1, 1]) {
    dark.push(box(0.26, 0.24, half * 2, sgn * halfW, eave - 0.02, 0));
    glow.push(box(0.12, 0.05, half * 2 - 2, sgn * (halfW + 0.12), eave + 0.08, 0));
  }
  // threshold light line where the platforms meet the open ends
  if (!low) {
    for (const zs of [-1, 1]) {
      glow.push(box(halfW * 1.55, 0.05, 0.05, 0, PLATFORM_Y + 0.02, zs * (half - 0.4)));
    }
  }

  // ---- median piers and cantilever arms ----------------------------------
  const colCount = low ? 4 : 7;
  const colBase = PLATFORM_Y - 1.8;
  const colTop = apex - 0.45;
  for (let i = 0; i <= colCount; i++) {
    const z = -half + 8 + ((half * 2 - 16) * i) / colCount;
    steel.push(box(0.44, colTop - colBase, 0.44, 0, (colTop + colBase) / 2, z));
    concrete.push(box(0.72, 0.4, 0.72, 0, PLATFORM_Y - 1.55, z));
    for (const sgn of [-1, 1]) {
      const xEnd = sgn * (low ? 4.8 : 5.8);
      const yEnd = canopyYAt(xEnd, halfW, eave, apex) - 0.26;
      steel.push(strut(0, colTop - 0.1, z, xEnd, yEnd, z, low ? 0.12 : 0.17));
      steel.push(strut(0, colTop - 0.95, z, xEnd * 0.96, yEnd - 0.03, z, low ? 0.08 : 0.11));
    }
    // cross tie under the arms, as on the real piers
    steel.push(box((low ? 4.8 : 5.8) * 2, 0.15, 0.15, 0, colTop - 1.05, z));
  }

  // ---- side screens -------------------------------------------------------
  // Continuous glass screens with steel mullions along the outer platform
  // edges, matching the wind screens on the real stations.
  for (const sgn of [-1, 1]) {
    const x = sgn * (PLATFORM_OUT + 0.02);
    glass.push(box(0.035, low ? 1.45 : 1.95, half * 2 - 12, x, PLATFORM_Y + (low ? 1.05 : 1.3), 0));
    steel.push(box(0.07, 0.07, half * 2 - 12, x, PLATFORM_Y + (low ? 1.8 : 2.3), 0));
    for (let z = -half + 7; z <= half - 7; z += 3.4) {
      steel.push(box(0.035, low ? 1.55 : 2.08, 0.055, x, PLATFORM_Y + (low ? 1.1 : 1.4), z));
    }
  }

  // ---- fascia, line colour and station name boards -----------------------
  // The fascia is a deep-blue enamel band running the whole platform, with the
  // name repeated along it. That band is the thing you recognise from the
  // street, so it carries the signage rather than a thin dark strip.
  const fasciaH = low ? 0.8 : 1.7;
  const fasciaY = eave - fasciaH / 2 + 0.06;
  for (const sgn of [-1, 1]) {
    const x = sgn * (halfW + 0.04);
    fascia.push(box(0.14, fasciaH, half * 2, x, fasciaY, 0));
    dark.push(box(0.19, 0.12, half * 2, x, fasciaY + fasciaH / 2 + 0.06, 0));
    line.push(box(0.17, 0.1, half * 2, x + sgn * 0.015, fasciaY - fasciaH / 2 + 0.05, 0));
  }

  const tex = makeSignTexture(st.name, route.color, {
    sub: `${route.name.toUpperCase()} · ${route.from} ↔ ${route.to}`,
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.25,
    roughness: 0.5,
    metalness: 0.05,
  });
  signMat.userData.sign = true;

  const boards = [];
  const addBoard = (w, h, x, y, z, rotY) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    boards.push(g);
  };
  // Name panels are sized to the 512 × 96 sign canvas so the lettering keeps
  // its proportions instead of stretching across the facade.
  const boardW = low ? 4.4 : 8;
  const boardH = low ? 0.66 : 1.5;
  const boardZ = low ? [-44, 0, 44] : [-56, -40, -24, -8, 8, 24, 40, 56];
  for (const sgn of [-1, 1]) {
    const x = sgn * (halfW + 0.13);
    const rotY = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const z of boardZ) addBoard(boardW, boardH, x, fasciaY, z, rotY);
  }
  // Portal signs at both ends, standing clear above the canopy crown. They face
  // along the track so an approaching set (and the chase camera) reads the
  // station name before the roof hides the side fascia.
  for (const end of [-1, 1]) {
    const z = end * (half + 0.1);
    const signH = low ? 0.9 : 1.5;
    const signY = apex + 0.45 + signH / 2;
    const signBottom = signY - signH / 2;
    const postH = signBottom - apex + 0.25;
    for (const px of [-4.6, 4.6]) {
      steel.push(box(0.1, postH, 0.1, px, apex - 0.15 + postH / 2, z - end * 0.25));
    }
    dark.push(box(low ? 9.6 : 12.6, signH + 0.18, 0.12, 0, signY, z - end * 0.16));
    addBoard(low ? 9.2 : 12.2, signH, 0, signY, z, end < 0 ? Math.PI : 0);
    line.push(box(low ? 9.7 : 12.7, 0.08, 0.14, 0, signBottom - 0.02, z - end * 0.15));
  }
  // Painted name plates lying on the crown, near each end. The chase camera
  // mostly looks down, so this is the view that actually identifies a station;
  // the vertical gantry signs cover the low approach.
  for (const zs of [-1, 1]) {
    const z = zs * (half - 8);
    const g = canopyBand(-4.4, 4.4, halfW, eave, apex, z - 0.8, z + 0.8, {
      stepsX: 4,
      stepsZ: 1,
      u: 1,
      v: 1,
      lift: 0.06,
    });
    if (zs < 0) {
      // The far plate's text has to run the other way so it reads upright when
      // approached from that end.
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
      uv.needsUpdate = true;
    }
    boards.push(g);
  }

  const signMesh = new THREE.Mesh(mergeGeometries(boards), signMat);
  signMesh.userData.keep = true;
  group.add(signMesh);
  boards.forEach((g) => g.dispose());

  // ---- service cores: enamel cladding ------------------------------------
  if (!low) {
    for (const sgn of [-1, 1]) {
      for (const zs of [-1, 1]) {
        const z = zs * (half - 15);
        const x = sgn * 8.3;
        accent.push(box(0.1, 2.7, 4.0, x, PLATFORM_Y + 1.55, z));
        accent.push(box(0.1, 2.7, 4.0, sgn * 5.7, PLATFORM_Y + 1.55, z));
        accent.push(box(2.6, 0.16, 4.1, sgn * 7.0, PLATFORM_Y + 2.98, z));
        line.push(box(0.11, 0.5, 4.02, sgn * 8.35, PLATFORM_Y + 0.4, z));
      }
    }
  }

  // ---- furniture ----------------------------------------------------------
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -46 + i * 30;
      const x = sgn * 6.1;
      // bench
      steel.push(box(0.55, 0.08, 2.1, x, PLATFORM_Y + 0.46, z));
      steel.push(box(0.08, 0.5, 2.1, x + sgn * 0.26, PLATFORM_Y + 0.7, z));
      for (const dz of [-0.85, 0.85]) dark.push(box(0.5, 0.42, 0.08, x, PLATFORM_Y + 0.22, z + dz));
      // bin
      dark.push(box(0.45, 0.85, 0.45, x, PLATFORM_Y + 0.45, z + 3.6));
      // PIDS
      if (i % 2 === 0) {
        dark.push(box(0.12, 0.85, 1.35, x, PLATFORM_Y + 2.35, z - 4.2));
        dark.push(box(0.09, 0.09, 1.0, x, PLATFORM_Y + 2.35, z - 4.2));
        screen.push(box(0.03, 0.62, 1.18, x + sgn * 0.07, PLATFORM_Y + 2.38, z - 4.2));
      }
    }
    // route map board
    dark.push(box(0.1, 1.5, 2.6, sgn * 7.5, PLATFORM_Y + 1.65, -18 * sgn));
    screen.push(box(0.03, 1.28, 2.36, sgn * 7.5 - sgn * 0.06, PLATFORM_Y + 1.65, -18 * sgn));

    // canopy lighting troughs
    glow.push(box(0.18, 0.08, half * 2 - 4, sgn * 5.4, eave - 0.06, 0));
    glow.push(box(0.16, 0.08, half * 2 - 4, sgn * 1.6, apex - 0.22, 0));
    // recessed downlights and platform-edge light poles
    for (let z = -half + 10; z <= half - 10; z += 12) {
      glow.push(box(0.44, 0.035, 0.13, sgn * 4.6, eave - 0.2, z));
      glow.push(box(0.44, 0.035, 0.13, sgn * 2.4, eave - 0.2, z + 6));
    }
    for (let z = -half + 16; z <= half - 16; z += 18) {
      glow.push(box(0.07, 1.75, 0.07, sgn * 7.75, PLATFORM_Y + 0.95, z));
      glow.push(box(0.34, 0.05, 0.2, sgn * 7.75, PLATFORM_Y + 1.82, z));
    }
    // entrance light lines at each end
    for (const zs of [-1, 1]) {
      const z = zs * (half - 15);
      glow.push(box(0.09, 2.5, 0.09, sgn * 8.4, PLATFORM_Y + 1.4, z + zs * 2.4));
    }
  }

  // ---- merge --------------------------------------------------------------
  const buckets = [
    [concrete, mats.concrete],
    [concreteDark, mats.concreteDark],
    [tile, mats.tile],
    [tactile, mats.tactile],
    [steel, mats.steel],
    [dark, mats.darkSteel],
    [roof, mats.roof],
    [glass, mats.glass],
    [line, mats.line],
    [accent, mats.accent],
    [fascia, mats.fascia],
    [glow, mats.glow],
    [screen, mats.screenMat],
  ];
  for (const [geoms, mat] of buckets) {
    if (!geoms.length) continue;
    const merged = mergeGeometries(geoms);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mat === mats.concrete || mat === mats.steel || mat === mats.roof;
    mesh.receiveShadow = mat !== mats.glass && mat !== mats.glow;
    group.add(mesh);
    geoms.forEach((g) => g.dispose());
  }

  // position in the world
  const p = route.getPoint(st.s);
  const t = route.getTangent(st.s);
  const right = new THREE.Vector3(t.z, 0, -t.x);
  const basis = new THREE.Matrix4().makeBasis(right, new THREE.Vector3(0, 1, 0), t);
  basis.setPosition(p.x, DECK_TOP + route.yAt(st.s), p.z);
  group.applyMatrix4(basis);
  group.matrixAutoUpdate = false;
  group.updateMatrixWorld(true);

  group.userData.station = st;
  group.userData.midS = st.s;
  return group;
}

export function buildStations(route, { anisotropy = 8, seen = null } = {}) {
  const mats = makeStationMaterials(route, anisotropy);
  const group = new THREE.Group();
  group.name = `stations-${route.id}`;
  const items = [];
  route.stations.forEach((st, i) => {
    // Interchanges are served by two lines but are one physical complex. The
    // upper corridor gets the tall hall, the crossing corridor gets a low one
    // tucked underneath it. Any other duplicate name is skipped.
    const duplicate = seen ? seen.has(st.name) : false;
    let g;
    if (duplicate && !st.interchange) {
      g = new THREE.Group();
      g.name = `station-${st.name}`;
      g.userData.station = st;
      g.userData.midS = st.s;
      g.userData.duplicateOf = st.name;
    } else {
      g = buildStation(route, st, mats, i, { low: st.level === 'lower' });
      if (seen) seen.add(st.name);
    }
    group.add(g);
    items.push(g);
  });
  const NIGHT_ROOF = new THREE.Color(0x1b2739);
  const NIGHT_CONCRETE = new THREE.Color(0x141b26);

  return {
    group,
    items,
    mats,
    setNight(night) {
      this.setNightFactor(night ? 1 : 0);
    },
    setNightFactor(k) {
      const t = THREE.MathUtils.clamp(k, 0, 1);
      mats.glow.opacity = 0.5 * t;
      mats.screenMat.emissiveIntensity = 0.5 + 1.4 * t;
      mats.glass.opacity = 0.22 - 0.06 * t;
      // Faint city bounce on the canopy so a hall reads as a lit object from
      // the air instead of a black hole in the street grid.
      mats.roof.emissive.setHex(0x000000).lerp(NIGHT_ROOF, t);
      mats.roof.emissiveIntensity = 0.55 * t;
      mats.concrete.emissive.setHex(0x000000).lerp(NIGHT_CONCRETE, t);
      mats.concrete.emissiveIntensity = 0.4 * t;
      for (const it of items) {
        it.traverse((o) => {
          if (o.material && o.material.userData.sign) {
            o.material.emissiveIntensity = 0.25 + 1.35 * t;
          }
        });
      }
    },
  };
}
