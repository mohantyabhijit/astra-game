import {fistPoint,punchDrive} from './boxing.js';
import * as T from 'three';
import { stepHead, smooth, gaitSample } from './motion.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const Y=V(0,1,0);
function find(root,name){let bone;root.traverse(o=>{if(o.isBone&&o.name.replace(/^mixamorig:?/i,'').toLowerCase()===name.toLowerCase())bone=o;});return bone;}
// Solver scratch is private and reused; these functions are synchronous/re-entrant only
// at the actor-call level. Bone world matrices are refreshed once before posing.
const ik=Array.from({length:12},()=>new T.Vector3());
const parentQ=new T.Quaternion(),boneQ=new T.Quaternion(),deltaQ=new T.Quaternion();
const decomposeP=V(),decomposeS=V();
function position(bone,out){return out.setFromMatrixPosition(bone.matrixWorld);}
function rotation(bone,out){bone.matrixWorld.decompose(decomposeP,out,decomposeS);return out;}
function updateBone(bone){bone.updateMatrix();bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);}
function worldQuat(bone,q){rotation(bone.parent,parentQ);bone.quaternion.copy(parentQ.invert()).multiply(q);updateBone(bone);}
function aim(bone,child,target){
 const from=position(bone,ik[8]);const direction=position(child,ik[9]).sub(from).normalize();const to=ik[10].copy(target).sub(from).normalize();
 rotation(bone,boneQ);deltaQ.setFromUnitVectors(direction,to).multiply(boneQ);worldQuat(bone,deltaQ);
}
export function solveLimb(a,b,end,target,pole){
 if(!a||!b||!end)return;
 const p=position(a,ik[0]),mid=position(b,ik[1]),tip=position(end,ik[2]);
 const l1=p.distanceTo(mid),l2=mid.distanceTo(tip),axis=ik[3].copy(target).sub(p);
 const d=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);axis.normalize();
 const bend=ik[4].copy(pole).sub(p);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
 const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const joint=ik[5].copy(p).addScaledVector(axis,along).addScaledVector(bend,height);
 const endGoal=ik[6].copy(p).addScaledVector(axis,d);
 aim(a,b,joint);updateBone(b);updateBone(end);aim(b,end,endGoal);updateBone(end);
}
export function prepareCharacter(model){
 const foot=find(model,'LeftFoot'),toe=find(model,'LeftToeBase');
 model.updateMatrixWorld(true);
 if(foot&&toe){const forward=toe.getWorldPosition(V()).sub(foot.getWorldPosition(V()));model.rotation.y-=Math.atan2(forward.x,forward.z);}
 model.updateMatrixWorld(true);
 let bounds=new T.Box3().setFromObject(model);const size=bounds.getSize(V());
 model.scale.multiplyScalar(1.73/size.y);model.updateMatrixWorld(true);bounds.setFromObject(model);
 const center=bounds.getCenter(V());model.position.add(V(-center.x,-bounds.min.y,-center.z));
 model.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.envMapIntensity=.6;});}});
 model.updateMatrixWorld(true);
}
export function createActor(model,{name,x=0,z=0,heading=0,player=false}){
 const root=new T.Group();root.add(model);root.updateMatrixWorld(true);
 const bones={};for(const name of ['Hips','Spine','Spine1','Neck','Head','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','LeftShoulder','RightShoulder','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'])bones[name]=find(model,name);
 const rest=[];model.traverse(o=>{if(o.isBone)rest.push({bone:o,q:o.quaternion.clone(),p:o.position.clone(),s:o.scale.clone()});});
 const local={};for(const [name,b] of Object.entries(bones))if(b)local[name]=b.getWorldPosition(V());
 const footQ={};for(const side of ['Left','Right'])footQ[side]=bones[side+'Foot']?.getWorldQuaternion(new T.Quaternion());
 const a={name,root,model,bones,rest,local,footQ,heading,player,mode:'idle',phase:0,speed:0,vy:0,y:0,grounded:true,vehicle:null,board:null,wait:0,waypoint:null,head:{x:0,z:0,vx:0,vz:0,phase:0}};
 root.position.set(x,0,z);root.rotation.y=heading;return a;
}
export function restoreActor(a){for(const r of a.rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);r.bone.scale.copy(r.s);}a.root.updateMatrixWorld(true);}
export function localWorld(a,p){return p.clone().applyMatrix4(a.root.matrixWorld);}
function poseFoot(a,side,point,pole){
 const b=a.bones;solveLimb(b[side+'UpLeg'],b[side+'Leg'],b[side+'Foot'],point,pole);
 if(a.footQ[side])worldQuat(b[side+'Foot'],a.root.getWorldQuaternion(new T.Quaternion()).multiply(a.footQ[side]));
}
function poseHand(a,side,point,pole){const b=a.bones;solveLimb(b[side+'Arm'],b[side+'ForeArm'],b[side+'Hand'],point,pole);}
export function poseWalking(a,dt,params){
 const running=(a.mode==='fleeing'||a.mode==='run'),stride=running?.43:.30;
 if(!a.gait||a.gait.stride!==stride||a.gait.previous.distanceTo(a.root.position)>.75){
  a.gait={previous:a.root.position.clone(),stride,feet:{},weight:0};a.phase=.25;
 }
 const g=a.gait,dx=a.root.position.x-g.previous.x,dz=a.root.position.z-g.previous.z;
 const distance=dx*Math.sin(a.heading)+dz*Math.cos(a.heading);
 const moving=Math.hypot(dx,dz)>1e-6&&a.grounded;
 if(moving){a.phase+=distance/(4*stride);g.direction=Math.sign(distance);}
 g.previous.copy(a.root.position);
 const poseKey=`${a.mode}:${params.size}:${a.heading.toFixed(3)}`;
 if(!moving&&a.speed<.035&&a.grounded&&a.head.still>=.45&&a.lastPoseKey===poseKey&&!a.poseDirty)return;
 a.poseDirty=false;a.lastPoseKey=poseKey;
 restoreActor(a);
 g.weight+=(Number(moving)-g.weight)*(1-Math.exp(-18*dt));
 // Bend the knees enough to reach the planted foot instead of stretching the
 // straight bind-pose leg, which would otherwise drag even a correct IK target.
 const hips=a.bones.Hips;
 if(hips){const p=hips.getWorldPosition(V());p.y-=(running?.13:.065)*g.weight;hips.position.copy(hips.parent.worldToLocal(p));a.root.updateMatrixWorld(true);}
 for(const [side,offset] of [['Left',0],['Right',.5]]){
  const f=a.local[side+'Foot'];if(!f)continue;
  const sample=gaitSample(a.phase+offset,stride),sign=side==='Left'?1:-1;
  const foot=V(f.x*.85,f.y+sample.lift*g.weight,f.z+sample.z*g.weight);
  if(!a.grounded){foot.y+=side==='Left'?.18:.08;foot.z+=side==='Left'?.18:-.1;}
  let target=localWorld(a,foot),contact=g.feet[side];
  if(moving&&sample.stance){
   if(contact?.stance&&contact.contact===sample.contact&&contact.point.distanceTo(target)<.35)target.copy(contact.point);
  }
  g.feet[side]={stance:sample.stance&&a.grounded,contact:sample.contact,point:target.clone()};
  poseFoot(a,side,target,localWorld(a,V(sign*.16,.65,1)));
  const shoulder=a.local[side+'Arm'];
  if(shoulder&&a.local[side+'ForeArm']&&a.local[side+'Hand']){
   // Measure the rig instead of holding every hand at waist height. The arm
   // swings as a relaxed pendulum; running retains a deliberate elbow bend.
   const reach=shoulder.distanceTo(a.local[side+'ForeArm'])+a.local[side+'ForeArm'].distanceTo(a.local[side+'Hand']);
   const swing=-Math.cos((a.phase+offset)*Math.PI*2)*(running?.58:.28)*g.weight;
   const extension=.975-(running?.19:.02)*g.weight;
   const offsetHand=V(sign*.04,-Math.cos(swing),Math.sin(swing)).normalize().multiplyScalar(reach*extension).applyQuaternion(a.root.quaternion);
   const shoulderWorld=a.bones[side+'Arm'].getWorldPosition(V());
   const hand=shoulderWorld.clone().add(offsetHand);
   const pole=shoulderWorld.clone().add(V(sign*.14,-.28,-.22).applyQuaternion(a.root.quaternion));
   poseHand(a,side,hand,pole);
  }
 }
 stepHead(a.head,dt,moving?a.speed:0,params);applyHead(a,params.size);
}
function applyHead(a,size){
 const head=a.bones.Head;if(!head)return;
 head.scale.multiplyScalar(size);
 const q=head.getWorldQuaternion(new T.Quaternion());
 const rotation=new T.Quaternion().setFromEuler(new T.Euler(a.head.x,0,a.head.z));
 const rq=a.root.getWorldQuaternion(new T.Quaternion());rotation.premultiply(rq).multiply(rq.clone().invert());
 worldQuat(head,rotation.multiply(q));
}
export function setHipWorld(a,point,heading){
 a.gait=null;
 a.heading=heading;a.root.rotation.set(0,heading,0);
 a.root.position.copy(point).sub(a.local.Hips.clone().applyAxisAngle(Y,heading));a.root.updateMatrixWorld(true);
}
export function poseBoarding(a,car,p,params,dt){
 const poseKey=`seat:${params.size}:${car.steering.rotation.z.toFixed(2)}`;
 const seated=p.seat===1&&p.turn===1&&p.door===0;
 if(seated&&a.head.still>=.45&&a.lastPoseKey===poseKey&&!a.poseDirty)return;
 a.poseDirty=false;a.lastPoseKey=seated?poseKey:null;
 restoreActor(a);
 const carPoint=(x,y,z)=>car.root.localToWorld(V(x,y,z));
 const seat=car.seat.position;
 // Leading foot lands before hips descend; the outside foot stays planted until then.
 for(const side of ['Left','Right']){
  const lead=side==='Right',t=lead?p.lead:p.trail;
  const sign=side==='Left'?1:-1;
  const outside=carPoint(car.board.position.x+(lead?-.10:.10),a.local[side+'Foot'].y,car.board.position.z+sign*.12);
  const inside=carPoint(seat.x+sign*.115,car.floorY+.14,.34);
  const foot=outside.lerp(inside,t);foot.y+=Math.sin(t*Math.PI)*(car.type==='jeep'?.31:.23);
  const knee=carPoint(seat.x+sign*.18,seat.y,.9);
  poseFoot(a,side,foot,knee);
  const wheel=car.steering.localToWorld(V(sign*.15,.02,0));
  const shoulder=a.bones[side+'Arm']?.getWorldPosition(V());
  if(shoulder){
   const hang=shoulder.clone().add(V(0,-.46,0));
   const door=car.handle.getWorldPosition(V());
   const reach=side==='Left'?hang.lerp(door,p.reach):hang;
   reach.lerp(wheel,smooth((p.turn-.25)/.75));
   poseHand(a,side,reach,carPoint(seat.x+sign*.43,seat.y+.12,.03));
  }
 }
 stepHead(a.head,dt,0,params);applyHead(a,params.size);
}

// Directional articulated fall; ground and recovery targets are expressed in the
// actor's bind-facing space, so the same pose works across the three skeletons.
export function poseReaction(a,params){
 const r=a.reaction;if(!r)return;
 if(r.phase==='gettingUp'){poseRecovery(a,params);return;}
 a.gait=null;
 a.lastPoseKey=null;
 const falling=r.phase==='falling';
 const fall=falling?smooth(r.time/r.fallTime):1;
 const tilt=1.48*fall;
 const landingHeading=Math.atan2(r.dx,r.dz),startHeading=r.startHeading??landingHeading;
 a.heading=startHeading+Math.atan2(Math.sin(landingHeading-startHeading),Math.cos(landingHeading-startHeading))*fall;
 a.root.rotation.set(0,a.heading,0);a.root.rotateX(tilt);
 a.root.rotateZ((r.roll||0)*fall+Math.sin(fall*Math.PI)*.12*r.severity);
 a.root.position.y=(a.local.Hips?.y||.9)*(1-Math.cos(tilt))+(r.height||0);
 restoreActor(a);
 for(const [side,sign] of [['Left',1],['Right',-1]]){
  const f=a.local[side+'Foot'];if(!f)continue;
  const crouch=.35*fall;
  const buckle=Math.sin(fall*Math.PI)*(side==='Left'?.23:.08);
  const foot=V(f.x*1.25,f.y+crouch*.34+buckle,f.z+fall*.10+crouch*.18+buckle*.65);
  poseFoot(a,side,localWorld(a,foot),localWorld(a,V(sign*.25,.55,1)));
  const shoulder=a.local[side+'Arm'];if(!shoulder)continue;
  const brace=smooth(fall/.55);
  const hand=V(shoulder.x+sign*(.06+.16*brace),a.local.Hips.y+.02+.29*brace,.20*brace);
  poseHand(a,side,localWorld(a,hand),localWorld(a,V(sign*.65,1.08,-.12)));
 }
 // Small head recoil settles during the fall; no walking oscillator on the ground.
 a.head.x=falling?Math.sin(fall*Math.PI)*.12:0;a.head.z=0;a.head.vx=a.head.vz=0;
 applyHead(a,params.size);
 // Keep feet, hands and the enlarged head above the ground without a mesh scan.
 a.root.updateMatrixWorld(true);let lowest=Infinity;
 for(const name of ['Head','Hips','LeftFoot','RightFoot','LeftHand','RightHand']){
  const bone=a.bones[name];if(!bone)continue;
  const radius=name==='Head'?.13*params.size:name==='Hips'?.14:.035;
  lowest=Math.min(lowest,bone.getWorldPosition(ik[11]).y-radius);
 }
 const ground=.015+(r.height||0);
 if(Number.isFinite(lowest))a.root.position.y+=(ground-lowest)*(lowest<ground?1:fall);
}
// Recovery starts from the actual settled fall. Hands support the chest first,
// then one foot plants under the hips before the legs extend.
function poseRecovery(a,params){
 const r=a.reaction,t=Math.min(1,Math.max(0,r.time/1.45));
 if(!r.recovery){
  const phase=r.phase;r.phase='down';poseReaction(a,params);r.phase=phase;
  a.root.updateMatrixWorld(true);
  const points={};for(const name of ['Hips','LeftFoot','RightFoot','LeftHand','RightHand'])if(a.bones[name])points[name]=a.bones[name].getWorldPosition(V());
  r.recovery={points,origin:V(a.root.position.x,0,a.root.position.z)};
 }
 const {points,origin}=r.recovery;
 const heading=Math.atan2(r.dx,r.dz),toWorld=p=>p.applyAxisAngle(Y,heading).add(origin);
 const blend=(a,b,start,end)=>a+(b-a)*smooth((t-start)/(end-start));
 const push=smooth(t/.32),kneel=smooth((t-.25)/.35),stand=smooth((t-.6)/.4);
 const hip=points.Hips?.clone()||toWorld(V(0,.3,.8));
 hip.lerp(toWorld(V(0,.38,.65)),push).lerp(toWorld(V(0,.58,.12)),kneel).lerp(toWorld(a.local.Hips.clone()),stand);
 const tilt=blend(blend(1.48,1.05,0,.32),.38,.25,.6)*(1-stand);
 a.root.rotation.set(0,heading,0);a.root.rotateX(tilt);a.root.rotateZ((r.roll||0)*(1-push));
 a.root.position.copy(hip).sub(a.local.Hips.clone().applyQuaternion(a.root.quaternion));
 a.heading=heading;restoreActor(a);
 for(const [side,sign] of [['Left',1],['Right',-1]]){
  const f=a.local[side+'Foot'];if(!f)continue;
  const planted=toWorld(V(f.x,f.y,side==='Left'?.38:-.18));
  const step=smooth((t-(side==='Left'?.14:.04))/.35);
  const foot=points[side+'Foot'].clone().lerp(planted,step);
  foot.y+=Math.sin(step*Math.PI)*.12;
  foot.lerp(toWorld(f.clone()),stand);
  poseFoot(a,side,foot,toWorld(V(sign*.2,.35,.85)));
  if(!points[side+'Hand'])continue;
  const release=smooth((t-(side==='Left'?.48:.60))/.35);
  const shoulder=a.local[side+'Arm'];
  const reach=shoulder.distanceTo(a.local[side+'ForeArm'])+a.local[side+'ForeArm'].distanceTo(a.local[side+'Hand']);
  const relaxed=shoulder.clone().add(V(sign*.04,-1,0).normalize().multiplyScalar(reach*.975));
  const hand=points[side+'Hand'].clone().lerp(localWorld(a,relaxed),release);
  poseHand(a,side,hand,toWorld(V(sign*.65,.4,.6)));
 }
 a.head.x=-.12*Math.sin(t*Math.PI);a.head.z=0;a.head.vx=a.head.vz=0;applyHead(a,params.size);
 a.gait=null;a.lastPoseKey=null;a.poseDirty=true;
}
export function poseGuard(a){
 for(const [side,sign] of [['Left',1],['Right',-1]])poseHand(a,side,localWorld(a,V(sign*.19,1.29,.25)),localWorld(a,V(sign*.48,.95,.25)));
}
export function poseStrike(a,target,progress){
 if(a.attack?.kind){
  a.root.updateMatrixWorld(true);
  const feet={};for(const side of ['Left','Right'])if(a.bones[side+'Foot'])feet[side]=a.bones[side+'Foot'].getWorldPosition(V());
  const drive=punchDrive(a.attack,a.attack.time),hips=a.bones.Hips;
  if(hips){const p=hips.getWorldPosition(V()).add(V(Math.sin(a.heading)*drive.shift,0,Math.cos(a.heading)*drive.shift));hips.position.copy(hips.parent.worldToLocal(p));hips.rotation.y+=drive.turn*.25;}
  if(a.bones.Spine){a.bones.Spine.rotation.y+=drive.turn*.45;a.bones.Spine.rotation.x+=drive.lean;}
  if(a.bones.Spine1)a.bones.Spine1.rotation.y+=drive.turn*.3;
  const shoulder=a.bones[a.attack.side+'Shoulder'];if(shoulder){shoulder.rotation.y+=drive.shoulder;shoulder.rotation.z+=(a.attack.side==='Left'?1:-1)*drive.lean*.4;}
  a.root.updateMatrixWorld(true);
  for(const side of ['Left','Right'])if(feet[side])poseFoot(a,side,feet[side],localWorld(a,V(side==='Left'?.18:-.18,.5,.7)));
  a.root.updateMatrixWorld(true);poseGuard(a);poseHand(a,a.attack.side,new T.Vector3().copy(fistPoint(a,a.attack.time)),localWorld(a,V(a.attack.side==='Left'?.5:-.5,1.02,.42)));a.poseDirty=true;return;}

 a.root.updateMatrixWorld(true);
 const weight=Math.sin(Math.min(1,progress)*Math.PI);
 const hand=a.bones.RightHand;if(!hand)return;
 const start=hand.getWorldPosition(V());start.lerp(target,weight);
 poseHand(a,'Right',start,localWorld(a,V(-.55,1.05,.5)));
 a.poseDirty=true;
}

export function poseAim(a,target,{recoil=0,raise=1}={}){
 const forward=target.clone().sub(a.root.position);forward.y=0;
 if(forward.lengthSq()<1e-8)return;
 forward.normalize();
 // A world-space aim target must never pull the arms behind a stale body heading.
 a.heading=Math.atan2(forward.x,forward.z);a.root.rotation.set(0,a.heading,0);
 a.root.updateMatrixWorld(true);
 const right=V(forward.z,0,-forward.x),weight=smooth(raise);
 const hand=a.root.position.clone().addScaledVector(forward,.16+(.42-recoil*.075)*weight).addScaledVector(right,-.13);
 hand.y=a.root.position.y+1.01+(.28+recoil*.04)*weight;
 poseHand(a,'Right',hand,localWorld(a,V(-.45,1.08,.27)));
 const support=hand.clone().addScaledVector(right,.065).addScaledVector(forward,.035);support.y-=.025;
 poseHand(a,'Left',support,localWorld(a,V(.38,1.06,.23)));
 a.poseDirty=true;
}
