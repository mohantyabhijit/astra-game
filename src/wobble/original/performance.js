import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Each boundary owns one rigid transform. Never bake an animated child into its parent.
export function batchRigidMeshes(root, boundaries=new Set()) {
 root.updateMatrixWorld(true);
 function batch(owner){
  const buckets=new Map(),inverse=owner.matrixWorld.clone().invert(),nested=[];
  function visit(node){
   if(node!==owner&&boundaries.has(node)){nested.push(node);return;}
   if(node.isMesh&&!node.isSkinnedMesh&&!Array.isArray(node.material)&&!node.material.transparent&&!node.morphTargetInfluences){
    const key=`${node.material.uuid}:${node.castShadow}:${node.receiveShadow}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(node);
   }
   for(const child of node.children)visit(child);
  }
  visit(owner);
  for(const meshes of buckets.values()){
   if(meshes.length<2)continue;
   const copies=meshes.map(m=>{
    let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
    g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld));g.clearGroups();return g;
   });
   const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
   if(!geometry)throw new Error('Rigid mesh attributes do not match');
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const merged=new T.Mesh(geometry,meshes[0].material);merged.name='batch:'+owner.name;
   merged.castShadow=meshes[0].castShadow;merged.receiveShadow=meshes[0].receiveShadow;
   meshes.forEach(m=>m.removeFromParent());owner.add(merged);
  }
  for(const child of nested)batch(child);
 }
 batch(root);
 root.traverse(o=>{if(o!==root&&!boundaries.has(o)){o.updateMatrix();o.matrixAutoUpdate=false;}});
 return root;
}
export function renderQuality(name,deviceRatio=1){
 const presets={performance:{pixelRatio:1,shadowSize:512,shadowHz:15,npcHz:20},balanced:{pixelRatio:1.5,shadowSize:1024,shadowHz:30,npcHz:30},high:{pixelRatio:2,shadowSize:2048,shadowHz:60,npcHz:60}};
 const p=presets[name]||presets.balanced;return {...p,pixelRatio:Math.min(deviceRatio,p.pixelRatio)};
}
export class FrameMeter{
 constructor(){this.active=false;this.result=null;}
 start(now){this.started=now;this.frames=[];this.cpu=[];this.calls=[];this.triangles=[];this.active=true;this.result=null;}
 sample(now,frameMs,cpuMs,info){
  if(!this.active)return null;
  // First second warms the view/shaders; collect the following five seconds.
  if(now-this.started<1000)return null;
  this.frames.push(frameMs);this.cpu.push(cpuMs);this.calls.push(info.calls);this.triangles.push(info.triangles);
  if(now-this.started<6000)return null;
  const percentile=(a,p)=>{a.sort((x,y)=>x-y);return +a[Math.min(a.length-1,Math.floor(a.length*p))].toFixed(2);};
  this.result={frames:this.frames.length,frameMedian:percentile(this.frames,.5),frameP95:percentile(this.frames,.95),cpuMedian:percentile(this.cpu,.5),cpuP95:percentile(this.cpu,.95),drawCalls:percentile(this.calls,.5),triangles:percentile(this.triangles,.5)};
  this.active=false;return this.result;
 }
}
