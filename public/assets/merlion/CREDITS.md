# Singapore Merlion

`merlion.glb` is adapted from [Singapore Merlion ReSculpt](https://www.thingiverse.com/thing:5533885) by **cymon**, licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). It is a remix of [Merlion](https://www.thingiverse.com/thing:1698961) by **keeganTeo**. The source archive notice is preserved in `SOURCE-LICENSE.txt`.

The source is a detailed resculpt of a scanned figurine, not a measured scan of the actual monument. Small proportions and surface details can differ from the original.

Changes: reduced 412,672 triangles to 80,000, converted STL to indexed GLB, rotated to Y-up, centered and uniformly scaled to 8.6 metres, generated smooth normals and baked cavity vertex colors. The game adds white stone material, paving, an animated mouth fountain and a receiving pool. The pool and paving are game additions, not a reconstruction of Merlion Park.

Keep this attribution with redistributed assets and retain source/license links in the review page. No endorsement by the creators is implied.

Rebuild with `scripts/prepare-merlion.py` and the source `Merlion_Detailed.stl`. Build dependencies: Python, numpy, trimesh, fast-simplification. No additional runtime dependencies. `metadata.json` records source SHA-256, bounds, triangle count and bytes.
