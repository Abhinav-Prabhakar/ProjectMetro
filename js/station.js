// ---------------------------------------------------------------------------
// Elevated stations
//
// Modelled on the real HMRL stations: a 140 m side-platform box under a
// shallow barrel canopy with a glazed crown, trusses spanning between edge
// columns, a white end fascia carrying the name and a clock, deep-blue side
// fascias, green enamel stair cores, and a street-level entrance hall with its
// own name panel under each end.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import {
  makeConcrete,
  makePlatformTile,
  makeTactile,
  makeSteel,
  makeRoofPanel,
  makeSignTexture,
} from './materials.js?v=20261108b';
import { mergeGeometries } from './geomutil.js?v=20261108b';
import { DECK_TOP } from './infrastructure.js?v=20261108b';

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
  return eave + (apex - eave) * Math.cos((t * Math.PI) / 2);
}

// Vertical band closing one end of the barrel. Built along the same arc as the
// roof so the fascia follows the canopy silhouette instead of cutting it off
// with a straight beam.
function canopyFascia(halfW, eave, apex, z, h, flip) {
  const pos = [];
  const uv = [];
  const ind = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const x = (-1 + (2 * i) / N) * halfW;
    const y = canopyYAt(x, halfW, eave, apex);
    pos.push(x, y, z, x, y - h, z);
    uv.push(i / N, 1, i / N, 0);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    if (flip) ind.push(a, c, b, b, c, d);
    else ind.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  return g;
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
    color: 0xecefed,
    roughness: 0.55,
    metalness: 0.08,
    envMapIntensity: 0.95,
    side: THREE.DoubleSide,
    // Smooth normals: the canopy is a barrel, and a faceted derivative normal
    // also stops the sun from reaching the deck (it follows the winding, not
    // the authored normal).
    flatShading: false,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xe4f0f5,
    roughness: 0.3,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    transmission: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.2,
  });
  const lineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(line.color),
    roughness: 0.42,
    metalness: 0.15,
  });
  // Enamel cladding on the stair / lift cores. The real stations pick out these
  // volumes in a deep green, which reads well against the grey canopy.
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x2f8f5c,
    roughness: 0.42,
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
  }

  // ---- concourse / mezzanine below ---------------------------------------
  concrete.push(box(17.6, 0.45, 34, 0, -5.2, 0));
  // Full-height station piers: they carry the platform box down to the street,
  // which is what makes the station read as a building rather than a floating
  // slab when the camera drops to street level.
  for (const sgn of [-1, 1]) {
    for (const z of [-52, -26, 0, 26, 52]) {
      concrete.push(box(1.0, 10.15, 1.0, sgn * 7.6, -5.33, z));
    }
  }

  // ---- canopy -------------------------------------------------------------
  // HMRL's canopy is a shallow barrel, not a folded plate: a continuous metal
  // deck drawn over a smooth arc, split by a glazed crown strip and carried on
  // transverse trusses that span between columns at the two platform edges.
  const halfW = PLATFORM_OUT + (low ? 0.5 : 1.7);
  const eave = PLATFORM_Y + (low ? 3.0 : 4.9);
  const rise = low ? 0.6 : 1.5;
  const apex = eave + rise;
  const overhang = low ? 0.7 : 1.5;
  const roofZ0 = -half - overhang;
  const roofZ1 = half + overhang;
  const roofY = (x) => canopyYAt(x, halfW, eave, apex);

  const bands = low
    ? [
        [-1, -0.62, 0], [-0.62, -0.3, 0], [-0.3, -0.1, 0],
        [-0.1, 0.1, 1], [0.1, 0.3, 0], [0.3, 0.62, 0], [0.62, 1, 0],
      ]
    : [
        [-1, -0.86, 0], [-0.86, -0.62, 0], [-0.62, -0.34, 0], [-0.34, -0.1, 0],
        [-0.1, 0.1, 1], [0.1, 0.34, 0], [0.34, 0.62, 0], [0.62, 0.86, 0], [0.86, 1, 0],
      ];
  const stepsZ = low ? 14 : 26;
  for (const [f0, f1, glazed] of bands) {
    const stepsX = Math.max(1, Math.round((f1 - f0) * (low ? 4 : 8)));
    const g = canopyBand(f0 * halfW, f1 * halfW, halfW, eave, apex, roofZ0, roofZ1, {
      stepsX,
      stepsZ,
      u: Math.max(1, Math.round((f1 - f0) * 4)),
      v: low ? 14 : 30,
    });
    if (glazed) {
      glass.push(g);
      // A soft warm ribbon just beneath the skylight: invisible by day, and at
      // night it reads as platform lighting glowing through the roof.
      glow.push(canopyBand(f0 * halfW, f1 * halfW, halfW, eave, apex, roofZ0, roofZ1, {
        stepsX: 1,
        stepsZ: 2,
        u: 1,
        v: 1,
        lift: -0.16,
      }));
    } else roof.push(g);
  }

  // Long purlins on every band edge, visible from underneath.
  for (const f of bands.map(([f0]) => f0).concat([1])) {
    const x = f * halfW;
    steel.push(box(0.085, 0.12, roofZ1 - roofZ0, x, roofY(x) - 0.06, 0));
  }

  // Transverse ribs follow the arc. They are the strongest thing you read from
  // under the canopy, and they give the barrel its scale.
  const ribStep = low ? 12 : 7.2;
  const ribFs = [];
  for (let i = 0; i <= 12; i++) ribFs.push(-1 + (2 * i) / 12);
  for (let z = roofZ0 + 0.9; z <= roofZ1 - 0.9; z += ribStep) {
    for (let i = 0; i < ribFs.length - 1; i++) {
      const xa = ribFs[i] * halfW;
      const xb = ribFs[i + 1] * halfW;
      steel.push(strut(xa, roofY(xa) - 0.14, z, xb, roofY(xb) - 0.14, z, low ? 0.075 : 0.105));
    }
    // batten on top of the deck, breaking the roof into bays from the air
    for (let i = 0; i < ribFs.length - 1; i++) {
      const xa = ribFs[i] * halfW;
      const xb = ribFs[i + 1] * halfW;
      steel.push(strut(xa, roofY(xa) + 0.035, z, xb, roofY(xb) + 0.035, z, low ? 0.05 : 0.07));
    }
  }
  // spine under the crown, tying the ribs together
  steel.push(box(0.18, 0.22, roofZ1 - roofZ0 - 0.6, 0, apex - 0.3, 0));

  // eaves gutters and a warm exterior light line along each edge
  for (const sgn of [-1, 1]) {
    dark.push(box(0.24, 0.24, roofZ1 - roofZ0, sgn * halfW, eave - 0.02, 0));
    glow.push(box(0.1, 0.05, roofZ1 - roofZ0 - 2, sgn * (halfW + 0.12), eave + 0.06, 0));
  }
  // threshold light line where the platforms meet the open ends
  if (!low) {
    for (const zs of [-1, 1]) {
      glow.push(box(halfW * 1.55, 0.05, 0.05, 0, PLATFORM_Y + 0.02, zs * (half - 0.4)));
    }
  }

  // ---- edge columns and transverse trusses --------------------------------
  // On the real stations the columns stand at the back edge of each platform
  // and lean inward onto the roof; the tracks stay completely clear.
  const colCount = low ? 4 : 9;
  const colBase = PLATFORM_Y;
  const colTop = eave - 0.72;
  const colX = PLATFORM_OUT - 0.55;
  for (let i = 0; i <= colCount; i++) {
    const z = -half + 7 + ((half * 2 - 14) * i) / colCount;
    for (const sgn of [-1, 1]) {
      const x = sgn * colX;
      steel.push(box(0.34, colTop - colBase, 0.34, x, (colTop + colBase) / 2, z));
      concrete.push(box(0.66, 0.26, 0.66, x, PLATFORM_Y + 0.12, z));
      const xEnd = sgn * (low ? 3.2 : 5.0);
      const yEnd = roofY(xEnd) - 0.3;
      steel.push(strut(x, colTop, z, xEnd, yEnd, z, low ? 0.12 : 0.17));
      steel.push(strut(x, colTop - 0.95, z, xEnd * 0.97, yEnd - 0.02, z, low ? 0.08 : 0.1));
      // knee brace from the column into the truss bottom chord
      steel.push(strut(x, colTop - 1.0, z, x + sgn * 0.6, colTop - 0.05, z, 0.1));
    }
    // the bottom chord of the transverse truss, kept clear above the train
    const tieY = eave - 0.42;
    steel.push(box(colX * 2 - 0.2, 0.13, 0.13, 0, tieY, z));
    for (const xs of [-3.0, 0, 3.0]) {
      const h = Math.max(0.2, roofY(xs) - 0.32 - tieY);
      steel.push(box(0.1, h, 0.1, xs, (roofY(xs) - 0.32 + tieY) / 2, z));
    }
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

  // ---- side fascia, line colour and station name boards -------------------
  // The fascia is a deep-blue enamel band running the whole platform, with the
  // name repeated along it. That band is the thing you recognise from the
  // street, so it carries the signage rather than a thin dark strip.
  const fasciaH = low ? 0.85 : 1.55;
  const fasciaY = eave - fasciaH / 2 + 0.08;
  const fasciaLen = roofZ1 - roofZ0;
  for (const sgn of [-1, 1]) {
    const x = sgn * (halfW + 0.04);
    fascia.push(box(0.14, fasciaH, fasciaLen, x, fasciaY, 0));
    dark.push(box(0.19, 0.12, fasciaLen, x, fasciaY + fasciaH / 2 + 0.06, 0));
    line.push(box(0.17, 0.1, fasciaLen, x + sgn * 0.015, fasciaY - fasciaH / 2 + 0.05, 0));
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
  // Small roundel clock, built from geometry so every station can carry one
  // without another texture or draw call.
  const addClock = (x, y, z, faceNeg, r) => {
    const disc = new THREE.CircleGeometry(r, 20);
    if (faceNeg) disc.rotateY(Math.PI);
    disc.translate(x, y, z);
    steel.push(disc);
    const ring = new THREE.RingGeometry(r * 0.82, r, 20, 1);
    if (faceNeg) ring.rotateY(Math.PI);
    ring.translate(x, y, z + (faceNeg ? -0.012 : 0.012));
    dark.push(ring);
    // warm halo so the clock stays legible at night
    const halo = new THREE.RingGeometry(r * 1.04, r * 1.32, 20, 1);
    if (faceNeg) halo.rotateY(Math.PI);
    halo.translate(x, y, z + (faceNeg ? -0.016 : 0.016));
    glow.push(halo);
    const zo = z + (faceNeg ? -0.022 : 0.022);
    for (const [len, ang, wide] of [[0.74, -0.42, 0.1], [0.5, 1.85, 0.13]]) {
      const hand = new THREE.BoxGeometry(r * wide, r * len, 0.012);
      hand.translate(0, r * len * 0.5 - r * 0.06, 0);
      hand.rotateZ(ang);
      hand.translate(x, y, zo);
      dark.push(hand);
    }
    const pin = new THREE.CylinderGeometry(r * 0.07, r * 0.07, 0.02, 8);
    pin.rotateX(Math.PI / 2);
    pin.translate(x, y, zo);
    dark.push(pin);
  };
  // Name panels are sized to the 512 × 96 sign canvas so the lettering keeps
  // its proportions instead of stretching across the facade.
  const boardW = low ? 4.4 : 8;
  const boardH = low ? 0.64 : 1.4;
  const boardZ = low ? [-44, 0, 44] : [-56, -40, -24, -8, 8, 24, 40, 56];
  for (const sgn of [-1, 1]) {
    const x = sgn * (halfW + 0.13);
    const rotY = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const z of boardZ) addBoard(boardW, boardH, x, fasciaY, z, rotY);
  }

  // ---- end fascia, name panel and clock -----------------------------------
  // Each end of the barrel is closed with a white fascia that follows the arc,
  // and the station name + clock are mounted on it facing the approaching set.
  const endFasciaH = low ? 0.95 : 1.35;
  const endSignW = low ? 6.2 : 7.6;
  const endSignH = low ? 0.6 : 0.92;
  const endSignY = apex - (low ? 0.62 : 0.78);
  for (const end of [-1, 1]) {
    const zf = end * (half + overhang);
    steel.push(canopyFascia(halfW, eave, apex, zf + end * 0.005, endFasciaH, end < 0));
    // warm line under the end fascia so the portal reads at night
    glow.push(box(endSignW, 0.05, 0.05, 0, apex - endFasciaH + 0.07, zf + end * 0.03));
    // backing, name board, underline and clock
    const zs = zf + end * 0.06;
    dark.push(box(endSignW + 0.24, endSignH + 0.14, 0.07, 0, endSignY, zs - end * 0.03));
    addBoard(endSignW, endSignH, 0, endSignY, zs, end < 0 ? Math.PI : 0);
    line.push(box(endSignW + 0.3, 0.06, 0.09, 0, endSignY - endSignH / 2 - 0.08, zs - end * 0.02));
    addClock(-(endSignW / 2 + (low ? 0.26 : 0.36) + 0.3), endSignY, zs + end * 0.01, end < 0, low ? 0.26 : 0.36);
  }

  // ---- station ends -------------------------------------------------------
  // The real ends are not blunt slabs: each platform is closed with a parapet,
  // the box gets a finished concrete end beam, and a street-level entrance hall
  // under the end carries the name panel and clock seen from the road.
  for (const end of [-1, 1]) {
    const w = PLATFORM_OUT - PLATFORM_IN;
    for (const sgn of [-1, 1]) {
      const x = sgn * ((PLATFORM_IN + PLATFORM_OUT) / 2);
      // platform end parapet + top rail
      concrete.push(box(w, 0.92, 0.28, x, PLATFORM_Y + 0.46, end * (half - 0.16)));
      steel.push(box(w, 0.05, 0.05, x, PLATFORM_Y + 0.95, end * (half - 0.16)));
      // finished concrete end beam under the slab
      concrete.push(box(w + 0.2, 0.95, 0.34, x, 0.5, end * (half + 0.02)));
    }
    // heavy piers under the platform ends
    for (const sgn of [-1, 1]) {
      const x = sgn * 6.6;
      concrete.push(box(1.3, 8.98, 1.3, x, -5.91, end * (half - 4.0)));
      concrete.push(box(1.95, 0.58, 1.7, x, -1.71, end * (half - 4.0)));
    }
    // street-level entrance hall under the end
    if (!low) {
      const zc = end * (half - 1.5);
      const zface = end * (half + 1.55);
      concrete.push(box(11.6, 6.6, 5.8, 0, -7.1, zc));
      // name band + clock at the top of the hall, facing along the track
      dark.push(box(11.0, 1.62, 0.22, 0, -4.6, zface + end * 0.02));
      addBoard(10.4, 1.36, 0, -4.6, zface + end * 0.12, end < 0 ? Math.PI : 0);
      addClock(-5.15, -4.6, zface + end * 0.12, end < 0, 0.42);
      // and a name panel on each flank so the end reads from the street side
      for (const sgn of [-1, 1]) {
        dark.push(box(0.18, 1.25, 4.6, sgn * 5.83, -4.6, zc));
        addBoard(4.4, 1.0, sgn * 5.93, -4.6, zc, sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      // entrance glazing, mullions and a shallow hood
      dark.push(box(9.2, 2.6, 0.14, 0, -8.0, zface + end * 0.02));
      glow.push(box(8.5, 2.1, 0.03, 0, -8.0, zface + end * 0.06));
      glass.push(box(8.6, 2.2, 0.06, 0, -8.0, zface + end * 0.1));
      for (const x of [-4.3, -2.15, 0, 2.15, 4.3]) {
        steel.push(box(0.1, 2.4, 0.08, x, -8.0, zface + end * 0.14));
      }
      concrete.push(box(10.2, 0.32, 1.5, 0, -6.45, zface + end * 0.66));
      // night lighting: under the name band, under the hood, and in the lobby
      glow.push(box(10.4, 0.06, 0.05, 0, -5.42, zface + end * 0.03));
      glow.push(box(10.0, 0.05, 0.05, 0, -6.28, zface + end * 1.4));
    }
  }

  // Painted name plates lying on the crown, near each end. The chase camera
  // mostly looks down, so this is the view that actually identifies a station.
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

  // ---- green enamel stair / lift cores -----------------------------------
  // At each platform end, right under the canopy: the bright green volume you
  // see closing the platform in every HMRL end photograph.
  for (const sgn of [-1, 1]) {
    for (const zs of [-1, 1]) {
      const z = zs * (half - (low ? 8 : 5.2));
      const x = sgn * 6.3;
      const h = low ? 2.3 : 2.95;
      accent.push(box(3.45, h, 2.6, x, PLATFORM_Y + h / 2, z));
      // white capping band and hood over the stair mouth
      steel.push(box(3.6, 0.2, 2.76, x, PLATFORM_Y + h + 0.08, z));
      steel.push(box(3.1, 0.16, 1.2, x + sgn * 0.16, PLATFORM_Y + h + 0.1, z - zs * 1.7));
      // dark door on the platform side + enamel kick plate
      dark.push(box(1.2, 2.1, 0.08, x, PLATFORM_Y + 1.08, z - zs * 1.33));
      line.push(box(3.49, 0.36, 2.64, x, PLATFORM_Y + 0.21, z));
      // clock on the face the platform reads
      addClock(x - sgn * 0.55, PLATFORM_Y + h - 0.7, z - zs * 1.34, zs > 0, 0.31);
      // lit edge under the white cap, so the green core reads at night
      glow.push(box(3.35, 0.05, 0.06, x, PLATFORM_Y + h - 0.03, z + zs * 1.31));
      glow.push(box(3.35, 0.05, 0.06, x, PLATFORM_Y + h - 0.03, z - zs * 1.31));
      // shaft down to the concourse
      concrete.push(box(3.1, 4.8, 2.6, x, -2.4, z));
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

    // canopy lighting troughs, hung under the arc
    glow.push(box(0.18, 0.08, half * 2 - 4, sgn * 5.4, roofY(sgn * 5.4) - 0.34, 0));
    glow.push(box(0.16, 0.08, half * 2 - 4, sgn * 1.6, roofY(sgn * 1.6) - 0.22, 0));
    // recessed downlights and platform-edge light poles
    for (let z = -half + 10; z <= half - 10; z += 12) {
      glow.push(box(0.44, 0.035, 0.13, sgn * 4.6, roofY(sgn * 4.6) - 0.28, z));
      glow.push(box(0.44, 0.035, 0.13, sgn * 2.4, roofY(sgn * 2.4) - 0.28, z + 6));
    }
    for (let z = -half + 16; z <= half - 16; z += 18) {
      glow.push(box(0.07, 1.75, 0.07, sgn * 7.75, PLATFORM_Y + 0.95, z));
      glow.push(box(0.34, 0.05, 0.2, sgn * 7.75, PLATFORM_Y + 1.82, z));
    }
    // entrance light lines at each end
    for (const zs of [-1, 1]) {
      const z = zs * (half - 6.2);
      glow.push(box(0.09, 2.5, 0.09, sgn * 8.0, PLATFORM_Y + 1.4, z + zs * 2.4));
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
  const NIGHT_ROOF = new THREE.Color(0x18212c);
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
      mats.glass.opacity = 0.5 - 0.22 * t;
      // Faint city bounce on the canopy so a hall reads as a lit object from
      // the air instead of a black hole in the street grid.
      mats.roof.emissive.setHex(0x000000).lerp(NIGHT_ROOF, t);
      mats.roof.emissiveIntensity = 0.22 * t;
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
