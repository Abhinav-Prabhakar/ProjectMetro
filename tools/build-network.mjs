// ---------------------------------------------------------------------------
// build-network.mjs — compile the official HMRL GTFS feed into the compact
// runtime timetable used by the tracker.
//
//   node tools/build-network.mjs
//     -> assets/data/network.json
//
// The feed has 2,820 trips across 162 blocks. A block is one physical train set:
// every consecutive pair of trips in a block is the same line in the opposite
// direction, which is exactly the terminus turnback we want to animate.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const GTFS = path.join(ROOT, 'tools/gtfs');
const OUT = path.join(ROOT, 'assets/data/network.json');

const ORIGIN = { lng: 78.47, lat: 17.42 };

// ---- tiny CSV reader -------------------------------------------------------

function readCsv(name) {
  const text = fs.readFileSync(path.join(GTFS, name), 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
}

const timeToSec = (t) => {
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

const R = (n, p = 0.1) => Math.round(n / p) * p;

// ---- load ------------------------------------------------------------------

const routes = readCsv('routes.txt');
const tripsRaw = readCsv('trips.txt');
const stopTimesRaw = readCsv('stop_times.txt');
const stopsRaw = readCsv('stops.txt');
const shapesRaw = readCsv('shapes.txt');
const calendar = readCsv('calendar.txt');

const stopById = new Map(stopsRaw.map((s) => [s.stop_id, s]));

// parent station for every platform id
const parentName = new Map();
for (const s of stopsRaw) {
  if (s.location_type === '0' && s.parent_station) {
    const p = stopById.get(s.parent_station);
    parentName.set(s.stop_id, p ? p.stop_name : s.stop_name);
  } else {
    parentName.set(s.stop_id, s.stop_name);
  }
}

// service classes: 0 weekday, 1 saturday, 2 sunday
const services = calendar.map((c) => ({
  id: c.service_id,
  days: [c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday].map(Number),
}));
const serviceIndex = new Map(services.map((s, i) => [s.id, i]));

// shapes grouped and sorted, with cumulative distance from the lat/lon chain
const shapes = new Map();
for (const row of shapesRaw) {
  if (!shapes.has(row.shape_id)) shapes.set(row.shape_id, []);
  shapes.get(row.shape_id).push({
    seq: Number(row.shape_pt_sequence),
    lat: Number(row.shape_pt_lat),
    lon: Number(row.shape_pt_lon),
    dist: Number(row.shape_dist_traveled),
  });
}
for (const pts of shapes.values()) pts.sort((a, b) => a.seq - b.seq);

// stop times grouped by trip
const timesByTrip = new Map();
for (const row of stopTimesRaw) {
  if (!timesByTrip.has(row.trip_id)) timesByTrip.set(row.trip_id, []);
  timesByTrip.get(row.trip_id).push({
    seq: Number(row.stop_sequence),
    stop: row.stop_id,
    arr: timeToSec(row.arrival_time),
    dep: timeToSec(row.departure_time),
    dist: Number(row.shape_dist_traveled),
  });
}
for (const rows of timesByTrip.values()) rows.sort((a, b) => a.seq - b.seq);

// ---- per-line build --------------------------------------------------------

const lineOrder = ['RED', 'GREEN', 'BLUE'];
const lines = [];

for (const route of routes.sort((a, b) => lineOrder.indexOf(a.route_id) - lineOrder.indexOf(b.route_id))) {
  const id = route.route_id;
  const trips = tripsRaw.filter((t) => t.route_id === id);

  // canonical geometry = the shape of the busiest direction-0 trip
  const dir0 = trips.filter((t) => t.direction_id === '0');
  const dir1 = trips.filter((t) => t.direction_id === '1');
  const dir0Shapes = new Map();
  for (const t of dir0) dir0Shapes.set(t.shape_id, (dir0Shapes.get(t.shape_id) || 0) + 1);
  const shape0Id = [...dir0Shapes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const shapePts = shapes.get(shape0Id);
  const L = shapePts[shapePts.length - 1].dist;

  // the longest direction-0 trip defines the full station list
  let refTrip = null;
  let refStops = null;
  for (const t of dir0) {
    const rows = timesByTrip.get(t.trip_id);
    if (!refStops || rows.length > refStops.length) { refStops = rows; refTrip = t; }
  }

  const stations = refStops.map((row, i) => {
    const st = stopById.get(row.stop);
    const parent = st && st.parent_station ? stopById.get(st.parent_station) : st;
    return {
      id: st.parent_station || row.stop,
      name: parentName.get(row.stop) || (parent ? parent.stop_name : row.stop),
      lat: parent ? Number(parent.stop_lat) : Number(st.stop_lat),
      lon: parent ? Number(parent.stop_lon) : Number(st.stop_lon),
      s: R(row.dist, 0.1),
      seq: i,
    };
  });
  stations.sort((a, b) => a.s - b.s);
  // de-duplicate (some feeds repeat a platform in one direction)
  for (let i = stations.length - 1; i > 0; i--) {
    if (stations[i].id === stations[i - 1].id) stations.splice(i, 1);
  }
  stations.forEach((s, i) => { s.index = i; });

  const stationByKey = new Map();
  for (const s of stations) {
    stationByKey.set(s.name + '|' + s.id, s);
    if (!stationByKey.has(s.name)) stationByKey.set(s.name, s);
  }

  // ---- patterns -----------------------------------------------------------
  // A pattern is a stop sequence with times relative to the trip start. Many
  // trips share one, so we store each only once.
  const patternKey = new Map();
  const patterns = [];

  function patternFor(trip, rows) {
    const isDir1 = trip.direction_id === '1';
    const t0 = rows[0].dep;
    const sig = rows.map((r) => `${r.stop}:${r.arr - t0}:${r.dep - t0}`).join(',');
    const key = sig;
    if (patternKey.has(key)) return patternKey.get(key);
    const stops = rows.map((r, i) => {
      const name = parentName.get(r.stop) || r.stop;
      const st = stationByKey.get(name) || stations[0];
      let s = isDir1 ? L - r.dist : r.dist;
      s = Math.min(L, Math.max(0, s));
      return { st: st.index, s: R(s, 0.1), a: r.arr - t0, d: r.dep - t0 };
    });
    const pat = { dir: isDir1 ? 1 : 0, stops };
    patterns.push(pat);
    patternKey.set(key, patterns.length - 1);
    return patterns.length - 1;
  }

  // ---- trips and blocks ---------------------------------------------------
  const tripOut = [];
  for (const trip of trips) {
    const rows = timesByTrip.get(trip.trip_id);
    if (!rows || rows.length < 2) continue;
    const t0 = rows[0].dep;
    const t1 = rows[rows.length - 1].arr;
    tripOut.push({
      p: patternFor(trip, rows),
      s0: R(t0, 0.1),
      s1: R(t1, 0.1),
      svc: serviceIndex.get(trip.service_id) ?? 0,
      block: trip.block_id,
      id: trip.trip_id,
      headsign: trip.trip_headsign,
    });
  }
  tripOut.sort((a, b) => a.s0 - b.s0);

  // blocks -> vehicle sets
  const byBlock = new Map();
  tripOut.forEach((t, i) => {
    if (!byBlock.has(t.block)) byBlock.set(t.block, []);
    byBlock.get(t.block).push(i);
  });
  const blocks = [];
  for (const [bid, idxs] of byBlock) {
    idxs.sort((a, b) => tripOut[a].s0 - tripOut[b].s0);
    // split a block if a gap is absurd (> 3 h) — keeps the vehicle state sane
    let run = [];
    for (const i of idxs) {
      if (run.length) {
        const prev = tripOut[run[run.length - 1]];
        const gap = tripOut[i].s0 - prev.s1;
        if (gap > 3 * 3600) { blocks.push({ id: bid + '_' + blocks.length, trips: run }); run = []; }
      }
      run.push(i);
    }
    if (run.length) blocks.push({ id: bid, trips: run });
  }
  blocks.sort((a, b) => a.id.localeCompare(b.id));

  // 2D outline for MapLibre (lon/lat)
  const outline = shapePts.map((p) => [R(p.lon, 1e-6), R(p.lat, 1e-6)]);

  lines.push({
    id,
    name: (`${route.route_short_name || ''}`.replace(/^C\d_/, '') || id).toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) + ' Line',
    long: route.route_long_name,
    color: '#' + route.route_color,
    textColor: '#' + (route.route_text_color || 'FFFFFF'),
    from: stations[0].name,
    to: stations[stations.length - 1].name,
    length: R(L, 0.1),
    shapeId: shape0Id,
    points: shapePts.map((p) => [R(p.lat, 1e-6), R(p.lon, 1e-6), R(p.dist, 0.1)]),
    outline,
    stations,
    patterns,
    trips: tripOut.map((t) => ({ p: t.p, s0: t.s0, s1: t.s1, svc: t.svc })),
    blocks: blocks.map((b) => ({ id: b.id, trips: b.trips })),
  });

  console.log(
    `${id.padEnd(5)} ${String(stations.length).padStart(2)} stations  ${(L / 1000).toFixed(1)} km  ` +
    `${tripOut.length} trips  ${patterns.length} patterns  ${blocks.length} blocks`
  );
}

// mark interchanges (station name shared by more than one line)
const nameCount = new Map();
for (const line of lines) {
  for (const s of line.stations) {
    const k = s.name.toLowerCase();
    if (!nameCount.has(k)) nameCount.set(k, new Set());
    nameCount.get(k).add(line.id);
  }
}
for (const line of lines) {
  for (const s of line.stations) {
    const set = nameCount.get(s.name.toLowerCase());
    s.interchange = set && set.size > 1 ? [...set].filter((x) => x !== line.id) : [];
  }
}

// service calendars in the compact form the runtime uses
const calendarOut = services.map((s) => s.days);

const out = {
  meta: {
    generated: new Date().toISOString(),
    source: 'Hyderabad Metro Rail Ltd. GTFS, July 2026 (Open Data Telangana)',
    attribution: 'Contains data provided by Hyderabad Metro Rail Ltd.',
    origin: ORIGIN,
    serviceDays: calendarOut,
    stats: {
      lines: lines.length,
      stations: new Set(lines.flatMap((l) => l.stations.map((s) => s.name))).size,
      trips: lines.reduce((n, l) => n + l.trips.length, 0),
      blocks: lines.reduce((n, l) => n + l.blocks.length, 0),
      length: lines.reduce((n, l) => n + l.length, 0),
    },
  },
  lines,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`\nwrote ${path.relative(ROOT, OUT)} (${kb} kB)`);
console.log(out.meta.stats);
