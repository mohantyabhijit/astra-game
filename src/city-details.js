import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {createMerlion} from "./wobble/merlion.js";
import * as THREE from "three";
import { MISSIONS, POLICE_STATION, parkFurniture, MERLION, MERLION_PLAZA } from "./district.js";
import { box, mat, labelTexture, mergeStatic } from "./render-utils.js";

// The map marker is the roadside approach; the building sits clear of traffic.
export function addCityDetails(scene) {
  const root = new THREE.Group();
  const cream = mat("#f0e8d8"),
    navy = mat("#233f4e"),
    coral = mat("#ee684f");
  const glass = mat("#81bbc5", { metalness: 0.35, roughness: 0.23 });
  const gold = mat("#e1b456"),
    concrete = mat("#c6cdc1");

  // Merlion Park: a broad, low waterfront terrace beside Fullerton. The
  // access loop remains open through the west half of the plaza.
  const park = new THREE.Group();
  park.position.set(MERLION_PLAZA.x, 0, MERLION_PLAZA.z);
  root.add(park);
  box(park, 0, MERLION_PLAZA.height/2, 0, MERLION_PLAZA.w, MERLION_PLAZA.height, MERLION_PLAZA.d, mat("#d7d0bd"));
  const pavingJoint = mat("#8d978e");
  for (let x = -36; x <= 36; x += 6) box(park, x, 0.246, 0, 0.045, 0.012, 36, pavingJoint);
  for (let z = -18; z <= 18; z += 6) box(park, 0, 0.246, z, 76, 0.012, 0.045, pavingJoint);
  const timber = mat("#846349"), foliage = mat("#3a7653");
  for (const item of parkFurniture) {
    box(root, item.x, item.kind === 'bollard' ? .9 : .7, item.z, item.w,
      item.kind === 'bollard' ? 1.6 : .7, item.d, item.kind === 'bollard' ? navy : item.kind === 'planter' ? timber : concrete);
    if (item.kind === 'planter') {
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(1.4,10,7),foliage);
      shrub.position.set(item.x,1.5,item.z); shrub.scale.set(1.5,.65,.75);root.add(shrub);
    }
  }

  let monument;
  const ready = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/merlion/merlion.glb`).then(asset => {
    monument = createMerlion(asset.scene);
    monument.root.position.set(MERLION.x,.25,MERLION.z);
    monument.root.rotation.y = Math.PI/2;
    scene.add(monument.root);
  });
  const station = new THREE.Group();
  station.position.set(
    POLICE_STATION.x + Math.cos(POLICE_STATION.heading) * 40,
    0,
    POLICE_STATION.z + Math.sin(POLICE_STATION.heading) * 40,
  );
  station.rotation.y = -POLICE_STATION.heading;
  root.add(station);
  box(station, 0, 0.08, 0, 30, 0.16, 24, concrete);
  box(station, 0, 4.5, 0, 22, 9, 14, cream);
  box(station, 0, 9.1, 0, 23, 0.5, 15, navy);
  box(station, 0, 1.9, -7.08, 3, 3.8, 0.15, glass);
  box(station, 0, 5.5, -8, 24, 0.4, 3, navy);
  for (const x of [-8, -4, 4, 8]) {
    box(station, x, 3, -7.08, 2.4, 2.2, 0.15, glass);
    box(station, x, 7, -7.08, 2.4, 1.6, 0.15, glass);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 2),
    new THREE.MeshBasicMaterial({
      map: labelTexture("MARINA BAY POLICE", "#fff4dc", "#233f4e"),
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(0, 5.1, -8.05);
  sign.rotation.y = Math.PI;
  station.add(sign);
  const beacon = new THREE.Group();
  beacon.position.set(POLICE_STATION.x, 0, POLICE_STATION.z);
  // Keep roadside signs outside the drivable lane.
  beacon.position.x += Math.cos(POLICE_STATION.heading) * 15;
  beacon.position.z += Math.sin(POLICE_STATION.heading) * 15;
  root.add(beacon);
  box(beacon, 0, 3, 0, 0.25, 6, 0.25, navy);
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.8, 0.35),
    new THREE.MeshStandardMaterial({
      map: labelTexture("P", "#fff4dc", "#305c82"),
    }),
  );
  badge.position.y = 6;
  beacon.add(badge);
  for (const mission of MISSIONS) {
    const marker = new THREE.Group();
    marker.position.set(mission.x, 0.06, mission.z);
    marker.rotation.y = -mission.heading;
    root.add(marker);
    // Painted staging bay, no solid walls blocking the existing circuit.
    for (const x of [-2.3, 2.3]) box(marker, x, 0, 0, 0.12, 0.025, 7, gold);
    for (const z of [-3.5, 3.5]) box(marker, 0, 0, z, 4.6, 0.025, 0.12, gold);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), coral);
    m.position.set(0, 4.3, 0);
    marker.add(m);

  }
  // A shared material batch keeps the added city furniture inexpensive.
  mergeStatic(root);
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = object.receiveShadow = true;
  });
  scene.add(root);
  return {root,ready,update:time=>monument?.update(time)};
}
