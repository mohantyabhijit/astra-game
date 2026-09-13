import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { box,mat,texture,labelTexture,mergeStatic } from './render-utils.js';
import { vehicleFactory } from './vehicles.js';
import { addLandmarks } from './landmarks.js';
import { roads,circuit,garages,gems,buildings,barriers,garageWalls,turns,WATER,WORLD_BOUNDS,closestRoad,connections,atCircuit,CIRCUIT_LENGTH,inWater } from './district.js';
import { seededRandom,distance } from './physics.js';
import { segmentBlocked } from './collision-world.js';
import { addEnvironmentAssets, naturalSurfaces } from './environment-assets.js';

function stripGeometry(points,width,closed=false,lateral=0) {
  const vertices=[],uvs=[],indices=[];let along=0;
  for(let i=0;i<points.length+(closed?1:0);i++) {
    const p=points[i%points.length],previous=points[(i-1+points.length)%points.length],next=points[(i+1)%points.length];
    let dx,dz;
    if(!closed&&i===0){dx=next.x-p.x;dz=next.z-p.z;}
    else if(!closed&&i===points.length-1){dx=p.x-previous.x;dz=p.z-previous.z;}
    else {dx=next.x-previous.x;dz=next.z-previous.z;}
    const length=Math.hypot(dx,dz)||1,nx=dz/length,nz=-dx/length;
    if(i>0)along+=distance(p,points[(i-1)%points.length]);
    for(const side of [-1,1]){vertices.push(p.x+nx*(lateral+side*width/2),(p.y||0)+.035,p.z+nz*(lateral+side*width/2));uvs.push((side+1)/2,along/20);}
    if(i>0){const n=i*2;indices.push(n-2,n,n-1,n-1,n,n+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function segment(parent,a,b,width,height,material,yOffset=0) {
  const d=distance(a,b),mesh=box(parent,(a.x+b.x)/2,((a.y||0)+(b.y||0))/2+yOffset,(a.z+b.z)/2,width,height,d+.04,material);
  mesh.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);return mesh;
}
function facadeTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#b0c9cf';c.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=24){c.fillStyle=(x+y)%3===0?'#7d9eab':'#8aa8b4';c.fillRect(x+2,y+2,20,27);c.fillStyle='#d6e1dc';c.fillRect(x,y,2,32);c.fillRect(x,y+30,24,2);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
export function createWorld(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b8d9ec');scene.fog=new THREE.FogExp2('#bdd9e0',.00072);
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.05).texture;
  scene.add(new THREE.HemisphereLight('#d5ecff','#899786',1.5));
  const sun=new THREE.DirectionalLight('#fff0d4',2.4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-68,right:68,top:68,bottom:-68,near:1,far:360});sun.shadow.bias=-.0008;sun.shadow.normalBias=.07;
  scene.add(sun,sun.target);
  const camera=new THREE.PerspectiveCamera(59,innerWidth/innerHeight,.15,3000);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 p;void main(){float h=normalize(p).y;gl_FragColor=vec4(mix(vec3(.77,.88,.9),vec3(.29,.60,.83),smoothstep(-.05,.75,h)),1.);}'}));scene.add(sky);
  const staticRoot=new THREE.Group();scene.add(staticRoot);
  const stone=mat('#d3d3c4'),sidewalk=mat('#bfc2b7'),white=mat('#edeedf'),yellow=mat('#d8b34f'),rail=mat('#a9b9bc',{metalness:.35,roughness:.55}),green=mat('#68954b'),dark=mat('#344e53');
  const surfaces=naturalSurfaces(renderer);
  const roadMat=mat('#b9bfbe',{map:texture('asphalt'),bumpMap:surfaces.asphalt,bumpScale:.025,roughness:1,side:THREE.DoubleSide});
  // Cut the actual bay and river out of the land. Bridges are continuous road strips over the hole.
  const landShape=new THREE.Shape();landShape.moveTo(WORLD_BOUNDS.minX,WORLD_BOUNDS.minZ);landShape.lineTo(WORLD_BOUNDS.maxX,WORLD_BOUNDS.minZ);landShape.lineTo(WORLD_BOUNDS.maxX,WORLD_BOUNDS.maxZ);landShape.lineTo(WORLD_BOUNDS.minX,WORLD_BOUNDS.maxZ);landShape.closePath();
  const hole=new THREE.Path();WATER.forEach((p,i)=>i?hole.lineTo(p.x,p.z):hole.moveTo(p.x,p.z));hole.closePath();landShape.holes.push(hole);
  const terrain=new THREE.Mesh(new THREE.ShapeGeometry(landShape),mat('#ffffff',{map:surfaces.grass,roughness:1,side:THREE.DoubleSide}));terrain.rotation.x=Math.PI/2;terrain.position.y=-.11;staticRoot.add(terrain);
  const waterShape=new THREE.Shape();WATER.forEach((p,i)=>i?waterShape.lineTo(p.x,p.z):waterShape.moveTo(p.x,p.z));waterShape.closePath();
  const water=new THREE.Mesh(new THREE.ShapeGeometry(waterShape),new THREE.MeshStandardMaterial({color:'#539caa',roughness:.38,metalness:.18,side:THREE.DoubleSide}));water.rotation.x=Math.PI/2;water.position.y=-1.1;scene.add(water);
  const promenade=new THREE.Mesh(stripGeometry([...WATER,WATER[0]],7,false,-4),sidewalk);promenade.receiveShadow=true;staticRoot.add(promenade);
  for(let i=0;i<WATER.length;i++) {
    const a=WATER[i],b=WATER[(i+1)%WATER.length],length=distance(a,b),n=Math.ceil(length/10);
    for(let j=0;j<n;j++) {
      const p={x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n},q={x:a.x+(b.x-a.x)*(j+1)/n,z:a.z+(b.z-a.z)*(j+1)/n};
      if(closestRoad(p).distance<25)continue;
      segment(staticRoot,p,q,.15,.14,rail,1.2);box(staticRoot,p.x,.6,p.z,.13,1.2,.13,rail);
    }
  }
  for(const road of roads) {
    const margin=new THREE.Mesh(stripGeometry(road.points,road.width+8,road.closed),sidewalk);margin.position.y=-.04;margin.receiveShadow=true;staticRoot.add(margin);
    const mesh=new THREE.Mesh(stripGeometry(road.points,road.width,road.closed),roadMat);mesh.receiveShadow=true;staticRoot.add(mesh);
    for(const side of [-1,1]) {
      const edge=new THREE.Mesh(stripGeometry(road.points,.15,road.closed,side*(road.width/2-.5)),white);edge.position.y=.025;staticRoot.add(edge);
      if(road.kind==='public')for(const offset of [road.width/2-.95,road.width/2-1.25]){const line=new THREE.Mesh(stripGeometry(road.points,.1,road.closed,side*offset),yellow);line.position.y=.03;staticRoot.add(line);}
    }
    for(let i=1;i<road.points.length-1;i+=2) {
      const a=road.points[i],b=road.points[i+1],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
      if(d<1)continue;const p={x:a.x,z:a.z,y:a.y+.02},q={x:a.x+dx/d*4,z:a.z+dz/d*4,y:a.y+.02};segment(staticRoot,p,q,.17,.025,white,.04);
    }
  }
  for(const b of barriers) {
    const m=box(staticRoot,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,stone);m.rotation.y=b.yaw;
    const panel=box(staticRoot,b.x,b.y+.53,b.z,.53,.72,b.d*.93,matCache(b.x<-900?'#698fa0':'#517c96'));panel.rotation.y=b.yaw;
    if(Math.round(b.x+b.z)%3===0){const fence=box(staticRoot,b.x,b.y+2,b.z,.08,2.8,.08,rail);fence.rotation.y=b.yaw;}
  }
  const glassTexture=facadeTexture(),glass=['#b4c7cd','#8faebe','#b5c7c4','#91b1b5','#c3c7bd'].map(color=>mat(color,{map:glassTexture,roughness:.32,metalness:.28}));
  for(const b of buildings) {
    box(staticRoot,b.x,b.h/2,b.z,b.w,b.h,b.d,glass[b.color]);box(staticRoot,b.x,2,b.z,b.w+1.2,4,b.d+1.2,stone);
    box(staticRoot,b.x,b.h+.5,b.z,b.w+1,1,b.d+1,white);
    for(let y=8;y<b.h;y+=7)box(staticRoot,b.x,y,b.z+b.d/2+.06,b.w,.22,.13,white);
    if(b.h>90)box(staticRoot,b.x,b.h+3,b.z,b.w*.3,5,b.d*.45,stone);
  }
  addLandmarks(scene,glass,stone);
  // A two-level pit building beside the start/finish straight, with garage bays and an open pit lane.
  const pit=new THREE.Group();pit.position.set(59,0,-66);pit.rotation.y=-.149;staticRoot.add(pit);
  box(pit,0,6,0,20,12,180,white);box(pit,-10.15,7,0,.2,5,178,glass[1]);
  for(let z=-80;z<=80;z+=12){box(pit,-10.15,2.4,z,.3,4.8,9,dark);box(pit,-11,5.1,z,2,.25,10,stone);}
  box(pit,0,12.5,0,25,1,186,stone);
  const start=circuit[0],next=circuit[1],startYaw=Math.atan2(next.x-start.x,next.z-start.z);
  const gantry=new THREE.Group();gantry.position.set(start.x,0,start.z);gantry.rotation.y=startYaw;staticRoot.add(gantry);
  box(gantry,-13,5,0,.8,10,.8,rail);box(gantry,13,5,0,.8,10,.8,rail);box(gantry,0,9.4,0,27,1.8,.5,dark);
  const banner=new THREE.Mesh(new THREE.PlaneGeometry(20,1.8),new THREE.MeshBasicMaterial({map:labelTexture('MARINA BAY 2026','#edf5e8','#204c5c'),side:THREE.DoubleSide}));banner.position.set(0,9.35,.28);gantry.add(banner);
  for(let x=-9;x<10;x+=1)for(let z=0;z<3;z++)box(gantry,x,.08,z,1,.04,1,(Math.round(x)+z)%2===0?white:dark);
  for(const t of turns) {
    const nearest=closestRoad(t,[roads[0]]),dx=nearest.b.x-nearest.a.x,dz=nearest.b.z-nearest.a.z,l=Math.hypot(dx,dz);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.7),new THREE.MeshBasicMaterial({map:labelTexture(`T${t.number}`,'#edf5e8','#254852'),side:THREE.DoubleSide}));sign.position.set(t.x+dz/l*13,3.1+t.y,t.z-dx/l*13);sign.rotation.y=nearest.heading+Math.PI;staticRoot.add(sign);
    box(staticRoot,sign.position.x,1.4+t.y,sign.position.z,.13,2.8,.13,rail);
  }
  // Garage walls are drawn directly from the collision objects. Open front, offset opaque sight screen.
  for(const wall of garageWalls){const m=box(staticRoot,wall.x,wall.h/2,wall.z,wall.w,wall.h,wall.d,stone);m.rotation.y=wall.yaw;}
  const garageMarkers=[];
  for(const g of garages) {
    const group=new THREE.Group();group.position.set(g.x,0,g.z);group.rotation.y=Math.atan2(g.outward.x,g.outward.z);staticRoot.add(group);
    box(group,0,.04,0,34,.08,44,sidewalk);box(group,0,6.7,0,36,.4,46,white);
    for(let x=-13;x<=13;x+=8)box(group,x,.105,-11,.1,.03,16,yellow);
    const board=new THREE.Mesh(new THREE.PlaneGeometry(21,2.3),new THREE.MeshBasicMaterial({map:labelTexture('COOLDOWN  P','#fff7e2','#ae691e'),side:THREE.DoubleSide}));board.position.set(0,5,22.7);group.add(board);
    const entrance=new THREE.Mesh(new THREE.TorusGeometry(3.2,.16,6,32),mat('#bd761e',{emissive:'#ad6800',emissiveIntensity:.2}));entrance.position.set(g.entrance.x,3.5,g.entrance.z);entrance.rotation.y=Math.atan2(g.outward.x,g.outward.z);scene.add(entrance);garageMarkers.push({g,mesh:entrance});
    const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([g.local(-15,-20),g.local(15,-20),g.local(15,20),g.local(-15,20)].map(p=>new THREE.Vector3(p.x,.15,p.z))),new THREE.LineBasicMaterial({color:'#c4760b'}));scene.add(boundary);
    const safe=new THREE.Mesh(new THREE.CircleGeometry(6.5,40),new THREE.MeshBasicMaterial({color:'#d99927',transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide}));safe.rotation.x=-Math.PI/2;safe.position.set(g.inside.x,.13,g.inside.z);scene.add(safe);
  }
  const random=seededRandom(77),leafMat=mat('#3d7e45'),trunk=mat('#817b63');
  // Instanced rain-tree crowns and trunks limit draw calls across the full 5 km district.
  const treePositions=[];
  for(let s=20;s<CIRCUIT_LENGTH;s+=48)for(const side of [-1,1]) {
    const p=atCircuit(s,18*side);if(garages.some(g=>distance(g,p)<48)||connections.some(c=>distance(c,p)<28)||inWater(p))continue;treePositions.push(p);
  }
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.24,.44,5.5,6),trunk,treePositions.length),crowns=new THREE.InstancedMesh(new THREE.SphereGeometry(1,9,6),leafMat,treePositions.length*3),dummy=new THREE.Object3D();
  treePositions.forEach((p,i)=>{dummy.position.set(p.x,p.y+2.6,p.z);dummy.scale.set(1,1,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let k=0;k<3;k++){dummy.position.set(p.x+(k-1)*2.2,p.y+6+random(),p.z+(k%2)*1.7);dummy.scale.set(3.5,1.8,3.2);dummy.updateMatrix();crowns.setMatrixAt(i*3+k,dummy.matrix);}});trunks.castShadow=crowns.castShadow=true;scene.add(trunks,crowns);
  const environmentAssets=addEnvironmentAssets(scene,[trunks,crowns]);
  // Sheltered walkways, bus stops, crossings, and green Singapore-style direction boards.
  for(const road of roads.filter(r=>r.kind==='public')) for(let i=3;i<road.points.length-3;i+=9) {
    const p=road.points[i],q=road.points[i+1],yaw=Math.atan2(q.x-p.x,q.z-p.z),group=new THREE.Group();group.position.set(p.x,0,p.z);group.rotation.y=yaw;staticRoot.add(group);
    box(group,road.width/2+3,3.5,0,5,.25,24,white);for(const z of [-10,0,10])box(group,road.width/2+5,1.7,z,.15,3.4,.15,rail);
    box(group,road.width/2+3,.5,0,1,.8,5,stone);
    const busSign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.5),new THREE.MeshBasicMaterial({map:labelTexture('BUS  36','#f5faed','#3c745a'),side:THREE.DoubleSide}));busSign.position.set(road.width/2+3,2.4,7);group.add(busSign);
    for(let x=-road.width/2+1;x<road.width/2-1;x+=2)box(group,x,.11,9,1,.02,3,white);
  }
  for(const g of garages){const sign=new THREE.Mesh(new THREE.PlaneGeometry(10,2.5),new THREE.MeshBasicMaterial({map:labelTexture(g.name.split(' ')[0].toUpperCase()+'  ↗','#fff','#367455'),side:THREE.DoubleSide}));sign.position.set(g.connection.x+15,4,g.connection.z);scene.add(sign);box(staticRoot,sign.position.x,2,sign.position.z,.2,4,.2,rail);}
  const clouds=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,6),new THREE.MeshBasicMaterial({color:'#f4f8f6',transparent:true,opacity:.85,depthWrite:false}),60);
  for(let i=0;i<60;i++){dummy.position.set(-1600+random()*2600,360+random()*160,-1100+random()*2200);dummy.scale.set(40+random()*85,9+random()*14,25+random()*45);dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix);}scene.add(clouds);
  // Merge static meshes by material, preserving the dynamic cars, landmarks, water and route overlay.
  mergeStatic(staticRoot);staticRoot.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=true;}});
  const makeCar=vehicleFactory(scene),playerCar=makeCar('#eae5d5',false,true),policeCars=Array.from({length:3},()=>makeCar('#e0e8e8',true)),trafficCars=[];
  const colors=['#9db6ba','#a9b9b4','#dbdfdb','#848e99','#7ea693','#c99374'];
  const gemMaterial=mat('#7142cd',{emissive:'#6946bc',emissiveIntensity:.25,roughness:.25,metalness:.35}),gemModels=gems.map(g=>{
    const group=new THREE.Group();const gem=new THREE.Mesh(new THREE.OctahedronGeometry(1.15,0),gemMaterial);gem.position.y=2.6;group.add(gem);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.2,.13,6,32),gemMaterial);ring.rotation.x=Math.PI/2;ring.position.y=.2;group.add(ring);group.position.set(g.x,g.y,g.z);scene.add(group);return group;
  });
  const routeMaterial=new THREE.MeshBasicMaterial({color:'#7544c7',transparent:true,opacity:.57,depthWrite:false,side:THREE.DoubleSide});
  const routeMesh=new THREE.Mesh(new THREE.BufferGeometry(),routeMaterial);routeMesh.renderOrder=2;scene.add(routeMesh);
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.85,0,.9,0,0,-1.6,.85,0,.9],3));const arrows=new THREE.InstancedMesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#4a207b',depthWrite:false,side:THREE.DoubleSide}),40);scene.add(arrows);
  const personModels=[];const skin=mat('#bb8d68'),clothes=['#6b8799','#d2b487','#ac7791','#537e65','#dadbd0'].map(c=>mat(c));
  function person(i){const group=new THREE.Group();box(group,0,.95,0,.45,.65,.26,clothes[i%5]);const head=new THREE.Mesh(new THREE.SphereGeometry(.16,7,6),skin);head.position.y=1.45;group.add(head);const legs=[box(group,-.11,.4,0,.16,.7,.17,dark),box(group,.11,.4,0,.16,.7,.17,dark)];scene.add(group);return {group,legs};}
  let initialized=false,lastGuidance=null;const goal=new THREE.Vector3(),look=new THREE.Vector3(),currentLook=new THREE.Vector3();let perf=[];
  function update(g,dt,time,view=0) {
    environmentAssets.update(g.player,time);
    while(trafficCars.length<g.traffic.length){const t=g.traffic[trafficCars.length],model=makeCar(t.kind==='taxi'?'#dbb64b':colors[t.color]);
      if(t.kind==='taxi')box(model.mesh,0,1.83,.2,.9,.25,.55,mat('#f4e4b2'));
      if(t.kind==='bus'){model.mesh.scale.set(1.15,1.5,1.48);box(model.mesh,0,1.65,0,2.05,1.4,4.1,mat('#98bd66'));box(model.mesh,0,2.05,-2.1,1.85,.9,.04,glass[0]);for(const side of [-1,1])for(let z=-1.5;z<=1.5;z+=.7)box(model.mesh,side*1.035,2.0,z,.02,.8,.53,glass[0]);}trafficCars.push(model);}
    function sync(model,body){model.mesh.position.set(body.x,(body.y||0)+.025,body.z);model.mesh.rotation.y=-body.heading;model.mesh.rotation.z=-(body.steer||0)*Math.min(Math.abs(body.speed)/35,1)*.035;model.mesh.visible=body.visible!==false;}
    sync(playerCar,g.player);g.traffic.forEach((t,i)=>sync(trafficCars[i],t));g.police.forEach((c,i)=>sync(policeCars[i],c));
    policeCars.forEach((c,i)=>c.lights.forEach((l,j)=>{l.visible=Math.sin(time*15+i+(j<2?0:Math.PI))>0;}));playerCar.flames.forEach(f=>f.visible=g.boosting);
    while(personModels.length<g.pedestrians.length)personModels.push(person(personModels.length));
    g.pedestrians.forEach((p,i)=>{const model=personModels[i];model.group.position.set(p.x,p.y+.06,p.z);model.group.rotation.y=-p.heading;model.group.visible=distance(p,g.player)<230;model.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(time*4+j*Math.PI)*.25);});
    gemModels.forEach((m,i)=>{m.visible=!g.collected.includes(gems[i].id)&&distance(gems[i],g.player)<450;m.children[0].rotation.y=time;m.children[0].position.y=2.6+Math.sin(time*2+i)*.2;});
    garageMarkers.forEach(({mesh,g:area})=>{mesh.visible=distance(area,g.player)<500;mesh.scale.setScalar(g.guidance?.destination?.id===area.id?1.1+Math.sin(time*2)*.05:1);});
    if(lastGuidance!==g.guidance){lastGuidance=g.guidance;const path=g.guidance?.points||[];let d=0;const visible=[];
      for(let i=0;i<path.length;i++){if(i)d+=distance(path[i-1],path[i]);visible.push({...path[i],y:(path[i].y||0)+.10});if(d>260)break;}
      routeMesh.geometry.dispose();routeMesh.geometry=visible.length>1?stripGeometry(visible,2):new THREE.BufferGeometry();routeMaterial.color.set(g.phase==='free'?'#8044c7':'#d08715');
      arrows.material.color.set(g.phase==='free'?'#643194':'#a85e08');let count=0,run=0;
      for(let i=0;i<visible.length-1&&count<40;i++){const a=visible[i],b=visible[i+1],len=distance(a,b);run+=len;if(run<13)continue;run=0;dummy.position.set(a.x,a.y+.09,a.z);dummy.rotation.set(0,-Math.atan2(b.x-a.x,-(b.z-a.z)),0);dummy.scale.set(1,1,1);dummy.updateMatrix();arrows.setMatrixAt(count++,dummy.matrix);}arrows.count=count;arrows.instanceMatrix.needsUpdate=true;
    }
    const p=g.player,fx=Math.sin(p.heading),fz=-Math.cos(p.heading),base=p.y||0;
    if(g.status==='ready'){goal.set(p.x+11,base+6.1,p.z+13);look.set(p.x-1,base+2,p.z-15);}
    else{const back=view?20:11.5;goal.set(p.x-fx*(back+Math.abs(p.speed)*.035),base+(view?12:6.2),p.z-fz*(back+Math.abs(p.speed)*.035));look.set(p.x+fx*12,base+3,p.z+fz*12);}
    const garage=garages.find(a=>a.contains(p));if(garage){goal.set(p.x-fx*6,base+3.8,p.z-fz*6);look.set(p.x+fx*5,base+1.2,p.z+fz*5);}
    if(g.status!=='ready'&&segmentBlocked(p,{x:goal.x,z:goal.z},.3,true)) {
      for(let t=.8;t>=.1;t-=.1){const x=p.x+(goal.x-p.x)*t,z=p.z+(goal.z-p.z)*t;if(!segmentBlocked(p,{x,z},.3,true)){goal.set(x,base+3.5,z);break;}}
    }
    if(!initialized){camera.position.copy(goal);currentLook.copy(look);initialized=true;}
    camera.position.lerp(goal,1-Math.exp(-6*dt));currentLook.lerp(look,1-Math.exp(-9*dt));camera.lookAt(currentLook);camera.fov+=( (g.boosting?67:59)-camera.fov)*(1-Math.exp(-3*dt));camera.updateProjectionMatrix();
    sun.position.set(p.x-75,140,p.z-60);sun.target.position.set(p.x,0,p.z);sun.target.updateMatrixWorld();
    renderer.render(scene,camera);if(dt>0){perf.push(dt);if(perf.length>180)perf.shift();}
  }
  addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
  return {update,renderer,camera,scene,assets:environmentAssets,resetCamera:()=>{initialized=false;},performance:()=>({fps:perf.length/perf.reduce((a,b)=>a+b,0),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
}
const materials=new Map();function matCache(color){if(!materials.has(color))materials.set(color,mat(color));return materials.get(color);}
