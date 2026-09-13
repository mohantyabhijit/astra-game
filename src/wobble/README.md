# Wobble Heads integration

`original/characters.js`, `original/motion.js`, `original/vehicles.js`, and `original/performance.js` are copied from the sibling `wobble-heads/prototype/js/` repository. They preserve the original character IK, damped head motion, door/boarding timeline, articulated vehicle models, and static mesh batching. The original files remain separate from the integration adapter in `models.js`.

The game retains the Marina Bay simulation's -Z forward convention. The adapter converts the Wobble Heads models' +Z forward convention using `Math.PI - heading`. Vehicle seats, footwells, handles, and door anchors come from the original models.

## Character sources

These are the same model sources loaded by `wobble-heads/prototype/js/app.js`, vendored unchanged so the integrated game works without a runtime CDN request:

- `public/assets/characters/kai.glb`: Three.js r170 `examples/models/gltf/readyplayer.me.glb`. Embedded copyright: Ready Player Me.
- `public/assets/characters/rae.glb`: Three.js r170 `examples/models/gltf/Michelle.glb`.

Source URLs and SHA-256 checksums are retained in `public/assets/provenance.json`. Kai and Rae are game display names, not claims of authorship. Vendoring these files does not change their upstream rights or licensing. The project's MIT license does not replace third-party asset terms.

The optional downloaded human candidates from Wobble Heads use different native skeletons; they were not substituted for its existing selectable character rigs.

## Runtime behavior

Character previews and world actors share cached local model templates, clone independent skeletons, and use the original head spring and posing code. Preview dancing is a procedural dance pose over those rigs. A detached head is baked from the current head/neck-weighted mesh vertices with original UVs/materials, then simulated as visible debris. Vehicle doors and seated poses use the original boarding timeline.
