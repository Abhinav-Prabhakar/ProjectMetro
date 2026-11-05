// ---------------------------------------------------------------------------
// MapLibre + Three.js bridge
//
// The map is drawn by MapLibre (Esri satellite raster + OpenFreeMap buildings).
// The guideway and the train live in a custom 3D layer rendered with Three.js
// into MapLibre's own WebGL context. The scene is authored in a local metric
// frame (x = east, y = up, z = north) and projected into Mercator at render
// time with a double-precision matrix, which keeps the train glued to the
// real corridor even at street zoom.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MAP } from './config.js';

const ESRI_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const STYLE = {
  version: 8,
  name: 'HMR Blue Line',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    satellite: {
      type: 'raster',
      tiles: [ESRI_TILES],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    omt: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: 'Data © OpenStreetMap contributors · Tiles OpenFreeMap',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0a1012' },
    },
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      paint: {
        'raster-saturation': -0.08,
        'raster-contrast': 0.04,
        'raster-brightness-min': 0.02,
        'raster-brightness-max': 0.96,
      },
    },
    {
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13.2,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-extrusion-color': '#4a5150',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 7],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.4,
        'fill-extrusion-vertical-gradient': true,
      },
    },
  ],
};

function stationCollection(route) {
  return {
    type: 'FeatureCollection',
    features: route.stations.map((st, i) => ({
      type: 'Feature',
      properties: {
        name: st.name,
        seq: i + 1,
        terminus: i === 0 || i === route.stations.length - 1 ? 1 : 0,
      },
      geometry: { type: 'Point', coordinates: [st.lon, st.lat] },
    })),
  };
}

function addMapLayers(map, route) {
  map.addSource('route', { type: 'geojson', data: route.toGeoJSON() });
  map.addSource('stations', { type: 'geojson', data: stationCollection(route) });

  map.addLayer({
    id: 'route-glow',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#2f9bff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 14, 18, 34],
      'line-opacity': 0.16,
      'line-blur': 8,
    },
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#8fd0ff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 16, 1.2, 18, 2.4],
      'line-opacity': 0.5,
      'line-dasharray': [2, 2.4],
    },
  });

  map.addLayer({
    id: 'station-halo',
    type: 'circle',
    source: 'stations',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3.5, 17, 8],
      'circle-color': '#0b5fae',
      'circle-opacity': 0.35,
      'circle-blur': 1,
    },
  });

  map.addLayer({
    id: 'station-dots',
    type: 'circle',
    source: 'stations',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.6, 17, 3.4],
      'circle-color': '#f4fbfd',
      'circle-stroke-color': '#0b4f92',
      'circle-stroke-width': 1.1,
      'circle-opacity': 0.96,
    },
  });

  map.addLayer({
    id: 'station-labels',
    type: 'symbol',
    source: 'stations',
    minzoom: 14.2,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 14.4, 9.5, 17.2, 12],
      'text-offset': [0, 1.45],
      'text-anchor': 'top',
      'text-max-width': 9,
      'text-padding': 3,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#f0f7f8',
      'text-halo-color': 'rgba(5,12,16,0.9)',
      'text-halo-width': 1.7,
      'text-halo-blur': 0.4,
    },
  });
}

function makeSkyEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#4a86c4');
  sky.addColorStop(0.34, '#84b2dc');
  sky.addColorStop(0.5, '#dfe4e0');
  sky.addColorStop(0.54, '#b9b39f');
  sky.addColorStop(1, '#565345');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);

  // soft cloud bands
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 1024;
    const y = 60 + Math.random() * 150;
    const rx = 50 + Math.random() * 140;
    const ry = 8 + Math.random() * 22;
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    gr.addColorStop(0, `rgba(255,255,255,${0.06 + Math.random() * 0.13})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  // sun glow, roughly matching the directional light
  const sun = g.createRadialGradient(322, 150, 0, 322, 150, 210);
  sun.addColorStop(0, 'rgba(255,252,238,1)');
  sun.addColorStop(0.08, 'rgba(255,246,220,0.85)');
  sun.addColorStop(0.35, 'rgba(255,225,170,0.22)');
  sun.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = sun;
  g.fillRect(80, 0, 500, 380);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return target.texture;
}

export function createWorld({ route, viaduct, train, onProgress = () => {} }) {
  const map = new maplibregl.Map({
    container: 'map',
    style: STYLE,
    center: [MAP.origin.lng, MAP.origin.lat],
    zoom: MAP.initialZoom,
    pitch: MAP.pitch,
    bearing: 0,
    minZoom: MAP.minZoom,
    maxZoom: MAP.maxZoom,
    maxPitch: MAP.maxPitch,
    antialias: true,
    preserveDrawingBuffer: true,
    attributionControl: false,
    dragPan: false,
    dragRotate: false,
    scrollZoom: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
    keyboard: false,
    renderWorldCopies: false,
    fadeDuration: 120,
  });

  const scene = new THREE.Scene();
  scene.add(viaduct);
  for (const car of train.cars) scene.add(car.group);

  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  camera.matrix.identity();
  camera.matrixWorld.identity();
  camera.matrixWorldInverse.identity();

  const hemi = new THREE.HemisphereLight(0xbcd7f2, 0x6a6152, 0.9);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x9fb2c4, 0.22));

  const sunDir = new THREE.Vector3(0.58, 0.86, -0.32).normalize();
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -165;
  sun.shadow.camera.right = 165;
  sun.shadow.camera.top = 165;
  sun.shadow.camera.bottom = -165;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 820;
  sun.shadow.bias = -0.00045;
  sun.shadow.normalBias = 0.55;
  sun.shadow.intensity = 0.62;
  sun.position.copy(sunDir).multiplyScalar(380);
  scene.add(sun);
  scene.add(sun.target);

  // local metres -> Mercator (x east, y up, z north)
  const modelToMercator = new THREE.Matrix4().set(
    route.S, 0, 0, route.O.x,
    0, 0, -route.S, route.O.y,
    0, route.S, 0, 0,
    0, 0, 0, 1
  );

  let renderer = null;
  let lastW = 0;
  let lastH = 0;
  const mat = new THREE.Matrix4();

  const customLayer = {
    id: 'metro-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({
        canvas: _map.getCanvas(),
        context: gl,
        antialias: true,
        alpha: false,
      });
      renderer.autoClear = false;
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = true;
      renderer.info.autoReset = false;

      scene.environment = makeSkyEnvironment(renderer);
      scene.environmentIntensity = 0.82;
      onProgress(0.9);
    },
    render(_gl, matrix) {
      if (!renderer) return;
      const canvas = map.getCanvas();
      if (canvas.width !== lastW || canvas.height !== lastH) {
        lastW = canvas.width;
        lastH = canvas.height;
        renderer.setSize(lastW, lastH, false);
      }
      mat.fromArray(matrix);
      camera.projectionMatrix.copy(mat).multiply(modelToMercator);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };

  const ready = new Promise((resolve) => {
    map.on('load', () => {
      onProgress(0.72);
      addMapLayers(map, route);
      map.addLayer(customLayer);
      // One tile sweep before we call it ready, with a hard timeout.
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      map.once('idle', done);
      setTimeout(done, 4200);
    });
  });

  function setCamera({ center, bearing, pitch, zoom }) {
    map.jumpTo({ center, bearing, pitch, zoom });
  }

  function updateSun(target) {
    sun.target.position.copy(target);
    sun.position.copy(target).addScaledVector(sunDir, 380);
    sun.target.updateMatrixWorld();
  }

  function trigger() {
    map.triggerRepaint();
  }

  if (typeof ResizeObserver !== 'undefined') {
    const canvas = map.getCanvas();
    const ro = new ResizeObserver(() => {
      if (!renderer) return;
      lastW = 0;
      lastH = 0;
    });
    ro.observe(canvas.parentElement || canvas);
  }

  return {
    map,
    scene,
    camera,
    sun,
    ready,
    modelToMercator,
    setCamera,
    updateSun,
    trigger,
    setBuildingsVisible(visible) {
      if (map.getLayer('buildings-3d')) {
        map.setLayoutProperty('buildings-3d', 'visibility', visible ? 'visible' : 'none');
      }
    },
    setLabelsVisible(visible) {
      if (map.getLayer('station-labels')) {
        map.setLayoutProperty('station-labels', 'visibility', visible ? 'visible' : 'none');
      }
    },
  };
}
