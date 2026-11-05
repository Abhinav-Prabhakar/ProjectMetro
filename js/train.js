import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { TRAIN, COLORS } from './config.js';

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
  grad.addColorStop(0, '#d9dcdd');
  grad.addColorStop(0.35, '#cbd0d1');
  grad.addColorStop(0.7, '#c0c5c6');
  grad.addColorStop(1, '#aab0b1');
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
  g.fillStyle = '#b8bcbd';
  g.fillRect(0, 0, 512, 512);
  // longitudinal ribs
  for (let x = 0; x < 512; x += 10) {
    g.fillStyle = x % 20 === 0 ? 'rgba(255,255,255,0.11)' : 'rgba(30,34,35,0.14)';
    g.fillRect(x, 0, 1, 512);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(20,24,25,${Math.random() * 0.06})`;
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

function makeFrontTexture() {
  const W = 1024;
  const H = 1024;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');

  // base stainless face
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#d5d8d9');
  base.addColorStop(0.45, '#c3c8c9');
  base.addColorStop(0.78, '#b4babb');
  base.addColorStop(1, '#969c9d');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // blue fascia wrapped around the screen
  g.fillStyle = '#0b5fae';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, H * 0.36);
  g.bezierCurveTo(W * 0.98, H * 0.5, W * 0.9, H * 0.58, W * 0.82, H * 0.59);
  g.bezierCurveTo(W * 0.75, H * 0.5, W * 0.68, H * 0.44, W * 0.58, H * 0.43);
  g.lineTo(W * 0.42, H * 0.43);
  g.bezierCurveTo(W * 0.32, H * 0.44, W * 0.25, H * 0.5, W * 0.18, H * 0.59);
  g.bezierCurveTo(W * 0.1, H * 0.58, W * 0.02, H * 0.5, 0, H * 0.36);
  g.closePath();
  g.fill();

  // dark roof brow
  const brow = g.createLinearGradient(0, 0, 0, H * 0.1);
  brow.addColorStop(0, '#151b1e');
  brow.addColorStop(1, '#263137');
  g.fillStyle = brow;
  roundRectPath(g, -30, -40, W + 60, H * 0.115 + 40, 54);
  g.fill();

  // windscreen aperture (3D glass sits on top)
  g.fillStyle = '#0b1114';
  roundRectPath(g, W * 0.075, H * 0.135, W * 0.85, H * 0.305, W * 0.055);
  g.fill();
  g.strokeStyle = 'rgba(8,12,14,0.95)';
  g.lineWidth = 12;
  roundRectPath(g, W * 0.075, H * 0.135, W * 0.85, H * 0.305, W * 0.055);
  g.stroke();

  // destination strip backing
  g.fillStyle = '#0a0d0e';
  roundRectPath(g, W * 0.315, H * 0.055, W * 0.37, H * 0.052, 8);
  g.fill();
  g.strokeStyle = 'rgba(210,220,220,0.18)';
  g.lineWidth = 2;
  g.stroke();

  // red marker lights at the corners
  for (const x of [0.23, 0.77]) {
    g.fillStyle = '#2b0a08';
    g.beginPath();
    g.arc(W * x, H * 0.083, W * 0.026, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d3362d';
    g.beginPath();
    g.arc(W * x, H * 0.083, W * 0.014, 0, Math.PI * 2);
    g.fill();
  }

  // livery stripes: red / green / blue, arched
  const curveY = (t, baseY, amp) => baseY + amp * Math.pow(2 * t - 1, 2);
  const drawStripe = (baseY, amp, thickness, colour) => {
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const y = curveY(t, baseY, amp) * H;
      if (i === 0) g.moveTo(t * W, y);
      else g.lineTo(t * W, y);
    }
    for (let i = 120; i >= 0; i--) {
      const t = i / 120;
      g.lineTo(t * W, (curveY(t, baseY, amp) + thickness) * H);
    }
    g.closePath();
    g.fillStyle = colour;
    g.fill();
  };
  drawStripe(0.505, -0.052, 0.016, '#d12f31');
  drawStripe(0.529, -0.052, 0.038, '#11934a');
  drawStripe(0.575, -0.052, 0.072, '#0b5fae');

  // silver lower panel and bumper
  g.fillStyle = 'rgba(205,210,211,0.14)';
  g.fillRect(0, H * 0.645, W, H * 0.25);
  const lower = g.createLinearGradient(0, H * 0.65, 0, H);
  lower.addColorStop(0, 'rgba(255,255,255,0.1)');
  lower.addColorStop(0.7, 'rgba(70,76,78,0.08)');
  lower.addColorStop(1, 'rgba(25,29,31,0.5)');
  g.fillStyle = lower;
  g.fillRect(0, H * 0.65, W, H * 0.35);

  // panel seams
  g.strokeStyle = 'rgba(35,42,44,0.28)';
  g.lineWidth = 3;
  for (const x of [0.34, 0.66]) {
    g.beginPath();
    g.moveTo(W * x, H * 0.64);
    g.lineTo(W * x, H * 0.97);
    g.stroke();
  }
  g.strokeStyle = 'rgba(240,244,244,0.22)';
  g.lineWidth = 2;
  for (const x of [0.34, 0.66]) {
    g.beginPath();
    g.moveTo(W * x + 3, H * 0.64);
    g.lineTo(W * x + 3, H * 0.97);
    g.stroke();
  }

  // headlight pockets
  for (const cx of [0.235, 0.765]) {
    g.fillStyle = 'rgba(8,11,12,0.9)';
    roundRectPath(g, W * (cx - 0.105), H * 0.705, W * 0.21, H * 0.105, 18);
    g.fill();
    g.strokeStyle = 'rgba(235,240,240,0.45)';
    g.lineWidth = 3;
    roundRectPath(g, W * (cx - 0.1), H * 0.71, W * 0.2, H * 0.095, 15);
    g.stroke();
  }

  // coupler hatch
  g.fillStyle = '#111516';
  roundRectPath(g, W * 0.405, H * 0.878, W * 0.19, H * 0.072, 10);
  g.fill();
  g.strokeStyle = 'rgba(220,228,228,0.2)';
  g.lineWidth = 2;
  g.stroke();

  // HMR mark in the blue band
  drawHmrMark(g, W * 0.5, H * 0.625, W * 0.042, true);
  // small mark below the screen
  drawHmrMark(g, W * 0.5, H * 0.665, W * 0.021, true);

  // unit number
  g.fillStyle = 'rgba(42,48,50,0.72)';
  g.font = '600 18px "JetBrains Mono", monospace';
  g.textAlign = 'right';
  g.fillText('HMR 03', W * 0.95, H * 0.955);

  // weathering / grime
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W;
    const y = H * (0.68 + Math.random() * 0.3);
    g.fillStyle = `rgba(38,40,38,${Math.random() * 0.045})`;
    g.fillRect(x, y, 1 + Math.random() * 8, 2 + Math.random() * 26);
  }
  // subtle top-to-bottom sheen
  const sheen = g.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.7, 'rgba(0,0,0,0.03)');
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

  // blue cantrail bands
  for (const sx of [-1, 1]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, TRAIN.blueBandTop - TRAIN.blueBandBottom, TRAIN.shellLength - 0.15),
      materials.blue
    );
    band.position.set(sx * (TRAIN.width / 2 + 0.003), (TRAIN.blueBandTop + TRAIN.blueBandBottom) / 2, 0);
    car.add(band);

    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.012, TRAIN.shellLength - 0.15),
      materials.steel
    );
    pin.position.set(sx * (TRAIN.width / 2 + 0.004), TRAIN.blueBandBottom - 0.015, 0);
    car.add(pin);
  }

  // windows and doors
  const glassGeo = (w, h, r = 0.09) => roundedPanelGeom(w, h, r, 10);
  const windowFrameMat = materials.gasket;

  const addWindow = (side, z, w, h = 1.1) => {
    const x = side * (TRAIN.width / 2 + 0.004);
    const frame = new THREE.Mesh(
      roundedPanelGeom(w + 0.1, h + 0.1, 0.14, 10),
      windowFrameMat
    );
    frame.rotation.y = side * Math.PI / 2;
    frame.position.set(x, 2.56, z);
    car.add(frame);

    const glass = new THREE.Mesh(
      glassGeo(w, h, 0.11),
      materials.glass
    );
    glass.rotation.y = side * Math.PI / 2;
    glass.position.set(x + side * 0.004, 2.56, z);
    car.add(glass);
  };

  const addDoor = (side, z) => {
    const x = side * (TRAIN.width / 2 + 0.006);

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
      car.add(leafGroup);

      const leaf = new THREE.Mesh(
        new RoundedBoxGeometry(0.615, 1.9, 0.045, 2, 0.03),
        materials.doorSteel
      );
      leaf.position.set(side * 0.012, 0, 0);
      leaf.castShadow = true;
      leafGroup.add(leaf);

      const doorGlass = new THREE.Mesh(
        glassGeo(0.42, 0.92, 0.07),
        materials.glass
      );
      doorGlass.rotation.y = side * Math.PI / 2;
      doorGlass.position.set(side * 0.04, 0.5, 0);
      leafGroup.add(doorGlass);

      // handle strip on the leading edge of the leaf
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.24, 0.018),
        materials.rubber
      );
      handle.position.set(side * 0.03, -0.18, -leafSide * 0.252);
      leafGroup.add(handle);

      // centre seam
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.88, 0.014), materials.gasket);
      seam.position.set(side * 0.045, 0, -leafSide * 0.307);
      leafGroup.add(seam);

      car.userData.doors.push({
        group: leafGroup,
        side,
        leafSide,
        baseZ: z + leafSide * 0.312,
      });
    }
  };

  for (const side of [-1, 1]) {
    for (const z of TRAIN.doorCentres) addDoor(side, z);
    for (const z of TRAIN.windowCentres) addWindow(side, z, TRAIN.windowWidth);

    for (const end of [-1, 1]) {
      const isCab = (end > 0 && cabPlus) || (end < 0 && cabMinus);
      if (!isCab) {
        addWindow(side, end * 8.78, TRAIN.endWindowWidth, 1.08);
      } else {
        addWindow(side, end * 9.33, 0.52, 0.96);
        // side identity decal
        const decal = new THREE.Mesh(
          new THREE.PlaneGeometry(1.02, 0.425),
          materials.sideDecal
        );
        decal.rotation.y = side * Math.PI / 2;
        decal.position.set(side * (TRAIN.width / 2 + 0.007), 2.29, end * 8.2);
        if (side < 0) decal.rotation.y = -Math.PI / 2;
        car.add(decal);
      }
    }
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

  return { group: car, cabA, cabB, bogies, wheels: car.userData.wheels, doors: car.userData.doors };
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

  const steel = new THREE.MeshPhysicalMaterial({
    map: steelMap,
    color: 0xd8dcdd,
    metalness: 0.82,
    roughness: 0.34,
    roughnessMap: roughMap,
    clearcoat: 0.18,
    clearcoatRoughness: 0.34,
    envMapIntensity: 1.05,
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
    metalness: 0.08,
    roughness: 0.3,
    clearcoat: 0.65,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.95,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x081416,
    metalness: 0.35,
    roughness: 0.045,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.4,
    emissive: 0x02090a,
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
      color: 0xe6e9e9,
      roughness: 0.62,
      metalness: 0.24,
    }),
    roofDark: new THREE.MeshStandardMaterial({ color: 0x4a5051, roughness: 0.62 }),
    ac: new THREE.MeshStandardMaterial({
      map: roofMap,
      color: 0xeef1f1,
      roughness: 0.55,
      metalness: 0.22,
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
  };
}

// ---------------------------------------------------------------------------

export function createTrain({ anisotropy = 8 } = {}) {
  const materials = makeMaterials(anisotropy);
  const frontCanvas = makeFrontTexture();
  const destinations = {
    RAIDURG: texture(makeDestination('RAIDURG'), { anisotropy }),
    NAGOLE: texture(makeDestination('NAGOLE'), { anisotropy }),
  };
  const texturesData = {
    front: texture(frontCanvas, { anisotropy }),
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

  return {
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
  };
}
