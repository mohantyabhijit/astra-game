import * as T from 'three';

const DURATION=3.6;
const REDUCED_DURATION=.8;
const SPARK_COUNT=32;

function makeOverlay(onSkip){
 if(typeof document==='undefined'||!document.body)return null;
 const overlay=document.createElement('section');overlay.className='police-intro';overlay.hidden=true;
 overlay.setAttribute('aria-label','Police encounter introduction');
 const rule=document.createElement('span');rule.className='police-intro__rule';rule.setAttribute('aria-hidden','true');
 const title=document.createElement('strong');title.className='police-intro__title';title.textContent='POLICE';
 const subtitle=document.createElement('span');subtitle.className='police-intro__subtitle';subtitle.textContent='YOU HAVE THEIR ATTENTION';
 const skip=document.createElement('button');skip.className='police-intro__skip';skip.type='button';skip.textContent='Skip';
 skip.setAttribute('aria-label','Skip police introduction');skip.addEventListener('click',onSkip);
 overlay.append(rule,title,subtitle,skip);document.body.append(overlay);return overlay;
}

export class PoliceIntro{
 constructor(scene,{onSkip,reducedMotion=false}={}){
  this.active=false;this.actor=null;this.progress=0;this.elapsed=0;
  this.duration=reducedMotion?REDUCED_DURATION:DURATION;this.returnDuration=.6;
  this.reducedMotion=!!reducedMotion;this.onSkip=typeof onSkip==='function'?onSkip:()=>{};
  this.target=new T.Vector3();this._dummy=new T.Object3D();
  this._sparkData=new Float32Array(SPARK_COUNT*4);
  for(let i=0;i<SPARK_COUNT;i++){
   const p=i*4;this._sparkData[p]=i/SPARK_COUNT*Math.PI*2;
   this._sparkData[p+1]=.42+(i*17%13)/13*1.15;
   this._sparkData[p+2]=.08+(i*11%17)/17*1.65;
   this._sparkData[p+3]=.72+(i*7%9)/9*.75;
  }
  const geometry=new T.OctahedronGeometry(.035,0);
  const material=new T.MeshBasicMaterial({color:'#ffe5a1',transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending});
  this.sparkMesh=new T.InstancedMesh(geometry,material,SPARK_COUNT);this.sparkMesh.name='police-intro-sparks';
  this.sparkMesh.frustumCulled=false;this.sparkMesh.visible=false;if(scene?.add)scene.add(this.sparkMesh);
  this.overlay=makeOverlay(()=>this.onSkip());
 }
 start(actor){
  if(!actor?.root)return false;
  if(this.active)this.cancel();
  this.actor=actor;this.active=true;this.elapsed=0;this.progress=0;
  actor.root.updateMatrixWorld?.(true);
  if(actor.root.getWorldPosition)actor.root.getWorldPosition(this.target);else this.target.copy(actor.root.position);
  this.sparkMesh.visible=!this.reducedMotion;
  if(this.overlay){this.overlay.hidden=false;this.overlay.classList.toggle('police-intro--reduced',this.reducedMotion);}
  this._updateSparks();return true;
 }
 update(dt){
  if(!this.active)return false;
  this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,Number.isFinite(dt)?dt:0));
  this.progress=this.duration?this.elapsed/this.duration:1;
  if(!this.reducedMotion)this._updateSparks();
  if(this.elapsed>=this.duration){this.progress=1;this._finish();return false;}
  return true;
 }
 camera(out={}){
  const p=this.reducedMotion?0:this.progress,angle=p*Math.PI*2,radius=4.15;
  out.x=this.target.x+Math.cos(angle)*radius;
  out.y=this.target.y+1.62+(this.reducedMotion?0:Math.sin(Math.PI*p)*.72);
  out.z=this.target.z+Math.sin(angle)*radius;
  out.lookX=this.target.x;out.lookY=this.target.y+1.12;out.lookZ=this.target.z;
  return out;
 }
 cancel(){
  const wasActive=this.active;this._finish();return wasActive;
 }
 _finish(){
  this.active=false;this.actor=null;this.sparkMesh.visible=false;
  if(this.overlay)this.overlay.hidden=true;
 }
 _updateSparks(){
  const time=this.elapsed,d=this._sparkData,o=this._dummy;
  for(let i=0;i<SPARK_COUNT;i++){
   const p=i*4,a=d[p]+time*d[p+3],pulse=.55+.45*Math.sin(time*7+i*1.7);
   o.position.set(this.target.x+Math.cos(a)*d[p+1],this.target.y+.32+d[p+2]+Math.sin(time*2+i)*.12,this.target.z+Math.sin(a)*d[p+1]);
   o.rotation.set(a,time*2+i,a*.5);o.scale.setScalar(.45+pulse*.85);o.updateMatrix();this.sparkMesh.setMatrixAt(i,o.matrix);
  }
  this.sparkMesh.instanceMatrix.needsUpdate=true;
 }
}
