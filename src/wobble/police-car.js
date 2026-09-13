import * as THREE from 'three';
import {createHeroVehicle} from './models.js';
import {box,mat,labelTexture} from '../render-utils.js';
export function createPoliceSportsCar(scene) {
  const root=createHeroVehicle('sports','#eef1ed');
  root.userData.police=true;
  const navy=mat('#142332');
  // Hard roof and supports over the imported sports-car cabin.
  box(root,0,1.47,-.25,1.65,.10,1.45,navy);
  for(const x of [-.77,.77])for(const z of [-.88,.39])box(root,x,1.21,z,.065,.48,.065,navy);
  box(root,0,1.59,-.25,1.22,.12,.3,navy);
  box(root,0,.91,1.27,1.3,.025,.8,navy);
  const lights=[];
  for(const [x,color] of [[-.36,'#ef304c'],[.36,'#299aff']]) {
    lights.push(box(root,x,1.72,-.25,.53,.17,.3,mat(color,{emissive:color,emissiveIntensity:3})));
  }
  for(const side of [-1,1]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.35),new THREE.MeshStandardMaterial({map:labelTexture('POLICE','#ffffff','#142332'),side:THREE.DoubleSide}));
    panel.position.set(side*1.045,.77,-.1);panel.rotation.y=side*Math.PI/2;root.add(panel);
  }
  scene.add(root);
  return {mesh:root,lights};
}
