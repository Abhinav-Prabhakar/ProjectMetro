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

// Both IBL maps are built from the same 1024 x 512 equirectangular canvas, so
// they share CUBEUV_TEXEL_WIDTH / CUBEUV_TEXEL_HEIGHT and can be sampled with
// identical coordinates. The stock chunk is patched to sample both maps and
// mix them, which lets the environment fade on the GPU instead of swapping the
// PMREM texture in one frame (that swap was the visible day <-> night pop on
// the train, pillars and guideway).
function buildEnvPatch() {
  const chunk = THREE.ShaderChunk.envmap_physical_pars_fragment
    .split('textureCubeUV( envMap,')
    .join('crossfadeCubeUV( envMap,');
  return chunk.replace(
    '#ifdef USE_ENVMAP',
    `#ifdef USE_ENVMAP
	uniform sampler2D envMapNight;
	uniform float envBlend;
	vec4 crossfadeCubeUV( sampler2D envSampler, vec3 dir, float roughness ) {
		vec4 dayColor = textureCubeUV( envSampler, dir, roughness );
		if ( envBlend <= 0.0005 ) return dayColor;
		vec4 nightColor = textureCubeUV( envMapNight, dir, roughness );
		return mix( dayColor, nightColor, envBlend );
	}`
  );
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

  // Prebuild both environments once. The scene keeps the daytime map bound as
  // `envMap`; every standard/physical material samples the night map alongside
  // it and crossfades with a single uniform, so no PMREM rebuild ever happens
  // on a transition frame.
  const dayEnv = buildEnvironment(renderer, PRESETS.day);
  const nightEnv = buildEnvironment(renderer, PRESETS.night);
  const nightEnvUniform = { value: nightEnv };
  const envBlendUniform = { value: preset === 'night' ? 1 : 0 };
  scene.environment = dayEnv;

  const envPatch = buildEnvPatch();

  function patchEnvCrossfade(material) {
    if (!material || !material.isMeshStandardMaterial || material.userData.envCrossfade) return;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.envMapNight = nightEnvUniform;
      shader.uniforms.envBlend = envBlendUniform;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <envmap_physical_pars_fragment>',
        envPatch
      );
    };
    material.customProgramCacheKey = () => 'metro-env-crossfade';
    material.userData.envCrossfade = true;
    material.needsUpdate = true;
  }

  scene.traverse((obj) => {
    const material = obj.material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach(patchEnvCrossfade);
    else patchEnvCrossfade(material);
  });

  const temp = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // Crossfade state
  //
  // Lighting values live in `current`; a mode change snapshots the current
  // values and eases them toward the target preset. Sky colours come along for
  // the ride, so the map's sky gradient and the 3D rig agree at every frame.
  // -------------------------------------------------------------------------
  const makeValues = (p) => ({
    sunAzimuth: p.sunAzimuth,
    sunElevation: p.sunElevation,
    sunColor: new THREE.Color(p.sunColor),
    sunIntensity: p.sunIntensity,
    hemiSky: new THREE.Color(p.hemiSky),
    hemiGround: new THREE.Color(p.hemiGround),
    hemiIntensity: p.hemiIntensity,
    ambient: new THREE.Color(p.ambient),
    ambientIntensity: p.ambientIntensity,
    envIntensity: p.envIntensity,
    exposure: p.exposure,
    shadowIntensity: p.shadowIntensity,
    skyTop: new THREE.Color(p.skyTop),
    skyMid: new THREE.Color(p.skyMid),
    skyHorizon: new THREE.Color(p.skyHorizon),
    ground: new THREE.Color(p.ground),
    sunDisc: p.sunDisc,
  });

  const copyValues = (dst, src) => {
    dst.sunAzimuth = src.sunAzimuth;
    dst.sunElevation = src.sunElevation;
    dst.sunColor.copy(src.sunColor);
    dst.sunIntensity = src.sunIntensity;
    dst.hemiSky.copy(src.hemiSky);
    dst.hemiGround.copy(src.hemiGround);
    dst.hemiIntensity = src.hemiIntensity;
    dst.ambient.copy(src.ambient);
    dst.ambientIntensity = src.ambientIntensity;
    dst.envIntensity = src.envIntensity;
    dst.exposure = src.exposure;
    dst.shadowIntensity = src.shadowIntensity;
    dst.skyTop.copy(src.skyTop);
    dst.skyMid.copy(src.skyMid);
    dst.skyHorizon.copy(src.skyHorizon);
    dst.ground.copy(src.ground);
    dst.sunDisc = src.sunDisc;
    return dst;
  };

  const lerpValues = (dst, a, b, t) => {
    dst.sunAzimuth = THREE.MathUtils.lerp(a.sunAzimuth, b.sunAzimuth, t);
    dst.sunElevation = THREE.MathUtils.lerp(a.sunElevation, b.sunElevation, t);
    dst.sunColor.lerpColors(a.sunColor, b.sunColor, t);
    dst.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t);
    dst.hemiSky.lerpColors(a.hemiSky, b.hemiSky, t);
    dst.hemiGround.lerpColors(a.hemiGround, b.hemiGround, t);
    dst.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);
    dst.ambient.lerpColors(a.ambient, b.ambient, t);
    dst.ambientIntensity = THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t);
    dst.envIntensity = THREE.MathUtils.lerp(a.envIntensity, b.envIntensity, t);
    dst.exposure = THREE.MathUtils.lerp(a.exposure, b.exposure, t);
    dst.shadowIntensity = THREE.MathUtils.lerp(a.shadowIntensity, b.shadowIntensity, t);
    dst.skyTop.lerpColors(a.skyTop, b.skyTop, t);
    dst.skyMid.lerpColors(a.skyMid, b.skyMid, t);
    dst.skyHorizon.lerpColors(a.skyHorizon, b.skyHorizon, t);
    dst.ground.lerpColors(a.ground, b.ground, t);
    dst.sunDisc = THREE.MathUtils.lerp(a.sunDisc, b.sunDisc, t);
    return dst;
  };

  const current = makeValues(PRESETS[preset] || PRESETS.day);
  const fromValues = makeValues(PRESETS[preset] || PRESETS.day);
  const toValues = makeValues(PRESETS[preset] || PRESETS.day);
  let fade = null; // { elapsed, duration }
  let fromBlend = envBlendUniform.value;
  let toBlend = envBlendUniform.value;

  const hex = (color) => `#${color.getHexString()}`;

  function applyCurrent() {
    sun.color.copy(current.sunColor);
    sun.intensity = current.sunIntensity;
    sun.shadow.intensity = current.shadowIntensity;
    sun.userData.dir = sunVector(current);

    hemi.color.copy(current.hemiSky);
    hemi.groundColor.copy(current.hemiGround);
    hemi.intensity = current.hemiIntensity;

    ambient.color.copy(current.ambient);
    ambient.intensity = current.ambientIntensity;

    // NOTE: scene fog is deliberately not used. The custom layer folds the
    // model matrix into the projection matrix, so fragment view-space distance
    // is measured from the local origin rather than the camera and any fog
    // washes the whole scene out. Aerial perspective is applied to the raster
    // instead (see world.setTimeMode / the CSS grade).
    scene.fog = null;

    scene.environmentIntensity = current.envIntensity;
    renderer.toneMappingExposure = current.exposure;

    state.preset = current;
  }

  function setMode(mode, { duration = 0 } = {}) {
    const target = PRESETS[mode] || PRESETS.day;
    state.mode = mode;
    document.documentElement.dataset.timeMode = mode;

    if (duration <= 0) {
      copyValues(current, makeValues(target));
      fade = null;
      envBlendUniform.value = mode === 'night' ? 1 : 0;
      fromBlend = envBlendUniform.value;
      toBlend = envBlendUniform.value;
      applyCurrent();
      return;
    }
    if (state.fadeTo === mode) return;
    state.fadeTo = mode;
    copyValues(fromValues, current);
    copyValues(toValues, makeValues(target));
    fromBlend = envBlendUniform.value;
    toBlend = mode === 'night' ? 1 : 0;
    fade = { elapsed: 0, duration };
  }

  function update(dt) {
    if (!fade) return 1;
    fade.elapsed += dt;
    const raw = Math.min(1, fade.elapsed / fade.duration);
    const t = raw * raw * (3 - 2 * raw);
    lerpValues(current, fromValues, toValues, t);
    envBlendUniform.value = THREE.MathUtils.lerp(fromBlend, toBlend, t);
    applyCurrent();
    if (raw >= 1) {
      fade = null;
      state.fadeTo = null;
      envBlendUniform.value = toBlend;
      applyCurrent();
    }
    return raw;
  }

  function updateSun(target) {
    const dir = sun.userData.dir;
    // Snap the focus to whole shadow-map texels. Without this, a moving target
    // resamples the shadow map every frame and every static edge shimmers.
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
    if (texel > 0) {
      temp.set(
        Math.round(target.x / texel) * texel,
        Math.round(target.y / texel) * texel,
        Math.round(target.z / texel) * texel
      );
    } else {
      temp.copy(target);
    }
    sun.target.position.copy(temp);
    sun.position.copy(temp).addScaledVector(dir, 340);
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  // Keep the shadow camera tight around the subject so 4096 texels cover a
  // small area and the shadow edges stay crisp at street zoom.
  function focus(target) {
    sun.shadow.camera.updateProjectionMatrix();
    updateSun(target);
  }

  setMode(preset === 'night' ? 'night' : 'day');

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
    get transitioning() {
      return !!fade;
    },
    setMode,
    update,
    updateSun,
    focus,
    dir: () => sun.userData.dir,
    skySpec() {
      return {
        'sky-color': hex(current.skyTop),
        'horizon-color': hex(current.skyHorizon),
        'fog-color': hex(current.skyHorizon),
        'fog-ground-blend': 0.9,
        'horizon-fog-blend': 0.72,
        'sky-horizon-blend': 0.82,
        'atmosphere-blend': 0.87,
      };
    },
    temp,
  };
}
