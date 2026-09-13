import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
for (const name of ['reference', 'asphalt', 'facade', 'vehicle']) {
  await sharp(`art/originals/${name}.png`).resize({ width: name === 'reference' ? 1344 : 768 }).webp({ quality: name === 'reference' ? 85 : 82 }).toFile(`public/assets/${name}.webp`);
}
const provenance = JSON.parse(await readFile('public/assets/provenance.json', 'utf8'));
for (const asset of provenance) {
  asset.original = `art/originals/${asset.name}.png`;
  asset.file = `${asset.name}.webp`;
  asset.processing = 'Resized and encoded as WebP; source image preserved in repository.';
}
await writeFile('public/assets/provenance.json', JSON.stringify(provenance, null, 2) + '\n');
