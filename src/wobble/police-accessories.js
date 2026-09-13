// Accessory poses imported from wobble-heads 9afd4d2.
import * as T from 'three';
const point=new T.Vector3();
export function dressPolice(actor){
 actor.police=true;actor.name='Police officer';actor.fireCooldown=.8;actor.recoil=0;actor.flashTime=0;
 const gold=new T.MeshStandardMaterial({color:'#d9b764',metalness:.6,roughness:.35});
 actor.policeBadge=new T.Mesh(new T.BoxGeometry(.07,.09,.015),gold);actor.root.add(actor.policeBadge);
 const steel=new T.MeshStandardMaterial({color:'#303840',metalness:.7,roughness:.3}),gripMat=new T.MeshStandardMaterial({color:'#171d23',roughness:.9});
 actor.gun=new T.Group();actor.gun.name='police-sidearm';actor.root.add(actor.gun);
 const part=(w,h,d,m,x,y,z)=>{const p=new T.Mesh(new T.BoxGeometry(w,h,d),m);p.position.set(x,y,z);actor.gun.add(p);return p;};
 actor.slide=part(.075,.075,.26,steel,0,.015,.10);part(.068,.045,.22,gripMat,0,-.043,.075);const grip=part(.064,.14,.09,gripMat,0,-.102,.01);grip.rotation.x=-.20;
 part(.012,.017,.025,gripMat,0,.06,.20);part(.045,.013,.025,gripMat,0,.06,-.005);
 const barrel=new T.Mesh(new T.CylinderGeometry(.017,.017,.035,10),gripMat);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.015,.244);actor.gun.add(barrel);
 actor.muzzle=new T.Object3D();actor.muzzle.position.set(0,.015,.27);actor.gun.add(actor.muzzle);
 actor.muzzleFlash=new T.Group();actor.muzzleFlash.name='muzzle-flash';actor.muzzle.add(actor.muzzleFlash);
 const flashMat=new T.MeshBasicMaterial({color:'#ffe7a0',transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 for(const [radius,length] of [[.065,.27],[.035,.16]]){const flash=new T.Mesh(new T.ConeGeometry(radius,length,5,1,true),flashMat);flash.rotation.x=Math.PI/2;flash.position.z=length/2;actor.muzzleFlash.add(flash);}actor.muzzleFlash.visible=false;
}
export function updatePoliceAccessories(actor){
 const spine=actor.bones.Spine1||actor.bones.Spine;if(spine){spine.getWorldPosition(point);actor.policeBadge.position.copy(actor.root.worldToLocal(point));actor.policeBadge.position.add(new T.Vector3(-.10,0,.13));}
 const hand=actor.bones.RightHand;if(hand){hand.getWorldPosition(point);actor.gun.position.copy(actor.root.worldToLocal(point));}else actor.gun.position.set(0,1.3,.5);
 actor.gun.rotation.set(actor.aiming?0:.75,0,0);
 if(actor.aiming&&actor.aimTarget){actor.gun.updateWorldMatrix(true,false);actor.gun.lookAt(actor.aimTarget);actor.gun.rotateX(-actor.recoil*.12);}
 actor.slide.position.z=.10-actor.recoil*.028;actor.muzzleFlash.visible=actor.flashTime>0;
 actor.root.updateMatrixWorld(true);
}
