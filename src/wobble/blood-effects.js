// Adapted from wobble-heads/prototype/js/effects.js; retain pooled particles.
import * as T from 'three';
const CAPACITY=48;
export class BloodEffects {
 constructor(scene){
  this.items=Array.from({length:CAPACITY},()=>({age:99,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0}));this.cursor=0;
  this.dummy=new T.Object3D();this.color=new T.Color();this.red=new T.Color('#741e19');this.ground=new T.Color('#737a79');
  this.mesh=new T.InstancedMesh(new T.CircleGeometry(1,10),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,depthWrite:false,transparent:true,opacity:.76}),CAPACITY);
  this.mesh.name='pooled-blood-drops';this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(this.mesh);this.clear();
 }
 burst(x,y,z,dx,dz,groundY=0){
  this.pending=true;
  for(let i=0;i<12;i++){
   const p=this.items[this.cursor++%CAPACITY],a=i*2.399;
   Object.assign(p,{age:0,x,y,z,groundY,vx:dx*.55+Math.cos(a)*.6,vy:.8+(i%3)*.25,vz:dz*.55+Math.sin(a)*.6,size:.07+(i%3)*.025});
  }
 }
 clear(){this.pending=true;for(const p of this.items)p.age=99;this.update(0);}
 update(dt){
  if(!this.pending&&this.active===0&&dt>0)return;this.pending=false;
  let active=0;
  for(let i=0;i<CAPACITY;i++){
   const p=this.items[i];p.age+=dt;
   if(p.age<8){
    active++;if(p.y>(p.groundY||0)+.045){p.vy-=9.8*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y=Math.max((p.groundY||0)+.044,p.y+p.vy*dt);}
    const fade=Math.max(0,(p.age-5)/3);this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(-Math.PI/2,0,i*.8);
    const size=p.size*(p.y<=(p.groundY||0)+.045?1.7:1)*(1-fade);this.dummy.scale.set(size,size*(p.y<=(p.groundY||0)+.045?.65:1),size);
    this.color.copy(this.red).lerp(this.ground,fade);this.mesh.setColorAt(i,this.color);
   }else this.dummy.scale.setScalar(0);
   this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
  }
  this.mesh.visible=active>0;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;this.active=active;
 }
}
