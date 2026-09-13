import source from '../data/circuit-source.json' with { type: 'json' };
import { distance, seededRandom } from './physics.js';

export const WORLD_BOUNDS={minX:-1620,maxX:210,minZ:-430,maxZ:1140};
export const CIRCUIT_EDITION = '2026 · 19 turns · 4.927 km';
export const CIRCUIT_SOURCE = source.source;
export const originalCircuit = source.routePoints.map(([x, north], i) => ({ x, z: -north, y: 0, sourceIndex: i }));
const cumulative = [0];
for (let i = 1; i < originalCircuit.length; i++) cumulative.push(cumulative[i-1] + distance(originalCircuit[i-1], originalCircuit[i]));
export const CIRCUIT_LENGTH = cumulative.at(-1) + distance(originalCircuit.at(-1), originalCircuit[0]);
// Two gentle, explicit bridge profiles. Road, vehicle height, navigation and markings share these elevations.
for (const [from,to] of [[124,139],[146,155]]) {
  const start = cumulative[from], length = cumulative[to] - start;
  for (let i = from; i <= to; i++) originalCircuit[i].y = 3 * Math.sin((cumulative[i] - start) / length * Math.PI) ** 2;
}
function resample(points, closed, step = 12) {
  const out = [];
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
    const a = points[i], b = points[(i+1)%points.length], n = Math.max(1, Math.ceil(distance(a,b) / step));
    for (let j = 0; j < n; j++) { const t=j/n; out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t}); }
  }
  if (!closed) out.push({...points.at(-1)});
  return out;
}
export const circuit = resample(originalCircuit, true);
export const turns = source.turnMarkers.map(t=>({ ...originalCircuit[t.routePointIndex], number:t.turn }));
export const roads = [{ id:'circuit', name:'Marina Bay Street Circuit', points:circuit, width:21, closed:true, kind:'circuit' }];
export function projectSegment(p,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
  const t=l2 ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2)) : 0;
  const q={x:a.x+dx*t,z:a.z+dz*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t};
  return {...q,t,distance:distance(p,q)};
}
export function closestRoad(p, roadList=roads) {
  let best=null;
  for(const road of roadList) for(let i=0;i<road.points.length-(road.closed?0:1);i++) {
    const a=road.points[i],b=road.points[(i+1)%road.points.length], q=projectSegment(p,a,b);
    if(!best||q.distance<best.distance) best={...q,road,index:i,a,b,heading:Math.atan2(b.x-a.x,-(b.z-a.z))};
  }
  return best;
}
export function atCircuit(distanceAlong, lane=0, direction=1) {
  let d=((distanceAlong%CIRCUIT_LENGTH)+CIRCUIT_LENGTH)%CIRCUIT_LENGTH;
  for(let i=0;i<circuit.length;i++) {
    const a=circuit[i],b=circuit[(i+1)%circuit.length], length=distance(a,b);
    if(d<=length) {
      const t=d/length,dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
      return {x:a.x+(b.x-a.x)*t + dz*lane*direction,z:a.z+(b.z-a.z)*t-dx*lane*direction,y:a.y+(b.y-a.y)*t,heading:Math.atan2(dx*direction,-dz*direction),index:i};
    }
    d-=length;
  }
  return {...circuit[0],heading:0,index:0};
}
export const garages = source.garages.map((g,i)=> {
  const centre={x:g.position[0],z:-g.position[1],y:0};
  const yaw=g.entranceYaw*Math.PI/180;
  // Source yaw uses +X east / +Y north; this vector points outward from the entrance.
  const outward={x:Math.sin(yaw),z:Math.cos(yaw)}, side={x:outward.z,z:-outward.x};
  const local=(x,z)=>({x:centre.x+side.x*x+outward.x*z,z:centre.z+side.z*x+outward.z*z,y:0});
  const entrance=local(0,22), approach=local(0,44), inside=local(-4,-10), elbow=local(10,12), bend=local(10,-10);
  const join=closestRoad(approach,[roads[0]]);
  const connection={x:join.x,z:join.z,y:join.y};
  const id=['flyer-courtyard','civic-parking','esplanade-service'][i];
  return {id,name:['Flyer service courtyard','Civic sheltered parking','Esplanade loading court'][i],...centre,heading:Math.atan2(outward.x,-outward.z),outward,side,local,entrance,approach,inside,elbow,bend,connection,width:34,depth:44,
    contains(p){const dx=p.x-centre.x,dz=p.z-centre.z;return Math.abs(dx*side.x+dz*side.z)<15.8&&Math.abs(dx*outward.x+dz*outward.z)<20.8;}};
});
for(const g of garages) roads.push({id:g.id,name:g.name,kind:'service',width:14,closed:false,points:resample([g.connection,g.approach,g.entrance,g.elbow,g.bend,g.inside],false,8)});
// Public access loop east of the Flyer and a pit lane have explicit joins to the circuit.
const publicA=originalCircuit[218],publicB=originalCircuit[0];
roads.push({id:'raffles-access',name:'Raffles Avenue access',kind:'public',width:23,closed:false,points:resample([publicA,{x:85,z:330,y:0},{x:125,z:215,y:0},{x:110,z:150,y:0},{x:25,z:150,y:0},publicB],false)});
const civicA=originalCircuit[101],civicB=originalCircuit[118];
roads.push({id:'civic-streets',name:'Civic District service road',kind:'public',width:22,closed:false,points:resample([civicA,{x:-1300,z:-115,y:0},{x:-1535,z:95,y:0},{x:-1510,z:255,y:0},civicB],false)});
roads.push({id:'pit-lane',name:'Pit lane',kind:'pit',width:12,closed:false,points:resample([originalCircuit[222],{x:43,z:100,y:0},{x:5,z:-170,y:0},originalCircuit[2]],false)});
// A compact public loop leaves the circuit beside Fullerton and opens onto
// Merlion Park. Its eastern edge stays just inside the modelled shoreline.
roads.push({id:'merlion-access',name:'Merlion Park access',kind:'public',width:13,closed:false,points:resample([
  originalCircuit[143],
  {x:-1152,z:579,y:0},
  {x:-1132,z:594,y:0},
  {x:-1115,z:586,y:0},
  {x:-1130,z:570,y:0},
  originalCircuit[147],
],false,6)});
// Bayfront Drive connects the eastern public streets to the Sands waterfront.
roads.push({id:'bayfront-drive',name:'Bayfront Drive',kind:'public',width:22,closed:false,points:resample([
  {x:125,z:215,y:0},{x:170,z:440,y:0},{x:155,z:790,y:0},{x:60,z:1055,y:0},
  {x:-610,z:1080,y:0},{x:-650,z:1030,y:0}
],false,12)});
export const connections=roads.filter(r=>r.id!=='circuit').flatMap(r=>[r.points[0],r.points.at(-1)]);

export const WATER = [
  {x:-1850,z:380},{x:-1340,z:375},{x:-1180,z:400},{x:-1070,z:380},
  {x:-1000,z:300},{x:-830,z:270},{x:-520,z:270},{x:-310,z:350},{x:-160,z:390},
  {x:-90,z:560},{x:-230,z:790},{x:-450,z:875},{x:-760,z:900},{x:-1030,z:710},
  {x:-1130,z:500},{x:-1300,z:455},{x:-1850,z:460}
];
export function inWater(p) { let inside=false;for(let i=0,j=WATER.length-1;i<WATER.length;j=i++) {const a=WATER[i],b=WATER[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside; }
export const landmarks=source.landmarks.map(l=>({id:l.id,x:l.position[0],z:-l.position[1],yaw:l.yaw*Math.PI/180}));
export const MERLION = {id:'merlion',name:'Merlion Park',x:-1096,z:600,y:0,yaw:-Math.PI/2};
export const MERLION_PLAZA = {x:-1120,z:600,w:78,d:38,height:.24};
// Walking surfaces match the rendered terrace and elevated road deck.
export function walkingSurfaceHeight(p) {
  const road=closestRoad(p);
  const roadY=road.distance<=road.road.width/2 ? road.y : 0;
  const plaza=MERLION_PLAZA;
  return Math.max(roadY,Math.abs(p.x-plaza.x)<=plaza.w/2 && Math.abs(p.z-plaza.z)<=plaza.d/2 ? plaza.height : 0);
}
export function vehicleSurfaceHeight(car,road=closestRoad(car)) {
  const heading=car.heading||0,fx=Math.sin(heading),fz=-Math.cos(heading);
  const axle=(car.halfL||2.55)*.7,track=(car.halfW||1.14)*.9;
  const plaza=MERLION_PLAZA;
  const surface=p=>{
    const q=projectSegment(p,road.a,road.b);
    const paved=q.distance<=road.road.width/2 ? q.y : 0;
    return Math.max(paved,Math.abs(p.x-plaza.x)<=plaza.w/2 && Math.abs(p.z-plaza.z)<=plaza.d/2 ? plaza.height : 0);
  };
  let height=surface(car);
  for(const front of [-1,1])for(const side of [-1,1]) {
    height=Math.max(height,surface({
      x:car.x+fx*axle*front-fz*track*side,
      z:car.z+fz*axle*front+fx*track*side,
    }));
  }
  return height;
}
landmarks.push(MERLION);
export const gems = Array.from({length:24},(_,i)=> {
  // Early gems introduce the loop quickly; the rest reward exploring the whole circuit.
  const along=i<3 ? 42+i*85 : 380+(i-3)*(CIRCUIT_LENGTH-500)/21;
  return {id:`gem-${i+1}`,name:`Gem ${String(i+1).padStart(2,'0')}`, ...atCircuit(along,0),along};
});
export const MERLION_SPAWN = {x:-1145,z:582,y:0,heading:2.214297435588181};
export const SPAWN = {...MERLION_SPAWN};
// Persistent HUD landmarks and the explicit driving mission.  These sit on the
// existing road graph so both the minimap and turn-by-turn guidance can route
// to them without inventing a second map coordinate system.
export const MISSIONS = [{
  id:'marina-gem-run',
  name:'Marina Gem Run',
  vehicleId:'mission-sports',
  ...atCircuit(34,-3.6),
}];
export const POLICE_STATION = {
  id:'marina-police-station',
  name:'Marina Bay Police Station',
  ...atCircuit(640,-3.6),
};
const random=seededRandom(20260913);
export const buildings=[];
function clearSite(p,w,d) {
  if(inWater(p))return false;
  if(closestRoad(p).distance<Math.hypot(w,d)/2+22)return false;
  if(garages.some(g=>distance(g,p)<70))return false;
  if(landmarks.some(l=>distance(l,p)<110))return false;
  return true;
}
// Dense northern/civic blocks; the bayfront remains open for landmark sight lines.
for(let x=-1620;x<100;x+=78)for(let z=-460;z<300;z+=78) {
  const p={x:x+(random()-.5)*20,z:z+(random()-.5)*20};
  const w=32+random()*20,d=30+random()*22;
  if(!clearSite(p,w,d))continue;
  buildings.push({...p,w,d,h:20+random()*90,color:Math.floor(random()*5),kind:'tower'});
}
for(let i=0;i<26;i++) {
  const p={x:-1550+(i%7)*75,z:700+Math.floor(i/7)*94},w=35+random()*18,d=40;
  if(clearSite(p,w,d))buildings.push({...p,w,d,h:80+random()*165,color:i%5,kind:'skyline'});
}
// Roads are open to the surrounding city; no roadside barrier meshes or colliders.
export const barriers=[];
export const garageWalls=garages.flatMap(g=>[
  {local:[-17,0],w:1,d:44,h:6.5},{local:[17,0],w:1,d:44,h:6.5},{local:[0,-22],w:34,d:1,h:6.5},
  {local:[-4,0],w:15,d:1,h:6.5},
].map(w=>({...g.local(...w.local),w:w.w,d:w.d,h:w.h,yaw:Math.atan2(g.outward.x,g.outward.z),kind:'garage-wall'})));
export const landmarkBases=landmarks.flatMap(l=> {
  const dimensions={singapore_flyer:[72,30,4],marina_bay_sands:[306,105,8],esplanade:[118,76,8],fullerton:[94,48,34]}[l.id];
  return dimensions?[{x:l.x,z:l.z,w:dimensions[0],d:dimensions[1],h:dimensions[2],yaw:l.yaw,kind:'landmark'}]:[];
});
export const pitCollider={x:59,z:-66,w:20,d:180,h:12,yaw:-.149,kind:'pit-building'};
export const policeStationCollider={x:-220.8142,z:-150.5652,w:22,d:14,h:9,yaw:-POLICE_STATION.heading,kind:'police-station'};
export const merlionCollider={x:-1096,z:600,w:8,d:8,h:9,yaw:0,kind:'landmark'};
export const parkFurniture = [
  ...[-12,12].flatMap(z => [-31,-21,-11,-1].map(x => ({x:-1120+x,z:600+z,w:5.5,d:1.3,h:1,yaw:0,kind:'bench'}))),
  ...[-30,-14,2].map(x => ({x:-1120+x,z:616.5,w:4,d:2,h:2,yaw:0,kind:'planter'})),
  ...[-14,14].flatMap(z => Array.from({length:9},(_,i)=>({x:-1154+i*8,z:600+z,w:.22,d:.22,h:1.6,yaw:0,kind:'bollard'})))
].filter(o => closestRoad(o).distance > 6.5 + Math.hypot(o.w,o.d)/2 + 1.5);
export const obstacles=[...parkFurniture,...buildings,...barriers,...garageWalls,...landmarkBases,pitCollider,policeStationCollider,merlionCollider,{x:MERLION.x+7.95,z:MERLION.z,w:6.1,d:6.1,h:.5,yaw:0,kind:"fountain-pool"}];


export function atPublicRoad(road,along,lane=4.2) {
  const lengths=road.points.slice(1).map((p,i)=>distance(road.points[i],p)),length=lengths.reduce((a,b)=>a+b,0);
  let d=((along%(length*2))+length*2)%(length*2),direction=d>length?-1:1;if(direction<0)d=2*length-d;
  for(let i=0;i<lengths.length;i++){if(d<=lengths[i]){const a=road.points[i],b=road.points[i+1],t=d/lengths[i],dx=(b.x-a.x)/lengths[i],dz=(b.z-a.z)/lengths[i];return{x:a.x+(b.x-a.x)*t+dz*lane*direction,z:a.z+(b.z-a.z)*t-dx*lane*direction,y:0,heading:Math.atan2(dx*direction,-dz*direction)};}d-=lengths[i];}
  return {...road.points[0],heading:0};
}
