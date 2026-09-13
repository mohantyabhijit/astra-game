import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Local +Z is the face of the sculpt. The arc ends in the receiving pool.
export function fountainPoint(t,out=V()){
 return out.set(0,6.23+.35*t-6.32*t*t,1.85+6.1*t);
}
class JetCurve extends T.Curve {getPoint(t,target=V()){return fountainPoint(t,target);}}
export function createMerlion(model){
 const root=new T.Group();root.name='Merlion monument';
 const stone=new T.MeshStandardMaterial({color:'#d4d0c7',roughness:.86,metalness:0,vertexColors:true,envMapIntensity:.35});
 model.traverse(o=>{if(o.isMesh){o.material=stone;o.castShadow=o.receiveShadow=true;}});model.position.y=.12;root.add(model);
 function mesh(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;root.add(o);return o;}
 const paving=new T.MeshStandardMaterial({color:'#b5b2a9',roughness:.95});
 mesh(new T.CylinderGeometry(3.35,3.5,.12,64),paving,0,.06,0);
 const rim=new T.MeshStandardMaterial({color:'#8c9996',roughness:.78});
 mesh(new T.CylinderGeometry(3,3.12,.2,64),rim,0,.1,7.95);
 const water=new T.MeshStandardMaterial({color:'#589795',roughness:.23,metalness:.28});
 const pool=mesh(new T.CircleGeometry(2.87,64),water,0,.205,7.95);pool.rotation.x=-Math.PI/2;
 const jetMaterial=new T.MeshStandardMaterial({color:'#e7f7fa',roughness:.28,metalness:.08,transparent:true,opacity:.72,depthWrite:false});
 const jet=mesh(new T.TubeGeometry(new JetCurve(),56,.095,8,false),jetMaterial,0,0,0);jet.castShadow=false;
 const droplets=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({color:'#e9ffff',transparent:true,opacity:.65,depthWrite:false}),80);droplets.instanceMatrix.setUsage(T.DynamicDrawUsage);droplets.frustumCulled=false;root.add(droplets);
 const rings=[];for(let i=0;i<3;i++){const ring=mesh(new T.RingGeometry(.94,1,48),new T.MeshBasicMaterial({color:'#c2e8df',transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false}),0,.217+i*.001,7.95);ring.rotation.x=-Math.PI/2;rings.push(ring);}
 const dummy=new T.Object3D(),p=V(),local=V();
 const result={root,lookHeight:4.25,update(time){
  for(let i=0;i<80;i++){
   if(i<48){const t=(time*.7+i/48)%1;fountainPoint(t,p);const spread=.025+t*t*.13;p.x+=Math.sin(i*7.31)*spread;p.z+=Math.cos(i*3.79)*spread;dummy.position.copy(p);dummy.scale.setScalar(.018+t*.035);dummy.scale.y*=1.6;}
   else{const t=(time*1.3+(i-48)/32)%1,angle=i*2.399;dummy.position.set(Math.cos(angle)*t*.9,.22+Math.sin(t*Math.PI)*.55,7.95+Math.sin(angle)*t*.9);dummy.scale.setScalar(.035*(1-t)+.008);}
   dummy.updateMatrix();droplets.setMatrixAt(i,dummy.matrix);
  }droplets.instanceMatrix.needsUpdate=true;
  rings.forEach((r,i)=>{const t=(time*.45+i/3)%1;r.scale.setScalar(.18+2.3*t);r.material.opacity=.4*(1-t);});
 },blocks(point,padding=0){root.updateWorldMatrix(true,false);local.set(point.x,0,point.z);root.worldToLocal(local);return Math.hypot(local.x,local.z)<3.4+padding||Math.hypot(local.x,local.z-7.95)<3.05+padding;}};
 result.update(0);return result;
}
