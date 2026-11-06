import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { TRAIN, COLORS } from './config.js?v=20261106g';
import { mergeByMaterial, mergeGeometries } from './geomutil.js?v=20261106g';
import { makeGlowRadial } from './materials.js?v=20261106g';

// ---------------------------------------------------------------------------
// Hyderabad Metro (Hyundai Rotem) 3-car set — procedural model.
//
// Modelled from the reference sheets and photographs in `references/`:
//   · D–M–D formation, 21.4 m cars, 2.9 m wide, 3.72 m rail-to-roof
//   · fluted stainless body, royal-blue cantrail band, no waist stripe on the
//     saloon sides (the tricolour only appears at the cabs)
//   · cab cars: three double doors + three panoramic saloon windows + cab door
//   · middle car: four double doors + three panoramic windows
//   · raked, rounded cab nose with a dark navy canopy, wrap-around windscreen,
//     the red/green/blue "smile" and the blue nose band carrying the roundel
// ---------------------------------------------------------------------------

const BODY_BOTTOM = 0.9;
const BODY_TOP = 3.72;
const BODY_HALF = TRAIN.bodyHalf; // 9.6 — flat flank; the nose continues past it
const CAR_TIP = TRAIN.carLength / 2; // 10.7
const BLUE_BOTTOM = 3.19;
const BLUE_TOP = 3.64;
const GLASS_BOTTOM = 2.02;
const GLASS_TOP = 3.12;
const DOOR_BOTTOM = 1.02;
const DOOR_TOP = 3.17;
const DOOR_W = TRAIN.doorWidth; // 1.72
const DOOR_LEAF = DOOR_W / 2;
const WINDOW_W = TRAIN.windowWidth; // 2.05

let proxyGlowTex = null;

// ---------------------------------------------------------------------------
// canvas helpers
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

function roundRectPath(g, x, y, w, h, r) {
  const rr = Math.max(0.5, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function drawHmrMark(g, cx, cy, r, { light = true, ring = true } = {}) {
  g.save();
  // white disc with a royal-blue rim
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = light ? '#f7faf9' : '#0a4c8e';
  g.fill();
  if (ring) {
    g.lineWidth = Math.max(1, r * 0.17);
    g.strokeStyle = '#0b5fae';
    g.beginPath();
    g.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    g.stroke();
  }
  // three curved blades (green / red / blue) forming the HMR pinwheel
  const blades = [
    ['#11a04f', Math.PI * 0.16, Math.PI * 0.83],
    ['#e23227', Math.PI * 0.83, Math.PI * 1.5],
    ['#0b5fae', Math.PI * 1.5, Math.PI * 2.17],
  ];
  g.lineCap = 'round';
  for (const [col, a0, a1] of blades) {
    g.strokeStyle = col;
    g.lineWidth = Math.max(1, r * 0.34);
    g.beginPath();
    g.arc(cx, cy, r * 0.55, a0, a1);
    g.stroke();
  }
  // pinwheel centre
  g.fillStyle = '#f7faf9';
  g.beginPath();
  g.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawHmrWordmark(g, cx, cy, scale = 1, { color = '#0b4f9c' } = {}) {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.font = `800 ${Math.round(13 * scale)}px Inter, "Helvetica Neue", sans-serif`;
  g.letterSpacing = `${Math.round(1.2 * scale)}px`;
  g.fillText('HYDERABAD', cx, cy - 12 * scale);
  g.font = `900 ${Math.round(22 * scale)}px Inter, "Helvetica Neue", sans-serif`;
  g.letterSpacing = `${Math.round(1.6 * scale)}px`;
  g.fillText('METRO', cx, cy + 9 * scale);
  g.restore();
}

// ---------------------------------------------------------------------------
// generic maps
// ---------------------------------------------------------------------------

function makeBrushedSteel() {
  const c = canvas2d(1024, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f2f5f5');
  grad.addColorStop(0.35, '#e8ecec');
  grad.addColorStop(0.72, '#dfe4e4');
  grad.addColorStop(1, '#d2d8d8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 4200; i++) {
    const y = Math.random() * 512;
    const x = Math.random() * 1024;
    const len = 40 + Math.random() * 400;
    const a = 0.006 + Math.random() * 0.03;
    g.strokeStyle = Math.random() > 0.45 ? `rgba(255,255,255,${a})` : `rgba(70,80,82,${a})`;
    g.lineWidth = 0.5 + Math.random() * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + (Math.random() - 0.5) * 1.1);
    g.stroke();
  }
  return c;
}

function makeSteelRoughness() {
  const c = canvas2d(512, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#8e8e8e';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * 256;
    const v = 90 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v},0.12)`;
    g.fillRect(Math.random() * 512, y, 20 + Math.random() * 130, 0.7);
  }
  return c;
}

function makeRoofTexture() {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#c9ced0';
  g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 34) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x, 0, 1, 512);
    g.fillStyle = 'rgba(58,66,68,0.12)';
    g.fillRect(x + 1, 0, 1, 512);
  }
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(30,36,38,${Math.random() * 0.025})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 90, 1);
  }
  return c;
}

function makeGrille() {
  const c = canvas2d(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#8c9294';
  g.fillRect(0, 0, 256, 256);
  for (let y = 5; y < 256; y += 9) {
    g.fillStyle = 'rgba(24,29,30,0.85)';
    g.fillRect(4, y, 248, 3);
    g.fillStyle = 'rgba(240,246,246,0.2)';
    g.fillRect(4, y + 3, 248, 1);
  }
  g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.lineWidth = 5;
  g.strokeRect(2, 2, 252, 252);
  return c;
}

function makeGlow() {
  const c = canvas2d(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.16, 'rgba(255,247,228,0.8)');
  gr.addColorStop(0.44, 'rgba(255,222,178,0.2)');
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
  gr.addColorStop(0.1, 'rgba(0,0,0,0.48)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0.62)');
  gr.addColorStop(0.9, 'rgba(0,0,0,0.48)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 1024);
  const side = g.createLinearGradient(0, 0, 256, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.22, 'rgba(0,0,0,1)');
  side.addColorStop(0.78, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = side;
  g.fillRect(0, 0, 256, 1024);
  return c;
}

function makeDestination(text = 'RAIDURG') {
  const c = canvas2d(512, 96);
  const g = c.getContext('2d');
  g.fillStyle = '#080b0c';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ff9a2e';
  g.font = '600 50px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,140,30,0.85)';
  g.shadowBlur = 12;
  g.fillText(text, 256, 51);
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.36)';
  for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 512, 1);
  for (let x = 0; x < 512; x += 3) g.fillRect(x, 0, 1, 96);
  return c;
}

// ---------------------------------------------------------------------------
// layout
//
// Positions are car-local Z (metres, +Z towards the cab on a cab car).
// The reference sheet gives three double doors per cab car, alternating with
// three panoramic windows; the middle car carries four doors.
// ---------------------------------------------------------------------------

function carLayout(cabSign) {
  // Four double doors per side on every car, with three panoramic windows
  // between them.  Cab cars carry an extra driver's side window right behind
  // the nose.
  if (cabSign === 0) {
    return {
      cab: false,
      doors: [-7.5, -2.5, 2.5, 7.5],
      windows: [-5, 0, 5],
      cabWindow: null,
    };
  }
  return {
    cab: true,
    doors: [6.0, 1.4, -3.2, -7.8].map((z) => z * cabSign),
    windows: [3.7, -0.9, -5.5].map((z) => z * cabSign),
    cabWindow: 8.70 * cabSign,
    sign: cabSign,
  };
}

// ---------------------------------------------------------------------------
// side livery
// ---------------------------------------------------------------------------

function drawGlass(g, z, w, y0, y1, { panes = 3, cab = false } = {}) {
  const X = g.__X;
  const Y = g.__Y;
  const x0 = Math.min(X(z - w / 2), X(z + w / 2));
  const x1 = Math.max(X(z - w / 2), X(z + w / 2));
  const yb = Y(y1);
  const yt = Y(y0);
  const pad = (x1 - x0) * 0.045;
  const py = (yb - yt) * 0.05;
  // gasket
  g.fillStyle = '#080b0c';
  roundRectPath(g, x0 - pad, yt - py, x1 - x0 + pad * 2, yb - yt + py * 2, Math.min(14, (x1 - x0) * 0.12));
  g.fill();
  // sky-lit glass
  const gr = g.createLinearGradient(x0, yt, x1, yb);
  if (cab) {
    gr.addColorStop(0, '#24363d');
    gr.addColorStop(0.4, '#162429');
    gr.addColorStop(0.7, '#0d171b');
    gr.addColorStop(1, '#18262b');
  } else {
    gr.addColorStop(0, '#22343b');
    gr.addColorStop(0.3, '#31464d');
    gr.addColorStop(0.55, '#101c20');
    gr.addColorStop(0.8, '#17262b');
    gr.addColorStop(1, '#0d161a');
  }
  g.fillStyle = gr;
  roundRectPath(g, x0, yt, x1 - x0, yb - yt, Math.min(9, (x1 - x0) * 0.08));
  g.fill();

  // sky reflection sweep
  g.save();
  g.beginPath();
  roundRectPath(g, x0, yt, x1 - x0, yb - yt, 8);
  g.clip();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = cab ? 0.16 : 0.14;
  g.fillStyle = '#c9e4f0';
  g.beginPath();
  const sw = (x1 - x0) * 0.34;
  g.moveTo(x0 + (x1 - x0) * 0.1, yt);
  g.lineTo(x0 + (x1 - x0) * 0.1 + sw * 0.55, yt);
  g.lineTo(x0 + (x1 - x0) * 0.1 + sw * 0.2, yb);
  g.lineTo(x0 + (x1 - x0) * 0.1 - sw * 0.35, yb);
  g.closePath();
  g.fill();
  g.restore();

  // interior: warm ceiling, seat backs, poles
  if (!cab) {
    g.save();
    roundRectPath(g, x0, yt, x1 - x0, yb - yt, 8);
    g.clip();
    g.fillStyle = 'rgba(58,44,30,0.35)';
    g.fillRect(x0, yb - (yb - yt) * 0.28, x1 - x0, (yb - yt) * 0.28);
    g.fillStyle = 'rgba(20,26,27,0.42)';
    const n = 3;
    for (let i = 0; i < n; i++) {
      const bx = x0 + (x1 - x0) * (0.18 + i * 0.32);
      g.fillRect(bx, yb - (yb - yt) * 0.32, Math.max(4, (x1 - x0) * 0.055), (yb - yt) * 0.3);
    }
    g.fillStyle = 'rgba(196,208,206,0.2)';
    for (let i = 0; i < 2; i++) {
      const px = x0 + (x1 - x0) * (0.3 + i * 0.4);
      g.fillRect(px, yt + 2, Math.max(1, (x1 - x0) * 0.008), yb - yt - 4);
    }
    g.restore();
  }

  // slim mullions
  if (panes > 1) {
    for (let i = 1; i < panes; i++) {
      const mx = x0 + ((x1 - x0) * i) / panes;
      g.fillStyle = 'rgba(188,198,198,0.6)';
      g.fillRect(mx - 1.1, yt, 2.2, yb - yt);
      g.fillStyle = 'rgba(8,12,13,0.5)';
      g.fillRect(mx - 2.2, yt, 1, yb - yt);
    }
  }
  // top glint
  g.fillStyle = 'rgba(230,240,242,0.26)';
  g.fillRect(x0 + pad * 0.5, yt + 1, x1 - x0 - pad, 1.4);
}

// Turn a painted saloon window into a real opening. The gasket ring and the
// mullions stay opaque; the glazing itself is punched out so the modelled
// saloon, seats and lit ceiling show through the tinted glass in 3D.
function punchWindow(g, z, w, y0, y1, panes = 3) {
  const X = g.__X;
  const Y = g.__Y;
  const x0 = Math.min(X(z - w / 2), X(z + w / 2));
  const x1 = Math.max(X(z - w / 2), X(z + w / 2));
  const yb = Y(y1);
  const yt = Y(y0);
  const pad = (x1 - x0) * 0.045;
  const py = (yb - yt) * 0.05;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fillRect(x0 + pad * 0.35, yt + py * 0.35, x1 - x0 - pad * 0.7, yb - yt - py * 0.7);
  g.restore();

  // mullions, drawn back opaque on top of the opening
  if (panes > 1) {
    for (let i = 1; i < panes; i++) {
      const mx = x0 + ((x1 - x0) * i) / panes;
      g.fillStyle = 'rgba(24,30,31,0.92)';
      g.fillRect(mx - 2.2, yt, 3.2, yb - yt);
      g.fillStyle = 'rgba(196,206,206,0.55)';
      g.fillRect(mx - 1.4, yt, 1.2, yb - yt);
    }
  }
  // keep the frame edge crisp
  g.strokeStyle = 'rgba(10,14,15,0.9)';
  g.lineWidth = 3;
  g.strokeRect(x0 + pad * 0.35, yt + py * 0.35, x1 - x0 - pad * 0.7, yb - yt - py * 0.7);
}

function drawDoorOpening(g, z, w, y0, y1) {
  const X = g.__X;
  const Y = g.__Y;
  const x0 = Math.min(X(z - w / 2), X(z + w / 2));
  const x1 = Math.max(X(z - w / 2), X(z + w / 2));
  const yb = Y(y1);
  const yt = Y(y0);
  // dark aperture
  g.fillStyle = '#0a0e10';
  g.fillRect(x0, yt, x1 - x0, yb - yt);
  const inner = g.createLinearGradient(x0, yt, x0, yb);
  inner.addColorStop(0, '#191f20');
  inner.addColorStop(0.45, '#37352d');
  inner.addColorStop(0.75, '#141818');
  inner.addColorStop(1, '#090c0d');
  g.fillStyle = inner;
  g.fillRect(x0 + 2, yt + 2, x1 - x0 - 4, yb - yt - 4);
  // warm saloon hint and silhouettes
  g.fillStyle = 'rgba(255,196,110,0.1)';
  g.fillRect(x0 + 6, yt + 10, x1 - x0 - 12, (yb - yt) * 0.55);
  g.fillStyle = 'rgba(30,26,20,0.55)';
  g.fillRect(x0 + 8, yb - (yb - yt) * 0.28, x1 - x0 - 16, (yb - yt) * 0.24);
  for (let i = 0; i < 2; i++) {
    const bx = x0 + (x1 - x0) * (0.28 + i * 0.4);
    g.fillRect(bx, yb - (yb - yt) * 0.3, Math.max(3, (x1 - x0) * 0.05), (yb - yt) * 0.28);
  }
  // jambs
  g.fillStyle = 'rgba(214,222,222,0.4)';
  g.fillRect(x0, yt, 1.5, yb - yt);
  g.fillRect(x1 - 1.5, yt, 1.5, yb - yt);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(x0, yt, (x1 - x0) * 0.02, yb - yt);
}

function makeSideLivery(color = '#0a5fa8', { cabSign = 0, mirror = false } = {}) {
  const W = 2048;
  const H = 512;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const half = BODY_HALF;
  const yTop = BODY_TOP;
  const yBot = BODY_BOTTOM;
  const X = (z) => (mirror ? (half - z) : (z + half)) / (half * 2) * W;
  const Y = (y) => ((yTop - y) / (yTop - yBot)) * H;
  g.__X = X;
  g.__Y = Y;
  const layout = carLayout(cabSign);

  // brushed stainless base
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#e9edee');
  base.addColorStop(0.18, '#e0e5e6');
  base.addColorStop(0.58, '#d8ddde');
  base.addColorStop(0.86, '#cbd1d2');
  base.addColorStop(1, '#bcc2c3');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // longitudinal fluting
  for (let y = 2; y < H; y += 7) {
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(62,72,74,0.13)';
    g.fillRect(0, y + 1, W, 1);
  }

  // panel seams
  const seams = new Set();
  for (const z of layout.doors) {
    seams.add(z - DOOR_W / 2 - 0.35);
    seams.add(z + DOOR_W / 2 + 0.35);
  }
  for (const z of layout.windows) {
    seams.add(z - WINDOW_W / 2 - 0.28);
    seams.add(z + WINDOW_W / 2 + 0.28);
  }
  if (layout.cabWindow != null) {
    seams.add(layout.cabWindow - 0.62);
    seams.add(layout.cabWindow + 0.62);
  }
  for (const z of seams) {
    const x = X(z);
    g.fillStyle = 'rgba(70,80,82,0.2)';
    g.fillRect(x, 0, 1.6, H);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x + 1.6, 0, 1, H);
  }

  // royal-blue cantrail band
  const by0 = Y(BLUE_TOP);
  const by1 = Y(BLUE_BOTTOM);
  const band = g.createLinearGradient(0, by0, 0, by1);
  band.addColorStop(0, '#0d6fc8');
  band.addColorStop(0.45, color);
  band.addColorStop(1, '#085394');
  g.fillStyle = band;
  g.fillRect(0, by0, W, by1 - by0);
  // crisp top/bottom edges
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, by0, W, 1.2);
  g.fillStyle = 'rgba(6,44,80,0.9)';
  g.fillRect(0, by1 - 2.4, W, 1.6);
  // tiny amber marker lamps along the cantrail
  for (let z = -half + 1.2; z < half - 1; z += 4.2) {
    const x = X(z);
    g.fillStyle = 'rgba(255,168,64,0.8)';
    g.beginPath();
    g.arc(x, Y(3.44), 1.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,220,160,0.3)';
    g.beginPath();
    g.arc(x, Y(3.44), 3.4, 0, Math.PI * 2);
    g.fill();
  }

  // door apertures (the sliding leaves sit over these)
  for (const z of layout.doors) drawDoorOpening(g, z, DOOR_W, DOOR_BOTTOM, DOOR_TOP);

  // panoramic saloon windows
  for (const z of layout.windows) drawGlass(g, z, WINDOW_W, GLASS_BOTTOM, GLASS_TOP, { panes: 3 });

  // cab side window — tall, narrow, black-framed, with a small sliding vent
  if (layout.cabWindow != null) {
    drawGlass(g, layout.cabWindow, 0.70, 2.06, 3.12, { panes: 2, cab: true });
    const x0 = Math.min(X(layout.cabWindow - 0.35), X(layout.cabWindow + 0.35));
    const x1 = Math.max(X(layout.cabWindow - 0.35), X(layout.cabWindow + 0.35));
    g.strokeStyle = 'rgba(8,12,13,0.92)';
    g.lineWidth = 3;
    g.strokeRect(x0 - 1, Y(3.12) - 1, x1 - x0 + 2, Y(2.06) - Y(3.12) + 2);
  }

  // tricolour waist stripe — cab cars only, sweeping up over the nose.
  // Order matches the reference: green over red over blue.
  if (layout.cab) {
    const sign = layout.sign;
    const zStart = 9.62 * sign;
    const zEnd = 6.55 * sign;
    const xa = X(zStart);
    const xb = X(zEnd);
    g.save();
    g.lineCap = 'round';
    const stripes = [
      [1.835, 5.2, '#12a150'],
      [1.765, 7.0, '#e23227'],
      [1.695, 8.2, '#0b5fae'],
    ];
    for (const [y, wdt, col] of stripes) {
      const y0 = Y(y);
      g.strokeStyle = col;
      g.lineWidth = wdt;
      g.beginPath();
      g.moveTo(xb, y0);
      g.lineTo(xa, y0);
      g.stroke();
    }
    // taper the inboard ends so the lines fade out cleanly
    const xt = X(zEnd + 0.35 * sign);
    for (const [y, wdt, col] of stripes) {
      g.strokeStyle = col;
      g.lineWidth = wdt * 0.7;
      g.beginPath();
      g.moveTo(xb, Y(y));
      g.lineTo(xt, Y(y));
      g.stroke();
    }
    g.restore();
  }

  // HMR roundel + wordmark lockup in the panel between cab window and door 1
  if (layout.cab) {
    const sign = layout.sign;
    const z = 7.55 * sign;
    const cx = X(z);
    drawHmrMark(g, cx, Y(2.96), 31, { light: true });
    drawHmrWordmark(g, cx, Y(2.52), 1.1);
  }

  // unit numbers near each cab
  if (layout.cab) {
    const sign = layout.sign;
    g.fillStyle = 'rgba(58,66,68,0.55)';
    g.font = '600 12px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    const x = Math.min(X(9.1 * sign), X(9.3 * sign));
    g.fillText('HMRL 03', x, Y(1.22));
  }

  // waist seam
  g.fillStyle = 'rgba(78,88,90,0.16)';
  g.fillRect(0, Y(1.22), W, 1.4);
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(0, Y(1.22) + 1.4, W, 1);

  // lower edge grime
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * W;
    const y = Y(1.02 + Math.random() * 0.2);
    g.fillStyle = `rgba(44,48,46,${Math.random() * 0.045})`;
    g.fillRect(x, y, 2 + Math.random() * 10, 1 + Math.random() * 4);
  }
  // gentle vertical shading toward the bottom
  const shade = g.createLinearGradient(0, Y(1.55), 0, H);
  shade.addColorStop(0, 'rgba(30,34,35,0)');
  shade.addColorStop(1, 'rgba(22,26,27,0.38)');
  g.fillStyle = shade;
  g.fillRect(0, Y(1.55), W, H - Y(1.55));

  // Cut the saloon glazing and the door apertures out of the flank. Everything
  // the shell still needs (pillars, sills, gaskets, jambs) stays opaque.
  for (const z of layout.windows) {
    punchWindow(g, z, WINDOW_W, GLASS_BOTTOM, GLASS_TOP, 3);
  }
  for (const z of layout.doors) {
    const x0 = Math.min(X(z - DOOR_W / 2), X(z + DOOR_W / 2));
    const x1 = Math.max(X(z - DOOR_W / 2), X(z + DOOR_W / 2));
    const yt = Y(DOOR_TOP);
    const yb = Y(DOOR_BOTTOM);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.fillRect(x0 + 3, yt + 3, x1 - x0 - 6, yb - yt - 6);
    g.restore();
  }

  return c;
}

function makeSideEmissive(cabSign = 0, mirror = false) {
  const W = 1024;
  const H = 256;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, W, H);
  const half = BODY_HALF;
  const yTop = BODY_TOP;
  const yBot = BODY_BOTTOM;
  const X = (z) => ((mirror ? (half - z) : (z + half)) / (half * 2)) * W;
  const Y = (y) => ((yTop - y) / (yTop - yBot)) * H;

  const pane = (z, w, h, yMid, strength = 1) => {
    const x0 = X(z - w / 2);
    const x1 = X(z + w / 2);
    const y0 = Y(yMid + h / 2);
    const y1 = Y(yMid - h / 2);
    g.save();
    g.shadowColor = 'rgba(255,190,110,0.9)';
    g.shadowBlur = 14;
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, `rgba(255,226,180,${0.94 * strength})`);
    gr.addColorStop(0.45, `rgba(255,206,142,${0.84 * strength})`);
    gr.addColorStop(1, `rgba(214,150,84,${0.62 * strength})`);
    g.fillStyle = gr;
    g.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
    g.fillStyle = `rgba(40,26,12,${0.42 * strength})`;
    g.fillRect(x0 + 4, y1 - (y1 - y0) * 0.32, x1 - x0 - 8, 3);
    g.restore();
  };

  const layout = carLayout(cabSign);
  for (const z of layout.windows) pane(z, WINDOW_W, 1.04, 2.58);
  if (layout.cabWindow != null) pane(layout.cabWindow, 0.70, 1.0, 2.6, 0.55);
  for (const z of layout.doors) pane(z, 1.0, 1.35, 2.4, 0.55);
  return c;
}

function makeDoorLeaf() {
  const W = 256;
  const H = 768;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#f0f3f3');
  base.addColorStop(0.3, '#e3e8e8');
  base.addColorStop(0.7, '#d5dbdb');
  base.addColorStop(1, '#c3caca');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let y = 4; y < H; y += 10) {
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(58,66,68,0.09)';
    g.fillRect(0, y + 1, W, 1);
  }
  // glazed aperture — tall, narrow, rounded
  g.fillStyle = '#090d0e';
  roundRectPath(g, 58, 26, W - 116, H * 0.44, 10);
  g.fill();
  const gl = g.createLinearGradient(0, 26, W, H * 0.46);
  gl.addColorStop(0, '#1b2a2f');
  gl.addColorStop(0.35, '#30444a');
  gl.addColorStop(0.55, '#101b1f');
  gl.addColorStop(1, '#1d2c31');
  g.fillStyle = gl;
  roundRectPath(g, 63, 31, W - 126, H * 0.44 - 10, 8);
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.17;
  g.fillStyle = '#d6ebf4';
  g.beginPath();
  g.moveTo(78, 32);
  g.lineTo(126, 32);
  g.lineTo(94, H * 0.44);
  g.lineTo(66, H * 0.44);
  g.closePath();
  g.fill();
  g.restore();
  // centre seam
  g.fillStyle = 'rgba(54,62,64,0.5)';
  g.fillRect(W / 2 - 1, 0, 2, H);
  g.fillStyle = 'rgba(22,26,27,0.55)';
  g.fillRect(0, 0, 5, H);
  g.fillRect(W - 5, 0, 5, H);
  // waist seam
  g.fillStyle = 'rgba(80,90,92,0.28)';
  g.fillRect(0, H * 0.64, W, 2);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(0, H * 0.64 + 2, W, 1);
  // small blue door sticker
  g.fillStyle = '#1f74c4';
  g.fillRect(W / 2 - 11, H * 0.655, 22, 15);
  g.fillStyle = '#eaf4fb';
  g.font = '700 10px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.fillText('D', W / 2, H * 0.655 + 12);
  // handle
  g.fillStyle = '#1c2122';
  roundRectPath(g, W - 46, H * 0.7, 10, 74, 5);
  g.fill();
  g.fillStyle = 'rgba(230,238,238,0.4)';
  g.fillRect(W - 44, H * 0.7 + 4, 2, 66);
  // kick plate
  const kick = g.createLinearGradient(0, H * 0.84, 0, H);
  kick.addColorStop(0, 'rgba(70,76,76,0.16)');
  kick.addColorStop(1, 'rgba(40,46,46,0.46)');
  g.fillStyle = kick;
  g.fillRect(0, H * 0.84, W, H * 0.16);
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
  g.shadowBlur = 18;
  const gr = g.createLinearGradient(0, 28, 0, H * 0.46);
  gr.addColorStop(0, 'rgba(255,224,172,0.7)');
  gr.addColorStop(1, 'rgba(224,162,92,0.4)');
  g.fillStyle = gr;
  roundRectPath(g, 63, 31, W - 126, H * 0.44 - 10, 8);
  g.fill();
  g.restore();
  return c;
}

// ---------------------------------------------------------------------------
// front face (mapped onto the curved nose cap)
// ---------------------------------------------------------------------------

function makeFrontTexture(color = '#0b5fae') {
  const W = 1024;
  const H = 1024;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  // local space: x -1.31..1.31, y 0.90..3.72
  const xw = 2.62;
  const yb = BODY_BOTTOM;
  const yt = BODY_TOP;
  const X = (x) => ((x + xw / 2) / xw) * W;
  const Y = (y) => ((yt - y) / (yt - yb)) * H;

  // silver base
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#d6dbdc');
  base.addColorStop(0.32, '#e8ecec');
  base.addColorStop(0.72, '#dde2e3');
  base.addColorStop(1, '#c2c8c9');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // faint brushing
  for (let i = 0; i < 2600; i++) {
    const v = Math.random() > 0.5 ? 255 : 60;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.025})`;
    g.fillRect(Math.random() * W, Math.random() * H, 40 + Math.random() * 200, 1);
  }

  // dark navy canopy — wraps the header and dives down the A-pillars
  const canopy = g.createLinearGradient(0, 0, 0, Y(2.0));
  canopy.addColorStop(0, '#0b1420');
  canopy.addColorStop(0.6, '#10202c');
  canopy.addColorStop(1, '#172b38');
  g.fillStyle = canopy;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, Y(2.02));
  g.bezierCurveTo(W * 0.975, Y(2.44), W * 0.958, Y(3.0), W * 0.90, Y(3.0));
  g.lineTo(W * 0.10, Y(3.0));
  g.bezierCurveTo(W * 0.042, Y(3.0), W * 0.025, Y(2.44), 0, Y(2.02));
  g.closePath();
  g.fill();

  // royal-blue A-pillar strips wrapping in from the side band
  for (const side of [-1, 1]) {
    const ex = side < 0 ? -10 : W + 10;
    const ix = side < 0 ? W * 0.052 : W * 0.948;
    const gr = g.createLinearGradient(0, Y(3.62), 0, Y(1.66));
    gr.addColorStop(0, '#0d6fc8');
    gr.addColorStop(0.5, color);
    gr.addColorStop(1, '#07518f');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(ex, Y(3.62));
    g.lineTo(ix, Y(3.62));
    g.lineTo(ix, Y(1.72));
    g.quadraticCurveTo(ix, Y(1.66), ex, Y(1.66));
    g.closePath();
    g.fill();
  }

  // destination display recess (the emissive plane sits just proud of it)
  g.fillStyle = '#070b0c';
  roundRectPath(g, W * 0.345, Y(3.43), W * 0.31, Y(3.29) - Y(3.43), 6);
  g.fill();

  // windscreen — three panes in a heavy black frame, spanning nearly the
  // full width so only a sliver of silver shows beside it
  const x0t = W * 0.086;
  const x1t = W * 0.914;
  const x0b = W * 0.10;
  const x1b = W * 0.90;
  const wsTop = Y(3.02);
  const wsBot = Y(1.98);
  g.fillStyle = '#05090b';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x0t - 16, wsTop - 16);
  g.lineTo(x1t + 16, wsTop - 16);
  g.lineTo(x1b + 16, wsBot + 16);
  g.lineTo(x0b - 16, wsBot + 16);
  g.closePath();
  g.fill();

  // clip to a rounded screen aperture
  g.save();
  const wsPath = () => {
    g.beginPath();
    g.moveTo(x0t + 10, wsTop);
    g.lineTo(x1t - 10, wsTop);
    g.quadraticCurveTo(x1t, wsTop, x1t, wsTop + 18);
    g.lineTo(x1b, wsBot - 18);
    g.quadraticCurveTo(x1b, wsBot, x1b - 12, wsBot);
    g.lineTo(x0b + 12, wsBot);
    g.quadraticCurveTo(x0b, wsBot, x0b, wsBot - 18);
    g.lineTo(x0t, wsTop + 18);
    g.quadraticCurveTo(x0t, wsTop, x0t + 10, wsTop);
    g.closePath();
  };
  wsPath();
  g.clip();
  const gl = g.createLinearGradient(x0t, wsTop, x1t, wsBot);
  gl.addColorStop(0, '#2b4048');
  gl.addColorStop(0.28, '#33494f');
  gl.addColorStop(0.52, '#0d191d');
  gl.addColorStop(0.78, '#081013');
  gl.addColorStop(1, '#142126');
  g.fillStyle = gl;
  g.fillRect(0, wsTop, W, wsBot - wsTop);
  // sky reflection
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.12;
  g.fillStyle = '#cfe6f2';
  g.beginPath();
  g.moveTo(W * 0.13, wsTop);
  g.lineTo(W * 0.32, wsTop);
  g.lineTo(W * 0.20, wsBot);
  g.lineTo(W * 0.09, wsBot);
  g.closePath();
  g.fill();
  g.restore();
  // wipers — one per pane
  g.strokeStyle = 'rgba(6,9,10,0.92)';
  g.lineWidth = 4;
  for (const [a, b] of [[0.24, 0.16], [0.5, 0.5], [0.76, 0.84]]) {
    g.beginPath();
    g.moveTo(W * a, wsBot - 8);
    g.lineTo(W * b, wsTop + 30);
    g.stroke();
  }
  // heavy pillars between the three panes
  for (const fx of [0.365, 0.635]) {
    g.fillStyle = '#05090b';
    g.fillRect(W * fx - 6, wsTop - 4, 12, wsBot - wsTop + 8);
    g.fillStyle = 'rgba(150,168,172,0.22)';
    g.fillRect(W * fx + 6, wsTop, 1.4, wsBot - wsTop);
  }
  g.restore();

  // the "smile": red over thick green over blue, dipping at the centre
  const smileTop = (x) =>
    Y(1.96) + (1 - Math.pow((x - W / 2) / (W / 2), 2)) * (Y(1.90) - Y(1.96));

  // blue nose band (carries the roundel and the headlamps)
  const noseTop = (x) => smileTop(x) + 64;
  const noseBot = Y(1.42);
  const noseGrad = g.createLinearGradient(0, Y(1.9), 0, noseBot);
  noseGrad.addColorStop(0, '#0d6fc8');
  noseGrad.addColorStop(0.55, color);
  noseGrad.addColorStop(1, '#07518f');
  g.fillStyle = noseGrad;
  g.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = noseTop(x);
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.lineTo(W, noseBot);
  g.lineTo(0, noseBot);
  g.closePath();
  g.fill();

  // tricolour: thin red, thick green
  const strokeSmile = (offset, width, stroke) => {
    g.strokeStyle = stroke;
    g.lineWidth = width;
    g.lineCap = 'butt';
    g.beginPath();
    for (let x = -6; x <= W + 6; x += 8) {
      const y = smileTop(x) + offset;
      if (x === -6) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  strokeSmile(5, 10, '#e23227');
  strokeSmile(41, 62, '#12a150');
  // crisp light edge along the top of the green
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 1.6;
  g.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = smileTop(x) + 10;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();

  // headlight housings (the 3D lamps sit over these)
  for (const sx of [-1, 1]) {
    const cx = W * (0.5 + sx * 0.30);
    const cy = Y(1.53);
    g.fillStyle = '#0a0e0f';
    roundRectPath(g, cx - W * 0.056, cy - H * 0.027, W * 0.112, H * 0.054, 8);
    g.fill();
    g.fillStyle = '#1b2123';
    roundRectPath(g, cx - W * 0.047, cy - H * 0.02, W * 0.094, H * 0.04, 6);
    g.fill();
    // red marker inboard
    g.fillStyle = '#8c130d';
    g.beginPath();
    g.arc(cx + W * 0.049, cy, W * 0.011, 0, Math.PI * 2);
    g.fill();
  }

  // HMR roundel in the blue nose band
  drawHmrMark(g, W * 0.5, Y(1.575), W * 0.036, { light: true });
  // small crest at the base of the screen
  drawHmrMark(g, W * 0.5, Y(1.93), W * 0.014, { light: false, ring: false });

  // upper marker lamps are 3D (see buildNose)

  // lower valance shadow and coupler recess
  const valance = g.createLinearGradient(0, Y(1.34), 0, H);
  valance.addColorStop(0, 'rgba(90,98,99,0)');
  valance.addColorStop(1, 'rgba(54,60,61,0.62)');
  g.fillStyle = valance;
  g.fillRect(0, Y(1.34), W, H - Y(1.34));
  g.fillStyle = '#0a0d0e';
  roundRectPath(g, W * 0.415, Y(1.16), W * 0.17, H * 0.048, 8);
  g.fill();
  g.fillStyle = '#121718';
  roundRectPath(g, W * 0.428, Y(1.15), W * 0.144, H * 0.036, 6);
  g.fill();
  // lower seams and corner boxes
  g.strokeStyle = 'rgba(70,80,82,0.25)';
  g.lineWidth = 2;
  for (const fx of [0.245, 0.755]) {
    g.beginPath();
    g.moveTo(W * fx, Y(1.4));
    g.lineTo(W * fx, H);
    g.stroke();
  }
  g.strokeStyle = 'rgba(70,80,82,0.2)';
  g.beginPath();
  g.moveTo(W * 0.17, Y(1.27));
  g.lineTo(W * 0.83, Y(1.27));
  g.stroke();
  for (const sx of [-1, 1]) {
    g.fillStyle = '#0c1011';
    roundRectPath(g, W * (0.5 + sx * 0.33) - W * 0.035, Y(1.155), W * 0.07, H * 0.034, 4);
    g.fill();
  }
  // unit number
  g.fillStyle = 'rgba(55,62,64,0.6)';
  g.font = '600 16px "JetBrains Mono", monospace';
  g.textAlign = 'right';
  g.fillText('HMR 03', W * 0.95, H * 0.97);

  // weathering
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(38,40,38,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * W, Y(1.0 + Math.random() * 0.3), 1 + Math.random() * 7, 2 + Math.random() * 18);
  }
  return c;
}

// The short side panel that wraps the nose: blue band sweeping down into the
// front face, tricolour climbing around the corner.
function makeNoseSideTexture(color = '#0b5fae') {
  const W = 512;
  const H = 512;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const yTop = BODY_TOP;
  const yBot = BODY_BOTTOM;
  const Y = (y) => ((yTop - y) / (yTop - yBot)) * H;
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#eef2f2');
  base.addColorStop(0.55, '#e2e7e7');
  base.addColorStop(1, '#cfd5d6');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let y = 2; y < H; y += 7) {
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(66,76,78,0.11)';
    g.fillRect(0, y + 1, W, 1);
  }

  // dark navy canopy — only over the top shoulder, fading toward the body
  {
    const canopy = canvas2d(W, H);
    const cg = canopy.getContext('2d');
    const vg = cg.createLinearGradient(0, 0, 0, H * 0.46);
    vg.addColorStop(0, 'rgba(14,25,34,1)');
    vg.addColorStop(0.6, 'rgba(14,25,34,0.85)');
    vg.addColorStop(1, 'rgba(14,25,34,0)');
    cg.fillStyle = vg;
    cg.fillRect(0, 0, W, H);
    const hg = cg.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.28, 'rgba(0,0,0,0)');
    hg.addColorStop(0.7, 'rgba(0,0,0,0.95)');
    hg.addColorStop(1, 'rgba(0,0,0,1)');
    cg.globalCompositeOperation = 'destination-in';
    cg.fillStyle = hg;
    cg.fillRect(0, 0, W, H);
    g.drawImage(canopy, 0, 0);
  }

  // royal-blue cantrail band, sweeping down the nose to the front corner
  const topAt = (u) => BLUE_TOP + (1.80 - BLUE_TOP) * Math.pow(u, 1.3);
  const botAt = (u) => BLUE_BOTTOM + (1.42 - BLUE_BOTTOM) * Math.pow(u, 1.3);
  const band = g.createLinearGradient(0, Y(BLUE_TOP), 0, Y(1.42));
  band.addColorStop(0, '#0d6fc8');
  band.addColorStop(0.5, color);
  band.addColorStop(1, '#085394');
  g.fillStyle = band;
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    const x = u * W;
    const y = Y(topAt(u));
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  for (let i = 64; i >= 0; i--) {
    const u = i / 64;
    g.lineTo(u * W, Y(botAt(u)));
  }
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(0, Y(BLUE_BOTTOM) - 2, W * 0.3, 1.2);

  // tricolour sweeping up around the nose (green over red over blue)
  g.lineCap = 'butt';
  const stripes = [
    [1.835, 1.87, '#12a150', 5.2, 8.0],
    [1.765, 1.79, '#e23227', 7.0, 9.5],
    [1.695, 1.71, '#0b5fae', 8.2, 10.5],
  ];
  for (const [y0, y1, col, w0, w1] of stripes) {
    g.strokeStyle = col;
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      const x = u * W;
      g.lineWidth = w0 + (w1 - w0) * u;
      g.beginPath();
      const tt = Math.pow(u, 1.3);
      g.moveTo(x, Y(y0 + (y1 - y0) * tt));
      g.lineTo(x + W / steps + 1, Y(y0 + (y1 - y0) * Math.pow(Math.min(1, u + 1 / steps), 1.3)));
      g.stroke();
    }
  }

  // shut line at the back edge
  g.fillStyle = 'rgba(70,80,82,0.25)';
  g.fillRect(0, 0, 2, H);
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(2, 0, 1, H);
  return c;
}

// Roof shoulder strip: stainless at the body, blending into the dark navy
// canopy toward the windscreen, with the tail of the cantrail band wrapping
// over the curve.
function makeNoseRoofTexture(color = '#0b5fae') {
  const W = 512;
  const H = 128;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#c9d0d2');
  base.addColorStop(0.5, '#dbe1e2');
  base.addColorStop(1, '#eef2f2');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // canopy blend: silver at the body, dark at the front
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, 'rgba(14,25,34,0)');
  hg.addColorStop(0.22, 'rgba(14,25,34,0)');
  hg.addColorStop(0.72, 'rgba(14,25,34,0.98)');
  hg.addColorStop(1, 'rgba(14,25,34,1)');
  g.fillStyle = hg;
  g.fillRect(0, 0, W, H);
  // blue band tail across the lower shoulder, fading toward the front
  const blue = g.createLinearGradient(0, H, 0, H * 0.35);
  blue.addColorStop(0, '#0d6fc8');
  blue.addColorStop(0.55, color);
  blue.addColorStop(1, 'rgba(8,83,148,0)');
  g.fillStyle = blue;
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, H * 0.28);
  g.quadraticCurveTo(W * 0.28, H * 0.3, W * 0.52, H * 0.78);
  g.lineTo(W * 0.52, H);
  g.closePath();
  g.fill();
  return c;
}

// ---------------------------------------------------------------------------
// geometry helpers
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

function topRoundedShape(w, h, r) {
  // A cross-section whose shoulder is rounded but whose waist stays square —
  // used for the cantrail/roof cap, which sits directly on the saloon walls.
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h);
  s.moveTo(x, y);
  s.lineTo(x + w, y);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y);
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

function beamBetween(mat, a, b, radius = 0.03, segments = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, segments), mat);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return mesh;
}

// ---------------------------------------------------------------------------
// cab nose — lofted from the full body section to a rounded, raked front face
// ---------------------------------------------------------------------------

function buildNose(materials, frontMat, noseSideMat, noseRoofMat, textureData) {
  const group = new THREE.Group();
  const length = CAR_TIP - BODY_HALF; // 1.1 m
  const rings = 7;
  const sideCols = 7;   // across the flank height
  const roofCols = 8;   // across the roof shoulder
  const sections = [];

  // parametric ring
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const s = t * t * (3 - 2 * t); // smoothstep
    const w = 1.45 * (1 - 0.13 * Math.pow(t, 1.5));
    const yb = BODY_BOTTOM + 0.18 * Math.pow(t, 1.6);
    const yt = BODY_TOP - 0.09 * Math.pow(t, 1.4);
    const r = 0.35 * (1 - 0.18 * t);
    const z = BODY_HALF + length * t;
    sections.push({ t, w, yb, yt, r, z });
  }

  const rake = 0.48;
  const bulge = 0.03;
  const zAt = (sec, y, x) => {
    const yn = (y - sec.yb) / (sec.yt - sec.yb);
    const xn = Math.min(1, Math.abs(x) / sec.w);
    return sec.z - rake * (sec.t * sec.t) * yn + bulge * (1 - xn * xn) * Math.pow(sec.t, 3);
  };

  // --- side surfaces (right and left) ---
  const sideVerts = [];
  const sideUV = [];
  const sideIdx = [];
  const vPerCol = sideCols + 1;
  for (const side of [-1, 1]) {
    const base = sideVerts.length / 3;
    for (let i = 0; i < rings; i++) {
      const sec = sections[i];
      for (let j = 0; j <= sideCols; j++) {
        const v = j / sideCols;
        const y = sec.yb + (sec.yt - sec.r - sec.yb) * v;
        const x = side * sec.w;
        sideVerts.push(x, y, zAt(sec, y, x));
        sideUV.push(i / (rings - 1), (y - BODY_BOTTOM) / (BODY_TOP - BODY_BOTTOM));
      }
    }
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < sideCols; j++) {
        const a = base + i * vPerCol + j;
        const b = a + 1;
        const c = a + vPerCol;
        const d = c + 1;
        if (side > 0) sideIdx.push(a, c, b, b, c, d);
        else sideIdx.push(a, b, c, b, d, c);
      }
    }
  }
  const sideGeom = new THREE.BufferGeometry();
  sideGeom.setAttribute('position', new THREE.Float32BufferAttribute(sideVerts, 3));
  sideGeom.setAttribute('uv', new THREE.Float32BufferAttribute(sideUV, 2));
  sideGeom.setIndex(sideIdx);
  sideGeom.computeVertexNormals();
  const sideMesh = new THREE.Mesh(sideGeom, noseSideMat);
  group.add(sideMesh);

  // --- shoulder + roof (dark navy canopy) ---
  const rVerts = [];
  const rUV = [];
  const rIdx = [];
  const cols = roofCols + 1;
  for (const side of [-1, 1]) {
    const base = rVerts.length / 3;
    for (let i = 0; i < rings; i++) {
      const sec = sections[i];
      for (let j = 0; j <= roofCols; j++) {
        const a = (j / roofCols) * (Math.PI / 2);
        // from the shoulder tangent to the crown
        const x = side * (sec.w - sec.r + Math.cos(a) * sec.r);
        const y = sec.yt - sec.r + Math.sin(a) * sec.r;
        rVerts.push(x, y, zAt(sec, y, x));
        rUV.push(i / (rings - 1), j / roofCols);
      }
    }
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < roofCols; j++) {
        const a = base + i * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (side > 0) rIdx.push(a, c, b, b, c, d);
        else rIdx.push(a, b, c, b, d, c);
      }
    }
  }
  const roofGeom = new THREE.BufferGeometry();
  roofGeom.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
  roofGeom.setAttribute('uv', new THREE.Float32BufferAttribute(rUV, 2));
  roofGeom.setIndex(rIdx);
  roofGeom.computeVertexNormals();
  const roofMesh = new THREE.Mesh(roofGeom, noseRoofMat);
  group.add(roofMesh);

  // fill the crown between the two shoulder strips with a shallow dome
  const crownCols = 6;
  const crownVerts = [];
  const crownUV = [];
  const crownIdx = [];
  for (let i = 0; i < rings; i++) {
    const sec = sections[i];
    const halfCrown = Math.max(0.02, sec.w - sec.r);
    for (let j = 0; j <= crownCols; j++) {
      const x = -halfCrown + (2 * halfCrown * j) / crownCols;
      const y = sec.yt + 0.025 * Math.cos((x / halfCrown) * Math.PI * 0.5);
      crownVerts.push(x, y, zAt(sec, y, x));
      crownUV.push(i / (rings - 1), 1);
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < crownCols; j++) {
      const a = i * (crownCols + 1) + j;
      const b = a + 1;
      const c = a + crownCols + 1;
      const d = c + 1;
      crownIdx.push(a, c, b, b, c, d);
    }
  }
  const crownGeom = new THREE.BufferGeometry();
  crownGeom.setAttribute('position', new THREE.Float32BufferAttribute(crownVerts, 3));
  crownGeom.setAttribute('uv', new THREE.Float32BufferAttribute(crownUV, 2));
  crownGeom.setIndex(crownIdx);
  crownGeom.computeVertexNormals();
  group.add(new THREE.Mesh(crownGeom, noseRoofMat));

  // --- front face (rounded cap) ---
  const last = sections[rings - 1];
  const fxw = last.w;
  const fyb = last.yb;
  const fyt = last.yt;
  const frontShape = roundedShape(2 * fxw, fyt - fyb, 0.42);
  const frontGeom = new THREE.ShapeGeometry(frontShape, 22);
  const fpos = frontGeom.attributes.position;
  const fuv = frontGeom.attributes.uv;
  for (let i = 0; i < fpos.count; i++) {
    const x = fpos.getX(i);
    const y = fpos.getY(i) + (fyb + fyt) / 2;
    fpos.setY(i, y);
    fpos.setZ(i, zAt(last, y, x));
    fuv.setXY(i, (x + fxw) / (2 * fxw), (y - fyb) / (fyt - fyb));
  }
  fpos.needsUpdate = true;
  fuv.needsUpdate = true;
  frontGeom.computeVertexNormals();
  const frontMesh = new THREE.Mesh(frontGeom, frontMat);
  group.add(frontMesh);

  // helper used by the overlays to sit on the curved face
  const faceZ = (x, y) => zAt(last, y, x);

  // --- 3D overlays ---
  const zc = faceZ(0, 2.86);

  // wipers
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.66, 6), materials.rubber);
    rod.rotation.z = Math.PI / 2;
    rod.position.x = 0.3;
    arm.add(rod);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.018, 0.03), materials.rubber);
    blade.position.set(0.4, 0.02, 0.01);
    arm.add(blade);
    arm.position.set(sx * 0.18, 2.52, zc + 0.03);
    arm.rotation.z = sx > 0 ? -0.18 : 0.18;
    arm.rotation.y = sx > 0 ? -0.12 : 0.12;
    group.add(arm);
  }

  const glowMat = new THREE.MeshBasicMaterial({
    map: textureData.glow,
    color: 0xfff2d8,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    map: textureData.glow,
    color: 0xffe7b4,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const headlights = [];
  for (const sx of [-1, 1]) {
    const hx = sx * 0.80;
    const hy = 1.53;
    const hz = faceZ(hx, hy);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.05), materials.lightHousing);
    housing.position.set(hx, hy, hz + 0.008);
    group.add(housing);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xf7f9f3,
      emissive: 0xfff3dc,
      emissiveIntensity: 3.2,
      roughness: 0.18,
      metalness: 0.1,
    });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 20), lampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(hx + sx * 0.045, hy, hz + 0.04);
    group.add(lamp);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xf6faf8,
      emissive: 0xdff4ff,
      emissiveIntensity: 2.6,
      roughness: 0.2,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.038, 0.025), barMat);
    bar.position.set(hx - sx * 0.075, hy, hz + 0.04);
    group.add(bar);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), glowMat);
    glow.renderOrder = 6;
    glow.position.set(hx, hy, hz + 0.05);
    group.add(glow);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), haloMat);
    halo.renderOrder = 5;
    halo.position.set(hx, hy, hz + 0.03);
    group.add(halo);
    headlights.push({ lampMat, barMat, glowMat, haloMat, head: false });
  }

  // upper red markers
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.018, 14),
      new THREE.MeshStandardMaterial({ color: 0x5a0e0b, emissive: 0xff2a1c, emissiveIntensity: 2.4, roughness: 0.3 })
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(sx * 0.62, 3.35, faceZ(sx * 0.62, 3.35) + 0.02);
    group.add(m);
  }

  // destination display
  const destMat = new THREE.MeshStandardMaterial({
    color: 0x120b03,
    emissive: 0xff9a2e,
    emissiveMap: textureData.destination,
    emissiveIntensity: 2.6,
    roughness: 0.35,
    metalness: 0.1,
  });
  const dest = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.1), destMat);
  dest.position.set(0, 3.36, faceZ(0, 3.36) + 0.022);
  group.add(dest);

  // coupler
  const coupler = new THREE.Group();
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.26, 0.28, 3, 0.04), materials.bogieDark);
  head.position.set(0, 0.82, 0.09);
  coupler.add(head);
  const draw = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 10), materials.axle);
  draw.rotation.x = Math.PI / 2;
  draw.position.set(0, 0.84, -0.13);
  coupler.add(draw);
  for (const sx of [-0.12, 0.12]) {
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), materials.rubber);
    hose.rotation.x = Math.PI / 2.7;
    hose.position.set(sx, 0.66, 0.02);
    coupler.add(hose);
  }
  coupler.position.set(0, 0, CAR_TIP - 0.02);
  group.add(coupler);

  // side mirrors, mounted on the cab flanks just behind the nose
  for (const sx of [-1, 1]) {
    const mirror = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8), materials.rubber);
    stalk.rotation.z = sx * 1.15;
    stalk.position.set(sx * 0.07, 0.0, 0);
    mirror.add(stalk);
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.16, 0.1, 2, 0.022), materials.bogieDark);
    pod.position.set(sx * 0.16, 0.02, 0);
    mirror.add(pod);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x182226, metalness: 0.9, roughness: 0.08 })
    );
    face.rotation.y = -sx * Math.PI / 2;
    face.position.set(sx * 0.196, 0.02, 0);
    mirror.add(face);
    mirror.position.set(sx * 1.47, 2.88, BODY_HALF - 0.42);
    group.add(mirror);
  }

  return { group, zFront: faceZ(0, 2.5), headlights, destMat, faceZ };
}

// ---------------------------------------------------------------------------
// bogies
// ---------------------------------------------------------------------------

function buildWheel(materials, radius) {
  const group = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.125, 26, 1), materials.wheel);
  tyre.rotation.z = Math.PI / 2;
  group.add(tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 0.14, 26, 1), materials.rim);
  rim.rotation.z = Math.PI / 2;
  group.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.15, 18, 1), materials.bogieDark);
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.155, 6), materials.rim);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0, Math.cos(a) * radius * 0.38, Math.sin(a) * radius * 0.38);
    group.add(bolt);
  }
  return group;
}

function buildBogie(materials) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.44, 2.6), materials.bogie);
  frame.position.y = 0.56;
  g.add(frame);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 2.5), materials.bogieDark);
    side.position.set(sx * 0.97, 0.55, 0);
    g.add(side);
    const damper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), materials.axle);
    damper.position.set(sx * 0.99, 0.62, 0.52);
    damper.rotation.x = 0.22;
    g.add(damper);
  }
  const wheels = [];
  for (const sz of [-0.9, 0.9]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.52, 10), materials.axle);
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
    for (const sx of [-1, 1]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.32), materials.bogieDark);
      box.position.set(sx * 0.78, TRAIN.wheelRadius + 0.16, sz);
      g.add(box);
    }
  }
  for (const sz of [-0.48, 0.48]) {
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.68), materials.motor);
    motor.position.set(0, 0.72, sz);
    g.add(motor);
  }
  for (const sx of [-0.84, 0.84]) {
    for (const sz of [-0.8, 0.8]) {
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.22, 12), materials.spring);
      spring.position.set(sx, 0.94, sz);
      g.add(spring);
    }
  }
  return { group: g, wheels };
}

// ---------------------------------------------------------------------------
// body shell — hollow, with real window and doorway openings
// ---------------------------------------------------------------------------

function buildBodyShell(materials, layout) {
  const g = new THREE.Group();
  const halfZ = BODY_HALF;
  const halfW = TRAIN.width / 2;
  const wallT = 0.07;
  const wallX = halfW - 0.02 - wallT / 2; // outer face 1.43, livery sits at 1.47

  // rounded cantrail + roof cap (closed on all sides)
  const capH = BODY_TOP - GLASS_TOP;
  const capGeom = new THREE.ExtrudeGeometry(topRoundedShape(TRAIN.width - 0.02, capH, 0.26), {
    depth: halfZ * 2,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 8,
  });
  capGeom.translate(0, 0, -halfZ);
  const cap = new THREE.Mesh(capGeom, materials.steel);
  cap.position.y = GLASS_TOP + capH / 2;
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);

  // lower sill below the door line
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(TRAIN.width - 0.02, DOOR_BOTTOM - BODY_BOTTOM + 0.02, halfZ * 2),
    materials.steel
  );
  sill.position.y = (BODY_BOTTOM + DOOR_BOTTOM) / 2;
  sill.castShadow = true;
  sill.receiveShadow = true;
  g.add(sill);

  const addWall = (z0, z1, y0, y1) => {
    const len = z1 - z0;
    if (len < 0.015) return;
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(wallT, y1 - y0, len), materials.steel);
      w.position.set(side * wallX, (y0 + y1) / 2, (z0 + z1) / 2);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
    }
  };

  const bays = [];
  for (const z of layout.doors) bays.push({ z, w: DOOR_W, door: true });
  for (const z of layout.windows) bays.push({ z, w: WINDOW_W, door: false });
  bays.sort((a, b) => a.z - b.z);

  // solid piers between the bays
  let cursor = -halfZ;
  for (const bay of bays) {
    const z0 = bay.z - bay.w / 2;
    addWall(cursor, z0, DOOR_BOTTOM, GLASS_TOP);
    cursor = Math.max(cursor, bay.z + bay.w / 2);
  }
  addWall(cursor, halfZ, DOOR_BOTTOM, GLASS_TOP);

  // wall below each saloon window (the doors stay open to the platform)
  for (const bay of bays) {
    if (bay.door) continue;
    addWall(bay.z - bay.w / 2, bay.z + bay.w / 2, DOOR_BOTTOM, GLASS_BOTTOM);
  }

  // end caps close the saloon at both ends
  for (const end of [-1, 1]) {
    const capEnd = new THREE.Mesh(
      new THREE.BoxGeometry(TRAIN.width - 0.06, GLASS_TOP - BODY_BOTTOM, 0.06),
      materials.steel
    );
    capEnd.position.set(0, (GLASS_TOP + BODY_BOTTOM) / 2, end * (halfZ - 0.04));
    capEnd.castShadow = true;
    g.add(capEnd);
  }

  return g;
}

// ---------------------------------------------------------------------------
// saloon — floor, ceiling, longitudinal benches, poles, grab rails
// ---------------------------------------------------------------------------

function buildSaloon(materials, layout, { cabPlus, cabMinus }) {
  const g = new THREE.Group();
  const halfZ = TRAIN.shellLength / 2;
  const halfW = TRAIN.width / 2;
  const wallIn = halfW - 0.09;
  const floorY = DOOR_BOTTOM;
  const ceilY = GLASS_TOP - 0.06;

  // floor and ceiling
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(TRAIN.width - 0.18, 0.05, TRAIN.shellLength - 0.08),
    materials.intFloor
  );
  floor.position.y = floorY - 0.02;
  floor.receiveShadow = true;
  g.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(TRAIN.width - 0.3, 0.04, TRAIN.shellLength - 0.16),
    materials.intCeiling
  );
  ceiling.position.y = ceilY;
  g.add(ceiling);

  // two continuous warm ceiling light strips
  for (const x of [-0.58, 0.58]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.03, TRAIN.shellLength - 1.4),
      materials.intLamp
    );
    strip.position.set(x, ceilY - 0.035, 0);
    g.add(strip);
  }

  // cab partitions keep the saloon out of the driving ends
  const cabCut = 1.55;
  for (const [on, sign] of [[cabPlus, 1], [cabMinus, -1]]) {
    if (!on) continue;
    const z = sign * (halfZ - cabCut);
    const part = new THREE.Mesh(
      new THREE.BoxGeometry(TRAIN.width - 0.2, ceilY - floorY, 0.06),
      materials.intCeiling
    );
    part.position.set(0, (floorY + ceilY) / 2, z);
    g.add(part);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 1.92, 0.03),
      materials.intDoor
    );
    door.position.set(0, floorY + 0.98, z - sign * 0.05);
    g.add(door);
  }

  // bench runs between the doorways
  const doors = [...layout.doors].sort((a, b) => a - b);
  const zMin = -(halfZ - (cabMinus ? cabCut + 0.12 : 0.55));
  const zMax = halfZ - (cabPlus ? cabCut + 0.12 : 0.55);
  const runs = [];
  let from = zMin;
  for (const d of doors) {
    const edge = d - DOOR_W / 2 - 0.3;
    if (edge - from >= 0.85) runs.push([from, edge]);
    from = d + DOOR_W / 2 + 0.3;
  }
  if (zMax - from >= 0.85) runs.push([from, zMax]);

  for (const side of [-1, 1]) {
    for (const [z0, z1] of runs) addBench(g, materials, side, wallIn, z0, z1);
  }

  // stanchion poles at the doorway jambs
  for (const d of doors) {
    for (const side of [-1, 1]) {
      const x = side * 0.66;
      for (const zz of [d - DOOR_W / 2 - 0.16, d + DOOR_W / 2 + 0.16]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.021, 0.021, ceilY - floorY, 8),
          materials.intPole
        );
        pole.position.set(x, (floorY + ceilY) / 2, zz);
        g.add(pole);
      }
    }
  }

  // longitudinal grab rails, with drop rods from the ceiling
  for (const x of [-0.86, 0.86]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, TRAIN.shellLength - 0.9, 8),
      materials.intPole
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, ceilY - 0.26, 0);
    g.add(rail);
    for (let z = -halfZ + 1.2; z <= halfZ - 1.2; z += 2.4) {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.26, 6),
        materials.intPole
      );
      rod.position.set(x, ceilY - 0.13, z);
      g.add(rod);
    }
  }

  return g;
}

function addBench(g, materials, side, wallIn, z0, z1) {
  const len = z1 - z0;
  if (len < 0.5) return;
  const zc = (z0 + z1) / 2;
  const trim = materials.intSeatTrim;

  // plinth and seat cushion
  const plinth = new THREE.Mesh(
    new RoundedBoxGeometry(0.56, 0.34, len, 2, 0.03),
    materials.intSeatBase
  );
  plinth.position.set(side * (wallIn - 0.3), 1.21, zc);
  g.add(plinth);

  const cushion = new THREE.Mesh(
    new RoundedBoxGeometry(0.58, 0.13, len - 0.02, 2, 0.035),
    materials.intSeat
  );
  cushion.position.set(side * (wallIn - 0.31), 1.445, zc);
  g.add(cushion);

  // tall backrest against the wall
  const back = new THREE.Mesh(
    new RoundedBoxGeometry(0.12, 0.7, len - 0.02, 2, 0.04),
    materials.intSeat
  );
  back.position.set(side * (wallIn - 0.06), 1.79, zc);
  g.add(back);

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.055, len - 0.02, 2, 0.02),
    trim
  );
  top.position.set(side * (wallIn - 0.06), 2.165, zc);
  g.add(top);

  // individual headrests and seat dividers
  const n = Math.max(1, Math.round(len / 1.0));
  const pitch = len / n;
  for (let i = 0; i < n; i++) {
    const zz = z0 + pitch * (i + 0.5);
    const rest = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.26, Math.min(0.44, pitch * 0.78), 2, 0.035),
      trim
    );
    rest.position.set(side * (wallIn - 0.16), 2.11, zz);
    g.add(rest);

    if (i > 0) {
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.15, 0.028),
        trim
      );
      divider.position.set(side * (wallIn - 0.31), 1.53, z0 + pitch * i);
      g.add(divider);
    }
  }
}

// ---------------------------------------------------------------------------
// one car
// ---------------------------------------------------------------------------

function buildCar(materials, textures, texturesData, { index, cabPlus, cabMinus }) {
  const car = new THREE.Group();
  car.userData.wheels = [];
  car.userData.doors = [];
  const cabSign = cabPlus ? 1 : cabMinus ? -1 : 0;
  const layout = carLayout(cabSign);

  // Body shell. The old single solid extrusion sealed the car into a metal
  // block that read as a hole in the flank. It is now built as a real body:
  // a rounded cantrail/roof cap, a sill, end caps, and side walls with actual
  // window and doorway openings. That gives the saloon below real walls.
  car.add(buildBodyShell(materials, layout));

  // saloon: floor, ceiling, benches, poles and grab rails
  car.add(buildSaloon(materials, layout, { cabPlus, cabMinus }));

  // lower underframe (sits below the stainless body)
  const skirt = new THREE.Mesh(
    new RoundedBoxGeometry(2.7, 0.16, TRAIN.shellLength - 0.45, 3, 0.03),
    materials.skirt
  );
  skirt.position.y = 0.87;
  skirt.castShadow = true;
  car.add(skirt);

  // painted stainless livery on both flanks
  const sideMats = [];
  for (const side of [-1, 1]) {
    // side +1 needs the mirrored canvas (plane local +x maps to world -z)
    const tex = side > 0 ? texturesData.sideMirror[index] : texturesData.side[index];
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xe9eded,
      emissiveMap: side > 0 ? texturesData.sideGlowMirror[index] : texturesData.sideGlow[index],
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.58,
      metalness: 0.0,
      envMapIntensity: 0.18,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    sideMats.push(mat);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(BODY_HALF * 2, BODY_TOP - BODY_BOTTOM), mat);
    panel.rotation.y = side * Math.PI / 2;
    panel.position.set(side * (TRAIN.width / 2 + 0.02), (BODY_TOP + BODY_BOTTOM) / 2, 0);
    car.add(panel);
  }

  // tinted saloon glazing over the real window openings
  for (const side of [-1, 1]) {
    for (const z of layout.windows) {
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(WINDOW_W - 0.1, GLASS_TOP - GLASS_BOTTOM - 0.1),
        materials.intGlass
      );
      pane.rotation.y = side * Math.PI / 2;
      pane.position.set(side * (TRAIN.width / 2 + 0.008), (GLASS_TOP + GLASS_BOTTOM) / 2, z);
      car.add(pane);
    }
  }

  // animated double doors
  const addDoor = (side, z) => {
    const x = side * (TRAIN.width / 2 + 0.026);
    // The doorway is a real opening into the saloon now — no painted recess.
    // slim jambs
    for (const zz of [-DOOR_W / 2, DOOR_W / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.016, DOOR_TOP - DOOR_BOTTOM + 0.04, 0.03), materials.gasket);
      bar.position.set(x + side * 0.004, (DOOR_TOP + DOOR_BOTTOM) / 2, z + zz);
      car.add(bar);
    }
    for (const yy of [DOOR_BOTTOM - 0.02, DOOR_TOP + 0.02]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, DOOR_W + 0.05), materials.gasket);
      bar.position.set(x + side * 0.004, yy, z);
      car.add(bar);
    }

    for (const leafSide of [-1, 1]) {
      const leafGroup = new THREE.Group();
      const baseZ = z + leafSide * (DOOR_LEAF / 2 - 0.008);
      leafGroup.position.set(x, (DOOR_TOP + DOOR_BOTTOM) / 2, baseZ);
      leafGroup.userData.keep = true;
      car.add(leafGroup);
      const leaf = new THREE.Mesh(new RoundedBoxGeometry(0.045, DOOR_TOP - DOOR_BOTTOM - 0.03, DOOR_LEAF - 0.012, 2, 0.018), materials.doorLeaf);
      leaf.position.set(side * 0.014, 0, 0);
      leaf.castShadow = true;
      leafGroup.add(leaf);
      car.userData.doors.push({ group: leafGroup, side, leafSide, baseZ });
    }
  };
  for (const side of [-1, 1]) {
    for (const z of layout.doors) addDoor(side, z);
  }

  // roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.05, TRAIN.shellLength - 0.3), materials.roof);
  roof.position.y = BODY_TOP + 0.025;
  roof.castShadow = true;
  car.add(roof);

  // roof equipment
  for (const z of [-5.0, 5.0]) {
    const ac = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.32, 2.25, 3, 0.07), materials.ac);
    ac.position.set(0, BODY_TOP + 0.19, z);
    ac.castShadow = true;
    car.add(ac);
    const grill = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.9), materials.grille);
    grill.rotation.x = -Math.PI / 2;
    grill.position.set(0, BODY_TOP + 0.355, z);
    car.add(grill);
    for (const sx of [-1, 1]) {
      const louver = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.22), materials.grille);
      louver.rotation.y = sx * Math.PI / 2;
      louver.position.set(sx * 0.951, BODY_TOP + 0.19, z);
      car.add(louver);
    }
  }
  const duct = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, TRAIN.shellLength - 3.4), materials.roofDark);
  duct.position.y = BODY_TOP + 0.045;
  car.add(duct);
  for (const [x, z, w, d] of [
    [-0.6, -8.4, 0.46, 0.66],
    [0.6, 8.4, 0.46, 0.66],
    [0.32, -1.4, 0.24, 0.38],
  ]) {
    const box = new THREE.Mesh(new RoundedBoxGeometry(w, 0.11, d, 2, 0.025), materials.ac);
    box.position.set(x, BODY_TOP + 0.09, z);
    car.add(box);
  }
  // dark cab roof panel + equipment
  if (cabSign !== 0) {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.055, 1.5, 2, 0.04), materials.cabRoof);
    plate.position.set(0, BODY_TOP + 0.03, cabSign * (BODY_HALF - 0.55));
    plate.castShadow = true;
    car.add(plate);
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 0.72, 2, 0.03), materials.roofDark);
    pod.position.set(0, BODY_TOP + 0.12, cabSign * (BODY_HALF - 0.25));
    car.add(pod);
  }

  // pantograph on the middle car
  if (index === 1) {
    const panto = new THREE.Group();
    const insulator = new THREE.MeshStandardMaterial({ color: 0x33383a, roughness: 0.72 });
    for (const z of [-0.9, 0.9]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.26, 8), insulator);
      ins.position.set(0, BODY_TOP + 0.13, z);
      panto.add(ins);
    }
    const baseY = BODY_TOP + 0.28;
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY, -0.9), new THREE.Vector3(0, baseY + 0.58, 0.16), 0.036));
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY, 0.9), new THREE.Vector3(0, baseY + 0.58, -0.16), 0.036));
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY + 0.58, 0.16), new THREE.Vector3(0, baseY + 1.0, 0.58), 0.024));
    panto.add(beamBetween(materials.axle, new THREE.Vector3(0, baseY + 0.58, -0.16), new THREE.Vector3(0, baseY + 1.0, 0.58), 0.024));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.045, 0.09), materials.axle);
    bar.position.set(0, baseY + 1.03, 0.58);
    panto.add(bar);
    car.add(panto);
  }

  // underframe equipment
  for (const z of [-5.6, 0, 5.6]) {
    const eq = new THREE.Mesh(new RoundedBoxGeometry(1.76, 0.28, 2.1, 2, 0.035), materials.equipment);
    eq.position.set(0, 0.58, z);
    car.add(eq);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.2), materials.grille);
    g.rotation.x = Math.PI / 2;
    g.position.set(0, 0.435, z);
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
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.5, 0.04), materials.endPanel);
    wall.position.set(0, 2.18, end * (TRAIN.shellLength / 2 + 0.01));
    car.add(wall);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.95, 0.03), materials.doorSteel);
    door.position.set(0, 2.16, end * (TRAIN.shellLength / 2 + 0.03));
    car.add(door);
  };
  if (!cabPlus) addEnd(1);
  if (!cabMinus) addEnd(-1);

  // cab nose + bellows
  let cabA = null;
  let cabB = null;
  const noseSideMat = new THREE.MeshStandardMaterial({
    map: texturesData.noseSide[cabSign === 0 ? 0 : cabSign > 0 ? 1 : 2],
    roughness: 0.52,
    metalness: 0.05,
    envMapIntensity: 0.22,
  });
  if (cabPlus) {
    cabA = buildNose(materials, texturesData.frontMat, noseSideMat, texturesData.noseRoofMat, textures);
    car.add(cabA.group);
  } else {
    const bellows = buildBellows(materials);
    bellows.position.z = BODY_HALF + 0.70;
    car.add(bellows);
  }
  if (cabMinus) {
    cabB = buildNose(materials, texturesData.frontMat, noseSideMat, texturesData.noseRoofMat, textures);
    cabB.group.rotation.y = Math.PI;
    car.add(cabB.group);
  } else {
    const bellows = buildBellows(materials);
    bellows.position.z = -BODY_HALF - 0.70;
    car.add(bellows);
  }

  // contact shadow
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, TRAIN.shellLength + 1),
    new THREE.MeshBasicMaterial({
      map: textures.contact,
      transparent: true,
      opacity: 0.4,
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.16, 2.52, 1.1), materials.bellows);
  body.position.y = 2.14;
  g.add(body);
  for (let i = 0; i < 7; i++) {
    const z = -0.51 + i * 0.17;
    for (const sx of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.54, 0.055), materials.bellowsRib);
      rib.position.set(sx * 1.09, 2.14, z);
      g.add(rib);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.055), materials.bellowsRib);
    top.position.set(0, 3.41, z);
    g.add(top);
  }
  return g;
}

// ---------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------

function makeMaterials(anisotropy) {
  const steelMap = texture(makeBrushedSteel(), { repeat: [2.4, 1], anisotropy });
  const roughMap = texture(makeSteelRoughness(), { srgb: false, repeat: [3, 1], anisotropy });
  const roofMap = texture(makeRoofTexture(), { repeat: [1, 5], anisotropy });
  const grilleMap = texture(makeGrille(), { anisotropy });
  const doorLeafMap = texture(makeDoorLeaf(), { anisotropy });
  const doorGlowMap = texture(makeDoorEmissive(), { anisotropy });

  const steel = new THREE.MeshPhysicalMaterial({
    map: steelMap,
    color: 0xe6ebeb,
    metalness: 0.38,
    roughness: 0.4,
    roughnessMap: roughMap,
    clearcoat: 0.12,
    clearcoatRoughness: 0.36,
    envMapIntensity: 0.72,
  });
  steel.userData.castShadow = true;
  steel.userData.receiveShadow = true;

  const doorSteel = new THREE.MeshPhysicalMaterial({
    map: steelMap,
    color: 0xe9eded,
    metalness: 0.72,
    roughness: 0.36,
    roughnessMap: roughMap,
    clearcoat: 0.16,
    envMapIntensity: 0.95,
  });

  const blue = new THREE.MeshPhysicalMaterial({
    color: COLORS.paintBlue,
    metalness: 0.1,
    roughness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.1,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a1417,
    metalness: 0.03,
    roughness: 0.42,
    clearcoat: 0.12,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.12,
    emissive: 0x050d10,
    emissiveIntensity: 1,
  });

  const cabRoof = new THREE.MeshStandardMaterial({ color: 0x121c24, roughness: 0.42, metalness: 0.25 });
  cabRoof.userData.castShadow = true;

  return {
    steel,
    doorSteel,
    blue,
    glass,
    cabRoof,
    gasket: new THREE.MeshStandardMaterial({ color: 0x090c0d, roughness: 0.55, metalness: 0.1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 0.72 }),
    aperture: new THREE.MeshStandardMaterial({ color: 0x050708, roughness: 0.8 }),
    skirt: new THREE.MeshStandardMaterial({ color: 0x343a3c, roughness: 0.6, metalness: 0.3 }),
    endPanel: new THREE.MeshStandardMaterial({ color: 0x1c1f20, roughness: 0.65, metalness: 0.2 }),
    roof: new THREE.MeshStandardMaterial({ map: roofMap, color: 0x9ba3a4, roughness: 0.62, metalness: 0.22 }),
    roofDark: new THREE.MeshStandardMaterial({ color: 0x42484a, roughness: 0.66 }),
    ac: new THREE.MeshStandardMaterial({ map: roofMap, color: 0x858d8f, roughness: 0.62, metalness: 0.2 }),
    grille: new THREE.MeshStandardMaterial({ map: grilleMap, color: 0x8c9395, roughness: 0.66, metalness: 0.2 }),
    bogie: new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.63, metalness: 0.35 }),
    bogieDark: new THREE.MeshStandardMaterial({ color: 0x0c0e0f, roughness: 0.6, metalness: 0.35 }),
    motor: new THREE.MeshStandardMaterial({ color: 0x242829, roughness: 0.55, metalness: 0.5 }),
    axle: new THREE.MeshStandardMaterial({ color: 0x3e4344, roughness: 0.35, metalness: 0.8 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x1a1d1e, roughness: 0.55, metalness: 0.5 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x777d7e, roughness: 0.28, metalness: 0.9 }),
    spring: new THREE.MeshStandardMaterial({ color: 0x2f3334, roughness: 0.5, metalness: 0.5 }),
    equipment: new THREE.MeshStandardMaterial({ color: 0x343a3c, roughness: 0.6, metalness: 0.4 }),
    bellows: new THREE.MeshStandardMaterial({ color: 0x1d2224, roughness: 0.86 }),
    bellowsRib: new THREE.MeshStandardMaterial({ color: 0x3a4144, roughness: 0.78 }),
    lightHousing: new THREE.MeshStandardMaterial({ color: 0x121617, roughness: 0.35, metalness: 0.65 }),
    // saloon interior
    intFloor: new THREE.MeshStandardMaterial({ color: 0x2f383a, roughness: 0.86, metalness: 0.05 }),
    intCeiling: new THREE.MeshStandardMaterial({ color: 0xd6dddd, roughness: 0.74, metalness: 0.04 }),
    intLamp: new THREE.MeshStandardMaterial({
      color: 0xfff6e6,
      emissive: 0xffe6b8,
      emissiveIntensity: 0.85,
      roughness: 0.5,
      metalness: 0.0,
    }),
    intSeat: new THREE.MeshStandardMaterial({
      color: 0x27517f,
      emissive: 0x0a1622,
      emissiveIntensity: 0.45,
      roughness: 0.82,
      metalness: 0.02,
    }),
    intSeatBase: new THREE.MeshStandardMaterial({ color: 0x1d2224, roughness: 0.82, metalness: 0.15 }),
    intSeatTrim: new THREE.MeshStandardMaterial({
      color: 0xd8dedd,
      emissive: 0x111413,
      emissiveIntensity: 0.35,
      roughness: 0.68,
      metalness: 0.05,
    }),
    intPole: new THREE.MeshStandardMaterial({ color: 0xb7bec0, roughness: 0.32, metalness: 0.85, envMapIntensity: 0.7 }),
    intDoor: new THREE.MeshStandardMaterial({ color: 0x2c3335, roughness: 0.7, metalness: 0.2 }),
    intGlass: new THREE.MeshPhysicalMaterial({
      color: 0x16262b,
      emissive: 0x1a1208,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.0,
      envMapIntensity: 1.35,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
    doorLeaf: new THREE.MeshPhysicalMaterial({
      map: doorLeafMap,
      emissiveMap: doorGlowMap,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      metalness: 0.4,
      roughness: 0.38,
      envMapIntensity: 0.85,
    }),
  };
}

// ---------------------------------------------------------------------------
// public: detailed set
// ---------------------------------------------------------------------------

export function createTrain({ anisotropy = 8, color = '#0b5fae' } = {}) {
  const materials = makeMaterials(anisotropy);
  const lineTint = new THREE.Color(color);
  materials.blue.color.copy(lineTint);

  const destinations = {
    RAIDURG: texture(makeDestination('RAIDURG'), { anisotropy }),
    NAGOLE: texture(makeDestination('NAGOLE'), { anisotropy }),
  };
  const frontTexture = texture(makeFrontTexture(color), { anisotropy });
  const frontMat = new THREE.MeshStandardMaterial({
    map: frontTexture,
    metalness: 0.1,
    roughness: 0.48,
    envMapIntensity: 0.35,
  });
  frontMat.userData.castShadow = true;

  const noseRoofMat = new THREE.MeshStandardMaterial({
    map: texture(makeNoseRoofTexture(color), { anisotropy }),
    metalness: 0.18,
    roughness: 0.5,
    envMapIntensity: 0.3,
  });
  noseRoofMat.userData.castShadow = true;

  // side canvases per car and per orientation (text reads correctly on both
  // sides; the plane's U axis is reversed on the +x flank).
  const side = [];
  const sideMirror = [];
  const sideGlow = [];
  const sideGlowMirror = [];
  const noseSide = [];
  const layouts = [-1, 0, 1]; // rear cab, middle, lead cab
  for (const cabSign of layouts) {
    side.push(texture(makeSideLivery(color, { cabSign, mirror: false }), { anisotropy }));
    sideMirror.push(texture(makeSideLivery(color, { cabSign, mirror: true }), { anisotropy }));
    sideGlow.push(texture(makeSideEmissive(cabSign, false), { anisotropy }));
    sideGlowMirror.push(texture(makeSideEmissive(cabSign, true), { anisotropy }));
    noseSide.push(texture(makeNoseSideTexture(color), { anisotropy }));
  }

  const texturesData = {
    frontMat,
    noseRoofMat,
    side,
    sideMirror,
    sideGlow,
    sideGlowMirror,
    noseSide,
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
    built.wheels = [];
    const packed = mergeByMaterial(built.group);
    packed.name = `car-${i}`;
    built.group = packed;
    cars.push(built);
  }

  // head / tail lighting
  let lampNight = 0;
  const setCabMode = (cab, mode) => {
    if (!cab) return;
    const head = mode === 'head';
    const tail = mode === 'tail';
    for (const light of cab.headlights) {
      light.head = head;
      light.lampMat.emissive.setHex(head ? 0xfff3dc : tail ? 0xff1a12 : 0x0a0a0a);
      light.lampMat.emissiveIntensity = head ? 3.8 : tail ? 3.0 : 0;
      light.barMat.emissive.setHex(head ? 0xdff4ff : tail ? 0x9b0d08 : 0x050505);
      light.barMat.emissiveIntensity = head ? 3.2 : tail ? 0.8 : 0;
      light.glowMat.color.setHex(head ? 0xfff2d8 : 0xff2a1e);
      light.glowMat.opacity = head
        ? THREE.MathUtils.lerp(0.5, 0.9, lampNight)
        : tail
          ? THREE.MathUtils.lerp(0.24, 0.55, lampNight)
          : 0;
      if (light.haloMat) {
        light.haloMat.color.setHex(head ? 0xffe7b4 : 0xff3a24);
        light.haloMat.opacity = head
          ? THREE.MathUtils.lerp(0.14, 0.32, lampNight)
          : tail
            ? THREE.MathUtils.lerp(0.06, 0.18, lampNight)
            : 0;
      }
    }
    if (cab.destMat) cab.destMat.emissiveIntensity = head ? 2.8 : 0.18;
  };
  setCabMode(cars[2].cabA, 'head');
  setCabMode(cars[0].cabB, 'tail');

  const root = new THREE.Group();
  root.name = 'train-detailed';
  for (const c of cars) root.add(c.group);

  const NIGHT = {
    glassEmissive: new THREE.Color(0x3a2a16),
    glassColor: new THREE.Color(0x1a140c),
    steelEmissive: new THREE.Color(0x1a2330),
    sideColor: new THREE.Color(0xa6aeb2),
  };

  return {
    group: root,
    cars,
    materials,
    setCabMode,
    setMode(direction = 1) {
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
          door.group.position.z = door.baseZ + door.leafSide * o * (DOOR_LEAF + 0.01);
        }
      }
    },
    setNight(night) {
      this.setNightFactor(night ? 1 : 0);
    },
    setNightFactor(k) {
      const t = THREE.MathUtils.clamp(k, 0, 1);
      const lerp = THREE.MathUtils.lerp;
      lampNight = t;

      materials.glass.emissive.setHex(0x050d10).lerp(NIGHT.glassEmissive, t);
      materials.glass.emissiveIntensity = lerp(1, 1.25, t);
      materials.glass.color.setHex(0x0a1417).lerp(NIGHT.glassColor, t);
      materials.doorLeaf.emissiveIntensity = 0.85 * t;

      materials.steel.emissive.setHex(0x000000).lerp(NIGHT.steelEmissive, t);
      materials.steel.emissiveIntensity = 0.6 * t;
      materials.steel.envMapIntensity = lerp(0.72, 1.05, t);

      // saloon lighting: bench fabric and trim pick up a little glow at night,
      // the ceiling strips brighten, and the tinted glazing warms up
      materials.intLamp.emissiveIntensity = lerp(0.85, 2.6, t);
      materials.intGlass.emissiveIntensity = lerp(0.05, 0.5, t);
      materials.intSeat.emissiveIntensity = lerp(0.45, 0.9, t);
      materials.intSeatTrim.emissiveIntensity = lerp(0.35, 0.5, t);

      for (const car of cars) {
        for (const m of car.sideMats || []) {
          m.emissiveIntensity = 0.92 * t;
          m.envMapIntensity = lerp(0.18, 0.3, t);
          m.color.setHex(0xffffff).lerp(NIGHT.sideColor, t);
        }
        for (const cab of [car.cabA, car.cabB]) {
          if (cab && cab.destMat) cab.destMat.emissiveIntensity = lerp(0.18, 2.4, t);
          if (!cab) continue;
          for (const light of cab.headlights) {
            light.glowMat.opacity = light.head ? lerp(0.2, 0.9, t) : lerp(0.14, 0.55, t);
            if (light.haloMat) {
              light.haloMat.opacity = light.head ? lerp(0.05, 0.32, t) : lerp(0.03, 0.18, t);
            }
          }
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// low-detail proxy — kept in sync with the new formation
// ---------------------------------------------------------------------------

export function createTrainProxy({ color = '#0b5fae' } = {}) {
  const group = new THREE.Group();
  group.name = 'train-proxy';

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.18,
    envMapIntensity: 0.35,
  });
  const headMat = new THREE.MeshBasicMaterial({ color: 0x161310, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x2a0705, toneMapped: false });

  const silver = new THREE.Color(0xe2e6e7);
  const silverDark = new THREE.Color(0xc6cccd);
  const glass = new THREE.Color(0x0b1518);
  const accent = new THREE.Color(color);
  const dark = new THREE.Color(0x23282a);
  const gangwayCol = new THREE.Color(0x121617);
  const roofEq = new THREE.Color(0x3a4144);

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
    const cabSign = i === 0 ? -1 : i === 2 ? 1 : 0;
    // Car-local geometry: placeCarsFor() supplies the (i - 1) * spacing offset,
    // so baking it in here would double the gap between coaches.
    const cz = 0;
    const layout = carLayout(cabSign);
    const parts = [];
    // stainless body, roof cap and cantrail band
    parts.push(paint(new THREE.BoxGeometry(TRAIN.width, 2.82, TRAIN.shellLength).translate(0, 2.31, cz), silver));
    parts.push(paint(new THREE.BoxGeometry(2.42, 0.12, TRAIN.shellLength).translate(0, 3.7, cz), silverDark));
    parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.012, 0.46, TRAIN.shellLength - 0.1).translate(0, 3.42, cz), accent));
    // skirt / underframe
    parts.push(paint(new THREE.BoxGeometry(2.66, 0.4, TRAIN.shellLength - 0.2).translate(0, 0.72, cz), dark));
    parts.push(paint(new THREE.BoxGeometry(2.3, 0.4, 2.6).translate(0, 0.62, cz - 7.9), dark));
    parts.push(paint(new THREE.BoxGeometry(2.3, 0.4, 2.6).translate(0, 0.62, cz + 7.9), dark));
    // panoramic saloon windows (dark glazing only where the real ones are)
    for (const dz of layout.windows) {
      parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.014, 1.04, WINDOW_W).translate(0, 2.58, cz + dz), glass));
    }
    // doors: brushed panels with a dark window in each leaf
    for (const dz of layout.doors) {
      parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.014, 2.15, DOOR_W).translate(0, 2.1, cz + dz), silverDark));
      for (const leaf of [-1, 1]) {
        parts.push(paint(new THREE.BoxGeometry(TRAIN.width + 0.02, 0.86, DOOR_W * 0.33)
          .translate(0, 2.62, cz + dz + leaf * DOOR_W * 0.24), glass));
      }
    }
    // roof equipment, matching the detailed set's AC packs
    for (const dz of [-5, 5]) {
      parts.push(paint(new THREE.BoxGeometry(1.8, 0.3, 2.2).translate(0, 3.9, cz + dz), roofEq));
    }
    parts.push(paint(new THREE.BoxGeometry(0.12, 0.06, TRAIN.shellLength - 3.4).translate(0, 3.78, cz), dark));
    // pantograph on the middle car
    if (i === 1) {
      parts.push(paint(new THREE.BoxGeometry(0.06, 0.06, 0.9).translate(0, 4.3, cz + 0.1), dark));
      parts.push(paint(new THREE.BoxGeometry(1.42, 0.05, 0.09).translate(0, 4.62, cz + 0.58), dark));
      parts.push(paint(new THREE.BoxGeometry(0.05, 1.0, 0.05).translate(0, 4.12, cz + 0.34), dark));
    }
    // cab ends: dark canopy and blue wrap
    for (const end of [-1, 1]) {
      const isCab = (end > 0 && cabSign > 0) || (end < 0 && cabSign < 0);
      if (!isCab) continue;
      const z = cz + end * (TRAIN.shellLength / 2 + 0.45);
      parts.push(paint(new THREE.BoxGeometry(2.6, 2.5, 0.9).translate(0, 2.25, z), silver));
      parts.push(paint(new THREE.BoxGeometry(2.62, 0.5, 0.92).translate(0, 3.42, z), accent));
      parts.push(paint(new THREE.BoxGeometry(2.3, 0.55, 0.94).translate(0, 3.42, z), dark));
      parts.push(paint(new THREE.BoxGeometry(2.1, 0.72, 0.05).translate(0, 2.85, z + end * 0.46), glass));
    }
    // Half a gangway on every coupled end. Neighbouring coaches each bring
    // their half, so the pair closes the 1 m gap between the bodies.
    const coupled = [];
    if (cabSign <= 0) coupled.push(1);
    if (cabSign >= 0) coupled.push(-1);
    for (const end of coupled) {
      const z = end * (TRAIN.shellLength / 2 + 0.45);
      parts.push(paint(new THREE.BoxGeometry(2.12, 2.5, 0.9).translate(0, 2.19, z), gangwayCol));
      for (const r of [-0.22, 0.22]) {
        parts.push(paint(new THREE.BoxGeometry(2.2, 2.56, 0.05).translate(0, 2.19, z + r), dark));
      }
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const carGroup = new THREE.Group();
    carGroup.add(mesh);
    group.add(carGroup);
    cars.push(carGroup);
    parts.forEach((g) => g.dispose());
  }

  // Lit saloon band — one quad per window bay, split per coach so it can be
  // culled together with its coach.
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const glowCars = [];
  for (let i = 0; i < 3; i++) {
    const cabSign = i === 0 ? -1 : i === 2 ? 1 : 0;
    const layout = carLayout(cabSign);
    const glowParts = [];
    for (const wz of layout.windows) {
      for (const sgn of [-1, 1]) {
        glowParts.push(
          new THREE.PlaneGeometry(WINDOW_W - 0.2, 0.82)
            .rotateY((sgn * Math.PI) / 2)
            .translate(sgn * (TRAIN.width / 2 + 0.035), 2.58, wz)
        );
      }
    }
    for (const dz of layout.doors) {
      for (const sgn of [-1, 1]) {
        glowParts.push(
          new THREE.PlaneGeometry(1.0, 0.95)
            .rotateY((sgn * Math.PI) / 2)
            .translate(sgn * (TRAIN.width / 2 + 0.036), 2.4, dz)
        );
      }
    }
    const glow = new THREE.Mesh(mergeGeometries(glowParts), glowMat);
    glow.name = 'proxy-saloon';
    cars[i].add(glow);
    glowCars.push(glow);
    glowParts.forEach((g) => g.dispose());
  }

  // head / tail lamps ride on the end coaches so they cull with them.
  // The cab nose is 0.9 deep and centred at shellLength/2 + 0.45, so its
  // outer face is at shellLength/2 + 0.9 — put the lamps just proud of it.
  const noseFace = TRAIN.shellLength / 2 + 0.9;
  const lampPair = (parent, end, material) => {
    const gs = [
      new THREE.PlaneGeometry(0.5, 0.18).translate(-0.84, 1.86, 0),
      new THREE.PlaneGeometry(0.5, 0.18).translate(0.84, 1.86, 0),
    ];
    const mesh = new THREE.Mesh(mergeGeometries(gs), material);
    gs.forEach((g) => g.dispose());
    mesh.position.z = end * (noseFace + 0.03);
    if (end < 0) mesh.rotation.y = Math.PI;
    parent.add(mesh);
    return mesh;
  };
  const plusEnd = lampPair(cars[2], 1, headMat);
  const minusEnd = lampPair(cars[0], -1, tailMat);

  if (!proxyGlowTex) proxyGlowTex = makeGlowRadial(96);
  const lampGlow = (parent, end) => {
    const m = new THREE.MeshBasicMaterial({
      map: proxyGlowTex,
      color: 0xfff2d8,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), m);
    mesh.position.set(0, 1.86, end * (noseFace + 0.07));
    if (end < 0) mesh.rotation.y = Math.PI;
    mesh.renderOrder = 5;
    parent.add(mesh);
    return { mesh, mat: m };
  };
  const plusLamp = lampGlow(cars[2], 1);
  const minusLamp = lampGlow(cars[0], -1);

  const HEAD_DAY = new THREE.Color(0xfff2d0);
  const HEAD_NIGHT = new THREE.Color(0xfff5da);
  const TAIL_DAY = new THREE.Color(0x2a0705);
  const TAIL_NIGHT = new THREE.Color(0xff3020);
  const SPRITE_HEAD = new THREE.Color(0xfff2d8);
  const SPRITE_TAIL = new THREE.Color(0xff3422);

  let direction = 1;
  let nightK = 0;

  function applyLamps() {
    const forward = direction >= 0;
    plusEnd.material = forward ? headMat : tailMat;
    minusEnd.material = forward ? tailMat : headMat;
    headMat.color.lerpColors(HEAD_DAY, HEAD_NIGHT, nightK);
    tailMat.color.lerpColors(TAIL_DAY, TAIL_NIGHT, nightK);
    const plusLeading = forward;
    plusLamp.mat.color.copy(plusLeading ? SPRITE_HEAD : SPRITE_TAIL);
    minusLamp.mat.color.copy(plusLeading ? SPRITE_TAIL : SPRITE_HEAD);
    plusLamp.mat.opacity = forward
      ? THREE.MathUtils.lerp(0.35, 0.72, nightK)
      : THREE.MathUtils.lerp(0.2, 0.5, nightK);
    minusLamp.mat.opacity = forward
      ? THREE.MathUtils.lerp(0.2, 0.5, nightK)
      : THREE.MathUtils.lerp(0.35, 0.72, nightK);
  }
  applyLamps();

  return {
    group,
    cars,
    /**
     * Only draw the coaches that are actually near the camera. The whole set is
     * still simulated, but a coach that is not in the vicinity is hidden along
     * with its window glow, which keeps the far ends of the network from turning
     * into a smear of tiny boxes.
     */
    cull(focus, radius = 900) {
      const r2 = radius * radius;
      const on = [];
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        const dx = c.position.x - focus.x;
        const dz = c.position.z - focus.z;
        const vis = dx * dx + dz * dz <= r2;
        c.visible = vis;
        if (glowCars[i]) glowCars[i].visible = vis;
        on.push(vis);
      }
      plusEnd.visible = plusLamp.mesh.visible = on[2];
      minusEnd.visible = minusLamp.mesh.visible = on[0];
    },
    setMode(dir) {
      direction = dir;
      applyLamps();
    },
    setDoors() {},
    setDestination() {},
    setNight(night) {
      this.setNightFactor(night ? 1 : 0);
    },
    setNightFactor(k) {
      nightK = THREE.MathUtils.clamp(k, 0, 1);
      mat.emissive.setHex(0x141a22);
      mat.emissiveIntensity = 0.7 * nightK;
      glowMat.opacity = 0.72 * nightK;
      applyLamps();
    },
  };
}
