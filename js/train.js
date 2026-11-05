import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { TRAIN, COLORS } from './config.js';
import { mergeByMaterial, mergeGeometries } from './geomutil.js';

// ---------------------------------------------------------------------------
// Procedural materials & textures
// ---------------------------------------------------------------------------

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function texture(canvas, { srgb = true, repeat = null, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

function makeBrushedSteel() {
  const c = canvas2d(1024, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#eef1f2');
  grad.addColorStop(0.35, '#e0e4e5');
  grad.addColorStop(0.7, '#d3d8d9');
  grad.addColorStop(1, '#bdc3c4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);

  // long horizontal brushing
  for (let i = 0; i < 4200; i++) {
    const y = Math.random() * 512;
    const x = Math.random() * 1024;
    const len = 40 + Math.random() * 380;
    const a = 0.008 + Math.random() * 0.032;
    g.strokeStyle = Math.random() > 0.45 ? `rgba(255,255,255,${a})` : `rgba(55,63,65,${a})`;
    g.lineWidth = 0.5 + Math.random() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + (Math.random() - 0.5) * 1.2);
    g.stroke();
  }
  // faint panel seams
  for (let x = 128; x < 1024; x += 256) {
    g.fillStyle = 'rgba(72,80,82,0.16)';
    g.fillRect(x, 0, 1, 512);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(x + 1, 0, 1, 512);
  }
  // small fixings
  for (let x = 128; x < 1024; x += 256) {
    for (let y = 42; y < 512; y += 84) {
      g.fillStyle = 'rgba(65,72,74,0.3)';
      g.beginPath();
      g.arc(x + 9, y, 1.35, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

function makeSteelRoughness() {
  const c = canvas2d(512, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#909090';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * 256;
    const v = 90 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v},0.12)`;
    g.fillRect(Math.random() * 512, y, 20 + Math.random() * 120, 0.7);
  }
  return c;
}

function makeRoofTexture() {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#cdd2d3';
  g.fillRect(0, 0, 512, 512);
  // faint longitudinal panel lines
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(x, 0, 1, 512);
    g.fillStyle = 'rgba(66,74,76,0.10)';
    g.fillRect(x + 1, 0, 1, 512);
  }
  for (let i = 0; i < 240; i++) {
    g.fillStyle = `rgba(30,36,38,${Math.random() * 0.025})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 80, 1);
  }
  return c;
}

function makeGrille() {
  const c = canvas2d(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#9ba1a1';
  g.fillRect(0, 0, 256, 256);
  for (let y = 4; y < 256; y += 8) {
    g.fillStyle = 'rgba(28,33,34,0.8)';
    g.fillRect(4, y, 248, 3);
    g.fillStyle = 'rgba(240,246,246,0.18)';
    g.fillRect(4, y + 3, 248, 1);
  }
  g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 252);
  return c;
}

function makeBallast() {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#8a8175';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 4.4;
    const v = 92 + Math.random() * 88;
    g.fillStyle = `rgb(${v + 14},${v + 8},${v - 2})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.55 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 250; i++) {
    g.fillStyle = `rgba(48,44,38,${Math.random() * 0.22})`;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 8, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function makeGround() {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#484a3e';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) {
    const v = 40 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v + 8},${v - 6},${0.1 + Math.random() * 0.18})`;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 14, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function beamBetween(mat, a, b, radius = 0.03, segments = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, segments), mat);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return mesh;
}

function roundRectPath(g, x, y, w, h, r) {  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function drawHmrMark(g, cx, cy, r, light = true) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = light ? '#f2f5f4' : '#0a4c8e';
  g.fill();
  g.lineWidth = r * 0.11;
  g.strokeStyle = '#0b5fae';
  g.beginPath();
  g.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
  g.stroke();
  // stylised H
  g.strokeStyle = '#0b5fae';
  g.lineWidth = r * 0.24;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - r * 0.42, cy - r * 0.38);
  g.lineTo(cx - r * 0.42, cy + r * 0.38);
  g.moveTo(cx + r * 0.42, cy - r * 0.38);
  g.lineTo(cx + r * 0.42, cy + r * 0.38);
  g.moveTo(cx - r * 0.42, cy + r * 0.02);
  g.lineTo(cx + r * 0.42, cy + r * 0.02);
  g.stroke();
  // green swoosh
  g.strokeStyle = '#0aa06a';
  g.lineWidth = r * 0.13;
  g.beginPath();
  g.arc(cx, cy, r * 0.72, Math.PI * 1.12, Math.PI * 1.62);
  g.stroke();
  // red accent
  g.strokeStyle = '#d12f31';
  g.lineWidth = r * 0.075;
  g.beginPath();
  g.arc(cx, cy, r * 0.58, Math.PI * 0.15, Math.PI * 0.52);
  g.stroke();
  g.restore();
}

function makeFrontTexture(blue = '#0b5fae') {
  const W = 1024;
  const H = 1024;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');

  // brushed stainless face
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#dde1e1');
  base.addColorStop(0.3, '#cfd4d4');
  base.addColorStop(0.68, '#c0c6c6');
  base.addColorStop(0.92, '#aab0b1');
  base.addColorStop(1, '#8f9697');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // dark roof brow
  const brow = g.createLinearGradient(0, 0, 0, H * 0.075);
  brow.addColorStop(0, '#2c3234');
  brow.addColorStop(1, '#485052');
  g.fillStyle = brow;
  g.fillRect(0, 0, W, H * 0.075);

  // blue cantrail wrapping the cab
  const band = g.createLinearGradient(0, H * 0.075, 0, H * 0.235);
  band.addColorStop(0, '#0d6cb9');
  band.addColorStop(0.65, blue);
  band.addColorStop(1, '#06508f');
  g.fillStyle = band;
  g.fillRect(0, H * 0.075, W, H * 0.16);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, H * 0.229, W, 3);

  // destination display
  g.fillStyle = '#070b0c';
  roundRectPath(g, W * 0.335, H * 0.098, W * 0.33, H * 0.058, 7);
  g.fill();
  g.strokeStyle = 'rgba(190,205,210,0.22)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#ff9a2e';
  g.font = '600 34px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,150,40,0.9)';
  g.shadowBlur = 10;
  g.fillText('RAIDURG', W * 0.5, H * 0.128);
  g.shadowBlur = 0;
  // LED mask
  g.fillStyle = 'rgba(0,0,0,0.42)';
  for (let y = H * 0.098; y < H * 0.156; y += 2.6) g.fillRect(W * 0.335, y, W * 0.33, 0.8);

  // windscreen — one deep aperture split by two slim pillars
  g.fillStyle = '#080c0e';
  roundRectPath(g, W * 0.055, H * 0.205, W * 0.89, H * 0.265, W * 0.048);
  g.fill();
  const gl = g.createLinearGradient(0, H * 0.205, 0, H * 0.47);
  gl.addColorStop(0, '#18262c');
  gl.addColorStop(0.42, '#0a1114');
  gl.addColorStop(1, '#060a0c');
  g.fillStyle = gl;
  roundRectPath(g, W * 0.068, H * 0.218, W * 0.864, H * 0.235, W * 0.042);
  g.fill();
  // sky reflection on the screen
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.14;
  g.fillStyle = '#bcd8e8';
  g.beginPath();
  g.moveTo(W * 0.14, H * 0.218);
  g.lineTo(W * 0.36, H * 0.218);
  g.lineTo(W * 0.22, H * 0.453);
  g.lineTo(W * 0.08, H * 0.453);
  g.closePath();
  g.fill();
  g.restore();
  // pillars
  for (const x of [0.36, 0.64]) {
    g.fillStyle = '#0a0e10';
    g.fillRect(W * x - 3, H * 0.208, 6, H * 0.26);
    g.fillStyle = 'rgba(210,220,220,0.28)';
    g.fillRect(W * x + 3, H * 0.208, 1.5, H * 0.26);
  }

  // tricolour waist: red, green, blue (the line colour is the thick one)
  g.fillStyle = '#d12f31';
  g.fillRect(0, H * 0.515, W, H * 0.012);
  g.fillStyle = '#11934a';
  g.fillRect(0, H * 0.527, W, H * 0.035);
  g.fillStyle = blue;
  g.fillRect(0, H * 0.562, W, H * 0.072);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(0, H * 0.562, W, 2);

  // lower silver panel with the coupler recess
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, H * 0.634, W, H * 0.28);
  g.fillStyle = '#111516';
  roundRectPath(g, W * 0.415, H * 0.88, W * 0.17, H * 0.064, 8);
  g.fill();
  g.strokeStyle = 'rgba(220,228,228,0.18)';
  g.lineWidth = 2;
  g.stroke();

  // headlight clusters
  for (const cx of [0.235, 0.765]) {
    g.fillStyle = '#0b0f10';
    roundRectPath(g, W * (cx - 0.095), H * 0.71, W * 0.19, H * 0.092, 14);
    g.fill();
    const lamp = g.createRadialGradient(W * cx, H * 0.756, 2, W * cx, H * 0.756, W * 0.075);
    lamp.addColorStop(0, '#fffdf2');
    lamp.addColorStop(0.45, '#ffe9b8');
    lamp.addColorStop(1, '#2a2620');
    g.fillStyle = lamp;
    g.beginPath();
    g.ellipse(W * cx, H * 0.756, W * 0.062, H * 0.026, 0, 0, Math.PI * 2);
    g.fill();
    // LED signature bar
    g.fillStyle = '#e9f7ff';
    g.fillRect(W * (cx - 0.072), H * 0.722, W * 0.144, H * 0.012);
  }

  // HMR crest under the screen
  drawHmrMark(g, W * 0.5, H * 0.66, W * 0.032, true);

  // panel seams
  g.strokeStyle = 'rgba(52,60,62,0.22)';
  g.lineWidth = 2;
  for (const x of [0.335, 0.665]) {
    g.beginPath();
    g.moveTo(W * x, H * 0.64);
    g.lineTo(W * x, H * 0.98);
    g.stroke();
  }

  // unit number
  g.fillStyle = 'rgba(45,52,54,0.66)';
  g.font = '600 18px "JetBrains Mono", monospace';
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.fillText('HMR 03', W * 0.95, H * 0.965);

  // weathering
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * W;
    const y = H * (0.66 + Math.random() * 0.32);
    g.fillStyle = `rgba(38,40,38,${Math.random() * 0.04})`;
    g.fillRect(x, y, 1 + Math.random() * 7, 2 + Math.random() * 22);
  }
  const sheen = g.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
  sheen.addColorStop(0.38, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.72, 'rgba(0,0,0,0.03)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, W, H);

  return c;
}

function makeSideDecal() {
  const c = canvas2d(768, 320);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 768, 320);
  drawHmrMark(g, 94, 168, 68, true);
  g.fillStyle = '#0c4f91';
  g.font = '500 33px "Inter", sans-serif';
  g.letterSpacing = '4px';
  g.fillText('HYDERABAD', 186, 150);
  g.font = '700 54px "Inter", sans-serif';
  g.letterSpacing = '2px';
  g.fillText('METRO', 184, 207);
  g.strokeStyle = '#d12f31';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(188, 230);
  g.lineTo(400, 230);
  g.stroke();
  g.strokeStyle = '#11934a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(188, 244);
  g.lineTo(360, 244);
  g.stroke();
  g.fillStyle = 'rgba(16,58,93,0.55)';
  g.font = '400 17px "JetBrains Mono", monospace';
  g.letterSpacing = '3px';
  g.fillText('L&T METRO RAIL', 188, 279);
  return c;
}


// ---------------------------------------------------------------------------
// Side livery
//
// A single painted strip per car replicates the real HMRL set: fluted
// stainless panels, a royal-blue cantrail band, the long dark window band,
// four sliding doors per side, the tricolour waist line and the HMR crest.
// Drawing it once and using it as a decal is both sharper and much cheaper
// than hundreds of tiny window/frame meshes.
// ---------------------------------------------------------------------------
function makeSideLivery(blue = '#0a5fa8', { carIndex = 0 } = {}) {
  const W = 2048;
  const H = 384;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const halfZ = TRAIN.shellLength / 2; // 10.2
  const yTop = 3.74;
  const yBot = 1.0;
  const X = (z) => ((z + halfZ) / (halfZ * 2)) * W;
  const Y = (y) => ((yTop - y) / (yTop - yBot)) * H;
  const dash = (z, w) => [X(z - w / 2), X(z + w / 2)];
  const boxY = (y0, y1) => [Y(y1), Y(y0)];

  // brushed stainless base
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#e3e7e7');
  base.addColorStop(0.22, '#d5dada');
  base.addColorStop(0.62, '#c7cccc');
  base.addColorStop(0.9, '#b4babb');
  base.addColorStop(1, '#9fa6a7');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // horizontal fluting — the signature of the Rotem stainless body
  for (let y = 6; y < H; y += 7) {
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(58,66,68,0.13)';
    g.fillRect(0, y + 1, W, 1);
  }
  // broader panel joints
  const seams = [-10.0, -7.6, -5.2, -3.0, -0.8, 1.4, 3.6, 5.8, 8.0, 9.7];
  for (const z of seams) {
    g.fillStyle = 'rgba(60,68,70,0.22)';
    g.fillRect(X(z), 0, 1.4, H);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(X(z) + 1.4, 0, 1, H);
  }
  // fixings along the waist
  g.fillStyle = 'rgba(70,78,80,0.34)';
  for (const z of seams) {
    for (const y of [0.78, 1.62, 2.95]) {
      g.beginPath();
      g.arc(X(z) + 5, Y(y), 2.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  // royal blue cantrail band
  const [bTop, bBot] = boxY(3.19, 3.7);
  const band = g.createLinearGradient(0, bTop, 0, bBot);
  band.addColorStop(0, '#0b67b2');
  band.addColorStop(0.55, blue);
  band.addColorStop(1, '#074a86');
  g.fillStyle = band;
  g.fillRect(0, bTop, W, bBot - bTop);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillRect(0, bBot - 2, W, 1.4);
  // dark roof lip above the band
  g.fillStyle = '#4c5354';
  g.fillRect(0, 0, W, bTop - 1);

  // smoked window band: individual bays between the doors
  const glassBay = (z, w, h, yMid, { door = false } = {}) => {
    const [z0, z1] = dash(z, w);
    const [y1, y0] = boxY(yMid - h / 2, yMid + h / 2);
    // black gasket
    g.fillStyle = '#0b0f10';
    g.fillRect(z0 - 3, y0 - 3, z1 - z0 + 6, y1 - y0 + 6);
    // deep tinted glass
    const gl = g.createLinearGradient(z0, y0, z1, y1);
    gl.addColorStop(0, '#152025');
    gl.addColorStop(0.35, '#2c3e45');
    gl.addColorStop(0.52, '#0d1417');
    gl.addColorStop(1, '#1a262b');
    g.fillStyle = gl;
    g.fillRect(z0, y0, z1 - z0, y1 - y0);
    // sky reflection streak
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.18;
    g.fillStyle = '#cfe6f2';
    g.beginPath();
    g.moveTo(z0 + (z1 - z0) * 0.16, y0);
    g.lineTo(z0 + (z1 - z0) * 0.42, y0);
    g.lineTo(z0 + (z1 - z0) * 0.2, y1);
    g.lineTo(z0 + (z1 - z0) * 0.02, y1);
    g.closePath();
    g.fill();
    g.restore();
    if (!door) {
      // thin centre mullion on the big saloon windows
      g.fillStyle = 'rgba(190,200,200,0.5)';
      g.fillRect((z0 + z1) / 2 - 1, y0, 2, y1 - y0);
    }
    // bright lower gasket
    g.fillStyle = 'rgba(220,228,228,0.28)';
    g.fillRect(z0 - 3, y1 + 1, z1 - z0 + 6, 2);
  };

  // doors are painted as dark apertures; the animated 3D leaves sit over them
  for (const z of TRAIN.doorCentres) {
    const [z0, z1] = dash(z, 1.3);
    const [y1, y0] = boxY(1.22, 3.18);
    g.fillStyle = '#0a0e10';
    g.fillRect(z0, y0, z1 - z0, y1 - y0);
    const inner = g.createLinearGradient(z0, y0, z0, y1);
    inner.addColorStop(0, '#161b1c');
    inner.addColorStop(0.5, '#2b2d28');
    inner.addColorStop(1, '#0b0e0f');
    g.fillStyle = inner;
    g.fillRect(z0 + 4, y0 + 4, z1 - z0 - 8, y1 - y0 - 8);
    // door jamb highlights
    g.fillStyle = 'rgba(215,222,222,0.42)';
    g.fillRect(z0 - 2, y0, 2, y1 - y0);
    g.fillRect(z1, y0, 2, y1 - y0);
    // warm hint of the saloon beyond the doorway
    g.fillStyle = 'rgba(255,196,110,0.10)';
    g.fillRect(z0 + 10, y0 + 20, z1 - z0 - 20, y1 - y0 - 60);
  }

  // saloon windows
  for (const z of TRAIN.windowCentres) glassBay(z, TRAIN.windowWidth, 1.1, 2.56);
  // end windows
  for (const z of [-8.78, 8.78]) glassBay(z, 1.32, 1.08, 2.56);
  // cab side window
  for (const z of [-9.33, 9.33]) glassBay(z, 0.52, 0.96, 2.56);

  // waist tricolour — thin red and green lines under the blue band
  g.fillStyle = '#d12f31';
  g.fillRect(0, Y(3.06), W, 2);
  g.fillStyle = '#11934a';
  g.fillRect(0, Y(3.02), W, 2);

  // lower skirt shadow
  const skirt = g.createLinearGradient(0, Y(1.55), 0, H);
  skirt.addColorStop(0, 'rgba(30,34,35,0)');
  skirt.addColorStop(1, 'rgba(22,26,27,0.35)');
  g.fillStyle = skirt;
  g.fillRect(0, Y(1.55), W, H - Y(1.55));

  // HMR crest + wordmark toward the cab end
  if (carIndex === 2) {
    const cx = X(8.35);
    const cy = Y(1.62);
    drawHmrMark(g, cx, cy, 26, true);
    g.fillStyle = 'rgba(10,55,95,0.72)';
    g.font = '600 13px "Inter", sans-serif';
    g.letterSpacing = '2px';
    g.fillText('HYDERABAD METRO', cx + 38, cy - 2);
    g.fillStyle = 'rgba(10,55,95,0.5)';
    g.font = '500 10px "JetBrains Mono", monospace';
    g.fillText('L&T METRO RAIL', cx + 39, cy + 15);
  }
  // unit numbers near each cab
  g.fillStyle = 'rgba(50,58,60,0.55)';
  g.font = '600 11px "JetBrains Mono", monospace';
  g.textAlign = 'left';
  g.fillText(`HMRL 03${String(carIndex + 1).padStart(2, '0')}`, X(-9.9), Y(1.25));

  // grime along the bottom edge
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * W;
    const y = Y(1.35 + Math.random() * 0.35);
    g.fillStyle = `rgba(40,42,38,${Math.random() * 0.05})`;
    g.fillRect(x, y, 2 + Math.random() * 12, 1 + Math.random() * 4);
  }
  return c;
}


// Emissive companion to the side livery: only the glazing lights up, so the
// saloon reads as warm interior light at night while the stainless stays dark.
function makeSideEmissive() {
  const W = 2048;
  const H = 384;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, W, H);
  const halfZ = TRAIN.shellLength / 2;
  const yTop = 3.74;
  const yBot = 1.0;
  const X = (z) => ((z + halfZ) / (halfZ * 2)) * W;
  const Y = (y) => ((yTop - y) / (yTop - yBot)) * H;

  const pane = (z, w, h, yMid, strength = 1) => {
    const x0 = X(z - w / 2);
    const x1 = X(z + w / 2);
    const y0 = Y(yMid + h / 2);
    const y1 = Y(yMid - h / 2);
    g.save();
    g.shadowColor = 'rgba(255,190,110,0.9)';
    g.shadowBlur = 18;
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, `rgba(255,224,176,${0.92 * strength})`);
    gr.addColorStop(0.45, `rgba(255,204,138,${0.82 * strength})`);
    gr.addColorStop(1, `rgba(214,150,84,${0.6 * strength})`);
    g.fillStyle = gr;
    g.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6);
    // silhouettes of seats / poles
    g.fillStyle = `rgba(40,26,12,${0.4 * strength})`;
    g.fillRect(x0 + 8, y1 - (y1 - y0) * 0.34, x1 - x0 - 16, 4);
    for (let i = 0; i < 3; i++) {
      const bx = x0 + (x1 - x0) * (0.2 + i * 0.3);
      g.fillRect(bx, y0 + 8, 3, y1 - y0 - 16);
    }
    g.restore();
  };

  for (const z of TRAIN.windowCentres) pane(z, TRAIN.windowWidth, 1.1, 2.56);
  for (const z of [-8.78, 8.78]) pane(z, 1.32, 1.08, 2.56);
  for (const z of [-9.33, 9.33]) pane(z, 0.52, 0.96, 2.56, 0.55);
  // door glass glows a little cooler and dimmer
  for (const z of TRAIN.doorCentres) pane(z, 1.0, 1.5, 2.34, 0.5);
  return c;
}

// A single door leaf as a painted panel: brushed steel with one tall glazed
// aperture, so the whole leaf is one draw call instead of five.
function makeDoorLeaf() {
  const W = 256;
  const H = 768;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#e7ebeb');
  base.addColorStop(0.32, '#d6dbdb');
  base.addColorStop(0.7, '#c3c9c9');
  base.addColorStop(1, '#aab0b1');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // fluting
  for (let y = 4; y < H; y += 9) {
    g.fillStyle = 'rgba(255,255,255,0.13)';
    g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(50,58,60,0.1)';
    g.fillRect(0, y + 1, W, 1);
  }
  // glazed aperture
  g.fillStyle = '#0a0e10';
  roundRectPath(g, 22, 18, W - 44, H * 0.48, 9);
  g.fill();
  const gl = g.createLinearGradient(0, 18, W, H * 0.5);
  gl.addColorStop(0, '#131d21');
  gl.addColorStop(0.4, '#2a3a40');
  gl.addColorStop(0.55, '#0c1316');
  gl.addColorStop(1, '#1a262b');
  g.fillStyle = gl;
  roundRectPath(g, 27, 23, W - 54, H * 0.48 - 10, 7);
  g.fill();
  // reflection streak
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.16;
  g.fillStyle = '#d4e8f2';
  g.beginPath();
  g.moveTo(46, 26);
  g.lineTo(112, 26);
  g.lineTo(64, H * 0.48);
  g.lineTo(32, H * 0.48);
  g.closePath();
  g.fill();
  g.restore();
  // centre seam and edge shadows
  g.fillStyle = 'rgba(54,62,64,0.5)';
  g.fillRect(W / 2 - 1, 0, 2, H);
  g.fillStyle = 'rgba(22,26,27,0.55)';
  g.fillRect(0, 0, 5, H);
  g.fillRect(W - 5, 0, 5, H);
  // handle
  g.fillStyle = '#1c2122';
  roundRectPath(g, W - 44, H * 0.56, 12, 82, 6);
  g.fill();
  g.fillStyle = 'rgba(230,238,238,0.4)';
  g.fillRect(W - 42, H * 0.56 + 4, 2, 74);
  // kick plate
  const kick = g.createLinearGradient(0, H * 0.78, 0, H);
  kick.addColorStop(0, 'rgba(70,76,76,0.18)');
  kick.addColorStop(1, 'rgba(40,46,46,0.5)');
  g.fillStyle = kick;
  g.fillRect(0, H * 0.78, W, H * 0.22);
  g.fillStyle = 'rgba(50,58,58,0.3)';
  g.fillRect(0, H * 0.78, W, 2);
  return c;
}

function makeDoorEmissive() {
  const W = 256;
  const H = 768;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, W, H);
  g.save();
  g.shadowColor = 'rgba(255,196,120,0.9)';
  g.shadowBlur = 22;
  const gr = g.createLinearGradient(0, 20, 0, H * 0.5);
  gr.addColorStop(0, 'rgba(255,224,172,0.75)');
  gr.addColorStop(1, 'rgba(224,162,92,0.45)');
  g.fillStyle = gr;
  roundRectPath(g, 27, 23, W - 54, H * 0.48 - 10, 7);
  g.fill();
  g.restore();
  return c;
}

function makeDestination(text = 'RAIDURG') {
  const c = canvas2d(512, 96);
  const g = c.getContext('2d');
  g.fillStyle = '#080b0c';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ff9a2e';
  g.font = '600 54px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,140,30,0.85)';
  g.shadowBlur = 14;
  g.fillText(text, 256, 51);
  // LED matrix mask
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.38)';
  for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 512, 1);
  for (let x = 0; x < 512; x += 3) g.fillRect(x, 0, 1, 96);
  return c;
}

function makeGlow() {
  const c = canvas2d(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,244,220,0.75)');
  gr.addColorStop(0.45, 'rgba(255,220,170,0.18)');
  gr.addColorStop(1, 'rgba(255,210,150,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return c;
}

function makeContactShadow() {
  const c = canvas2d(256, 1024);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 1024);
  const gr = g.createLinearGradient(0, 0, 0, 1024);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.1, 'rgba(0,0,0,0.5)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0.65)');
  gr.addColorStop(0.9, 'rgba(0,0,0,0.5)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 1024);
  const side = g.createLinearGradient(0, 0, 256, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.24, 'rgba(0,0,0,1)');
  side.addColorStop(0.76, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = side;
  g.fillRect(0, 0, 256, 1024);
  return c;
}

// ---------------------------------------------------------------------------

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  s.closePath();
  return s;
}

function roundedPanelGeom(w, h, r, segments = 12) {
  const geom = new THREE.ShapeGeometry(roundedShape(w, h, r), segments);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
  return geom;
}

function buildWheel(materials, radius) {
  const group = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.13, 26, 1),
    materials.wheel
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  group.add(tyre);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 0.145, 26, 1),
    materials.rim
  );
  rim.rotation.z = Math.PI / 2;
  group.add(rim);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.155, 18, 1),
    materials.bogieDark
  );
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.16, 6),
      materials.rim
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0, Math.cos(a) * radius * 0.38, Math.sin(a) * radius * 0.38);
    group.add(bolt);
  }
  return group;
}

function buildBogie(materials) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.32, 0.42, 2.65),
    materials.bogie
  );
  frame.position.y = 0.57;
  frame.castShadow = true;
  g.add(frame);

  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.56, 2.45),
      materials.bogieDark
    );
    side.position.set(sx * 0.97, 0.56, 0);
    g.add(side);
  }

  const wheels = [];
  for (const sz of [-0.92, 0.92]) {
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 1.55, 10),
      materials.axle
    );
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, TRAIN.wheelRadius, sz);
    g.add(axle);

    for (const sx of [-1, 1]) {
      const w = buildWheel(materials, TRAIN.wheelRadius);
      w.position.set(sx * TRAIN.gauge * 0.5, TRAIN.wheelRadius, sz);
      w.userData.spin = true;
      g.add(w);
      wheels.push(w);
    }

    // axle boxes
    for (const sx of [-1, 1]) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.28, 0.34),
        materials.bogieDark
      );
      box.position.set(sx * 0.78, TRAIN.wheelRadius + 0.17, sz);
      g.add(box);
    }
  }

  // traction motors
  for (const sz of [-0.5, 0.5]) {
    const motor = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.44, 0.7),
      materials.motor
    );
    motor.position.set(0, 0.72, sz);
    g.add(motor);
  }

  // air springs
  for (const sx of [-0.86, 0.86]) {
    for (const sz of [-0.82, 0.82]) {
      const spring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.19, 0.24, 12),
        materials.spring
      );
      spring.position.set(sx, 0.92, sz);
      g.add(spring);
    }
  }

  return { group: g, wheels };
}

function buildCab(materials, textures, frontTexture) {
  const group = new THREE.Group();

  const shape = roundedShape(2.78, 2.64, 0.2);
  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: 0.46,
    bevelEnabled: true,
    bevelThickness: 0.075,
    bevelSize: 0.045,
    bevelSegments: 3,
    steps: 1,
  });
  extrude.computeBoundingBox();
  const zFront = extrude.boundingBox.max.z;

  const cap = new THREE.Mesh(extrude, materials.steel);
  cap.position.y = 2.36;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  // front livery panel
  const panelGeom = roundedPanelGeom(2.78, 2.64, 0.2, 16);
  const panel = new THREE.Mesh(
    panelGeom,
    new THREE.MeshStandardMaterial({
      map: frontTexture,
      metalness: 0.32,
      roughness: 0.3,
      envMapIntensity: 0.85,
    })
  );
  panel.position.set(0, 2.36, zFront + 0.003);
  group.add(panel);

  // windscreen: three panes
  const glassMat = materials.glass;
  const pane = (w, h, x, y, r = 0.055) => {
    const m = new THREE.Mesh(roundedPanelGeom(w, h, r, 10), glassMat);
    m.position.set(x, y, zFront + 0.012);
    group.add(m);
  };
  pane(0.83, 0.78, 0, 3.11);
  pane(0.49, 0.75, -0.69, 3.09, 0.05);
  pane(0.49, 0.75, 0.69, 3.09, 0.05);

  // wipers
  for (const sx of [-0.42, 0.42]) {
    const arm = new THREE.Group();
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.64, 6),
      materials.rubber
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.x = 0.28;
    arm.add(rod);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.018, 0.03),
      materials.rubber
    );
    blade.position.set(0.36, 0.02, 0.01);
    arm.add(blade);
    arm.position.set(sx, 2.79, zFront + 0.035);
    arm.rotation.z = sx > 0 ? -0.28 : 0.28;
    arm.rotation.y = sx > 0 ? -0.15 : 0.15;
    group.add(arm);
  }

  // headlight housings + lamps
  const headlights = [];
  for (const sx of [-1, 1]) {
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.27, 0.05),
      materials.lightHousing
    );
    housing.position.set(sx * 0.72, 1.73, zFront + 0.015);
    group.add(housing);

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xf2f4ef,
      emissive: 0xfff3dc,
      emissiveIntensity: 3.2,
      roughness: 0.18,
      metalness: 0.1,
    });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 20), lampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(sx * 0.56, 1.73, zFront + 0.045);
    group.add(lamp);

    const barMat = new THREE.MeshStandardMaterial({
      color: 0xf6faf8,
      emissive: 0xdff4ff,
      emissiveIntensity: 2.8,
      roughness: 0.2,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.03), barMat);
    bar.position.set(sx * 0.84, 1.73, zFront + 0.043);
    group.add(bar);

    const glowMat = new THREE.SpriteMaterial({
      map: textures.glow,
      color: 0xfff2d8,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.62, 0.62, 1);
    glow.position.set(sx * 0.7, 1.74, zFront + 0.08);
    group.add(glow);

    headlights.push({ lampMat, barMat, glowMat });
  }

  // upper red markers
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14),
      new THREE.MeshStandardMaterial({
        color: 0x5a0e0b,
        emissive: 0xff2a1c,
        emissiveIntensity: 2.4,
        roughness: 0.3,
      })
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(sx * 0.62, 3.52, zFront + 0.02);
    group.add(m);
  }

  // destination display
  const destMat = new THREE.MeshStandardMaterial({
    color: 0x120b03,
    emissive: 0xff9a2e,
    emissiveMap: textures.destination,
    emissiveIntensity: 2.6,
    roughness: 0.35,
    metalness: 0.1,
  });
  const dest = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.15), destMat);
  dest.position.set(0, 3.45, zFront + 0.028);
  group.add(dest);

  // coupler
  const coupler = new THREE.Group();
  const head = new THREE.Mesh(
    new RoundedBoxGeometry(0.38, 0.28, 0.3, 3, 0.04),
    materials.bogieDark
  );
  head.position.set(0, 0.88, 0.09);
  coupler.add(head);
  const draw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.32, 10),
    materials.axle
  );
  draw.rotation.x = Math.PI / 2;
  draw.position.set(0, 0.9, -0.14);
  coupler.add(draw);
  for (const sx of [-0.13, 0.13]) {
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1b1d1e, roughness: 0.7 });
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), hoseMat);
    hose.rotation.x = Math.PI / 2.8;
    hose.position.set(sx, 0.72, 0.02);
    coupler.add(hose);
  }
  coupler.position.set(0, 0, zFront + 0.02);
  group.add(coupler);

  // mirrors
  for (const sx of [-1, 1]) {
    const mirror = new THREE.Group();
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.024, 0.3, 8),
      materials.rubber
    );
    stalk.rotation.z = sx * 0.9;
    stalk.position.x = sx * 0.1;
    mirror.add(stalk);
    const pod = new THREE.Mesh(
      new RoundedBoxGeometry(0.12, 0.26, 0.08, 2, 0.026),
      materials.bogieDark
    );
    pod.position.set(sx * 0.23, 0.05, 0);
    mirror.add(pod);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.085, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x182226, metalness: 0.9, roughness: 0.08 })
    );
    face.position.set(sx * 0.23, 0.05, 0.043);
    mirror.add(face);
    mirror.position.set(sx * 1.02, 3.22, zFront - 0.36);
    group.add(mirror);
  }

  return { group, zFront, headlights, destMat };
}

function buildCar(materials, textures, texturesData, { index, cabPlus, cabMinus }) {
  const car = new THREE.Group();
  car.userData.wheels = [];
  car.userData.doors = [];
  const half = TRAIN.shellLength / 2;

  // main shell
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(TRAIN.width - 0.02, 2.74, TRAIN.shellLength, 6, 0.2),
    materials.steel
  );
  shell.position.y = 2.37;
  shell.castShadow = true;
  shell.receiveShadow = true;
  car.add(shell);

  // lower skirt / underframe
  const skirt = new THREE.Mesh(
    new RoundedBoxGeometry(2.72, 0.5, TRAIN.shellLength - 0.1, 3, 0.06),
    materials.skirt
  );
  skirt.position.y = 0.8;
  skirt.castShadow = true;
  car.add(skirt);


  // windows and doors
  const glassGeo = (w, h, r = 0.09) => roundedPanelGeom(w, h, r, 10);
  const windowFrameMat = materials.gasket;

  const addDoor = (side, z) => {
    const x = side * (TRAIN.width / 2 + 0.024);

    // dark aperture
    const aperture = new THREE.Mesh(
      roundedPanelGeom(1.3, 1.96, 0.06, 8),
      materials.aperture
    );
    aperture.rotation.y = side * Math.PI / 2;
    aperture.position.set(x - side * 0.002, 2.2, z);
    car.add(aperture);

    // dark frame around the door aperture
    for (const zz of [-0.66, 0.66]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 2.02, 0.035), materials.gasket);
      bar.position.set(x + side * 0.004, 2.2, z + zz);
      car.add(bar);
    }
    for (const yy of [1.19, 3.21]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 1.35), materials.gasket);
      bar.position.set(x + side * 0.004, yy, z);
      car.add(bar);
    }

    for (const leafSide of [-1, 1]) {
      const leafGroup = new THREE.Group();
      leafGroup.position.set(x, 2.2, z + leafSide * 0.312);
      leafGroup.userData.keep = true;
      car.add(leafGroup);

      // Painted panel: steel frame, glazing and handle baked into one texture,
      // so a whole leaf is a single draw call.
      const leaf = new THREE.Mesh(
        new RoundedBoxGeometry(0.05, 1.9, 0.615, 2, 0.02),
        materials.doorLeaf
      );
      leaf.position.set(side * 0.014, 0, 0);
      leaf.castShadow = true;
      leafGroup.add(leaf);

      car.userData.doors.push({
        group: leafGroup,
        side,
        leafSide,
        baseZ: z + leafSide * 0.312,
      });
    }
  };

  // Painted stainless livery (windows, crest, fluting, blue band). The 3D
  // door leaves remain separate so they can slide.
  const sideMats = [];
  for (const side of [-1, 1]) {
    const mat = new THREE.MeshStandardMaterial({
      map: side < 0 ? texturesData.sideMirror[index] : texturesData.side[index],
      emissiveMap: materials.sideGlowMap,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.52,
      metalness: 0.08,
      envMapIntensity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    sideMats.push(mat);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(TRAIN.shellLength - 0.04, 2.72),
      mat
    );
    panel.rotation.y = side * Math.PI / 2;
    // The shell is a rounded box whose flat flank is 1.44 m out. A big far
    // plane means 1 mm of separation z-fights away, so the skin lives 2 cm
    // proud of the body and the doors another 2 cm clear of that.
    panel.position.set(side * (TRAIN.width / 2 + 0.02), 2.37, 0);
    car.add(panel);
    for (const z of TRAIN.doorCentres) addDoor(side, z);
  }

  // roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.24, 0.035, TRAIN.shellLength - 0.4),
    materials.roof
  );
  roof.position.y = 3.742;
  roof.castShadow = true;
  car.add(roof);

  // roof equipment
  for (const z of [-5.2, 5.2]) {
    const ac = new THREE.Mesh(
      new RoundedBoxGeometry(1.66, 0.27, 1.92, 3, 0.07),
      materials.ac
    );
    ac.position.set(0, 3.9, z);
    ac.castShadow = true;
    car.add(ac);

    const grill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.28, 1.5),
      materials.grille
    );
    grill.rotation.x = -Math.PI / 2;
    grill.position.set(0, 4.036, z);
    car.add(grill);

    for (const sx of [-1, 1]) {
      const louver = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.17),
        materials.grille
      );
      louver.rotation.y = sx * Math.PI / 2;
      louver.position.set(sx * 0.834, 3.9, z);
      car.add(louver);
    }
  }
  const duct = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.06, TRAIN.shellLength - 3.4),
    materials.roofDark
  );
  duct.position.y = 3.77;
  car.add(duct);

  // roof panel seams
  for (let z = -half + 1.4; z <= half - 1.4; z += 2.6) {
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.012, 0.035),
      materials.roofDark
    );
    seam.position.set(0, 3.764, z);
    car.add(seam);
  }

  // small roof boxes / antennas
  for (const [x, z, w, d] of [
    [-0.62, -8.6, 0.52, 0.72],
    [0.62, 8.6, 0.52, 0.72],
    [0.35, -2.9, 0.28, 0.42],
  ]) {
    const box = new THREE.Mesh(new RoundedBoxGeometry(w, 0.13, d, 2, 0.03), materials.ac);
    box.position.set(x, 3.82, z);
    box.castShadow = true;
    car.add(box);
  }

  // single-arm pantograph on the centre car
  if (index === 1) {
    const panto = new THREE.Group();
    const insulator = new THREE.MeshStandardMaterial({ color: 0x33383a, roughness: 0.72 });
    for (const z of [-0.92, 0.92]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.28, 8), insulator);
      ins.position.set(0, 3.9, z);
      panto.add(ins);
    }
    const baseY = 4.06;
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY, -0.92), new THREE.Vector3(0, baseY + 0.6, 0.18), 0.038));
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY, 0.92), new THREE.Vector3(0, baseY + 0.6, -0.18), 0.038));
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY + 0.6, 0.18), new THREE.Vector3(0, baseY + 1.02, 0.62), 0.026));
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY + 0.6, -0.18), new THREE.Vector3(0, baseY + 1.02, 0.62), 0.026));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.045, 0.1), materials.axle);
    bar.position.set(0, baseY + 1.05, 0.62);
    panto.add(bar);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 0.03, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x222627, roughness: 0.6 })
    );
    strip.position.set(0, baseY + 1.08, 0.62);
    panto.add(strip);
    car.add(panto);
  }

  // underframe equipment
  for (const z of [-5.8, 0, 5.8]) {
    const eq = new THREE.Mesh(
      new RoundedBoxGeometry(1.8, 0.38, 2.25, 2, 0.04),
      materials.equipment
    );
    eq.position.set(0, 0.79, z);
    car.add(eq);
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.24),
      materials.grille
    );
    g.rotation.x = Math.PI / 2;
    g.position.set(0, 0.598, z);
    car.add(g);
  }

  // bogies
  const bogies = [];
  for (const z of [-TRAIN.bogieHalfSpacing, TRAIN.bogieHalfSpacing]) {
    const bogie = buildBogie(materials);
    bogie.group.position.z = z;
    car.add(bogie.group);
    bogies.push(bogie);
    for (const w of bogie.wheels) car.userData.wheels.push(w);
  }

  // end walls / gangway face
  const addEnd = (end) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 2.4, 0.04),
      materials.endPanel
    );
    wall.position.set(0, 2.2, end * (half + 0.015));
    car.add(wall);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 1.9, 0.03),
      materials.doorSteel
    );
    door.position.set(0, 2.18, end * (half + 0.04));
    car.add(door);
  };
  if (!cabPlus) addEnd(1);
  if (!cabMinus) addEnd(-1);

  // cab shells
  let cabA = null;
  let cabB = null;
  if (cabPlus) {
    cabA = buildCab(materials, textures, texturesData.front);
    cabA.group.position.z = half + 0.02;
    car.add(cabA.group);
  } else {
    // bellows at the + end
    const bellows = buildBellows(materials);
    bellows.position.z = half + 0.63;
    car.add(bellows);
  }
  if (cabMinus) {
    cabB = buildCab(materials, textures, texturesData.front);
    cabB.group.rotation.y = Math.PI;
    cabB.group.position.z = -half - 0.02;
    car.add(cabB.group);
  } else {
    const bellows = buildBellows(materials);
    bellows.position.z = -half - 0.63;
    car.add(bellows);
  }

  // contact shadow
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, TRAIN.shellLength + 1),
    new THREE.MeshBasicMaterial({
      map: textures.contact,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      color: 0x000000,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.012;
  car.add(contact);

  return { group: car, cabA, cabB, bogies, wheels: car.userData.wheels, doors: car.userData.doors, sideMats };
}

function buildBellows(materials) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.28, 2.62, 1.22), materials.bellows);
  body.position.y = 2.18;
  g.add(body);
  // ribs
  for (let i = 0; i < 7; i++) {
    const z = -0.54 + i * 0.18;
    for (const sx of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.64, 0.065), materials.bellowsRib);
      rib.position.set(sx * 1.15, 2.18, z);
      g.add(rib);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.04, 0.065), materials.bellowsRib);
    top.position.set(0, 3.49, z);
    g.add(top);
  }
  return g;
}

function makeMaterials(anisotropy) {
  const steelMap = texture(makeBrushedSteel(), { repeat: [2.6, 1], anisotropy });
  const roughMap = texture(makeSteelRoughness(), { srgb: false, repeat: [3, 1], anisotropy });
  const roofMap = texture(makeRoofTexture(), { repeat: [1, 5], anisotropy });
  const grilleMap = texture(makeGrille(), { anisotropy });
  const sideGlowMap = texture(makeSideEmissive(), { anisotropy });
  const doorLeafMap = texture(makeDoorLeaf(), { anisotropy });
  const doorGlowMap = texture(makeDoorEmissive(), { anisotropy });

  const steel = new THREE.MeshPhysicalMaterial({
    map: steelMap,
    color: 0xf6f9fa,
    metalness: 0.58,
    roughness: 0.33,
    roughnessMap: roughMap,
    clearcoat: 0.24,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.25,
  });

  const doorSteel = new THREE.MeshPhysicalMaterial({
    map: steelMap,
    color: 0xdfe3e4,
    metalness: 0.8,
    roughness: 0.33,
    roughnessMap: roughMap,
    clearcoat: 0.18,
    envMapIntensity: 1.05,
  });

  const blue = new THREE.MeshPhysicalMaterial({
    color: COLORS.paintBlue,
    metalness: 0.1,
    roughness: 0.22,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.4,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x081114,
    metalness: 0.05,
    roughness: 0.46,
    clearcoat: 0.14,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.16,
    emissive: 0x060f12,
    emissiveIntensity: 1,
  });

  return {
    steel,
    doorSteel,
    blue,
    glass,
    gasket: new THREE.MeshStandardMaterial({ color: 0x090c0d, roughness: 0.55, metalness: 0.1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 0.72 }),
    aperture: new THREE.MeshStandardMaterial({ color: 0x050708, roughness: 0.8 }),
    skirt: new THREE.MeshStandardMaterial({ color: 0x2a2e2f, roughness: 0.55, metalness: 0.35 }),
    endPanel: new THREE.MeshStandardMaterial({ color: 0x1c1f20, roughness: 0.65, metalness: 0.2 }),
    roof: new THREE.MeshStandardMaterial({
      map: roofMap,
      color: 0xcdd3d4,
      roughness: 0.56,
      metalness: 0.22,
    }),
    roofDark: new THREE.MeshStandardMaterial({ color: 0x4a5051, roughness: 0.62 }),
    ac: new THREE.MeshStandardMaterial({
      map: roofMap,
      color: 0xb9c0c1,
      roughness: 0.62,
      metalness: 0.16,
    }),
    grille: new THREE.MeshStandardMaterial({
      map: grilleMap,
      color: 0xdfe4e4,
      roughness: 0.62,
      metalness: 0.2,
    }),
    bogie: new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.63, metalness: 0.35 }),
    bogieDark: new THREE.MeshStandardMaterial({ color: 0x0c0e0f, roughness: 0.6, metalness: 0.35 }),
    motor: new THREE.MeshStandardMaterial({ color: 0x242829, roughness: 0.55, metalness: 0.5 }),
    axle: new THREE.MeshStandardMaterial({ color: 0x3e4344, roughness: 0.35, metalness: 0.8 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x1a1d1e, roughness: 0.55, metalness: 0.5 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x777d7e, roughness: 0.28, metalness: 0.9 }),
    spring: new THREE.MeshStandardMaterial({ color: 0x2f3334, roughness: 0.5, metalness: 0.5 }),
    equipment: new THREE.MeshStandardMaterial({ color: 0x3d4243, roughness: 0.58, metalness: 0.4 }),
    bellows: new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: 0.86 }),
    bellowsRib: new THREE.MeshStandardMaterial({ color: 0x171a1b, roughness: 0.8 }),
    lightHousing: new THREE.MeshStandardMaterial({ color: 0x121617, roughness: 0.35, metalness: 0.65 }),
    sideDecal: new THREE.MeshStandardMaterial({
      map: texture(makeSideDecal(), { anisotropy }),
      transparent: true,
      roughness: 0.42,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    sideGlowMap,
    doorLeaf: new THREE.MeshPhysicalMaterial({
      map: doorLeafMap,
      emissiveMap: doorGlowMap,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      metalness: 0.5,
      roughness: 0.34,
      envMapIntensity: 1.0,
    }),
  };
}

// ---------------------------------------------------------------------------

export function createTrain({ anisotropy = 8, color = '#0b5fae' } = {}) {
  const materials = makeMaterials(anisotropy);
  const lineTint = new THREE.Color(color);
  materials.blue.color.copy(lineTint);
  const frontCanvas = makeFrontTexture(color);
  const destinations = {
    RAIDURG: texture(makeDestination('RAIDURG'), { anisotropy }),
    NAGOLE: texture(makeDestination('NAGOLE'), { anisotropy }),
  };
  const sideTextures = [0, 1, 2].map((carIndex) =>
    texture(makeSideLivery(color, { carIndex }), { anisotropy })
  );
  const sideMirrors = sideTextures.map((t) => {
    const m = t.clone();
    m.wrapS = THREE.RepeatWrapping;
    m.repeat.x = -1;
    m.offset.x = 1;
    m.needsUpdate = true;
    return m;
  });
  const texturesData = {
    front: texture(frontCanvas, { anisotropy }),
    side: sideTextures,
    sideMirror: sideMirrors,
  };
  const textures = {
    glow: texture(makeGlow(), { anisotropy }),
    contact: texture(makeContactShadow(), { anisotropy }),
    destination: destinations.RAIDURG,
  };

  const cars = [];
  for (let i = 0; i < 3; i++) {
    const isLead = i === 2;
    const isRear = i === 0;
    const built = buildCar(materials, textures, texturesData, {
      index: i,
      cabPlus: isLead,
      cabMinus: isRear,
    });
    built.index = i;
    built.offset = (i - 1) * TRAIN.carSpacing;
    built.wheels = [];
    // Collapse the ~150 static meshes per car into one mesh per material.
    // Door leaves stay separate so they can slide.
    const packed = mergeByMaterial(built.group);
    packed.name = `car-${i}`;
    built.group = packed;
    cars.push(built);
  }

  // head / tail lighting
  const setCabMode = (cab, mode) => {
    if (!cab) return;
    const head = mode === 'head';
    const tail = mode === 'tail';
    for (const light of cab.headlights) {
      light.lampMat.emissive.setHex(head ? 0xfff3dc : tail ? 0xff1a12 : 0x0a0a0a);
      light.lampMat.emissiveIntensity = head ? 3.8 : tail ? 2.6 : 0;
      light.barMat.emissive.setHex(head ? 0xdff4ff : tail ? 0x9b0d08 : 0x050505);
      light.barMat.emissiveIntensity = head ? 3.2 : tail ? 0.8 : 0;
      light.glowMat.color.setHex(head ? 0xfff2d8 : 0xff2a1e);
      light.glowMat.opacity = head ? 0.55 : tail ? 0.32 : 0;
    }
    cab.destMat.emissiveIntensity = head ? 2.8 : 0.18;
  };
  setCabMode(cars[2].cabA, 'head');
  setCabMode(cars[0].cabB, 'tail');

  const root = new THREE.Group();
  root.name = 'train-detailed';
  for (const c of cars) root.add(c.group);

  return {
    group: root,
    cars,
    materials,
    setCabMode,
    setMode(direction = 1) {
      // direction +1: leading cab is the +Z cab of the last car
      setCabMode(direction > 0 ? cars[2].cabA : cars[0].cabB, 'head');
      setCabMode(direction > 0 ? cars[0].cabB : cars[2].cabA, 'tail');
    },
    setDestination(name) {
      const tex = destinations[name] || destinations.RAIDURG;
      for (const car of cars) {
        for (const cab of [car.cabA, car.cabB]) {
          if (!cab) continue;
          cab.destMat.emissiveMap = tex;
          cab.destMat.needsUpdate = true;
        }
      }
    },
    setDoors(openness = 0) {
      const o = THREE.MathUtils.clamp(openness, 0, 1);
      for (const car of cars) {
        for (const door of car.doors) {
          door.group.position.z = door.baseZ + door.leafSide * o * 0.64;
        }
      }
    },
    setNight(night) {
      materials.glass.emissive.setHex(night ? 0x3a2a16 : 0x060f12);
      materials.glass.emissiveIntensity = night ? 1.25 : 1;
      materials.glass.color.setHex(night ? 0x1a140c : 0x081114);
      materials.doorLeaf.emissiveIntensity = night ? 0.85 : 0;
      // At night the stainless picks up the city: a faint cool emissive plus a
      // stronger environment term keeps the body from going pure black.
      materials.steel.emissive.setHex(night ? 0x1a2330 : 0x000000);
      materials.steel.emissiveIntensity = night ? 0.6 : 0;
      materials.steel.envMapIntensity = night ? 1.5 : 1.25;
      for (const car of cars) {
        for (const m of car.sideMats || []) {
          m.emissiveIntensity = night ? 0.95 : 0;
          m.envMapIntensity = night ? 1.15 : 0.55;
          m.color.setHex(night ? 0x9aa2a6 : 0xffffff);
        }
        for (const cab of [car.cabA, car.cabB]) {
          if (cab && cab.destMat) cab.destMat.emissiveIntensity = night ? 2.4 : 0.18;
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Low-detail set used for every train that is not the one being followed.
// Four merged meshes for the whole 3-car set.
// ---------------------------------------------------------------------------

export function createTrainProxy({ color = '#0b5fae' } = {}) {
  const group = new THREE.Group();
  group.name = 'train-proxy';

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.42,
    envMapIntensity: 0.9,
  });
  const headMat = new THREE.MeshBasicMaterial({ color: 0x161310 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x2a0705 });

  const silver = new THREE.Color(0xd8dcdd);
  const glass = new THREE.Color(0x0b1518);
  const accent = new THREE.Color(color);
  const dark = new THREE.Color(0x23282a);

  const paint = (geom, col) => {
    const n = geom.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geom;
  };

  const cars = [];
  for (let i = 0; i < 3; i++) {
    const cz = (i - 1) * TRAIN.carSpacing;
    const parts = [];
    parts.push(paint(new THREE.BoxGeometry(TRAIN.width, 2.6, TRAIN.shellLength).translate(0, 2.34, cz), silver));
    parts.push(paint(new THREE.BoxGeometry(2.5, 0.14, TRAIN.shellLength).translate(0, 3.7, cz), silver));
    parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.015, 1.04, TRAIN.shellLength - 3).translate(0, 2.58, cz), glass));
    parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.02, 0.1, TRAIN.shellLength - 0.1).translate(0, 3.1, cz), accent));
    parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.018, 0.46, TRAIN.shellLength - 0.1).translate(0, 3.38, cz), accent));
    parts.push(paint(new THREE.BoxGeometry(2.66, 0.5, TRAIN.shellLength - 0.2).translate(0, 0.8, cz), dark));
    parts.push(paint(new THREE.BoxGeometry(2.3, 0.42, 2.6).translate(0, 0.62, cz - 7.9), dark));
    parts.push(paint(new THREE.BoxGeometry(2.3, 0.42, 2.6).translate(0, 0.62, cz + 7.9), dark));
    for (const dz of TRAIN.doorCentres) {
      parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.022, 1.9, 1.3).translate(0, 2.2, cz + dz), glass));
    }
    // cab ends
    for (const end of [-1, 1]) {
      const z = cz + end * (TRAIN.shellLength / 2 + 0.04);
      parts.push(paint(new THREE.BoxGeometry(2.2, 1.02, 0.14).translate(0, 2.72, z), glass));
      parts.push(paint(new THREE.BoxGeometry(2.72, 0.34, 0.16).translate(0, 3.52, z), accent));
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    cars.push(mesh);
    parts.forEach((g) => g.dispose());
  }

  // head / tail lamps at each end
  const zf = TRAIN.carSpacing + TRAIN.shellLength / 2;
  const lampPair = (z, material) => {
    const gs = [
      new THREE.PlaneGeometry(0.55, 0.2).translate(-0.95, 1.95, z),
      new THREE.PlaneGeometry(0.55, 0.2).translate(0.95, 1.95, z),
    ];
    const mesh = new THREE.Mesh(mergeGeometries(gs), material);
    gs.forEach((g) => g.dispose());
    group.add(mesh);
    return mesh;
  };
  lampPair(zf + 0.08, headMat);
  lampPair(-zf - 0.08, tailMat);

  return {
    group,
    cars,
    setMode(direction) {
      const forward = direction > 0;
      headMat.color.setHex(forward ? 0xfff2d0 : 0x2a0705);
      tailMat.color.setHex(forward ? 0x2a0705 : 0xff3020);
    },
    setDoors() {},
    setDestination() {},
    setNight(night) {
      mat.emissive.setHex(night ? 0x120d06 : 0x000000);
      mat.emissiveIntensity = night ? 0.55 : 0;
      headMat.color.setHex(night ? 0xfff5da : 0x161310);
      tailMat.color.setHex(night ? 0xff3020 : 0x2a0705);
    },
  };
}
