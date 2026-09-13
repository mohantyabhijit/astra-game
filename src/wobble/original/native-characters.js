import * as T from 'three';
import {createActor} from './characters.js';
import {stepHead} from './motion.js';

// Quaternius control rigs use detached foot controls; preserve their native clips.
export function createNativeActor(model,clips,options){
 model.updateMatrixWorld(true);let box=new T.Box3().setFromObject(model);
 model.scale.multiplyScalar(1.73/box.getSize(new T.Vector3()).y);model.updateMatrixWorld(true);box.setFromObject(model);
 const center=box.getCenter(new T.Vector3());model.position.add(new T.Vector3(-center.x,-box.min.y,-center.z));
 model.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 const a=createActor(model,options);a.native={mixer:new T.AnimationMixer(model),clips,action:null,key:null};return a;
}
export function poseNative(a,dt,params){
 const n=a.native,r=a.reaction,reacting=r&&r.phase!=='fleeing';
 const head=a.bones.Head;
 if(head&&n.headQ){head.quaternion.copy(n.headQ);head.scale.copy(n.headScale);}
 const recovering=reacting&&r.phase==='gettingUp';
 const death=n.clips.find(c=>c.name==='Death'),recoveryClip=n.clips.find(c=>c.name==='Roll')||n.clips.find(c=>c.name==='Idle')||death||n.clips[0];
 const clipName=recovering?recoveryClip?.name:reacting?'Death':a.speed>2.5?'Run':a.speed>.035?'Walk':'Idle';
 const clip=recovering?recoveryClip:n.clips.find(c=>c.name===clipName)||n.clips[0];if(!clip)return;
 const key=recovering?`recover:${clipName}`:clipName;
 if(n.key!==key){
  n.mixer.stopAllAction();n.recoveryFrom=null;
  if(recovering&&death&&death!==clip)n.recoveryFrom=n.mixer.clipAction(death).reset().setEffectiveWeight(1).play();
  n.action=n.mixer.clipAction(clip).reset().setEffectiveWeight(1).play();n.key=key;
 }
 if(reacting){
  const progress=r.phase==='falling'?Math.min(1,r.time/r.fallTime):r.phase==='gettingUp'?Math.min(1,r.time/1.45):1;
  // Roll begins upright, reaches the ground near its midpoint, then rises. Sample
  // that authored second half forward for recovery instead of rewinding Death.
  const eased=progress*progress*(3-2*progress),sample=recovering?(clip===death?1:.48+.519*eased):progress;
  n.action.time=Math.min(clip.duration-.001,sample*clip.duration);
  if(recovering&&n.recoveryFrom){
   n.recoveryFrom.time=Math.max(0,n.recoveryFrom.getClip().duration-.001);
   const blend=Math.min(1,r.time/.28),weight=blend*blend*(3-2*blend);
   n.recoveryFrom.setEffectiveWeight(1-weight);n.action.setEffectiveWeight(weight);
  }
  n.mixer.update(0);a.root.rotation.set(0,a.heading,0);a.root.position.y=r.height||0;
 }else{n.action.timeScale=clipName==='Run'?a.speed/3.7:clipName==='Walk'?a.speed/1.35:1;n.mixer.update(dt);}
 stepHead(a.head,dt,reacting?0:a.speed,params);
 if(head){n.headQ??=head.quaternion.clone();n.headScale??=head.scale.clone();n.headQ.copy(head.quaternion);head.scale.copy(n.headScale).multiplyScalar(params.size);head.rotation.x+=a.head.x;head.rotation.z+=a.head.z;}
 a.poseDirty=false;
}
