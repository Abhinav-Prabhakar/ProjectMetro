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
} from './materials.js?v=20261105h';
import { mergeGeometries } from './geomutil.js?v=20261105h';
import { DECK_TOP } from './infrastructure.js?v=20261105h';

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

// arched canopy surface, x across the station, z along it
function archSurface(halfW, eaveY, apexY, z0, z1, { stepsX = 20, stepsZ = 6, lift = 0 } = {}) {
  const pos = [];
  const uv = [];
  const ind = [];
  for (let iz = 0; iz <= stepsZ; iz++) {
    const z = z0 + ((z1 - z0) * iz) / stepsZ;
    for (let ix = 0; ix <= stepsX; ix++) {
      const x = -halfW + (2 * halfW * ix) / stepsX;
      const k = 1 - (x / halfW) ** 2;
      const y = eaveY + (apexY - eaveY) * k + lift;
      pos.push(x, y, z);
      uv.push(ix / stepsX, iz / stepsZ);
    }
  }
  for (let iz = 0; iz < stepsZ; iz++) {
    for (let ix = 0; ix < stepsX; ix++) {
      const a = iz * (stepsX + 1) + ix;
      const b = a + 1;
      const c = a + stepsX + 1;
      const d = c + 1;
      // Winding is reversed so the top face is front-facing in the map's
      // projection (which mirrors screen Y). Normals are restored to +Y below
      // so the surface is lit correctly from above.
      ind.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  // Flipping the winding also flipped the generated normals; put them back
  // outward so the sun, sky and environment all see a roof.
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) {
    nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  }
  nor.needsUpdate = true;
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
    color: 0x9ba4a3,
    roughness: 0.52,
    metalness: 0.06,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
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
    concrete, concreteDark, tile, tactile, steel, darkSteel, roof, glass, line: lineMat, glow, screenMat,
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

  // ---- columns and cross bracing -----------------------------------------
  const eave = PLATFORM_Y + (low ? 2.75 : 4.55);
  const apex = PLATFORM_Y + (low ? 3.95 : 7.55);
  const halfW = PLATFORM_OUT + (low ? 0.55 : 1.85);
  const colTop = eave + 0.1;
  const colH = colTop - PLATFORM_Y;
  const bays = low ? 6 : 9;
  for (let i = 0; i <= bays; i++) {
    const z = -half + 6 + ((half * 2 - 12) * i) / bays;
    for (const sgn of [-1, 1]) {
      const x = sgn * (PLATFORM_OUT - 0.65);
      steel.push(box(0.3, colH, 0.3, x, PLATFORM_Y + colH / 2, z));
      // tapered foot
      concrete.push(box(0.55, 0.35, 0.55, x, PLATFORM_Y + 0.17, z));
      // diagonal brace every other bay
      if (i < bays) {
        const g = new THREE.BoxGeometry(0.11, 0.11, 4.6);
        g.rotateX(0.62);
        g.translate(x, PLATFORM_Y + colH * 0.78, z + 4.2);
        steel.push(g);
      }
    }
    steel.push(box(PLATFORM_OUT * 2 - 1.3, 0.26, 0.26, 0, colTop, z));
  }

  // longitudinal edge beams
  for (const sgn of [-1, 1]) {
    steel.push(box(0.2, 0.3, half * 2, sgn * (PLATFORM_OUT - 0.65), colTop + 0.13, 0));
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

  // ---- canopy -------------------------------------------------------------
  // The real HMRL canopy is a deep barrel vault made of paired curved panels
  // with a glazed crown and heavy ribs showing underneath. The lower platform
  // of a stacked interchange gets a shallower version so it clears the deck
  // above it.
  const ridge = low ? 0 : 2.35;
  roof.push(scaleUV(archSurface(halfW, eave, apex, -half, half, { stepsX: 28, stepsZ: 16 }), 2.4, 22));
  // raised central spine with dark louvres, as on the real vault
  if (!low) {
    roof.push(box(1.7, 0.3, half * 2, 0, apex + 0.2, 0));
    dark.push(box(1.36, 0.06, half * 2 - 2, 0, apex + 0.37, 0));
    for (const sgn of [-1, 1]) {
      dark.push(box(0.07, 0.12, half * 2 - 2, sgn * 0.72, apex + 0.34, 0));
    }
  }
  // eaves gutters and a warm exterior light line along each edge
  for (const sgn of [-1, 1]) {
    dark.push(box(0.24, 0.22, half * 2, sgn * halfW, eave - 0.06, 0));
    glow.push(box(0.12, 0.05, half * 2 - 2, sgn * (halfW + 0.1), eave + 0.04, 0));
  }
  // A thin lit ridge on the crown: the one line that reads from directly
  // above, so a station is legible from the chase camera at night.
  glow.push(box(0.22, 0.06, half * 2 - 3, 0, apex + 0.43, 0));
  // threshold light line where the platforms meet the open ends
  if (!low) {
    for (const zs of [-1, 1]) {
      glow.push(box(halfW * 1.55, 0.05, 0.05, 0, PLATFORM_Y + 0.02, zs * (half - 0.4)));
    }
  }
  if (ridge) {
    glass.push(
      archSurface(ridge, eave + 0.1, apex + 0.1, -half + 1, half - 1, {
        stepsX: 5,
        stepsZ: 14,
        lift: 0.02,
      })
    );
    // glazed crown rails
    for (const sgn of [-1, 1]) {
      steel.push(box(0.09, 0.14, half * 2 - 2, sgn * ridge, apex + 0.06, 0));
    }
  }

  // deep arch ribs + longitudinal purlins
  const ribCount = low ? 8 : 13;
  const ribR = low ? 0.09 : 0.145;
  for (let i = 0; i <= ribCount; i++) {
    const z = -half + (half * 2 * i) / ribCount;
    const pts = [];
    for (let k = 0; k <= 22; k++) {
      const x = -halfW + (2 * halfW * k) / 22;
      const y = eave + (apex - eave) * (1 - (x / halfW) ** 2);
      pts.push(new THREE.Vector3(x, y + 0.16, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    steel.push(new THREE.TubeGeometry(curve, 26, ribR, 6, false));
    if (!low) {
      // thin lower chord gives the rib its I-beam depth
      const lower = pts.map((p) => new THREE.Vector3(p.x, p.y - 0.34, p.z));
      steel.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lower), 26, 0.045, 4, false));
    }
  }
  // purlins run the length of the vault just under the panels
  for (const f of low ? [-0.62, 0, 0.62] : [-0.86, -0.5, 0, 0.5, 0.86]) {
    const x = halfW * f;
    const y = eave + (apex - eave) * (1 - f * f) - 0.06;
    steel.push(box(0.08, 0.1, half * 2, x, y, 0));
  }

  // fascia + name boards (merged: two meshes per station, not six)
  const signMat = {};
  for (const sgn of [-1, 1]) {
    const x = sgn * (halfW + 0.02);
    dark.push(box(0.16, low ? 0.48 : 0.72, half * 2, x, eave - 0.2, 0));
    line.push(box(0.18, 0.12, half * 2, x + sgn * 0.02, eave - (low ? 0.5 : 0.62), 0));

    const tex = makeSignTexture(st.name, route.color, { sub: `${route.name.toUpperCase()} · ${route.from} ↔ ${route.to}` });
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
      roughness: 0.5,
      metalness: 0.05,
    });
    mat.userData.sign = true;
    signMat[sgn] = mat;

    const boards = [];
    const addBoard = (w, h, z) => {
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.translate(x + sgn * 0.09, eave - 0.36, z);
      boards.push(g);
    };
    addBoard(9.2, 1.15, 0);
    addBoard(4.2, 0.72, -(half - 12));
    addBoard(4.2, 0.72, half - 12);
    const mesh = new THREE.Mesh(mergeGeometries(boards), mat);
    mesh.userData.keep = true;
    group.add(mesh);
    boards.forEach((g) => g.dispose());
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
