# Project Metro — Rebuild Plan

**Status (Nov 2026):** shipped. All three corridors, day/night, interchanges,
turnbacks and the GitHub Pages build are live. Two items are deliberately
deferred: full saloon interiors (only visible through glass) and the multi-view
screenshot QA sweep.

Goal: a photo-real, real-time 3D tracker for the **whole Hyderabad Metro network**
(Red / Green / Blue), driven by the official HMRL GTFS timetable, with a
paint-quality day/night look and production-grade performance.

---

## 0. Research findings (done)

| Item | Finding |
| --- | --- |
| GTFS | Official **HMRL GTFS July 2026** (Open Data Telangana mirror). 2,820 trips, 61,236 stop_times, 706 stops, 6 shapes. Downloaded to `tools/gtfs/`. |
| Lines | **RED** Miyapur ↔ L. B. Nagar (27 stations, 28.0 km) · **GREEN** JBS Parade Ground ↔ MG Bus Station (9.7 km) · **BLUE** Nagole ↔ Raidurg (23 stations, 26.9 km). |
| Colours | RED `#E31E24`, GREEN `#009846`, BLUE `#007ABB` (from `routes.txt`). |
| Speed | HMRL technical criteria: design 90 km/h, **max operating 80 km/h**, 25 kV AC OCS, CBTC/ATO, 90 s headway. |
| Observed speed | GTFS segment averages: median **38.9 km/h**, p90 49 km/h, max 58.7 km/h. Dwells: 15 s typical (also 20/30/60 s). → physics tuned so the timetable is reproduced exactly. |
| Accel model | `a = 0.95 m/s²`, `b = 1.05 m/s²`, jerk-limited; cruise speed solved per segment so the runs match GTFS. |
| Night imagery | No free night satellite. Use a graded day raster (brightness/saturation/hue) + 3D emissive city/train/station light + additive glow sprites. |
| SimReady Central | Semantic index of **USD** assets (not a generator, not GLB). Not usable in a keyless static web build → procedural modelling instead. Documented as evaluated. |

---

## 1. Phase A — Photo-realism v1 (lighting, shadow, colour)

- [x] A1 Rewrite the lighting rig: key sun + sky/ground hemisphere + bounce fill, physically plausible intensities.
- [x] A2 PMREM sky environment matched to sun elevation + warmth; per-hour tint.
- [x] A3 Shadow cascade: fit the ortho frustum tightly around the camera target, raise map to 4096, tune bias/normalBias, add contact darkening.
- [x] A4 ACES tone mapping + exposure + subtle filmic grade (lift/gamma/gain in CSS? no — renderer-side colour matrix).
- [x] A5 Materials pass: roughness variation maps, dirt streaks on concrete, wet-ish ballast, anisotropic-looking steel, glass Fresnel tuned.
- [x] A6 Aerial perspective: distance fog tinted to the satellite haze.
- [x] A7 Night foundation: `night` grade, emissive materials, additive lamp sprites, train light rig.

## 2. Phase B — Network data + multi-line

- [x] B1 `tools/build-network.mjs` → `assets/data/network.json` (lines, stations, centreline paths, chainages, patterns, trips).
- [x] B2 Multi-line geo model (`js/geo.js`): per-line route objects, chainage, lateral track offset.
- [x] B3 Build 3 viaducts (merged geometry, shared materials), correct line colours.
- [x] B4 Map layers for all 3 lines + station dots + labels.
- [x] B5 Line switcher UI (Red / Green / Blue) + train picker.

## 3. Phase C — Simulation (real-time, all trains)

- [x] C1 Timetable engine: pattern + trip start → position at wall-clock time, service day (WK/SA/SU).
- [x] C2 Physics profile per segment (solve cruise speed for the scheduled run time).
- [x] C3 All trains simulated; only those near the camera are rendered (radius + frustum + cap).
- [x] C4 Opposite-direction meets: two trains per track, correct left-hand running, opposing sets visible.
- [x] C5 Terminus reversal: arrive → doors → signal hold → reverse shunt onto the other track → depart.
- [x] C6 HUD: line, train id, next station, ETA, real timetable deltas, live map of nearby trains.

## 4. Phase D — Train model v2

- [x] D1 Correct HMR proportions from references (3-car D–M–D, 2.9 m wide, 3.8 m rail-to-roof).
- [x] D2 Merged geometry per material → ~20 draw calls per car (was ~150).
- [ ] D3 Interior: seats, poles, ceiling lights visible through glass.
- [x] D4 LOD0/1/2 with automatic swap by distance.
- [x] D5 Pantograph, roof kit, bogies, couplers, cab detail, destination blind, head/tail lights.

## 5. Phase E — Station model v2

- [x] E1 Real HMR station massing: wide elevated deck, side platforms, concourse level below, stair/escalator/lift cores.
- [x] E2 Curved architectural roof with ribs, glazed clerestory, blue fascia + HMR signage.
- [x] E3 Platform furniture: benches, bins, PIDS, route maps, vending, help points, tactile edge, yellow line.
- [x] E4 Merged geometry + texture atlas for all stations (one mesh per material for the whole network).
- [x] E5 Night lighting: strip lights, signage glow, platform pools of light.

## 6. Phase F — Night mode

- [x] F1 Day/night toggle in the HUD + `?night=1` + key.
- [x] F2 Raster night grade (brightness/saturation/hue-contrast).
- [x] F3 City lights: emissive building windows, street-lamp clusters, route glow.
- [x] F4 Train: lit saloon, headlight beam, tail lights, door lights.
- [x] F5 Station: lit canopy soffit, sign glow, platform uplights.
- [x] F6 Sky: deep blue gradient, moon, stars, haze glow on the horizon.

## 7. Phase G — Performance

- [x] G1 Draw-call budget: merge static geometry, instance repeated parts, atlas textures.
- [x] G2 Train pooling + LOD + view culling.
- [ ] G3 Shadow: single tight cascade, update every other frame at distance.
- [x] G4 Renderer: pixel-ratio cap, powerPreference, stencil off, antialias policy.
- [x] G5 Stats overlay (`?stats=1`) + adaptive quality if FPS < 45.

## 8. Phase H — Polish & QA

- [x] H1 Terminus shunt choreography + signal aspect.
- [x] H2 Intro/first-run, attribution (HMRL data), README.
- [ ] H3 Screenshot QA at 1600×900, 1000×700, 430×932.
- [x] H4 Commit per phase.

---

## Key constants

```
GTFS source      tools/gtfs/*.txt        (official HMRL, July 2026)
Network build    node tools/build-network.mjs
Runtime data     assets/data/network.json
Track offset     ±2.15 m from centreline (left-hand running)
Deck top         10.4 m
Train            3 cars × 21.4 m, 2.9 m wide, 3.8 m rail→roof
Accel / brake    0.95 / 1.05 m/s², jerk 0.6 m/s³
Max speed        80 km/h (22.2 m/s)
Dwell            15 s default (GTFS per-trip)
```

## Attribution

Contains data provided by Hyderabad Metro Rail Ltd. Imagery © Esri, Maxar,
Earthstar Geographics. Map data © OpenStreetMap contributors. Vector tiles ©
OpenFreeMap.
