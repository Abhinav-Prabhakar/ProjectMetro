import * as THREE from 'three';
import { VIADUCT, TRAIN, COLORS } from './config.js?v=20261105l';

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function concreteTexture(anisotropy = 8) {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#d7d3c8');
  grad.addColorStop(0.5, '#cbc7bc');
  grad.addColorStop(1, '#c1bdb2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    const v = 130 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v - 6},${0.04 + Math.random() * 0.1})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 20 + Math.random() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(96,92,84,0.1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // panel joint
  g.fillStyle = 'rgba(90,88,80,0.28)';
  g.fillRect(0, 254, 512, 2);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(0, 256, 512, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

function trackbedTexture(anisotropy = 8) {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#6e7070';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 82 + Math.random() * 82;
    g.fillStyle = `rgba(${v},${v - 2},${v - 8},${0.16 + Math.random() * 0.2})`;
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    g.fillRect(x, y, 1 + Math.random() * 2.2, 1 + Math.random() * 2.2);
  }
  // concrete sleepers, one every 0.65 m along the track
  for (let y = 10; y < 512; y += 64) {
    g.fillStyle = 'rgba(52,51,47,0.9)';
    g.fillRect(4, y, 504, 22);
    g.fillStyle = 'rgba(176,171,158,0.26)';
    g.fillRect(4, y, 504, 2.5);
    g.fillStyle = 'rgba(18,18,16,0.5)';
    g.fillRect(4, y + 20, 504, 2);
    // fastening pads
    for (const x of [98, 214, 298, 414]) {
      g.fillStyle = 'rgba(30,30,28,0.65)';
      g.fillRect(x - 9, y + 2, 18, 18);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

function ribbonGeometry(route, latA, latB, y, { step = 2, vScale = 0.12 } = {}) {
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
    pos.push(p.x + nx * latA, y, p.z + nz * latA);
    pos.push(p.x + nx * latB, y, p.z + nz * latB);
    uv.push(0, s * vScale, 1, s * vScale);
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

function sweepGeometry(route, profile, { yBase = 0, step = 2, vScale = 0.2, uScale = 1 } = {}) {
  const N = route.points.length;
  const segs = profile.length - 1;
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
    for (let j = 0; j < profile.length; j++) {
      const [lat, y] = profile[j];
      pos.push(p.x + nx * lat, yBase + y, p.z + nz * lat);
      uv.push((j / segs) * uScale, s * vScale);
    }
    if (k > 0) {
      const base = (k - 1) * profile.length;
      const cur = k * profile.length;
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

function stationSignTexture(name, code) {
  const c = canvas2d(1024, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#0a3f78';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#0b5fae';
  g.fillRect(0, 0, 1024, 18);
  g.fillStyle = '#0aa06a';
  g.fillRect(0, 238, 1024, 18);
  g.fillStyle = '#ffffff';
  g.font = '600 96px Inter, Helvetica, Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), 64, 132);
  g.font = '500 34px "JetBrains Mono", monospace';
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillText(`BLUE LINE  ·  ${code}`, 68, 210);
  // metro mark
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(930, 128, 54, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(910, 100);
  g.lineTo(910, 156);
  g.moveTo(950, 100);
  g.lineTo(950, 156);
  g.moveTo(910, 128);
  g.lineTo(950, 128);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function platformTexture(anisotropy = 8) {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#5b6265';
  g.fillRect(0, 0, 512, 512);
  // polished granite tiles, 4 x 4 per texture
  const n = 4;
  const cell = 512 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 82 + Math.random() * 26;
      g.fillStyle = `rgb(${v},${v + 4},${v + 6})`;
      g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
      // speckle
      for (let k = 0; k < 90; k++) {
        const a = 0.02 + Math.random() * 0.08;
        g.fillStyle = Math.random() > 0.4
          ? `rgba(225,232,234,${a})`
          : `rgba(22,27,29,${a})`;
        g.fillRect(i * cell + Math.random() * cell, j * cell + Math.random() * cell, 1.6, 1.6);
      }
      // soft sheen band
      const gr = g.createLinearGradient(i * cell, j * cell, i * cell + cell, j * cell + cell);
      gr.addColorStop(0, 'rgba(255,255,255,0.05)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.04)');
      g.fillStyle = gr;
      g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
    }
  }
  // grout
  g.strokeStyle = 'rgba(28,32,34,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i * cell); g.lineTo(512, i * cell); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

function stationRoofTexture(anisotropy = 8) {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#dde5e8';
  g.fillRect(0, 0, 512, 512);
  // long panels between purlins
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = 'rgba(120,132,136,0.22)';
    g.fillRect(x, 0, 1.5, 512);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 2, 0, 1, 512);
  }
  // transverse ribs
  for (let y = 0; y < 512; y += 85) {
    g.fillStyle = 'rgba(96,108,112,0.3)';
    g.fillRect(0, y, 512, 2.4);
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(0, y + 3, 512, 1.2);
  }
  // light grime
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(90,102,104,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 40, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

export function buildViaduct(route, { anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'viaduct';

  const concrete = concreteTexture(anisotropy);
  concrete.repeat.set(1, 1);
  const asphalt = trackbedTexture(anisotropy);

  const deckMat = new THREE.MeshStandardMaterial({
    map: concrete,
    color: 0xdad7cd,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const parapetMat = new THREE.MeshStandardMaterial({
    map: concrete,
    color: 0xe7e3d9,
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const copingMat = new THREE.MeshStandardMaterial({ color: 0xe2ded4, roughness: 0.72, side: THREE.DoubleSide });
  const slabMat = new THREE.MeshStandardMaterial({
    map: asphalt,
    color: 0x9fa1a0,
    roughness: 0.97,
    metalness: 0.01,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xc6cacb,
    metalness: 0.94,
    roughness: 0.22,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
    flatShading: false,
  });
  const pierMat = new THREE.MeshStandardMaterial({
    map: concrete,
    color: 0xc7c3b8,
    roughness: 0.92,
    metalness: 0.02,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x5f6767, roughness: 0.58, metalness: 0.55 });

  const W = VIADUCT.deckWidth / 2;
  const top = VIADUCT.deckTop;
  const thick = VIADUCT.deckThickness;

  // ---- deck ---------------------------------------------------------------
  const deck = new THREE.Mesh(
    sweepGeometry(
      route,
      [
        [-W, 0],
        [-W, -thick],
        [W, -thick],
        [W, 0],
      ],
      { yBase: top, step: 3, vScale: 0.08 }
    ),
    deckMat
  );
  deck.receiveShadow = true;
  group.add(deck);

  // dark ballastless slab under each track
  for (const lat of [-VIADUCT.trackOffset, VIADUCT.trackOffset]) {
    const slab = new THREE.Mesh(
      ribbonGeometry(route, lat - 1.55, lat + 1.55, top + 0.02, { step: 3, vScale: 0.18 }),
      slabMat
    );
    group.add(slab);
  }

  // raised walkway between the two running tracks
  const walkway = new THREE.Mesh(
    ribbonGeometry(route, -0.92, 0.92, top + 0.26, { step: 3, vScale: 0.25 }),
    new THREE.MeshStandardMaterial({ map: concrete, color: 0xbfbcb2, roughness: 0.9 })
  );
  walkway.receiveShadow = true;
  group.add(walkway);
  for (const sgn of [-1, 1]) {
    const kerb = new THREE.Mesh(
      sweepGeometry(
        route,
        [
          [sgn * 0.92, 0.02],
          [sgn * 0.92, 0.27],
          [sgn * 1.06, 0.27],
          [sgn * 1.06, 0.02],
        ],
        { yBase: top, step: 3, vScale: 0.3 }
      ),
      new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.85, side: THREE.DoubleSide })
    );
    group.add(kerb);
  }

  // longitudinal cable troughs
  for (const [a, b] of [
    [-W + 0.55, -W + 0.85],
    [W - 0.85, W - 0.55],
  ]) {
    const trough = new THREE.Mesh(
      sweepGeometry(
        route,
        [
          [a, 0.02],
          [a, 0.24],
          [b, 0.24],
          [b, 0.02],
        ],
        { yBase: top, step: 4, vScale: 0.3 }
      ),
      new THREE.MeshStandardMaterial({ color: 0xa9a69b, roughness: 0.85, side: THREE.DoubleSide })
    );
    group.add(trough);
  }

  // ---- parapets -----------------------------------------------------------
  for (const sgn of [-1, 1]) {
    const a = sgn * W;
    const b = sgn * (W - VIADUCT.parapetWidth);
    const wall = new THREE.Mesh(
      sweepGeometry(
        route,
        [
          [a, 0],
          [a, VIADUCT.parapetHeight],
          [b, VIADUCT.parapetHeight],
          [b, 0],
        ],
        { yBase: top, step: 3, vScale: 0.35 }
      ),
      parapetMat
    );
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const cap = new THREE.Mesh(
      sweepGeometry(
        route,
        [
          [a - sgn * 0.045, VIADUCT.parapetHeight],
          [a - sgn * 0.045, VIADUCT.parapetHeight + 0.09],
          [b + sgn * 0.04, VIADUCT.parapetHeight + 0.09],
          [b + sgn * 0.04, VIADUCT.parapetHeight],
        ],
        { yBase: top, step: 3, vScale: 0.35 }
      ),
      copingMat
    );
    group.add(cap);
  }

  // ---- parapet panel joints ----------------------------------------------
  {
    const spacing = 3.6;
    const nSeg = Math.floor(route.length / spacing);
    const jointGeo = new THREE.BoxGeometry(0.035, VIADUCT.parapetHeight - 0.06, 0.055);
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x9d9a90,
      roughness: 0.95,
      metalness: 0.0,
    });
    const joints = new THREE.InstancedMesh(jointGeo, jointMat, nSeg * 2);
    const jm = new THREE.Matrix4();
    const jq = new THREE.Quaternion();
    const jv = new THREE.Vector3();
    const jone = new THREE.Vector3(1, 1, 1);
    let ji = 0;
    for (let k = 1; k < nSeg; k++) {
      const sPos = k * spacing;
      const p = route.getPoint(sPos);
      const t = route.getTangent(sPos);
      const yaw = Math.atan2(t.x, t.z);
      jq.setFromEuler(new THREE.Euler(0, yaw, 0));
      for (const sgn of [-1, 1]) {
        jv.set(
          p.x + t.z * sgn * (W - 0.02),
          top + (VIADUCT.parapetHeight - 0.06) / 2,
          p.z - t.x * sgn * (W - 0.02)
        );
        jm.compose(jv, jq, jone);
        joints.setMatrixAt(ji++, jm);
      }
    }
    joints.count = ji;
    group.add(joints);
  }

  // ---- rails --------------------------------------------------------------
  const railProfile = [
    [-0.07, 0],
    [0.07, 0],
    [0.07, -0.028],
    [0.022, -0.045],
    [0.022, -0.12],
    [0.075, -0.14],
    [0.075, -0.18],
    [-0.075, -0.18],
    [-0.075, -0.14],
    [-0.022, -0.12],
    [-0.022, -0.045],
    [-0.07, -0.028],
  ];
  const railGroup = new THREE.Group();
  for (const lat of [-VIADUCT.trackOffset, VIADUCT.trackOffset]) {
    for (const side of [-0.7175, 0.7175]) {
      const rail = new THREE.Mesh(
        sweepGeometry(
          route,
          railProfile.map(([l, y]) => [l + lat + side, y]),
          { yBase: VIADUCT.railTop, step: 2, vScale: 1 }
        ),
        railMat
      );
      rail.castShadow = true;
      railGroup.add(rail);
    }
  }
  group.add(railGroup);

  // ---- piers --------------------------------------------------------------
  const pierSpacing = 32;
  const pierCount = Math.floor(route.length / pierSpacing);
  const colGeo = new THREE.CylinderGeometry(0.95, 1.2, top - thick - 0.9, 10);
  colGeo.translate(0, (top - thick - 0.9) / 2, 0);
  const capGeo = new THREE.BoxGeometry(8.8, 0.85, 2.5);
  const footGeo = new THREE.CylinderGeometry(1.9, 2.2, 0.9, 12);
  const cols = new THREE.InstancedMesh(colGeo, pierMat, pierCount);
  const caps = new THREE.InstancedMesh(capGeo, pierMat, pierCount);
  const feet = new THREE.InstancedMesh(footGeo, pierMat, pierCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < pierCount; i++) {
    const s = 16 + i * pierSpacing;
    const p = route.getPoint(s);
    const t = route.getTangent(s);
    q.setFromUnitVectors(Z, t);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
    cols.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, top - thick - 0.42, p.z), q, one);
    caps.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, 0.45, p.z), q, one);
    feet.setMatrixAt(i, m4);
  }
  for (const m of [cols, caps, feet]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // ---- catenary masts -----------------------------------------------------
  const mastSpacing = 46;
  const mastCount = (Math.ceil(route.length / mastSpacing) + 4) * 2;
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7.4, 8);
  poleGeo.translate(0, 3.7, 0);
  const armGeo = new THREE.BoxGeometry(2.9, 0.09, 0.09);
  armGeo.translate(-1.45, 0, 0);
  const poles = new THREE.InstancedMesh(poleGeo, steelMat, mastCount);
  const arms = new THREE.InstancedMesh(armGeo, steelMat, mastCount);
  let mi = 0;
  for (let s = 24; s < route.length - 10; s += mastSpacing) {
    // the station canopy carries the contact wire, so no masts there
    if (route.stations.some((st) => Math.abs(st.s - s) < 56)) continue;
    const p = route.getPoint(s);
    const t = route.getTangent(s);
    const nx = t.z;
    const nz = -t.x;
    const yaw = Math.atan2(t.x, t.z);
    for (const sgn of [-1, 1]) {
      const x = p.x + nx * sgn * (W - 0.55);
      const z = p.z + nz * sgn * (W - 0.55);
      m4.compose(new THREE.Vector3(x, top, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), one);
      poles.setMatrixAt(mi, m4);
      m4.compose(
        new THREE.Vector3(x, top + 6.4, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + (sgn > 0 ? 0 : Math.PI), 0)),
        one
      );
      arms.setMatrixAt(mi, m4);
      mi++;
    }
  }
  poles.count = mi;
  arms.count = mi;
  group.add(poles);
  group.add(arms);

  // ---- overhead contact wires --------------------------------------------
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x242928,
    transparent: true,
    opacity: 0.72,
  });
  const messengerMat = new THREE.LineBasicMaterial({
    color: 0x3a403e,
    transparent: true,
    opacity: 0.5,
  });
  for (const lat of [-VIADUCT.trackOffset, VIADUCT.trackOffset]) {
    const contact = [];
    const messenger = [];
    for (let i = 0; i < route.points.length; i += 4) {
      const p = route.points[i];
      const t = route.tangents[i];
      const x = p.x + t.z * lat;
      const z = p.z - t.x * lat;
      contact.push(new THREE.Vector3(x, top + 5.4, z));
      messenger.push(new THREE.Vector3(x, top + 6.15, z));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(contact), wireMat));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(messenger), messengerMat));
  }

  // ---- station structures -------------------------------------------------
  const stationGroup = new THREE.Group();
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe9edee, roughness: 0.48, metalness: 0.24 });
  const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0x0b5fae, roughness: 0.5, metalness: 0.25 });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c2, roughness: 0.55, metalness: 0.35 });
  const skyMat = new THREE.MeshStandardMaterial({
    color: 0xbfe2ee,
    emissive: 0x77b7d2,
    emissiveIntensity: 0.35,
    roughness: 0.22,
    metalness: 0.1,
  });
  const soffitMat = new THREE.MeshStandardMaterial({ color: 0x6d7678, roughness: 0.82, metalness: 0.08 });
  const platformMap = platformTexture(anisotropy);
  platformMap.repeat.set(1.6, 46);
  const platformMat = new THREE.MeshStandardMaterial({
    map: platformMap,
    color: 0xdfe4e4,
    roughness: 0.4,
    metalness: 0.08,
  });
  const tactileMat = new THREE.MeshStandardMaterial({ color: 0xd9b53c, roughness: 0.8 });

  const colList = [];
  const legList = [];
  for (const st of route.stations) {
    const p = route.getPoint(st.s);
    const t = route.getTangent(st.s);
    const yaw = Math.atan2(t.x, t.z);
    const g = new THREE.Group();
    g.position.set(p.x, top, p.z);
    g.rotation.y = yaw;

    for (const sgn of [-1, 1]) {
      const platform = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.92, 112), platformMat);
      platform.position.set(sgn * 5.55, 0.46, 0);
      g.add(platform);

      const tactile = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 112), tactileMat);
      tactile.position.set(sgn * 4.18, 0.935, 0);
      g.add(tactile);

      // painted safety line at the platform edge
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.02, 112),
        new THREE.MeshStandardMaterial({ color: 0xe4e0d4, roughness: 0.7 })
      );
      edge.position.set(sgn * 3.98, 0.925, 0);
      g.add(edge);
    }

    // ---- platform canopies ------------------------------------------------
    // Flat ribbed roofs over each platform, carried on a single row of columns
    // down the platform centreline. The middle of the station stays open above
    // the running lines so the set is always visible from the chase camera.
    const CAN_W = 3.4;
    const CAN_L = 88;
    const SKY_W = 0.86;
    const CAN_Y = 6.3;
    const roofMap = stationRoofTexture(anisotropy);
    roofMap.repeat.set(1, 22);
    const roofMat = new THREE.MeshStandardMaterial({
      map: roofMap,
      color: 0xa8c4ce,
      roughness: 0.32,
      metalness: 0.62,
      envMapIntensity: 1.1,
    });
    for (const sgn of [-1, 1]) {
      const cx = sgn * 6.1;
      const panelW = (CAN_W - SKY_W) / 2;

      // shallow gable: two panels rise to a skylit ridge over the platform
      for (const pnl of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.09, CAN_L), roofMat);
        panel.position.set(
          cx + pnl * (SKY_W / 2 + panelW / 2),
          CAN_Y + 0.17 - Math.abs(pnl) * 0.0,
          0
        );
        panel.rotation.z = -pnl * 0.075;
        panel.castShadow = true;
        panel.receiveShadow = true;
        g.add(panel);
      }

      // skylight down the ridge
      const sky = new THREE.Mesh(new THREE.BoxGeometry(SKY_W, 0.03, CAN_L), skyMat);
      sky.position.set(cx, CAN_Y + 0.245, 0);
      g.add(sky);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, CAN_L), ribMat);
      ridge.position.set(cx, CAN_Y + 0.27, 0);
      g.add(ridge);

      // purlins across the canopy
      for (let zz = -CAN_L / 2 + 4; zz <= CAN_L / 2; zz += 5.5) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(CAN_W, 0.04, 0.075), ribMat);
        rib.position.set(cx, CAN_Y + 0.16, zz);
        g.add(rib);
      }

      // dark soffit under the canopy
      const soffit = new THREE.Mesh(
        new THREE.BoxGeometry(CAN_W - 0.1, 0.05, CAN_L - 0.1),
        soffitMat
      );
      soffit.position.set(cx, CAN_Y + 0.07, 0);
      g.add(soffit);

      // blue fascias at both eaves
      for (const e of [-1, 1]) {
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, CAN_L), roofTrimMat);
        fascia.position.set(cx + e * (CAN_W / 2 - 0.05), CAN_Y - 0.02, 0);
        g.add(fascia);

        const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, CAN_L), ribMat);
        gutter.position.set(cx + e * (CAN_W / 2 + 0.05), CAN_Y + 0.1, 0);
        g.add(gutter);
      }
      for (const zEnd of [-CAN_L / 2, CAN_L / 2]) {
        const endFascia = new THREE.Mesh(new THREE.BoxGeometry(CAN_W, 0.48, 0.13), roofTrimMat);
        endFascia.position.set(cx, CAN_Y - 0.02, zEnd);
        g.add(endFascia);
      }

      // name board on the outer fascia, facing away from the track
      const tex = stationSignTexture(st.name, '03');
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.4), mat);
      board.position.set(sgn * (6.1 + CAN_W / 2 + 0.03), CAN_Y + 0.5, 0);
      board.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(board);

      // hanging name boards under the canopy, readable on approach
      for (const zz of [-32, 32]) {
        const hangTex = stationSignTexture(st.name, '03');
        const hangMat = new THREE.MeshBasicMaterial({ map: hangTex, side: THREE.DoubleSide });
        const hang = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.72), hangMat);
        hang.position.set(cx, CAN_Y - 0.5, zz);
        hang.rotation.y = zz > 0 ? Math.PI : 0;
        g.add(hang);
        for (const hx of [-1.1, 1.1]) {
          const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), ribMat);
          rod.position.set(cx + hx, CAN_Y - 0.18, zz);
          g.add(rod);
        }
      }

      // strip light under the canopy
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.04, CAN_L - 6),
        new THREE.MeshStandardMaterial({
          color: 0xe4ecea,
          emissive: 0xfff6e2,
          emissiveIntensity: 0.8,
          roughness: 0.4,
        })
      );
      strip.position.set(cx, CAN_Y + 0.02, 0);
      g.add(strip);
    }

    for (let zz = -52; zz <= 52; zz += 13) {
      for (const sgn of [-1, 1]) {
        colList.push({
          x: p.x + Math.cos(yaw) * sgn * 5.55 + Math.sin(yaw) * zz,
          z: p.z - Math.sin(yaw) * sgn * 5.55 + Math.cos(yaw) * zz,
          yaw,
        });
      }
    }

    // station support legs down to street level
    for (let zz = -52; zz <= 52; zz += 26) {
      for (const sgn of [-1, 1]) {
        legList.push({
          x: p.x + Math.cos(yaw) * sgn * 7.35 + Math.sin(yaw) * zz,
          z: p.z - Math.sin(yaw) * sgn * 7.35 + Math.cos(yaw) * zz,
          yaw,
        });
      }
    }

    stationGroup.add(g);
  }

  const stationColGeo = new THREE.CylinderGeometry(0.17, 0.2, 6.25, 10);
  stationColGeo.translate(0, 3.125, 0);
  const stationCols = new THREE.InstancedMesh(stationColGeo, steelMat, colList.length);
  colList.forEach((c, i) => {
    m4.compose(
      new THREE.Vector3(c.x, top, c.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.yaw, 0)),
      one
    );
    stationCols.setMatrixAt(i, m4);
  });
  group.add(stationCols);

  const legH = top + 1.0;
  const stationLegGeo = new THREE.CylinderGeometry(0.52, 0.7, legH, 12);
  stationLegGeo.translate(0, legH / 2, 0);
  const stationLegs = new THREE.InstancedMesh(stationLegGeo, pierMat, legList.length);
  legList.forEach((c, i) => {
    m4.compose(
      new THREE.Vector3(c.x, 0, c.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.yaw, 0)),
      one
    );
    stationLegs.setMatrixAt(i, m4);
  });
  stationLegs.castShadow = true;
  stationLegs.receiveShadow = true;
  group.add(stationLegs);
  group.add(stationGroup);

  // ---- soft ground shadow under the guideway -----------------------------
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x101718,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.Mesh(
    ribbonGeometry(route, -W - 2.4, W + 2.4, 0.15, { step: 5, vScale: 0.1 }),
    shadowMat
  );
  group.add(shadow);

  return group;
}
