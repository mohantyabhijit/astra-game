import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { createVehicle as createOriginalVehicle } from "./original/vehicles.js";
import {
  prepareCharacter,
  createActor,
  poseWalking,
  poseStrike,
  poseReaction,
  poseBoarding,
  setHipWorld,
} from "./original/characters.js";
import { boardingPose } from "./original/motion.js";

const characterLoader = new GLTFLoader(),
  characterTemplates = new Map();
function characterTemplate(id) {
  if (!characterTemplates.has(id))
    characterTemplates.set(
      id,
      characterLoader.loadAsync(
        `${import.meta.env.BASE_URL}assets/characters/${id}.glb`,
      ),
    );
  return characterTemplates.get(id);
}
function installRealCharacter(root, id) {
  const ready = characterTemplate(id)
    .then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      if (id === "kai") model.traverse(o => {
        if (!o.isMesh) return;
        const recolor = material => {
          if (!/Wolf3D_Outfit_(Top|Bottom)/.test(material.name)) return material;
          const suit = material.clone(); suit.color.set("#102d59");
          suit.map = null; suit.roughness = .8; return suit;
        };
        o.material = Array.isArray(o.material) ? o.material.map(recolor) : recolor(o.material);
      });
      prepareCharacter(model);
      const actor = createActor(model, { name: id, player: true });
      actor.root.remove(model);
      while (root.children.length) root.remove(root.children[0]);
      root.add(model);
      actor.root = root;
      root.userData.rig = actor;
      root.userData.clips = gltf.animations || [];
      root.userData.ready = true;
      return actor;
    })
    .catch((error) => {
      root.userData.loadError = error;
      throw error;
    });
  root.userData.readyPromise = ready;
}

const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.08,
    ...options,
  });
const geo = (w, h, d, r = 0.08) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3));
function part(parent, w, h, d, color, x, y, z, r = 0.08) {
  const m = new THREE.Mesh(geo(w, h, d, r), material(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function createWobbleCharacter(id = "kai") {
  const kai = id === "kai",
    root = new THREE.Group();
  root.name = `character-${id}`;
  const skin = material(kai ? "#b87552" : "#8f563e"),
    cloth = material(kai ? "#173a59" : "#6f2145", { roughness: 0.7 }),
    accent = material(kai ? "#50d7d0" : "#ffbd5b", {
      emissive: kai ? "#164746" : "#5b3510",
      emissiveIntensity: 0.25,
    });
  const hips = new THREE.Group();
  hips.position.y = 0.82;
  root.add(hips);
  part(hips, 0.62, 0.74, 0.36, cloth.color.getHex(), 0, 0.32, 0, 0.12);
  part(hips, 0.68, 0.11, 0.39, accent.color.getHex(), 0, 0.04, 0, 0.04);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.19, 0.02, 0);
    hips.add(leg);
    part(leg, 0.18, 0.68, 0.2, kai ? "#14293b" : "#28213f", 0, -0.38, 0, 0.06);
    part(leg, 0.23, 0.12, 0.42, "#e8e5dc", 0, -0.75, 0.1, 0.05);
    legs.push(leg);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.43, 0.56, 0);
    hips.add(shoulder);
    part(shoulder, 0.17, 0.63, 0.18, cloth.color.getHex(), 0, -0.25, 0, 0.07);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), skin);
    hand.position.y = -0.6;
    shoulder.add(hand);
    arms.push(shoulder);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 0.78, 0);
  hips.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.21;
  neck.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.37, 20, 14), skin);
  face.scale.set(0.9, 1.05, 0.85);
  face.castShadow = true;
  head.add(face);
  part(
    head,
    0.58,
    0.17,
    0.5,
    kai ? "#171a21" : "#2a1722",
    0,
    0.29,
    -0.02,
    0.09,
  );
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 8, 6),
      material("#10161d", { roughness: 0.3 }),
    );
    eye.position.set(side * 0.12, 0.05, 0.32);
    head.add(eye);
  }
  part(
    head,
    0.14,
    0.025,
    0.025,
    kai ? "#d9f5f3" : "#ffd97d",
    0,
    -0.09,
    0.345,
    0.01,
  );
  root.userData = {
    id,
    hips,
    head,
    neck,
    arms,
    legs,
    wobble: { x: 0, z: 0, vx: 0, vz: 0 },
    detached: false,
  };
  installRealCharacter(root, id);
  return root;
}

export function animateCharacter(
  root,
  dt,
  time,
  {
    speed = 0,
    mode = "idle",
    dance = false,
    grounded = true,
    heading = 0,
    vehicle = null,
    transition = 1,
    reaction = null,
    attack = null,
    hurt = null,
  } = {},
) {
  const u = root.userData;
  if (u?.rig) {
    const a = u.rig,
      car = vehicle?.userData?.vehicle;
    if(reaction && reaction.phase !== "fleeing") {
      const ground = root.position.y;a.reaction=reaction;a.heading=Math.PI-heading;
      poseReaction(a,{mass:2.8,hz:1.6,amp:3.8,size:2.05});root.position.y+=ground;return;
    }
    a.reaction=null;a.attack=attack;root.rotation.x=0;
    if (
      car &&
      (mode === "driving" || mode === "boarding" || mode === "exiting")
    ) {
      const entering = mode !== "exiting",
        progress =
          mode === "driving" ? 1 : Math.max(0, Math.min(1, transition)),
        seatProgress = entering ? progress : 1 - progress,
        p = boardingPose(seatProgress);
      car.root.updateMatrixWorld(true);
      car.setDoor(p.door);
      const start = car.board.getWorldPosition(new THREE.Vector3());
      start.y += a.local.Hips?.y || 0.9;
      const end = car.seat.getWorldPosition(new THREE.Vector3());
      const pelvis = start.lerp(end, p.seat);
      pelvis.y -= p.duck * 0.075;
      setHipWorld(a, pelvis, car.heading - (Math.PI / 2) * (1 - p.turn));
      poseBoarding(a, car, p, { mass: 2.8, hz: 1.6, amp: 3.8, size: 2.05 }, dt);
      return;
    }
    a.mode = !grounded ? "air" : dance
      ? "run"
      : speed > 2.5
        ? "run"
        : speed > 0.1
          ? "walk"
          : "idle";
    a.speed = dance ? 3.1 : speed;
    a.grounded = grounded;
    // A planted foot follows changes in the supporting surface (e.g. a bridge
    // slope); retaining the old world-space height would bury it in the deck.
    if (a.gait) {
      const rise = root.position.y - a.gait.previous.y;
      for (const foot of Object.values(a.gait.feet)) foot.point.y += rise;
    }
    a.heading = Math.PI - heading;
    root.rotation.y = a.heading;
    poseWalking(a, dt, {
      mass: 2.8,
      hz: dance ? 2.2 : 1.6,
      amp: dance ? 4.8 : 3.8,
      size: 2.05,
    });
    if(attack)poseStrike(a,null,0);
    if(hurt&&a.bones.Spine)a.bones.Spine.rotation.x-=Math.sin(Math.min(1,hurt.time/.35)*Math.PI)*.22;
    if (dance) {
      const beat = time * 3.2;
      root.rotation.z = Math.sin(beat) * 0.045;
      const left = a.bones.LeftArm,
        right = a.bones.RightArm,
        ll = a.bones.LeftUpLeg,
        rl = a.bones.RightUpLeg;
      if (left) {
        left.rotation.z += 0.65 + Math.sin(beat) * 0.35;
        left.rotation.x += Math.cos(beat) * 0.5;
      }
      if (right) {
        right.rotation.z -= 0.65 + Math.cos(beat) * 0.35;
        right.rotation.x -= Math.sin(beat) * 0.5;
      }
      if (ll) ll.rotation.x += Math.sin(beat) * 0.42;
      if (rl) rl.rotation.x -= Math.sin(beat) * 0.42;
    } else root.rotation.z = 0;
    return;
  }
  if (!u?.head || u.detached) return;
  root.rotation.y = Math.PI - heading;
  const moving = speed > 0.12,
    rate = moving ? Math.min(12, 4 + speed * 0.7) : 2.2,
    beat = time * rate;
  const targetX =
    (moving ? Math.sin(beat * 2) * 0.11 : Math.sin(time * 1.5) * 0.018) +
    (dance ? Math.sin(time * 3.4) * 0.11 : 0);
  const targetZ =
      (moving ? Math.sin(beat) * 0.14 : 0) +
      (dance ? Math.cos(time * 2.3) * 0.14 : 0),
    omega = 18;
  u.wobble.vx +=
    (targetX - u.wobble.x) * omega * omega * dt - u.wobble.vx * 11 * dt;
  u.wobble.vz +=
    (targetZ - u.wobble.z) * omega * omega * dt - u.wobble.vz * 11 * dt;
  u.wobble.x += u.wobble.vx * dt;
  u.wobble.z += u.wobble.vz * dt;
  u.neck.rotation.set(u.wobble.x, 0, u.wobble.z);
  const stride = moving ? Math.sin(beat) * 0.62 : 0,
    danceKick = dance ? Math.sin(time * 4.1) * 0.35 : 0;
  u.legs[0].rotation.x = stride + danceKick;
  u.legs[1].rotation.x = -stride - danceKick;
  u.arms[0].rotation.x =
    -stride + (dance ? -0.8 + Math.sin(time * 3) * 0.5 : 0);
  u.arms[1].rotation.x =
    stride + (dance ? -1.2 + Math.cos(time * 2.6) * 0.5 : 0);
  u.hips.position.y =
    0.82 +
    (moving ? Math.abs(Math.sin(beat)) * 0.035 : 0) +
    (dance ? Math.abs(Math.sin(time * 3.2)) * 0.08 : 0);
  if (mode === "seated") {
    u.hips.rotation.x = -0.12;
    u.legs[0].rotation.x = u.legs[1].rotation.x = -1.25;
    u.legs[0].rotation.z = -0.12;
    u.legs[1].rotation.z = 0.12;
    u.arms[0].rotation.x = u.arms[1].rotation.x = -1.0;
  } else u.hips.rotation.x = 0;
}

function bakeRigHead(actor) {
  const group = new THREE.Group(),
    head = actor.bones.Head;
  if (!head) return group;
  actor.root.updateMatrixWorld(true);
  actor.model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !mesh.geometry.attributes.skinIndex) return;
    const headIndex = mesh.skeleton.bones.indexOf(head),
      neckIndex = mesh.skeleton.bones.indexOf(actor.bones.Neck);
    if (headIndex < 0) return;
    const source = mesh.geometry,
      index = source.index?.array,
      position = source.attributes.position,
      skinIndex = source.attributes.skinIndex,
      skinWeight = source.attributes.skinWeight,
      vertices = [],
      uvs = [];
    const count = index ? index.length : position.count;
    for (let i = 0; i < count; i += 3) {
      const ids = [
        index ? index[i] : i,
        index ? index[i + 1] : i + 1,
        index ? index[i + 2] : i + 2,
      ];
      let influenced = false;
      for (const vi of ids)
        for (let j = 0; j < 4; j++)
          if (
            (skinIndex.getComponent(vi, j) === headIndex ||
              skinIndex.getComponent(vi, j) === neckIndex) &&
            skinWeight.getComponent(vi, j) > 0.18
          )
            influenced = true;
      if (!influenced) continue;
      for (const vi of ids) {
        const p = new THREE.Vector3().fromBufferAttribute(position, vi);
        mesh.applyBoneTransform(vi, p);
        p.applyMatrix4(mesh.matrixWorld);
        vertices.push(p.x, p.y, p.z);
        const uv = source.attributes.uv;
        uvs.push(uv ? uv.getX(vi) : 0, uv ? uv.getY(vi) : 0);
      }
    }
    if (!vertices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    const piece = new THREE.Mesh(
      geometry,
      Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
    );
    piece.castShadow = true;
    group.add(piece);
  });
  const bounds = new THREE.Box3().setFromObject(group),
    center = bounds.getCenter(new THREE.Vector3());
  for (const child of group.children)
    child.geometry.translate(-center.x, -center.y, -center.z);
  group.position.copy(center);
  return group;
}
export function detachWobbleHead(root, scene, origin, heading = 0) {
  const u = root.userData,
    source = u?.rig?.bones?.Head || u?.head;
  if (!source) return null;
  u.detached = true;
  let head;
  if (u.rig) {
    head = bakeRigHead(u.rig);
    u.headScale = source.scale.clone();
    source.scale.setScalar(0.001);
  } else {
    source.visible = false;
    head = source.clone(true);
    head.visible = true;
    head.position.set(origin.x, (origin.y || 0) + 2.1, origin.z);
    head.scale.multiplyScalar(1.15);
  }
  scene.add(head);
  head.userData.velocity = new THREE.Vector3(
    Math.sin(heading) * 7 + 3,
    11,
    -Math.cos(heading) * 7 - 2,
  );
  head.userData.spin = new THREE.Vector3(5, 7, 4);
  return head;
}

export function restoreWobbleHead(root) {
  const u = root.userData,
    source = u?.rig?.bones?.Head || u?.head;
  if (!source) return;
  u.detached = false;
  source.visible = true;
  if (u.headScale) source.scale.copy(u.headScale);
  if (u.wobble) u.wobble.x = u.wobble.z = u.wobble.vx = u.wobble.vz = 0;
}

export function createHeroVehicle(type = "jeep", color) {
  const original = createOriginalVehicle(type, color, { batch: true }),
    root = original.root;
  root.userData = {
    ...root.userData,
    type,
    door: original.doorPivot,
    driverAnchor: original.seat,
    boardAnchor: original.board,
    width: original.width,
    length: original.length,
    doorOpen: 0,
    vehicle: original,
  };
  return root;
}

export function setVehicleDoor(root, amount) {
  const u = root.userData;
  if (!u?.door) return;
  u.doorOpen = amount;
  if (u.vehicle) u.vehicle.setDoor(amount);
  else u.door.rotation.y = -1.18 * amount;
}
