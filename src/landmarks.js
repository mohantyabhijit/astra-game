import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { box, mat } from './render-utils.js';
import { landmarks } from './district.js';

export function addLandmarks(scene,glass,stone) {
  const ivory=mat('#e9e7db',{roughness:.6}),steel=mat('#d8e2e4',{metalness:.5,roughness:.45}),green=mat('#4d813e'),dark=mat('#387f8d',{roughness:.26,metalness:.4});
  const made=[],pending=[];
  for(const l of landmarks) {
    const group=new THREE.Group();group.position.set(l.x,0,l.z);group.rotation.y=l.yaw;group.name=l.id;scene.add(group);made.push(group);
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
      // Upstream model is authored in metres, with +Z facing the bay.
      group.rotation.y=l.yaw+Math.PI;
      pending.push(new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/marina-bay-sands/marina-bay-sands.glb`).then(asset=>{
        const model=asset.scene;
        model.position.set(10,.6,0); // Centre the plinth and seat its underside on ground.
        model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
        group.add(model);
        group.userData.sourceCommit='94be054';
        group.userData.importedModel=true;
      }));
    }else if(l.id==='esplanade') {
      box(group,0,4,0,118,8,76,glass[2]);
      const shade=mat('#71939a',{metalness:.5,roughness:.28});
      for(const x of [-30,30]) {
        const dome=new THREE.Mesh(new THREE.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI/2),shade);dome.position.set(x,8,0);dome.scale.set(28,24,37);group.add(dome);
        // Individual triangular aluminium sunshades follow the ellipsoid normals.
        const finGeometry=new THREE.BufferGeometry();
        finGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-1.6,0,-1.3,1.6,0,-1.3,0,1.1,1.8],3));finGeometry.computeVertexNormals();
        const fins=new THREE.InstancedMesh(finGeometry,new THREE.MeshStandardMaterial({color:'#ced4ca',metalness:.55,roughness:.45,side:THREE.DoubleSide}),720),dummy=new THREE.Object3D();let n=0;
        for(let row=1;row<=15;row++)for(let col=0;col<48;col++){
          const phi=row/16*Math.PI/2,a=col/48*Math.PI*2+(row%2)*.065;
          dummy.position.set(x+28*Math.sin(phi)*Math.cos(a),8+24*Math.cos(phi),37*Math.sin(phi)*Math.sin(a));
          const normal=new THREE.Vector3(Math.sin(phi)*Math.cos(a)/28,Math.cos(phi)/24,Math.sin(phi)*Math.sin(a)/37).normalize();
          dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);dummy.scale.setScalar(.65+Math.sin(phi)*.55);dummy.updateMatrix();fins.setMatrixAt(n++,dummy.matrix);
        }
        group.add(fins);
        const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.012,4,80),steel);ring.rotation.x=Math.PI/2;ring.scale.set(28,37,28);ring.position.set(x,8,0);group.add(ring);
        for(let a=0;a<Math.PI*2;a+=Math.PI/20)box(group,x+27*Math.cos(a),5,36*Math.sin(a),.5,7,.5,steel);

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
  return {groups:made,ready:Promise.all(pending)};
}
