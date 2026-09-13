# Environment assets

User-supplied Meshy GLBs, imported 13 September 2026. Original files are retained unchanged in `source/`; the duplicate groundcover attachment has identical SHA-256 content and is stored once.

| Original attachment | Source file | Runtime asset | Use |
| --- | --- | --- | --- |
| Meshy_AI_A_single_straight_mod_0913043055_texture.glb | source/road.glb | ../public/assets/models/road.glb | Flush courtyard entrance road/apron modules |
| Meshy_AI_One_realistic_mature__0913043032_texture.glb | source/tree.glb | ../public/assets/models/tree.glb | Mature roadside trees with anchored wind bending and leaf flutter |
| Meshy_AI_One_small_low_growing_0913042919_texture.glb | source/groundcover.glb | ../public/assets/models/groundcover.glb | Natural roadside grass clumps with wind |

`node scripts/prepare-models.js` rebuilds runtime GLBs. It preserves geometry and converts the embedded image buffers to 1024px WebP using the glTF EXT_texture_webp extension. Three unique originals total approximately 39 MB; runtime models total approximately 1.5 MB. The user supplied these assets; this repository does not claim their authorship or change their underlying license.

Curved circuit geometry and collision data are retained. The supplied rectangular road module is used on courtyard approaches, avoiding flattened corners or changed driving physics. Circuit asphalt retains the existing Higgsfield texture, with procedural fine aggregate bump detail and high roughness. The lawn uses a procedural grass texture under the supplied grass clumps.

Vegetation is instanced in spatial batches with distance culling. Wind runs in vertex shaders, with matching tree shadow deformation; roots remain fixed. Models load locally, with the previous procedural trees retained as a fallback if loading fails. No runtime Meshy or Higgsfield API is needed.
