import {roads,walkingSurfaceHeight} from './district.js';
import {driveableConnector} from './collision-world.js';
import {distance} from './physics.js';
import {availableCars,walkingPathClear} from './vehicle-access.js';

// Routes belong to the city, not the player's heading or vehicle position.
// Reuse them when distant people enter a newly visited neighbourhood.
const routes=[];
for(const road of roads){
  for(let i=0;i<road.points.length-4;i+=2){
    const a=road.points[i],b=road.points[i+4],length=distance(a,b);
    if(length<16)continue;
    const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
    for(const side of [-1,1]){
      const offset=(road.width/2+2.5)*side;
      const start={x:a.x-dz*offset,z:a.z+dx*offset};
      const end={x:b.x-dz*offset,z:b.z+dx*offset};
      start.y=walkingSurfaceHeight(start);end.y=walkingSurfaceHeight(end);
      if(driveableConnector(start,end,.6))routes.push({start,end});
    }
  }
}

export function populateNearbyPedestrians(g){
  let nearby=g.pedestrians.filter(p=>!p.hit&&distance(p,g.player)<130).length;
  if(nearby>=20)return;
  const cars=availableCars(g);
  // Plazas and open spaces also need routes where no sidewalk is close enough.
  // Snap to a world grid so these walks stay fixed when the player moves.
  const localRoutes=[...routes];
  const cellX=Math.floor(g.player.x/20),cellZ=Math.floor(g.player.z/20);
  for(let x=cellX-6;x<=cellX+6;x++)for(let z=cellZ-6;z<=cellZ+6;z++){
    const start={x:x*20,z:z*20};
    const range=distance(start,g.player);if(range<35||range>=120)continue;
    start.y=walkingSurfaceHeight(start);
    for(const [dx,dz] of [[24,0],[-24,0],[0,24],[0,-24]]){
      const end={x:start.x+dx,z:start.z+dz};end.y=walkingSurfaceHeight(end);
      if(driveableConnector(start,end,.6))localRoutes.push({start,end});
    }
  }
  const candidates=localRoutes.filter(r=>{
    const range=distance(r.start,g.player);
    return range>=35&&range<120 && cars.every(c=>distance(c,r.start)>8)
      && walkingPathClear(g,r.start,r.end);
  });
  for(const p of g.pedestrians){
    if(nearby>=20)break;
    // Keep visible people and their current walks in place in both travel modes.
    if(distance(p,g.player)<260||p.hit||p.reaction)continue;
    for(let attempt=0;attempt<candidates.length;attempt++){
      const route=candidates[(p.appearance+attempt)%candidates.length];
      if(g.pedestrians.some(other=>other!==p&&distance(other,route.start)<3.2))continue;
      Object.assign(p,route.start,{
        wanderRoad:{points:[{...route.start},{...route.end}]},
        waypoint:1,direction:1,pause:0,blockedTime:0,wanderTimer:12,
        heading:Math.atan2(route.end.x-route.start.x,-(route.end.z-route.start.z)),
      });
      nearby++;break;
    }
  }
}
