// ---------------------------------------------------------------------------
// Timetable simulation
//
// Every train in the official GTFS feed is simulated at once. A block is one
// physical 3-car set; consecutive trips in a block run in opposite directions,
// so a set that finishes at a terminus is the same set that leaves it again.
// Positions inside a run come from a trapezoidal speed profile with the real
// HMRL acceleration / braking rates, solved so each inter-station run takes
// exactly the scheduled time.
// ---------------------------------------------------------------------------

export const PHYS = {
  accel: 0.95,        // m/s²  (design 0.95, service ~0.9–1.0)
  brake: 1.05,        // m/s²
  vmax: 80 / 3.6,     // 80 km/h maximum operating speed
  dwellMax: 60,
};

const SEC = 1;

// Hyderabad is UTC+05:30 and has no DST.
const IST_OFFSET = 5.5 * 3600;

export function istParts(epochSeconds) {
  const local = epochSeconds + IST_OFFSET;
  const dayNumber = Math.floor(local / 86400);
  const sec = local - dayNumber * 86400;
  // 1970-01-01 was a Thursday; 0 = Sunday
  const dow = ((dayNumber % 7) + 7 + 4) % 7;
  // GTFS calendar order is Monday..Sunday
  const svcDay = (dow + 6) % 7;
  return { dayNumber, sec, dow, svcDay };
}

export function svcIndexFor(network, epochSeconds) {
  const { svcDay } = istParts(epochSeconds);
  const days = network.meta.serviceDays;
  for (let i = 0; i < days.length; i++) {
    if (days[i][svcDay]) return i;
  }
  return 0;
}

// ---- speed profile --------------------------------------------------------

function solveProfile(d, T) {
  const A = PHYS.accel;
  const B = PHYS.brake;
  const vcap = Math.min(PHYS.vmax, Math.sqrt((2 * d * A * B) / (A + B)));
  const timeAt = (v) => {
    const da = (v * v) / (2 * A);
    const db = (v * v) / (2 * B);
    return v / A + v / B + Math.max(0, d - da - db) / v;
  };
  let v;
  if (timeAt(vcap) >= T) {
    let lo = 0.02;
    let hi = vcap;
    for (let k = 0; k < 44; k++) {
      const mid = (lo + hi) * 0.5;
      if (timeAt(mid) > T) lo = mid;
      else hi = mid;
    }
    v = (lo + hi) * 0.5;
  } else {
    v = vcap;
  }
  const da = (v * v) / (2 * A);
  const db = (v * v) / (2 * B);
  const dc = Math.max(0, d - da - db);
  const ta = v / A;
  const tc = dc / v;
  const tb = v / B;
  const tTotal = ta + tc + tb;
  return {
    d, v, A, B, da, db, dc, ta, tc, tb, T: tTotal,
    distanceAt(t) {
      if (t <= 0) return 0;
      if (t < ta) return 0.5 * A * t * t;
      if (t < ta + tc) return da + v * (t - ta);
      if (t < tTotal) {
        const r = tTotal - t;
        return d - 0.5 * B * r * r;
      }
      return d;
    },
    speedAt(t) {
      if (t <= 0) return 0;
      if (t < ta) return A * t;
      if (t < ta + tc) return v;
      if (t < tTotal) return Math.max(0, B * (tTotal - t));
      return 0;
    },
  };
}

function segProfile(line, pattern, i) {
  if (!pattern.segs) pattern.segs = new Array(pattern.stops.length - 1);
  let seg = pattern.segs[i];
  if (!seg) {
    const a = pattern.stops[i];
    const b = pattern.stops[i + 1];
    const d = Math.abs(b.s - a.s);
    const T = Math.max(1, b.a - a.d);
    seg = solveProfile(d, T);
    seg.sign = Math.sign(b.s - a.s) || 1;
    pattern.segs[i] = seg;
  }
  return seg;
}

// ---- a trip ---------------------------------------------------------------

export function tripState(line, trip, t) {
  const pattern = line.patterns[trip.p];
  const stops = pattern.stops;
  const n = stops.length;
  const rel = t - trip.s0;
  // GTFS direction_id is 0/1, but the renderer needs a signed chainage
  // direction (+1 increasing s, -1 decreasing s). Derive it from the stops so
  // the two conventions can never drift apart.
  const dir = Math.sign(stops[n - 1].s - stops[0].s) || 1;

  if (rel <= stops[0].d) {
    return {
      s: stops[0].s, v: 0, dir,
      phase: 'dwell', stopIdx: 0, nextIdx: 1, doors: 1,
      pattern, trip,
    };
  }
  for (let i = 0; i < n - 1; i++) {
    if (rel < stops[i + 1].a) {
      if (rel <= stops[i].d) {
        return {
          s: stops[i].s, v: 0, dir,
          phase: 'dwell', stopIdx: i, nextIdx: i + 1, doors: 1,
          pattern, trip,
        };
      }
      const seg = segProfile(line, pattern, i);
      const el = rel - stops[i].d;
      return {
        s: stops[i].s + seg.sign * seg.distanceAt(el),
        v: seg.speedAt(el),
        dir,
        phase: 'run',
        stopIdx: i,
        nextIdx: i + 1,
        doors: 0,
        seg,
        segElapsed: el,
        pattern,
        trip,
      };
    }
  }
  return {
    s: stops[n - 1].s, v: 0, dir,
    phase: 'dwell', stopIdx: n - 1, nextIdx: n - 1, doors: 1,
    pattern, trip,
  };
}

// ---- turnback manoeuvre ---------------------------------------------------

// u in 0..1 through the gap between two trips at a terminus.
function turnbackPose(u, baseS, prevDir, nextDir) {
  const OUT = 56;
  const from = baseS;
  const out = baseS + prevDir * OUT;
  const latA = -2.15 * prevDir;
  const latB = -2.15 * nextDir;
  const smooth = (x) => x * x * (3 - 2 * x);
  let s = from;
  let lateral = latA;
  let moving = false;
  if (u < 0.14) {
    s = from;
  } else if (u < 0.44) {
    const k = smooth((u - 0.14) / 0.30);
    s = from + (out - from) * k;
    moving = true;
  } else if (u < 0.62) {
    const k = smooth((u - 0.44) / 0.18);
    s = out;
    lateral = latA + (latB - latA) * k;
  } else if (u < 0.94) {
    const k = smooth((u - 0.62) / 0.32);
    s = out + (from - out) * k;
    moving = true;
  } else {
    s = from;
  }
  return { s, lateral, moving };
}

// ---- fleet ----------------------------------------------------------------

export class Fleet {
  constructor(network) {
    this.network = network;
    this.blocks = [];
    for (const line of network.lines) {
      for (const block of line.blocks) {
        const trips = block.trips
          .map((i) => line.trips[i])
          .sort((a, b) => a.s0 - b.s0);
        this.blocks.push({
          id: line.id + ':' + block.id,
          line,
          trips,
          // quick lookup: trips grouped by service class
          svcTrips: (() => {
            const m = new Map();
            for (const tr of trips) {
              if (!m.has(tr.svc)) m.set(tr.svc, []);
              m.get(tr.svc).push(tr);
            }
            return m;
          })(),
        });
      }
    }
    this._cacheKey = '';
    this._active = [];
  }

  /** Resolve one block at a given second-of-day and service class. */
  stateAt(block, t, svc) {
    const trips = block.svcTrips.get(svc);
    if (!trips || !trips.length) return null;
    // find the last trip that has started
    let idx = -1;
    for (let i = 0; i < trips.length; i++) {
      if (trips[i].s0 <= t) idx = i;
      else break;
    }
    if (idx < 0) return null;
    const trip = trips[idx];
    if (t <= trip.s1) {
      const st = tripState(block.line, trip, t);
      st.kind = 'trip';
      st.block = block;
      st.trip = trip;
      st.tripIndex = idx;
      st.scheduleDelta = 0;
      return st;
    }
    const next = trips[idx + 1];
    if (!next) return null;
    // turnaround: the set has arrived and will leave on the opposite track
    const gap = next.s0 - trip.s1;
    if (gap <= 0) return null;
    const last = tripState(block.line, trip, trip.s1);
    const baseS = last.s;
    const u = Math.min(1, (t - trip.s1) / Math.max(8, gap));
    const pose = turnbackPose(u, baseS, last.dir, -last.dir);
    const pattern = block.line.patterns[next.p];
    const nextStop = pattern.stops[0];
    return {
      s: pose.s,
      v: 0,
      dir: pose.moving ? last.dir : -last.dir,
      lateral: pose.lateral,
      phase: u < 0.62 ? 'arriving' : 'shunt',
      kind: 'turnback',
      doors: u < 0.45 ? 1 : 0,
      block,
      trip: next,
      prevTrip: trip,
      tripIndex: idx + 1,
      baseS,
      progress: u,
      nextStop,
      pattern,
      stopIdx: 0,
    };
  }

  /**
   * All trains in service at `t`. Optionally clipped to a radius (metres) from
   * a focus point, which is what keeps the renderer to a handful of sets.
   */
  snapshot(t, svc, { near = null, radius = 2200 } = {}) {
    const active = [];
    for (const block of this.blocks) {
      const st = this.stateAt(block, t, svc);
      if (!st) continue;
      if (near) {
        const p = block.line.getPoint(st.s);
        const dx = p.x - near.x;
        const dz = p.z - near.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius * radius) continue;
        st.distance = Math.sqrt(d2);
      }
      active.push(st);
    }
    this._active = active;
    return active;
  }

  /** Nearest active blocks to a local metric point, for the train picker. */
  nearest(network, epochSeconds, point, count = 8) {
    const svc = svcIndexFor(network, epochSeconds);
    const t = istParts(epochSeconds).sec;
    const list = this.snapshot(t, svc, { near: point, radius: 40000 });
    list.sort((a, b) => a.distance - b.distance);
    return list.slice(0, count);
  }
}
