// ---------------------------------------------------------------------------
// Lighting, sky and atmosphere
//
// One rig for day and night. The sun and the generated sky dome are driven from
// the same angle so metals, concrete and glass all agree about where the light
// comes from, which is what makes the composite read as one photograph rather
// than a 3D object pasted onto a map.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const DEG = Math.PI / 180;

export const PRESETS = {
  day: {
    sunAzimuth: 232,
    sunElevation: 46,
    sunColor: 0xfff3df,
    sunIntensity: 3.05,
    hemiSky: 0xc2dcf5,
    hemiGround: 0x8f8c84,
    hemiIntensity: 0.98,
    ambient: 0xa8bccf,
    ambientIntensity: 0.30,
    envIntensity: 1.02,
    exposure: 1.02,
    shadowIntensity: 0.72,
    skyTop: '#2c6cb2',
    skyMid: '#8fb8dc',
    skyHorizon: '#dfe4dc',
    ground: '#958b76',
    sunDisc: 1,
  },
  night: {
    sunAzimuth: 66,
    sunElevation: 52,
    sunColor: 0x8fb2e8,
    sunIntensity: 0.58,
    hemiSky: 0x335073,
    hemiGround: 0x40382c,
    hemiIntensity: 1.55,
    ambient: 0x1e2c46,
    ambientIntensity: 1.0,
    envIntensity: 0.72,
    exposure: 1.32,
    shadowIntensity: 0.35,
    skyTop: '#03060c',
    skyMid: '#081222',
    skyHorizon: '#1d2b3c',
    ground: '#070b11',
    sunDisc: 0,
  },
};

function sunVector(preset) {
  const az = preset.sunAzimuth * DEG;
  const el = preset.sunElevation * DEG;
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    -Math.cos(az) * Math.cos(el)
  ).normalize();
}

/**
 * Equirectangular sky painted from the preset: gradient, horizon haze, sun/moon
 * disc and glow, plus a ground hemisphere so downward-facing metal picks up a
 * plausible bounce instead of turning black.
 */
function paintSky(preset, { width = 1024, height = 512 } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  const horizon = height / 2;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, preset.skyTop);
  sky.addColorStop(0.55, preset.skyMid);
  sky.addColorStop(1, preset.skyHorizon);
  g.fillStyle = sky;
  g.fillRect(0, 0, width, horizon + 1);

  const ground = g.createLinearGradient(0, horizon, 0, height);
  ground.addColorStop(0, preset.ground);
  ground.addColorStop(1, '#000000');
  g.fillStyle = ground;
  g.fillRect(0, horizon, width, height - horizon);

  // broad cloud bands, weighted to the upper third
  if (preset.sunDisc > 0.5) {
    for (let i = 0; i < 34; i++) {
      const x = Math.random() * width;
      const y = 40 + Math.random() * (horizon * 0.55);
      const rx = 60 + Math.random() * 190;
      const ry = 9 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(255,255,255,${0.05 + Math.random() * 0.12})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // sun / moon disc placed with the same azimuth+elevation as the light
  const az = preset.sunAzimuth * DEG;
  const el = preset.sunElevation * DEG;
  const sx = ((az / (Math.PI * 2)) % 1) * width;
  const sy = horizon - (el / (Math.PI / 2)) * horizon;
  const radius = preset.sunDisc > 0.5 ? 26 : 18;
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, radius * 9);
  const core = preset.sunDisc > 0.5 ? '255,250,235' : '210,224,255';
  glow.addColorStop(0, `rgba(${core},0.95)`);
  glow.addColorStop(0.12, `rgba(${core},0.55)`);
  glow.addColorStop(0.4, `rgba(${core},0.12)`);
  glow.addColorStop(1, `rgba(${core},0)`);
  g.fillStyle = glow;
  g.fillRect(sx - radius * 9, sy - radius * 9, radius * 18, radius * 18);

  g.fillStyle = preset.sunDisc > 0.5 ? '#fffdf4' : '#e6eeff';
  g.beginPath();
  g.arc(sx, sy, radius, 0, Math.PI * 2);
  g.fill();

  // stars at night
  if (preset.sunDisc < 0.5) {
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * width;
      const y = Math.random() * horizon * 0.85;
      const a = 0.15 + Math.random() * 0.6;
      g.fillStyle = `rgba(220,235,255,${a})`;
      g.fillRect(x, y, 1.1, 1.1);
    }
  }

  return c;
}

function buildEnvironment(renderer, preset) {
  const canvas = paintSky(preset);
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return target.texture;
}

export function createLighting({ scene, renderer, preset = 'day' }) {
  const state = { mode: preset, preset: PRESETS[preset] };

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -118;
  sun.shadow.camera.right = 118;
  sun.shadow.camera.top = 118;
  sun.shadow.camera.bottom = -118;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 620;
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.42;
  sun.shadow.radius = 2.2;
  sun.shadow.blurSamples = 8;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  let envTarget = null;
  const temp = new THREE.Vector3();

  function apply(mode, { rebuildEnv = true } = {}) {
    const p = PRESETS[mode] || PRESETS.day;
    state.mode = mode;
    state.preset = p;

    sun.color.setHex(p.sunColor);
    sun.intensity = p.sunIntensity;
    sun.shadow.intensity = p.shadowIntensity;
    sun.userData.dir = sunVector(p);

    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
    hemi.intensity = p.hemiIntensity;

    ambient.color.setHex(p.ambient);
    ambient.intensity = p.ambientIntensity;

    // NOTE: scene fog is deliberately not used. The custom layer folds the
    // model matrix into the projection matrix, so fragment view-space distance
    // is measured from the local origin rather than the camera and any fog
    // washes the whole scene out. Aerial perspective is applied to the raster
    // instead (see world.setTimeMode / the CSS grade).
    scene.fog = null;

    if (rebuildEnv) {
      if (envTarget) envTarget.dispose();
      envTarget = buildEnvironment(renderer, p);
      scene.environment = envTarget;
    }
    scene.environmentIntensity = p.envIntensity;
    renderer.toneMappingExposure = p.exposure;

    scene.userData.preset = p;
    document.documentElement.dataset.timeMode = mode;
  }

  function updateSun(target) {
    const dir = sun.userData.dir;
    sun.target.position.copy(target);
    sun.position.copy(target).addScaledVector(dir, 340);
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  // Keep the shadow camera tight around the subject so 4096 texels cover a
  // small area and the shadow edges stay crisp at street zoom.
  function focus(target) {
    sun.shadow.camera.updateProjectionMatrix();
    updateSun(target);
  }

  apply(preset === 'night' ? 'night' : 'day');

  return {
    sun,
    hemi,
    ambient,
    get mode() {
      return state.mode;
    },
    get preset() {
      return state.preset;
    },
    setMode(mode) {
      if (mode === state.mode) return;
      apply(mode);
    },
    updateSun,
    focus,
    dir: () => sun.userData.dir,
    temp,
  };
}
