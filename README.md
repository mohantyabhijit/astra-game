# Marina Getaway

A local Three.js driving game built on Midnight Run's arcade handling. Explore a daytime Singapore district around the **2026 Marina Bay Street Circuit: 19 turns, 4.927 km**. Collect gems, escape police in sheltered courtyards, and keep exploring. You start in the car; vehicle theft is deferred.

## Run locally

```sh
npm ci
npm run dev -- --port 5187 --strictPort
```

Open http://localhost:5187/. Requires Node 22.12+ and a WebGL 2 browser. All fonts, textures and game code are local; no API keys or backend are required. Source is maintained in the GitHub repository; use the local commands above for development.

## Play

| Key | Action |
| --- | --- |
| W / Up | Accelerate |
| S / Down | Brake, then reverse |
| A / D or Left / Right | Steer |
| Space | Handbrake |
| Shift | Nitro |
| C | Follow-camera height |
| M | Expand/collapse map |
| H | Start a police chase immediately |
| R | Recover to road, costs 250 points |
| Esc / P | Pause/resume |
| N | Mute/unmute |

Touch devices have driving buttons. Collected gems save in browser storage. Losing or restarting preserves them; restarting after winning begins a fresh collection.

Purple guidance follows roads to the nearest reachable uncollected gem. Each gem earns 500 points; every three trigger a pursuit and suspend collection. Amber guidance chooses the closest reachable cooldown courtyard **by road distance**. Enter through the P marker, park behind the opaque screen, and stay unseen for eight seconds. Moving, leaving the boundary, or being spotted resets cooldown. Clearing heat earns 1,500, restores 35 integrity, refills nitro, and resumes gem guidance. All 24 gems complete the hunt. Driving, close calls and circuit laps also earn points. Police pinning you for five seconds or losing all integrity ends the run.

Roads, garage entrances, elevation, physical barriers, route ribbons and minimap paths share world data. Police follow roads toward the last position they saw; buildings and garage walls block sight. Public streets have left-hand traffic, including buses and taxis.

## Verify

```sh
npm test
npm run test:route
npm run test:gameplay
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
npm run build
```

Alternatively install Playwright Chromium and omit `PLAYWRIGHT_CHANNEL`. Tests use isolated browser profiles and port 5187, avoiding other local games.

- Simulation tests cover route clearance/reachability, distance-based destinations, gems, pursuit, sight screens, successful/interrupted cooldown, collisions, handling, persistence validation and pause.
- The lap test uses ordinary driving inputs, traffic and damage, with a completed-collection profile to isolate circuit drivability. No teleporting, recovery or health restoration.
- The gameplay test starts fresh and drives through three gems, a real pursuit, garage cooldown and resumed collection. No mission-state edits, police removal or teleports.
- Browser tests cover keyboard collection/chase/map/pause, mobile touch input, daylight rendering and cooldown UI. The separate scenic/cooldown UI test uses explicit scenario setup; it is not the input-only gameplay proof.

Current reports and screenshots are under `artifacts/daylight-*`. Earlier Midnight Run screenshots/reports remain historical artifacts.

## Source

- `src/physics.js`: original arcade driving and vehicle collision core.
- `src/district.js`: road layout, bridge grades, landmarks, gems and garage/collider data.
- `src/collision-world.js`: spatial obstacle queries and collision/sight checks.
- `src/navigation.js`: road graph, shortest paths, stable destination selection and turn cues.
- `src/simulation.js`: traffic, pedestrians, police, progression, cooldown and scoring.
- `src/world.js`, `src/landmarks.js`, `src/vehicles.js`: daylight Three.js scene and cameras.
- `src/main.js`, `src/style.css`, `index.html`: controls, local persistence and responsive HUD.
- `src/audio.js`: synthesized engine, sirens and chimes.

## Environment assets

The supplied Meshy tree, groundcover and road models are preserved in `assets/source/`, with optimized runtime versions in `public/assets/models/`. See [asset provenance and processing](assets/README.md). Trees and grass sway in anchored vertex-shader wind; nearby foliage is instanced and distance-culled. The road module forms courtyard aprons, while the circuit retains continuous curved asphalt with fine aggregate surface relief. Rebuild models with `node scripts/prepare-models.js`.

## References and scope

See [reference notes](docs/REFERENCES.md) for official circuit verification, OSM attribution, user photographs and geographic approximations.

Higgsfield generated the original asphalt and pearl-paint textures, retained in this edition. Original PNGs are in `art/originals/`; optimized textures and exact generation provenance are in `public/assets/`. The original night façade/reference assets are preserved but the daylight towers use a procedural façade. Models are source-generated geometry, not imported photogrammetry.

The circuit is a recognizable game-scale interpretation, not a surveyed simulator. Auxiliary roads, courtyard layouts, bridge heights, lane widths and scenery are simplified. This is single-player arcade physics with simple pedestrian walking/vehicle avoidance, no suspension simulation, theft, multiplayer or accounts. Traffic uses lane-following and basic avoidance rather than traffic-light scheduling. Mobile browser emulation is covered; physical-phone performance has not been measured.

The existing GitHub workflow can publish on a future push to main; pushes run verification and the configured Pages publication workflow.
