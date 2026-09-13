# Marina Getaway — available features

This document describes the implemented game in this repository, including the daytime Marina Bay environment and supplied Meshy assets. It is a feature inventory, not a roadmap. Gameplay details were checked against the source code on 13 September 2026.

## 1. Game overview

Marina Getaway is a single-player 3D browser driving game built with Three.js. The player begins in a cream-colored car, collects gems around Marina Bay, escapes police in sheltered courtyards, and resumes collecting after clearing the heat.

| Feature | Current implementation |
| --- | --- |
| Setting | Daytime downtown Singapore around Marina Bay |
| Circuit | 2026 Marina Bay Street Circuit interpretation: 19 turns, approximately 4.927 km |
| Main objective | Collect all 24 gems |
| Police trigger | Every three newly collected gems; H can also start a chase during free roam |
| Escape method | Reach a cooldown area, break police sight, and remain parked in cover for eight seconds |
| Exploration | Continuous circuit, public access streets, service roads, pit lane and courtyards |
| Player vehicle | One car, already occupied when play begins |
| Session states | Ready, running, paused, won and lost |
| Gameplay phases | Free roam, pursuit and cooldown |
| Time limit | None; the HUD shows elapsed driving time |

The current gem-and-cooldown loop replaces the original Midnight Run five-checkpoint mission. Circuit progress is still tracked through sequential lap waypoints.

## 2. Driving and vehicle interaction

- Forward acceleration, braking and reverse driving.
- Smoothed steering, speed-sensitive turning and lateral grip.
- Handbrake turns with reduced grip and more sliding.
- Nitro acceleration, automatic recharge, a visible meter, exhaust flames and a wider camera field of view while boosting.
- Approximate forward speed caps of 133 km/h normally and 184 km/h with nitro; reverse is capped at approximately 43 km/h.
- Nitro capacity of 100 units, consumption of 27 units per second while active, and regeneration of 13 units per second otherwise. Boost requires forward input and some existing forward motion.
- Vehicle-to-vehicle collisions with separation and impact response. Buses use larger collision dimensions.
- Collisions against circuit barriers, buildings, garage walls, landmark bases and the pit building.
- Integrity starts at 100. Impacts reduce integrity; a short damage interval prevents continuous contact from applying damage every simulation step.
- Vehicle height follows the road surface, including the gentle bridge profiles.
- Manual recovery returns the car to a reachable road projection or its last safe road position, stops its motion, resets cooldown progress and costs up to 250 points. Recovery has a five-second reuse delay and does not clear police pursuit.
- Driving into water outside a road triggers an automatic rescue after approximately 0.7 seconds. Rescue applies the recovery score penalty and removes 12 integrity points.

Handling is arcade-based. There is no wheel-by-wheel suspension, manual gearbox or vehicle-selection screen. The HUD gear indicator is calculated from speed and direction.

## 3. Controls

| Input | Action |
| --- | --- |
| Start button / Enter when applicable | Start a run |
| W / Up arrow | Accelerate |
| S / Down arrow | Brake, then reverse |
| A / Left arrow | Steer left |
| D / Right arrow | Steer right |
| Space | Handbrake / drift |
| Shift | Nitro while accelerating |
| C | Switch between two follow-camera views |
| M / map button | Expand or collapse the minimap |
| H | Start a pursuit while running in free roam |
| R | Recover the car |
| Escape / P / pause button | Pause or resume |
| N / sound button | Mute or unmute |
| Help button | Open the controls and gameplay instructions |
| Restart button | Start a new run using the persistence rules below |

Touch devices receive on-screen left/right steering, gas, brake/reverse, drift and nitro buttons. Simultaneous touch inputs are supported. Driving input is released when the window loses focus or a touch is cancelled.

## 4. Gems and progression

- There are 24 individually tracked purple gems distributed around the circuit.
- Gems appear as rotating, bobbing 3D crystals with ground rings.
- Collection occurs within approximately 6.8 metres while gem collection is enabled.
- Each gem grants 500 points and restores 15 nitro units, capped at 100.
- Collecting three gems triggers an automatic police pursuit and resets the automatic-chase counter.
- Gem collection is suspended during pursuit and cooldown.
- Clearing heat restores collection and switches guidance back to an uncollected gem.
- Collecting the final gem ends the hunt with the **BAY COMPLETE** screen and a 3,000-point completion bonus.
- Full circuit laps are tracked separately and award points. They are not required to collect a particular gem.

## 5. Police pursuit

- Three police cars become active when a chase begins.
- They spawn behind the player's position along the circuit and use the same road network for pursuit routing.
- Police maintain a last-seen player position. When sight is broken, they travel toward that position rather than receiving the player's hidden location continuously.
- Detection checks distance and obstruction: the player must be within 135 metres with an unobstructed line of sight. Detection does not use a directional vision cone.
- Buildings and garage sight screens block detection. Low circuit barriers do not block police vision.
- Police periodically recompute road routes and can chase directly at close range when the connection is driveable.
- Pursuers slow for steering changes and stop near a last-seen position when they cannot see the player.
- Nominal pursuit speed increases from 26 m/s by 1 m/s per successful escape, up to 29 m/s; actual cornering speeds are lower.
- Police can collide with the player, traffic and solid scenery.
- Flashing red/blue lights, a proximity-sensitive siren and minimap markers identify active police.
- The HUD distinguishes police visual contact, broken sight and active cooldown. Its star symbols indicate these states; they are not a separate wanted-level progression system.

A player who remains visible, within 6.5 metres of a police car and below 2 m/s accumulates a capture timer. Five seconds accumulated under those conditions ends the run. The timer decays when those conditions are broken.

## 6. Cooldown areas

Three dedicated areas are available:

| Area | Environment |
| --- | --- |
| Flyer service courtyard | Sheltered service court |
| Civic sheltered parking | Covered parking area |
| Esplanade loading court | Loading/service courtyard |

Each has a connected service road, a deliberate opening in the circuit barriers, an entrance marker, a roof, walls, parking markings, an opaque sight screen and a visible cooldown boundary.

### Cooldown rules

1. Enter an area's defined boundary during a pursuit.
2. Break sight from every active police car. The player must have been unseen for more than 1.25 seconds before cooldown starts.
3. Remain parked in cover. The implementation allows a small movement tolerance: speed must remain below 2.5 m/s.
4. Accumulate eight seconds of uninterrupted cooldown.

Leaving the boundary, exceeding the parking-speed threshold or being spotted resets cooldown progress. Entering a garage alone does not guarantee escape; the player must actually be hidden.

Successful cooldown removes the active police, awards 1,500 points, restores 35 integrity points up to 100, refills nitro, and resumes gem collection. The HUD includes a progress bar, remaining seconds and instructions such as **HOLD POSITION** or **BREAK LINE OF SIGHT**.

## 7. Navigation and minimap

- Free-roam guidance selects the nearest reachable uncollected gem by road-route distance.
- Pursuit guidance selects the nearest reachable cooldown parking destination by road-route distance, including its access road and entrance route.
- The graph follows the circuit, public roads, pit lane and service connections, with road elevation included in edge lengths.
- Route connections are checked against solid obstacles and water. Navigation models static scenery; it does not plan around individual moving traffic vehicles.
- Guidance normally refreshes about every 0.65 seconds and is forced to update after key events such as collection, pursuit activation, escape and recovery.
- Destination retention reduces switching between nearly equal alternatives.
- Purple identifies gem routes; amber identifies escape routes.
- A road-following ribbon, directional arrows, destination name, route distance and advance turn cues guide the player.
- Cooldown markers identify the actual entrance as well as the parking area.
- The minimap uses the same route data as the world overlay.
- It displays nearby roads, water, player position and heading, uncollected gems, garage entrances and active police.
- The expanded map provides a wider district overview and garage labels.
- An edge marker indicates a destination outside the current map viewport.
- If no route can be found, guidance asks the player to return to an access road.

## 8. Score and failure conditions

| Event | Effect |
| --- | --- |
| Collect a gem | +500 points, +15 nitro |
| Clear a pursuit | +1,500 points, +35 integrity, full nitro |
| Complete a circuit lap | +2,000 points |
| Collect the final gem | Additional +3,000 points |
| Drive | +0.3 points per metre travelled |
| Qualifying close pass by traffic | +150 points |
| Recover the car | −250 points, with score floored at zero |
| Water rescue | Recovery penalty and −12 integrity |
| Collision | Integrity damage according to impact |

Close-pass rewards require speed above 19 m/s, a traffic separation between 3.8 and 5.8 metres and no active player hit cooldown. A traffic vehicle must move more than 35 metres away before it can grant another close-pass reward.

Runs end when integrity reaches zero, the police capture timer reaches five seconds, or the final gem is collected. Result screens show the outcome, final score, gem count and close calls, with a restart action.

## 9. Singapore environment

### Circuit and roads

- A continuous interpretation of the 2026 19-turn Marina Bay circuit, using OSM-derived centreline data checked against the official circuit diagram.
- Recognizable corners and straights, numbered turn signs, a start/finish gantry and checker markings.
- Blue/concrete track barriers, fence posts, road edges and lane markings.
- A pit lane and a two-level pit building with garage-bay details.
- Two gentle bridge elevation profiles.
- Raffles Avenue access and Civic District service-road connections.
- Service roads into all three cooldown areas, with corresponding visual and physical barrier openings.

### Landmarks and streetscape

- Singapore Flyer with a spoked wheel, capsules, axle and support structure.
- Marina Bay Sands with three paired towers and a projecting roof deck, rooftop greenery and pool detail.
- Esplanade with twin domes and triangular sunshade details.
- Fullerton-inspired civic architecture and a clustered downtown skyline.
- A simplified bay and river, waterfront promenade and railings.
- Tropical trees, planted verges, sheltered walkways, bus-stop shelters, pedestrian crossings and Singapore-style green direction signs.

### Traffic and pedestrians

- 28 ambient vehicles: 18 ordinary cars, six taxis and four buses.
- Six vehicles are assigned to the public access roads; the remaining vehicles circulate on the circuit.
- Left-hand lane placement and traffic travelling in both directions for exploration.
- Basic steering and avoidance of the player and active police.
- 40 pedestrians with walking animation, short back-and-forth routes and checks that pause movement near vehicles.

The district supports exploration, not a live Formula 1 race. Roads, buildings, shoreline and landmark dimensions are simplified for gameplay.

## 10. Visual appearance and supplied assets

- Bright tropical daylight, pale blue sky, scattered clouds and distance haze.
- Directional sunlight, natural shadows and restrained material reflections.
- Glass façades, light-colored buildings, concrete sidewalks and blue-green water.
- Asphalt color texture with procedural fine aggregate bump detail and high roughness.
- Textured lawn surfaces beneath separate 3D grass clumps.
- Supplied Meshy mature-tree and groundcover models, scaled and distributed through the district.
- Supplied straight road modules used as flush courtyard entrance aprons. The curved circuit retains its continuous road mesh.
- Approximately 210 tree placements and 1,990 grass-clump placements, rendered in nearby spatial batches.
- Wind bending and foliage flutter through vertex shaders. Roots stay anchored and tree shadows use matching deformation.
- Procedural trees remain available as a fallback if model loading fails.
- Earlier Higgsfield asphalt and pearl-paint textures remain in use; the previous night façade/reference assets are retained as source material.

### Asset organization

| Location | Contents |
| --- | --- |
| `assets/source/` | Three unique, unchanged user-supplied Meshy GLBs |
| `assets/manifest.json` | Source hashes, runtime paths and duplicate-groundcover record |
| `assets/README.md` | Asset provenance, uses and processing notes |
| `public/assets/models/` | Optimized runtime GLBs |
| `art/originals/` | Original Higgsfield-generated images |
| `public/assets/` | Runtime textures and generation provenance |
| `public/references/` | Supplied visual references |
| `data/` | Circuit source data and OSM snapshot |

Runtime models total approximately 1.5 MB compared with approximately 39 MB of unique source GLBs. Processing retains geometry and converts embedded images to 1024px WebP. The duplicate groundcover attachment is stored once. Asset authorship and third-party licensing are documented separately from the application code.

## 11. Camera, interface and audio

### Camera

- Smooth third-person follow camera with two selectable views.
- Steering-related vehicle lean and boost field-of-view change.
- A closer camera inside cooldown garages.
- Obstacle-aware camera shortening near opaque scenery.
- An introductory vehicle view before the run begins.

### Interface

- Title screen with briefing, start action and stored personal best.
- Current score and personal best.
- Gem count out of 24 and three-gem progress indicators.
- Current objective, destination, turn direction and distance.
- Elapsed driving time, current lap number and lap progress.
- Speed in km/h, calculated gear indicator and tachometer-style bars.
- Nitro and integrity meters, including a low-integrity warning state.
- Police sight status and cooldown progress.
- Event notifications for gems, collisions, close calls, recovery, pursuit, escape and completed laps.
- Pause, resume, restart, controls/help and sound controls.
- Responsive desktop and mobile layouts.
- Keyboard focus indicators, named controls and modal focus trapping.
- Automatic gameplay pause on window blur or when the tab becomes hidden. Opening help pauses a running game and closing it resumes that game.
- A graphics-error screen with a reload action for initialization/context-loss problems.

### Audio

- Locally synthesized engine audio whose pitch responds to speed.
- A police siren whose volume responds to proximity.
- Reward chimes for gems, close calls and clearing heat.
- Mute/unmute controls. Audio initializes following user interaction and does not require external sound files.

## 12. Saving and restarting

- Collected gem identifiers are saved to browser local storage when collection events are processed.
- A saved personal best is updated when a run ends with a higher score.
- Losing, reloading or restarting an unfinished hunt retains saved gems.
- Restarting directly from the win screen clears the collection and starts a fresh hunt.
- New runs reset the car, score, integrity, nitro, chase state, automatic-chase counter and lap state.
- Saved identifiers are validated and duplicates removed when loaded.
- Storage failures are tolerated so the game can still run without persistence.

This is not a complete session save: vehicle position, active pursuits, elapsed time and current-run score are not restored. There is no account, cloud sync or separate in-game saved-gem reset button. Reloading a fully collected profile allows free driving; clearing that profile outside the win-screen restart requires clearing its browser storage.

## 13. Runtime and developer facilities

- Three.js rendering and Vite development/build tooling.
- A fixed 120 Hz browser simulation loop, separated from rendering.
- Static mesh batching, instanced vegetation, spatial obstacle queries, distance culling and bounded traffic/pedestrian populations.
- A capped rendering pixel ratio to limit high-density display cost.
- Local fonts, textures and models; no gameplay backend or runtime AI-service API is required.
- Static production output suitable for hosting with GitHub Pages.
- A GitHub workflow that runs simulation, lap, gameplay and browser checks, builds the project and deploys through Pages on pushes to `main` or manual dispatch.
- Development-only `window.__gameTest` access for inspecting state/world and preparing deterministic test scenarios. This interface is excluded from production builds.

### Commands

```sh
npm ci
npm run dev -- --port 5187 --strictPort
npm run build
npm run preview
npm test
npm run test:route
npm run test:gameplay
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
npm run assets
npm run assets:models
```

The local development address is [http://localhost:5187/](http://localhost:5187/). Node.js 22.12 or newer and a browser with WebGL 2 are required. Browser tests can use installed Chrome or a separately installed Playwright Chromium build.

## 14. Verification coverage and current limits

The repository includes 14 simulation tests, a full-lap input driver, a complete gem/pursuit/cooldown input driver and four browser cases. Coverage includes navigation clearance, destination selection, collection, police sight and movement, cooldown success/interruption, collisions, driving, persistence validation, victory, keyboard/touch interaction, model loading and wind updates.

The lap driver uses a completed-collection profile to isolate circuit drivability. The gameplay driver begins fresh and drives through three gems, a pursuit, garage cooldown and resumed collection. Separate browser scenic/cooldown checks prepare explicit scenarios. The final gem is tested directly; a continuous 24-gem hunt has not been driven end to end. Historical results and screenshots are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).

Not currently implemented:

- Car theft, entering/exiting vehicles or an on-foot player mode.
- Vehicle selection, upgrades, customization or realistic suspension.
- Multiplayer, accounts, cloud saves or an online leaderboard.
- Weapons, combat or pedestrian missions.
- Traffic-light scheduling or a full traffic simulation.
- Dynamic weather, rain or a day/night cycle. Wind is decorative and does not affect handling.
- Survey-accurate geography, official race simulation or full building interiors.
- A guarantee that every decorative object has a collider; trees and grass are visual scenery.

Mobile interaction has browser-emulation coverage, but physical-phone performance has not been measured. Dense vegetation can slow software WebGL. Rendering statistics are not a hardware frame-rate guarantee. Scene wind and decorative animation can continue while gameplay is paused.

## 15. Implementation references

| File | Responsibility |
| --- | --- |
| [src/physics.js](src/physics.js) | Driving grip, acceleration, steering and collision primitives |
| [src/simulation.js](src/simulation.js) | Gameplay, police, traffic, pedestrians, recovery, scoring and laps |
| [src/district.js](src/district.js) | Roads, gems, courtyards, landmark locations and obstacle data |
| [src/collision-world.js](src/collision-world.js) | Obstacle queries, collision response and visibility checks |
| [src/navigation.js](src/navigation.js) | Road graph, shortest paths, destination stability and turn cues |
| [src/world.js](src/world.js) | Scene construction, cameras and frame rendering |
| [src/environment-assets.js](src/environment-assets.js) | Meshy integration, grass/asphalt surfaces, wind and vegetation culling |
| [src/landmarks.js](src/landmarks.js) | Recognizable Singapore landmark geometry |
| [src/vehicles.js](src/vehicles.js) | Vehicle visuals, lights and boost effects |
| [src/main.js](src/main.js) | Input, HUD, minimap, persistence and browser lifecycle |
| [src/audio.js](src/audio.js) | Engine, siren and reward sounds |
| [index.html](index.html) / [src/style.css](src/style.css) | Interface structure and responsive styling |
| [assets/README.md](assets/README.md) | Supplied model provenance and processing |
| [docs/REFERENCES.md](docs/REFERENCES.md) | Circuit edition, visual references, OSM attribution and geographic simplifications |
