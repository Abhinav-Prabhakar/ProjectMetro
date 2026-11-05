# Metro Live

### A real-time 3D tracker for the entire Hyderabad Metro network.

<p>
<a href="https://abhinav-prabhakar.github.io/ProjectMetro/"><img alt="Live demo" src="https://img.shields.io/badge/LIVE-OPEN_THE_TRACKER-0aa06a?style=flat-square&logo=googlechrome&logoColor=white"></a>
<img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2022-f7df1e?style=flat-square&logo=javascript&logoColor=111">
<img alt="Three.js" src="https://img.shields.io/badge/Three.js-r170-000000?style=flat-square&logo=three.js&logoColor=fff">
<img alt="MapLibre" src="https://img.shields.io/badge/MapLibre_GL-4.7-396cb2?style=flat-square&logo=maplibre&logoColor=fff">
<img alt="GTFS" src="https://img.shields.io/badge/GTFS-HMRL_2026-0a7d43?style=flat-square">
<img alt="No API keys" src="https://img.shields.io/badge/API_keys-none-2ea44f?style=flat-square">
<img alt="License" src="https://img.shields.io/badge/license-MIT-8b5cf6?style=flat-square">
</p>

**Red · Green · Blue — 64.6 km, 57 stations, 162 train sets**, all driven by the
official HMRL timetable. Every set in service is simulated; the camera rides one
of them along a photo-real elevated viaduct, over live satellite imagery, with a
city that switches on when the sun goes down.

<br>

*Between Stadium and NGRI — the Blue Line, live.*

![Between Stadium and NGRI](assets/readme/stadium.gif)

<br>

## Day / night

| Golden hour | After dark |
| --- | --- |
| ![Day chase](assets/readme/hero-day.jpg) | ![Night chase](assets/readme/hero-night.jpg) |

The whole scene relights: warm sodium street-light bloom across the city grid,
lit train windows, illuminated canopies, headlights, and a sky that changes with
the time mode.

## Stations & interchanges

| Station, night | Ameerpet interchange |
| --- | --- |
| ![Station at night](assets/readme/station-night.jpg) | ![Ameerpet at night](assets/readme/interchange-night.jpg) |

Interchanges are modelled as one complex: the upper corridor's hall, the lower
corridor's hall and the glazed concourse that joins them.

![Ameerpet by day](assets/readme/interchange-day.jpg)

## What's actually going on

- **Real timetable.** The official HMRL GTFS feed is compiled into a network
  graph — 2,820 trips, 61,236 stop times, 706 stops, 6 shapes. A service-day
  clock runs on IST, so what you see matches the published schedule.
- **Real physics.** Trains accelerate at `0.95 m/s²`, brake at `1.05 m/s²`, and
  cruise at up to 80 km/h. Each segment's cruise speed is solved so the arrival
  time matches GTFS exactly.
- **Real turnbacks.** A set that reaches a terminus waits, reverses and moves
  onto the opposite track before its next trip — consecutive trips in the feed
  are linked into blocks, which is what a train set actually does all day.
- **Only what you can see.** Every train is simulated, but only the sets near the
  camera are drawn — the followed one in full detail, the rest as light proxies.
- **Data-driven.** Nothing about Hyderabad is hard-coded in the renderer. Point
  the compiler at another GTFS feed and the same engine draws that city.

## Run it

Static site — no build step, no keys, no paid tiles.

```bash
python3 -m http.server 4399
open http://localhost:4399/index.html
```

A local server is required (ES modules and the compiled network are fetched over
HTTP; `file://` will not work).

Rebuild the network from a GTFS feed:

```bash
node tools/build-network.mjs     # writes assets/data/network.json
```

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit |
| Wheel / pinch | Zoom |
| Double-click | Recentre the chase camera |
| `Space` | Pause / resume |
| `1` `2` `3` | 0.5× / 1× / 4× speed |
| `N` | Day / night |
| `L` | Cycle lines |
| `B` | Toggle 3D buildings |
| `R` | Recentre |
| `H` | Hide HUD |
| `I` | About |

## Under the hood

```
tools/build-network.mjs   GTFS  →  assets/data/network.json
js/network.js             projection, resampling, chainage, interchange levels
js/sim.js                 service day, trip solver, blocks, turnbacks, fleet
js/infrastructure.js      U-girder viaduct, track slabs, piers, OCS masts
js/station.js             canopy halls, platforms, signage, night lighting
js/train.js               procedural 3-car set, livery, doors, cabs, lighting
js/world.js               MapLibre ⇄ Three bridge, sky, night city layers
js/main.js                camera, placement, culling, HUD, controls
```

MapLibre renders the satellite raster and the OSM street graph; the metro lives
in a Three.js custom layer sharing MapLibre's WebGL context. Geometry is authored
in a local metric frame (x east, y up, z north) and the Mercator transform is
folded into the projection matrix, so a single draw call places the whole network
anywhere on the planet without losing float precision.

## Data & credits

- Timetable and station data: **Hyderabad Metro Rail Ltd** via
  [Open Data Telangana](https://data.telangana.gov.in/) (GTFS, 2026).
- Imagery: **Esri World Imagery** via the public ArcGIS tile service.
- Streets and buildings: **OpenStreetMap** contributors, vector tiles by
  **OpenFreeMap**.
- Rendering: **Three.js**, **MapLibre GL JS**.

Not affiliated with HMRL. Built as a visualisation of public timetable data.

## License

MIT
