# Singapore daylight reference notes

Checked 13 September 2026. Research used Exa MCP and direct official webpage/image inspection. TinyFish MCP was not available in the session.

## Consistent circuit edition

- [Formula 1: 2026 Singapore Grand Prix](https://www.formula1.com/en/racing/2026/singapore): 19 turns and 4.927 km.
- [Official 2026 circuit diagram](https://media.formula1.com/image/upload/c_fit,h_704/q_auto/v1740000001/common/f1/2026/track/2026tracksingaporedetailed.webp), inspected locally in `docs/reference/f1-singapore-2026.webp`.
- [OpenStreetMap relation 421263](https://www.openstreetmap.org/relation/421263): street-centreline geometry; © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright). Snapshot: `data/osm-relation-421263.json`. The derived `data/circuit-source.json` and route coordinates retain that attribution/license; MIT applies to application code, not third-party map data or photographs.

Existing user-owned route data was reused from the local Marina Bay project, then integrated into this game's own physics and renderer. The projected OSM centreline was scaled by less than 1% from 4,954.729 m to 4,927 m and checked against the official topology. North maps to negative world Z. This is approximate gameplay geometry, not an official racing line or surveying dataset.

## Architecture, geography and appearance

- [URA: Marina Bay](https://www.ura.gov.sg/place-management/placemaking/marina-bay/): waterfront/CBD context, greenery and the relationship of Marina Bay Sands and Esplanade to the bay.
- [Singapore Tourism Board photograph](https://photo.stb.gov.sg/media/57802b77-290d-4f6b-a767-30859e6f92c4): daytime bay/landmark reference.
- Five supplied images from `/Users/abhijitmohanty/Downloads/game/`: low track viewpoint with blue/yellow barriers, daylight street corner/towers, Esplanade/MBS street view, 19-turn circuit diagram, and a nighttime aerial used only for spatial relationships. Copies are under `public/references/`. These are reference material, not game textures, and are not claimed as original or licensed for public redistribution.

The Flyer has a large spoked observation wheel and capsules; MBS has three paired towers and an overhanging roof deck across the bay; Esplanade has twin spiked domes; Fullerton and a clustered CBD provide civic context. Pale glass, grey asphalt, concrete, rain trees, blue-green water, sky and haze follow the daytime references.

## Intentional simplifications

The circuit centreline/turn sequence is retained. Public access loops, pit lane details and cooldown courtyards are gameplay additions. The river/bay shoreline is a simplified polygon. Bridge grades are gentle three-metre visual/physics profiles, not measured elevations. Building footprints/heights and landmark silhouettes are approximate. Traffic travels both ways for exploration, including on the race circuit; this is not an active Formula 1 race simulation. No branding or photographic accuracy is claimed.
