# Marina Getaway integration verification

Verified locally on 13 September 2026. Start with `npm run dev -- --port 5187 --strictPort`.

## Current behavior

- Kai and Rae use the imported character rigs and dance in selection.
- Play starts on foot near the Merlion waterfront plaza with a Jeep nearby. The connected public access road leads into the existing Marina Bay district.
- Free exploration has no automatic race or active gem mission. M marks the optional mission car and P marks the police station. Route overlays appear during a mission or pursuit.
- Moving vehicle/pedestrian collisions trigger pursuit. Three distinct police impacts cause the explosion, detached real character head, and respawn at Merlion Park.
- Cooldown requires five seconds parked and unseen in cover, shown as a numeric countdown and progress bar. Movement or detection resets progress.
- Entering the designated sports car starts the 24-gem mission. Collected progress survives pursuit and respawn.

## Evidence

- `npm test`: 19 passing simulation tests, including spawn, mission activation, five-second cooldown, collision separation, and respawn.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`: six passing browser tests for desktop interaction, mission/countdown, mobile layout/touch movement, local assets, and explosion/respawn.
- `npm run test:gameplay`: walks the connected roads from Merlion Park to the optional mission, boards using interaction, then collects all 24 gems through normal simulation inputs.
- `npm run test:cooldown`: all three courtyards pass with live police. Each test establishes its initial scene outside a courtyard; after the pedestrian collision starts pursuit, it uses movement inputs without changing chase state.
- `npm run build` and `git diff --check`: pass. Vite reports a bundle-size advisory.

Browser fixtures isolate mission and impact events to verify rendering and controls; they complement the longer simulation runs. Mobile coverage uses a browser viewport and touch emulation, not a physical phone. Screenshots and JSON reports are in `artifacts/integrated-*`. Older artifacts describe earlier versions.

## Pursuit, population, and fleet update

Police now track the current player position outside cooldown areas, rather than stopping at a stale last-seen position. Their visuals use the imported sports car with police markings, hard roof, and alternating red/blue light bar. Twelve additional parked cars bring the enterable fleet to fifteen. The nearby population is maintained in both travel modes by relocating only distant NPCs, retaining IDs and appearance. Regression tests cover each change.

## Downtown and Wobbleheads refresh

- Imported Merlion sculpt and latest action/hand poses from Wobbleheads `9afd4d2`.
- Added dark-blue Kai suit and a 6.5-second Merlion orbit that ends behind the player.
- Removed floating place/race boards, detailed MBS and Esplanade, added Bayfront Drive and bounded the downtown play area.
- Imported four unchanged Quaternius tree packs from `7864e62`: all 20 variants, 418 tree placements, complete trunk/canopy primitives, instanced wind and distance culling. File hashes match the upstream catalog.
- Latest simulation pass: 22 tests; the additional downtown boundary test passed separately. Production build and diff whitespace checks passed.
- Browser mission/cooldown, mobile walking and explosion checks passed during the refresh. Full-suite runs were interrupted by concurrent source edits and reloads; those runs do not constitute a clean full-suite pass.
- Final focused tree/browser test passed cleanly: 418 trees, 20 variants, all four packs loaded, wind animated, boarding/driving worked, no browser errors; approximately 60 FPS in local Chrome.
