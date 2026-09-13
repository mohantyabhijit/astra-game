import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
export const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, ...options });
export const lightMat = (color, intensity = 1.5) => mat(color, { emissive: color, emissiveIntensity: intensity });
export function box(parent, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(boxGeometry, material);
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh;
}
export function texture(path, repeat = 1) {
  const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/${path}.webp`);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat); t.anisotropy = 4; return t;
}
export function labelTexture(text, color = '#67f4df', bg = '#102326') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64); const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const key = mesh.material.uuid;
    if (!batches.has(key)) batches.set(key, { material: mesh.material, geometries: [] });
    batches.get(key).geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
  });
  group.clear();
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries);
    group.add(new THREE.Mesh(merged, material)); geometries.forEach(g => g.dispose());
  }
}
