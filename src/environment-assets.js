import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { roads, garages, obstacles, atCircuit, CIRCUIT_LENGTH, closestRoad, inWater, connections } from './district.js';
import { distance, seededRandom } from './physics.js';

function surfaceClear(p,margin=2) {
 if(inWater(p)||closestRoad(p).distance<15.5)return false;
 if(garages.some(g=>distance(g,p)<48)||connections.some(c=>distance(c,p)<28))return false;
 return !obstacles.some(o=>o.kind!=='barrier'&&distance(o,p)<Math.hypot(o.w,o.d)/2+margin);
}
function normalizedMesh(gltf) {
 gltf.scene.updateMatrixWorld(true);let source;gltf.scene.traverse(o=>{if(o.isMesh)source=o;});
 if(!source)throw new Error('GLB contains no renderable mesh');
 const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();
 const bounds=geometry.boundingBox,size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
 geometry.translate(-centre.x,-bounds.min.y,-centre.z);
 const material=source.material.clone();material.roughness=Math.max(.8,material.roughness);material.metalness=0;material.envMapIntensity=.25;
 for(const key of ['map','normalMap','roughnessMap'])if(material[key])material[key].anisotropy=8;
 return {geometry,material,size};
}
function windMaterial(material,time,height,strength) {
 const patch=shader=>{
  shader.uniforms.uWindTime=time;
  shader.vertexShader='uniform float uWindTime;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float heightWeight = clamp(position.y / ${height.toFixed(6)}, 0.0, 1.0);
    float windPhase = instanceMatrix[3].x * .073 + instanceMatrix[3].z * .051;
    float bend = pow(heightWeight, 2.0) * (sin(uWindTime * 1.3 + windPhase) + .32 * sin(uWindTime * 2.7 + windPhase * 1.6));
    transformed.x += bend * ${strength.toFixed(6)};
    transformed.z += bend * ${(.36*strength).toFixed(6)};
    transformed.x += sin(uWindTime * 5.0 + position.x * 18.0 + windPhase) * pow(heightWeight, 4.0) * ${(strength*.14).toFixed(6)};`);
 };
 material.onBeforeCompile=patch;material.customProgramCacheKey=()=>`wind-${height}-${strength}`;
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});depth.onBeforeCompile=patch;depth.customProgramCacheKey=material.customProgramCacheKey;
 return depth;
}
function instances(scene,model,placements,windTime,kind) {
 const chunks=new Map(),dummy=new THREE.Object3D(),cellSize=kind==='tree'?100:32;
 const depth=windMaterial(model.material,windTime,model.size.y,model.size.y*(kind==='tree'?.014:.12));
 for(const p of placements){const key=`${Math.floor(p.x/cellSize)},${Math.floor(p.z/cellSize)}`;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
 const batches=[];
 for(const points of chunks.values()) {
  const mesh=new THREE.InstancedMesh(model.geometry,model.material,points.length);mesh.customDepthMaterial=depth;mesh.castShadow=kind==='tree';mesh.receiveShadow=true;
  points.forEach((p,i)=>{dummy.position.set(p.x,p.y||0,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(p.scale,p.scale*(p.squash||1),p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.computeBoundingSphere();mesh.boundingSphere.radius+=2;mesh.visible=false;scene.add(mesh);batches.push(mesh);
 }
 return batches;
}
export function addEnvironmentAssets(scene,fallbackTrees) {
 const time={value:0},state={loaded:false,error:null,trees:0,grass:0},treeBatches=[],grassBatches=[];
 const loader=new GLTFLoader();
 const ready=Promise.all(['tree','groundcover','road'].map(name=>loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/${name}.glb`))).then(([treeGLB,grassGLB,roadGLB])=>{
  const tree=normalizedMesh(treeGLB),grass=normalizedMesh(grassGLB),road=normalizedMesh(roadGLB),random=seededRandom(92813);
  const trees=[],tufts=[];
  for(let s=18;s<CIRCUIT_LENGTH;s+=38)for(const side of [-1,1]){
   const p=atCircuit(s,19*side);if(surfaceClear(p,4))trees.push({...p,scale:(9+random()*5)/tree.size.y,rotation:random()*Math.PI*2});
  }
  for(let s=8;s<CIRCUIT_LENGTH;s+=8)for(const side of [-1,1])for(let row=0;row<2;row++){
   const p=atCircuit(s+random()*5,(16.5+row*3.5+random()*2)*side);if(surfaceClear(p))tufts.push({...p,scale:(.8+random()*.7)/grass.size.x,squash:.55,rotation:random()*Math.PI*2});
  }
  treeBatches.push(...instances(scene,tree,trees,time,'tree'));grassBatches.push(...instances(scene,grass,tufts,time,'grass'));
  // Authored straight modules become flush parking aprons. The circuit retains its curved road geometry.
  const apron=new THREE.InstancedMesh(road.geometry,road.material,garages.length),dummy=new THREE.Object3D();
  garages.forEach((g,i)=>{const p=g.local(0,33);dummy.position.set(p.x,-.018,p.z);dummy.rotation.y=Math.atan2(g.outward.x,g.outward.z)-Math.PI/2;dummy.scale.set(20/road.size.x,.065/road.size.y,13/road.size.z);dummy.updateMatrix();apron.setMatrixAt(i,dummy.matrix);});apron.receiveShadow=true;scene.add(apron);
  fallbackTrees.forEach(mesh=>mesh.visible=false);state.loaded=true;state.trees=trees.length;state.grass=tufts.length;
 }).catch(error=>{state.error=String(error);console.error('Environment assets:',error);});
 return {ready,state,update(player,seconds){time.value=seconds;state.windTime=seconds;if(!state.loaded)return;
  for(const mesh of treeBatches)mesh.visible=Math.hypot(mesh.boundingSphere.center.x-player.x,mesh.boundingSphere.center.z-player.z)<360;
  for(const mesh of grassBatches)mesh.visible=Math.hypot(mesh.boundingSphere.center.x-player.x,mesh.boundingSphere.center.z-player.z)<75;
 }};
}

export function naturalSurfaces(renderer) {
 const random=seededRandom(622),size=512;
 function canvasTexture(kind){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),data=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,n=random(),patch=0;if(kind==='grass'){data.data[i]=58+n*24+patch;data.data[i+1]=83+n*29+patch;data.data[i+2]=31+n*17;}else{const grit=n<.035?28:n>.97?-25:0,v=112+n*36+grit;data.data[i]=data.data[i+1]=data.data[i+2]=v;}data.data[i+3]=255;}ctx.putImageData(data,0,0);
  if(kind==='grass'){ctx.strokeStyle='#72954b';ctx.lineWidth=1;for(let i=0;i<7000;i++){const x=random()*size,y=random()*size;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1.5,y-2-random()*5);ctx.stroke();}}
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tex;
 }
 const grass=canvasTexture('grass');grass.colorSpace=THREE.SRGBColorSpace;grass.repeat.set(.16,.16);
 const asphalt=canvasTexture('asphalt');asphalt.repeat.set(10,10);
 return {grass,asphalt};
}
