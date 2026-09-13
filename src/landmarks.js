import * as THREE from 'three';
import { box, mat } from './render-utils.js';
import { landmarks } from './district.js';

export function addLandmarks(scene,glass,stone) {
  const ivory=mat('#e9e7db',{roughness:.6}),steel=mat('#d8e2e4',{metalness:.5,roughness:.45}),green=mat('#4d813e'),dark=mat('#387f8d',{roughness:.26,metalness:.4});
  const made=[];
  for(const l of landmarks) {
    const group=new THREE.Group();group.position.set(l.x,0,l.z);group.rotation.y=l.yaw;scene.add(group);made.push(group);
    if(l.id==='singapore_flyer') {
      box(group,0,2,0,72,4,30,stone);
      for(const z of [-3.2,3.2]) {
        const ring=new THREE.Mesh(new THREE.TorusGeometry(73,1.2,8,96),steel);ring.position.set(0,90,z);group.add(ring);
        for(let i=0;i<28;i++) {
          const a=i/28*Math.PI*2,spoke=box(group,Math.sin(a)*36,90+Math.cos(a)*36,z,.28,73,.28,steel);spoke.rotation.z=-a;
        }
      }
      for(let i=0;i<28;i++) {
        const a=i/28*Math.PI*2,capsule=new THREE.Mesh(new THREE.CapsuleGeometry(2.1,4.5,4,8),dark);
        capsule.rotation.z=Math.PI/2;capsule.position.set(Math.sin(a)*73,90+Math.cos(a)*73,0);group.add(capsule);
        box(group,Math.sin(a)*73,90+Math.cos(a)*73+1.9,0,7,.3,4.5,ivory);
      }
      for(const s of [-1,1]) {const leg=box(group,s*15,43,0,3.2,91,3.2,ivory);leg.rotation.z=s*.35;}
      const axle=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.3,14,16),steel);axle.rotation.x=Math.PI/2;axle.position.y=90;group.add(axle);
    } else if(l.id==='marina_bay_sands') {
      box(group,0,4,0,290,8,75,ivory);
      for(const x of [-102,0,102]) {
        for(const side of [-1,1]) {
          const tower=box(group,x+side*13,99,side*10,29,190,45,glass[1]);tower.rotation.z=side*.055;
          for(let y=10;y<196;y+=5.4)box(group,x+side*13+(99-y)*Math.sin(side*.055),y,side*10+23,29,.42,.6,ivory);
        }
      }
      const shape=new THREE.Shape();shape.moveTo(-175,-18);shape.bezierCurveTo(-195,-10,-191,12,-162,20);shape.lineTo(164,20);shape.bezierCurveTo(190,15,193,-15,165,-21);shape.closePath();
      const deck=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:7,bevelEnabled:true,bevelSize:2,bevelThickness:2,bevelSegments:2,steps:1}),ivory);
      deck.rotation.x=-Math.PI/2;deck.position.y=200;group.add(deck);
      box(group,0,208,0,280,1.2,28,green);box(group,-50,209,0,125,.3,13,mat('#398b9b',{roughness:.25,metalness:.2}));
      for(let x=65;x<160;x+=12) {box(group,x,211,0,1,7,1,stone);const crown=new THREE.Mesh(new THREE.SphereGeometry(4.4,8,6),green);crown.position.set(x,215,0);group.add(crown);}
    }else if(l.id==='esplanade') {
      box(group,0,4,0,118,8,76,glass[2]);
      const shade=mat('#b4bcaa',{metalness:.35,roughness:.65});
      for(const x of [-30,30]) {
        const dome=new THREE.Mesh(new THREE.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI/2),shade);dome.position.set(x,8,0);dome.scale.set(28,24,37);group.add(dome);
        const spikes=new THREE.InstancedMesh(new THREE.ConeGeometry(1.35,3,3),ivory,360),dummy=new THREE.Object3D();let n=0;
        for(let row=1;row<=10;row++)for(let col=0;col<36;col++) {
          const phi=row/11*Math.PI/2,a=col/36*Math.PI*2+(row%2)*.085;
          dummy.position.set(x+28*Math.sin(phi)*Math.cos(a),8+24*Math.cos(phi),37*Math.sin(phi)*Math.sin(a));
          const normal=new THREE.Vector3(Math.sin(phi)*Math.cos(a),Math.cos(phi),Math.sin(phi)*Math.sin(a)).normalize();dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);dummy.updateMatrix();spikes.setMatrixAt(n++,dummy.matrix);
        }
        group.add(spikes);
      }
    }else if(l.id==='fullerton') {
      box(group,0,17,0,94,34,48,ivory);box(group,0,35,0,97,2,50,stone);
      const window=glass[2];
      for(let x=-39;x<=39;x+=9)for(let y=9;y<29;y+=8)box(group,x,y,-24.1,4.5,5.2,.3,window);
      for(let x=-40;x<=40;x+=10) {const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.85,1,19,8),ivory);pillar.position.set(x,13,-27);group.add(pillar);}
      box(group,0,24,-27,90,2,5,ivory);
    }
    group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  }
  return made;
}
