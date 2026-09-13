import * as T from 'three';
import {batchRigidMeshes} from './performance.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rubber=new T.MeshStandardMaterial({color:'#171b1c',roughness:.92});
const trim=new T.MeshStandardMaterial({color:'#242c2c',roughness:.58,metalness:.15});
const chrome=new T.MeshStandardMaterial({color:'#d6dddd',metalness:.9,roughness:.24});
const leather=new T.MeshStandardMaterial({color:'#343a36',roughness:.95});
const tan=new T.MeshStandardMaterial({color:'#b28354',roughness:.88});
const glass=new T.MeshPhysicalMaterial({color:'#a5c3c5',metalness:.08,roughness:.13,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});
const lockedGlass=new T.MeshStandardMaterial({color:'#101719',metalness:.18,roughness:.32,side:T.DoubleSide});
const lamp=new T.MeshStandardMaterial({color:'#fff5d8',emissive:'#fff1c7',emissiveIntensity:.6});
const redLamp=new T.MeshStandardMaterial({color:'#a8231d',emissive:'#ef3922',emissiveIntensity:.4});
const amber=new T.MeshStandardMaterial({color:'#e19b31',emissive:'#d79030',emissiveIntensity:.2});
const red=new T.MeshStandardMaterial({color:'#b93925',metalness:.45,roughness:.35});
glass.forceSinglePass=true;
const geoCache=new Map();
function cached(key,fn){if(!geoCache.has(key))geoCache.set(key,fn());return geoCache.get(key);}
function mesh(parent,geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=!mat.transparent;o.receiveShadow=true;parent.add(o);return o;}
function box(p,w,h,d,m,x,y,z,r=.025){
 if(Math.min(w,h,d)<.07)r=0;
 const key=`b:${w}:${h}:${d}:${r}`;
 return mesh(p,cached(key,()=>r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d)),m,x,y,z);
}
function cyl(p,r,d,m,x,y,z,axis='z',segments=24){
 const o=mesh(p,cached(`c:${r}:${d}:${segments}`,()=>new T.CylinderGeometry(r,r,d,segments)),m,x,y,z);
 if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;
}
function tube(p,a,b,r,m){
 const va=new T.Vector3(...a),vb=new T.Vector3(...b),delta=vb.clone().sub(va);
 const o=mesh(p,cached(`tube:${r}:${delta.length().toFixed(5)}`,()=>new T.CylinderGeometry(r,r,delta.length(),8)),m);
 o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
}
function torus(p,r,t,m,x,y,z,axis='z'){
 const o=mesh(p,cached(`t:${r}:${t}`,()=>new T.TorusGeometry(r,t,6,20)),m,x,y,z);if(axis==='x')o.rotation.y=Math.PI/2;return o;
}
function wheel(p,x,z,r,offroad,simple=false){
 const steer=new T.Group();steer.position.set(x,r,z);p.add(steer);
 const spin=new T.Group();steer.add(spin);
 cyl(spin,r,offroad?.29:.22,rubber,0,0,0,'x',32);
 if(simple){
  for(const side of [-1,1])cyl(spin,r*.58,.03,trim,side*.125,0,0,'x',12);
  spin.userData.steer=steer;spin.userData.front=z>0;return spin;
 }
 for(const side of [-1,1]){
  torus(spin,r*.78,r*.17,rubber,side*(offroad?.13:.1),0,0,'x');
  cyl(spin,r*.61,.025,trim,side*.154,0,0,'x');
  torus(spin,r*.58,.018,chrome,side*.173,0,0,'x');
  for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5;
   const spoke=box(spin,.035,r*.49,.045,chrome,side*.177,Math.cos(a)*r*.27,Math.sin(a)*r*.27,.009);spoke.rotation.x=a;
  }
  cyl(spin,r*.15,.04,chrome,side*.19,0,0,'x',12);
 }
 if(offroad)for(let i=0;i<28;i++){
  const a=i*Math.PI*2/28;
  const block=box(spin,.28,.047,.07,rubber,0,Math.cos(a)*r,Math.sin(a)*r,.007);block.rotation.x=a;
 }
 spin.userData.steer=steer;spin.userData.front=z>0;return spin;
}
function seat(p,x,y,z,mat){
 const base=box(p,.55,.15,.55,mat,x,y,z,.07);base.userData.vehiclePart='seatBase';
 const back=box(p,.56,.61,.14,mat,x,y+.31,z-.24,.06);back.rotation.x=-.10;
 box(p,.3,.22,.13,mat,x,y+.71,z-.28,.06);
 for(const dx of [-.21,.21])box(p,.075,.12,.48,mat,x+dx,y+.09,z,.03);
 for(const dx of [-.13,0,.13])box(p,.009,.39,.009,trim,x+dx,y+.34,z-.158,.002);
}
function sidePane(p,x,points,mat,part='window'){
 const half=.013,positions=[],indices=[];
 for(const xx of [-half,half])for(const [y,z] of points)positions.push(xx,y,z);
 indices.push(0,1,2,0,2,3,4,6,5,4,7,6);
 for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(i,j,j+4,i,j+4,i+4);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
 const o=mesh(p,g,mat,x,0,0);o.userData.vehiclePart=part;return o;
}
function arch(p,x,z,y,r,offroad){
 // Half-ring fender leaves the wheel well genuinely open.
 const s=new T.Shape();const inner=r+.035,outer=r+(offroad?.18:.10);
 for(let i=0;i<=20;i++){const a=i*Math.PI/20;const xx=Math.cos(a)*outer,yy=Math.sin(a)*outer;i?s.lineTo(xx,yy):s.moveTo(xx,yy);}
 for(let i=20;i>=0;i--){const a=i*Math.PI/20;s.lineTo(Math.cos(a)*inner,Math.sin(a)*inner);}s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:offroad?.32:.12,bevelEnabled:false,steps:1});g.rotateY(Math.PI/2);
 const o=mesh(p,g,trim,x,y,z);return o;
}
function marker(p,x,y,z){const o=new T.Object3D();o.position.set(x,y,z);p.add(o);return o;}
function windowBox(p,w,h,d,m,x,y,z,r=0){const o=box(p,w,h,d,m,x,y,z,r);o.userData.vehiclePart='window';return o;}

export function createVehicle(type='jeep',color,{batch=true}={}){
 const jeep=type==='jeep',mini=type==='mini',sports=type==='sports',van=type==='van',hatch=type==='hatch';
 const playerUsable=jeep||mini||sports,locked=!playerUsable;
 const openTop=jeep||mini||sports;
 const width=jeep?1.92:sports?2.08:van?1.91:1.76,length=jeep?4.05:mini?3.82:sports?4.42:van?4.7:hatch?3.9:4.55;
 const radius=jeep?.43:van?.35:sports?.34:.32,axle=jeep?1.27:van?1.51:mini?1.2:hatch?1.22:sports?1.42:1.43;
 const floorY=jeep?.54:sports?.27:.30,belt=jeep?1.14:van?1.2:sports?.82:.94,seatY=jeep?.87:sports?.54:.64;
 const root=new T.Group();root.name=type;
 const paint=new T.MeshPhysicalMaterial({color:color||(jeep?'#687b54':mini?'#b8322a':sports?'#d0442f':'#577b90'),metalness:.32,roughness:.3,clearcoat:.65,clearcoatRoughness:.3});
 const interior=mini?tan:leather;
 const glazing=locked?lockedGlass:glass;
 box(root,width-.15,.12,length-.25,trim,0,floorY-.04,0,.035);
 // Engine and rear quarters stop at the cabin; there is no solid block under the occupants.
 box(root,width-.19,belt-floorY,sports?1.48:jeep?1.1:1.07,paint,0,(belt+floorY)/2,sports?length/2-.77:length/2-.59,jeep?.045:.15);
 box(root,width-.13,belt-floorY,jeep?.78:.65,paint,0,(belt+floorY)/2,-length/2+.4,jeep?.045:.13);
 const hood=box(root,width-.25,.105,sports?1.46:jeep?1.08:1.04,paint,0,belt+.035,sports?length/2-.78:length/2-.59,jeep?.025:.13);hood.rotation.x=jeep?0:sports?.14:.045;
 if(sports)for(const side of [-1,1]){
  const fender=box(root,.38,.27,1.42,paint,side*(width/2-.25),.67,1.42,.10);fender.rotation.x=.10;
  box(root,.18,.035,.76,trim,side*.46,.86,1.38,.012).rotation.x=.14;
 }
 for(const side of [-1,1]){
  box(root,.12,.15,1.65,paint,side*(width/2-.08),floorY+.06,-.04,.04);
  // quarter panels outside the door aperture; arches wrap around the tires.
  for(const z of [-axle,axle]){
   arch(root,side>0?width/2-.10:-width/2-(jeep?.22:.02),z,radius,radius,jeep);
  }
  box(root,.13,.30,.42,paint,side*(width/2-.09),belt-.14,-.94,.04);
  if(jeep){
   box(root,.30,.075,1.70,trim,side*(width/2+.09),.43,-.1,.025);
   for(const z of [-axle,axle])box(root,.37,.075,.81,trim,side*(width/2+.015),radius*2+.10,z,.025);
   box(root,.11,.18,.08,trim,side*.64,1.08,1.36,.012);
  }
 }
 const wheels=[];for(const sx of [-1,1])for(const z of [-axle,axle])wheels.push(wheel(root,sx*(width/2-.015),z,radius,jeep,locked));
 // Bumpers, lower grilles and plates.
 for(const end of [-1,1]){
  box(root,width+.03,.19,.18,jeep?trim:paint,0,jeep?.56:.42,end*(length/2),.055);
  box(root,.40,.13,.025,chrome,0,jeep?.64:.48,end*(length/2+.10),.014);
  if(end<0)for(const sx of [-1,1])box(root,jeep?.19:.25,jeep?.22:.13,.065,redLamp,sx*(width/2-.22),belt-.18,-length/2-.01,.045);
 }
 if(jeep){
  box(root,1.58,.54,.10,paint,0,1.02,length/2-.045,.035);
  for(let i=-3;i<=3;i++)box(root,.095,.34,.04,trim,i*.145,1.02,length/2+.012,.038);
  for(const x of [-.63,.63]){
   cyl(root,.168,.045,trim,x,1.10,length/2+.015);
   cyl(root,.132,.047,lamp,x,1.10,length/2+.04);
   torus(root,.132,.012,chrome,x,1.10,length/2+.07);
   box(root,.17,.06,.05,amber,x,.83,length/2+.04,.018);
   torus(root,.065,.018,red,x,.59,length/2+.12);
  }
  // Rear spare and carrier.
  tube(root,[0,.60,-length/2],[0,1.25,-length/2],.045,trim);
  cyl(root,.43,.26,rubber,0,1.11,-length/2-.17,'z',32);
  torus(root,.32,.09,rubber,0,1.11,-length/2-.31);
  cyl(root,.245,.03,trim,0,1.11,-length/2-.32);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cyl(root,.026,.04,chrome,Math.sin(a)*.15,1.11+Math.cos(a)*.15,-length/2-.35);}
 }else if(mini){
  box(root,1.07,.27,.09,trim,0,.63,length/2+.015,.115);
  for(const y of [.55,.63,.71])box(root,.86,.014,.035,chrome,0,y,length/2+.067,.006);
  for(const sx of [-1,1]){
   const lampG=new T.Group();lampG.position.set(sx*.61,.94,length/2-.04);lampG.rotation.x=-.2;root.add(lampG);
   cyl(lampG,.19,.06,chrome,0,0,0);cyl(lampG,.157,.064,trim,0,0,.015);torus(lampG,.145,.017,lamp,0,0,.053);cyl(lampG,.08,.07,lamp,0,0,.02);
   cyl(root,.065,.045,lamp,sx*.66,.43,length/2+.05);
   box(root,.105,.012,.94,chrome,sx*.31,belt+.094,length/2-.64,.004);
  }
  // Folded fabric roof behind the rear bench, leaving the full cabin open.
  for(let i=0;i<3;i++)box(root,1.35,.075,.14,trim,0,belt+.015+i*.021,-1.29-i*.10,.035);
 }else{
  box(root,1.13,.20,.06,trim,0,.61,length/2+.02,.06);
  for(const sx of [-1,1])box(root,.42,.13,.065,lamp,sx*.59,.87,length/2+.035,.045);
  if(sports){
   box(root,1.70,.055,.38,trim,0,.43,length/2+.08,.018);
   box(root,1.34,.055,.34,trim,0,.49,-length/2+.12,.018);
   for(const sx of [-1,1])box(root,.08,.22,.18,trim,sx*.61,.59,-length/2+.18,.018);
   for(const sx of [-1,1])box(root,.38,.10,.035,trim,sx*.56,.48,length/2+.11,.025);
   for(const sx of [-1,1])box(root,.075,.025,1.18,chrome,sx*.68,.89,1.34,.006).rotation.x=.14;
  }
 }
 // Windshield rake is built from four edges and a transparent pane.
 const windZ=jeep?.69:sports?.58:.68, windBottom=belt+.055,windTop=jeep?1.95:van?2.10:sports?1.34:1.60,rake=jeep?.12:sports?.38:.28;
 const ww=width-.24,dh=windTop-windBottom;
 const wind=windowBox(root,ww-.10,Math.hypot(dh,rake),.024,glazing,0,(windTop+windBottom)/2,windZ-rake/2,0);wind.rotation.x=-Math.atan2(rake,dh);
 for(const side of [-1,1])tube(root,[side*ww/2,windBottom,windZ],[side*ww/2,windTop,windZ-rake],jeep?.045:.033,jeep?paint:trim);
 tube(root,[-ww/2,windTop,windZ-rake],[ww/2,windTop,windZ-rake],.035,trim);
 box(root,ww,.065,.10,trim,0,windBottom,windZ,.015);
 for(const x of [-.38,.25])tube(root,[x-.15,windBottom+.015,windZ+.03],[x+.13,windBottom+.08,windZ+.025],.011,trim);
 const sx=.41,sz=-.17;
 let steering=null;
 if(playerUsable){
  // Only enterable cars pay for geometry hidden below the glass line.
  box(root,width-.28,.17,.26,trim,0,belt-.02,.62,.05);
  box(root,.23,.18,1.22,trim,0,floorY+.17,-.02,.04);
  for(const x of [-sx,sx])seat(root,x,seatY,sz,interior);
  if(!sports)for(const x of [-sx,sx])seat(root,x,seatY-.02,-.96,interior);
  steering=new T.Group();steering.position.set(sx,seatY+.39,.35);steering.rotation.x=-.38;root.add(steering);
  torus(steering,.18,.022,trim,0,0,0);cyl(steering,.055,.025,trim,0,0,0);
  for(const a of [0,2.1,4.2])tube(steering,[0,0,0],[Math.sin(a)*.16,Math.cos(a)*.16,0],.012,chrome);
  tube(root,[sx,belt-.10,.59],[sx,seatY+.39,.35],.045,trim);
  cyl(root,mini?.115:.065,.02,chrome,mini?0:sx,belt+.025,.473);
  cyl(root,mini?.095:.05,.023,trim,mini?0:sx,belt+.025,.459);
  tube(root,[0,floorY+.19,.04],[0,floorY+.37,.08],.017,chrome);
  box(root,.055,.055,.07,trim,0,floorY+.39,.08,.023);
 }
 let doorPivot,handle;
 for(const side of [-1,1]){
  const pivot=playerUsable?new T.Group():root;if(playerUsable){pivot.position.set(side*(width/2-.04),floorY+.09,.67);root.add(pivot);}
  const door=box(pivot,.09,belt-floorY-.10,1.39,paint,side*.015,(belt-floorY-.10)/2,-.695,jeep?.018:.04);door.name='door';
  if(!playerUsable){door.position.x=side*(width/2-.04);door.position.y=floorY+.09+(belt-floorY-.10)/2;door.position.z=-.025;continue;}
  box(pivot,.055,.19,1.19,interior,-side*.052,.30,-.70,.025);
  box(pivot,.12,.06,1.35,jeep?trim:chrome,0,belt-floorY-.09,-.695,.013);
  if(sports){
   sidePane(pivot,side*.015,[[.49,-.18],[.88,-.22],[.91,-1.30],[.49,-1.34]],glass,'frontDoorWindow');
  }
  box(pivot,.042,.045,.17,jeep?trim:chrome,side*.073,belt-floorY-.23,-1.13,.015);
  tube(pivot,[side*.015,.34,-.09],[side*.22,.49,-.02],.025,trim);
  box(pivot,.23,.14,.14,mini?chrome:paint,side*.25,.50,-.025,.055);
  box(pivot,.19,.105,.012,chrome,side*.25,.50,-.103,.026);
  if(jeep)for(const h of [.15,.42])box(pivot,.05,.065,.12,paint,side*.075,h,-.04,.013);
  if(side===1){doorPivot=pivot;handle=marker(pivot,.10,belt-floorY-.23,-1.13);}
 }
 if(jeep){
  // Exposed safety cage, no roof panels.
  for(const x of [-.73,.73]){
   tube(root,[x,belt,-.67],[x,1.99,-.67],.052,trim);
   tube(root,[x,1.99,-.67],[x,1.25,-1.61],.052,trim);
  }
  tube(root,[-.73,1.99,-.67],[.73,1.99,-.67],.052,trim);
 }else if(sports){
  // Open targa center clears the game's enlarged driver head; the rear hoop and
  // descending deck retain a fastback profile without a roof over the seats.
  for(const side of [-1,1]){
   tube(root,[side*(width/2-.12),belt,-.70],[side*(width/2-.14),1.34,-.70],.052,paint);
   sidePane(root,side*(width/2-.13),[[belt+.02,-.73],[1.27,-.75],[.94,-1.39],[belt+.02,-1.40]],glass);
  }
  tube(root,[-(width/2-.12),1.34,-.70],[width/2-.12,1.34,-.70],.052,trim);
  const fastback=box(root,width-.23,.09,.98,paint,0,1.08,-1.18,.055);fastback.rotation.x=-.38;
  const rearGlass=windowBox(root,width-.31,.025,.58,glass,0,1.16,-.94,.005);rearGlass.rotation.x=-.38;
  box(root,width-.12,.08,.72,paint,0,.84,-1.67,.045).rotation.x=-.08;
 }else if(!openTop){
  const roofY=van?2.12:sports?1.36:1.57,rearZ=van?-1.86:hatch?-1.22:sports?-1.02:-.93;
  box(root,width-.28,.10,.5-rearZ,paint,0,roofY,(.5+rearZ)/2,.065);
  windowBox(root,width-.3,van?.84:sports?.35:.43,.035,glazing,0,van?1.65:sports?1.16:1.29,rearZ,.01);
  for(const side of [-1,1]){
   windowBox(root,.034,roofY-belt-.1,.5-rearZ,glazing,side*(width/2-.13),(roofY+belt)/2,(.5+rearZ)/2,.01);
   for(const z of [-.18,rearZ])tube(root,[side*(width/2-.12),belt,z],[side*(width/2-.14),roofY,z],.043,paint);
   if(van)box(root,.06,.85,1.76,paint,side*(width/2-.11),1.60,-.98,.025);
  }
  if(van){box(root,width-.16,1.50,.10,paint,0,1.27,-length/2+.14,.06);box(root,.018,1.27,.02,trim,0,1.25,-length/2+.078,.003);}
 }
 const board=marker(root,width/2+.53,0,-.98);
 const seatAnchor=playerUsable?marker(root,sx,seatY+.11,sz-.045):null;
 const profile=sports?{maxSpeed:24,acceleration:9,reverseSpeed:5}:{maxSpeed:8,acceleration:4,reverseSpeed:3.5};
 const c={type,root,width,length,wheelRadius:radius,wheelbase:axle*2,wheels,openTop,playerUsable,...profile,doorPivot,handle,seat:seatAnchor,board,floorY,steering,driver:null,speed:0,heading:0,doorOpen:0};
 c.setDoor=value=>{c.doorOpen=value;if(doorPivot)doorPivot.rotation.y=-1.15*value;};
 const boundaries=new Set([doorPivot,steering,...wheels,...wheels.map(w=>w.userData.steer)].filter(Boolean));
 if(batch)batchRigidMeshes(root,boundaries);
 c.animateWheels=(distance,steer=0)=>{
  for(const w of wheels){w.rotation.x+=distance/radius;w.userData.steer.rotation.y=w.userData.front?steer:0;}
  if(steering)steering.rotation.z=-steer*2;
 };
 return c;
}
