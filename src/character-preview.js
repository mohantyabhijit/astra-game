import * as THREE from "three";
import { createWobbleCharacter, animateCharacter } from "./wobble/models.js";
import { solveLimb } from "./wobble/original/characters.js";

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
  const shoulder = new THREE.Vector3(),
    hand = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    offset = new THREE.Vector3();
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
      // Pose Rae's arms as one connected gesture instead of layering elbow
      // rotations on the shared dance pose, which twists the wrists unnaturally.
      if (actor === rae && actor.userData.rig) {
        const rig = actor.userData.rig, bones = rig.bones;
        if (bones.Spine) bones.Spine.rotation.z += Math.sin(danceTime * 2.4) * 0.04;
        for (const [side, sign] of [["Left", 1], ["Right", -1]]) {
          const arm = bones[`${side}Arm`], forearm = bones[`${side}ForeArm`], wrist = bones[`${side}Hand`];
          if (!arm || !forearm || !wrist) continue;
          for (const rest of rig.rest) {
            if (rest.bone === arm || rest.bone === forearm || rest.bone === wrist)
              rest.bone.quaternion.copy(rest.q);
          }
          actor.updateMatrixWorld(true);
          arm.getWorldPosition(shoulder);
          forearm.getWorldPosition(elbow);
          wrist.getWorldPosition(hand);
          const reach = shoulder.distanceTo(elbow) + elbow.distanceTo(hand);
          const beat = danceTime * 3.2 + (sign < 0 ? Math.PI : 0);
          // Keep hands outside the torso and below the chest, with a soft elbow
          // bend and a small delayed forward swing on each side of the beat.
          offset.set(sign * (0.2 + Math.sin(beat) * 0.035), -0.8,
            0.25 + Math.sin(beat - 0.35) * 0.1)
            .normalize().multiplyScalar(reach * 0.88).applyQuaternion(actor.quaternion);
          hand.copy(shoulder).add(offset);
          offset.set(sign * 0.42, -0.4, -0.12)
            .normalize().multiplyScalar(reach * 0.6).applyQuaternion(actor.quaternion);
          elbow.copy(shoulder).add(offset);
          solveLimb(arm, forearm, wrist, hand, elbow);
        }
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
