// ---------------------------------------------------------------------------
// Hyderabad Metro — Blue Line live tracker
//
// The train runs the real Nagole → Raidurg alignment from OpenStreetMap. It
// accelerates, brakes, stops at every station, opens its doors, dwells, and
// reverses at the termini. The camera stays locked to the set and can be
// orbited with the mouse while the chase heading keeps following the track.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MAP, TRAIN, VIADUCT, SIM } from './config.js';
import { loadRoute } from './geo.js';
import { buildViaduct } from './viaduct.js';
import { createTrain } from './train.js';
import { createWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const els = {
  intro: $('intro'),
  loadBar: $('loadBar'),
  loadStatus: $('loadStatus'),
  map: $('map'),
  clock: $('clock'),
  nextName: $('nextName'),
  nextMeta: $('nextMeta'),
  nextSeq: $('nextSeq'),
  etaVal: $('etaVal'),
  distVal: $('distVal'),
  progressFill: $('progressFill'),
  progressDot: $('progressDot'),
  prevName: $('prevName'),
  nextLabel: $('nextLabel'),
  upcomingList: $('upcomingList'),
  speedVal: $('speedVal'),
  accelVal: $('accelVal'),
  accelFill: $('accelFill'),
  latVal: $('latVal'),
  curveVal: $('curveVal'),
  gradeVal: $('gradeVal'),
  tractionVal: $('tractionVal'),
  doorsVal: $('doorsVal'),
  loadVal: $('loadVal'),
  delayVal: $('delayVal'),
  odoVal: $('odoVal'),
  runState: $('runState'),
  runTag: $('runTag'),
  mapStatus: $('mapStatus'),
  playBtn: $('playBtn'),
  resetCam: $('resetCam'),
  infoBtn: $('infoBtn'),
  notes: $('notes'),
  notesClose: $('notesClose'),
  formations: $('formations'),
};
const clamp = THREE.MathUtils.clamp;
const TRACK_LATERAL = -VIADUCT.trackOffset; // left-hand running, west track

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const scratch = {
  pA: new THREE.Vector3(),
  pB: new THREE.Vector3(),
  mid: new THREE.Vector3(),
  fwd: new THREE.Vector3(),
  right: new THREE.Vector3(),
  up: new THREE.Vector3(),
  basis: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  t1: new THREE.Vector3(),
  t2: new THREE.Vector3(),
  point: new THREE.Vector3(),
};

// ---------------------------------------------------------------------------
// simulation state
// ---------------------------------------------------------------------------

const state = {
  s: 0,
  v: 0,
  accel: 0,
  dir: 1,
  phase: 'dwell',
  index: 0,
  nextIndex: 1,
  timer: 0,
  doors: 0,
  doorTarget: 0,
  roll: 0,
  odo: 0,
  delay: 0,
  playing: true,
  rate: 1,
};

let route = null;
let viaduct = null;
let train = null;
let world = null;
let ready = false;

const cam = {
  bearing: 0,
  bearingOffset: 0,
  pitch: MAP.pitch,
  pitchTarget: MAP.pitch,
  zoom: MAP.initialZoom,
  zoomTarget: MAP.initialZoom,
  lookAhead: MAP.lookAhead,
  lastInteract: performance.now(),
  init: false,
};

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

let progress = 0;
function setProgress(p, message) {
  progress = Math.max(progress, p);
  if (els.loadBar) els.loadBar.style.width = `${Math.round(progress * 100)}%`;
  if (els.loadStatus && message) els.loadStatus.textContent = message;
}

async function boot() {
  try {
    setProgress(0.04, 'READING BLUE LINE GEOMETRY');
    route = await loadRoute();

    setProgress(0.28, 'RAISING ELEVATED GUIDEWAY');
    viaduct = buildViaduct(route, { anisotropy: 8 });

    setProgress(0.55, 'MODELLING 3-CAR SET');
    train = createTrain({ anisotropy: 8 });

    setProgress(0.64, 'STREAMING SATELLITE IMAGERY');
    world = createWorld({
      route,
      viaduct,
      train,
      onProgress: (p) => {
        if (p > 0.9) setProgress(0.93, 'FINALISING 3D LAYER');
        else setProgress(p, 'STREAMING SATELLITE IMAGERY');
      },
    });

    await world.ready;
    setProgress(0.97, 'ALIGNING TRAIN TO CORRIDOR');

    startRun();

    const params = new URLSearchParams(window.location.search);
    if (params.has('zoom')) {
      cam.zoom = cam.zoomTarget = clamp(parseFloat(params.get('zoom')) || MAP.initialZoom, 16.8, 21.3);
    }
    if (params.has('pitch')) {
      cam.pitch = cam.pitchTarget = clamp(parseFloat(params.get('pitch')) || MAP.pitch, 24, MAP.maxPitch);
    }
    if (params.has('look')) {
      cam.lookAhead = clamp(parseFloat(params.get('look')) || MAP.lookAhead, 8, 90);
    }
    if (params.has('face')) {
      // debug: look at the leading cab from ahead
      MAP.chaseBearing += 180;
    }

    placeCars(0);
    updateCamera(0.016, true);
    world.updateSun(scratch.mid);
    world.trigger();

    ready = true;
    setProgress(1, 'SYSTEMS ONLINE');
    setStatus('SATELLITE / 3D · LIVE');

    setTimeout(() => els.intro.classList.add('done'), 500);
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    if (els.loadStatus) {
      els.loadStatus.textContent = 'FAILED TO START · CHECK CONSOLE';
      els.loadStatus.style.color = '#e29a8f';
    }
  }
}

function startRun() {
  const stations = route.stations;
  const params = new URLSearchParams(window.location.search);
  let startIndex = 0;
  if (params.has('station')) {
    const raw = params.get('station');
    const byName = stations.findIndex(
      (st) => st.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
    );
    startIndex = byName >= 0 ? byName : clamp(parseInt(raw, 10) || 0, 0, stations.length - 1);
  }

  state.index = startIndex;
  state.s = stations[startIndex].s;
  state.nextIndex = startIndex + 1;
  state.dir = startIndex === stations.length - 1 ? -1 : 1;
  state.phase = 'dwell';
  state.timer = startIndex === 0 || startIndex === stations.length - 1 ? SIM.terminusDwell : dwellAt(startIndex);
  state.v = 0;
  state.accel = 0;
  state.doors = 0;
  state.doorTarget = 1;
  state.odo = 0;
  state.delay = 0;
  state.roll = 0;

  if (state.dir < 0) state.nextIndex = startIndex - 1;
  train.setMode(state.dir);
  train.setDestination(state.dir > 0 ? 'RAIDURG' : 'NAGOLE');
  train.setDoors(0);

  if (params.has('hold')) {
    // testing aid: hold at the selected station with the doors open
    state.phase = 'dwell';
    state.timer = 1e6;
    state.doorTarget = 1;
  }

  if (params.has('km')) {
    // free-run debug start: place the train mid-section and roll out
    const km = parseFloat(params.get('km'));
    if (Number.isFinite(km)) {
      const s = clamp(km * 1000, stations[0].s + 40, stations[stations.length - 1].s - 40);
      let i = 0;
      for (let k = 0; k < stations.length; k++) if (stations[k].s <= s) i = k;
      state.s = s;
      state.index = i;
      state.dir = 1;
      state.nextIndex = Math.min(i + 1, stations.length - 1);
      state.phase = 'run';
      state.v = SIM.cruise * 0.72;
      state.timer = 0;
      state.doorTarget = 0;
      state.nextIndex = i + 1;
      train.setMode(1);
      train.setDestination('RAIDURG');
    }
  }
}

// ---------------------------------------------------------------------------
// station logic
// ---------------------------------------------------------------------------

function dwellAt(index) {
  const terminus = index === 0 || index === route.stations.length - 1;
  if (terminus) return SIM.terminusDwell;
  const jitter = ((((index * 37) % 7) - 3) * 0.85);
  return Math.max(14, SIM.doorDwell + jitter);
}

function arriveAtStation(index) {
  const stations = route.stations;
  state.phase = 'dwell';
  state.index = index;
  state.s = stations[index].s;
  state.v = 0;
  state.accel = 0;
  state.doorTarget = 1;

  const terminus = index === 0 || index === stations.length - 1;
  if (index === 0) state.dir = 1;
  else if (index === stations.length - 1) state.dir = -1;
  state.nextIndex = index + state.dir;

  state.timer = dwellAt(index);
  state.delay += state.timer - (terminus ? SIM.terminusDwell : SIM.doorDwell);

  train.setMode(state.dir);
  train.setDestination(state.dir > 0 ? 'RAIDURG' : 'NAGOLE');
}

function departStation() {
  state.phase = 'run';
  state.v = 0;
  state.accel = 0;
  state.timer = 0;
  state.doorTarget = 0;
  state.index = state.nextIndex - state.dir;
  state.nextIndex = state.index + state.dir;
}

function simulate(dt) {
  const stations = route.stations;
  state.doorTarget = state.phase === 'dwell' && state.timer > SIM.doorTime ? 1 : 0;

  if (state.phase === 'dwell') {
    state.timer -= dt;
    if (state.timer <= 0) departStation();
  } else {
    const target = stations[state.nextIndex];
    if (!target) {
      state.phase = 'dwell';
      state.timer = 2;
    } else {
      const d = (target.s - state.s) * state.dir;
      if (d <= 0.35 || (d < 1.2 && state.v < 0.65)) {
        arriveAtStation(state.nextIndex);
      } else {
        const stopDist = (state.v * state.v) / (2 * SIM.maxBrake);
        let desired = SIM.cruise;
        if (d < stopDist + 34) {
          desired = Math.min(desired, Math.sqrt(2 * SIM.maxBrake * Math.max(0, d - 0.4)));
        }
        const aTarget = clamp((desired - state.v) * 1.55, -SIM.maxBrake, SIM.maxAccel);
        state.accel += (aTarget - state.accel) * Math.min(1, dt * 5.5);
        state.v = Math.max(0, state.v + state.accel * dt);

        const step = state.v * dt;
        if (step >= d) {
          arriveAtStation(state.nextIndex);
        } else {
          state.s += state.dir * step;
          state.roll += state.dir * step;
          state.odo += step;
        }
      }
    }
  }

  // doors ease open / closed
  state.doors += (state.doorTarget - state.doors) * Math.min(1, dt * 4.2);
  if (state.doors < 0.002) state.doors = 0;
  if (state.doors > 0.998) state.doors = 1;
  train.setDoors(state.doors);
}

// ---------------------------------------------------------------------------
// train placement
// ---------------------------------------------------------------------------

function placeCars(dt = 0) {
  const y = VIADUCT.railTop;
  for (let i = 0; i < train.cars.length; i++) {
    const car = train.cars[i];
    const sCenter = state.s + (i - 1) * TRAIN.carSpacing;
    route.getPoint(sCenter - TRAIN.bogieHalfSpacing, scratch.pA);
    route.getPoint(sCenter + TRAIN.bogieHalfSpacing, scratch.pB);

    scratch.mid.copy(scratch.pA).add(scratch.pB).multiplyScalar(0.5);
    scratch.fwd.subVectors(scratch.pB, scratch.pA).normalize();
    scratch.right.crossVectors(UP, scratch.fwd).normalize();
    scratch.up.crossVectors(scratch.fwd, scratch.right).normalize();
    scratch.basis.makeBasis(scratch.right, scratch.up, scratch.fwd);

    // ride the west track, not the centreline between the two tracks
    scratch.mid.addScaledVector(scratch.right, TRACK_LATERAL);

    car.group.quaternion.setFromRotationMatrix(scratch.basis);
    car.group.position.set(scratch.mid.x, y, scratch.mid.z);

    // body roll from lateral acceleration (air springs, no cant)
    route.getTangent(sCenter - 2.5, scratch.t1);
    route.getTangent(sCenter + 2.5, scratch.t2);
    const kSigned = scratch.t2.sub(scratch.t1).dot(scratch.right) / 5;
    const roll = Math.atan((state.v * state.v * Math.abs(kSigned)) / 9.81) * 0.5 * Math.sign(kSigned || 1);
    scratch.q.setFromAxisAngle(Z_AXIS, -roll);
    car.group.quaternion.multiply(scratch.q);

    const spin = -state.roll / TRAIN.wheelRadius;
    for (const w of car.wheels) w.rotation.x = spin;
  }

  // centre of the consist, at rail height, for sun + camera reference
  scratch.mid.copy(train.cars[1].group.position);
}

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------

function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

function updateCamera(dt, snap = false) {
  const heading = route.headingAt(state.s) + (state.dir > 0 ? 0 : 180);

  if (!cam.init || snap) {
    cam.bearing = heading + MAP.chaseBearing;
    cam.init = true;
  }

  const now = performance.now();
  if (now - cam.lastInteract > 6500 && Math.abs(cam.bearingOffset) > 0.02) {
    cam.bearingOffset *= Math.exp(-dt * 0.85);
  }

  const targetBearing = heading + MAP.chaseBearing + cam.bearingOffset;
  cam.bearing = snap ? targetBearing : lerpAngle(cam.bearing, targetBearing, 1 - Math.exp(-dt * 2.4));
  cam.pitch += (cam.pitchTarget - cam.pitch) * (1 - Math.exp(-dt * 4.6));
  cam.zoom += (cam.zoomTarget - cam.zoom) * (1 - Math.exp(-dt * 4.6));

  const br = (cam.bearing * Math.PI) / 180;
  const pr = (cam.pitch * Math.PI) / 180;
  const ahead = cam.lookAhead * (0.66 + 0.34 * Math.sin(pr));
  route.getPoint(state.s, scratch.point);
  route.getTangent(state.s, scratch.t1);
  scratch.point.x += scratch.t1.z * TRACK_LATERAL;
  scratch.point.z -= scratch.t1.x * TRACK_LATERAL;
  const cx =
    scratch.point.x + Math.sin(br) * ahead + Math.cos(br) * MAP.cameraOffset;
  const cz =
    scratch.point.z + Math.cos(br) * ahead - Math.sin(br) * MAP.cameraOffset;
  const ll = route.toLngLat(cx, cz);

  world.setCamera({
    center: [ll.lng, ll.lat],
    bearing: cam.bearing,
    pitch: cam.pitch,
    zoom: cam.zoom,
  });
}

function recenterCamera() {
  cam.bearingOffset = 0;
  cam.pitchTarget = MAP.pitch;
  cam.zoomTarget = MAP.initialZoom;
  cam.lastInteract = performance.now();
}

// ---------------------------------------------------------------------------
// physics prediction (for ETAs)
// ---------------------------------------------------------------------------

function predictTime(fromS, fromV, dir, targetS) {
  let s = fromS;
  let v = fromV;
  let t = 0;
  const dt = 0.25;
  for (let i = 0; i < 2400; i++) {
    const d = (targetS - s) * dir;
    if (d <= 0.4) return t;
    const stopDist = (v * v) / (2 * SIM.maxBrake);
    let desired = SIM.cruise;
    if (d < stopDist + 34) desired = Math.min(desired, Math.sqrt(2 * SIM.maxBrake * Math.max(0, d - 0.4)));
    const a = clamp((desired - v) * 1.55, -SIM.maxBrake, SIM.maxAccel);
    v = Math.max(0, v + a * dt);
    s += dir * v * dt;
    t += dt;
  }
  return t;
}

function predictStations(count = 5) {
  const stations = route.stations;
  const out = [];
  let s = state.s;
  let v = state.v;
  let t = state.phase === 'dwell' ? state.timer : 0;
  let idx = state.nextIndex;
  for (let n = 0; n < count; n++) {
    if (idx < 0 || idx >= stations.length) break;
    const target = stations[idx];
    const run = predictTime(s, v, state.dir, target.s);
    t += run;
    out.push({
      station: target,
      index: idx,
      eta: t,
      run,
      distance: Math.abs(target.s - state.s),
    });
    t += dwellAt(idx);
    s = target.s;
    v = 0;
    idx += state.dir;
  }
  return out;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const fmtTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const fmtClock = (seconds) => {
  const sign = seconds < -0.5 ? '−' : '+';
  const s = Math.max(0, Math.round(Math.abs(seconds)));
  return `${sign}${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function loadFactor() {
  const base = state.dir > 0 ? 0.71 : 0.37;
  const wave = 0.15 * Math.sin((state.index + 1) * 1.63 + (state.dir > 0 ? 0.4 : 2.1));
  const drift = 0.035 * Math.sin(performance.now() * 0.00016);
  return clamp(base + wave + drift, 0.18, 0.97);
}

function doorLabel() {
  if (state.doors > 0.93) return 'OPEN';
  if (state.doorTarget > 0.5 && state.doors > 0.03) return 'OPENING';
  if (state.doors > 0.03) return 'CLOSING';
  return 'CLOSED';
}

let predictions = [];
let predAccum = 0;

function updatePrediction() {
  if (!ready) return;
  predictions = predictStations(5);
}

function updateHud(dt) {
  predAccum += dt;
  if (predAccum > 0.85) {
    predAccum = 0;
    updatePrediction();
  }

  const stations = route.stations;
  const next = stations[state.nextIndex];
  const prev = stations[state.nextIndex - state.dir];
  if (!next) return;

  const d = Math.max(0, (next.s - state.s) * state.dir);
  const eta = state.phase === 'dwell' ? state.timer + predictTime(state.s, 0, state.dir, next.s) : predictTime(state.s, state.v, state.dir, next.s);

  els.nextName.textContent = next.name;
  els.nextMeta.textContent = `TOWARDS ${(state.dir > 0 ? 'RAIDURG' : 'NAGOLE')}`;
  els.nextSeq.textContent = `${String(state.nextIndex + 1).padStart(2, '0')} / ${stations.length}`;
  els.etaVal.textContent = fmtTime(eta);
  els.distVal.textContent = (d / 1000).toFixed(2);

  const prevIndex = state.nextIndex - state.dir;
  const prevStation = stations[prevIndex] || stations[state.index];
  const span = Math.max(1, Math.abs(next.s - (prevStation ? prevStation.s : state.s)));
  let progress01 = prevStation ? (state.dir > 0 ? (state.s - prevStation.s) / span : (prevStation.s - state.s) / span) : 0;
  progress01 = clamp(progress01, 0, 1);
  els.progressFill.style.width = `${progress01 * 100}%`;
  els.progressDot.style.left = `${progress01 * 100}%`;
  els.prevName.textContent = prevStation ? prevStation.name : '—';
  els.nextLabel.textContent = next.name;

  // upcoming list (stations after the immediate next)
  const rows = [];
  for (let n = 1; n < predictions.length; n++) {
    const p = predictions[n];
    rows.push(
      `<li><span class="u-seq">${String(p.index + 1).padStart(2, '0')}</span>` +
        `<span class="u-name">${p.station.name}</span>` +
        `<span class="u-dist">${(p.distance / 1000).toFixed(2)}<em>km</em></span>` +
        `<span class="u-eta">${fmtTime(p.eta)}</span></li>`
    );
  }
  els.upcomingList.innerHTML = rows.join('');

  const kmh = state.v * 3.6;
  els.speedVal.textContent = String(Math.round(kmh));
  const a = state.accel;
  els.accelVal.textContent = `${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(2)}`;
  els.accelVal.classList.toggle('negative', a < -0.12);
  const pct = clamp(a / 2.2, -1, 1);
  els.accelFill.style.width = `${Math.abs(pct) * 50}%`;
  els.accelFill.style.left = pct >= 0 ? '50%' : `${50 - Math.abs(pct) * 50}%`;
  els.accelFill.classList.toggle('negative', pct < 0);

  const k = route.getCurvature(state.s);
  const radius = k > 1e-5 ? 1 / k : Infinity;
  const latG = (state.v * state.v * k) / 9.81;
  els.latVal.innerHTML = `${Math.abs(latG).toFixed(2)}<em>g</em>`;
  els.curveVal.innerHTML = radius > 2600 ? `STRAIGHT` : `R ${Math.round(radius)}<em>m</em>`;
  els.gradeVal.innerHTML = `0.0<em>%</em>`;
  els.tractionVal.innerHTML = `${Math.round((Math.max(0, a) / SIM.maxAccel) * 100)}<em>%</em>`;
  els.doorsVal.textContent = doorLabel();
  els.doorsVal.classList.toggle('warm', state.doors > 0.03);
  const load = loadFactor();
  els.loadVal.innerHTML = `${Math.round(load * 100)}<em>%</em>`;
  els.delayVal.textContent = fmtClock(state.delay);
  els.delayVal.classList.toggle('warm', state.delay > 25);
  els.odoVal.innerHTML = `${(state.odo / 1000).toFixed(2)}<em>km</em>`;

  if (state.phase === 'dwell') {
    els.runState.textContent =
      state.doors > 0.05
        ? state.timer <= SIM.doorTime
          ? `DWELL · DOORS CLOSING · ${fmtTime(state.timer)}`
          : `DWELL · DOORS OPEN · ${fmtTime(state.timer)}`
        : `DWELL · ${fmtTime(state.timer)}`;
  } else if (a < -0.18) {
    els.runState.textContent = 'BRAKING · APPROACHING';
  } else if (a > 0.14) {
    els.runState.textContent = 'TRACTION · ACCELERATING';
  } else if (state.v > SIM.cruise * 0.9) {
    els.runState.textContent = 'CRUISE · LINE SPEED';
  } else {
    els.runState.textContent = 'COASTING';
  }

  els.runTag.textContent = `RUN 03-${String(state.nextIndex + 1).padStart(2, '0')} · D–M–D`;
  els.mapStatus.textContent = `${Math.round(cam.zoom * 100) / 100}× · ${Math.round(cam.pitch)}° PITCH`;
}

let clockAccum = 0;
function updateClock(dt) {
  clockAccum += dt;
  if (clockAccum < 1) return;
  clockAccum = 0;
  const now = new Date();
  els.clock.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
}

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

function bindPointer() {
  const canvas = world.map.getCanvas();
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';

  const pointers = new Map();
  let drag = null;
  let pinch = 0;

  const zoomClamp = (z) => clamp(z, 16.8, 21.3);

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    } else {
      drag = null;
      pinch = 0;
    }
    cam.lastInteract = performance.now();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) cam.zoomTarget = zoomClamp(cam.zoomTarget + Math.log(dist / pinch) * 2.0);
      pinch = dist;
    } else if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      cam.bearingOffset -= dx * 0.3;
      cam.pitchTarget = clamp(cam.pitchTarget - dy * 0.26, 24, 72);
    }
    cam.lastInteract = performance.now();
  });

  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) {
      drag = null;
      canvas.style.cursor = 'grab';
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', (e) => {
    if (pointers.size === 0) canvas.style.cursor = 'grab';
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      cam.zoomTarget = zoomClamp(cam.zoomTarget - e.deltaY * 0.0022);
      cam.lastInteract = performance.now();
    },
    { passive: false }
  );

  canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    recenterCamera();
  });
}

// ---------------------------------------------------------------------------
// controls
// ---------------------------------------------------------------------------

function setPlaying(playing) {
  state.playing = playing;
  els.playBtn.classList.toggle('paused', !playing);
  els.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function setRate(rate) {
  state.rate = rate;
  document.querySelectorAll('.dock-btn.rate').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.rate) === rate);
  });
}

function setStatus(text) {
  if (els.mapStatus) els.mapStatus.textContent = text;
}

function toggleNotes(open) {
  const next = open ?? !els.notes.classList.contains('open');
  els.notes.classList.toggle('open', next);
}

function bindControls() {
  els.playBtn.addEventListener('click', () => setPlaying(!state.playing));
  els.resetCam.addEventListener('click', recenterCamera);
  els.infoBtn.addEventListener('click', () => toggleNotes());
  els.notesClose.addEventListener('click', () => toggleNotes(false));

  document.querySelectorAll('.dock-btn.rate').forEach((b) => {
    b.addEventListener('click', () => setRate(Number(b.dataset.rate)));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.key === '1') setRate(0.5);
    else if (e.key === '2') setRate(1);
    else if (e.key === '3') setRate(2);
    else if (e.key.toLowerCase() === 'r') recenterCamera();
    else if (e.key.toLowerCase() === 'i') toggleNotes();
    else if (e.key.toLowerCase() === 'h') document.body.classList.toggle('hide-ui');
    else if (e.key.toLowerCase() === 'b') {
      const visible = !document.body.classList.contains('no-buildings');
      world.setBuildingsVisible(visible);
      document.body.classList.toggle('no-buildings', !visible);
    } else if (e.key === 'Escape') toggleNotes(false);
  });
}

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------

let last = performance.now();
let hudAccum = 0;

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0.001, raw));

  if (state.playing) simulate(dt * state.rate);
  placeCars(dt);
  updateCamera(dt);
  world.updateSun(scratch.mid);

  hudAccum += dt;
  if (hudAccum > 0.08) {
    hudAccum = 0;
    updateHud(dt);
    updateClock(dt);
  }

  world.trigger();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// go
// ---------------------------------------------------------------------------

boot().then(() => {
  if (ready) bindControls();
});

// bind pointer as soon as the map is available (world is created synchronously)
const pointerTimer = setInterval(() => {
  if (world && world.map && world.map.getCanvas()) {
    bindPointer();
    clearInterval(pointerTimer);
  }
}, 60);

window.metro = {
  get route() { return route; },
  get world() { return world; },
  get train() { return train; },
  state,
  cam,
  setRate,
  setPlaying,
  recenterCamera,
  jumpToStation(index) {
    if (!route) return;
    state.index = clamp(index, 0, route.stations.length - 1);
    state.dir = state.index === route.stations.length - 1 ? -1 : 1;
    state.nextIndex = state.index + state.dir;
    state.s = route.stations[state.index].s;
    state.phase = 'dwell';
    state.timer = 10;
    state.v = 0;
    state.doors = 0;
    state.doorTarget = 1;
    train.setMode(state.dir);
    train.setDestination(state.dir > 0 ? 'RAIDURG' : 'NAGOLE');
  },
};
