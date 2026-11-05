// ---------------------------------------------------------------------------
// Shared procedural textures
//
// Everything is generated on a canvas at boot: no external texture downloads,
// no licensing, and the whole set is a few hundred kB of GPU memory.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c, { srgb = true, repeat = [1, 1], anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const rand = (() => {
  let seed = 20261105;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
})();

function noise(g, w, h, amount, alpha) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    d[i + 3] = Math.max(0, Math.min(255, d[i + 3] * (alpha ?? 1)));
  }
  g.putImageData(img, 0, 0);
}

export function makeConcrete(anisotropy = 8) {
  const w = 512;
  const h = 512;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#c3c0b7';
  g.fillRect(0, 0, w, h);

  // broad mottling
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 18 + rand() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() > 0.5;
    gr.addColorStop(0, dark ? `rgba(120,118,110,${0.05 + rand() * 0.1})` : `rgba(215,212,203,${0.05 + rand() * 0.1})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // formwork panel joints
  g.strokeStyle = 'rgba(120,118,110,0.35)';
  g.lineWidth = 1.4;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo((i * w) / 4, 0);
    g.lineTo((i * w) / 4, h);
    g.stroke();
    g.beginPath();
    g.moveTo(0, (i * h) / 4);
    g.lineTo(w, (i * h) / 4);
    g.stroke();
  }

  // vertical rain streaks
  for (let i = 0; i < 120; i++) {
    const x = rand() * w;
    const len = 40 + rand() * 260;
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, `rgba(90,88,80,${0.02 + rand() * 0.07})`);
    grad.addColorStop(1, 'rgba(90,88,80,0)');
    g.fillStyle = grad;
    g.fillRect(x, rand() * h, 1 + rand() * 3, len);
  }

  // tie-rod holes
  g.fillStyle = 'rgba(105,103,96,0.5)';
  for (let i = 0; i < 22; i++) {
    g.beginPath();
    g.arc(rand() * w, rand() * h, 1.6 + rand() * 1.2, 0, Math.PI * 2);
    g.fill();
  }

  noise(g, w, h, 16);
  return finish(c, { anisotropy });
}

export function makeTrackbed(anisotropy = 8) {
  const w = 512;
  const h = 512;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#8d8e89';
  g.fillRect(0, 0, w, h);

  // aggregate / ballast speckle
  for (let i = 0; i < 9000; i++) {
    const v = 95 + rand() * 85;
    g.fillStyle = `rgba(${v},${v},${v - 3},${0.25 + rand() * 0.4})`;
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 2.4, 1 + rand() * 2.4);
  }

  // transverse sleeper/plinth lines (v runs along the track)
  const spacing = 64;
  for (let y = 0; y < h; y += spacing) {
    const grad = g.createLinearGradient(0, y, 0, y + 12);
    grad.addColorStop(0, 'rgba(40,41,40,0.55)');
    grad.addColorStop(1, 'rgba(40,41,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, y, w, 12);
    g.fillStyle = 'rgba(190,188,180,0.35)';
    g.fillRect(0, y + 12, w, 1.2);
  }

  // oil / grime down the centre of each rail path
  for (const x of [w * 0.28, w * 0.72]) {
    const grad = g.createLinearGradient(x - 40, 0, x + 40, 0);
    grad.addColorStop(0, 'rgba(35,34,32,0)');
    grad.addColorStop(0.5, 'rgba(35,34,32,0.35)');
    grad.addColorStop(1, 'rgba(35,34,32,0)');
    g.fillStyle = grad;
    g.fillRect(x - 40, 0, 80, h);
  }

  noise(g, w, h, 22);
  return finish(c, { anisotropy });
}

export function makePlatformTile(anisotropy = 8) {
  const w = 512;
  const h = 512;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#2f3236';
  g.fillRect(0, 0, w, h);

  const tile = 64;
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      const v = 62 + rand() * 22;
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      g.fillRect(x + 1.2, y + 1.2, tile - 2.4, tile - 2.4);
      // polished sheen streak
      const gr = g.createLinearGradient(x, y, x + tile, y + tile);
      gr.addColorStop(0, 'rgba(255,255,255,0.05)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.05)');
      g.fillStyle = gr;
      g.fillRect(x + 1.2, y + 1.2, tile - 2.4, tile - 2.4);
    }
  }
  // grout
  g.strokeStyle = 'rgba(18,19,21,0.85)';
  g.lineWidth = 1.4;
  for (let y = 0; y <= h; y += tile) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  for (let x = 0; x <= w; x += tile) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  noise(g, w, h, 9);
  return finish(c, { anisotropy });
}

export function makeTactile(anisotropy = 8) {
  const w = 256;
  const h = 256;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#c8a94e';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,242,190,0.55)';
  for (let y = 16; y < h; y += 32) {
    for (let x = 16; x < w; x += 32) {
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(120,96,30,0.25)';
      g.beginPath();
      g.arc(x + 1.5, y + 1.5, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,242,190,0.55)';
    }
  }
  noise(g, w, h, 10);
  return finish(c, { anisotropy });
}

export function makeSteel(anisotropy = 8) {
  const w = 256;
  const h = 256;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#8e9494';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const y = rand() * h;
    const a = 0.02 + rand() * 0.08;
    g.strokeStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,44,44,${a})`;
    g.lineWidth = 0.6 + rand() * 1.2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y + (rand() - 0.5) * 2);
    g.stroke();
  }
  noise(g, w, h, 8);
  return finish(c, { anisotropy, repeat: [2, 2] });
}

export function makeRoofPanel(anisotropy = 8) {
  const w = 256;
  const h = 256;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#cfd4d3';
  g.fillRect(0, 0, w, h);
  // standing seams
  for (let x = 0; x < w; x += 32) {
    g.fillStyle = 'rgba(120,128,128,0.55)';
    g.fillRect(x, 0, 2, h);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 2, 0, 1.5, h);
  }
  for (let y = 0; y < h; y += 64) {
    g.fillStyle = 'rgba(120,128,128,0.35)';
    g.fillRect(0, y, w, 1.6);
  }
  noise(g, w, h, 6);
  return finish(c, { anisotropy });
}

export function makeAsphalt(anisotropy = 8) {
  const w = 256;
  const h = 256;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#3a3c3d';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) {
    const v = 40 + rand() * 70;
    g.fillStyle = `rgba(${v},${v},${v},${0.3 + rand() * 0.35})`;
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
  noise(g, w, h, 14);
  return finish(c, { anisotropy });
}

/**
 * Station name board. Wide canvas, deep blue fascia, white letters and the
 * route line colour as a stripe.
 */
export function makeSignTexture(name, color, { sub = '', w = 512, h = 96 } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#0a2c56';
  g.fillRect(0, 0, w, h);
  g.fillStyle = color;
  g.fillRect(0, h - 9, w, 9);

  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = name.toUpperCase();
  let size = 44;
  g.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(text).width > w - 44 && size > 16) {
    size -= 2;
    g.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`;
  }
  g.fillText(text, w / 2, h / 2 - 4);
  if (sub) {
    g.font = '500 15px "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.72)';
    g.fillText(sub, w / 2, h - 24);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeLineBadge(color, anisotropy = 8) {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = '700 30px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('M', 32, 34);
  return finish(c, { anisotropy });
}

export function makeGlowRadial(size = 128) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,246,222,0.95)');
  gr.addColorStop(0.18, 'rgba(255,238,200,0.55)');
  gr.addColorStop(0.5, 'rgba(255,220,160,0.14)');
  gr.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
