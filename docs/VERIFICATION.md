# Local verification — 13 September 2026

Final local edition; no push or deployment.

| Check | Result |
| --- | --- |
| `npm test` | 14 / 14 passed |
| `npm run test:route` | Full circuit lap passed in 430.35 simulated seconds, 85.29 integrity, two collisions |
| `npm run test:gameplay` | Fresh hunt: three gems → police pursuit → garage cooldown → heat clear → fourth gem; passed in 72.08 simulated seconds |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` | Three tests passed: desktop keyboard/HUD/map/pause, mobile touch, landmark/cooldown UI |
| `npm run build` | Passed; standard large-chunk advisory for the bundled Three.js application |
| `git diff --check` | Passed |

Input-only simulation playtests use the production driving/police/collision code at 60 Hz. The browser runs the fixed 120 Hz loop. The lap uses an already-collected profile to isolate the full circuit, with traffic/damage enabled. The fresh gameplay loop keeps all police and traffic active; neither test teleports, restores health, invokes recovery or edits mission state during play. Cooldown ran from 50.73 to 58.73 simulated seconds before collection resumed.

The browser's scenic/cooldown UI test explicitly prepares a scene, independently of the input-only gameplay test. Desktop and 390×844 mobile screenshots were inspected. The sampled driving scene rendered about 150 draw calls / 266k triangles. This is not a hardware frame-rate benchmark; browser automation used software WebGL, and a physical phone was not tested.

All road graph edges and paths from spawn to all 24 gems and three garage parking spots were checked against solid barriers, buildings and water. Regression fixes include tight-corner fence overlap, car-to-car separation pushing through fences, routing away from a touched wall, pedestrian lane changes on reversal, map rendering during a destination transition, and route-arrow orientation.

Evidence: `artifacts/daylight-lap.json`, `artifacts/daylight-gameplay-loop.json`, and the `artifacts/daylight-*.png` screenshots. The complete 24-gem victory is covered as a focused final-gem scenario; an uninterrupted 24-gem hunt was not driven end to end.

## Meshy environment update

The subsequent user request authorized a GitHub push. Three unique supplied GLBs were preserved in `assets/source/` and optimized to about 1.5 MB total for runtime. Duplicate groundcover content is recorded in `assets/manifest.json`.

After integration, 14 simulation tests and the production build passed. All four browser cases passed: the new model loading/wind/driving case, desktop gameplay, mobile touch, and the cooldown UI case. The cooldown case needed a longer software-WebGL timeout and a 960×600 viewport; its eight-second gameplay timer was unchanged. Distant grass batches were tightened to reduce unnecessary geometry. Roots remain anchored and tree shadows receive the same wind deformation.

The asset scene contains 210 trees and 1,990 grass clumps across the district, with only nearby spatial batches rendered. An initial view sampled approximately 160 draw calls and 515k triangles. Screenshots: `artifacts/natural-driving.png`, `artifacts/natural-wind-a.png`, `artifacts/natural-wind-b.png`, and `artifacts/model-previews/models.png`. These are software-renderer checks, not a claim of measured physical-device frame rate.
