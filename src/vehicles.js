import * as THREE from 'three';
import {mat,lightMat,box,texture,labelTexture,mergeStatic} from './render-utils.js';
export function vehicleFactory(scene){
const dark=mat('#24333a'),red=lightMat('#e84c39',.5);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,.6)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); const glowMap = new THREE.CanvasTexture(glowCanvas);
  const paintMap = texture('vehicle');
  function makeCar(color = '#e8e6d6', police = false, player = false) {
    const car = new THREE.Group();
    const paint = mat(color, { map: paintMap, roughness: .36, metalness: .30 });
    const glass = mat('#0e2835', { roughness: .2, metalness: .55 });
    const rubber = mat('#10191e'), chrome = mat('#8ea9ae', { metalness: .8, roughness: .25 });
    box(car, 0, .66, 0, 2.25, .62, 4.75, police ? dark : paint);
    box(car, 0, .91, -.1, 2.22, .28, 4.55, paint);
    const cabin = new THREE.BoxGeometry(1, 1, 1);
    const positions = cabin.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const top = positions.getY(i) > 0;
      positions.setXYZ(i, positions.getX(i) * (top ? 1.68 : 1.94), top ? 1.57 : 1.04,
        positions.getZ(i) * (top ? 1.44 : 2.74) + .2);
    }
    cabin.computeVertexNormals(); car.add(new THREE.Mesh(cabin, glass));
    box(car, 0, 1.6, .2, 1.73, .09, 1.48, paint);
    for (const side of [-1, 1]) {
      const pillar = box(car, side * .90, 1.29, .20, .065, .58, .075, paint); pillar.rotation.z = side * .22;
    }
    box(car, 0, 1.02, -1.65, 2.12, .14, 1.25, paint);
    box(car, 0, .49, -2.40, 2.15, .19, .10, dark); box(car, 0, .50, 2.4, 2.15, .23, .13, dark);
    for (const side of [-1, 1]) {
      box(car, side * .79, .81, -2.37, .51, .18, .06, lightMat('#f9edc0', 2.5));
      box(car, side * .76, .86, 2.37, .63, .17, .06, red);
      box(car, side * 1.21, 1.18, -.65, .27, .15, .34, paint);
      box(car, side * 1.126, .75, .1, .02, .035, 3.9, dark);
      for (const z of [-1.42, 1.46]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .3, 12), rubber);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.11, .43, z); car.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .32, 8), chrome);
        hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); car.add(hub);
      }
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(.62, .16), new THREE.MeshBasicMaterial({ map: labelTexture(police ? 'POLICE' : 'MIDNIGHT', '#14222c', '#d5d5bf') }));
    plate.rotation.y = Math.PI; plate.position.set(0, .71, 2.46); car.add(plate);
    box(car, 0, 1.14, 2.04, 2.35, .08, .37, police ? dark : paint);
    // Batch each vehicle's fixed pieces; lights and boost flames stay independently animated.
    mergeStatic(car);
    const lights = [];
    if (police) {
      box(car, 0, 1.77, .28, 1.5, .12, .35, dark);
      for (const side of [-1, 1]) {
        const m = lightMat(side === 1 ? '#3b91ff' : '#ff314d', 4);
        lights.push(box(car, side * .46, 1.88, .28, .65, .15, .32, m));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: side === 1 ? '#278bff' : '#ff1749', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.set(side * .46, 1.91, .28); glow.scale.set(3.2, 3.2, 1); car.add(glow); lights.push(glow);
      }
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 6.1), new THREE.MeshBasicMaterial({ map: glowMap, color: '#000000', transparent: true, opacity: .85, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .055; car.add(shadow);
    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.5), new THREE.MeshBasicMaterial({ map: glowMap, color: player ? '#4de8dc' : '#e8c89e', transparent: true, opacity: player ? .65 : .15, blending: THREE.AdditiveBlending, depthWrite: false }));
    underglow.rotation.x = -Math.PI / 2; underglow.position.y = .065; car.add(underglow);
    const flames = [];
    if (player) for (const x of [-.75, .75]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.17, 1.6, 6), lightMat('#68dfff', 4));
      flame.rotation.x = Math.PI / 2; flame.position.set(x, .5, 3.05); flame.visible = false; car.add(flame); flames.push(flame);
    }
    car.traverse(o=>{if(o.isMesh&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
    scene.add(car); return { mesh: car, lights, flames };
  }

return makeCar;
}
