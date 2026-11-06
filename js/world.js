// ---------------------------------------------------------------------------
// MapLibre + Three.js bridge
//
// MapLibre draws the satellite raster and the OSM city. The guideways,
// stations and trains live in a custom 3D layer rendered into MapLibre's own
// WebGL context. The scene is authored in a local metric frame (x east,
// y up, z north); the Mercator transform is folded into the projection matrix
// so a single draw call can place geometry anywhere on the planet without
// losing float precision.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MAP } from './config.js?v=20261106g';
import { createLighting, PRESETS } from './lighting.js?v=20261106g';

const ESRI_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function buildStyle(network) {
  return {
    version: 8,
    name: 'Hyderabad Metro',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    // Every paint change below eases over the same window as the 3D rig and the
    // CSS grade, which is what makes the day ↔ night switch a single slow fade
    // rather than a slideshow of separate layers snapping.
    transition: { duration: 4200, delay: 0 },
    sky: {
      'sky-color': '#7fb0d8',
      'horizon-color': '#dbe3da',
      'fog-color': '#dbe3da',
      'fog-ground-blend': 0.9,
      'horizon-fog-blend': 0.7,
      'sky-horizon-blend': 0.8,
      'atmosphere-blend': 0.85,
    },
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
      { id: 'background', type: 'background', paint: { 'background-color': '#0a1012' } },
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        paint: {
          'raster-saturation': -0.06,
          'raster-contrast': 0.05,
          'raster-brightness-min': 0.01,
          'raster-brightness-max': 0.97,
        },
      },
      // Night city: the roads themselves become the source of light. Three
      // stacked line layers give a soft amber bloom over every street, which
      // reads as sodium lighting from the air without any external tiles.
      {
        id: 'night-streets-bloom',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        minzoom: 13,
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'],
          true,
          false,
        ],
        paint: {
          'line-color': '#ff8a2a',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 26, 18, 48],
          'line-opacity': 0.1,
          'line-blur': 20,
        },
      },
      {
        id: 'night-streets-glow',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        minzoom: 13,
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'],
          true,
          false,
        ],
        paint: {
          'line-color': '#ff9a3c',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 8, 18, 18],
          'line-opacity': 0.22,
          'line-blur': 7,
        },
      },
      {
        id: 'night-streets-core',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        minzoom: 13,
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'],
          true,
          false,
        ],
        paint: {
          'line-color': '#ffe2b0',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 16, 1.0, 18, 2.0],
          'line-opacity': 0.4,
          'line-blur': 1.2,
        },
      },
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'omt',
        'source-layer': 'building',
        minzoom: 14.0,
        layout: { visibility: 'none' },
        filter: [
          'all',
          ['==', ['geometry-type'], 'Polygon'],
          ['>=', ['coalesce', ['get', 'render_height'], 0], 10],
        ],
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
            10, '#8f8a80',
            30, '#a8a294',
            80, '#c2bbab',
            160, '#d3ccbb',
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.82,
          'fill-extrusion-vertical-gradient': true,
        },
      },
    ],
  };
}

function lineGeoJSON(network) {
  return {
    type: 'FeatureCollection',
    features: network.lines.map((l) => ({
      type: 'Feature',
      properties: { id: l.id, color: l.color },
      geometry: { type: 'LineString', coordinates: l.outline },
    })),
  };
}

function stationGeoJSON(network) {
  const features = [];
  for (const line of network.lines) {
    for (const st of line.stations) {
      features.push({
        type: 'Feature',
        properties: {
          name: st.name,
          line: line.id,
          color: line.color,
          interchange: st.interchange && st.interchange.length ? 1 : 0,
          terminus: st.order === 0 || st.order === line.stations.length - 1 ? 1 : 0,
        },
        geometry: { type: 'Point', coordinates: [st.lon, st.lat] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function addMapLayers(map, network) {
  map.addSource('routes', { type: 'geojson', data: lineGeoJSON(network) });
  map.addSource('stations', { type: 'geojson', data: stationGeoJSON(network) });

  // All three lines are always drawn; the active one gets a brighter glow.
  map.addLayer({
    id: 'route-glow',
    type: 'line',
    source: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 16, 18, 40],
      'line-opacity': 0.12,
      'line-blur': 10,
    },
  });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': 'rgba(6,14,20,0.55)',
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2.4, 16, 4.6, 18, 7],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.75, 15.4, 0],
    },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 16, 2.8, 18, 4.6],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 15.4, 0],
    },
  });
  map.addLayer({
    id: 'station-halo',
    type: 'circle',
    source: 'stations',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 17, 8],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.28,
      'circle-blur': 1,
    },
  });
  map.addLayer({
    id: 'station-dots',
    type: 'circle',
    source: 'stations',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 17, 3.1],
      'circle-color': '#f7fbfc',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.2,
      'circle-opacity': 0.95,
    },
  });
  map.addLayer({
    id: 'station-labels',
    type: 'symbol',
    source: 'stations',
    minzoom: 13.6,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13.6, 9, 17.2, 11.5],
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-max-width': 9,
      'text-padding': 3,
      'text-allow-overlap': false,
      'symbol-sort-key': ['get', 'interchange'],
    },
    paint: {
      'text-color': '#f2f8fa',
      'text-halo-color': 'rgba(4,10,14,0.92)',
      'text-halo-width': 1.7,
      'text-halo-blur': 0.4,
    },
  });
}

export function createWorld({ network, sceneObjects, onProgress = () => {} }) {
  const map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(network),
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
  scene.name = 'metro';
  for (const obj of sceneObjects) scene.add(obj);

  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  camera.matrix.identity();
  camera.matrixWorld.identity();
  camera.matrixWorldInverse.identity();

  let lighting = null;
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.ShadowMaterial({ color: 0x03070a, opacity: 0.55, depthWrite: false })
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = 1;
  shadowCatcher.position.y = 0.05;
  scene.add(shadowCatcher);

  const modelToMercator = new THREE.Matrix4().set(
    network.frame.S, 0, 0, network.frame.O.x,
    0, 0, -network.frame.S, network.frame.O.y,
    0, network.frame.S, 0, 0,
    0, 0, 0, 1
  );

  let renderer = null;
  let lastW = 0;
  let lastH = 0;
  const mat = new THREE.Matrix4();
  let drawCalls = 0;

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
        powerPreference: 'high-performance',
        stencil: false,
      });
      renderer.autoClear = false;
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = true;
      renderer.info.autoReset = false;
      lighting = createLighting({
        scene,
        renderer,
        preset: document.documentElement.dataset.timeMode === 'night' ? 'night' : 'day',
      });
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
      renderer.info.reset();
      renderer.render(scene, camera);
      drawCalls = renderer.info.render.calls;
    },
  };

  const ready = new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    setTimeout(done, 16000);
    map.on('load', () => {
      onProgress(0.72);
      addMapLayers(map, network);
      map.addLayer(customLayer);
      map.once('idle', done);
      setTimeout(done, 5000);
    });
  });

  function setCamera({ center, bearing, pitch, zoom }) {
    map.jumpTo({ center, bearing, pitch, zoom });
  }

  function updateSun(target) {
    if (!lighting) return;
    lighting.updateSun(target);
    shadowCatcher.position.set(target.x, 0.05, target.z);
  }

  const NIGHT_STREETS = ['night-streets-bloom', 'night-streets-glow', 'night-streets-core'];
  const NIGHT_STREET_OPACITY = {
    'night-streets-bloom': 0.1,
    'night-streets-glow': 0.26,
    'night-streets-core': 0.46,
  };

  let skyTries = 0;
  let skyFade = null;
  let skyAccum = 1;
  let nightStreetTimer = 0;

  // setSky needs a fully parsed style; on a cold load (or a slow Pages
  // request) the sky spec is not there yet. Retry briefly instead of throwing
  // out of the boot sequence.
  function commitSky() {
    if (!map.setSky || !lighting || !map.isStyleLoaded()) return false;
    try {
      map.setSky(lighting.skySpec());
      skyTries = 0;
      return true;
    } catch (err) {
      if (skyTries++ < 12) setTimeout(commitSky, 350);
      return false;
    }
  }

  function setTimeMode(mode, { duration = 4200 } = {}) {
    const night = mode === 'night';
    document.documentElement.dataset.timeMode = night ? 'night' : 'day';
    if (lighting) lighting.setMode(night ? 'night' : 'day', { duration: duration / 1000 });
    skyFade = { elapsed: 0, duration: Math.max(0.001, duration / 1000) };
    skyAccum = 1;

    if (map.getLayer('satellite')) {
      map.setPaintProperty('satellite', 'raster-brightness-max', night ? 0.36 : 0.97);
      map.setPaintProperty('satellite', 'raster-brightness-min', night ? 0.0 : 0.01);
      map.setPaintProperty('satellite', 'raster-saturation', night ? -0.5 : -0.06);
      map.setPaintProperty('satellite', 'raster-contrast', night ? 0.3 : 0.05);
      map.setPaintProperty('satellite', 'raster-hue-rotate', night ? 14 : 0);
    }
    if (map.getLayer('buildings-3d')) {
      map.setPaintProperty('buildings-3d', 'fill-extrusion-color', night ? '#0d1116' : [
        'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
        10, '#8f8a80',
        30, '#a8a294',
        80, '#c2bbab',
        160, '#d3ccbb',
      ]);
      map.setPaintProperty('buildings-3d', 'fill-extrusion-opacity', night ? 0.96 : 0.82);
    }
    if (map.getLayer('route-glow')) {
      map.setPaintProperty('route-glow', 'line-opacity', night ? 0.32 : 0.12);
      map.setPaintProperty('route-glow', 'line-blur', night ? 14 : 10);
    }
    if (map.getLayer('station-labels')) {
      map.setPaintProperty('station-labels', 'text-color', night ? '#e6f0ff' : '#f2f8fa');
    }

    clearTimeout(nightStreetTimer);
    if (night) {
      // Fade the street-light group in from its current opacity. It is kept
      // visible until the fade back to day has finished.
      for (const id of NIGHT_STREETS) {
        if (!map.getLayer(id)) continue;
        map.setLayoutProperty(id, 'visibility', 'visible');
        map.setPaintProperty(id, 'line-opacity', NIGHT_STREET_OPACITY[id]);
      }
    } else {
      for (const id of NIGHT_STREETS) {
        if (!map.getLayer(id)) continue;
        map.setPaintProperty(id, 'line-opacity', 0);
      }
      nightStreetTimer = setTimeout(() => {
        if (document.documentElement.dataset.timeMode === 'night') return;
        for (const id of NIGHT_STREETS) {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        }
      }, duration + 150);
    }

    if (duration <= 0) {
      commitSky();
      skyFade = null;
    } else if (!commitSky()) {
      // The style may still be parsing on a cold boot; keep the fade timer so
      // update() retries as soon as it is ready.
    }
  }

  // Per-frame driver for the slower atmosphere terms. Paint and CSS transitions
  // are handled by MapLibre and the stylesheet; this keeps the 3D light rig and
  // the sky gradient in step with them.
  function update(dt) {
    if (lighting) lighting.update(dt);
    if (!skyFade) return;
    skyFade.elapsed += dt;
    skyAccum += dt;
    if (skyAccum > 0.16) {
      skyAccum = 0;
      commitSky();
    }
    if (skyFade.elapsed >= skyFade.duration) {
      skyFade = null;
      commitSky();
    }
  }

  function trigger() {
    map.triggerRepaint();
  }

  function setBuildingsVisible(visible) {
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', visible ? 'visible' : 'none');
    }
  }

  return {
    map,
    scene,
    camera,
    get renderer() {
      return renderer;
    },
    get sun() {
      return lighting ? lighting.sun : null;
    },
    get lighting() {
      return lighting;
    },
    get stats() {
      return { drawCalls };
    },
    setTimeMode,
    get timeMode() {
      return document.documentElement.dataset.timeMode || 'day';
    },
    setBuildingsVisible,
    update,
    updateSun,
    setCamera,
    trigger,
    ready,
  };
}
