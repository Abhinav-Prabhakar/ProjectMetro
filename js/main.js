// ---------------------------------------------------------------------------
// Hyderabad Metro — real-time network tracker
//
// Every set in the official GTFS timetable is alive. The camera rides one of
// them; the others are drawn as light proxies when they come near. The clock
// is IST wall-clock time, so what you see matches the published timetable.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MAP, TRAIN, SIM } from './config.js?v=20261107a';
import { loadNetwork } from './network.js?v=20261107a';
import { buildGuideway, DECK_TOP, RAIL_TOP, TRACK_OFFSET } from './infrastructure.js?v=20261107a';
import { buildStations } from './station.js?v=20261107a';
import { createTrain, createTrainProxy } from './train.js?v=20261107a';
import { createWorld } from './world.js?v=20261107a';
import { Fleet, istParts, svcIndexFor } from './sim.js?v=20261107a';
import { makeGlowRadial } from './materials.js?v=20261107a';
import { mergeGeometries } from './geomutil.js?v=20261107a';

const $ = (id) => document.getElementById(id);
const els = {
  intro: $('intro'),
  loadBar: $('loadBar'),
  loadStatus: $('loadStatus'),
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
  closedCountdown: $('closedCountdown'),
  closedFirst: $('closedFirst'),
  closedLast: $('closedLast'),
  closedDepartures: $('closedDepartures'),
  closedFleetSize: $('closedFleetSize'),
  closedInService: $('closedInService'),
  closedLinesVal: $('closedLinesVal'),
  closedStationsVal: $('closedStationsVal'),
  closedLengthVal: $('closedLengthVal'),
  closedWindowVal: $('closedWindowVal'),
  closedFirstMetric: $('closedFirstMetric'),
  closedLastMetric: $('closedLastMetric'),
  closedReopen: $('closedReopen'),
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
  lineSwitch: $('lineSwitch'),
  dock: $('dock'),
  fleetBtn: $('fleetBtn'),
  fleetBoard: $('fleetBoard'),
  fleetList: $('fleetList'),
  fleetClose: $('fleetClose'),
  fleetTotal: $('fleetTotal'),
  fleetLines: $('fleetLines'),
  fleetBoardTotal: $('fleetBoardTotal'),
  fleetBoardService: $('fleetBoardService'),
  tsId: $('tsId'),
  tsSub: $('tsSub'),
  tsDot: $('tsDot'),
  nightBtn: $('nightBtn'),
  installBtn: $('installBtn'),
  installSheet: $('installSheet'),
  installClose: $('installClose'),
  installLead: $('installLead'),
  installSteps: $('installSteps'),
  installState: $('installState'),
  netBanner: $('netBanner'),
  updateToast: $('updateToast'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
  serviceLabel: $('serviceLabel'),
  stats: $('stats'),
};

const clamp = THREE.MathUtils.clamp;
const UP = new THREE.Vector3(0, 1, 0);
const params = new URLSearchParams(location.search);
const requestedLine = (params.get('line') || '').toUpperCase();

// The tracker follows IST, including the light. Unless a build is pinned with
// ?night=0 / ?night=1, the scene starts in the state the city is actually in
// and crosses over if the page stays open past dusk or dawn.
const NIGHT_START = 18 * 3600 + 45 * 60;
const NIGHT_END = 6 * 3600 + 15 * 60;
const isNightAt = (sec) => sec >= NIGHT_START || sec < NIGHT_END;
const pinnedNight = params.get('night');
const initialNight = pinnedNight === null ? isNightAt(istParts(Date.now() / 1000).sec) : pinnedNight === '1';

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
  focus: new THREE.Vector3(),
};

const state = {
  epoch: Date.now() / 1000,
  playing: true,
  lineId: ['RED', 'GREEN', 'BLUE'].includes(requestedLine) ? requestedLine : 'BLUE',
  followId: null,
  night: initialNight,
  nightK: initialNight ? 1 : 0,
  nightAuto: pinnedNight === null,
  serviceClosed: null,
  service: null,
  doors: 0,
  vehicle: null,
  hasUserSelected: false,
  fleetTotal: 0,
  fleetByLine: { RED: 0, GREEN: 0, BLUE: 0 },
  fleetAll: [],
};

// ---------------------------------------------------------------------------
// Timetable lock
//
// The simulated clock is not an accumulator: it is derived from the same IST
// wall clock the timetable is published in. performance.now() gives a smooth
// monotonic source between anchors; every few seconds the anchor is corrected
// against Date.now() so a dropped frame, a suspended tab or a slow render can
// never leave the train minutes behind the published schedule.
// ---------------------------------------------------------------------------
const clock = {
  epoch: Date.now() / 1000,
  perf: performance.now(),
  syncAt: performance.now(),
  drift: 0,
};

function tickClock() {
  const perf = performance.now();
  if (perf - clock.syncAt > 4000) {
    clock.epoch = Date.now() / 1000;
    clock.perf = perf;
    clock.syncAt = perf;
  }
  state.epoch = clock.epoch + (perf - clock.perf) / 1000;
  clock.drift = Date.now() / 1000 - state.epoch;
  return state.epoch;
}

function resetClock() {
  clock.epoch = Date.now() / 1000;
  clock.perf = performance.now();
  clock.syncAt = clock.perf;
  clock.drift = 0;
  state.epoch = clock.epoch;
}

let network = null;
let fleet = null;
let world = null;
let ready = false;

const lineRuntime = new Map(); // lineId -> { route, guideway, stations, detailed, proxies, proxyPool }
const proxyPool = [];
const cam = {
  bearing: 0,
  bearingOffset: 0,
  pitch: 53,
  pitchTarget: 46,
  zoom: 18.45,
  zoomTarget: 18.45,
  lookAhead: 22,
  lastInteract: performance.now(),
  init: false,
  // Low-pass state for the chase rig. The timetable position is exact; these
  // only remove sub-pixel noise from the projection so the city does not
  // shimmer when the camera is parked on a train.
  smoothFocus: new THREE.Vector3(),
  smoothHeading: null,
  // Debug / cinematic override. When set, the frame loop leaves the map camera
  // exactly where the caller put it and only keeps the culling focus in sync.
  free: null,
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


// ---------------------------------------------------------------------------
// Interchange concourse
//
// Two corridors meet at Ameerpet and MGBS: one elevated over the other, with
// their platforms a few dozen metres apart. The real stations are a single
// complex joined by a concourse, so build that link here once every line has
// been placed, rather than faking it inside either station.
// ---------------------------------------------------------------------------

function addInterchangeLinks(parent, lineRuntime) {
  const byName = new Map();
  for (const lr of lineRuntime.values()) {
    for (const item of lr.stations.items) {
      const st = item.userData.station;
      if (!st || !st.interchange) continue;
      if (!item.children.length) continue; // duplicate placeholder
      const p = new THREE.Vector3().setFromMatrixPosition(item.matrixWorld);
      if (!byName.has(st.name)) byName.set(st.name, []);
      byName.get(st.name).push({ st, p, line: lr.route });
    }
  }

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfe0ea,
    roughness: 0.1,
    metalness: 0.05,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slab = new THREE.MeshStandardMaterial({ color: 0xbfc3bd, roughness: 0.85, metalness: 0.04 });
  const lamp = new THREE.MeshBasicMaterial({
    color: 0xffe4b8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  glass.userData.castShadow = false;
  slab.userData.receiveShadow = true;

  const group = new THREE.Group();
  group.name = 'interchange-links';
  const glowGeoms = [];

  for (const [, list] of byName) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.p.y - b.p.y);
    const low = list[0];
    const high = list[list.length - 1];
    const dx = high.p.x - low.p.x;
    const dz = high.p.z - low.p.z;
    const span = Math.hypot(dx, dz);
    if (span < 4 || span > 90) continue;
    const yaw = Math.atan2(dx, dz);
    const mx = (low.p.x + high.p.x) / 2;
    const mz = (low.p.z + high.p.z) / 2;
    const floor = low.p.y + 1.0;

    // A glazed gallery bridging the two platforms at the lower level.
    const gallery = new THREE.Mesh(new THREE.BoxGeometry(11, 3.4, span + 6), glass);
    gallery.position.set(mx, floor + 1.7, mz);
    gallery.rotation.y = yaw;
    group.add(gallery);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.34, span + 7), slab);
    deck.position.set(mx, floor - 0.1, mz);
    deck.rotation.y = yaw;
    group.add(deck);

    for (const zs of [-1, 1]) {
      const g = new THREE.BoxGeometry(9.4, 0.08, 0.16);
      g.translate(0, floor + 3.3, zs * (span / 2 + 1.2));
      g.rotateY(yaw);
      g.translate(mx, 0, mz);
      glowGeoms.push(g);
    }

    // Stair / lift core climbing to the upper corridor.
    if (high.p.y - low.p.y > 2) {
      const h = high.p.y - low.p.y;
      const core = new THREE.Mesh(new THREE.BoxGeometry(7.4, h + 4.6, 7.4), glass);
      core.position.set(high.p.x, low.p.y + (h + 4.6) / 2 + 0.6, high.p.z);
      core.rotation.y = yaw;
      group.add(core);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.3, 7.9), slab);
      cap.position.set(high.p.x, low.p.y + h + 5.1, high.p.z);
      cap.rotation.y = yaw;
      group.add(cap);
      const ring = new THREE.BoxGeometry(7.2, 0.08, 0.16);
      ring.translate(0, low.p.y + h + 4.7, 3.8);
      ring.rotateY(yaw);
      ring.translate(high.p.x, 0, high.p.z);
      glowGeoms.push(ring);
    }
  }

  if (glowGeoms.length) {
    const lampMesh = new THREE.Mesh(mergeGeometries(glowGeoms), lamp);
    lampMesh.name = 'interchange-lamp';
    group.add(lampMesh);
    group.userData.lamp = lamp;
    glowGeoms.forEach((g) => g.dispose());
  }
  if (group.children.length) parent.push(group);
  return { group, lamp };
}

async function boot() {
  try {
    document.documentElement.dataset.timeMode = state.night ? 'night' : 'day';
    if (params.has('stats')) document.body.classList.add('show-stats');
    document.body.classList.add('no-buildings');
    setProgress(0.04, 'READING HMRL TIMETABLE');
    network = await loadNetwork((p) => setProgress(p, 'READING HMRL TIMETABLE'));

    const sceneObjects = [];
    const glowPositions = [];
    const seenStations = new Set();

    for (let li = 0; li < network.lines.length; li++) {
      const route = network.lines[li];
      setProgress(0.16 + li * 0.06, `RAISING ${route.name.toUpperCase()}`);
      const guideway = buildGuideway(route, { anisotropy: 8 });
      sceneObjects.push(guideway);

      setProgress(0.3 + li * 0.06, `BUILDING ${route.stations.length} STATIONS`);
      const stations = buildStations(route, { anisotropy: 8, seen: seenStations });
      sceneObjects.push(stations.group);

      // a warm point of light at each canopy, drawn as one additive Points cloud
      for (const st of route.stations) {
        if (!seenStations.has(st.name)) continue;
        glowPositions.push(st.x, DECK_TOP + 6.2, st.z);
        glowPositions.push(st.x + 4, DECK_TOP + 4.2, st.z);
      }

      setProgress(0.46 + li * 0.05, 'MODELLING 3-CAR SETS');
      const detailed = createTrain({ anisotropy: 8, color: route.color });
      detailed.group.visible = false;
      sceneObjects.push(detailed.group);

      const proxies = [];
      for (let i = 0; i < 5; i++) {
        const p = createTrainProxy({ color: route.color });
        p.group.visible = false;
        sceneObjects.push(p.group);
        proxies.push(p);
      }

      lineRuntime.set(route.id, { route, guideway, stations, detailed, proxies });
    }

    state.interchangeLinks = addInterchangeLinks(sceneObjects, lineRuntime);

    // station light cloud
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
      geo.computeBoundingSphere();
      const tex = makeGlowRadial(128);
      const mat = new THREE.PointsMaterial({
        map: tex,
        size: 11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffe3b0,
      });
      const points = new THREE.Points(geo, mat);
      points.renderOrder = 4;
      points.frustumCulled = false;
      sceneObjects.push(points);
      state.stationGlow = points;
    }

    fleet = new Fleet(network);

    setProgress(0.62, 'STREAMING SATELLITE IMAGERY');
    world = createWorld({
      network,
      sceneObjects,
      onProgress: (p) => {
        if (p > 0.9) setProgress(0.93, 'FINALISING 3D LAYER');
        else setProgress(p, 'STREAMING SATELLITE IMAGERY');
      },
    });
    await world.ready;
    setProgress(0.97, 'ALIGNING TO THE CORRIDOR');

    // default follow: the closest set on the requested line (Blue unless a
    // shortcut or ?line= asked for another corridor)
    const startLine = network.byId.get(state.lineId) || network.byId.get('BLUE');
    const midStation = startLine.stations[Math.floor(startLine.stations.length / 2)];
    const focus = startLine.getPoint(midStation.s);
    selectNearestTrain(startLine.id, focus, true);

    applyNight({ immediate: true });
    placeAll();
    updateFleetPulse(true);

    ready = true;
    setProgress(1, 'SYSTEMS ONLINE');
    if (els.mapStatus) els.mapStatus.textContent = 'SATELLITE / 3D';
    applyServiceState(serviceStatus(state.epoch));
    updateHud(0);

    setTimeout(() => els.intro.classList.add('done'), 450);
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    if (els.loadStatus) {
      els.loadStatus.textContent = 'FAILED TO START · CHECK CONSOLE';
      els.loadStatus.style.color = '#e29a8f';
    }
  }
}

// ---------------------------------------------------------------------------
// train selection
// ---------------------------------------------------------------------------

const LINE_ORDER = ['RED', 'GREEN', 'BLUE'];
const LINE_META = {
  RED: { name: 'RED LINE', color: '#E31E24' },
  GREEN: { name: 'GREEN LINE', color: '#009846' },
  BLUE: { name: 'BLUE LINE', color: '#007ABB' },
};

function activeVehicles(near = null, radius = 5000) {
  const svc = svcIndexFor(network, state.epoch);
  const t = istParts(state.epoch).sec;
  return fleet.snapshot(t, svc, { near, radius });
}

/** Every set running anywhere on the network at the current timetable second. */
function wholeNetwork() {
  return activeVehicles(measureFocus(), 1e9);
}

// ---------------------------------------------------------------------------
// Fleet board
//
// The dock reports the whole network, not just the sets inside the camera's
// culling radius. The board lists every active set, grouped by corridor, and
// stays live while it is open; the timetable never stops for it.
// ---------------------------------------------------------------------------

const picker = {
  open: false,
  items: [],
  index: 0,
  renderedAt: 0,
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const setNumber = (id) => String(id).replace(/^[A-Z]{2}_/, '');

function pickerItem(v) {
  const line = v.block.line;
  const dir = v.pattern ? v.pattern.dir : v.dir;
  const to = dir > 0 ? line.to : line.from;
  const moving = v.phase === 'run' || v.phase === 'arriving';
  return {
    id: v.block.id,
    lineId: line.id,
    color: line.color,
    number: setNumber(v.block.id.split(':')[1] || v.block.id),
    to,
    kmh: moving ? Math.round(v.v * 3.6) : 0,
    state:
      v.kind === 'turnback'
        ? 'TURNING BACK'
        : v.phase === 'dwell'
          ? v.doors > 0.5
            ? 'BOARDING'
            : 'AT PLATFORM'
          : v.phase === 'arriving'
            ? 'ARRIVING'
            : 'IN SERVICE',
    distance: v.distance ?? 0,
    active: v.block.id === (state.followId || state.vehicle?.block.id),
  };
}

function fleetItems() {
  return state.fleetAll
    .map(pickerItem)
    .sort(
      (a, b) =>
        LINE_ORDER.indexOf(a.lineId) - LINE_ORDER.indexOf(b.lineId) ||
        a.number.localeCompare(b.number, undefined, { numeric: true })
    );
}

function serviceName() {
  return ['WEEKDAY', 'SATURDAY', 'SUNDAY'][svcIndexFor(network, state.epoch)] || 'WEEKDAY';
}

// ---------------------------------------------------------------------------
// Service hours
//
// The GTFS feed has no "closed" message, but it does have a first departure
// and a last arrival for every service class. Those two numbers are enough to
// tell the difference between a quiet afternoon and 1 a.m., so the HUD can say
// "closed" instead of drawing zeroes over a frozen train.
// ---------------------------------------------------------------------------

const serviceSummaries = new Map();

function serviceSummary(svc) {
  if (!network) return null;
  const cached = serviceSummaries.get(svc);
  if (cached) return cached;

  let first = Infinity;
  let last = -Infinity;
  const lines = [];
  for (const line of network.lines) {
    let firstTrip = null;
    for (const trip of line.trips) {
      if (trip.svc !== svc) continue;
      if (!firstTrip || trip.s0 < firstTrip.s0) firstTrip = trip;
      if (trip.s0 < first) first = trip.s0;
      if (trip.s1 > last) last = trip.s1;
    }
    if (!firstTrip) continue;
    const pattern = line.patterns[firstTrip.p];
    const stops = pattern ? pattern.stops : [];
    const from = stops.length ? line.stations[stops[0].st] : null;
    const to = stops.length ? line.stations[stops[stops.length - 1].st] : null;
    lines.push({
      id: line.id,
      color: line.color,
      from: from ? from.name : line.from,
      to: to ? to.name : line.to,
      first: firstTrip.s0,
    });
  }
  lines.sort((a, b) => LINE_ORDER.indexOf(a.id) - LINE_ORDER.indexOf(b.id));

  const summary = { first, last, lines };
  serviceSummaries.set(svc, summary);
  return summary;
}

const fmtClock = (epochSeconds) => {
  const p = istParts(epochSeconds);
  const h = Math.floor(p.sec / 3600) % 24;
  const m = Math.floor((p.sec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

function fmtCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtDuration(seconds) {
  const m = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** What the network is doing at `epoch`: running, or waiting for the first set. */
function serviceStatus(epoch) {
  if (!network) return null;
  const part = istParts(epoch);
  const svc = svcIndexFor(network, epoch);
  const today = serviceSummary(svc);
  if (!today) return null;

  if (part.sec >= today.first && part.sec <= today.last) {
    return {
      closed: false,
      svc,
      today,
      first: today.first,
      last: today.last,
      window: today.last - today.first,
    };
  }

  // Before the first departure the next opening is later today; after the last
  // arrival it is tomorrow, which may run on a different service class.
  const dayBase = epoch - part.sec;
  let openSvc = svc;
  let openAt;
  if (part.sec < today.first) {
    openAt = dayBase + today.first;
  } else {
    openSvc = svcIndexFor(network, dayBase + 86400 + 43200);
    const tomorrow = serviceSummary(openSvc);
    openAt = dayBase + 86400 + tomorrow.first;
  }
  const open = serviceSummary(openSvc);

  // The last train belongs to today after the shutdown, or to yesterday in the
  // small hours, which is what makes "last train 23:56" honest at 00:08.
  let lastAt;
  if (part.sec >= today.first) {
    lastAt = dayBase + today.last;
  } else {
    const prevSvc = svcIndexFor(network, dayBase - 43200);
    lastAt = dayBase - 86400 + serviceSummary(prevSvc).last;
  }

  return {
    closed: true,
    svc,
    openSvc,
    today,
    open,
    openAt,
    lastAt,
    until: Math.max(0, openAt - epoch),
    window: open.last - open.first,
  };
}

// Two columns, balanced by rows. With three corridors the split is rarely even
// (RED 12, GREEN 3, BLUE 13), so try every assignment and keep the one whose
// tallest column is shortest. The first corridor always stays in the left
// column, so the reading order never flips.
function packStacks(sections, columns = 2) {
  if (sections.length <= 1) return [sections];
  let best = null;
  let bestHeight = Infinity;
  const combos = 1 << sections.length;
  for (let mask = 0; mask < combos; mask += 2) {
    const stacks = Array.from({ length: columns }, () => []);
    for (let i = 0; i < sections.length; i++) {
      stacks[mask & (1 << i) ? 1 : 0].push(sections[i]);
    }
    if (stacks.some((stack) => stack.length === 0)) continue;
    const height = Math.max(...stacks.map((stack) => stack.reduce((n, s) => n + s.rows, 0)));
    if (height < bestHeight) {
      bestHeight = height;
      best = stacks;
    }
  }
  return best || [sections];
}

function renderClosedFleet(status) {
  if (!els.fleetList) return;
  const openClock = fmtClock(status.openAt);
  const openBase = status.openAt - status.open.first;
  const rows = status.open.lines
    .map(
      (item) =>
        `<li style="--c:${item.color}">` +
        `<div><span class="fc-line"><i></i>${escapeHtml(item.id)}</span>` +
        `<span class="fc-dest">TO ${escapeHtml(item.to.toUpperCase())}</span></div>` +
        `<span class="fc-time">${fmtClock(openBase + item.first)}</span></li>`
    )
    .join('');

  els.fleetList.innerHTML =
    `<div class="fleet-closed">` +
    `<div class="fleet-closed-lead">` +
    `<span class="fleet-closed-kicker"><i></i>NETWORK CLOSED</span>` +
    `<div class="fleet-closed-title">All sets are stabled.<br/>First trains at <b>${openClock}</b>.</div>` +
    `<div class="fleet-closed-count"><b id="fleetClosedCount">${fmtCountdown(status.until)}</b>` +
    `<span class="eta-lab">UNTIL SERVICE RESUMES</span></div>` +
    `</div>` +
    `<div class="fleet-closed-next">` +
    `<div class="up-head"><span>FIRST DEPARTURES</span><span>DEPARTS</span></div>` +
    `<ul>${rows}</ul></div>` +
    `</div>`;

  if (els.fleetBoardTotal) els.fleetBoardTotal.textContent = '0';
  if (els.fleetBoardService) els.fleetBoardService.textContent = `${serviceName()} · CLOSED`;
}

function renderFleet() {
  if (!els.fleetList) return;
  const status = state.service || serviceStatus(state.epoch);
  if (status && status.closed) {
    picker.items = [];
    picker.index = 0;
    renderClosedFleet(status);
    picker.renderedAt = performance.now();
    return;
  }

  const items = fleetItems();
  picker.items = items;
  if (picker.index >= items.length) picker.index = 0;

  const indexOf = new Map(items.map((item, i) => [item.id, i]));
  const sections = LINE_ORDER.map((lineId) => {
    const meta = LINE_META[lineId];
    const rows = items.filter((item) => item.lineId === lineId);
    const body = rows.length
      ? rows
          .map((item) => {
            const i = indexOf.get(item.id);
            const dist =
              item.distance < 1000
                ? `${Math.round(item.distance)} m`
                : `${(item.distance / 1000).toFixed(1)} km`;
            const metaText = item.kmh > 0 ? `${item.kmh} km/h` : item.state;
            return (
              `<li><button class="fleet-row${item.active ? ' active' : ''}${i === picker.index ? ' cursor' : ''}"` +
              ` data-index="${i}" data-id="${escapeHtml(item.id)}" style="--c:${item.color}">` +
              `<span class="fleet-row-id"><i></i>${escapeHtml(item.number)}</span>` +
              `<span class="fleet-row-dest">TO ${escapeHtml(item.to.toUpperCase())}</span>` +
              `<b class="fleet-row-speed">${escapeHtml(metaText)}</b>` +
              `<em class="fleet-row-dist">${escapeHtml(dist)}</em>` +
              `</button></li>`
            );
          })
          .join('')
      : '<li class="fleet-empty">NO SETS RUNNING</li>';
    return {
      rows: rows.length,
      html:
        `<section class="fleet-col" style="--c:${meta.color}">` +
        `<header class="fleet-col-head"><span class="fleet-col-name"><i></i>${meta.name}</span>` +
        `<span class="fleet-col-count">${rows.length}</span></header>` +
        `<ul class="fleet-list">${body}</ul></section>`,
    };
  });

  const scrollTop = els.fleetList.scrollTop;
  els.fleetList.innerHTML = packStacks(sections)
    .map((stack) => `<div class="fleet-stack">${stack.map((s) => s.html).join('')}</div>`)
    .join('');
  els.fleetList.scrollTop = scrollTop;

  if (els.fleetBoardTotal) els.fleetBoardTotal.textContent = String(items.length);
  if (els.fleetBoardService) els.fleetBoardService.textContent = serviceName();
  picker.renderedAt = performance.now();
}

function updatePickerLabel() {
  if (!els.tsId) return;
  const v = state.vehicle;
  const line = currentLine();
  if (state.serviceClosed && state.service) {
    els.tsId.textContent = 'NETWORK CLOSED';
    els.tsSub.textContent = `FIRST TRAIN ${fmtClock(state.service.openAt)}`;
    if (els.tsDot) {
      els.tsDot.classList.add('idle');
      els.tsDot.style.background = '';
      els.tsDot.style.removeProperty('--ts-c');
    }
    return;
  }
  if (els.tsDot) els.tsDot.classList.remove('idle');
  if (v) {
    const item = pickerItem(v);
    els.tsId.textContent = item.number;
    els.tsSub.textContent = `${item.lineId} · TO ${item.to.toUpperCase()}`;
  } else {
    els.tsId.textContent = 'SELECT SET';
    els.tsSub.textContent = `${line.id} · NEAREST`;
  }
  if (els.tsDot) {
    els.tsDot.style.background = line.color;
    els.tsDot.style.setProperty('--ts-c', line.color);
  }
}

function setFleetOpen(open) {
  if (open === picker.open || !els.fleetBtn) return;
  if (open) updateFleetPulse(true);
  picker.open = open;
  els.fleetBtn.classList.toggle('open', open);
  els.fleetBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    picker.index = Math.max(0, fleetItems().findIndex((x) => x.active));
    renderFleet();
    els.fleetBoard.hidden = false;
    els.fleetBtn.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      const active = els.fleetList.querySelector('.fleet-row.cursor');
      if (active) active.scrollIntoView({ block: 'nearest' });
    });
  } else {
    els.fleetBoard.hidden = true;
  }
}

function movePicker(step) {
  if (!picker.items.length) return;
  picker.index = (picker.index + step + picker.items.length) % picker.items.length;
  renderFleet();
  const active = els.fleetList.querySelector('.fleet-row.cursor');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function choosePicker(index) {
  const item = picker.items[index];
  if (!item) return;
  setFleetOpen(false);
  selectVehicle(item.id);
  recenterCamera();
}

function selectNearestTrain(lineId, point, initial = false) {
  const line = network.byId.get(lineId);
  const svc = svcIndexFor(network, state.epoch);
  const t = istParts(state.epoch).sec;
  let best = null;
  for (const block of fleet.blocks) {
    if (block.line.id !== lineId) continue;
    const st = fleet.stateAt(block, t, svc);
    if (!st) continue;
    const p = line.getPoint(st.s);
    const d = (p.x - point.x) ** 2 + (p.z - point.z) ** 2;
    if (!best || d < best.d) best = { block, st, d };
  }
  if (!best) {
    // Out of service: there is nothing to follow, but the corridor switch and
    // the camera should still respond instead of appearing dead.
    state.lineId = lineId;
    state.followId = null;
    state.vehicle = null;
    if (!initial) state.hasUserSelected = true;
    cam.init = false;
    syncLineUI();
    return false;
  }
  state.lineId = lineId;
  state.followId = best.block.id;
  state.vehicle = best.st;
  state.doors = 0;
  if (!initial) state.hasUserSelected = true;
  cam.init = false;
  syncLineUI();
  return true;
}

function selectVehicle(blockId) {
  const block = fleet.blocks.find((b) => b.id === blockId);
  if (!block) return;
  state.lineId = block.line.id;
  state.followId = blockId;
  state.hasUserSelected = true;
  cam.init = false;
  syncLineUI();
}

// ---------------------------------------------------------------------------
// placement
// ---------------------------------------------------------------------------

function placeCarsFor(obj, route, vehicle) {
  const lateral = vehicle.lateral ?? -TRACK_OFFSET * vehicle.dir;
  const dir = vehicle.dir;
  for (let i = 0; i < obj.cars.length; i++) {
    const car = obj.cars[i];
    const carS = vehicle.s + (i - 1) * TRAIN.carSpacing;
    route.getPoint(carS - TRAIN.bogieHalfSpacing, scratch.pA);
    route.getPoint(carS + TRAIN.bogieHalfSpacing, scratch.pB);
    scratch.pA.y = route.yAt(carS - TRAIN.bogieHalfSpacing);
    scratch.pB.y = route.yAt(carS + TRAIN.bogieHalfSpacing);

    scratch.mid.copy(scratch.pA).add(scratch.pB).multiplyScalar(0.5);
    scratch.fwd.subVectors(scratch.pB, scratch.pA).normalize();
    scratch.right.crossVectors(UP, scratch.fwd).normalize();
    scratch.up.crossVectors(scratch.fwd, scratch.right).normalize();
    scratch.basis.makeBasis(scratch.right, scratch.up, scratch.fwd);

    scratch.mid.addScaledVector(scratch.right, lateral);
    const node = car.group || car;
    node.quaternion.setFromRotationMatrix(scratch.basis);
    node.position.set(scratch.mid.x, RAIL_TOP + scratch.mid.y, scratch.mid.z);

    // gentle body roll into curves
    route.getTangent(carS - 3, scratch.t1);
    route.getTangent(carS + 3, scratch.t2);
    const kSigned = scratch.t2.sub(scratch.t1).dot(scratch.right) / 6;
    const roll = Math.atan((vehicle.v * vehicle.v * Math.abs(kSigned)) / 9.81) * 0.45;
    scratch.q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -roll * Math.sign(kSigned || 1) * dir);
    node.quaternion.multiply(scratch.q);
  }
}

let proxyCursor = 0;
function placeAll() {
  if (!ready && !network) return;
  const svc = svcIndexFor(network, state.epoch);
  const t = istParts(state.epoch).sec;

  // pick the followed vehicle (may have rolled into its next trip)
  if (state.followId) {
    const block = fleet.blocks.find((b) => b.id === state.followId);
    if (block) {
      const st = fleet.stateAt(block, t, svc);
      if (st) state.vehicle = st;
      else {
        // set has finished for the day — hop onto the nearest active one
        selectNearestTrain(state.lineId, scratch.focus, true);
      }
    }
  }

  const focus = measureFocus();
  const visible = activeVehicles(focus, 2600).filter((v) => v.block.id !== state.followId);
  visible.sort((a, b) => a.distance - b.distance);

  // hide all proxies, then hand them out
  for (const lr of lineRuntime.values()) {
    for (const p of lr.proxies) p.group.visible = false;
  }
  // Only individual coaches in the camera's vicinity are drawn. The radius
  // scales with zoom: a couple of coaches at street zoom, the whole visible
  // network when the map is pulled back.
  const zoomNow = cam.free ? world.map.getZoom() : cam.zoom;
  const vicinity = Math.max(70, Math.min(2600, 220 * Math.pow(2, 19 - zoomNow)));

  const used = new Map();
  const maxProxies = 8;
  let n = 0;
  for (const v of visible) {
    if (n >= maxProxies) break;
    const lr = lineRuntime.get(v.block.line.id);
    if (!lr) continue;
    const k = used.get(v.block.line.id) || 0;
    if (k >= lr.proxies.length) continue;
    used.set(v.block.line.id, k + 1);
    const proxy = lr.proxies[k];
    proxy.group.visible = true;
    proxy.setMode(v.dir);
    placeCarsFor(proxy, lr.route, v);
    proxy.cull(focus, vicinity);
    n++;
  }
  state.renderedTrains = n + 1;

  // the followed set gets the detailed model
  for (const [id, lr] of lineRuntime) {
    lr.detailed.group.visible = id === state.lineId && !!state.vehicle;
  }
  if (state.vehicle) {
    const lr = lineRuntime.get(state.lineId);
    if (lr) {
      placeCarsFor(lr.detailed, lr.route, state.vehicle);
      lr.detailed.setMode(state.vehicle.dir);
      lr.detailed.setDoors(state.vehicle.doors ?? 0);
    }
  }

  // station culling: only the two or three around the camera are built
  for (const lr of lineRuntime.values()) {
    for (const item of lr.stations.items) {
      const st = item.userData.station;
      const dx = st.x - focus.x;
      const dz = st.z - focus.z;
      item.visible = dx * dx + dz * dz < 820 * 820;
    }
  }
}

function measureFocus() {
  if (cam.free) {
    const c = cam.free.center;
    const p = network.frame.project(c[1], c[0]);
    p.y = RAIL_TOP;
    return scratch.focus.copy(p);
  }
  const v = state.vehicle;
  if (!v) {
    const line = network.byId.get(state.lineId);
    return line.getPoint(line.length / 2, scratch.focus);
  }
  const line = network.byId.get(state.lineId);
  const lateral = v.lateral ?? -TRACK_OFFSET * v.dir;
  const p = line.getPoint(v.s, scratch.focus);
  const t = line.getTangent(v.s, scratch.t1);
  p.x += t.z * lateral;
  p.z -= t.x * lateral;
  p.y = RAIL_TOP + line.yAt(v.s);
  return p;
}

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------

function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

function updateCamera(dt, snap = false) {
  if (cam.free) {
    world.setCamera(cam.free);
    return measureFocus();
  }
  const line = network.byId.get(state.lineId);
  const v = state.vehicle;
  const s = v ? v.s : line.length / 2;
  const dir = v ? v.dir : 1;
  const rawHeading = line.headingAt(s) + (dir > 0 ? 0 : 180);
  const rawFocus = measureFocus();

  if (!cam.init || snap) {
    cam.bearing = rawHeading + MAP.chaseBearing + cam.bearingOffset;
    cam.smoothHeading = rawHeading;
    cam.smoothFocus.copy(rawFocus);
    cam.init = true;
  } else {
    // Short, frame-rate independent low-pass filters. They are fast enough
    // that the train still feels planted, but remove the centimetre-scale
    // tangent noise that otherwise reads as camera shake at street zoom.
    cam.smoothHeading = lerpAngle(cam.smoothHeading, rawHeading, 1 - Math.exp(-dt * 12));
    cam.smoothFocus.lerp(rawFocus, 1 - Math.exp(-dt * 16));
  }

  const now = performance.now();
  if (now - cam.lastInteract > 7000 && Math.abs(cam.bearingOffset) > 0.02) {
    cam.bearingOffset *= Math.exp(-dt * 0.9);
  }

  const targetBearing = cam.smoothHeading + MAP.chaseBearing + cam.bearingOffset;
  cam.bearing = snap ? targetBearing : lerpAngle(cam.bearing, targetBearing, 1 - Math.exp(-dt * 2.6));
  cam.pitch += (cam.pitchTarget - cam.pitch) * (1 - Math.exp(-dt * 4.2));
  cam.zoom += (cam.zoomTarget - cam.zoom) * (1 - Math.exp(-dt * 4.2));

  const focus = cam.smoothFocus;
  const br = (cam.bearing * Math.PI) / 180;
  const pr = (cam.pitch * Math.PI) / 180;
  const ahead = cam.lookAhead * (0.55 + 0.45 * Math.sin(pr));
  const cx = focus.x + Math.sin(br) * ahead + Math.cos(br) * MAP.cameraOffset;
  const cz = focus.z + Math.cos(br) * ahead - Math.sin(br) * MAP.cameraOffset;
  const ll = line.toLngLat(cx, cz);

  world.setCamera({ center: [ll.lng, ll.lat], bearing: cam.bearing, pitch: cam.pitch, zoom: cam.zoom });
  return focus;
}

function recenterCamera() {
  cam.bearingOffset = 0;
  cam.pitchTarget = 46;
  cam.zoomTarget = 19.15;
  cam.lastInteract = performance.now();
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const fmtTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function currentLine() {
  return network.byId.get(state.lineId);
}

function arrivalEta(v, tNow) {
  if (!v || !v.pattern) return 0;
  const stops = v.pattern.stops;
  const idx = Math.min(v.nextIdx ?? 1, stops.length - 1);
  const base = v.kind === 'turnback' ? v.trip.s0 : v.trip.s0;
  return Math.max(0, base + stops[idx].a - tNow);
}

function nextStationOf(v) {
  if (!v) return null;
  const line = currentLine();
  const idx = Math.min(v.nextIdx ?? 1, v.pattern.stops.length - 1);
  return line.stations[v.pattern.stops[idx].st] || null;
}

// ---------------------------------------------------------------------------
// Network pulse
//
// The dock reports the whole timetable, not the handful of sets inside the
// camera's culling radius. This walks every duty once a second, which is
// cheap (a weekday has 70 duty blocks) and keeps the fleet board honest while
// it is open.
// ---------------------------------------------------------------------------

let fleetPulseAt = 0;

function updateFleetPulse(force = false) {
  if (!fleet || !network) return;
  const now = performance.now();
  if (!force && now - fleetPulseAt < 1000) return;
  fleetPulseAt = now;

  if (state.nightAuto) {
    const want = isNightAt(istParts(state.epoch).sec);
    if (want !== state.night) {
      state.night = want;
      applyNight();
    }
  }

  const all = wholeNetwork();
  state.fleetAll = all;
  const byLine = { RED: 0, GREEN: 0, BLUE: 0 };
  for (const v of all) {
    const id = v.block.line.id;
    byLine[id] = (byLine[id] || 0) + 1;
  }
  state.fleetByLine = byLine;
  state.fleetTotal = all.length;

  if (els.fleetTotal) els.fleetTotal.textContent = String(all.length);
  if (els.fleetLines) {
    for (const el of els.fleetLines.querySelectorAll('.dock-line')) {
      const b = el.querySelector('b');
      if (b) b.textContent = String(byLine[el.dataset.line] || 0);
    }
  }
  if (els.fleetBoardService) {
    els.fleetBoardService.textContent = state.serviceClosed
      ? `${serviceName()} · CLOSED`
      : serviceName();
  }
  if (picker.open && now - picker.renderedAt > 2500) renderFleet();
}

function applyServiceState(status) {
  if (!status) return;
  state.service = status;
  if (state.serviceClosed === status.closed) return;

  const wasClosed = state.serviceClosed === true;
  state.serviceClosed = status.closed;
  document.documentElement.dataset.service = status.closed ? 'closed' : 'open';
  if (els.playBtn) {
    els.playBtn.disabled = status.closed;
    els.playBtn.title = status.closed ? 'No service to pause' : '';
  }

  if (status.closed) {
    state.vehicle = null;
    if (els.runState) els.runState.textContent = 'NO ACTIVE SET';
  } else if (wasClosed && !state.followId) {
    // The page may have been open across the first departure.
    selectNearestTrain(state.lineId, measureFocus(), true);
    cam.init = false;
  }
}

function updateClosedHud(status) {
  if (!status || !status.closed) return;

  const openClock = fmtClock(status.openAt);
  // The last arrival belongs to the service that just ended (yesterday if we
  // are in the small hours), not to the upcoming one.
  const lastClock = fmtClock(status.lastAt);
  const countdown = fmtCountdown(status.until);

  if (els.closedCountdown && els.closedCountdown.textContent !== countdown) {
    els.closedCountdown.textContent = countdown;
  }
  if (els.closedFirst) els.closedFirst.textContent = openClock;
  if (els.closedLast) els.closedLast.textContent = lastClock;
  if (els.closedFirstMetric) els.closedFirstMetric.textContent = openClock;
  if (els.closedLastMetric) els.closedLastMetric.textContent = lastClock;
  if (els.closedReopen) els.closedReopen.textContent = openClock;
  if (els.closedInService) els.closedInService.textContent = String(state.fleetTotal || 0);
  if (els.closedWindowVal) els.closedWindowVal.textContent = fmtDuration(status.window);

  if (network) {
    const stats = network.meta.stats;
    if (els.closedLinesVal) els.closedLinesVal.textContent = String(network.lines.length);
    if (els.closedStationsVal) els.closedStationsVal.textContent = String(stats.stations);
    if (els.closedLengthVal) els.closedLengthVal.innerHTML = `${(stats.length / 1000).toFixed(1)}<em>km</em>`;
  }

  if (els.closedDepartures) {
    const openBase = status.openAt - status.open.first;
    const html = status.open.lines
      .map(
        (item) =>
          `<li><span class="u-seq"><i style="--c:${item.color}"></i></span>` +
          `<span class="u-name">TO ${escapeHtml(item.to.toUpperCase())}</span>` +
          `<span class="u-dist">${escapeHtml(item.id)}</span>` +
          `<span class="u-eta">${fmtClock(openBase + item.first)}</span></li>`
      )
      .join('');
    if (els.closedDepartures.innerHTML !== html) els.closedDepartures.innerHTML = html;
  }

  if (els.mapStatus) {
    els.mapStatus.textContent = `CLOSED · FIRST TRAIN ${openClock}`;
  }

  // keep the first-departures board ticking while it is open
  if (picker.open) {
    const fleetCount = document.getElementById('fleetClosedCount');
    if (fleetCount) fleetCount.textContent = countdown;
  }
}

function updateHud(dt) {
  const line = currentLine();
  const part = istParts(state.epoch);
  const status = serviceStatus(state.epoch);
  applyServiceState(status);

  if (els.clock) {
    const h = Math.floor(part.sec / 3600);
    const m = Math.floor((part.sec % 3600) / 60);
    const s = Math.floor(part.sec % 60);
    els.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} IST`;
  }
  if (els.serviceLabel) {
    const names = ['WEEKDAY', 'SATURDAY', 'SUNDAY'];
    const name = names[svcIndexFor(network, state.epoch)] || 'WEEKDAY';
    els.serviceLabel.textContent = status && status.closed ? `${name} · CLOSED` : name;
  }

  if (status && status.closed) {
    updateClosedHud(status);
    updatePickerLabel();
    return;
  }

  const v = state.vehicle;
  if (!v) {
    if (els.runState) els.runState.textContent = 'NO ACTIVE SET';
    return;
  }

  const next = nextStationOf(v);
  const stops = v.pattern.stops;
  const idx = Math.min(v.nextIdx ?? 1, stops.length - 1);
  const prevSt = line.stations[stops[Math.max(0, idx - 1)].st];
  const eta = arrivalEta(v, part.sec);
  const d = next ? Math.abs(next.s - v.s) : 0;

  if (els.nextName) els.nextName.textContent = next ? next.name : '—';
  if (els.nextMeta) els.nextMeta.textContent = `TOWARDS ${v.dir > 0 ? line.to : line.from}`;
  if (els.nextSeq) els.nextSeq.textContent = `${String(idx + 1).padStart(2, '0')} / ${stops.length}`;
  if (els.etaVal) els.etaVal.textContent = fmtTime(eta);
  if (els.distVal) els.distVal.textContent = (d / 1000).toFixed(2);

  const span = Math.max(1, Math.abs((next ? next.s : v.s) - (prevSt ? prevSt.s : v.s)));
  let progress01 = prevSt ? (v.pattern.dir > 0 ? (v.s - prevSt.s) / span : (prevSt.s - v.s) / span) : 0;
  progress01 = clamp(progress01, 0, 1);
  if (els.progressFill) els.progressFill.style.width = `${progress01 * 100}%`;
  if (els.progressDot) els.progressDot.style.left = `${progress01 * 100}%`;
  if (els.prevName) els.prevName.textContent = prevSt ? prevSt.name : line.from.toUpperCase();
  if (els.nextLabel) els.nextLabel.textContent = next ? next.name : line.to.toUpperCase();

  // upcoming rows from the timetable itself
  if (els.upcomingList) {
    const rows = [];
    for (let k = idx + 1; k < Math.min(stops.length, idx + 5); k++) {
      const sst = line.stations[stops[k].st];
      if (!sst) continue;
      const rowEta = v.trip.s0 + stops[k].a - part.sec;
      rows.push(
        `<li><span class="u-seq">${String(k + 1).padStart(2, '0')}</span>` +
          `<span class="u-name">${sst.name}</span>` +
          `<span class="u-dist">${(Math.abs(sst.s - v.s) / 1000).toFixed(2)}<em>km</em></span>` +
          `<span class="u-eta">${fmtTime(rowEta)}</span></li>`
      );
    }
    els.upcomingList.innerHTML = rows.join('');
  }

  const kmh = v.v * 3.6;
  if (els.speedVal) els.speedVal.textContent = String(Math.round(kmh));
  let a = 0;
  if (v.phase === 'run' && v.seg) {
    const el = v.segElapsed;
    a = el < v.seg.ta ? v.seg.A : el < v.seg.ta + v.seg.tc ? 0 : -v.seg.B;
  }
  if (els.accelVal) {
    els.accelVal.textContent = `${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(2)}`;
    els.accelVal.classList.toggle('negative', a < -0.12);
  }
  if (els.accelFill) {
    const pct = clamp(a / 2.2, -1, 1);
    els.accelFill.style.width = `${Math.abs(pct) * 50}%`;
    els.accelFill.style.left = pct >= 0 ? '50%' : `${50 - Math.abs(pct) * 50}%`;
    els.accelFill.classList.toggle('negative', pct < 0);
  }

  const k = line.getCurvature(v.s);
  const radius = k > 1e-6 ? 1 / k : Infinity;
  const latG = (v.v * v.v * k) / 9.81;
  if (els.latVal) els.latVal.innerHTML = `${Math.abs(latG).toFixed(2)}<em>g</em>`;
  if (els.curveVal) els.curveVal.innerHTML = radius > 2600 ? 'STRAIGHT' : `R ${Math.round(radius)}<em>m</em>`;
  if (els.gradeVal) els.gradeVal.innerHTML = `0.0<em>%</em>`;
  if (els.tractionVal) els.tractionVal.innerHTML = `${Math.round(clamp(a / 1.05, 0, 1) * 100)}<em>%</em>`;
  if (els.doorsVal) {
    const dOpen = v.doors > 0.5;
    els.doorsVal.textContent = dOpen ? 'OPEN' : v.kind === 'turnback' ? 'HOLD' : 'CLOSED';
    els.doorsVal.classList.toggle('warm', dOpen);
  }
  if (els.loadVal) {
    const load = 0.46 + 0.3 * Math.sin((line.stations.indexOf(next) + 2) * 1.7 + (v.pattern.dir > 0 ? 0.3 : 1.9));
    els.loadVal.innerHTML = `${Math.round(clamp(load, 0.2, 0.95) * 100)}<em>%</em>`;
  }
  if (els.delayVal) {
    els.delayVal.textContent = 'ON TIME';
    els.delayVal.classList.remove('warm');
  }
  if (els.odoVal) {
    const odo = Math.abs(v.s - line.stations[0].s) / 1000;
    els.odoVal.innerHTML = `${odo.toFixed(2)}<em>km</em>`;
  }

  if (els.runState) {
    if (v.kind === 'turnback') {
      els.runState.textContent = v.phase === 'shunt' ? 'TERMINUS · SHUNTING TO OPPOSITE TRACK' : 'TERMINUS · DOORS OPEN';
    } else if (v.phase === 'dwell') {
      els.runState.textContent = `DWELL · ${next ? next.name.toUpperCase() : ''}`;
    } else if (a < -0.18) {
      els.runState.textContent = 'BRAKING · APPROACHING';
    } else if (a > 0.14) {
      els.runState.textContent = 'TRACTION · ACCELERATING';
    } else if (v.v > 20) {
      els.runState.textContent = 'CRUISE · LINE SPEED';
    } else {
      els.runState.textContent = 'COASTING';
    }
  }
  if (els.runTag) {
    els.runTag.textContent = `${line.id} · ${v.block.id.split(':')[1]} · D–M–D`;
  }
  updatePickerLabel();
  if (els.mapStatus) {
    els.mapStatus.textContent = `${state.fleetTotal} SETS · ${cam.zoom.toFixed(2)}× · ${Math.round(cam.pitch)}°`;
  }
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

function syncLineUI() {
  if (!els.lineSwitch) return;
  for (const b of els.lineSwitch.querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.line === state.lineId);
  }
  document.documentElement.dataset.line = state.lineId;
}

const NIGHT_TWEEN = 4.8;   // seconds for the full day ↔ night crossfade

const CHROME_COLOR = { day: '#0b1113', night: '#04070d' };

function applyChromeTheme() {
  // The OS window chrome (Android status bar, desktop title bar) follows the
  // scene rather than staying a fixed colour from the manifest.
  if (els.themeColor) {
    els.themeColor.setAttribute('content', state.night ? CHROME_COLOR.night : CHROME_COLOR.day);
  }
}

function applyNight({ immediate = false } = {}) {
  const target = state.night ? 1 : 0;
  if (immediate) state.nightK = target;
  if (world) world.setTimeMode(state.night ? 'night' : 'day', { duration: immediate ? 0 : NIGHT_TWEEN * 1000 });
  if (immediate) applyNightFactor();
  applyChromeTheme();
  if (els.nightBtn) {
    els.nightBtn.classList.toggle('active', state.night);
    els.nightBtn.setAttribute('aria-pressed', String(state.night));
  }
}

function stepNight(dt) {
  const target = state.night ? 1 : 0;
  if (state.nightK === target) return;
  const step = dt / NIGHT_TWEEN;
  state.nightK = target > state.nightK
    ? Math.min(target, state.nightK + step)
    : Math.max(target, state.nightK - step);
  applyNightFactor();
}

// Emissive / glow terms that live in geometry rather than in the light rig all
// read from one 0..1 night factor, so the city does not snap from noon to
// midnight around the trains while the sky is still mid-transition.
function applyNightFactor() {
  const k = state.nightK;
  for (const lr of lineRuntime.values()) {
    lr.stations.setNightFactor(k);
    lr.detailed.setNightFactor(k);
    for (const p of lr.proxies) p.setNightFactor(k);
  }
  if (state.stationGlow) state.stationGlow.material.opacity = 0.85 * k;
  if (state.interchangeLinks && state.interchangeLinks.lamp) {
    state.interchangeLinks.lamp.opacity = 0.8 * k;
  }
}

function setPlaying(playing) {
  // Resuming from a pause re-anchors to the wall clock, so the set is always
  // exactly where the published timetable says it should be right now.
  if (playing && !state.playing) resetClock();
  state.playing = playing;
  if (els.playBtn) {
    els.playBtn.classList.toggle('paused', !playing);
    els.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }
}

function toggleNight() {
  state.night = !state.night;
  state.nightAuto = false;
  applyNight();
}

function toggleNotes(open) {
  if (!els.notes) return;
  const next = open ?? !els.notes.classList.contains('open');
  els.notes.classList.toggle('open', next);
}

function bindControls() {
  if (els.playBtn) els.playBtn.addEventListener('click', () => setPlaying(!state.playing));
  if (els.resetCam) els.resetCam.addEventListener('click', recenterCamera);
  if (els.infoBtn) els.infoBtn.addEventListener('click', () => toggleNotes());
  if (els.notesClose) els.notesClose.addEventListener('click', () => toggleNotes(false));
  if (els.nightBtn) els.nightBtn.addEventListener('click', toggleNight);
  if (els.lineSwitch) {
    els.lineSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-line]');
      if (!btn) return;
      const line = network.byId.get(btn.dataset.line);
      const p = line.getPoint(line.length / 2);
      selectNearestTrain(btn.dataset.line, p, false);
      cam.init = false;
      recenterCamera();
    });
  }
  if (els.fleetBtn && els.fleetBoard) {
    els.fleetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setFleetOpen(!picker.open);
    });
    els.fleetBoard.addEventListener('click', (e) => {
      const row = e.target.closest('.fleet-row');
      if (!row) return;
      choosePicker(Number(row.dataset.index));
    });
    if (els.fleetClose) {
      els.fleetClose.addEventListener('click', () => {
        setFleetOpen(false);
        els.fleetBtn.focus();
      });
    }
    document.addEventListener('pointerdown', (e) => {
      if (picker.open && !els.dock.contains(e.target) && !els.fleetBoard.contains(e.target)) {
        setFleetOpen(false);
      }
    });
    els.fleetBtn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!picker.open) setFleetOpen(true);
        else movePicker(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' && picker.open) {
        e.preventDefault();
        choosePicker(picker.index);
      } else if (e.key === 'Escape' && picker.open) {
        e.preventDefault();
        setFleetOpen(false);
        els.fleetBtn.focus();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.key.toLowerCase() === 'r') recenterCamera();
    else if (e.key.toLowerCase() === 'i') toggleNotes();
    else if (e.key.toLowerCase() === 'h') document.body.classList.toggle('hide-ui');
    else if (e.key.toLowerCase() === 'n') toggleNight();
    else if (e.key.toLowerCase() === 'f') setFleetOpen(!picker.open);
    else if (e.key.toLowerCase() === 'l') {
      const order = ['RED', 'GREEN', 'BLUE'];
      const i = order.indexOf(state.lineId);
      const next = order[(i + 1) % order.length];
      const line = network.byId.get(next);
      selectNearestTrain(next, line.getPoint(line.length / 2), false);
      recenterCamera();
    } else if (e.key.toLowerCase() === 'b') {
      const visible = !document.body.classList.contains('no-buildings');
      world.setBuildingsVisible(visible);
      document.body.classList.toggle('no-buildings', !visible);
    } else if (e.key === 'Escape') {
      toggleNotes(false);
      setFleetOpen(false);
      closeInstallSheet();
    }
  });
}

// ---------------------------------------------------------------------------
// pointer
// ---------------------------------------------------------------------------

function bindPointer() {
  const canvas = world.map.getCanvas();
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';

  const pointers = new Map();
  let drag = null;
  let pinch = 0;
  const zoomClamp = (z) => clamp(z, 15.6, 21.3);

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
      cam.pitchTarget = clamp(cam.pitchTarget - dy * 0.24, 24, 72);
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
  canvas.addEventListener('pointerleave', () => {
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
// loop
// ---------------------------------------------------------------------------

let last = performance.now();
let hudAccum = 0;
let fpsAccum = 0;
let fpsFrames = 0;
let fps = 60;
let lowQuality = false;

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.1, Math.max(0.001, raw));

  if (state.playing) tickClock();

  const t = istParts(state.epoch).sec;
  const svc = svcIndexFor(network, state.epoch);
  if (state.followId) {
    const block = fleet.blocks.find((b) => b.id === state.followId);
    const st = block ? fleet.stateAt(block, t, svc) : null;
    if (st) {
      state.vehicle = st;
    } else {
      // The set has finished for the day (or its block is not running on this
      // service class). Drop it rather than leaving a frozen train on screen;
      // hop to another active set on the corridor if there is one.
      state.vehicle = null;
      if (!selectNearestTrain(state.lineId, measureFocus(), true)) state.followId = null;
    }
  }
  if (!state.followId && state.fleetTotal > 0) {
    selectNearestTrain(state.lineId, measureFocus(), true);
    cam.init = false;
  }

  stepNight(dt);
  const focus = updateCamera(dt);
  placeAll();
  updateFleetPulse();
  world.update(dt);
  world.updateSun(focus);

  hudAccum += dt;
  if (hudAccum > 0.09) {
    hudAccum = 0;
    updateHud(dt);
  }

  // fps + adaptive quality
  fpsAccum += raw;
  fpsFrames++;
  if (fpsAccum > 1) {
    fps = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
    if (els.stats) {
      els.stats.textContent = `${Math.round(fps)} FPS · ${world.stats.drawCalls} CALLS · ${state.renderedTrains || 0} DRAWN`;
    }
    if (!lowQuality && fps < 38 && ready) {
      lowQuality = true;
      if (world.sun) {
        world.sun.shadow.mapSize.set(1024, 1024);
        world.sun.shadow.map?.dispose();
        world.sun.shadow.map = null;
      }
    }
  }

  world.trigger();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Install / PWA / connectivity
//
// The install affordance is deliberately quiet: one icon in the header when a
// browser offers it, plus a manual path for iOS, which still has no
// beforeinstallprompt event. Nothing blocks the tracker while it is open.
// ---------------------------------------------------------------------------

const PLATFORM = (() => {
  const ua = navigator.userAgent || '';
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
})();

function isStandalone() {
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true
  );
}

let deferredInstall = null;

function revealInstall() {
  if (isStandalone() || document.body.classList.contains('installed')) {
    document.body.classList.add('installed');
    return;
  }
  if (els.installBtn) els.installBtn.hidden = false;
}

function openInstallSheet() {
  if (!els.installSheet) return;
  document.body.dataset.platform = PLATFORM;
  els.installSheet.hidden = false;
  requestAnimationFrame(() => els.installSheet.classList.add('open'));
  els.installClose?.focus();
}

function closeInstallSheet() {
  if (!els.installSheet || els.installSheet.hidden) return;
  els.installSheet.classList.remove('open');
  setTimeout(() => {
    if (!els.installSheet.classList.contains('open')) els.installSheet.hidden = true;
  }, 240);
}

function syncConnectivity() {
  const offline = navigator.onLine === false;
  if (els.netBanner) els.netBanner.hidden = !offline;
  document.body.classList.toggle('offline', offline);
}

function setupInstall() {
  document.body.dataset.platform = PLATFORM;
  if (isStandalone()) {
    document.body.classList.add('installed');
    if (els.installState) els.installState.textContent = 'Installed';
    return;
  }
  if (els.installState) els.installState.textContent = 'Add to home screen';

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event;
    revealInstall();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    document.body.classList.add('installed');
    if (els.installBtn) els.installBtn.hidden = true;
    if (els.installState) els.installState.textContent = 'Installed';
    closeInstallSheet();
  });

  // iOS never fires beforeinstallprompt, but the Share-sheet path works.
  // Other browsers may omit the event too (desktop Safari, Firefox), so show
  // the same quiet icon after a moment instead of leaving no way in.
  setTimeout(revealInstall, PLATFORM === 'ios' ? 3200 : 5600);

  els.installBtn?.addEventListener('click', async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      try {
        await deferredInstall.userChoice;
      } catch (err) {
        /* the prompt can be dismissed by the browser */
      }
      deferredInstall = null;
      return;
    }
    openInstallSheet();
  });
  els.installClose?.addEventListener('click', closeInstallSheet);
  els.installSheet?.addEventListener('click', (event) => {
    if (event.target === els.installSheet) closeInstallSheet();
  });

  window.addEventListener('online', syncConnectivity);
  window.addEventListener('offline', syncConnectivity);
  syncConnectivity();
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || params.get('sw') === '0') return;
  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true; // first install, not an update
      return;
    }
    if (els.updateToast) els.updateToast.hidden = false;
  });

  if (els.updateToast) {
    els.updateToast.addEventListener('click', () => window.location.reload());
  }

  navigator.serviceWorker
    .register('sw.js', { scope: './' })
    .then((reg) => {
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    })
    .catch(() => {
      /* registration is an enhancement; the tracker runs without it */
    });
}

function setupPwa() {
  setupInstall();
  setupServiceWorker();
}

// ---------------------------------------------------------------------------
// go
// ---------------------------------------------------------------------------

setupPwa();

boot().then(() => {
  if (ready) bindControls();
});

const pointerTimer = setInterval(() => {
  if (world && world.map && world.map.getCanvas()) {
    bindPointer();
    clearInterval(pointerTimer);
  }
}, 60);

window.metro = {
  get network() { return network; },
  get world() { return world; },
  get fleet() { return fleet; },
  get state() { return state; },
  cam,
  setPlaying,
  recenterCamera,
  toggleNight,
  selectLine(id) {
    const line = network.byId.get(id);
    if (!line) return;
    selectNearestTrain(id, line.getPoint(line.length / 2), false);
    recenterCamera();
  },
  selectVehicle,
  viewStation(lineId, index, opts = {}) {
    const line = network.byId.get(lineId) || currentLine();
    const st = line.stations[clamp(index, 0, line.stations.length - 1)];
    const t = line.getTangent(st.s);
    const heading = (Math.atan2(t.x, t.z) * 180) / Math.PI;
    const bearing = opts.bearing ?? heading + (opts.offset ?? -26);
    const ll = line.toLngLat(st.x, st.z);
    cam.free = {
      center: [ll.lng, ll.lat],
      bearing,
      pitch: opts.pitch ?? 56,
      zoom: opts.zoom ?? 18.7,
    };
    return { name: st.name, s: st.s };
  },
  clearFreeCam() {
    cam.free = null;
  },
  jumpToStation(index) {
    const line = currentLine();
    const st = line.stations[clamp(index, 0, line.stations.length - 1)];
    selectNearestTrain(state.lineId, line.getPoint(st.s), false);
    state.epoch = Date.now() / 1000;
    recenterCamera();
  },
};
