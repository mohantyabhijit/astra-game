import * as T from 'three';
export class GunEffects{
 constructor(scene){
  this.cursor=0;this.sparkCursor=0;this.lines=[];this.sparks=Array.from({length:32},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));this.dummy=new T.Object3D();
  const lineMat=new T.LineBasicMaterial({color:'#ffdaa2',transparent:true,opacity:.8,depthWrite:false});
  for(let i=0;i<8;i++){const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(6),3)),line=new T.Line(geometry,lineMat);line.visible=false;scene.add(line);this.lines.push({line,life:0});}
  this.mesh=new T.InstancedMesh(new T.OctahedronGeometry(.025,0),new T.MeshBasicMaterial({color:'#ffc66b',toneMapped:false}),32);this.mesh.frustumCulled=false;scene.add(this.mesh);this.clear();
 }
 shot(from,to,impact=false){
  const t=this.lines[this.cursor++%8],p=t.line.geometry.attributes.position;p.setXYZ(0,from.x,from.y,from.z);p.setXYZ(1,to.x,to.y,to.z);p.needsUpdate=true;t.line.geometry.computeBoundingSphere();t.life=.055;t.line.visible=true;
  if(impact)for(let i=0;i<5;i++){const p=this.sparks[this.sparkCursor++%32],angle=i*2.4;Object.assign(p,{life:.32,x:to.x,y:Math.max(.04,to.y),z:to.z,vx:Math.cos(angle)*1.7,vy:1.2+i*.15,vz:Math.sin(angle)*1.7});}
 }
 clear(){for(const t of this.lines){t.life=0;t.line.visible=false;}for(const s of this.sparks)s.life=0;this.update(0);}
 update(dt){
  for(const t of this.lines){t.life-=dt;t.line.visible=t.life>0;}
  let active=0;for(let i=0;i<32;i++){const p=this.sparks[i];p.life=Math.max(0,p.life-dt);if(p.life>0){active++;p.x+=p.vx*dt;p.y=Math.max(.025,p.y+p.vy*dt);p.z+=p.vz*dt;p.vy-=9.8*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(p.life/.32);}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);}
  this.mesh.visible=active>0;if(active||dt===0)this.mesh.instanceMatrix.needsUpdate=true;
 }
}

// Original synthesized sound, unlocked only by a browser user gesture.
export class ShotAudio{
 constructor(){this.enabled=true;this.context=null;}
 unlock(){
  if(typeof window==='undefined')return;
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
  try{this.context??=new Context();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{}
 }
 play(distance=8){
  const c=this.context;if(!this.enabled||!c||c.state!=='running')return;
  this.noise??=c.createBuffer(1,Math.ceil(c.sampleRate*.16),c.sampleRate);
  if(!this.ready){const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*7);this.ready=true;}
  const t=c.currentTime,g=c.createGain(),source=c.createBufferSource(),filter=c.createBiquadFilter();
  filter.type='highpass';filter.frequency.value=650;g.gain.setValueAtTime(.16/(1+distance*.035),t);g.gain.exponentialRampToValueAtTime(.001,t+.15);source.buffer=this.noise;source.connect(filter);filter.connect(g);g.connect(c.destination);source.start(t);source.stop(t+.16);source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};
  const body=c.createOscillator(),low=c.createGain();body.frequency.setValueAtTime(135,t);body.frequency.exponentialRampToValueAtTime(45,t+.09);low.gain.setValueAtTime(.09,t);low.gain.exponentialRampToValueAtTime(.001,t+.1);body.connect(low);low.connect(c.destination);body.start(t);body.stop(t+.11);body.onended=()=>{body.disconnect();low.disconnect();};
 }
}
