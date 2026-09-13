import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createNativeActor, poseNative} from './original/native-characters.js';
const loader = new GLTFLoader(), templates = new Map();
const shirts = ['#cc584b','#357b91','#d4a340','#7272aa','#458968','#d076a0','#db7843','#44618e'];
export function createCrowdPerson(person) {
  const type = person.appearance % 2 ? 'hoodie' : 'casual';
  if (!templates.has(type)) templates.set(type, loader.loadAsync(`${import.meta.env.BASE_URL}assets/characters/${type}.gltf`));
  const root = new THREE.Group();
  root.visible = false;
  root.userData = {npc: true, personId: person.id, appearance: person.appearance, type};
  root.userData.readyPromise = templates.get(type).then(asset => {
    const model = clone(asset.scene);
    model.traverse(o => {
      if (!o.isMesh) return;
      const tint = m => {
        const copy = m.clone();
        if (['Red_Dark','Purple','White','LightBrown'].includes(copy.name)) copy.color.set(shirts[person.appearance % shirts.length]);
        return copy;
      };
      o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
    });
    const actor = createNativeActor(model, asset.animations, {name: person.id});
    root.add(actor.root);
    root.userData.rig = actor;
    root.userData.ready = true;
  }).catch(error => {root.userData.loadError = error.message;});
  return root;
}
export function animateCrowdPerson(root, p, dt) {
  const actor = root.userData.rig;
  root.visible = !!actor && (!p.hit || !!p.reaction);
  if (!actor) return;
  root.position.set(p.x, p.y + 0.025, p.z);
  actor.heading = Math.PI - p.heading;
  actor.root.rotation.y = actor.heading;
  actor.speed = p.walking ? p.speed : 0;
  actor.reaction = p.reaction || null;
  actor.root.position.y=0;
  poseNative(actor, dt, {mass: 2.8, hz: 1.6, amp: 3.8, size: 1.45});
  if(p.hurt)actor.root.rotation.x=-Math.sin(Math.min(1,p.hurt.time/.35)*Math.PI)*.22;
  else if(!p.reaction)actor.root.rotation.x=0;
}
