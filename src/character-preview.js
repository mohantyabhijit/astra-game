import * as THREE from "three";
import { createWobbleCharacter, animateCharacter } from "./wobble/models.js";

export function createCharacterPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
  camera.position.set(0, 1.8, 7);
  camera.lookAt(0, 1.2, 0);
  scene.add(new THREE.HemisphereLight("#d7f7ff", "#24152e", 2.5));
  const key = new THREE.DirectionalLight("#ffe7c2", 4);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight("#48ddff", 14, 10);
  rim.position.set(3, 2, -2);
  scene.add(rim);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.3, 48),
    new THREE.MeshStandardMaterial({
      color: "#132636",
      metalness: 0.45,
      roughness: 0.3,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);
  const kai = createWobbleCharacter("kai"),
    rae = createWobbleCharacter("rae");
  kai.position.x = -0.78;
  rae.position.x = 0.78;
  scene.add(kai, rae);
  let selected = "kai",
    orbitTime = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function resize() {
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    if (
      canvas.width !== Math.round(w * renderer.getPixelRatio()) ||
      canvas.height !== Math.round(h * renderer.getPixelRatio())
    )
      renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function select(id) {
    selected = id === "rae" ? "rae" : "kai";
    return selected;
  }
  function update(dt, time) {
    resize();
    // One complete turn around the dance stage every 10 seconds.
    if (!document.hidden && !reducedMotion.matches)
      orbitTime += Math.min(Math.max(dt, 0), 0.1);
    const angle = (orbitTime / 10) * Math.PI * 2;
    camera.position.set(Math.sin(angle) * 7, 1.8, Math.cos(angle) * 7);
    camera.lookAt(0, 1.2, 0);
    for (const actor of [kai, rae]) {
      const active = actor.userData.id === selected;
      actor.scale.lerp(
        new THREE.Vector3(...Array(3).fill(active ? 1.12 : 0.88)),
        1 - Math.exp(-8 * dt),
      );
      actor.position.y = active ? 0.08 : 0;
      const danceTime = actor === kai ? time : time * 0.82 + 2;
      animateCharacter(actor, dt, danceTime, { dance: true });
      // Kai keeps the energetic steps; Rae adds a gentler shoulder-and-arm groove.
      if (actor === rae && actor.userData.rig) {
        const bones = actor.userData.rig.bones;
        if (bones.Spine) bones.Spine.rotation.z += Math.sin(danceTime * 2.4) * 0.1;
        if (bones.LeftForeArm) bones.LeftForeArm.rotation.x -= 0.35;
        if (bones.RightForeArm) bones.RightForeArm.rotation.x -= 0.35;
      }
      actor.rotation.y = Math.sin(time * 0.8 + (active ? 0 : 1)) * 0.18;
    }
    renderer.render(scene, camera);
  }
  return {
    select,
    update,
    get selected() {
      return selected;
    },
    ready: Promise.all([kai.userData.readyPromise, rae.userData.readyPromise]),
    dispose() {
      renderer.dispose();
    },
  };
}
