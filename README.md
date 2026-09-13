# Wobble City

**Play on desktop:** [Wobble City](https://wobble-city.vercel.app)

A desktop-only, single-player 3D game set around Singapore’s Marina Bay. Choose a wobblehead character, explore the waterfront, get into cars, collect gems and escape the police.

Built with Three.js and Vite, combining the `astra-game` city and simulation with the characters, vehicles, animation and landmark assets from [Wobble Heads](https://github.com/ss-pratapIIITB/wobble-heads). Runs in the browser without a backend, API keys or runtime asset CDN.

![Wobble City with rear-view mirror](artifacts/rear-view-mirror.png)

## Play

Use a desktop or laptop with a keyboard and a WebGL 2 browser. Phones and tablets display a desktop-required message and do not load the game assets.

1. Choose **Kai** or **Rae** from the animated character selection.
2. Watch the camera circle the Merlion and settle behind your character.
3. Explore on foot or press **E** near a usable car. Your character walks around it, opens the driver’s door and gets in.
4. Visit **M** when you want to begin the optional 24-gem driving mission.
5. Hitting civilians or walking officers alerts the police. Follow the route to cover and stay parked and unseen for **5 seconds** to clear the pursuit.

Free exploration starts immediately; the gem mission is optional. Collected gems survive pursuits and respawns, and exploration continues after mission completion.

## Controls

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | Walk forward/backward; accelerate/brake/reverse in a car |
| A / D or ← / → | Turn or steer |
| Shift | Run on foot; boost while driving |
| E | Enter a nearby usable car; exit after slowing down |
| F | Punch on foot |
| Space | Jump on foot / handbrake while driving |
| C | Switch camera |
| M | Expand/collapse the map |
| R | Recover the car to a safe road position |
| Esc / P | Pause/resume |
| N | Mute/unmute |

## Current game scope

- **Downtown Marina Bay:** a bounded 1.83 × 1.57 km district with connected roads, bridges and Bayfront Drive. The road network uses a game-scale interpretation of the 2026 Marina Bay circuit.
- **Landmarks:** imported Merlion and Marina Bay Sands, plus Esplanade, Fullerton and Singapore Flyer. Architectural geometry is a game interpretation, not a surveyed replica; building interiors are not playable.
- **Characters and city life:** two selectable characters, civilian pedestrians with persistent identities and varied clothing, walking police patrols and ambient traffic.
- **Vehicles:** 15 usable Jeeps, Minis and sports cars, articulated doors and natural boarding. Driving includes speed-sensitive steering, braking, reverse, handbrake and boost, with a 150 km/h cap.
- **Chases:** marked police sports cars with flashing lights and sirens. Police track you outside cooldown areas; five uninterrupted seconds parked and unseen inside cover clear the heat.
- **Consequences:** vehicle impacts knock people down with blood and recovery animations. Officers can shoot and engage at close range. Three distinct police-car impacts lead to an encounter, explosion, flying wobblehead and respawn near Merlion; fatal gunfire also causes respawn.
- **One optional mission:** board the designated mission sports car and follow directions through 24 gems.
- **HUD and cameras:** persistent minimap with **M** for the mission and **P** for the police station, route guidance, heat and impact status, cooldown countdown, close chase camera and a live rear-view mirror on the right.
- **Environment:** four imported tree packs with 20 variants, instanced planting and animated wind. A loading cover keeps scene assembly hidden.

This is a playable browser prototype. Multiplayer, a larger mission campaign, interiors, an economy and player-controlled shooting are outside the current scope. Physics and police behavior are arcade approximations.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev -- --port 5187 --strictPort
```

Open [localhost:5187](http://localhost:5187/).

```sh
npm run build
npm run preview
```

The production build is written to `dist/`.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

On macOS with Chrome installed, use `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. Simulation tests cover boarding, driving, pursuit, cooldown, collisions, melee, officer gunfire, recovery and world boundaries. Browser tests cover assets, selection, desktop interactions, loading, cinematic introduction and the mobile-device gate.

Longer input-driven scenarios are available through `npm run test:route`, `npm run test:gameplay` and `npm run test:cooldown`. These are development playtests, separate from the core test suite. Browser fixtures sometimes position actors directly to reproduce interactions; passing them is not a claim that every possible chase or route has been tested.

## Deployment

Vercel builds the project as a Vite application using `npm run build` and serves `dist/`; configuration is in `vercel.json`. No environment variables are required. GitHub Actions runs automated verification. Production publication is separate from local test results.

```sh
vercel --prod
```

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/desktop.js`, `src/main.js`, `src/style.css` | Desktop gate, input, selection and HUD |
| `src/simulation.js`, `src/physics.js`, `src/collision-world.js` | Game states, driving and collision simulation |
| `src/boarding.js`, `src/melee.js`, `src/police-*.js` | Boarding, combat and officers |
| `src/district.js`, `src/navigation.js` | Map, roads, world bounds and guidance |
| `src/world.js`, `src/landmarks.js`, `src/city-details.js` | Scene, cameras and landmarks |
| `src/environment-assets.js`, `src/rear-view.js` | Planting, wind and mirror rendering |
| `src/wobble/` | Imported Wobbleheads modules and game adapters |
| `public/assets/` | Local models, textures, metadata and source credits |
| `tests/` | Simulation tests and browser/input-driven playtests |

## Asset credits and history

Game code uses the repository’s MIT license. Third-party assets retain their own terms; the code license does not replace their licenses.

- [Wobbleheads integration and character provenance](src/wobble/README.md).
- [Merlion credits](public/assets/merlion/CREDITS.md): Singapore Merlion ReSculpt by cymon, based on keeganTeo’s model, CC BY 4.0.
- [Marina Bay Sands credits](public/assets/marina-bay-sands/CREDITS.md): original Wobbleheads game geometry, imported from `94be054`.
- [Tree credits](public/assets/environment/CREDITS.md): Quaternius packs under CC0, imported from `7864e62`.
- [Original environment asset sources](assets/README.md), [asset provenance](public/assets/provenance.json) and [map references](docs/REFERENCES.md).

Historical files and screenshots in `artifacts/`, `docs/INTEGRATION-VERIFICATION.md` and `marina.md` may describe earlier versions. This README describes the current intended scope; fresh test output and the deployed build establish the current release state.
