import {distance} from './physics.js';
import {driveableConnector} from './collision-world.js';
import {sweptVehicleHit} from './wobble/original/impacts.js';
export const vehicleDimensions = type => type==='sports'?{width:2.08,length:4.42,wheelbase:2.84}:type==='mini'?{width:1.76,length:3.82,wheelbase:2.4}:{width:1.92,length:4.05,wheelbase:2.54};
export function carPoint(car,x,z){const c=Math.cos(car.heading),s=Math.sin(car.heading);return {x:car.x-c*x+s*z,z:car.z-s*x-c*z,y:car.y||0};}
export function boardingRoute(player,car,vehicles){
 const d=vehicleDimensions(car.type),side=d.width/2+.65,end=d.length/2+.65;
 const goal=carPoint(car,d.width/2+.53,-.98);
 const nodes=[{x:player.x,z:player.z,y:player.y},goal,...[-1,1].flatMap(x=>[-1,1].map(z=>carPoint(car,x*side,z*end)))];
 const clear=(a,b)=>driveableConnector(a,b,.3)&&!vehicles.some(v=>{
  if(v.destroyed)return false;
  const size=v===car?d:{width:(v.halfW||1.1)*2,length:(v.halfL||2.5)*2};
  return sweptVehicleHit({heading:-v.heading,...size},{x:v.x,z:v.z},{x:v.x-(b.x-a.x),z:v.z-(b.z-a.z)},a,.3);
 });
 const costs=nodes.map(()=>Infinity),previous=[],done=new Set();costs[0]=0;
 while(done.size<nodes.length){let i=-1;for(let j=0;j<nodes.length;j++)if(!done.has(j)&&(i<0||costs[j]<costs[i]))i=j;
  if(i<0||!Number.isFinite(costs[i]))break;if(i===1){const path=[];for(let n=1;n!==0;n=previous[n])path.unshift(nodes[n]);return path;}done.add(i);
  for(let j=1;j<nodes.length;j++)if(!done.has(j)&&clear(nodes[i],nodes[j])){const cost=costs[i]+distance(nodes[i],nodes[j]);if(cost<costs[j]){costs[j]=cost;previous[j]=i;}}
 }
 return null;
}
